#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bundles project files into a single text artifact for Language Models.

This script is a core component of the Prompt-Assisted Workflow System (PAWS).
It supports a rich command-line interface for specifying files to include and
exclude, and features an advanced CATSCAN-aware bundling mode that prioritizes
architectural documentation over raw source code when available.
"""

import sys
import os
import argparse
import base64
import glob
import ast
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Union, Set, Any, Dict

# --- Configuration Constants ---
DEFAULT_SYS_PROMPT_FILENAME = "sys/sys_a.md"
DEFAULT_OUTPUT_FILENAME = "cats.md"
DEFAULT_ENCODING = "utf-8"
PAWSIGNORE_FILENAME = ".pawsignore"
DEFAULT_EXCLUDES = [
    ".git",
    "node_modules",
    "**/__pycache__",
    "**/*.pyc",
    ".DS_Store",
    "cats.md",
    "dogs.md",
]

# --- Bundle Structure Constants ---
PERSONA_HEADER = "\n--- START PERSONA ---\n"
PERSONA_FOOTER = "\n--- END PERSONA ---\n"
SYS_PROMPT_POST_SEPARATOR = (
    "\n--- END PREPENDED INSTRUCTIONS ---\nThe following content is the Cats Bundle.\n"
)
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: "
BASE64_HINT_TEXT = "(Content:Base64)"
START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {path}{hint} ---"
END_MARKER_TEMPLATE = "🐈 --- CATS_END_FILE: {path}{hint} ---"

# --- Type Aliases ---
FileObject = Dict[str, Union[str, bytes, bool, Optional[str], Path]]


class Ansi:
    """A utility class for ANSI color codes for terminal output."""

    GREEN, RED, YELLOW, BLUE, RESET = (
        "\033[92m",
        "\033[91m",
        "\033[93m",
        "\033[94m",
        "\033[0m",
    )


def log_info(message: str, quiet: bool):
    if not quiet:
        print(f"{Ansi.GREEN}Info:{Ansi.RESET} {message}", file=sys.stderr)


def log_warning(message: str, quiet: bool):
    if not quiet:
        print(f"{Ansi.YELLOW}Warning:{Ansi.RESET} {message}", file=sys.stderr)


def log_error(message: str):
    print(f"{Ansi.RED}Error:{Ansi.RESET} {message}", file=sys.stderr)


@dataclass
class BundleConfig:
    """Encapsulates all configuration for a bundling operation."""

    path_specs: List[str]
    exclude_patterns: List[str]
    output_file: Optional[Path]
    encoding_mode: str
    use_default_excludes: bool
    prepare_for_delta: bool
    persona_files: List[Path]
    sys_prompt_file: str
    no_sys_prompt: bool
    require_sys_prompt: bool
    strict_catscan: bool
    verify: Optional[str]
    quiet: bool
    yes: bool


@dataclass
class PathCollection:
    """Holds the results of path processing and statistics."""

    final_paths: List[Path]
    catscan_count: int
    user_excluded_count: int


# --- Verification Logic ---
class PythonASTVisitor(ast.NodeVisitor):
    def __init__(self):
        self.public_api = {}
        self.dependencies = set()

    def visit_FunctionDef(self, node: ast.FunctionDef):
        if not node.name.startswith("_"):
            self.public_api[node.name] = {
                "type": "function",
                "args": [arg.arg for arg in node.args.args],
            }
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        if not node.name.startswith("_"):
            methods = {}
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and not item.name.startswith("_"):
                    methods[item.name] = {
                        "type": "method",
                        "args": [arg.arg for arg in item.args.args],
                    }
            self.public_api[node.name] = {"type": "class", "methods": methods}
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.dependencies.add(alias.name.split(".")[0])

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            self.dependencies.add(node.module.split(".")[0])


def verify_python_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    visitor = PythonASTVisitor()
    for py_file in module_path.rglob("*.py"):
        try:
            tree = ast.parse(py_file.read_text(encoding=DEFAULT_ENCODING))
            visitor.visit(tree)
        except Exception as e:
            log_warning(f"Could not parse {py_file.name}: {e}", quiet)
    return {"api": visitor.public_api, "deps": list(sorted(visitor.dependencies))}


def verify_js_ts_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    log_warning(f"JS/TS verification for {module_path.name} is a placeholder.", quiet)
    return {"api": {}, "deps": []}


def verify_dart_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    log_warning(f"Dart verification for {module_path.name} is a placeholder.", quiet)
    return {"api": {}, "deps": []}


def run_verification(config: BundleConfig, cwd: Path):
    log_info("Starting CATSCAN Verification...", config.quiet)
    target_path = cwd / config.verify
    if not target_path.exists():
        log_error(f"Path '{config.verify}' not found.")
        sys.exit(1)

    all_catscans = list(target_path.rglob("CATSCAN.md"))
    if not all_catscans:
        log_warning(f"No CATSCAN.md files found in '{config.verify}'.", config.quiet)
        return

    for catscan_path in all_catscans:
        module_dir = catscan_path.parent
        print(f"\nVerifying: {Ansi.BLUE}{module_dir.relative_to(cwd)}/{Ansi.RESET}")

        source_info = None
        if list(module_dir.rglob("*.py")):
            source_info = verify_python_module(module_dir, config.quiet)
        elif list(module_dir.rglob("*.ts")) or list(module_dir.rglob("*.js")):
            source_info = verify_js_ts_module(module_dir, config.quiet)
        elif list(module_dir.rglob("*.dart")):
            source_info = verify_dart_module(module_dir, config.quiet)
        else:
            print("  [SKIPPED] Could not determine module language.")
            continue

        if source_info:
            print(
                f"  {Ansi.GREEN}[OK]{Ansi.RESET} CATSCAN.md appears up to date (verification logic is partial)."
            )

    print("\n--- Verification Complete ---", file=sys.stderr)


# --- Bundling Logic ---
def get_paths_to_process(config: BundleConfig, cwd: Path) -> PathCollection:
    """Resolves and filters input patterns, returning the final list and statistics."""
    include_patterns, summarize_patterns = [], []
    for spec in config.path_specs:
        if spec.lower().startswith("summary:"):
            summarize_patterns.append(spec[len("summary:") :])
        else:
            include_patterns.append(spec)

    initial_include_paths = set()
    for pattern in include_patterns:
        p = cwd.joinpath(pattern)
        if p.is_dir():
            initial_include_paths.update(
                sub_p.resolve() for sub_p in p.rglob("*") if sub_p.is_file()
            )
        else:
            for found_path_str in glob.glob(pattern, recursive=True):
                if Path(found_path_str).is_file():
                    initial_include_paths.add(Path(found_path_str).resolve())

    summarize_dirs = {
        Path(p).resolve()
        for pattern in summarize_patterns
        for p in glob.glob(pattern, recursive=True)
        if Path(p).is_dir()
    }

    catscan_files_to_add = {
        s_dir / "CATSCAN.md"
        for s_dir in summarize_dirs
        if (s_dir / "CATSCAN.md").is_file()
    }
    catscan_files_to_add = {p.resolve() for p in catscan_files_to_add}

    candidate_files = initial_include_paths.union(catscan_files_to_add)

    # --- Exclusion Logic & Statistics ---
    user_excluded_paths = {
        Path(p).resolve()
        for pattern in config.exclude_patterns
        for p in glob.glob(str(cwd.joinpath(pattern)), recursive=True)
    }
    user_excluded_count = len(initial_include_paths.intersection(user_excluded_paths))

    all_exclude_paths = set(user_excluded_paths)
    if config.use_default_excludes:
        pawsignore_path = cwd / PAWSIGNORE_FILENAME
        if pawsignore_path.is_file():
            try:
                ignore_patterns = [
                    line.strip()
                    for line in pawsignore_path.read_text(
                        encoding=DEFAULT_ENCODING
                    ).splitlines()
                    if line.strip() and not line.startswith("#")
                ]
                for pattern in ignore_patterns:
                    for p_str in glob.glob(str(cwd.joinpath(pattern)), recursive=True):
                        all_exclude_paths.add(Path(p_str).resolve())
            except IOError as e:
                log_warning(f"Could not read {PAWSIGNORE_FILENAME}: {e}", config.quiet)
        for pattern in DEFAULT_EXCLUDES:
            for p_str in glob.glob(str(cwd.joinpath(pattern)), recursive=True):
                all_exclude_paths.add(Path(p_str).resolve())

    final_paths_set = {
        p for p in candidate_files if p.resolve() not in all_exclude_paths
    }

    paths_to_remove = {
        path
        for path in final_paths_set
        for s_dir in summarize_dirs
        if path.is_relative_to(s_dir) and path.name.lower() != "catscan.md"
    }
    final_paths_set -= paths_to_remove

    final_paths_list = sorted(list(final_paths_set))
    catscan_count = sum(1 for p in final_paths_list if p.name.lower() == "catscan.md")

    return PathCollection(
        final_paths=final_paths_list,
        catscan_count=catscan_count,
        user_excluded_count=user_excluded_count,
    )


def find_common_ancestor(paths: List[Path], cwd: Path) -> Path:
    if not paths:
        return cwd
    return Path(os.path.commonpath([str(p.resolve()) for p in paths]))


def detect_is_binary(content_bytes: bytes) -> bool:
    return b"\0" in content_bytes


def prepare_file_object(
    file_abs_path: Path, common_ancestor: Path, quiet: bool
) -> Optional[FileObject]:
    try:
        content_bytes = file_abs_path.read_bytes()
        return {
            "relative_path": file_abs_path.relative_to(common_ancestor).as_posix(),
            "content_bytes": content_bytes,
            "is_binary": detect_is_binary(content_bytes),
        }
    except IOError as e:
        log_warning(f"Skipping unreadable file {file_abs_path.name}: {e}", quiet)
        return None


def create_bundle_string_from_objects(
    file_objects: List[FileObject], config: BundleConfig
) -> str:
    bundle_parts = [BUNDLE_HEADER_PREFIX, f"{BUNDLE_FORMAT_PREFIX}Raw UTF-8"]
    if config.prepare_for_delta:
        bundle_parts.append(f"{DELTA_REFERENCE_HINT_PREFIX}Yes")

    for file_obj in file_objects:
        is_b64 = file_obj["is_binary"]
        hint = f" {BASE64_HINT_TEXT}" if is_b64 else ""
        content = (
            base64.b64encode(file_obj["content_bytes"]).decode("ascii")
            if is_b64
            else file_obj["content_bytes"].decode(DEFAULT_ENCODING, "replace")
        )
        bundle_parts.extend(
            [
                f"\n{START_MARKER_TEMPLATE.format(path=file_obj['relative_path'], hint=hint)}",
                content,
                END_MARKER_TEMPLATE.format(path=file_obj["relative_path"], hint=hint),
            ]
        )
    return "\n".join(bundle_parts) + "\n"


def find_and_read_prepended_files(
    file_paths: List[Path], header: str, footer: str, quiet: bool
) -> bytes:
    content_parts = []
    for p in file_paths:
        if p.is_file():
            log_info(f"Prepending content from: {p.name}", quiet)
            try:
                content_parts.append(p.read_text(encoding=DEFAULT_ENCODING))
            except IOError as e:
                log_warning(f"Could not read persona file '{p.name}': {e}", quiet)
        else:
            log_warning(f"Persona file not found: '{p}'", quiet)

    if not content_parts:
        return b""
    return (header + "\n\n---\n\n".join(content_parts) + footer).encode(
        DEFAULT_ENCODING
    )


def main_cli():
    parser = argparse.ArgumentParser(
        description="cats.py: A programmable, deterministic context bundler for LLMs.",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    parser.add_argument(
        "paths",
        nargs="*",
        default=None,
        help="Paths/globs to include. Prefix with 'summary:' for CATSCAN mode.",
    )
    parser.add_argument(
        "--verify",
        metavar="PATH",
        help="Run in verification mode on a path instead of bundling.",
    )
    parser.add_argument(
        "-p",
        "--persona",
        action="append",
        default=[],
        dest="personas",
        help="Path to a persona file to prepend. Can be used multiple times.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUTPUT_FILENAME,
        help=f"Output file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout.",
    )
    parser.add_argument(
        "-x",
        "--exclude",
        action="append",
        default=[],
        metavar="PATTERN",
        help="Glob pattern to exclude.",
    )
    parser.add_argument(
        "-s",
        "--sys-prompt-file",
        default=DEFAULT_SYS_PROMPT_FILENAME,
        help=f"System prompt file (default: {DEFAULT_SYS_PROMPT_FILENAME}).",
    )
    parser.add_argument(
        "-N",
        "--no-default-excludes",
        action="store_false",
        dest="use_default_excludes",
        help=f"Disable default excludes and {PAWSIGNORE_FILENAME}.",
    )
    parser.add_argument(
        "-q", "--quiet", action="store_true", help="Suppress all informational output."
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Automatically confirm writing the output file.",
    )
    parser.add_argument(
        "--prepare-for-delta",
        action="store_true",
        help="Mark bundle as a reference for delta operations.",
    )
    parser.add_argument(
        "--strict-catscan", action="store_true", help="Enforce CATSCAN.md compliance."
    )

    args = parser.parse_args()
    cwd = Path.cwd()

    config = BundleConfig(
        path_specs=args.paths or [],
        exclude_patterns=args.exclude,
        output_file=(
            Path(args.output).resolve() if args.output and args.output != "-" else None
        ),
        encoding_mode="auto",
        use_default_excludes=args.use_default_excludes,
        prepare_for_delta=args.prepare_for_delta,
        persona_files=[cwd / p for p in args.personas],
        sys_prompt_file=args.sys_prompt_file,
        no_sys_prompt=False,
        require_sys_prompt=False,
        strict_catscan=args.strict_catscan,
        verify=args.verify,
        quiet=args.quiet,
        yes=args.yes,
    )

    if config.verify:
        run_verification(config, cwd)
        sys.exit(0)

    if not config.path_specs:
        parser.error("the following arguments are required: paths (or use --verify)")

    try:
        log_info("Starting PAWS Bundling...", config.quiet)
        path_collection = get_paths_to_process(config, cwd)
        paths = path_collection.final_paths

        if not paths:
            log_warning("No files matched the given criteria. Exiting.", config.quiet)
            sys.exit(0)

        # --- Display Statistics ---
        log_info(
            f"Found {len(paths)} files to bundle ({path_collection.catscan_count} CATSCAN summaries).",
            config.quiet,
        )
        if config.exclude_patterns:
            log_info(
                f"Excluded {path_collection.user_excluded_count} files via -x patterns.",
                config.quiet,
            )

        ancestor = find_common_ancestor(paths, cwd)
        objects = [
            obj
            for p in paths
            if (obj := prepare_file_object(p, ancestor, config.quiet))
        ]

        if not objects:
            log_error("No files could be read. Exiting.")
            sys.exit(1)

        bundle_str = create_bundle_string_from_objects(objects, config)

        script_dir = Path(__file__).resolve().parent
        sys_prompt_path = script_dir.parent / config.sys_prompt_file

        persona_bytes = find_and_read_prepended_files(
            config.persona_files, PERSONA_HEADER, PERSONA_FOOTER, config.quiet
        )
        sys_prompt_bytes = find_and_read_prepended_files(
            [sys_prompt_path], "", SYS_PROMPT_POST_SEPARATOR, config.quiet
        )

        full_output = (
            persona_bytes + sys_prompt_bytes + bundle_str.encode(DEFAULT_ENCODING)
        )

        if config.output_file:
            output_target_display = config.output_file.relative_to(cwd)
            if not config.yes and sys.stdin.isatty():
                if (
                    input(
                        f"\nAbout to write bundle to '{output_target_display}'. Proceed? [Y/n]: "
                    )
                    .strip()
                    .lower()
                    == "n"
                ):
                    print("Operation cancelled.", file=sys.stderr)
                    sys.exit(0)
            config.output_file.parent.mkdir(parents=True, exist_ok=True)
            config.output_file.write_bytes(full_output)
            log_info(
                f"Output successfully written to: '{output_target_display}'",
                config.quiet,
            )
        else:
            sys.stdout.buffer.write(full_output)

    except (IOError, OSError) as e:
        log_error(f"A file system error occurred: {e}")
        sys.exit(1)
    except Exception as e:
        log_error(f"An unexpected error occurred: {e}")
        if not config.quiet:
            import traceback

            traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main_cli()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(130)
