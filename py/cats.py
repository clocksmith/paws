#!/usr/bin/env python3
# -*- coding: utf-8 -*-

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
DEFAULT_EXCLUDES = [".git", "node_modules", "gem", "__pycache__", "*.pyc", ".DS_Store"]

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


# --- Dataclass for Configuration ---
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
    quiet: bool
    yes: bool


# --- Core Logic Functions ---


def _resolve_glob_patterns(patterns: List[str], cwd: Path) -> Set[Path]:
    """Expands a list of glob patterns into a set of resolved, absolute paths."""
    resolved_paths = set()
    for pattern in patterns:
        # Use glob to expand patterns relative to the current working directory
        for p_str in glob.glob(str(cwd.joinpath(pattern)), recursive=True):
            resolved_paths.add(Path(p_str).resolve(strict=False))
    return resolved_paths


def get_paths_to_process(
    config: BundleConfig, cwd: Path
) -> Tuple[List[Path], Optional[Path]]:
    """Resolves and filters input glob patterns to a list of absolute file paths."""
    # 1. Resolve all exclude patterns first
    exclude_paths = _resolve_glob_patterns(config.exclude_patterns, cwd)
    if config.use_default_excludes:
        exclude_paths.update(_resolve_glob_patterns(DEFAULT_EXCLUDES, cwd))
    if config.output_file:
        exclude_paths.add(config.output_file)
    if config.persona_file:
        exclude_paths.add(config.persona_file)

    # 2. Identify and handle the CWD context file
    cwd_context_file_path = (cwd / config.sys_prompt_file).resolve()
    cwd_context_file_to_bundle: Optional[Path] = None
    if cwd_context_file_path.is_file() and cwd_context_file_path not in exclude_paths:
        cwd_context_file_to_bundle = cwd_context_file_path
        exclude_paths.add(cwd_context_file_path)  # Exclude from main processing
        if not config.quiet:
            print(
                f"  Info: Found '{config.sys_prompt_file}' in CWD to be bundled first.",
                file=sys.stderr,
            )

    # 3. Resolve all include patterns and expand directories
    initial_include_paths = _resolve_glob_patterns(config.include_patterns, cwd)

    expanded_files: Set[Path] = set()
    for path in initial_include_paths:
        if path.is_dir():
            if not config.quiet:
                try:
                    display_path = path.relative_to(cwd)
                except ValueError:
                    display_path = path
                print(f"  Info: Expanding directory '{display_path}'", file=sys.stderr)
            for child in path.rglob("*"):
                if child.is_file():
                    expanded_files.add(child)
        elif path.is_file():
            expanded_files.add(path)

    # 4. Filter the final list of files against exclusions
    candidate_files: Set[Path] = set()
    for path in expanded_files:
        is_excluded = False
        for ex_path in exclude_paths:
            if path == ex_path or (ex_path.is_dir() and ex_path in path.parents):
                is_excluded = True
                break
        if not is_excluded:
            candidate_files.add(path)

    return sorted(list(candidate_files)), cwd_context_file_to_bundle


def find_common_ancestor(paths: List[Path], cwd: Path) -> Path:
    """Finds the common ancestor directory for a list of file paths."""
    if not paths:
        return cwd
    try:
        # os.path.commonpath handles cases with mixed absolute/relative paths more gracefully
        # by working on string representations.
        common_path_str = os.path.commonpath([str(p) for p in paths])
        return Path(common_path_str)
    except (ValueError, TypeError):
        # Fallback for edge cases like mixed drive letters on Windows
        return cwd


def detect_is_binary(content_bytes: bytes) -> bool:
    """Detects if content is likely binary by trying to decode it."""
    try:
        content_bytes.decode(DEFAULT_ENCODING)
        return False
    except UnicodeDecodeError:
        return True


def prepare_file_object(
    file_abs_path: Path, common_ancestor: Path
) -> Optional[FileObject]:
    """Reads a file and prepares a FileObject dictionary."""
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
    """Constructs the final bundle string from a list of FileObject dictionaries."""
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
    file_path: Path, header: str, footer: str, config: BundleConfig
) -> Optional[bytes]:
    """Reads a file for prepending (persona or system prompt)."""
    if not file_path or not file_path.is_file():
        return None
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
        return None


