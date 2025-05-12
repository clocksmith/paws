#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import argparse
import base64
from typing import List, Tuple, Dict, Optional, Union, Any

FILE_START_MARKER_TEMPLATE = "--- CATS_START_FILE: {} ---"
FILE_END_MARKER = "--- CATS_END_FILE ---"
DEFAULT_ENCODING = "utf-8"
DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "


FileObject = Dict[str, Union[str, bytes, bool]]


def is_likely_utf8(file_content_bytes: bytes) -> bool:
    """Checks if file content is likely UTF-8 by attempting to decode."""
    if not file_content_bytes:
        return True
    try:
        file_content_bytes.decode(DEFAULT_ENCODING)
        return True
    except UnicodeDecodeError:
        return False


def get_final_paths_to_process(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    output_file_abs_path: Optional[str] = None,
) -> List[str]:
    """
    Determines the final list of absolute, canonical file paths to include.
    Handles exclusions and output file skipping. Returns sorted absolute file paths.
    """
    candidate_file_realpaths = set()
    abs_excluded_realpaths_set = {
        os.path.realpath(os.path.abspath(p)) for p in exclude_paths_raw
    }
    abs_excluded_dirs_for_pruning_set = {
        p_realpath
        for p_realpath in abs_excluded_realpaths_set
        if os.path.isdir(p_realpath)
    }
    processed_top_level_input_realpaths = set()

    for incl_path_raw in include_paths_raw:
        abs_incl_path = os.path.abspath(incl_path_raw)
        current_input_realpath = os.path.realpath(abs_incl_path)

        if current_input_realpath in processed_top_level_input_realpaths:
            # Avoid processing the same top-level path multiple times if listed explicitly
            # e.g. cats.py ./src ./src
            # However, if sys_human.txt was prepended, it might be processed here.
            # If it's the same as a user-provided path, that's fine.
            if (
                incl_path_raw not in args.paths and incl_path_raw == "sys_human.txt"
            ):  # Check if it's the auto-added sys_human.txt
                pass  # Allow it to be processed even if current_input_realpath was seen due to user args
            elif (
                current_input_realpath in processed_top_level_input_realpaths
                and incl_path_raw in args.paths
            ):  # User provided duplicate
                continue

        processed_top_level_input_realpaths.add(current_input_realpath)

        if output_file_abs_path and current_input_realpath == output_file_abs_path:
            continue
        if current_input_realpath in abs_excluded_realpaths_set:
            continue

        is_inside_excluded_dir = any(
            current_input_realpath.startswith(excluded_dir_rp + os.path.sep)
            for excluded_dir_rp in abs_excluded_dirs_for_pruning_set
        )
        if is_inside_excluded_dir:
            continue

        if not os.path.exists(current_input_realpath):
            # Only warn for user-provided paths, not for the conventionally included sys_human.txt if it's missing
            if (
                incl_path_raw in args.paths
            ):  # args needs to be accessible here or passed
                print(
                    f"  Warning: Input path '{incl_path_raw}' not found. Skipping.",
                    file=sys.stderr,
                )
            continue

        if os.path.isfile(current_input_realpath):
            candidate_file_realpaths.add(current_input_realpath)
        elif os.path.isdir(current_input_realpath):
            for dirpath, dirnames, filenames in os.walk(
                current_input_realpath, topdown=True, followlinks=False
            ):
                current_walk_dir_realpath = os.path.realpath(dirpath)
                dirnames[:] = [
                    d_name
                    for d_name in dirnames
                    if os.path.realpath(os.path.join(current_walk_dir_realpath, d_name))
                    not in abs_excluded_dirs_for_pruning_set
                ]
                for f_name in filenames:
                    file_realpath_in_walk = os.path.realpath(
                        os.path.join(current_walk_dir_realpath, f_name)
                    )
                    if (
                        (
                            output_file_abs_path
                            and file_realpath_in_walk == output_file_abs_path
                        )
                        or (file_realpath_in_walk in abs_excluded_realpaths_set)
                        or any(
                            file_realpath_in_walk.startswith(ex_dir + os.path.sep)
                            for ex_dir in abs_excluded_dirs_for_pruning_set
                        )
                    ):
                        continue
                    if os.path.isfile(file_realpath_in_walk):
                        candidate_file_realpaths.add(file_realpath_in_walk)
    return sorted(list(candidate_file_realpaths))


