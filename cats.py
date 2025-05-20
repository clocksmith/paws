#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import argparse
import base64
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Union

SYS_PROMPT_FILENAME = "sys_ant.txt"
SYS_PROMPT_POST_SEPARATOR = """
--- END OF SYSTEM PROMPT ---
The following content is the Cats Bundle.
"""
FILE_END_MARKER = "🐈 --- CATS_END_FILE ---"
DEFAULT_ENCODING = "utf-8"
DEFAULT_OUTPUT_FILENAME = "cats_out.bundle"
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DEFAULT_EXCLUDES = [".git", "node_modules", "gem", "__pycache__"]
BASE64_HINT_TEXT = "(Content:Base64)"

FileObject = Dict[str, Union[str, bytes, bool, Optional[str], Path]]

def find_sys_prompt_path_for_prepending() -> Optional[Path]:
    try:
        script_dir = Path(__file__).resolve().parent
    except NameError:
        script_dir = Path.cwd()
    
    locations_to_check = [script_dir, script_dir.parent]
    for loc in locations_to_check:
        path_to_check = loc / SYS_PROMPT_FILENAME
        if path_to_check.is_file():
            return path_to_check.resolve()
    return None

def detect_text_encoding(file_content_bytes: bytes) -> Optional[str]:
    if not file_content_bytes:
        return DEFAULT_ENCODING
    try:
        if file_content_bytes.startswith(b"\xff\xfe"):
            file_content_bytes.decode("utf-16le")
            return "utf-16le"
        if file_content_bytes.startswith(b"\xfe\xff"):
            file_content_bytes.decode("utf-16be")
            return "utf-16be" 
        file_content_bytes.decode(DEFAULT_ENCODING)
        return DEFAULT_ENCODING
    except UnicodeDecodeError:
        try:
            file_content_bytes.decode("utf-16le")
            return "utf-16le"
        except UnicodeDecodeError:
            return None

def get_paths_to_process(
    input_paths_raw: List[str],
    exclude_paths_raw: List[str],
    use_default_excludes: bool,
    output_file_abs_path: Optional[Path] = None,
    sys_ant_in_cwd_abs_path_to_ignore: Optional[Path] = None
) -> List[Path]:
    
    candidate_files = set()
    cwd = Path.cwd()

    abs_excludes_resolved = set()
    for p_str in exclude_paths_raw:
        try:
            abs_excludes_resolved.add(cwd.joinpath(p_str).resolve())
        except FileNotFoundError:
             pass 
    
    if use_default_excludes:
        for def_excl in DEFAULT_EXCLUDES:
            abs_excludes_resolved.add(cwd.joinpath(def_excl).resolve(strict=False))

    if output_file_abs_path:
        abs_excludes_resolved.add(output_file_abs_path.resolve(strict=False))
    
    if sys_ant_in_cwd_abs_path_to_ignore:
        abs_excludes_resolved.add(sys_ant_in_cwd_abs_path_to_ignore.resolve(strict=False))

    processed_top_level_inputs = set()

    for p_str_raw in input_paths_raw:
        try:
            p_item_abs = cwd.joinpath(p_str_raw)
            if not p_item_abs.exists():
                print(f"  Warning: Input path '{p_str_raw}' not found. Skipping.", file=sys.stderr)
                continue
            
            p_item = p_item_abs.resolve()
            if p_item in processed_top_level_inputs:
                continue
            processed_top_level_inputs.add(p_item)

            is_excluded = False
            for ex_p in abs_excludes_resolved:
                try:
                    if p_item == ex_p or (ex_p.is_dir() and ex_p in p_item.parents):
                        is_excluded = True
                        break
                except FileNotFoundError: 
                    pass 
            if is_excluded:
                continue

            if p_item.is_file():
                 candidate_files.add(p_item)
            elif p_item.is_dir():
                for sub_path_abs in p_item.rglob("*"):
                    if sub_path_abs.is_file():
                        try:
                            sub_path = sub_path_abs.resolve()
                            sub_is_excluded = False
                            for ex_p in abs_excludes_resolved:
                                if sub_path == ex_p or (ex_p.is_dir() and ex_p in sub_path.parents):
                                    sub_is_excluded = True
                                    break
                            if not sub_is_excluded:
                                candidate_files.add(sub_path)
                        except FileNotFoundError: 
                            pass
                        except Exception as e_resolve:
                            print(f"  Warning: Could not fully resolve sub-path '{sub_path_abs}' in '{p_item}': {e_resolve}. Skipping.", file=sys.stderr)
        except Exception as e:
            print(f"  Warning: Could not process input path '{p_str_raw}': {e}. Skipping.", file=sys.stderr)
    
    return sorted(list(candidate_files))

