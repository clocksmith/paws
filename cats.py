#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import argparse
import base64
from typing import List, Tuple, Dict, Optional, Union, Any

# --- START: Added for sys_human.txt prepending ---
SYS_PROMPT_FILENAME = "sys_human.txt" # Name of the system prompt file to prepend
SYS_PROMPT_POST_SEPARATOR = """
--- END OF SYSTEM PROMPT ---
The following content is the Cats Bundle.
"""
# --- END: Added for sys_human.txt prepending ---

FILE_START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {} ---"
FILE_END_MARKER = "🐈 --- CATS_END_FILE ---"
DEFAULT_ENCODING = "utf-8" # Default *text* encoding
DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DEFAULT_EXCLUDES = ['.git', 'node_modules', 'gem', '__pycache__']


FileObject = Dict[str, Union[str, bytes, bool, Optional[str]]]


# --- START: Added for sys_human.txt prepending ---
def find_sys_prompt_path_for_prepending() -> Optional[str]:
    """
    Locates the system prompt file (e.g., sys_human.txt) for prepending.
    Searches first in the script's directory, then one directory level up.
    Returns the absolute real path if found, otherwise None.
    """
    # Determine script's actual directory, resolving symlinks
    try:
        script_dir = os.path.dirname(os.path.realpath(os.path.abspath(__file__)))
    except NameError: # __file__ not defined (e.g. interactive, or frozen)
        script_dir = os.getcwd() # Fallback
    
    # Check for sys_human.txt alongside the script
    sibling_path = os.path.join(script_dir, SYS_PROMPT_FILENAME)
    if os.path.exists(sibling_path) and os.path.isfile(sibling_path):
        return os.path.realpath(sibling_path)
        
    # Check for sys_human.txt one directory level up from the script
    parent_dir = os.path.dirname(script_dir)
    one_level_up_path = os.path.join(parent_dir, SYS_PROMPT_FILENAME)
    if os.path.exists(one_level_up_path) and os.path.isfile(one_level_up_path):
        return os.path.realpath(one_level_up_path)
        
    return None
# --- END: Added for sys_human.txt prepending ---


def detect_text_encoding(file_content_bytes: bytes) -> Optional[str]:
    """Checks if content is likely UTF-8 or UTF-16LE."""
    if not file_content_bytes:
        return DEFAULT_ENCODING 
    try:
        file_content_bytes.decode(DEFAULT_ENCODING)
        return DEFAULT_ENCODING
    except UnicodeDecodeError:
        try:
            if file_content_bytes.startswith(b'\xff\xfe') or file_content_bytes.startswith(b'\xfe\xff'):
                 try:
                      file_content_bytes.decode('utf-16')
                      return 'utf-16le' 
                 except UnicodeDecodeError:
                      return None 

            file_content_bytes.decode('utf-16le')
            return 'utf-16le'
        except UnicodeDecodeError:
            return None


