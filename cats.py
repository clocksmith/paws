#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import argparse
import base64
import re
from typing import List, Tuple, Dict, Optional, Union, Any

# --- Constants ---
SYS_PROMPT_FILENAME = "sys_human.txt"
SYS_PROMPT_POST_SEPARATOR = """
--- END OF SYSTEM PROMPT ---
The following content is the Cats Bundle.
"""
FILE_START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {} {}---" # Path, Optional Encoding Hint
FILE_END_MARKER = "🐈 --- CATS_END_FILE ---"
DEFAULT_ENCODING = "utf-8"
DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DEFAULT_EXCLUDES = ['.git', 'node_modules', 'gem', '__pycache__']
BASE64_CONTENT_MARKER = "(Content:Base64)"

FileObject = Dict[str, Union[str, bytes, bool, Optional[str]]]


def find_sys_prompt_path_for_prepending() -> Optional[str]:
    """
    Locates the system prompt file (e.g., sys_human.txt) for prepending.
    Searches first in the script's directory, then one directory level up.
    Returns the absolute real path if found, otherwise None.
    """
    try:
        script_dir = os.path.dirname(os.path.realpath(os.path.abspath(__file__)))
    except NameError:
        script_dir = os.getcwd()
    
    for loc in [script_dir, os.path.dirname(script_dir)]:
        path_to_check = os.path.join(loc, SYS_PROMPT_FILENAME)
        if os.path.exists(path_to_check) and os.path.isfile(path_to_check):
            return os.path.realpath(path_to_check)
    return None


def detect_text_encoding(file_content_bytes: bytes) -> Optional[str]:
    """
    Detects if content is likely UTF-8 or UTF-16LE.
    Returns encoding name ('utf-8', 'utf-16le') or None if likely binary or other.
    """
    if not file_content_bytes:
        return DEFAULT_ENCODING
    try:
        # Check for UTF-16 BOMs first
        if file_content_bytes.startswith(b'\xff\xfe'): # UTF-16LE BOM
            file_content_bytes.decode('utf-16le') # Check validity
            return 'utf-16le'
        if file_content_bytes.startswith(b'\xfe\xff'): # UTF-16BE BOM
            file_content_bytes.decode('utf-16be') # Check validity
            return 'utf-16be' # Note: PAWS primarily handles LE, but detection is useful

        # Try UTF-8 (more common)
        file_content_bytes.decode(DEFAULT_ENCODING)
        return DEFAULT_ENCODING
    except UnicodeDecodeError:
        # Try UTF-16LE without BOM (less reliable but common on Windows)
        try:
            file_content_bytes.decode('utf-16le')
            return 'utf-16le'
        except UnicodeDecodeError:
            return None # Likely binary or other encoding


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
        cwd = os.getcwd()
        for default_excl in DEFAULT_EXCLUDES:
             potential_path = os.path.join(cwd, default_excl)
             if os.path.exists(potential_path): 
                 all_exclude_paths.append(potential_path)

    abs_excluded_realpaths_set = {
        os.path.realpath(os.path.abspath(p)) for p in all_exclude_paths if os.path.exists(p) # Check existence before realpath
    }

    if sys_human_abs_realpath_to_ignore:
        abs_excluded_realpaths_set.add(sys_human_abs_realpath_to_ignore)

    abs_excluded_dirs_for_pruning_set = {
        p_realpath for p_realpath in abs_excluded_realpaths_set if os.path.isdir(p_realpath)
    }
    processed_top_level_input_realpaths = set()
    paths_to_check_for_warnings = original_user_paths if original_user_paths is not None else include_paths_raw

    for incl_path_raw in include_paths_raw:
        if incl_path_raw == SYS_PROMPT_FILENAME and sys_human_abs_realpath_to_ignore and \
           os.path.realpath(os.path.abspath(incl_path_raw)) == sys_human_abs_realpath_to_ignore:
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
                     print(f"  Warning: Input path '{incl_path_raw}' not found. Skipping.", file=sys.stderr)
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
            current_input_realpath == excluded_dir_rp or \
            current_input_realpath.startswith(excluded_dir_rp + os.path.sep)
            for excluded_dir_rp in abs_excluded_dirs_for_pruning_set
        )
        if is_inside_excluded_dir:
            continue

        if not os.path.lexists(current_input_realpath):
            if incl_path_raw in paths_to_check_for_warnings:
                print(f"  Warning: Input path '{incl_path_raw}' not found or inaccessible. Skipping.", file=sys.stderr)
            continue

        if os.path.isfile(current_input_realpath):
            candidate_file_realpaths.add(current_input_realpath)
        elif os.path.isdir(current_input_realpath):
            for dirpath, dirnames, filenames in os.walk(current_input_realpath, topdown=True, followlinks=False):
                current_walk_dir_realpath = os.path.realpath(dirpath)
                dirs_to_remove = [
                    d_name for d_name in dirnames
                    if os.path.realpath(os.path.join(current_walk_dir_realpath, d_name)) in abs_excluded_dirs_for_pruning_set or \
                       any(os.path.realpath(os.path.join(current_walk_dir_realpath, d_name)).startswith(ex_dir + os.path.sep) for ex_dir in abs_excluded_dirs_for_pruning_set)
                ]
                if dirs_to_remove:
                    dirnames[:] = [d for d in dirnames if d not in dirs_to_remove]

                for f_name in filenames:
                    file_abs_path_in_walk = os.path.join(current_walk_dir_realpath, f_name)
                    try:
                        if not os.path.lexists(file_abs_path_in_walk): continue
                        file_realpath_in_walk = os.path.realpath(file_abs_path_in_walk)
                    except OSError: continue

                    if (output_file_abs_path and file_realpath_in_walk == output_file_abs_path) or \
                       (file_realpath_in_walk in abs_excluded_realpaths_set) or \
                       any(file_realpath_in_walk.startswith(ex_dir + os.path.sep) for ex_dir in abs_excluded_dirs_for_pruning_set):
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
        if os.path.isdir(common_ancestor_path) and file_realpath.startswith(os.path.abspath(common_ancestor_path) + os.path.sep):
            rel_path = os.path.relpath(file_realpath, common_ancestor_path)
        else:
             rel_path = os.path.relpath(file_realpath, common_ancestor_path)
        if rel_path == ".": return os.path.basename(file_realpath)
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
        return os.path.dirname(real_paths[0]) if os.path.isfile(real_paths[0]) else real_paths[0]

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
    except ValueError:
        return os.getcwd()


