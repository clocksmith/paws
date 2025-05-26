#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import argparse
import base64
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Union

# Filename for the system prompt that can be prepended.
SYS_PROMPT_FILENAME = "sys_ant.txt"

# Separator appended after the prepended system prompt.
SYS_PROMPT_POST_SEPARATOR = """
--- END OF SYSTEM PROMPT ---
The following content is the Cats Bundle.
"""

# Marker indicating the end of a file block within the bundle.
FILE_END_MARKER = "🐈 --- CATS_END_FILE ---"

# Default character encoding for text files.
DEFAULT_ENCODING = "utf-8"

# Default name for the output bundle file.
DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"

# Prefix for the main bundle header.
BUNDLE_HEADER_PREFIX = "# Cats Bundle"

# Prefix for the bundle format description within the header.
BUNDLE_FORMAT_PREFIX = "# Format: "

# Prefix for the delta reference hint within the header.
DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: "

# Text to indicate Base64 encoded content in file markers.
BASE64_HINT_TEXT = "(Content:Base64)"

# Default directories/files to exclude from bundling.
# These are commonly version control, package managers, or cache directories.
DEFAULT_EXCLUDES = [".git", "node_modules", "gem", "__pycache__"]

# Type alias for a dictionary representing a file's properties.
FileObject = Dict[str, Union[str, bytes, bool, Optional[str], Path]]


def find_sys_prompt_path_for_prepending() -> Optional[Path]:
    """
    Attempts to find the system prompt file (sys_ant.txt) in the script's
    directory or its parent directory.

    Returns:
        Path: The resolved path to the system prompt file if found, None otherwise.
    """
    try:
        # Get the directory where the script itself is located.
        script_dir = Path(__file__).resolve().parent
    except NameError:
        # Fallback if __file__ is not defined (e.g., in an interactive session).
        script_dir = Path.cwd()

    # Locations to check for the system prompt file.
    locations_to_check = [script_dir, script_dir.parent]

    for loc in locations_to_check:
        path_to_check = loc / SYS_PROMPT_FILENAME
        # Check if the file exists.
        if path_to_check.is_file():
            return path_to_check.resolve()

    return None


def detect_text_encoding(file_content_bytes: bytes) -> Optional[str]:
    """
    Detects the text encoding of a given byte string.
    Prioritizes UTF-8, then UTF-16LE, then UTF-16BE.

    Args:
        file_content_bytes (bytes): The content of the file as bytes.

    Returns:
        Optional[str]: The detected encoding ("utf-8", "utf-16le", "utf-16be")
                       or None if it's likely a binary file or encoding cannot be determined.
    """
    # If content is empty, default to UTF-8 as a safe assumption for text.
    if not file_content_bytes:
        return DEFAULT_ENCODING

    try:
        # Check for common BOMs first.
        if file_content_bytes.startswith(b"\xff\xfe"):
            # Attempt to decode as UTF-16LE (Little Endian).
            file_content_bytes.decode("utf-16le")
            return "utf-16le"

        if file_content_bytes.startswith(b"\xfe\xff"):
            # Attempt to decode as UTF-16BE (Big Endian).
            file_content_bytes.decode("utf-16be")
            return "utf-16be"

        # Try decoding as default UTF-8.
        file_content_bytes.decode(DEFAULT_ENCODING)
        return DEFAULT_ENCODING

    except UnicodeDecodeError:
        try:
            # If UTF-8 fails, try UTF-16LE as a fallback.
            file_content_bytes.decode("utf-16le")
            return "utf-16le"
        except UnicodeDecodeError:
            # If all common text encodings fail, it's likely binary.
            return None