def get_final_paths_to_process(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    use_default_excludes: bool,
    output_file_abs_path: Optional[str] = None,
    sys_human_abs_realpath_to_ignore: Optional[str] = None, # for bundling as a file
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
        os.path.realpath(os.path.abspath(p)) for p in all_exclude_paths
    }

    # This is for when sys_human.txt is bundled as a regular file, distinct from prepending
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
        # This check is if sys_human.txt is provided as a path argument and also handled by the 
        # sys_human_abs_realpath_to_ignore (meaning it's already being handled as a special first bundled file)
        if incl_path_raw == SYS_PROMPT_FILENAME and sys_human_abs_realpath_to_ignore and \
           os.path.realpath(os.path.abspath(incl_path_raw)) == sys_human_abs_realpath_to_ignore:
             continue
        try:
            abs_incl_path = os.path.abspath(incl_path_raw)
            current_input_realpath = os.path.realpath(abs_incl_path)
            if current_input_realpath == sys_human_abs_realpath_to_ignore: # Special handling for bundled sys_human.txt
                continue
        except OSError:
            current_input_realpath = os.path.abspath(incl_path_raw) # Use abspath if realpath fails (e.g. broken symlink)
            if not os.path.lexists(current_input_realpath): # Check with lexists for symlinks
                 if incl_path_raw in paths_to_check_for_warnings:
                     print(
                         f"  Warning: Input path '{incl_path_raw}' not found. Skipping.",
                         file=sys.stderr,
                     )
                 continue

        if current_input_realpath in processed_top_level_input_realpaths:
             if incl_path_raw in paths_to_check_for_warnings: # Only skip if it was a user-provided duplicate
                 continue
        processed_top_level_input_realpaths.add(current_input_realpath)

        if output_file_abs_path and current_input_realpath == output_file_abs_path:
            continue
        if current_input_realpath in abs_excluded_realpaths_set:
            continue

        is_inside_excluded_dir = any(
            current_input_realpath == excluded_dir_rp or # It is the excluded dir
            current_input_realpath.startswith(excluded_dir_rp + os.path.sep) # It's inside an excluded dir
            for excluded_dir_rp in abs_excluded_dirs_for_pruning_set
        )
        if is_inside_excluded_dir:
            continue

        if not os.path.lexists(current_input_realpath): # Use lexists for initial check before os.walk
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
                current_input_realpath, topdown=True, followlinks=False # Process symlinks to dirs as dirs, but not files they point to unless explicitly listed
            ):
                current_walk_dir_realpath = os.path.realpath(dirpath)

                dirs_to_remove = []
                for d_name in dirnames:
                    dir_realpath_in_walk = os.path.realpath(
                        os.path.join(current_walk_dir_realpath, d_name)
                    )
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
                        continue # Skip if realpath fails (e.g. broken symlink during walk)

                    if (
                        (output_file_abs_path and file_realpath_in_walk == output_file_abs_path)
                        or (file_realpath_in_walk in abs_excluded_realpaths_set)
                        or any(
                            file_realpath_in_walk.startswith(ex_dir + os.path.sep)
                            for ex_dir in abs_excluded_dirs_for_pruning_set
                        )
                    ):
                        continue

                    if os.path.isfile(file_realpath_in_walk): # Ensure it's a file after resolving symlinks
                        candidate_file_realpaths.add(file_realpath_in_walk)

    return sorted(list(candidate_file_realpaths))


def generate_bundle_relative_path(file_realpath: str, common_ancestor_path: str) -> str:
    try:
        if common_ancestor_path == file_realpath and os.path.isfile(file_realpath):
            return os.path.basename(file_realpath)
        # If common_ancestor is the dir containing the file
        if common_ancestor_path == os.path.dirname(file_realpath) and os.path.isfile(file_realpath):
           return os.path.basename(file_realpath)
        # If file is inside common_ancestor_path (which is a dir)
        if os.path.isdir(common_ancestor_path) and file_realpath.startswith(
             os.path.abspath(common_ancestor_path) + os.path.sep # Ensure trailing sep for robust startswith
         ):
            rel_path = os.path.relpath(file_realpath, common_ancestor_path)
        else: # Fallback if not directly under, or common_ancestor_path is a file itself (unlikely for common ancestor)
             # This case might happen if common_ancestor logic leads to unexpected results.
             # Defaulting to basename might be safer than complex os.path.relpath from potentially unrelated paths.
             rel_path = os.path.relpath(file_realpath, common_ancestor_path) # Try relpath anyway

        if rel_path == ".": # relpath can return "." if paths are the same
            return os.path.basename(file_realpath)
    except ValueError: # relpath can raise ValueError if paths are on different drives (Windows)
        rel_path = os.path.basename(file_realpath) # Fallback to basename

    return rel_path.replace(os.path.sep, "/") # Ensure POSIX-style separators