def prepare_file_object(file_abs_path: str, common_ancestor_for_relpath: str) -> Optional[FileObject]:
    try:
        with open(file_abs_path, "rb") as f:
            content_bytes = f.read()
        detected_encoding = detect_text_encoding(content_bytes)
        relative_path = generate_bundle_relative_path(file_abs_path, common_ancestor_for_relpath)
        return {
            "path": file_abs_path,
            "relative_path": relative_path,
            "content_bytes": content_bytes,
            "encoding": detected_encoding, # 'utf-8', 'utf-16le', or None (binary)
            "is_binary": detected_encoding is None
        }
    except Exception as e:
        print(f"  Warning: Error reading file '{file_abs_path}': {e}. Skipping.", file=sys.stderr)
        return None


def prepare_file_objects_from_paths(abs_file_paths: List[str], common_ancestor_for_relpath: str) -> List[FileObject]:
    return [
        file_obj for file_abs_path in abs_file_paths
        if (file_obj := prepare_file_object(file_abs_path, common_ancestor_for_relpath)) is not None
    ]


def create_bundle_string_from_objects(
    file_objects: List[FileObject],
    encoding_mode: str, # 'auto', 'utf8', 'utf16le', 'b64'
) -> Tuple[str, str]:
    bundle_parts = []
    
    # Determine primary text encoding for the bundle
    primary_text_encoding = DEFAULT_ENCODING # Default to utf-8
    bundle_description_suffix = f" (All text files as {primary_text_encoding.upper()}; binaries as Base64)"

    if encoding_mode == 'b64':
        # All files will be Base64 encoded, primary text encoding is moot but use for description
        final_bundle_format_header = 'Base64'
        bundle_description_suffix = " (All files forced to Base64 by user)"
    elif encoding_mode == 'utf16le':
        primary_text_encoding = 'utf-16le'
        final_bundle_format_header = 'Raw UTF-16LE'
        bundle_description_suffix = f" (Text files as UTF-16LE; binaries as Base64; forced by user)"
    elif encoding_mode == 'utf8':
        primary_text_encoding = 'utf-8'
        final_bundle_format_header = 'Raw UTF-8'
        bundle_description_suffix = f" (Text files as UTF-8; binaries as Base64; forced by user)"
    else: # 'auto' mode
        # Check if all text files are consistently utf-16le
        text_files = [f for f in file_objects if not f.get("is_binary")]
        if text_files and all(f["encoding"] == 'utf-16le' for f in text_files):
            primary_text_encoding = 'utf-16le'
            final_bundle_format_header = 'Raw UTF-16LE'
            bundle_description_suffix = " (Auto-Detected UTF-16LE for text; binaries as Base64)"
        else: # Default to UTF-8 for text in auto mode
            primary_text_encoding = 'utf-8'
            final_bundle_format_header = 'Raw UTF-8'
            bundle_description_suffix = " (Auto-Detected UTF-8 for text; binaries as Base64)"
            if any(f.get("is_binary") for f in file_objects):
                bundle_description_suffix += " - Mixed content found"
            elif not text_files and any(f.get("is_binary") for f in file_objects): # Only binaries
                 final_bundle_format_header = 'Base64' # No text, so header can be Base64
                 bundle_description_suffix = " (Only binary files found, bundled as Base64)"


    format_description = f"{final_bundle_format_header}{bundle_description_suffix}"
    bundle_parts.append(BUNDLE_HEADER_PREFIX)
    bundle_parts.append(f"{BUNDLE_FORMAT_PREFIX}{format_description}")
    output_encoding_error_handler = 'replace'

    for file_obj in file_objects:
        content_bytes = file_obj["content_bytes"]
        assert isinstance(content_bytes, bytes), "File content must be bytes"
        
        file_is_binary = file_obj.get("is_binary", False)
        content_to_write = ""
        marker_hint = ""

        try:
            if encoding_mode == 'b64' or (file_is_binary and encoding_mode != 'b64'): # Always b64 if forced, or if binary and not b64 forced globally
                content_to_write = base64.b64encode(content_bytes).decode('ascii')
                if encoding_mode != 'b64': # Add hint only if not globally b64
                    marker_hint = BASE64_CONTENT_MARKER + " " # Trailing space for template
            else: # Text file processing based on primary_text_encoding
                source_encoding = file_obj["encoding"] or DEFAULT_ENCODING # Fallback for safety
                if source_encoding == primary_text_encoding:
                    content_to_write = content_bytes.decode(primary_text_encoding, errors=output_encoding_error_handler)
                else: # Need to transcode
                    decoded_text = content_bytes.decode(source_encoding, errors=output_encoding_error_handler)
                    content_to_write = decoded_text # Already decoded, will be written as string
        except Exception as e:
             # Fallback to Base64 for this file if any error occurs during text processing
             print(f"  Warning: Error processing file '{file_obj['relative_path']}' for bundle. Falling back to Base64. Error: {e}", file=sys.stderr)
             content_to_write = base64.b64encode(content_bytes).decode('ascii')
             if encoding_mode != 'b64': marker_hint = BASE64_CONTENT_MARKER + " "

        bundle_parts.append("")
        bundle_parts.append(
            FILE_START_MARKER_TEMPLATE.format(str(file_obj["relative_path"]), marker_hint)
        )
        bundle_parts.append(content_to_write)
        if not content_to_write.endswith('\n') and not marker_hint and encoding_mode != 'b64':
            bundle_parts.append("") # Add a newline for text files if missing
        bundle_parts.append(FILE_END_MARKER)

    return "\n".join(bundle_parts) + "\n", format_description


