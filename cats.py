#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import argparse
import base64
from typing import List, Tuple, Dict, Optional, Union, Any

FILE_START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {} ---"
FILE_END_MARKER = "🐈 --- CATS_END_FILE ---"
DEFAULT_ENCODING = "utf-8" # Default *text* encoding
DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DEFAULT_EXCLUDES = ['.git', 'node_modules', 'gem', '__pycache__']


FileObject = Dict[str, Union[str, bytes, bool, Optional[str]]] # Added encoding


def detect_text_encoding(file_content_bytes: bytes) -> Optional[str]:
    """Checks if content is likely UTF-8 or UTF-16LE."""
    if not file_content_bytes:
        return DEFAULT_ENCODING # Empty is compatible with text formats
    try:
        file_content_bytes.decode(DEFAULT_ENCODING)
        return DEFAULT_ENCODING
    except UnicodeDecodeError:
        try:
            # Check for UTF-16 BOM first (LE or BE)
            if file_content_bytes.startswith(b'\xff\xfe') or file_content_bytes.startswith(b'\xfe\xff'):
                 # If BOM exists, attempt decode with utf-16
                 try:
                      file_content_bytes.decode('utf-16')
                      return 'utf-16le' # Standardize on LE for bundle format name
                 except UnicodeDecodeError:
                      return None # BOM present but invalid utf-16

            # Try UTF-16LE without BOM (more common than BE on many systems)
            file_content_bytes.decode('utf-16le')
            return 'utf-16le'
        except UnicodeDecodeError:
            # Could try other encodings, but for now, assume binary if not UTF-8/16LE
            return None