def get_paths_to_process(
    input_paths_raw: List[str],
    exclude_paths_raw: List[str],
    use_default_excludes: bool,
    output_file_abs_path: Optional[Path] = None,
    sys_ant_in_cwd_abs_path_to_ignore: Optional[Path] = None,
) -> List[Path]:
    """
    Resolves and filters input paths (files and directories) to a list of
    absolute file paths to be included in the bundle.

    Args:
        input_paths_raw (List[str]): List of raw input paths provided by the user.
        exclude_paths_raw (List[str]): List of raw paths to explicitly exclude.
        use_default_excludes (bool): Whether to apply default exclusion rules.
        output_file_abs_path (Optional[Path]): Absolute path of the output bundle file,
                                                 to ensure it's not bundled.
        sys_ant_in_cwd_abs_path_to_ignore (Optional[Path]): Absolute path of sys_ant.txt
                                                             in CWD if it's being bundled
                                                             as the first file, to prevent
                                                             duplicate processing.

    Returns:
        List[Path]: Sorted list of unique, absolute file paths to include.
    """

    candidate_files = set()
    # Get the current working directory.
    cwd = Path.cwd()

    abs_excludes_resolved = set()
    # Resolve user-specified exclude paths.
    for p_str in exclude_paths_raw:
        try:
            abs_excludes_resolved.add(cwd.joinpath(p_str).resolve())
        except FileNotFoundError:
            # Ignore excludes that don't exist, as they can't be excluded.
            pass

    # Add default excludes if enabled.
    if use_default_excludes:
        for def_excl in DEFAULT_EXCLUDES:
            # Use strict=False as default excludes might refer to directories
            # that don't exist in the current project, which is fine.
            abs_excludes_resolved.add(cwd.joinpath(def_excl).resolve(strict=False))

    # Ensure the output bundle file itself is excluded.
    if output_file_abs_path:
        abs_excludes_resolved.add(output_file_abs_path.resolve(strict=False))

    # Ensure the sys_ant.txt from CWD is excluded if already handled as a special case.
    if sys_ant_in_cwd_abs_path_to_ignore:
        abs_excludes_resolved.add(
            sys_ant_in_cwd_abs_path_to_ignore.resolve(strict=False)
        )

    # Keep track of top-level inputs already processed to avoid redundant work.
    processed_top_level_inputs = set()

    for p_str_raw in input_paths_raw:
        try:
            # Construct the absolute path for the input item.
            p_item_abs = cwd.joinpath(p_str_raw)
            if not p_item_abs.exists():
                print(
                    f"  Warning: Input path '{p_str_raw}' not found. Skipping.",
                    file=sys.stderr,
                )
                continue

            # Resolve the path to its canonical form.
            p_item = p_item_abs.resolve()
            if p_item in processed_top_level_inputs:
                continue
            processed_top_level_inputs.add(p_item)

            is_excluded = False
            # Check if the current item (file or directory) is directly excluded
            # or is a child of an excluded directory.
            for ex_p in abs_excludes_resolved:
                try:
                    if p_item == ex_p or (ex_p.is_dir() and ex_p in p_item.parents):
                        is_excluded = True
                        break
                except FileNotFoundError:
                    # Excluded path might not exist, but no issue for current item.
                    pass
            if is_excluded:
                continue

            # If it's a file, add it directly.
            if p_item.is_file():
                candidate_files.add(p_item)
            # If it's a directory, recursively find all files within it.
            elif p_item.is_dir():
                for sub_path_abs in p_item.rglob("*"):
                    if sub_path_abs.is_file():
                        try:
                            # Resolve sub-path and check for exclusions.
                            sub_path = sub_path_abs.resolve()
                            sub_is_excluded = False
                            for ex_p in abs_excludes_resolved:
                                if sub_path == ex_p or (
                                    ex_p.is_dir() and ex_p in sub_path.parents
                                ):
                                    sub_is_excluded = True
                                    break
                            if not sub_is_excluded:
                                candidate_files.add(sub_path)
                        except FileNotFoundError:
                            # If a sub-path cannot be resolved (e.g., broken symlink), skip it.
                            pass
                        except Exception as e_resolve:
                            print(
                                f"  Warning: Could not fully resolve sub-path '{sub_path_abs}' in '{p_item}': {e_resolve}. Skipping.",
                                file=sys.stderr,
                            )
        except Exception as e:
            print(
                f"  Warning: Could not process input path '{p_str_raw}': {e}. Skipping.",
                file=sys.stderr,
            )

    # Return a sorted list for consistent bundle order.
    return sorted(list(candidate_files))