def main_cli():
    """Main command-line interface function."""
    parser = argparse.ArgumentParser(
        description="cats.py: Bundles project files into a single text artifact for LLMs.",
        epilog="Examples:\n"
        "  python cats.py 'src/**/*.py' -o my_code.md\n"
        "  python cats.py . -x '*.g.dart' -x 'build/**' -o project.md\n"
        "  python cats.py ../other-project -p personas/test_writer.md -o for_testing.md",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    parser.add_argument(
        "paths",
        nargs="+",
        metavar="PATH_PATTERN",
        help="One or more files or glob patterns to include (e.g., 'src/**/*.py', '.').",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help=f"Output bundle file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout.",
    )
    parser.add_argument(
        "-x",
        "--exclude",
        action="append",
        default=[],
        metavar="EXCLUDE_PATTERN",
        help="Glob pattern to exclude. Can be used multiple times.",
    )
    parser.add_argument(
        "-p",
        "--persona",
        default=None,
        help="Path to a persona file to prepend to the entire output.",
    )
    parser.add_argument(
        "-s",
        "--sys-prompt-file",
        default=DEFAULT_SYS_PROMPT_FILENAME,
        help=f"System prompt filename for prepending (default: {DEFAULT_SYS_PROMPT_FILENAME}).",
    )
    parser.add_argument(
        "-t",
        "--prepare-for-delta",
        action="store_true",
        help="Mark the bundle as a clean reference for delta operations.",
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
        help=f"Disable default excludes: {', '.join(DEFAULT_EXCLUDES)}.",
    )
    parser.add_argument(
        "-E",
        "--force-encoding",
        choices=["auto", "b64"],
        default="auto",
        help="Encoding: 'auto' (default) or 'b64' (force all as Base64).",
    )
    parser.add_argument(
        "--no-sys-prompt", action="store_true", help="Do not prepend any system prompt."
    )
    parser.add_argument(
        "--require-sys-prompt",
        action="store_true",
        help="Exit if the system prompt for prepending is not found.",
    )

    args = parser.parse_args()

    # --- Configuration Setup ---
    cwd = Path.cwd()
    output_to_stdout = args.output == "-"
    output_filename = (
        args.output if args.output and not output_to_stdout else DEFAULT_OUTPUT_FILENAME
    )

    config = BundleConfig(
        include_patterns=args.paths,
        exclude_patterns=args.exclude,
        output_file=(
            None if output_to_stdout else cwd.joinpath(output_filename).resolve()
        ),
        encoding_mode=args.force_encoding,
        use_default_excludes=args.use_default_excludes,
        prepare_for_delta=args.prepare_for_delta,
        persona_file=Path(args.persona).resolve() if args.persona else None,
        sys_prompt_file=args.sys_prompt_file,
        no_sys_prompt=args.no_sys_prompt,
        require_sys_prompt=args.require_sys_prompt,
        quiet=args.quiet,
        yes=args.yes,
    )

    # --- Main Logic ---
    if not config.quiet:
        print("--- Starting PAWS Bundling ---", file=sys.stderr)

    # 1. Prepare prepended content
    persona_bytes = (
        find_and_read_prepended_file(
            config.persona_file, PERSONA_HEADER, PERSONA_FOOTER, config
        )
        or b""
    )
    sys_prompt_path = None
    if not config.no_sys_prompt:
        try:
            script_dir = Path(__file__).resolve().parent
        except NameError:
            script_dir = cwd
        for loc in [script_dir, script_dir.parent]:
            if (loc / config.sys_prompt_file).is_file():
                sys_prompt_path = (loc / config.sys_prompt_file).resolve()
                break

    sys_prompt_bytes = (
        find_and_read_prepended_file(
            sys_prompt_path, "", SYS_PROMPT_POST_SEPARATOR, config
        )
        or b""
    )
    if config.require_sys_prompt and not sys_prompt_bytes:
        print(
            f"Error: System prompt '{config.sys_prompt_file}' not found and --require-sys-prompt was used.",
            file=sys.stderr,
        )
        sys.exit(1)

    # 2. Collect and process files
    other_files, cwd_context_file = get_paths_to_process(config, cwd)
    all_paths_to_process = (
        [cwd_context_file] if cwd_context_file else []
    ) + other_files

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
        try:
            # Try to display a user-friendly relative path for the common ancestor
            ancestor_display = common_ancestor.relative_to(cwd)
        except ValueError:
            # Fallback to the absolute path if it's not a subpath of CWD
            ancestor_display = common_ancestor

        print(
            f"  Found {len(file_objects)} files to bundle. Common ancestor: '{ancestor_display}'",
            file=sys.stderr,
        )

    # 3. Create bundle and write output
    bundle_content_string = create_bundle_string_from_objects(file_objects, config)
    full_output_bytes = (
        persona_bytes
        + sys_prompt_bytes
        + bundle_content_string.encode(DEFAULT_ENCODING)
    )

    output_target_display = "stdout" if output_to_stdout else str(config.output_file)

    if not config.yes and not output_to_stdout and sys.stdin.isatty():
        print(
            f"\nAbout to write {len(file_objects)} files to '{output_target_display}'."
        )
        if input("Proceed? [Y/n]: ").strip().lower() == "n":
            print("Operation cancelled.", file=sys.stderr)
            sys.exit(0)

    try:
        if output_to_stdout:
            sys.stdout.buffer.write(full_output_bytes)
            sys.stdout.flush()
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
    except SystemExit as e:
        sys.exit(e.code)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(130)