def get_final_paths_to_process(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    use_default_excludes: bool,
    output_file_abs_path: Optional[str] = None,
    sys_human_abs_realpath_to_ignore: Optional[str] = None,
    original_user_paths: Optional[List[str]] = None,
) -> List[str]:
    candidate_file_realpaths = set()
    
    all_exclude_paths = list(exclude_paths_raw)
    if use_default_excludes:
        # Get absolute paths for default excludes relative to CWD
        # Only add defaults if they actually exist to avoid excluding unrelated paths
        cwd = os.getcwd()
        for default_excl in DEFAULT_EXCLUDES:
             potential_path = os.path.join(cwd, default_excl)
             if os.path.exists(potential_path): # Check existence before adding
                 all_exclude_paths.append(potential_path)


    abs_excluded_realpaths_set = {
        os.path.realpath(os.path.abspath(p)) for p in all_exclude_paths
    }

    if sys_human_abs_realpath_to_ignore:
        abs_excluded_realpaths_set.add(sys_human_abs_realpath_to_ignore)

    abs_excluded_dirs_for_pruning_set = {
        p_realpath
        for p_realpath in abs_excluded_realpaths_set
        if os.path.isdir(p_realpath)
    }
    processed_top_level_input_realpaths = set()
    paths_to_check_for_warnings = original_user_paths if original_user_paths is not None else include_paths_raw

    for incl_path_raw in include_paths_raw:
        if incl_path_raw == "sys_human.txt" and sys_human_abs_realpath_to_ignore:
             continue
        try:
            abs_incl_path = os.path.abspath(incl_path_raw)
            current_input_realpath = os.path.realpath(abs_incl_path)
            if current_input_realpath == sys_human_abs_realpath_to_ignore:
                continue
        except OSError:
            current_input_realpath = os.path.abspath(incl_path_raw)
            if not os.path.lexists(current_input_realpath):
                 if incl_path_raw in paths_to_check_for_warnings:
                     print(
                         f"  Warning: Input path '{incl_path_raw}' not found. Skipping.",
                         file=sys.stderr,
                     )
                 continue

        if current_input_realpath in processed_top_level_input_realpaths:
             if incl_path_raw in paths_to_check_for_warnings:
                 continue
        processed_top_level_input_realpaths.add(current_input_realpath)

        if output_file_abs_path and current_input_realpath == output_file_abs_path:
            continue
        if current_input_realpath in abs_excluded_realpaths_set:
            continue

        is_inside_excluded_dir = any(
            current_input_realpath == excluded_dir_rp or
            current_input_realpath.startswith(excluded_dir_rp + os.path.sep)
            for excluded_dir_rp in abs_excluded_dirs_for_pruning_set
        )
        if is_inside_excluded_dir:
            continue

        if not os.path.lexists(current_input_realpath):
            if incl_path_raw in paths_to_check_for_warnings:
                print(
                    f"  Warning: Input path '{incl_path_raw}' not found or inaccessible. Skipping.",
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

                dirs_to_remove = []
                for d_name in dirnames:
                    dir_realpath_in_walk = os.path.realpath(
                        os.path.join(current_walk_dir_realpath, d_name)
                    )
                    # Check against exact excluded dir or if inside an excluded dir
                    if dir_realpath_in_walk in abs_excluded_dirs_for_pruning_set or \
                       any(dir_realpath_in_walk.startswith(ex_dir + os.path.sep) for ex_dir in abs_excluded_dirs_for_pruning_set):
                        dirs_to_remove.append(d_name)

                if dirs_to_remove:
                    dirnames[:] = [d for d in dirnames if d not in dirs_to_remove]

                for f_name in filenames:
                    file_abs_path_in_walk = os.path.join(current_walk_dir_realpath, f_name)
                    try:
                        if not os.path.lexists(file_abs_path_in_walk): continue
                        file_realpath_in_walk = os.path.realpath(file_abs_path_in_walk)
                    except OSError:
                        continue

                    if (
                        (output_file_abs_path and file_realpath_in_walk == output_file_abs_path)
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
    try:
        if common_ancestor_path == file_realpath and os.path.isfile(file_realpath):
            return os.path.basename(file_realpath)
        if common_ancestor_path == os.path.dirname(file_realpath) and os.path.isfile(file_realpath):
           return os.path.basename(file_realpath)
        if os.path.isdir(common_ancestor_path) and file_realpath.startswith(
             os.path.abspath(common_ancestor_path) + os.path.sep
         ):
            rel_path = os.path.relpath(file_realpath, common_ancestor_path)
        else:
             rel_path = os.path.relpath(file_realpath, common_ancestor_path)

        if rel_path == ".":
            return os.path.basename(file_realpath)
    except ValueError:
        rel_path = os.path.basename(file_realpath)

    return rel_path.replace(os.path.sep, "/")


def find_common_ancestor(paths: List[str]) -> str:
    if not paths: return os.getcwd()
    real_paths = []
    for p in paths:
        try:
            abs_p = os.path.abspath(p)
            if os.path.exists(abs_p) or os.path.islink(abs_p):
                 real_paths.append(os.path.realpath(abs_p))
        except OSError: continue
    if not real_paths: return os.getcwd()

    if len(real_paths) == 1:
        return (
            os.path.dirname(real_paths[0])
            if os.path.isfile(real_paths[0])
            else real_paths[0]
        )

    paths_for_commonpath = []
    for p_rp in real_paths:
         try:
             if os.path.isdir(p_rp): paths_for_commonpath.append(p_rp)
             elif os.path.isfile(p_rp): paths_for_commonpath.append(os.path.dirname(p_rp))
         except OSError: continue
    if not paths_for_commonpath: return os.getcwd()

    try:
         common = os.path.commonpath(paths_for_commonpath)
         if len(set(paths_for_commonpath)) > 1 and (not os.path.isdir(common)):
             common = os.path.dirname(common)
         return common if common else os.getcwd()
    except ValueError: return os.getcwd()


def prepare_file_object(file_abs_path: str, common_ancestor_for_relpath: str) -> Optional[FileObject]:
    try:
        with open(file_abs_path, "rb") as f:
            content_bytes = f.read()

        detected_encoding = detect_text_encoding(content_bytes)
        relative_path = generate_bundle_relative_path(
            file_abs_path, common_ancestor_for_relpath
        )

        return {
            "path": file_abs_path,
            "relative_path": relative_path,
            "content_bytes": content_bytes,
            "encoding": detected_encoding, # 'utf-8', 'utf-16le', or None for binary
            "is_utf8": detected_encoding == 'utf-8' # Keep for potential legacy checks, though 'encoding' is better
        }
    except Exception as e:
        print(
            f"  Warning: Error reading file '{file_abs_path}': {e}. Skipping.",
            file=sys.stderr,
        )
        return None


def prepare_file_objects_from_paths(
    abs_file_paths: List[str], common_ancestor_for_relpath: str
) -> List[FileObject]:
    file_objects: List[FileObject] = []
    for file_abs_path in abs_file_paths:
        file_obj = prepare_file_object(file_abs_path, common_ancestor_for_relpath)
        if file_obj:
            file_objects.append(file_obj)
    return file_objects


def create_bundle_string_from_objects(
    file_objects: List[FileObject],
    encoding_mode: str, # 'auto', 'utf8', 'utf16le', 'b64'
) -> Tuple[str, str]:
    bundle_parts = []
    final_bundle_format = 'Raw UTF-8' # Default start
    final_encoding_for_write = 'utf-8' # Default start

    if encoding_mode == 'b64':
        final_bundle_format = 'Base64'
        final_encoding_for_write = 'base64'
    elif encoding_mode == 'utf16le':
        final_bundle_format = 'Raw UTF-16LE'
        final_encoding_for_write = 'utf-16le'
    elif encoding_mode == 'utf8':
        final_bundle_format = 'Raw UTF-8'
        final_encoding_for_write = 'utf-8'
    elif encoding_mode == 'auto':
        # Auto logic: Check files. Binary -> B64. Any UTF16 -> UTF16LE. Else -> UTF8.
        has_binary = any(f["encoding"] is None for f in file_objects)
        has_utf16 = any(f["encoding"] == 'utf-16le' for f in file_objects)

        if has_binary:
            final_bundle_format = 'Base64'
            final_encoding_for_write = 'base64'
        elif has_utf16:
            final_bundle_format = 'Raw UTF-16LE'
            final_encoding_for_write = 'utf-16le'
        else: # All seem UTF-8 compatible or are empty
            final_bundle_format = 'Raw UTF-8'
            final_encoding_for_write = 'utf-8'
    else: # Should not happen with arg choices, but default
        final_bundle_format = 'Raw UTF-8'
        final_encoding_for_write = 'utf-8'

    format_description = final_bundle_format
    if encoding_mode != 'auto':
         format_description += f" (Forced by user: {encoding_mode})"
    elif final_bundle_format == 'Base64':
         format_description += " (Auto-Detected binary content)"
    elif final_bundle_format == 'Raw UTF-16LE':
         format_description += " (Auto-Detected UTF-16LE content)"
    else:
         format_description += " (All files appear UTF-8 compatible)"

    bundle_parts.append(BUNDLE_HEADER_PREFIX)
    bundle_parts.append(f"{BUNDLE_FORMAT_PREFIX}{format_description}")

    output_encoding_error_handler = 'replace' # Be lenient when writing final bundle

    for file_obj in file_objects:
        bundle_parts.append("")
        bundle_parts.append(
            FILE_START_MARKER_TEMPLATE.format(str(file_obj["relative_path"]))
        )
        content_bytes = file_obj["content_bytes"]
        assert isinstance(content_bytes, bytes), "File content must be bytes"

        content_to_write = ""
        try:
            if final_encoding_for_write == 'base64':
                content_to_write = base64.b64encode(content_bytes).decode('ascii')
            elif final_encoding_for_write == 'utf-16le':
                content_to_write = content_bytes.decode('utf-16le', errors=output_encoding_error_handler)
            else: # utf-8
                content_to_write = content_bytes.decode('utf-8', errors=output_encoding_error_handler)
        except Exception as e:
             # Fallback: If decode fails even with handler, try Base64 for this block
             print(f"  Warning: Unexpected error encoding file '{file_obj['relative_path']}' for bundle format '{final_bundle_format}'. Falling back to Base64 for this file. Error: {e}", file=sys.stderr)
             content_to_write = base64.b64encode(content_bytes).decode('ascii')

        bundle_parts.append(content_to_write)
        bundle_parts.append(FILE_END_MARKER)

    # Use UTF-8 for the overall bundle file itself, content within uses specified format
    return "\n".join(bundle_parts) + "\n", format_description


def create_bundle_from_paths(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    encoding_mode: str = 'auto', # 'auto', 'utf8', 'utf16le', 'b64'
    use_default_excludes: bool = True,
    output_file_abs_path: Optional[str] = None,
    sys_human_abs_realpath_to_include: Optional[str] = None,
    original_user_paths: Optional[List[str]] = None,
) -> Tuple[str, str, int]:

    sys_human_object: Optional[FileObject] = None
    if sys_human_abs_realpath_to_include:
        sys_human_ancestor = os.getcwd()
        sys_human_object = prepare_file_object(sys_human_abs_realpath_to_include, sys_human_ancestor)

    other_abs_file_paths_to_bundle = get_final_paths_to_process(
        include_paths_raw,
        exclude_paths_raw,
        use_default_excludes,
        output_file_abs_path,
        sys_human_abs_realpath_to_ignore=sys_human_abs_realpath_to_include,
        original_user_paths=original_user_paths
    )

    paths_for_ancestor_calc = other_abs_file_paths_to_bundle
    if not paths_for_ancestor_calc and sys_human_object:
         common_ancestor = os.getcwd()
    elif not paths_for_ancestor_calc:
         common_ancestor = os.getcwd()
    else:
         common_ancestor = find_common_ancestor(paths_for_ancestor_calc)

    other_file_objects = prepare_file_objects_from_paths(
        other_abs_file_paths_to_bundle, common_ancestor
    )

    final_file_objects: List[FileObject] = []
    if sys_human_object:
        sys_human_object['relative_path'] = generate_bundle_relative_path(sys_human_object['path'], os.getcwd())
        final_file_objects.append(sys_human_object)
    final_file_objects.extend(other_file_objects)

    if not final_file_objects:
        return "", "No files selected", 0

    bundle_content, format_desc = create_bundle_string_from_objects(
        final_file_objects, encoding_mode
    )
    return bundle_content, format_desc, len(final_file_objects)


def confirm_action_prompt(prompt_message: str) -> bool:
    if not sys.stdin.isatty():
        print("  Non-interactive mode detected. Proceeding automatically.")
        return True
    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "": return True
            if choice == "n": return False
            print("Invalid input. Please enter 'y' or 'n'.")
        except KeyboardInterrupt:
            print("\nOperation cancelled by user.")
            return False
        except EOFError:
            print("\nOperation cancelled (EOF detected). Defaulting to No.")
            return False


def main_cli():
    parser = argparse.ArgumentParser(
        description="cats.py : Bundles project files into a single text artifact for LLMs.",
        epilog="Example: python cats.py ./src -x ./tests -N -E utf8 -o my_project.bundle",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("paths", nargs="+", metavar="PATH", help="Files/directories to include.")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT_FILENAME, metavar="BUNDLE_FILE", help=f"Output bundle file (default: {DEFAULT_OUTPUT_FILENAME}).")
    parser.add_argument("-x", "--exclude", action="append", default=[], metavar="EXCLUDE_PATH", help="Path to exclude (file or directory). Use multiple times. Added to defaults.")
    parser.add_argument("-N", "--no-default-excludes", action="store_false", dest="use_default_excludes", help=f"Disable default excludes: {', '.join(DEFAULT_EXCLUDES)}.")
    parser.add_argument("-E", "--force-encoding", choices=['auto', 'utf8', 'utf16le', 'b64'], default='auto', metavar="MODE", help="Force bundle encoding: auto (default), utf8, utf16le, b64.")
    parser.add_argument("-y", "--yes", action="store_true", help="Automatically confirm and proceed without prompting.")
    parser.set_defaults(use_default_excludes=True)

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
    args = parser.parse_args()

    abs_output_file_realpath = os.path.realpath(os.path.abspath(args.output))

    sys_human_realpath_to_include: Optional[str] = None
    sys_human_path = "sys_human.txt"
    sys_human_abs_path = os.path.abspath(sys_human_path)

    # Check if sys_human exists and should be included (not manually excluded)
    if os.path.isfile(sys_human_abs_path):
        sys_human_realpath_to_include = os.path.realpath(sys_human_abs_path)
        is_excluded = False
        # Check against manual excludes first
        for excl_raw in args.exclude:
             try:
                 excl_abs = os.path.abspath(excl_raw)
                 excl_real = os.path.realpath(excl_abs)
                 if sys_human_realpath_to_include == excl_real: is_excluded = True; break
                 if os.path.isdir(excl_real) and sys_human_realpath_to_include.startswith(excl_real + os.path.sep): is_excluded = True; break
             except OSError: pass
        # Check against default excludes only if they are active
        if not is_excluded and args.use_default_excludes:
             for default_excl in DEFAULT_EXCLUDES:
                  try:
                      potential_path = os.path.join(os.getcwd(), default_excl)
                      if os.path.exists(potential_path):
                           excl_real = os.path.realpath(potential_path)
                           if sys_human_realpath_to_include == excl_real: is_excluded = True; break
                           if os.path.isdir(excl_real) and sys_human_realpath_to_include.startswith(excl_real + os.path.sep): is_excluded = True; break
                  except OSError: pass

        if is_excluded:
             print(f"  Info: '{sys_human_path}' found but is excluded by rule. Not adding.")
             sys_human_realpath_to_include = None
        else:
             print(f"  Convention: Found '{sys_human_path}'. Will include it at the start of the bundle.")

    print("Phase 1: Collecting and filtering files...")
    bundle_content, format_description, files_added_count = create_bundle_from_paths(
        include_paths_raw=args.paths,
        exclude_paths_raw=args.exclude,
        encoding_mode=args.force_encoding,
        use_default_excludes=args.use_default_excludes,
        output_file_abs_path=abs_output_file_realpath,
        sys_human_abs_realpath_to_include=sys_human_realpath_to_include,
        original_user_paths=args.paths
    )

    if files_added_count == 0:
        print(f"No files selected for bundling. {format_description}. Exiting.")
        return

    print(f"  Files to be bundled: {files_added_count}")
    print(f"  Bundle format determined: {format_description.split('(')[0].strip()}")
    if args.force_encoding != 'auto':
        print(f"  (Encoding forced by user: {args.force_encoding})")

    proceed = args.yes
    if not proceed:
        print(f"\n  Output will be written to: {abs_output_file_realpath}")
        proceed = confirm_action_prompt("Proceed with bundling?")

    if not proceed:
        print("Bundling cancelled.")
        return

    print(f"\nPhase 2: Writing bundle to '{abs_output_file_realpath}'...")
    print(f"  Final Bundle Format: {format_description}")

    try:
        output_parent_dir = os.path.dirname(abs_output_file_realpath)
        if output_parent_dir and not os.path.exists(output_parent_dir):
            os.makedirs(output_parent_dir, exist_ok=True)
        # Write the bundle file itself always as UTF-8
        with open(abs_output_file_realpath, "w", encoding=DEFAULT_ENCODING, errors="replace") as f_bundle:
            f_bundle.write(bundle_content)
        print(f"\nBundle created successfully: '{args.output}'")
        print(f"  Files added: {files_added_count}")
    except Exception as e:
        print(f"\nFatal error writing bundle: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main_cli()