def find_common_ancestor_for_paths(paths: List[Path]) -> Path:
    """
    Finds the common ancestor directory for a list of file paths.
    Used to calculate relative paths within the bundle.

    Args:
        paths (List[Path]): A list of absolute file paths.

    Returns:
        Path: The common ancestor directory. Defaults to CWD if no paths or errors.
    """
    if not paths:
        return Path.cwd()

    if len(paths) == 1:
        p = paths[0]
        # If it's a file, its parent is the ancestor. If a directory, it's the ancestor.
        return p.parent if p.is_file() else p

    str_paths = []
    for p in paths:
        try:
            # For commonpath, convert to string and ensure it's a directory path.
            if p.exists():
                str_paths.append(str(p.parent if p.is_file() else p))
            else:
                # If path doesn't exist, fall back to CWD for its part in common path calculation.
                str_paths.append(str(Path.cwd()))
        except Exception:
            # Catch other potential path issues, fall back to CWD.
            str_paths.append(str(Path.cwd()))

    if not str_paths:
        return Path.cwd()

    # Use os.path.commonpath for efficient common ancestor finding.
    common_path_str = os.path.commonpath(str_paths)
    common_ancestor = Path(common_path_str)

    # Ensure the common ancestor is a directory (or its parent if it's a file path itself).
    if not common_ancestor.is_dir():
        common_ancestor = common_ancestor.parent

    return common_ancestor if common_ancestor.is_dir() else Path.cwd()


def prepare_file_object(
    file_abs_path: Path, common_ancestor: Path
) -> Optional[FileObject]:
    """
    Reads a file's content and prepares a FileObject dictionary.
    Includes relative path, raw bytes, encoding, and binary status.

    Args:
        file_abs_path (Path): The absolute path to the file.
        common_ancestor (Path): The common base directory for calculating relative paths.

    Returns:
        Optional[FileObject]: A dictionary containing file info, or None if error.
    """
    try:
        # Read the file content as bytes.
        content_bytes = file_abs_path.read_bytes()
        # Detect its text encoding.
        detected_encoding = detect_text_encoding(content_bytes)

        # Calculate the relative path from the common ancestor.
        try:
            abs_common_ancestor = common_ancestor.resolve()
            abs_file_path = file_abs_path.resolve()

            if abs_file_path.is_relative_to(abs_common_ancestor):
                # Use as_posix() for consistent forward slashes in bundle.
                relative_path = abs_file_path.relative_to(
                    abs_common_ancestor
                ).as_posix()
            else:
                # Fallback to just the filename if not relative to common ancestor (should be rare).
                relative_path = file_abs_path.name
        except (ValueError, TypeError):
            # Handle cases where relative_to might fail (e.g., on different drives).
            relative_path = file_abs_path.name
        except Exception:
            # Catch any other unexpected issues during path calculation.
            relative_path = file_abs_path.name

        # Ensure relative path is not empty.
        if not relative_path:
            relative_path = file_abs_path.name

        return {
            "path_obj": file_abs_path,
            "relative_path": relative_path,
            "content_bytes": content_bytes,
            "encoding": detected_encoding,
            "is_binary": detected_encoding
            is None,  # If no text encoding detected, consider it binary.
        }
    except Exception as e:
        print(
            f"  Warning: Error reading file '{file_abs_path}': {e}. Skipping.",
            file=sys.stderr,
        )
        return None