def create_bundle_from_paths(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    encoding_mode: str = 'auto', 
    use_default_excludes: bool = True,
    output_file_abs_path: Optional[str] = None,
    sys_human_abs_realpath_to_include: Optional[str] = None,
    original_user_paths: Optional[List[str]] = None,
) -> Tuple[str, str, int]:

    sys_human_file_object_for_bundling: Optional[FileObject] = None
    if sys_human_abs_realpath_to_include:
        sys_human_ancestor = os.path.dirname(sys_human_abs_realpath_to_include) or os.getcwd()
        sys_human_file_object_for_bundling = prepare_file_object(sys_human_abs_realpath_to_include, sys_human_ancestor)
        if sys_human_file_object_for_bundling:
             sys_human_file_object_for_bundling['relative_path'] = os.path.basename(sys_human_abs_realpath_to_include)

    other_abs_file_paths_to_bundle = get_final_paths_to_process(
        include_paths_raw, exclude_paths_raw, use_default_excludes,
        output_file_abs_path, sys_human_abs_realpath_to_include, original_user_paths
    )

    paths_for_ancestor_calc = other_abs_file_paths_to_bundle
    if not paths_for_ancestor_calc and sys_human_file_object_for_bundling:
         common_ancestor = os.path.dirname(str(sys_human_file_object_for_bundling['path']))
    elif not paths_for_ancestor_calc:
        common_ancestor = os.getcwd()
    else:
         common_ancestor = find_common_ancestor(paths_for_ancestor_calc)

    other_file_objects = prepare_file_objects_from_paths(other_abs_file_paths_to_bundle, common_ancestor)

    final_file_objects: List[FileObject] = []
    if sys_human_file_object_for_bundling: final_file_objects.append(sys_human_file_object_for_bundling)
    final_file_objects.extend(other_file_objects)

    if not final_file_objects: return "", "No files selected", 0

    bundle_content, format_desc = create_bundle_string_from_objects(final_file_objects, encoding_mode)
    return bundle_content, format_desc, len(final_file_objects)