def generate_bundle_relative_path(file_realpath: str, common_ancestor_path: str) -> str:
    """Generates a relative path for the bundle marker, using forward slashes."""
    try:
        if common_ancestor_path == file_realpath and os.path.isfile(file_realpath):
            return os.path.basename(file_realpath)
        # If common_ancestor_path is a directory containing file_realpath
        if os.path.isdir(common_ancestor_path) and file_realpath.startswith(
            common_ancestor_path + os.path.sep
        ):
            rel_path = os.path.relpath(file_realpath, common_ancestor_path)
        # If common_ancestor_path is the parent directory of file_realpath (because file_realpath was the only input)
        elif common_ancestor_path == os.path.dirname(file_realpath) and os.path.isfile(
            file_realpath
        ):
            rel_path = os.path.basename(file_realpath)
        else:  # Fallback or different structure
            rel_path = os.path.relpath(file_realpath, common_ancestor_path)

        if rel_path == "." or not rel_path:
            return os.path.basename(file_realpath)
    except ValueError:
        rel_path = os.path.basename(file_realpath)

    return rel_path.replace(os.path.sep, "/")


def find_common_ancestor(paths: List[str]) -> str:
    """Finds the longest common ancestor directory for a list of absolute paths."""
    if not paths:
        return os.getcwd()

    # Ensure all paths are absolute and real paths before comparison
    real_paths = [os.path.realpath(os.path.abspath(p)) for p in paths]

    if len(real_paths) == 1:
        # If it's a single file, its parent directory is the "common ancestor" for relpath logic.
        # If it's a single directory, that directory itself is the common ancestor.
        return (
            os.path.dirname(real_paths[0])
            if os.path.isfile(real_paths[0])
            else real_paths[0]
        )

    paths_for_commonpath = []
    for p_rp in real_paths:
        if os.path.isdir(p_rp):
            paths_for_commonpath.append(p_rp)
        else:
            paths_for_commonpath.append(os.path.dirname(p_rp))

    if not paths_for_commonpath:  # Should be rare if real_paths was populated
        return os.getcwd()

    # commonpath might return an empty string if there's no common path (e.g. different drives on Windows)
    common = os.path.commonpath(paths_for_commonpath)
    return common if common else os.getcwd()  # Fallback to CWD if no commonality


def prepare_file_objects_from_paths(
    abs_file_paths: List[str], common_ancestor_for_relpath: str
) -> Tuple[List[FileObject], bool]:
    """
    Reads files, determines UTF-8, prepares for bundling.
    Returns list of file objects and bool if any non-UTF-8 found.
    """
    file_objects: List[FileObject] = []
    any_non_utf8_found = False

    for file_abs_path in abs_file_paths:
        try:
            with open(file_abs_path, "rb") as f:
                content_bytes = f.read()

            is_utf8 = is_likely_utf8(content_bytes)
            if not is_utf8:
                any_non_utf8_found = True

            relative_path = generate_bundle_relative_path(
                file_abs_path, common_ancestor_for_relpath
            )

            file_objects.append(
                {
                    "path": file_abs_path,
                    "relative_path": relative_path,
                    "content_bytes": content_bytes,
                    "is_utf8": is_utf8,
                }
            )
        except Exception as e:
            print(
                f"  Warning: Error reading file '{file_abs_path}': {e}. Skipping.",
                file=sys.stderr,
            )
    return file_objects, any_non_utf8_found