def create_bundle_string_from_objects(
    file_objects: List[FileObject],
    encoding_mode: str,
    prepare_for_delta_reference: bool,
) -> Tuple[str, str, str]:
    """
    Constructs the final bundle string from a list of FileObject dictionaries.

    Args:
        file_objects (List[FileObject]): List of prepared file objects.
        encoding_mode (str): User-specified encoding strategy ("auto", "utf8", "utf16le", "b64").
        prepare_for_delta_reference (bool): Whether to add a hint that this bundle
                                           is a good reference for delta operations.

    Returns:
        Tuple[str, str, str]: The full bundle string, its format description,
                              and the determined output file encoding name.
    """
    bundle_parts = []
    final_bundle_text_encoding = DEFAULT_ENCODING
    format_desc_core = ""

    # Determine the core format description based on encoding mode and file types.
    if encoding_mode == "b64":
        format_desc_core = "Base64"
        bundle_description_suffix = " (All files forced to Base64 by user)"
    elif encoding_mode == "utf16le":
        format_desc_core = "Raw UTF-16LE"
        bundle_description_suffix = (
            f" (Text files as UTF-16LE; binaries as Base64; forced by user)"
        )
    elif encoding_mode == "utf8":
        format_desc_core = "Raw UTF-8"
        bundle_description_suffix = (
            f" (Text files as UTF-8; binaries as Base64; forced by user)"
        )
    else:  # encoding_mode == "auto"
        text_files = [f for f in file_objects if not f.get("is_binary")]

        # Auto-detect if all text files are consistently UTF-16LE.
        if text_files and all(f["encoding"] == "utf-16le" for f in text_files):
            format_desc_core = "Raw UTF-16LE"
            bundle_description_suffix = (
                " (Auto-Detected UTF-16LE for text; binaries as Base64)"
            )
        else:
            format_desc_core = "Raw UTF-8"
            bundle_description_suffix = (
                " (Auto-Detected UTF-8 for text; binaries as Base64)"
            )

        # Add suffixes for mixed content or binary-only bundles.
        has_binaries = any(f.get("is_binary") for f in file_objects)
        if has_binaries and text_files:
            bundle_description_suffix += " - Mixed content found"
        elif has_binaries and not text_files:
            format_desc_core = "Base64"
            bundle_description_suffix = " (Only binary files found, bundled as Base64)"
        elif not text_files and not has_binaries:
            bundle_description_suffix = " (No files)"

    # Assemble the full format description for the bundle header.
    format_description = f"{format_desc_core}{bundle_description_suffix}"

    # Start building bundle parts.
    bundle_parts.append(BUNDLE_HEADER_PREFIX)
    bundle_parts.append(f"{BUNDLE_FORMAT_PREFIX}{format_description}")

    # Add the delta reference hint if requested.
    if prepare_for_delta_reference:
        bundle_parts.append(
            f"{DELTA_REFERENCE_HINT_PREFIX}Yes (This bundle is suitable as an original for delta operations)"
        )

    for file_obj in file_objects:
        content_bytes = file_obj["content_bytes"]
        # Ensure content_bytes is actually bytes, though type hinting covers this.
        assert isinstance(content_bytes, bytes)

        file_is_binary = file_obj.get("is_binary", False)
        content_to_write_str = ""
        is_this_file_output_as_base64 = False

        try:
            # If force-encoding is b64 or it's a binary file, Base64 encode it.
            if encoding_mode == "b64" or file_is_binary:
                content_to_write_str = base64.b64encode(content_bytes).decode("ascii")
                is_this_file_output_as_base64 = True
            else:
                # Otherwise, decode as text using detected/forced encoding.
                source_encoding = file_obj["encoding"] or DEFAULT_ENCODING
                content_to_write_str = content_bytes.decode(source_encoding, "replace")
        except Exception as e:
            # Fallback to Base64 if text decoding fails.
            print(
                f"  Warning: Error processing '{file_obj['relative_path']}'. Fallback to Base64. Error: {e}",
                file=sys.stderr,
            )
            content_to_write_str = base64.b64encode(content_bytes).decode("ascii")
            is_this_file_output_as_base64 = True

        # Add empty line for readability before file marker.
        bundle_parts.append("")

        # Add hint to marker if Base64 and not forced globally.
        hint = (
            f" {BASE64_HINT_TEXT}"
            if is_this_file_output_as_base64 and encoding_mode != "b64"
            else ""
        )
        bundle_parts.append(
            f"🐈 --- CATS_START_FILE: {file_obj['relative_path']}{hint} ---"
        )
        bundle_parts.append(content_to_write_str)

        # Ensure a newline for text files not ending in one, for cleaner parsing.
        if (
            not content_to_write_str.endswith("\n")
            and not is_this_file_output_as_base64
        ):
            bundle_parts.append("")

        bundle_parts.append(FILE_END_MARKER)

    # Join all parts to form the full bundle string.
    full_bundle_str = "\n".join(bundle_parts) + "\n"

    # Determine the actual encoding to use when writing the bundle file.
    if format_desc_core == "Raw UTF-16LE" and encoding_mode != "b64":
        final_bundle_text_encoding = "utf-16le"

    return full_bundle_str, format_description, final_bundle_text_encoding