def confirm_action_prompt(prompt_message: str) -> bool:
    if not sys.stdin.isatty():
        print("  Non-interactive mode detected. Proceeding automatically.", file=sys.stderr)
        return True
    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "": return True
            if choice == "n": return False
            print("Invalid input. Please enter 'y' or 'n'.", file=sys.stderr)
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.", file=sys.stderr)
            return False


def main_cli():
    parser = argparse.ArgumentParser(
        description="cats.py : Bundles project files into a single text artifact for LLMs.",
        epilog="Example: python cats.py ./src ./assets -E auto -o my_project.bundle",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("paths", nargs="+", metavar="PATH", help="Files/directories to include.")
    parser.add_argument("-o", "--output", default=None, metavar="BUNDLE_FILE", help=f"Output bundle file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout.")
    parser.add_argument("-x", "--exclude", action="append", default=[], metavar="EXCLUDE_PATH", help="Path to exclude. Use multiple times.")
    parser.add_argument("-N", "--no-default-excludes", action="store_false", dest="use_default_excludes", help=f"Disable default excludes: {', '.join(DEFAULT_EXCLUDES)}.")
    parser.add_argument(
        "-E", "--force-encoding", choices=['auto', 'utf8', 'utf16le', 'b64'], default='auto', metavar="MODE", 
        help=(
            "Bundle encoding strategy:\n"
            "  auto (default): Text as UTF-8 (or UTF-16LE if all text is such), binaries as Base64 marked blocks.\n"
            "  utf8/utf16le: Text conforms to this; binaries as Base64 marked blocks.\n"
            "  b64: All files (text and binary) are Base64 encoded."
        )
    )
    parser.add_argument("-y", "--yes", action="store_true", help="Automatically confirm and proceed without prompting.")
    parser.add_argument("--no-sys-prompt", action="store_true", help=f"Do not prepend '{SYS_PROMPT_FILENAME}' found near script.")
    parser.add_argument("--require-sys-prompt", action="store_true", help=f"Exit if '{SYS_PROMPT_FILENAME}' for prepending is not found.")
    parser.set_defaults(use_default_excludes=True)

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
    args = parser.parse_args()

    output_file_handle = None
    actual_output_stream = sys.stdout
    abs_output_file_realpath_for_bundle_logic: Optional[str] = None
    output_target_display_name = "stdout"

    if args.output and args.output != '-':
        abs_output_file_realpath_for_bundle_logic = os.path.realpath(os.path.abspath(args.output))
        output_target_display_name = abs_output_file_realpath_for_bundle_logic
    elif args.output is None: # Default to DEFAULT_OUTPUT_FILENAME
        args.output = DEFAULT_OUTPUT_FILENAME
        abs_output_file_realpath_for_bundle_logic = os.path.realpath(os.path.abspath(args.output))
        output_target_display_name = abs_output_file_realpath_for_bundle_logic
    
    if abs_output_file_realpath_for_bundle_logic: # If writing to a file
        try:
            output_parent_dir = os.path.dirname(abs_output_file_realpath_for_bundle_logic)
            if output_parent_dir: os.makedirs(output_parent_dir, exist_ok=True)
            # Write directly in binary mode to handle all encodings correctly from bundle string
            output_file_handle = open(abs_output_file_realpath_for_bundle_logic, "wb")
            # actual_output_stream is not used for file writing directly, bundle string is prepared then written
        except Exception as e:
            print(f"Fatal: Could not open output file '{abs_output_file_realpath_for_bundle_logic}': {e}", file=sys.stderr)
            sys.exit(1)

    prepended_prompt_bytes = b""
    sys_prompt_prepended_successfully = False
    if not args.no_sys_prompt:
        sys_prompt_path = find_sys_prompt_path_for_prepending()
        if sys_prompt_path:
            try:
                with open(sys_prompt_path, "rb") as f_prompt: # Read as bytes
                    prompt_content_bytes = f_prompt.read()
                # Ensure it's UTF-8 for this specific part (system prompt itself)
                prompt_content_str = prompt_content_bytes.decode('utf-8', errors='replace')
                prepended_prompt_bytes = (prompt_content_str.rstrip('\n') + '\n' + SYS_PROMPT_POST_SEPARATOR).encode('utf-8')
                sys_prompt_prepended_successfully = True
                print(f"  Prepended system prompt from: {sys_prompt_path}", file=sys.stderr)
            except Exception as e:
                msg = f"Warning: Could not read/process system prompt '{SYS_PROMPT_FILENAME}' from {sys_prompt_path}: {e}"
                print(msg, file=sys.stderr)
                if args.require_sys_prompt:
                    print("Exiting due to --require-sys-prompt.", file=sys.stderr)
                    if output_file_handle: output_file_handle.close()
                    sys.exit(1)
        elif args.require_sys_prompt:
            print(f"Error: System prompt '{SYS_PROMPT_FILENAME}' not found and --require-sys-prompt was specified.", file=sys.stderr)
            if output_file_handle: output_file_handle.close()
            sys.exit(1)
        else:
            print(f"Info: System prompt '{SYS_PROMPT_FILENAME}' for prepending not found.", file=sys.stderr)

    sys_human_realpath_for_bundling_as_file: Optional[str] = None
    potential_sys_human_cwd_path = os.path.abspath(SYS_PROMPT_FILENAME)
    if os.path.isfile(potential_sys_human_cwd_path):
        temp_sys_human_realpath = os.path.realpath(potential_sys_human_cwd_path)
        is_excluded = any(
            temp_sys_human_realpath == os.path.realpath(os.path.abspath(excl_raw)) or
            (os.path.isdir(os.path.realpath(os.path.abspath(excl_raw))) and temp_sys_human_realpath.startswith(os.path.realpath(os.path.abspath(excl_raw)) + os.path.sep))
            for excl_raw in args.exclude if os.path.exists(excl_raw)
        )
        if not is_excluded and args.use_default_excludes:
            is_excluded = any(
                temp_sys_human_realpath == os.path.realpath(os.path.join(os.getcwd(), default_excl_name)) or
                (os.path.isdir(os.path.realpath(os.path.join(os.getcwd(), default_excl_name))) and temp_sys_human_realpath.startswith(os.path.realpath(os.path.join(os.getcwd(), default_excl_name)) + os.path.sep))
                for default_excl_name in DEFAULT_EXCLUDES if os.path.exists(os.path.join(os.getcwd(), default_excl_name))
            )
        if not is_excluded:
            sys_human_realpath_for_bundling_as_file = temp_sys_human_realpath
            print(f"  Convention: Found '{SYS_PROMPT_FILENAME}' in CWD. Will include it as the first file *within* the bundle.", file=sys.stderr)
        elif is_excluded :
             print(f"  Info: '{SYS_PROMPT_FILENAME}' found in CWD but is excluded. Not bundling as a file.", file=sys.stderr)


    print("Phase 1: Collecting and filtering files...", file=sys.stderr)
    bundle_content_string, format_description, files_added_count = create_bundle_from_paths(
        args.paths, args.exclude, args.force_encoding, args.use_default_excludes,
        abs_output_file_realpath_for_bundle_logic, sys_human_realpath_for_bundling_as_file, args.paths
    )

    if files_added_count == 0 and not sys_prompt_prepended_successfully:
        print(f"No files selected, system prompt not prepended. {format_description}. Exiting.", file=sys.stderr)
        if output_file_handle: output_file_handle.close()
        if abs_output_file_realpath_for_bundle_logic and os.path.exists(abs_output_file_realpath_for_bundle_logic) and os.path.getsize(abs_output_file_realpath_for_bundle_logic) == 0:
            try: os.remove(abs_output_file_realpath_for_bundle_logic)
            except OSError: pass
        sys.exit(0)

    if files_added_count > 0:
        print(f"  Files to be included in bundle: {files_added_count}", file=sys.stderr)
        print(f"  Bundle format determined: {format_description.split('(')[0].strip()}", file=sys.stderr)
        if args.force_encoding != 'auto': print(f"  (Encoding strategy: {args.force_encoding})", file=sys.stderr)

    proceed = args.yes
    if not proceed and (files_added_count > 0 or sys_prompt_prepended_successfully):
        print(f"\n  Output will be written to: {output_target_display_name}", file=sys.stderr)
        proceed = confirm_action_prompt("Proceed with writing output?")

    if not proceed:
        print("Operation cancelled.", file=sys.stderr)
        if output_file_handle: output_file_handle.close()
        # Cleanup if only prompt was written and then cancelled.
        if abs_output_file_realpath_for_bundle_logic and sys_prompt_prepended_successfully and files_added_count == 0:
            if os.path.exists(abs_output_file_realpath_for_bundle_logic):
                try:
                    # Check if only the prompt was written
                    with open(abs_output_file_realpath_for_bundle_logic, "rb") as f_check:
                        content_check_bytes = f_check.read()
                    if prepended_prompt_bytes == content_check_bytes: # More robust check
                         os.remove(abs_output_file_realpath_for_bundle_logic)
                         print(f"  Removed partially written file: {abs_output_file_realpath_for_bundle_logic}", file=sys.stderr)
                except Exception: pass
        sys.exit(0)

    # Determine encoding for writing the bundle string itself (usually UTF-8)
    # The bundle_content_string contains text, some of which might be Base64 representations
    # The string itself should be UTF-8 encoded when written to a file or stdout.
    bundle_bytes_to_write = bundle_content_string.encode(DEFAULT_ENCODING, errors='replace')
    full_output_bytes = prepended_prompt_bytes + bundle_bytes_to_write if files_added_count > 0 else prepended_prompt_bytes

    if output_file_handle: # Writing to file
        print(f"\nPhase 2: Writing bundle to '{output_target_display_name}'...", file=sys.stderr)
        output_file_handle.write(full_output_bytes)
        output_file_handle.close()
        print(f"\nOutput successfully written to: '{output_target_display_name}'", file=sys.stderr)
    else: # Writing to stdout
        print(f"\nPhase 2: Writing bundle to stdout...", file=sys.stderr)
        sys.stdout.buffer.write(full_output_bytes) # Write bytes to stdout
        sys.stdout.flush()
        print(f"\nOutput successfully written to stdout.", file=sys.stderr)
    
    if sys_prompt_prepended_successfully: print(f"  System prompt was prepended.", file=sys.stderr)
    if files_added_count > 0: print(f"  Files added to bundle: {files_added_count}. Format: {format_description}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main_cli()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        print("\nOperation cancelled by user (KeyboardInterrupt).", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nAn unexpected critical error occurred in main: {e}", file=sys.stderr)
        # import traceback
        # traceback.print_exc(file=sys.stderr) # Uncomment for debugging
        sys.exit(1)