def find_common_ancestor(paths: List[str]) -> str:
    if not paths: return os.getcwd()
    real_paths = []
    for p in paths:
        try:
            abs_p = os.path.abspath(p)
            if os.path.exists(abs_p) or os.path.islink(abs_p): # Check symlinks too
                 real_paths.append(os.path.realpath(abs_p))
        except OSError: continue # Path might be invalid
    if not real_paths: return os.getcwd()

    if len(real_paths) == 1:
        # If single path, common ancestor is its directory if it's a file, or itself if it's a dir
        return (
            os.path.dirname(real_paths[0])
            if os.path.isfile(real_paths[0])
            else real_paths[0]
        )

    # os.path.commonpath needs a list of paths. For files, use their parent dirs.
    paths_for_commonpath = []
    for p_rp in real_paths:
         try:
             if os.path.isdir(p_rp): paths_for_commonpath.append(p_rp)
             elif os.path.isfile(p_rp): paths_for_commonpath.append(os.path.dirname(p_rp))
         except OSError: continue # Should not happen with realpaths
    if not paths_for_commonpath: return os.getcwd() # All paths were invalid or inaccessible

    try:
         common = os.path.commonpath(paths_for_commonpath)
         # commonpath might return a path that is part of a filename if all paths are files in the same dir.
         # Ensure it's a directory.
         if len(set(paths_for_commonpath)) > 1 and (not os.path.isdir(common)): # If multiple distinct parent dirs
             common = os.path.dirname(common)
         return common if common else os.getcwd() # Fallback to CWD if common is empty
    except ValueError: # commonpath can raise ValueError if paths are on different drives (Windows)
        return os.getcwd() # Fallback for cross-drive scenarios


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
            "encoding": detected_encoding,
            "is_utf8": detected_encoding == 'utf-8' # Kept for compatibility, but 'encoding' is primary
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
    encoding_mode: str,
) -> Tuple[str, str]:
    bundle_parts = []
    final_bundle_format = 'Raw UTF-8'
    final_encoding_for_write = 'utf-8'

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
        has_binary = any(f["encoding"] is None for f in file_objects)
        has_utf16 = any(f["encoding"] == 'utf-16le' for f in file_objects)

        if has_binary:
            final_bundle_format = 'Base64'
            final_encoding_for_write = 'base64'
        elif has_utf16:
            final_bundle_format = 'Raw UTF-16LE'
            final_encoding_for_write = 'utf-16le'
        else: 
            final_bundle_format = 'Raw UTF-8'
            final_encoding_for_write = 'utf-8'
    else: 
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

    output_encoding_error_handler = 'replace' 

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
                # Ensure content can be decoded as the source encoding before re-encoding
                # This is tricky; the original file object already has 'encoding' detected.
                # If final_bundle_format is utf-16le, we assume content_bytes IS utf-16le or compatible
                if file_obj['encoding'] == 'utf-16le' or file_obj['encoding'] is None: # None means binary, try to decode
                    content_to_write = content_bytes.decode('utf-16le', errors=output_encoding_error_handler)
                elif file_obj['encoding'] == 'utf-8': # Convert from UTF-8 to UTF-16LE
                    content_to_write = content_bytes.decode('utf-8').encode('utf-16le').decode('utf-16le', errors=output_encoding_error_handler)
                else: # Fallback for unknown original encoding
                    content_to_write = content_bytes.decode(file_obj['encoding'] or 'latin-1', errors=output_encoding_error_handler)

            else: # utf-8
                if file_obj['encoding'] == 'utf-8' or file_obj['encoding'] is None:
                     content_to_write = content_bytes.decode('utf-8', errors=output_encoding_error_handler)
                elif file_obj['encoding'] == 'utf-16le': # Convert from UTF-16LE to UTF-8
                     content_to_write = content_bytes.decode('utf-16le').encode('utf-8').decode('utf-8', errors=output_encoding_error_handler)
                else: # Fallback
                     content_to_write = content_bytes.decode(file_obj['encoding'] or 'latin-1', errors=output_encoding_error_handler)

        except Exception as e:
             print(f"  Warning: Error encoding file '{file_obj['relative_path']}' for bundle format '{final_bundle_format}'. Falling back to Base64 for this file. Error: {e}", file=sys.stderr)
             content_to_write = base64.b64encode(content_bytes).decode('ascii')

        bundle_parts.append(content_to_write)
        if not content_to_write.endswith('\n') and final_encoding_for_write != 'base64':
            bundle_parts.append("") # Add a newline if missing, unless base64
        bundle_parts.append(FILE_END_MARKER)

    return "\n".join(bundle_parts) + "\n", format_description