def create_bundle_string_from_objects(
    file_objects: List[FileObject],
    force_base64_bundle: bool,
    any_non_utf8_already_detected: bool,
) -> Tuple[str, str]:
    """
    Creates the bundle string from prepared file objects.
    Returns bundle string and format description.
    """
    bundle_parts = []
    use_base64_for_all = force_base64_bundle or any_non_utf8_already_detected

    format_description = (
        "Base64 (Forced)"
        if force_base64_bundle
        else (
            "Base64 (Auto-Detected due to non-UTF-8 content)"
            if any_non_utf8_already_detected
            else f"Raw {DEFAULT_ENCODING} (All files appear UTF-8 compatible)"
        )
    )

    bundle_parts.append(BUNDLE_HEADER_PREFIX)
    bundle_parts.append(f"{BUNDLE_FORMAT_PREFIX}{format_description}")

    for file_obj in file_objects:
        bundle_parts.append("")
        bundle_parts.append(
            FILE_START_MARKER_TEMPLATE.format(str(file_obj["relative_path"]))
        )
        content_bytes = file_obj["content_bytes"]
        assert isinstance(content_bytes, bytes), "File content must be bytes"

        if use_base64_for_all:
            content_to_write = base64.b64encode(content_bytes).decode(DEFAULT_ENCODING)
        else:
            content_to_write = content_bytes.decode(DEFAULT_ENCODING)
        bundle_parts.append(content_to_write)
        bundle_parts.append(FILE_END_MARKER)
    return "\n".join(bundle_parts) + "\n", format_description


def create_bundle_from_paths(
    include_paths_raw: List[
        str
    ],  # This will now include sys_human.txt if found by main_cli
    exclude_paths_raw: List[str],
    force_base64: bool,
    output_file_abs_path: Optional[str] = None,
    base_dir_for_relpath: Optional[str] = None,
    original_user_paths: Optional[
        List[str]
    ] = None,  # Pass original user paths for warnings
) -> Tuple[str, str, int]:
    """
    High-level function to create a bundle string from specified paths.
    """
    # Make args accessible to get_final_paths_to_process for more accurate warnings
    # This is a bit of a hack; ideally, args would be passed down or structured differently.
    # For this modification, we'll assume 'args' is accessible globally within main_cli context
    # or we pass original_user_paths.
    global args  # Declare args as global if we rely on it in get_final_paths_to_process
    # Or, better, pass relevant parts of args if needed.
    # For now, I'll adjust get_final_paths_to_process to use original_user_paths

    abs_file_paths_to_bundle = get_final_paths_to_process(
        include_paths_raw, exclude_paths_raw, output_file_abs_path
    )
    if not abs_file_paths_to_bundle:
        return "", "No files selected", 0

    # Determine the common ancestor for relative path generation
    paths_for_ancestor_calc = []
    if base_dir_for_relpath:
        common_ancestor = os.path.realpath(os.path.abspath(base_dir_for_relpath))
    else:
        # Use only the user-provided paths for common ancestor if sys_human.txt is outside them,
        # unless sys_human.txt is the *only* thing being bundled.
        # Or, more simply, always use all final bundled paths for ancestor calculation.
        # This ensures sys_human.txt gets 'sys_human.txt' if it's at the root of the bundle.
        paths_for_ancestor_calc = abs_file_paths_to_bundle
        common_ancestor = find_common_ancestor(paths_for_ancestor_calc)

    file_objects, any_non_utf8 = prepare_file_objects_from_paths(
        abs_file_paths_to_bundle, common_ancestor
    )
    if not file_objects:
        return "", "No files successfully processed", 0

    bundle_content, format_desc = create_bundle_string_from_objects(
        file_objects, force_base64, any_non_utf8
    )
    return bundle_content, format_desc, len(file_objects)


def confirm_action_prompt(prompt_message: str) -> bool:
    """Asks user for Y/n confirmation, defaults to Y. For CLI use."""
    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "":
                return True
            if choice == "n":
                return False
            print("Invalid input. Please enter 'y' or 'n'.")
        except KeyboardInterrupt:
            print("\nOperation cancelled by user.")
            return False
        except EOFError:
            print("\nOperation cancelled (EOF).")
            return False