def create_bundle_from_paths_api(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    encoding_mode: str = "auto",
    use_default_excludes: bool = True,
    output_file_abs_path: Optional[Path] = None,
    sys_ant_in_cwd_abs_path_to_bundle_first: Optional[Path] = None,
    prepare_for_delta_reference: bool = False,
) -> Tuple[str, str, int, str]:
    """
    API function to create a bundle string from specified paths.

    Args:
        include_paths_raw (List[str]): List of raw paths to include.
        exclude_paths_raw (List[str]): List of raw paths to exclude.
        encoding_mode (str): Encoding strategy ("auto", "utf8", "utf16le", "b64").
        use_default_excludes (bool): Whether to use default exclusions.
        output_file_abs_path (Optional[Path]): Absolute path of the output bundle file.
        sys_ant_in_cwd_abs_path_to_bundle_first (Optional[Path]): Path to sys_ant.txt in CWD,
                                                                   to be bundled first.
        prepare_for_delta_reference (bool): Whether to add a hint about delta reference.

    Returns:
        Tuple[str, str, int, str]: Bundle content string, format description,
                                   count of files added, and bundle file encoding.
    """

    sys_ant_file_obj_for_bundling: Optional[FileObject] = None
    # Handle sys_ant.txt in CWD to be bundled as the first file.
    if (
        sys_ant_in_cwd_abs_path_to_bundle_first
        and sys_ant_in_cwd_abs_path_to_bundle_first.is_file()
    ):
        sys_ant_ancestor = sys_ant_in_cwd_abs_path_to_bundle_first.parent
        sys_ant_file_obj_for_bundling = prepare_file_object(
            sys_ant_in_cwd_abs_path_to_bundle_first, sys_ant_ancestor
        )
        if sys_ant_file_obj_for_bundling:
            # Force its relative path to just its filename for clear identification.
            sys_ant_file_obj_for_bundling["relative_path"] = (
                sys_ant_in_cwd_abs_path_to_bundle_first.name
            )

    # Get the list of other files to process.
    other_abs_file_paths = get_paths_to_process(
        include_paths_raw,
        exclude_paths_raw,
        use_default_excludes,
        output_file_abs_path,
        sys_ant_in_cwd_abs_path_to_bundle_first,
    )

    # Find common ancestor for calculating relative paths for other files.
    common_ancestor_for_others = (
        find_common_ancestor_for_paths(other_abs_file_paths)
        if other_abs_file_paths
        else Path.cwd()
    )

    # Prepare FileObject dictionaries for all other files.
    other_file_objects = [
        obj
        for p in other_abs_file_paths
        if (obj := prepare_file_object(p, common_ancestor_for_others))
    ]

    final_file_objects: List[FileObject] = []
    # Add sys_ant.txt from CWD first if it's being bundled.
    if sys_ant_file_obj_for_bundling:
        final_file_objects.append(sys_ant_file_obj_for_bundling)
    # Add all other prepared file objects.
    final_file_objects.extend(other_file_objects)

    # If no files are selected, return empty bundle.
    if not final_file_objects:
        return "", "No files selected for bundle", 0, DEFAULT_ENCODING

    # Create the bundle string.
    bundle_content, format_desc, bundle_file_enc = create_bundle_string_from_objects(
        final_file_objects, encoding_mode, prepare_for_delta_reference
    )
    return bundle_content, format_desc, len(final_file_objects), bundle_file_enc