def create_bundle_from_paths(
    include_paths_raw: List[str],
    exclude_paths_raw: List[str],
    encoding_mode: str = 'auto', 
    use_default_excludes: bool = True,
    output_file_abs_path: Optional[str] = None,
    sys_human_abs_realpath_to_include: Optional[str] = None, # For bundling as a file
    original_user_paths: Optional[List[str]] = None,
) -> Tuple[str, str, int]:

    sys_human_file_object_for_bundling: Optional[FileObject] = None
    # This prepares sys_human.txt IF it's meant to be the first *bundled file*
    if sys_human_abs_realpath_to_include:
        # common_ancestor for sys_human.txt bundled as a file should be CWD or its actual dir
        # to avoid overly complex relative paths like ../../../sys_human.txt
        sys_human_ancestor = os.path.dirname(sys_human_abs_realpath_to_include) or os.getcwd()
        sys_human_file_object_for_bundling = prepare_file_object(sys_human_abs_realpath_to_include, sys_human_ancestor)
        if sys_human_file_object_for_bundling:
             # Ensure its relative path is just its name for this special inclusion
             sys_human_file_object_for_bundling['relative_path'] = os.path.basename(sys_human_abs_realpath_to_include)


    other_abs_file_paths_to_bundle = get_final_paths_to_process(
        include_paths_raw,
        exclude_paths_raw,
        use_default_excludes,
        output_file_abs_path,
        sys_human_abs_realpath_to_ignore=sys_human_abs_realpath_to_include, # Prevent double-add if also in paths
        original_user_paths=original_user_paths
    )

    # Determine common ancestor based on *other* files first
    paths_for_ancestor_calc = other_abs_file_paths_to_bundle
    if not paths_for_ancestor_calc: # If only sys_human.txt is being bundled (as a file)
         common_ancestor = os.getcwd() # Or dirname of sys_human_file_object_for_bundling['path']
         if sys_human_file_object_for_bundling:
             common_ancestor = os.path.dirname(sys_human_file_object_for_bundling['path'])
    else:
         common_ancestor = find_common_ancestor(paths_for_ancestor_calc)

    other_file_objects = prepare_file_objects_from_paths(
        other_abs_file_paths_to_bundle, common_ancestor
    )

    final_file_objects: List[FileObject] = []
    if sys_human_file_object_for_bundling:
        final_file_objects.append(sys_human_file_object_for_bundling)
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
        except EOFError: # Happens if input is piped and ends
            print("\nOperation cancelled (EOF detected). Defaulting to No.")
            return False


