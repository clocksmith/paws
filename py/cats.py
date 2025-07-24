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
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional, Union, Set

# --- Configuration Constants ---
DEFAULT_SYS_PROMPT_FILENAME = "sys/sys_a.md"
DEFAULT_OUTPUT_FILENAME = "cats.md"
DEFAULT_ENCODING = "utf-8"
DEFAULT_EXCLUDES = [
    ".git",
    "node_modules",
    "**/__pycache__",
    "**/*.pyc",
    ".DS_Store",
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


@dataclass
class BundleConfig:
    """Encapsulates all configuration for a bundling operation."""

    include_patterns: List[str]
    exclude_patterns: List[str]
    output_file: Optional[Path]
    encoding_mode: str
    use_default_excludes: bool
    prepare_for_delta: bool
    persona_file: Optional[Path]
    sys_prompt_file: str
    no_sys_prompt: bool
    require_sys_prompt: bool
    strict_catscan: bool
    quiet: bool
    yes: bool


def _resolve_glob_patterns(patterns: List[str], cwd: Path) -> Set[Path]:
    """
    Expands a list of glob patterns into a set of resolved, absolute paths.

    Args:
        patterns: A list of glob pattern strings.
        cwd: The current working directory to resolve patterns against.

    Returns:
        A set of unique, resolved Path objects.
    """
    resolved_paths = set()
    for pattern in patterns:
        for p_str in glob.glob(str(cwd.joinpath(pattern)), recursive=True):
            resolved_paths.add(Path(p_str).resolve(strict=False))
    return resolved_paths


def _verify_catscan_compliance(
    all_files: Set[Path],
) -> Tuple[List[Tuple[Path, Path]], List[Path]]:
    """
    Finds READMEs and strictly checks for corresponding CATSCAN.md files.

    Args:
        all_files: A set of all candidate file paths.

    Returns:
        A tuple containing a list of valid (README, CATSCAN) pairs and a list
        of directories where a CATSCAN.md was missing.
    """
    readmes = {p for p in all_files if p.name.lower() == "readme.md"}
    valid_pairs = []
    missing_dirs = []
    for readme in readmes:
        catscan_path = readme.parent / "CATSCAN.md"
        # Check if the potential CATSCAN file was actually found by the glob
        if catscan_path in all_files:
            valid_pairs.append((readme, catscan_path))
        else:
            missing_dirs.append(readme.parent)
    return valid_pairs, missing_dirs


def _verify_catscan_compliance_soft(
    all_files: Set[Path],
) -> Tuple[List[Tuple[Path, Path]], List[Path], List[Path]]:
    """
    Finds README/CATSCAN pairs and returns non-module files separately.

    This function is for the default, non-strict mode. It identifies valid
    documentation pairs and filters out any other files from those directories,
    returning the remaining non-module files.

    Args:
        all_files: A set of all candidate file paths.

    Returns:
        A tuple containing:
        - A list of valid (README, CATSCAN) pairs.
        - A list of directories where a CATSCAN.md was missing.
        - A list of other files not part of a CATSCAN'd module.
    """
    readmes = {p for p in all_files if p.name.lower() == "readme.md"}
    other_files_set = all_files - readmes
    valid_pairs = []
    missing_dirs = []
    catscan_dirs = set()

    for readme in readmes:
        catscan_path = readme.parent / "CATSCAN.md"
        if catscan_path in other_files_set:
            valid_pairs.append((readme, catscan_path))
            catscan_dirs.add(readme.parent)
            other_files_set.remove(catscan_path)
        else:
            missing_dirs.append(readme.parent)

    # Filter out any other files that were in a directory with a valid CATSCAN pair
    final_other_files = [f for f in other_files_set if f.parent not in catscan_dirs]
    return valid_pairs, missing_dirs, final_other_files


def get_paths_to_process(config: BundleConfig, cwd: Path) -> List[Path]:
    """
    Resolves and filters input glob patterns to a final list of files to bundle,
    applying CATSCAN-aware logic.

    Args:
        config: The BundleConfig object.
        cwd: The current working directory.

    Returns:
        A sorted list of absolute file paths to be included in the bundle.
    """
    exclude_paths = _resolve_glob_patterns(config.exclude_patterns, cwd)
    if config.use_default_excludes:
        exclude_paths.update(_resolve_glob_patterns(DEFAULT_EXCLUDES, cwd))
    if config.output_file:
        exclude_paths.add(config.output_file)
    if config.persona_file:
        exclude_paths.add(config.persona_file)

    initial_include_paths = _resolve_glob_patterns(config.include_patterns, cwd)
    expanded_files: Set[Path] = set()
    for path in initial_include_paths:
        if path.is_dir():
            for child in path.rglob("*"):
                if child.is_file():
                    expanded_files.add(child)
        elif path.is_file():
            expanded_files.add(path)

    filtered_files = {p for p in expanded_files if p not in exclude_paths}

    if config.strict_catscan:
        valid_pairs, missing_dirs = _verify_catscan_compliance(filtered_files)
        if missing_dirs:
            missing_str = "\n - ".join(str(p.relative_to(cwd)) for p in missing_dirs)
            raise ValueError(
                f"Strict CATSCAN mode failed. Missing CATSCAN.md files in:\n - {missing_str}"
            )
        return sorted([pair[1] for pair in valid_pairs])
    else:
        valid_pairs, _, other_files = _verify_catscan_compliance_soft(filtered_files)
        catscan_files = [pair[1] for pair in valid_pairs]
        return sorted(catscan_files + other_files)


def find_common_ancestor(paths: List[Path], cwd: Path) -> Path:
    """
    Finds the common ancestor directory for a list of file paths.

    Args:
        paths: A list of Path objects.
        cwd: The current working directory as a fallback.

    Returns:
        The common ancestor directory as a Path object.
    """
    if not paths:
        return cwd
    return Path(os.path.commonpath([str(p) for p in paths]))


def detect_is_binary(content_bytes: bytes) -> bool:
    """
    Detects if content is likely binary by checking for null bytes.

    Args:
        content_bytes: The byte content of a file.

    Returns:
        True if the content is likely binary, False otherwise.
    """
    return b"\0" in content_bytes


def prepare_file_object(
    file_abs_path: Path, common_ancestor: Path
) -> Optional[FileObject]:
    """
    Reads a file and prepares a FileObject dictionary for bundling.

    Args:
        file_abs_path: The absolute path to the file.
        common_ancestor: The common ancestor directory for calculating relative paths.

    Returns:
        A FileObject dictionary or None if the file cannot be read.
    """
    try:
        content_bytes = file_abs_path.read_bytes()
        relative_path = file_abs_path.relative_to(common_ancestor).as_posix()
        return {
            "relative_path": relative_path,
            "content_bytes": content_bytes,
            "is_binary": detect_is_binary(content_bytes),
        }
    except Exception as e:
        print(
            f"  Warning: Error reading file '{file_abs_path}': {e}. Skipping.",
            file=sys.stderr,
        )
        return None


def create_bundle_string_from_objects(
    file_objects: List[FileObject], config: BundleConfig
) -> str:
    """
    Constructs the final bundle string from a list of FileObject dictionaries.

    Args:
        file_objects: A list of prepared file objects.
        config: The BundleConfig object.

    Returns:
        The formatted bundle string.
    """
    has_binaries = any(f["is_binary"] for f in file_objects)
    format_desc = (
        "Base64"
        if config.encoding_mode == "b64"
        else f"Raw UTF-8{'; binaries as Base64' if has_binaries else ''}"
    )
    bundle_parts = [BUNDLE_HEADER_PREFIX, f"{BUNDLE_FORMAT_PREFIX}{format_desc}"]
    if config.prepare_for_delta:
        bundle_parts.append(f"{DELTA_REFERENCE_HINT_PREFIX}Yes")

    for file_obj in file_objects:
        is_base64 = config.encoding_mode == "b64" or file_obj["is_binary"]
        content_str = (
            base64.b64encode(file_obj["content_bytes"]).decode("ascii")
            if is_base64
            else file_obj["content_bytes"].decode(DEFAULT_ENCODING, "replace")
        )
        hint = (
            f" {BASE64_HINT_TEXT}"
            if is_base64 and config.encoding_mode != "b64"
            else ""
        )
        rel_path = file_obj["relative_path"]

        bundle_parts.append("")
        bundle_parts.append(START_MARKER_TEMPLATE.format(path=rel_path, hint=hint))
        bundle_parts.append(content_str)
        bundle_parts.append(END_MARKER_TEMPLATE.format(path=rel_path, hint=hint))

    return "\n".join(bundle_parts) + "\n"


def find_and_read_prepended_file(
    file_path: Optional[Path], header: str, footer: str, config: BundleConfig
) -> bytes:
    """
    Reads a file for prepending (persona or system prompt).

    Args:
        file_path: The path to the file to read.
        header: The header string to prepend to the content.
        footer: The footer string to append to the content.
        config: The BundleConfig object.

    Returns:
        The file content with header/footer as bytes, or empty bytes if not found.
    """
    if not file_path or not file_path.is_file():
        return b""
    try:
        content = file_path.read_text(encoding=DEFAULT_ENCODING)
        if not config.quiet:
            print(f"  Info: Prepending content from: {file_path}", file=sys.stderr)
        return (header + content + footer).encode(DEFAULT_ENCODING)
    except Exception as e:
        print(
            f"  Warning: Could not read prepended file '{file_path}': {e}",
            file=sys.stderr,
        )
        return b""


def main_cli():
    """Main command-line interface function."""
    parser = argparse.ArgumentParser(
        description="cats.py: Bundles project files into a single text artifact for LLMs.",
        epilog="Examples:\n"
        "  python cats.py 'src/**/*.py' -o my_code.md\n"
        "  python cats.py . -x '*.g.dart' -p personas/test_writer.md",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    parser.add_argument(
        "paths",
        nargs="+",
        metavar="PATH_PATTERN",
        help="One or more files or glob patterns to include.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help=f"Output file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout.",
    )
    parser.add_argument(
        "-x",
        "--exclude",
        action="append",
        default=[],
        metavar="PATTERN",
        help="Glob pattern to exclude. Can be used multiple times.",
    )
    parser.add_argument(
        "-p",
        "--persona",
        default="personas/sys_h5.md",
        help="Path to a persona file to prepend.",
    )
    parser.add_argument(
        "-s",
        "--sys-prompt-file",
        default=DEFAULT_SYS_PROMPT_FILENAME,
        help=f"System prompt filename (default: {DEFAULT_SYS_PROMPT_FILENAME}).",
    )
    parser.add_argument(
        "-t",
        "--prepare-for-delta",
        action="store_true",
        help="Mark bundle as a reference for delta operations.",
    )
    parser.add_argument(
        "-q", "--quiet", action="store_true", help="Suppress informational messages."
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Automatically confirm writing the output file.",
    )
    parser.add_argument(
        "-N",
        "--no-default-excludes",
        action="store_false",
        dest="use_default_excludes",
        help=f"Disable default excludes.",
    )
    parser.add_argument(
        "-E",
        "--force-encoding",
        choices=["auto", "b64"],
        default="auto",
        help="Force encoding: 'auto' or 'b64'.",
    )
    parser.add_argument(
        "--no-sys-prompt", action="store_true", help="Do not prepend any system prompt."
    )
    parser.add_argument(
        "--require-sys-prompt",
        action="store_true",
        help="Exit if the system prompt is not found.",
    )
    parser.add_argument(
        "--strict-catscan",
        action="store_true",
        help="Enforce CATSCAN.md compliance, aborting if not met.",
    )
    args = parser.parse_args()

    cwd = Path.cwd()
    config = BundleConfig(
        include_patterns=args.paths,
        exclude_patterns=args.exclude,
        output_file=(
            Path(args.output).resolve() if args.output and args.output != "-" else None
        ),
        encoding_mode=args.force_encoding,
        use_default_excludes=args.use_default_excludes,
        prepare_for_delta=args.prepare_for_delta,
        persona_file=Path(args.persona).resolve() if args.persona else None,
        sys_prompt_file=args.sys_prompt_file,
        no_sys_prompt=args.no_sys_prompt,
        require_sys_prompt=args.require_sys_prompt,
        strict_catscan=args.strict_catscan,
        quiet=args.quiet,
        yes=args.yes,
    )

    if not config.quiet:
        print("--- Starting PAWS Bundling ---", file=sys.stderr)

    try:
        script_dir = Path(__file__).resolve().parent
    except NameError:
        script_dir = cwd

    sys_prompt_path = None
    if not config.no_sys_prompt:
        for loc in [script_dir, script_dir.parent]:
            if (loc / config.sys_prompt_file).is_file():
                sys_prompt_path = (loc / config.sys_prompt_file).resolve()
                break

    if config.require_sys_prompt and not sys_prompt_path:
        print(
            f"Error: System prompt '{config.sys_prompt_file}' not found.",
            file=sys.stderr,
        )
        sys.exit(1)

    persona_bytes = find_and_read_prepended_file(
        config.persona_file, PERSONA_HEADER, PERSONA_FOOTER, config
    )
    sys_prompt_bytes = find_and_read_prepended_file(
        sys_prompt_path, "", SYS_PROMPT_POST_SEPARATOR, config
    )

    try:
        all_paths_to_process = get_paths_to_process(config, cwd)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not all_paths_to_process:
        print("No files matched the given criteria. Exiting.", file=sys.stderr)
        sys.exit(0)

    common_ancestor = find_common_ancestor(all_paths_to_process, cwd)
    file_objects = [
        obj
        for p in all_paths_to_process
        if (obj := prepare_file_object(p, common_ancestor))
    ]

    if not file_objects:
        print("No files could be read. Exiting.", file=sys.stderr)
        sys.exit(1)

    if not config.quiet:
        ancestor_display = (
            common_ancestor.relative_to(cwd)
            if common_ancestor.is_relative_to(cwd)
            else common_ancestor
        )
        print(
            f"  Found {len(file_objects)} files. Common ancestor: '{ancestor_display}'",
            file=sys.stderr,
        )

    bundle_content_string = create_bundle_string_from_objects(file_objects, config)
    full_output_bytes = (
        persona_bytes
        + sys_prompt_bytes
        + bundle_content_string.encode(DEFAULT_ENCODING)
    )

    output_to_stdout = config.output_file is None
    output_target_display = "stdout" if output_to_stdout else str(config.output_file)

    if not config.yes and not output_to_stdout and sys.stdin.isatty():
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

    try:
        if output_to_stdout:
            sys.stdout.buffer.write(full_output_bytes)
        else:
            config.output_file.parent.mkdir(parents=True, exist_ok=True)
            config.output_file.write_bytes(full_output_bytes)
            if not config.quiet:
                print(
                    f"\nOutput successfully written to: '{output_target_display}'",
                    file=sys.stderr,
                )
    except Exception as e:
        print(
            f"\nFatal: Could not write to output '{output_target_display}': {e}",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    try:
        main_cli()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(130)