def find_common_ancestor_for_paths(paths: List[Path]) -> Path:
    if not paths:
        return Path.cwd()
    if len(paths) == 1:
        p = paths[0]
        return p.parent if p.is_file() else p
    
    str_paths = []
    for p in paths:
        try:
            if p.exists():
                 str_paths.append(str(p.parent if p.is_file() else p))
            else: 
                 str_paths.append(str(Path.cwd()))
        except Exception: 
            str_paths.append(str(Path.cwd()))
    
    if not str_paths: 
        return Path.cwd()

    common_path_str = os.path.commonpath(str_paths)
    common_ancestor = Path(common_path_str)
    
    if not common_ancestor.is_dir():
        common_ancestor = common_ancestor.parent
    return common_ancestor if common_ancestor.is_dir() else Path.cwd()

def prepare_file_object(file_abs_path: Path, common_ancestor: Path) -> Optional[FileObject]:
    try:
        content_bytes = file_abs_path.read_bytes()
        detected_encoding = detect_text_encoding(content_bytes)
        try:
            abs_common_ancestor = common_ancestor.resolve()
            abs_file_path = file_abs_path.resolve()
            if abs_file_path.is_relative_to(abs_common_ancestor):
                 relative_path = abs_file_path.relative_to(abs_common_ancestor).as_posix()
            else: 
                relative_path = file_abs_path.name
        except (ValueError, TypeError): 
            relative_path = file_abs_path.name
        except Exception: 
            relative_path = file_abs_path.name

        if not relative_path: 
            relative_path = file_abs_path.name
        
        return {
            "path_obj": file_abs_path,
            "relative_path": relative_path,
            "content_bytes": content_bytes,
            "encoding": detected_encoding,
            "is_binary": detected_encoding is None,
        }
    except Exception as e:
        print(f"  Warning: Error reading file '{file_abs_path}': {e}. Skipping.", file=sys.stderr)
        return None

def create_bundle_string_from_objects(
    file_objects: List[FileObject], encoding_mode: str
) -> Tuple[str, str, str]:
    bundle_parts = []
    final_bundle_text_encoding = DEFAULT_ENCODING 
    format_desc_core = ""

    if encoding_mode == "b64":
        format_desc_core = "Base64"
        bundle_description_suffix = " (All files forced to Base64 by user)"
    elif encoding_mode == "utf16le":
        format_desc_core = "Raw UTF-16LE"
        bundle_description_suffix = f" (Text files as UTF-16LE; binaries as Base64; forced by user)"
    elif encoding_mode == "utf8":
        format_desc_core = "Raw UTF-8"
        bundle_description_suffix = f" (Text files as UTF-8; binaries as Base64; forced by user)"
    else: 
        text_files = [f for f in file_objects if not f.get("is_binary")]
        if text_files and all(f["encoding"] == "utf-16le" for f in text_files):
            format_desc_core = "Raw UTF-16LE"
            bundle_description_suffix = " (Auto-Detected UTF-16LE for text; binaries as Base64)"
        else:
            format_desc_core = "Raw UTF-8"
            bundle_description_suffix = " (Auto-Detected UTF-8 for text; binaries as Base64)"
        
        has_binaries = any(f.get("is_binary") for f in file_objects)
        if has_binaries and text_files:
            bundle_description_suffix += " - Mixed content found"
        elif has_binaries and not text_files:
            format_desc_core = "Base64" 
            bundle_description_suffix = " (Only binary files found, bundled as Base64)"
        elif not text_files and not has_binaries:
             bundle_description_suffix = " (No files)"

    format_description = f"{format_desc_core}{bundle_description_suffix}"
    bundle_parts.append(BUNDLE_HEADER_PREFIX)
    bundle_parts.append(f"{BUNDLE_FORMAT_PREFIX}{format_description}")

    for file_obj in file_objects:
        content_bytes = file_obj["content_bytes"]
        assert isinstance(content_bytes, bytes)
        file_is_binary = file_obj.get("is_binary", False)
        content_to_write_str = ""
        is_this_file_output_as_base64 = False

        try:
            if encoding_mode == "b64" or file_is_binary:
                content_to_write_str = base64.b64encode(content_bytes).decode("ascii")
                is_this_file_output_as_base64 = True
            else: 
                source_encoding = file_obj["encoding"] or DEFAULT_ENCODING
                content_to_write_str = content_bytes.decode(source_encoding, "replace")
        except Exception as e:
            print(f"  Warning: Error processing '{file_obj['relative_path']}'. Fallback to Base64. Error: {e}", file=sys.stderr)
            content_to_write_str = base64.b64encode(content_bytes).decode("ascii")
            is_this_file_output_as_base64 = True

        bundle_parts.append("")
        hint = f" {BASE64_HINT_TEXT}" if is_this_file_output_as_base64 and encoding_mode != "b64" else ""
        bundle_parts.append(f"🐈 --- CATS_START_FILE: {file_obj['relative_path']}{hint} ---")
        bundle_parts.append(content_to_write_str)
        if not content_to_write_str.endswith("\n") and not is_this_file_output_as_base64:
            bundle_parts.append("") 
        bundle_parts.append(FILE_END_MARKER)

    full_bundle_str = "\n".join(bundle_parts) + "\n"
    
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
) -> Tuple[str, str, int, str]: 
    
    sys_ant_file_obj_for_bundling: Optional[FileObject] = None
    if sys_ant_in_cwd_abs_path_to_bundle_first and sys_ant_in_cwd_abs_path_to_bundle_first.is_file():
        sys_ant_ancestor = sys_ant_in_cwd_abs_path_to_bundle_first.parent
        sys_ant_file_obj_for_bundling = prepare_file_object(sys_ant_in_cwd_abs_path_to_bundle_first, sys_ant_ancestor)
        if sys_ant_file_obj_for_bundling:
            sys_ant_file_obj_for_bundling["relative_path"] = sys_ant_in_cwd_abs_path_to_bundle_first.name

    other_abs_file_paths = get_paths_to_process(
        include_paths_raw, exclude_paths_raw, use_default_excludes,
        output_file_abs_path, sys_ant_in_cwd_abs_path_to_bundle_first 
    )
    
    common_ancestor_for_others = find_common_ancestor_for_paths(other_abs_file_paths) if other_abs_file_paths else Path.cwd()
    
    other_file_objects = [
        obj for p in other_abs_file_paths if (obj := prepare_file_object(p, common_ancestor_for_others))
    ]

    final_file_objects: List[FileObject] = []
    if sys_ant_file_obj_for_bundling:
        final_file_objects.append(sys_ant_file_obj_for_bundling)
    final_file_objects.extend(other_file_objects)

    if not final_file_objects:
        return "", "No files selected for bundle", 0, DEFAULT_ENCODING

    bundle_content, format_desc, bundle_file_enc = create_bundle_string_from_objects(final_file_objects, encoding_mode)
    return bundle_content, format_desc, len(final_file_objects), bundle_file_enc