def main_cli():
    parser = argparse.ArgumentParser(
        description="cats.py : Bundles project files into a single text artifact for LLMs.",
        epilog="Example: python cats.py ./src -x ./tests -N -E utf8 -o my_project.bundle",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("paths", nargs="+", metavar="PATH", help="Files/directories to include.")
    parser.add_argument("-o", "--output", default=None, metavar="BUNDLE_FILE", help=f"Output bundle file (default: {DEFAULT_OUTPUT_FILENAME} if not stdout). If '-', output to stdout.")
    parser.add_argument("-x", "--exclude", action="append", default=[], metavar="EXCLUDE_PATH", help="Path to exclude (file or directory). Use multiple times. Added to defaults.")
    parser.add_argument("-N", "--no-default-excludes", action="store_false", dest="use_default_excludes", help=f"Disable default excludes: {', '.join(DEFAULT_EXCLUDES)}.")
    parser.add_argument("-E", "--force-encoding", choices=['auto', 'utf8', 'utf16le', 'b64'], default='auto', metavar="MODE", help="Force bundle encoding: auto (default), utf8, utf16le, b64.")
    parser.add_argument("-y", "--yes", action="store_true", help="Automatically confirm and proceed without prompting.")
    # --- START: Args for sys_human.txt prepending ---
    parser.add_argument(
        "--no-sys-prompt",
        action="store_true",
        help=f"Do not prepend the '{SYS_PROMPT_FILENAME}' system prompt found near the script."
    )
    parser.add_argument(
        "--require-sys-prompt",
        action="store_true",
        help=(
            f"If prepending '{SYS_PROMPT_FILENAME}' is attempted (default behavior) and the file\n"
            "is not found or readable, exit with an error. Otherwise, a warning is issued."
        )
    )
    # --- END: Args for sys_human.txt prepending ---
    parser.set_defaults(use_default_excludes=True)

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
    args = parser.parse_args()

    output_file_handle = None
    actual_output_stream = sys.stdout
    abs_output_file_realpath_for_bundle_logic: Optional[str] = None # For self-exclusion by create_bundle_from_paths

    # Determine output target
    output_target_display_name = "stdout"
    if args.output and args.output != '-':
        abs_output_file_realpath_for_bundle_logic = os.path.realpath(os.path.abspath(args.output))
        output_target_display_name = abs_output_file_realpath_for_bundle_logic
        try:
            output_parent_dir = os.path.dirname(abs_output_file_realpath_for_bundle_logic)
            if output_parent_dir and not os.path.exists(output_parent_dir):
                os.makedirs(output_parent_dir, exist_ok=True)
            output_file_handle = open(abs_output_file_realpath_for_bundle_logic, "w", encoding=DEFAULT_ENCODING, errors="replace")
            actual_output_stream = output_file_handle
        except Exception as e:
            print(f"Fatal error: Could not open output file '{abs_output_file_realpath_for_bundle_logic}': {e}", file=sys.stderr)
            sys.exit(1)
    elif args.output is None: # Default to DEFAULT_OUTPUT_FILENAME if no -o and not stdout
        args.output = DEFAULT_OUTPUT_FILENAME
        abs_output_file_realpath_for_bundle_logic = os.path.realpath(os.path.abspath(args.output))
        output_target_display_name = abs_output_file_realpath_for_bundle_logic
        try:
            output_parent_dir = os.path.dirname(abs_output_file_realpath_for_bundle_logic)
            if output_parent_dir and not os.path.exists(output_parent_dir):
                os.makedirs(output_parent_dir, exist_ok=True)
            output_file_handle = open(abs_output_file_realpath_for_bundle_logic, "w", encoding=DEFAULT_ENCODING, errors="replace")
            actual_output_stream = output_file_handle
        except Exception as e:
            print(f"Fatal error: Could not open output file '{abs_output_file_realpath_for_bundle_logic}': {e}", file=sys.stderr)
            sys.exit(1)


    # --- START: Logic for prepending sys_human.txt ---
    sys_prompt_prepended_successfully = False
    if not args.no_sys_prompt:
        sys_prompt_path_to_prepend = find_sys_prompt_path_for_prepending()
        if sys_prompt_path_to_prepend:
            try:
                with open(sys_prompt_path_to_prepend, "r", encoding="utf-8") as f_prompt:
                    prompt_content = f_prompt.read()
                actual_output_stream.write(prompt_content.rstrip('\n') + '\n') # Ensure single newline
                actual_output_stream.write(SYS_PROMPT_POST_SEPARATOR)
                sys_prompt_prepended_successfully = True
                print(f"  Prepended system prompt from: {sys_prompt_path_to_prepend}", file=sys.stderr)
            except Exception as e:
                msg = f"Warning: Could not read system prompt '{SYS_PROMPT_FILENAME}' from {sys_prompt_path_to_prepend} for prepending: {e}"
                print(msg, file=sys.stderr)
                if args.require_sys_prompt:
                    print("Exiting due to --require-sys-prompt.", file=sys.stderr)
                    if output_file_handle: output_file_handle.close()
                    sys.exit(1)
        else:
            if args.require_sys_prompt:
                print(f"Error: System prompt '{SYS_PROMPT_FILENAME}' for prepending not found and --require-sys-prompt was specified. Exiting.", file=sys.stderr)
                if output_file_handle: output_file_handle.close()
                sys.exit(1)
            else:
                print(f"Info: System prompt '{SYS_PROMPT_FILENAME}' for prepending not found. Proceeding without it.", file=sys.stderr)
    # --- END: Logic for prepending sys_human.txt ---

    # This section is for including sys_human.txt as a *bundled file* (original behavior)
    sys_human_realpath_for_bundling_as_file: Optional[str] = None
    sys_human_path_for_file_bundling = SYS_PROMPT_FILENAME # Consistent name
    
    # Check if a file named SYS_PROMPT_FILENAME exists in CWD and should be bundled as a file
    # This is distinct from the prepended prompt which is searched near the script
    potential_sys_human_for_bundling_abs_path = os.path.abspath(sys_human_path_for_file_bundling)
    if os.path.isfile(potential_sys_human_for_bundling_abs_path):
        temp_sys_human_realpath = os.path.realpath(potential_sys_human_for_bundling_abs_path)
        is_excluded = False
        # Check against manual excludes
        for excl_raw in args.exclude:
             try:
                 excl_abs = os.path.abspath(excl_raw)
                 excl_real = os.path.realpath(excl_abs)
                 if temp_sys_human_realpath == excl_real: is_excluded = True; break
                 if os.path.isdir(excl_real) and temp_sys_human_realpath.startswith(excl_real + os.path.sep): is_excluded = True; break
             except OSError: pass
        # Check against default excludes if active
        if not is_excluded and args.use_default_excludes:
             for default_excl_name in DEFAULT_EXCLUDES:
                  try:
                      default_excl_path_in_cwd = os.path.join(os.getcwd(), default_excl_name)
                      if os.path.exists(default_excl_path_in_cwd):
                           excl_real = os.path.realpath(default_excl_path_in_cwd)
                           if temp_sys_human_realpath == excl_real: is_excluded = True; break
                           if os.path.isdir(excl_real) and temp_sys_human_realpath.startswith(excl_real + os.path.sep): is_excluded = True; break
                  except OSError: pass
        
        if is_excluded:
             print(f"  Info: '{sys_human_path_for_file_bundling}' found in CWD but is excluded by rule. Not bundling as a file.", file=sys.stderr)
        else:
             sys_human_realpath_for_bundling_as_file = temp_sys_human_realpath
             print(f"  Convention: Found '{sys_human_path_for_file_bundling}' in CWD. Will include it as the first file *within* the bundle.", file=sys.stderr)


    print("Phase 1: Collecting and filtering files for bundle content...", file=sys.stderr)
    bundle_content_string, format_description, files_added_count = create_bundle_from_paths(
        include_paths_raw=args.paths,
        exclude_paths_raw=args.exclude,
        encoding_mode=args.force_encoding,
        use_default_excludes=args.use_default_excludes,
        output_file_abs_path=abs_output_file_realpath_for_bundle_logic, # For self-exclusion from bundle content
        sys_human_abs_realpath_to_include=sys_human_realpath_for_bundling_as_file, # For bundling as first file
        original_user_paths=args.paths
    )

    if files_added_count == 0 and not sys_prompt_prepended_successfully:
        print(f"No files selected for bundling, and system prompt was not prepended. {format_description}. Exiting.", file=sys.stderr)
        if output_file_handle: output_file_handle.close()
        # If output was a file and it's now empty (only prompt was written and then removed, or nothing written), delete it.
        if abs_output_file_realpath_for_bundle_logic and os.path.exists(abs_output_file_realpath_for_bundle_logic) and os.path.getsize(abs_output_file_realpath_for_bundle_logic) == 0:
            try: os.remove(abs_output_file_realpath_for_bundle_logic)
            except OSError: pass
        sys.exit(0) # Not an error if sys prompt was written, or if no files truly selected

    if files_added_count > 0 :
        print(f"  Files to be included in bundle content: {files_added_count}", file=sys.stderr)
        print(f"  Bundle content format determined: {format_description.split('(')[0].strip()}", file=sys.stderr)
        if args.force_encoding != 'auto':
            print(f"  (Bundle content encoding forced by user: {args.force_encoding})", file=sys.stderr)

    proceed = args.yes
    if not proceed and (files_added_count > 0 or sys_prompt_prepended_successfully ): # Only prompt if there's something to write
        print(f"\n  Output will be written to: {output_target_display_name}", file=sys.stderr)
        proceed = confirm_action_prompt("Proceed with writing output?")

    if not proceed:
        print("Operation cancelled by user.", file=sys.stderr)
        if output_file_handle: output_file_handle.close()
        # If we were writing to a file and cancelled, and only prompt was written, remove file.
        if abs_output_file_realpath_for_bundle_logic and sys_prompt_prepended_successfully and files_added_count == 0:
            if os.path.exists(abs_output_file_realpath_for_bundle_logic):
                try:
                    # Check if only the prompt was written (approximate check)
                    with open(abs_output_file_realpath_for_bundle_logic, "r", encoding="utf-8") as f_check:
                        content_check = f_check.read()
                    if SYS_PROMPT_POST_SEPARATOR.strip() in content_check and BUNDLE_HEADER_PREFIX not in content_check:
                         os.remove(abs_output_file_realpath_for_bundle_logic)
                         print(f"  Removed partially written file: {abs_output_file_realpath_for_bundle_logic}", file=sys.stderr)
                except Exception: pass # Ignore errors during this cleanup
        sys.exit(0)

    if files_added_count > 0: # Only write bundle content if there are files
        print(f"\nPhase 2: Writing bundle content to '{output_target_display_name}'...", file=sys.stderr)
        if sys_prompt_prepended_successfully:
            print(f"  (System prompt was prepended before this content)", file=sys.stderr)
        print(f"  Bundle Content Format: {format_description}", file=sys.stderr)
        actual_output_stream.write(bundle_content_string)
    elif sys_prompt_prepended_successfully:
        print(f"\nSystem prompt was prepended to '{output_target_display_name}'. No further files were bundled.", file=sys.stderr)
    else: # Should have exited earlier if this case is reached.
        print("\nNo system prompt prepended and no files to bundle. Nothing written.", file=sys.stderr)


    if output_file_handle:
        output_file_handle.close()
        print(f"\nOutput successfully written to: '{output_target_display_name}'", file=sys.stderr)
    else: # Stdout
        print(f"\nOutput successfully written to stdout.", file=sys.stderr)
    
    if sys_prompt_prepended_successfully:
        print(f"  System prompt was prepended.", file=sys.stderr)
    if files_added_count > 0:
        print(f"  Files added to bundle content: {files_added_count}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main_cli()
    except SystemExit:
        raise # Allow sys.exit to propagate
    except KeyboardInterrupt:
        print("\nOperation cancelled by user (KeyboardInterrupt).", file=sys.stderr)
        sys.exit(130) # Standard exit code for Ctrl+C
    except Exception as e:
        print(f"\nAn unexpected critical error occurred: {e}", file=sys.stderr)
        # Add more detailed traceback if in a debug mode, for now just the error.
        # import traceback
        # traceback.print_exc(file=sys.stderr)
        sys.exit(1)