# Global args for get_final_paths_to_process to check original user paths.
# This is not ideal but avoids major refactoring for this specific change.
args: Optional[argparse.Namespace] = None


def main_cli():
    global args  # Make args accessible to helper functions if they need it
    parser = argparse.ArgumentParser(
        description="cats.py : Bundles project files into a single text artifact for LLMs.",
        epilog="Example: python cats.py ./src ./docs -x ./src/tests -o my_project.bundle",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "paths", nargs="+", metavar="PATH", help="Files/directories to include."
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUTPUT_FILENAME,
        metavar="BUNDLE_FILE",
        help=f"Output bundle file (default: {DEFAULT_OUTPUT_FILENAME}).",
    )
    parser.add_argument(
        "-x",
        "--exclude",
        action="append",
        default=[],
        metavar="EXCLUDE_PATH",
        help="Path to exclude (file or directory). Use multiple times.",
    )
    parser.add_argument(
        "--force-b64", action="store_true", help="Force Base64 encoding for all files."
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Automatically confirm and proceed without prompting (if a prompt would occur).",
    )

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
    args = parser.parse_args()

    abs_output_file_realpath = os.path.realpath(os.path.abspath(args.output))

    # --- Modification to include sys_human.txt ---
    paths_to_process = list(args.paths)  # Make a mutable copy
    sys_human_path = "sys_human.txt"
    sys_human_abs_path = os.path.abspath(sys_human_path)

    if os.path.isfile(sys_human_abs_path):
        # Add it to the beginning so user's explicit paths can override common ancestor logic later if needed.
        # Or, just add it, and let get_final_paths_to_process handle if it's excluded etc.
        # Ensure it's not already explicitly listed to avoid duplicate processing attempts by get_final_paths_to_process's seen set
        # based on raw path.
        already_listed = False
        for p_raw in paths_to_process:
            if os.path.realpath(os.path.abspath(p_raw)) == os.path.realpath(
                sys_human_abs_path
            ):
                already_listed = True
                break
        if not already_listed:
            paths_to_process.insert(0, sys_human_path)  # Prepend sys_human.txt
            print(f"  Convention: Attempting to include '{sys_human_path}' from CWD.")
    # --- End modification ---

    print("Phase 1: Collecting and filtering files...")
    bundle_content, format_description, files_added_count = create_bundle_from_paths(
        paths_to_process,  # Use the modified list
        args.exclude,
        args.force_b64,
        abs_output_file_realpath,
        original_user_paths=args.paths,  # Pass original user paths for warning logic
    )

    if files_added_count == 0:
        print(f"No files selected for bundling. {format_description}. Exiting.")
        return

    print(f"  Files to be bundled: {files_added_count}")
    if args.force_b64:
        print("  Encoding: All files will be Base64 encoded (user forced).")
    else:
        print(f"  Bundle format determined: {format_description.split('(')[0].strip()}")

    if not args.yes and sys.stdin.isatty():
        print(f"  Output will be written to: {abs_output_file_realpath}")
        if not confirm_action_prompt("\nProceed with bundling?"):
            print("Bundling cancelled by user.")
            return
    elif not sys.stdin.isatty() and not args.yes:
        print("  Non-interactive mode, proceeding without confirmation prompt.")

    print(f"\nPhase 2: Writing bundle to '{abs_output_file_realpath}'...")
    print(f"  Final Bundle Format: {format_description}")

    try:
        output_parent_dir = os.path.dirname(abs_output_file_realpath)
        if output_parent_dir and not os.path.exists(output_parent_dir):
            os.makedirs(output_parent_dir, exist_ok=True)
        with open(
            abs_output_file_realpath, "w", encoding=DEFAULT_ENCODING, errors="replace"
        ) as f_bundle:
            f_bundle.write(bundle_content)
        print(f"\nBundle created successfully: '{args.output}'")
        print(f"  Files added: {files_added_count}")
    except Exception as e:
        print(f"\nFatal error writing bundle: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main_cli()