def confirm_action_prompt(prompt_message: str) -> bool:
    """
    Asks the user for confirmation via a Y/n prompt.

    Args:
        prompt_message (str): The message to display to the user.

    Returns:
        bool: True if the user confirms (Y/y/Enter), False otherwise (N/n/Ctrl+C).
    """
    # If not running in an interactive terminal, assume 'yes'.
    if not sys.stdin.isatty():
        print("  Non-interactive mode. Proceeding automatically.", file=sys.stderr)
        return True

    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "":
                return True
            if choice == "n":
                return False
            print("Invalid input. Please enter 'y' or 'n'.", file=sys.stderr)
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.", file=sys.stderr)
            return False


def main_cli():
    """
    Main command-line interface function for cats.py.
    Handles argument parsing, file collection, bundling, and output.
    """
    parser = argparse.ArgumentParser(
        description="""
cats.py : Bundles project files into a single text artifact for LLMs.

Supports bundling multiple input files and directories, with options for
inclusive and exclusive filtering. Files are placed into the bundle
with paths relative to their common ancestor or the current working directory.
""",
        epilog="""
Examples:
  # Bundle 'src' directory, the sibling 'main.py' file, and a subset of 'docs'
  python cats.py src main.py docs/api -o project_bundle.bundle

  # Bundle current directory, excluding 'dist' and default excludes
  python cats.py . -x dist -o my_project_context.bundle

  # Bundle current directory, disabling default excludes, force all content to Base64
  python cats.py . -N -E b64 -o binary_assets.bundle

  # Bundle current directory, prepare this bundle to be an original for future delta operations
  python cats.py . -t -o delta_base.bundle
""",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    # Positional argument for paths to include.
    parser.add_argument(
        "paths",
        nargs="+",
        metavar="PATH",
        help="One or more files or directories to include. "
        "Directories will be scanned recursively.",
    )

    # Optional output file argument.
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        metavar="BUNDLE_FILE",
        help=f"Output bundle file (default: '{DEFAULT_OUTPUT_FILENAME}'). Use '-' for stdout.",
    )

    # Optional argument for excluding paths. Can be specified multiple times.
    parser.add_argument(
        "-x",
        "--exclude",
        action="append",
        default=[],
        metavar="EXCLUDE_PATH",
        help="Path (file or directory) to exclude from bundling. Can be used multiple times.",
    )

    # Flag to disable default exclusions.
    parser.add_argument(
        "-N",
        "--no-default-excludes",
        action="store_false",
        dest="use_default_excludes",
        help=f"Disable default excludes: {', '.join(DEFAULT_EXCLUDES)}. All files will be included unless explicitly excluded by -x.",
    )

    # Argument for forcing encoding strategy.
    parser.add_argument(
        "-E",
        "--force-encoding",
        choices=["auto", "utf8", "utf16le", "b64"],
        default="auto",
        metavar="MODE",
        help=(
            "Bundle encoding strategy:\n"
            "  auto (default): Text as UTF-8 (or UTF-16LE if all text is such), binaries as Base64 marked blocks.\n"
            "  utf8/utf16le: Text conforms to this; binaries as Base64 marked blocks.\n"
            "  b64: All files (text and binary) are Base64 encoded."
        ),
    )

    # Flag to automatically confirm prompts.
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Automatically confirm and proceed without prompting for output file writing.",
    )

    # Flag to prevent prepending the system prompt.
    parser.add_argument(
        "--no-sys-prompt",
        action="store_true",
        help=f"Do not prepend '{SYS_PROMPT_FILENAME}' found near the script itself.",
    )

    # Flag to require the system prompt for prepending.
    parser.add_argument(
        "--require-sys-prompt",
        action="store_true",
        help=f"Exit if '{SYS_PROMPT_FILENAME}' for prepending is not found or unreadable.",
    )

    # New flag to indicate this bundle is a good delta reference.
    parser.add_argument(
        "-t",
        "--prepare-for-delta-reference",
        action="store_true",
        help="Adds a header hint to the bundle indicating it is suitable as an original "
        "bundle for future delta operations with 'dogs.py --apply-delta'.",
    )

    # Set default for use_default_excludes to True.
    parser.set_defaults(use_default_excludes=True)

    # If no arguments are provided, print help message and exit.
    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)

    args = parser.parse_args()

    output_to_stdout = args.output == "-"
    abs_output_file_path_for_logic: Optional[Path] = None
    output_target_display_name = "stdout"

    # Determine the absolute path for the output file if not writing to stdout.
    if not output_to_stdout:
        output_filename = args.output if args.output else DEFAULT_OUTPUT_FILENAME
        abs_output_file_path_for_logic = Path.cwd().joinpath(output_filename).resolve()
        output_target_display_name = str(abs_output_file_path_for_logic)

    prepended_prompt_bytes = b""
    sys_prompt_prepended_successfully = False
    sys_prompt_path_used_for_prepending: Optional[Path] = None

    # Handle prepending of the system prompt (e.g., sys_ant.txt).
    if not args.no_sys_prompt:
        sys_prompt_path_used_for_prepending = find_sys_prompt_path_for_prepending()
        if sys_prompt_path_used_for_prepending:
            try:
                prompt_content_bytes = sys_prompt_path_used_for_prepending.read_bytes()
                # Assuming sys_ant.txt is UTF-8.
                prompt_content_str = prompt_content_bytes.decode("utf-8", "replace")
                prepended_prompt_bytes = (
                    prompt_content_str.rstrip() + "\n" + SYS_PROMPT_POST_SEPARATOR
                ).encode("utf-8")
                sys_prompt_prepended_successfully = True
                print(
                    f"  Prepended system prompt from: {sys_prompt_path_used_for_prepending}",
                    file=sys.stderr,
                )
            except Exception as e:
                msg = f"Warning: Could not read/process system prompt '{SYS_PROMPT_FILENAME}' from {sys_prompt_path_used_for_prepending}: {e}"
                print(msg, file=sys.stderr)
                if args.require_sys_prompt:
                    print("Exiting due to --require-sys-prompt.", file=sys.stderr)
                    sys.exit(1)
        elif args.require_sys_prompt:
            print(
                f"Error: System prompt '{SYS_PROMPT_FILENAME}' not found and --require-sys-prompt specified.",
                file=sys.stderr,
            )
            sys.exit(1)
        elif args.paths:
            # Inform if no sys prompt found but paths were given.
            print(
                f"  Info: System prompt '{SYS_PROMPT_FILENAME}' for prepending not found.",
                file=sys.stderr,
            )

    sys_ant_in_cwd_to_bundle_first: Optional[Path] = None
    potential_sys_ant_cwd = Path.cwd() / SYS_PROMPT_FILENAME

    # Handle sys_ant.txt in current working directory (CWD).
    # This is bundled as the first file *within* the bundle.
    if potential_sys_ant_cwd.is_file():
        resolved_sys_ant_cwd = potential_sys_ant_cwd.resolve()

        # Ensure it's not the same file that was already prepended.
        if not (
            sys_prompt_path_used_for_prepending
            and resolved_sys_ant_cwd == sys_prompt_path_used_for_prepending
        ):
            # Check if it's explicitly excluded by user arguments.
            is_excluded_by_arg = any(
                resolved_sys_ant_cwd == Path.cwd().joinpath(ex).resolve(strict=False)
                for ex in args.exclude
            )

            # Check if it's excluded by default rules.
            is_excluded_by_default = False
            if args.use_default_excludes:
                is_excluded_by_default = any(
                    resolved_sys_ant_cwd
                    == Path.cwd().joinpath(dex).resolve(strict=False)
                    for dex in DEFAULT_EXCLUDES
                )

            if not is_excluded_by_arg and not is_excluded_by_default:
                sys_ant_in_cwd_to_bundle_first = resolved_sys_ant_cwd
                print(
                    f"  Convention: Found '{SYS_PROMPT_FILENAME}' in CWD. It will be the first file _within_ the bundle.",
                    file=sys.stderr,
                )
            elif is_excluded_by_arg or is_excluded_by_default:
                print(
                    f"  Info: '{SYS_PROMPT_FILENAME}' in CWD is excluded. Not bundling as first file.",
                    file=sys.stderr,
                )

    print("Phase 1: Collecting and filtering files...", file=sys.stderr)
    # Create the bundle content string.
    (
        bundle_content_string,
        format_description,
        files_added_count,
        bundle_file_encoding_name,
    ) = create_bundle_from_paths_api(
        args.paths,
        args.exclude,
        args.force_encoding,
        args.use_default_excludes,
        abs_output_file_path_for_logic,
        sys_ant_in_cwd_to_bundle_first,
        args.prepare_for_delta_reference,  # Pass the new flag
    )

    # Check if any content was generated.
    if files_added_count == 0 and not sys_prompt_prepended_successfully:
        print(
            f"No files selected, and system prompt was not prepended. Bundle format: {format_description}. Exiting.",
            file=sys.stderr,
        )
        sys.exit(0)

    if files_added_count > 0:
        print(f"  Files to be included in bundle: {files_added_count}", file=sys.stderr)
        print(
            f"  Bundle format determined: {format_description.split('(')[0].strip()}",
            file=sys.stderr,
        )
        if args.force_encoding != "auto":
            print(
                f"  (Encoding strategy forced to: {args.force_encoding})",
                file=sys.stderr,
            )
        if args.prepare_for_delta_reference:
            print(f"  (Bundle marked as suitable for delta reference)", file=sys.stderr)

    proceed = args.yes
    # Prompt user for confirmation if not auto-confirming.
    if not proceed and (files_added_count > 0 or sys_prompt_prepended_successfully):
        print(
            f"\n  Output will be written to: {output_target_display_name}",
            file=sys.stderr,
        )
        proceed = confirm_action_prompt("Proceed with writing output?")

    if not proceed:
        print("Operation cancelled by user.", file=sys.stderr)
        sys.exit(0)

    # Encode the bundle content string to bytes using the determined encoding.
    bundle_bytes_to_write = bundle_content_string.encode(
        bundle_file_encoding_name, "replace"
    )

    # Combine prepended prompt and bundle content.
    full_output_bytes = prepended_prompt_bytes
    if files_added_count > 0:
        full_output_bytes += bundle_bytes_to_write

    # Write the output.
    if not output_to_stdout and abs_output_file_path_for_logic:
        print(
            f"\nPhase 2: Writing bundle to '{output_target_display_name}'...",
            file=sys.stderr,
        )
        try:
            # Create parent directories if they don't exist.
            if abs_output_file_path_for_logic.parent:
                abs_output_file_path_for_logic.parent.mkdir(parents=True, exist_ok=True)
            with open(abs_output_file_path_for_logic, "wb") as f_out:
                f_out.write(full_output_bytes)
            print(
                f"\nOutput successfully written to: '{output_target_display_name}'",
                file=sys.stderr,
            )
        except Exception as e:
            print(
                f"Fatal: Could not write to output file '{output_target_display_name}': {e}",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        # Write to stdout.
        sys.stdout.buffer.write(full_output_bytes)
        sys.stdout.flush()

    # Clean up potentially empty output file if cancelled mid-process.
    if (
        sys_prompt_prepended_successfully
        and files_added_count == 0
        and not proceed
        and abs_output_file_path_for_logic
    ):
        if (
            abs_output_file_path_for_logic.exists()
            and abs_output_file_path_for_logic.stat().st_size
            == len(prepended_prompt_bytes)
        ):
            try:
                abs_output_file_path_for_logic.unlink()
            except OSError:
                pass


if __name__ == "__main__":
    try:
        main_cli()
    except SystemExit:
        # Allow SystemExit (e.g., from parser.exit()) to pass through.
        raise
    except KeyboardInterrupt:
        print("\nOperation cancelled by user (KeyboardInterrupt).", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        import traceback

        print(
            f"\nAn unexpected critical error occurred in cats.py main: {e}",
            file=sys.stderr,
        )
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