def confirm_action_prompt(prompt_message: str) -> bool:
    if not sys.stdin.isatty():
        print("  Non-interactive mode. Proceeding automatically.", file=sys.stderr)
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
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("paths", nargs="+", metavar="PATH", help="Files/directories to include.")
    parser.add_argument("-o", "--output", default=None, metavar="BUNDLE_FILE", help=f"Output bundle file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout.")
    parser.add_argument("-x", "--exclude", action="append", default=[], metavar="EXCLUDE_PATH", help="Path to exclude. Use multiple times.")
    parser.add_argument("-N", "--no-default-excludes", action="store_false", dest="use_default_excludes", help=f"Disable default excludes: {', '.join(DEFAULT_EXCLUDES)}.")
    parser.add_argument(
        "-E", "--force-encoding", choices=["auto", "utf8", "utf16le", "b64"], default="auto", metavar="MODE",
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

    output_to_stdout = args.output == "-"
    abs_output_file_path_for_logic: Optional[Path] = None
    output_target_display_name = "stdout"
    
    if not output_to_stdout:
        output_filename = args.output if args.output else DEFAULT_OUTPUT_FILENAME
        abs_output_file_path_for_logic = Path.cwd().joinpath(output_filename).resolve()
        output_target_display_name = str(abs_output_file_path_for_logic)

    prepended_prompt_bytes = b""
    sys_prompt_prepended_successfully = False
    sys_prompt_path_used_for_prepending: Optional[Path] = None
    if not args.no_sys_prompt:
        sys_prompt_path_used_for_prepending = find_sys_prompt_path_for_prepending()
        if sys_prompt_path_used_for_prepending:
            try:
                prompt_content_bytes = sys_prompt_path_used_for_prepending.read_bytes()
                prompt_content_str = prompt_content_bytes.decode("utf-8", "replace")
                prepended_prompt_bytes = (prompt_content_str.rstrip() + "\n" + SYS_PROMPT_POST_SEPARATOR).encode("utf-8")
                sys_prompt_prepended_successfully = True
                print(f"  Prepended system prompt from: {sys_prompt_path_used_for_prepending}", file=sys.stderr)
            except Exception as e:
                msg = f"Warning: Could not read/process system prompt '{SYS_PROMPT_FILENAME}' from {sys_prompt_path_used_for_prepending}: {e}"
                print(msg, file=sys.stderr)
                if args.require_sys_prompt:
                    print("Exiting due to --require-sys-prompt.", file=sys.stderr); sys.exit(1)
        elif args.require_sys_prompt:
            print(f"Error: System prompt '{SYS_PROMPT_FILENAME}' not found and --require-sys-prompt specified.", file=sys.stderr); sys.exit(1)
        elif args.paths: 
            print(f"  Info: System prompt '{SYS_PROMPT_FILENAME}' for prepending not found.", file=sys.stderr)

    sys_ant_in_cwd_to_bundle_first: Optional[Path] = None
    potential_sys_ant_cwd = Path.cwd() / SYS_PROMPT_FILENAME
    if potential_sys_ant_cwd.is_file():
        resolved_sys_ant_cwd = potential_sys_ant_cwd.resolve()
        if not (sys_prompt_path_used_for_prepending and resolved_sys_ant_cwd == sys_prompt_path_used_for_prepending):
            is_excluded_by_arg = any(resolved_sys_ant_cwd == Path.cwd().joinpath(ex).resolve(strict=False) for ex in args.exclude)
            is_excluded_by_default = False
            if args.use_default_excludes:
                 is_excluded_by_default = any(resolved_sys_ant_cwd == Path.cwd().joinpath(dex).resolve(strict=False) for dex in DEFAULT_EXCLUDES)
            
            if not is_excluded_by_arg and not is_excluded_by_default:
                sys_ant_in_cwd_to_bundle_first = resolved_sys_ant_cwd
                print(f"  Convention: Found '{SYS_PROMPT_FILENAME}' in CWD. It will be the first file _within_ the bundle.", file=sys.stderr)
            elif is_excluded_by_arg or is_excluded_by_default:
                 print(f"  Info: '{SYS_PROMPT_FILENAME}' in CWD is excluded. Not bundling as first file.", file=sys.stderr)

    print("Phase 1: Collecting and filtering files...", file=sys.stderr)
    bundle_content_string, format_description, files_added_count, bundle_file_encoding_name = create_bundle_from_paths_api(
        args.paths, args.exclude, args.force_encoding, args.use_default_excludes,
        abs_output_file_path_for_logic,
        sys_ant_in_cwd_to_bundle_first
    )

    if files_added_count == 0 and not sys_prompt_prepended_successfully:
        print(f"No files selected, and system prompt was not prepended. Bundle format: {format_description}. Exiting.", file=sys.stderr)
        sys.exit(0)

    if files_added_count > 0:
        print(f"  Files to be included in bundle: {files_added_count}", file=sys.stderr)
        print(f"  Bundle format determined: {format_description.split('(')[0].strip()}", file=sys.stderr)
        if args.force_encoding != "auto":
            print(f"  (Encoding strategy forced to: {args.force_encoding})", file=sys.stderr)

    proceed = args.yes
    if not proceed and (files_added_count > 0 or sys_prompt_prepended_successfully):
        print(f"\n  Output will be written to: {output_target_display_name}", file=sys.stderr)
        proceed = confirm_action_prompt("Proceed with writing output?")

    if not proceed:
        print("Operation cancelled by user.", file=sys.stderr)
        sys.exit(0)

    bundle_bytes_to_write = bundle_content_string.encode(bundle_file_encoding_name, "replace")
    
    full_output_bytes = prepended_prompt_bytes
    if files_added_count > 0: 
        full_output_bytes += bundle_bytes_to_write

    if not output_to_stdout and abs_output_file_path_for_logic:
        print(f"\nPhase 2: Writing bundle to '{output_target_display_name}'...", file=sys.stderr)
        try:
            if abs_output_file_path_for_logic.parent: 
                 abs_output_file_path_for_logic.parent.mkdir(parents=True, exist_ok=True)
            with open(abs_output_file_path_for_logic, "wb") as f_out:
                f_out.write(full_output_bytes)
            print(f"\nOutput successfully written to: '{output_target_display_name}'", file=sys.stderr)
        except Exception as e:
            print(f"Fatal: Could not write to output file '{output_target_display_name}': {e}", file=sys.stderr)
            sys.exit(1)
    else: 
        sys.stdout.buffer.write(full_output_bytes)
        sys.stdout.flush()

    if sys_prompt_prepended_successfully and files_added_count == 0 and not proceed and abs_output_file_path_for_logic:
        if abs_output_file_path_for_logic.exists() and abs_output_file_path_for_logic.stat().st_size == len(prepended_prompt_bytes):
             try: abs_output_file_path_for_logic.unlink()
             except OSError: pass

if __name__ == "__main__":
    try:
        main_cli()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        print("\nOperation cancelled by user (KeyboardInterrupt).", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        import traceback
        print(f"\nAn unexpected critical error occurred in cats.py main: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)