#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import argparse
import base64
import re
from typing import List, Tuple, Dict, Optional, Union, Any

# --- Constants ---
DEFAULT_ENCODING = "utf-8"
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs_in.bundle"
DEFAULT_OUTPUT_DIR = "."

CATS_BUNDLE_HEADER_PREFIX = "# Cats Bundle"
DOGS_BUNDLE_HEADER_PREFIX = "# Dogs Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
BASE64_CONTENT_MARKER_TEXT = "Content:Base64" # Used in regex

# Regex for explicit markers, capturing optional Base64 hint
# Group 1: File path, Group 3: Optional Base64 marker text
FILE_START_MARKER_REGEX_TEMPLATE = r"^\s*{emoji}\s*-{{3,}}\s*{type}_START_FILE\s*:\s*(.+?)(?:\s+\(({marker_text})\))?\s*-{{3,}}$"

CATS_FILE_START_MARKER_REGEX = re.compile(
    FILE_START_MARKER_REGEX_TEMPLATE.format(emoji="🐈", type="CATS", marker_text=BASE64_CONTENT_MARKER_TEXT), re.IGNORECASE
)
CATS_FILE_END_MARKER_REGEX = re.compile(r"^\s*🐈\s*-{3,}\s*CATS_END_FILE\s*-{3,}$", re.IGNORECASE)

DOGS_FILE_START_MARKER_REGEX = re.compile(
    FILE_START_MARKER_REGEX_TEMPLATE.format(emoji="🐕", type="DOGS", marker_text=BASE64_CONTENT_MARKER_TEXT), re.IGNORECASE
)
DOGS_FILE_END_MARKER_REGEX = re.compile(r"^\s*🐕\s*-{3,}\s*DOGS_END_FILE\s*-{3,}$", re.IGNORECASE)


# Delta Command Regex
PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s*(.+?)\s*@@\s*$")
REPLACE_LINES_REGEX = re.compile(r"REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE)
INSERT_AFTER_LINE_REGEX = re.compile(r"INSERT_AFTER_LINE\(\s*(\d+)\s*\)", re.IGNORECASE)
DELETE_LINES_REGEX = re.compile(r"DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE)

# Heuristic parsing (less relied upon now with explicit DOGS markers, but kept for some flexibility)
LLM_EDITING_FILE_REGEX = re.compile(
    r"^\s*(?:\*\*|__)?(?:editing|generating|file|now generating file|processing|current file)\s*(?::)?\s*[`\"]?(?P<filepath>[\w./\\~-]+)[`\"]?(?:\s*\(.*\)|\s*\b(?:and|also|with|which)\b.*|\s+`?#.*|\s*(?:\*\*|__).*)?$",
    re.IGNORECASE,
)
MARKDOWN_CODE_FENCE_REGEX = re.compile(r"^\s*```(?:[\w+\-.]+)?\s*$")

# --- Type Aliases ---
ParsedFile = Dict[str, Any] # path_in_bundle, content_bytes, delta_commands, format_used_for_decode, is_base64_marked
DeltaCommand = Dict[str, Any]
ExtractionResult = Dict[str, str] # path, status, message
ParseResult = Tuple[List[ParsedFile], str, str] # files, format_description, bundle_text_content_encoding


# --- Path Sanitization ---
def sanitize_path_component(comp: str) -> str:
    if not comp or comp == "." or comp == "..": return "_sanitized_dots_"
    sanitized = re.sub(r"[^\w.\-_]", "_", comp)
    sanitized = re.sub(r"_+", "_", sanitized)
    sanitized = re.sub(r"^[._]+|[._]+$", "", sanitized)
    return sanitized if sanitized else "sanitized_empty_comp"

def sanitize_relative_path(rel_path_from_bundle: str) -> str:
    normalized_path = rel_path_from_bundle.replace("\\", "/")
    parts = [p for p in normalized_path.split("/") if p and p != "." and p != ".."]
    sanitized_parts = [sanitize_path_component(part) for part in parts]
    if not sanitized_parts:
        return sanitize_path_component(os.path.basename(rel_path_from_bundle)) or "unnamed_file_from_bundle"
    return os.path.join(*sanitized_parts)


# --- Core Parsing Logic ---
def parse_original_bundle_for_delta(original_bundle_path: str, verbose_logging: bool = False) -> Dict[str, List[str]]:
    """Parses the original cats bundle into a dict mapping relative paths to lines (text content)."""
    original_files: Dict[str, List[str]] = {}
    try:
        with open(original_bundle_path, "rb") as f_orig_bytes: # Read as bytes first
            bundle_bytes = f_orig_bytes.read()
    except Exception as e:
        print(f"  Error: Could not read original bundle '{original_bundle_path}' for delta: {e}", file=sys.stderr)
        return {}

    # Detect encoding of the original bundle to correctly split lines
    # This simplified detection assumes the original bundle is primarily text (UTF-8 or UTF-16LE)
    # If it was a Base64 *global* bundle, deltas wouldn't make sense anyway.
    header_text_sample = bundle_bytes[:1024].decode(DEFAULT_ENCODING, errors='ignore')
    original_bundle_encoding = DEFAULT_ENCODING # Default
    if BUNDLE_FORMAT_PREFIX.lower() + "raw utf-16le" in header_text_sample.lower():
        original_bundle_encoding = 'utf-16le'
    
    try:
        original_content_str = bundle_bytes.decode(original_bundle_encoding, errors='replace')
    except Exception as e:
        print(f"  Error: Could not decode original bundle '{original_bundle_path}' as {original_bundle_encoding}: {e}", file=sys.stderr)
        return {}

    lines = original_content_str.splitlines()
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    in_block = False

    for line_text in lines:
        stripped_line = line_text.strip()
        # Use CATS regex for original bundle, ignore Base64 hint for delta target (it's about text lines)
        start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
        end_match = CATS_FILE_END_MARKER_REGEX.match(stripped_line)

        if start_match:
            if in_block and current_file_path:
                if verbose_logging: print(f"  Warning (Original Parse): New file '{start_match.group(1).strip()}' started before '{current_file_path}' ended.", file=sys.stderr)
                original_files[current_file_path] = current_content_lines
            current_file_path = start_match.group(1).strip() # Group 1 is path
            # We don't care about base64 markers here, delta applies to text representations
            current_content_lines = []
            in_block = True
            continue

        if end_match and in_block:
            if current_file_path: original_files[current_file_path] = current_content_lines
            current_file_path = None; current_content_lines = []; in_block = False
            continue
        if in_block: current_content_lines.append(line_text)

    if in_block and current_file_path:
        if verbose_logging: print(f"  Warning (Original Parse): Bundle ended mid-file for '{current_file_path}'.", file=sys.stderr)
        original_files[current_file_path] = current_content_lines
    return original_files


def parse_bundle_content(
    bundle_content_str: str,
    forced_format_override: Optional[str] = None, # 'b64', 'utf8', 'utf16le'
    apply_delta: bool = False,
    verbose_logging: bool = False,
) -> ParseResult:
    lines = bundle_content_str.splitlines()
    parsed_files: List[ParsedFile] = []

    bundle_is_globally_b64: bool = False
    bundle_text_content_encoding: str = DEFAULT_ENCODING # For non-b64 marked files
    format_description = "Unknown (Header not found or not recognized)"
    header_lines_consumed = 0

    possible_headers = [
        (DOGS_BUNDLE_HEADER_PREFIX, "Dogs Bundle (LLM Output)"),
        (CATS_BUNDLE_HEADER_PREFIX, "Cats Bundle (Original Source)"),
    ]
    header_type_found = None

    for i, line_text in enumerate(lines[:10]):
        stripped = line_text.strip()
        if not header_type_found:
            for prefix_str, desc_str_part in possible_headers:
                if stripped.startswith(prefix_str):
                    header_type_found = desc_str_part; header_lines_consumed = max(header_lines_consumed, i + 1); break
            if header_type_found: continue
        
        if header_type_found and stripped.startswith(BUNDLE_FORMAT_PREFIX):
            header_lines_consumed = max(header_lines_consumed, i + 1)
            temp_format_description = stripped[len(BUNDLE_FORMAT_PREFIX) :].strip()
            format_description = f"{header_type_found} - Format: {temp_format_description}"
            fmt_lower = temp_format_description.lower()

            if "base64" in fmt_lower: # Global Base64 implies all content is Base64
                bundle_is_globally_b64 = True
                bundle_text_content_encoding = "ascii" # Base64 is ASCII
            elif "utf-16le" in fmt_lower or "utf-16 le" in fmt_lower:
                bundle_is_globally_b64 = False
                bundle_text_content_encoding = "utf-16le"
            elif "utf-8" in fmt_lower: # Default text encoding
                bundle_is_globally_b64 = False
                bundle_text_content_encoding = "utf-8"
            else: # Unrecognized, assume UTF-8 for text parts
                bundle_is_globally_b64 = False
                bundle_text_content_encoding = "utf-8"
                format_description += f" (Unrecognized details, assuming Raw UTF-8 for text blocks)"
            break

    if forced_format_override:
        override_lower = forced_format_override.lower()
        desc_prefix = f"{header_type_found or 'Bundle'} - Format:"
        if override_lower == "b64":
            bundle_is_globally_b64 = True; bundle_text_content_encoding = "ascii"
            format_description = f"{desc_prefix} Base64 (Overridden by user)"
        elif override_lower == "utf16le":
            bundle_is_globally_b64 = False; bundle_text_content_encoding = "utf-16le"
            format_description = f"{desc_prefix} Raw UTF-16LE (Overridden by user)"
        elif override_lower == "utf8":
            bundle_is_globally_b64 = False; bundle_text_content_encoding = "utf-8"
            format_description = f"{desc_prefix} Raw UTF-8 (Overridden by user)"
    
    if not header_type_found and not forced_format_override: # No header, no override
        format_description = f"Raw UTF-8 (Assumed, no header found)"
        if verbose_logging: print(f"  Info: {format_description}", file=sys.stderr)
        # bundle_is_globally_b64 remains False, bundle_text_content_encoding remains utf-8

    current_state = "LOOKING_FOR_ANY_START"
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    current_delta_commands: List[DeltaCommand] = []
    is_current_file_base64_marked = False
    has_delta_commands_in_block = False
    in_markdown_code_block_heuristic = False # For heuristic only
    line_iter_obj = iter(enumerate(lines[header_lines_consumed:]))

    def finalize_current_block():
        nonlocal parsed_files, current_file_path, current_content_lines, current_delta_commands, has_delta_commands_in_block, is_current_file_base64_marked
        if not current_file_path: return

        file_content_bytes: Optional[bytes] = None
        delta_cmds_to_store: Optional[List[DeltaCommand]] = None
        decode_format_used = "text" # 'text', 'base64', or 'delta'

        if apply_delta and has_delta_commands_in_block and not is_current_file_base64_marked:
            if current_delta_commands and current_delta_commands[-1]["type"] != "delete" and current_content_lines:
                current_delta_commands[-1]["content_lines"] = list(current_content_lines)
            delta_cmds_to_store = list(current_delta_commands)
            decode_format_used = "delta"
        else: # Full content (either raw text, or base64 marked, or globally base64)
            raw_content_str = "\n".join(current_content_lines)
            try:
                if bundle_is_globally_b64 or is_current_file_base64_marked:
                    # The content lines themselves form the Base64 string. Remove all whitespace.
                    file_content_bytes = base64.b64decode("".join(raw_content_str.split()))
                    decode_format_used = "base64"
                else: # Text content, use bundle_text_content_encoding
                    file_content_bytes = raw_content_str.encode(bundle_text_content_encoding)
                    decode_format_used = bundle_text_content_encoding
            except Exception as e:
                print(f"  Error: Failed to decode content for '{current_file_path}'. Skipped. Error: {e}", file=sys.stderr)
                # Reset and return to avoid adding a broken file
                current_file_path = None; current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False; is_current_file_base64_marked = False
                return

        parsed_files.append({
            "path_in_bundle": current_file_path,
            "content_bytes": file_content_bytes,
            "delta_commands": delta_cmds_to_store,
            "format_used_for_decode": decode_format_used,
            "is_base64_marked": is_current_file_base64_marked, # Actual marker status
            "has_delta_commands": has_delta_commands_in_block and not is_current_file_base64_marked,
        })
        # Reset for next block
        current_file_path = None; current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False; is_current_file_base64_marked = False


    for line_idx_rel, line_text in line_iter_obj:
        # actual_line_num = line_idx_rel + header_lines_consumed + 1 # For logging if needed
        stripped_line = line_text.strip()
        
        # Check for end markers first if in a block
        if current_state == "IN_EXPLICIT_BLOCK":
            is_dogs_end = DOGS_FILE_END_MARKER_REGEX.match(stripped_line)
            is_cats_end = CATS_FILE_END_MARKER_REGEX.match(stripped_line)
            if is_dogs_end or is_cats_end:
                finalize_current_block()
                current_state = "LOOKING_FOR_ANY_START"
                continue
        
        # Handle PAWS_CMD if in an explicit block and deltas are active
        if current_state == "IN_EXPLICIT_BLOCK" and apply_delta and not is_current_file_base64_marked:
            paws_cmd_match = PAWS_CMD_REGEX.match(line_text) # Match on raw line_text
            if paws_cmd_match:
                command_str = paws_cmd_match.group(1).strip(); delta_cmd: Optional[DeltaCommand] = None
                replace_m = REPLACE_LINES_REGEX.match(command_str); insert_m = INSERT_AFTER_LINE_REGEX.match(command_str); delete_m = DELETE_LINES_REGEX.match(command_str)
                
                if current_delta_commands and current_delta_commands[-1]["type"] != "delete":
                    current_delta_commands[-1]["content_lines"] = list(current_content_lines) # Finalize previous cmd's content
                current_content_lines = [] # Reset for new cmd's content (if any)

                if replace_m: delta_cmd = {"type": "replace", "start": int(replace_m.group(1)), "end": int(replace_m.group(2))}
                elif insert_m: delta_cmd = {"type": "insert", "line_num": int(insert_m.group(1))}
                elif delete_m: delta_cmd = {"type": "delete", "start": int(delete_m.group(1)), "end": int(delete_m.group(2))}
                
                if delta_cmd:
                    current_delta_commands.append(delta_cmd); has_delta_commands_in_block = True
                else: # Unrecognized PAWS_CMD
                    if verbose_logging: print(f"  Warning: Unrecognized PAWS_CMD: '{command_str}'", file=sys.stderr)
                    current_content_lines.append(line_text) # Treat as content line
                continue # Processed this line as a command or content

        # Look for start markers or heuristic cues
        if current_state == "LOOKING_FOR_ANY_START":
            dogs_start_match = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            cats_start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            
            chosen_match = None
            if dogs_start_match: chosen_match = dogs_start_match # Prioritize DOGS
            elif cats_start_match: chosen_match = cats_start_match

            if chosen_match:
                finalize_current_block() # Finalize any previous heuristic block
                current_file_path = chosen_match.group(1).strip()
                is_current_file_base64_marked = bool(chosen_match.group(3) and BASE64_CONTENT_MARKER_TEXT in chosen_match.group(3))
                current_state = "IN_EXPLICIT_BLOCK"
                current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False
                in_markdown_code_block_heuristic = False # Reset heuristic state
                continue
            elif LLM_EDITING_FILE_REGEX.match(line_text) and not apply_delta and not bundle_is_globally_b64: # Heuristic only if not delta mode & not global b64
                finalize_current_block() # Finalize any previous block
                llm_match = LLM_EDITING_FILE_REGEX.match(line_text)
                current_file_path = llm_match.group("filepath").strip()
                is_current_file_base64_marked = False # Heuristic doesn't support b64 hint
                current_state = "IN_HEURISTIC_BLOCK"
                current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False
                try: # Check for markdown fence
                    _, next_line_text_heuristic = next(line_iter_obj)
                    if MARKDOWN_CODE_FENCE_REGEX.match(next_line_text_heuristic.strip()): in_markdown_code_block_heuristic = True
                    else: current_content_lines.append(next_line_text_heuristic) # Part of content
                except StopIteration: pass
                continue
        
        # Accumulate content if in a block
        if current_state == "IN_EXPLICIT_BLOCK":
            current_content_lines.append(line_text)
        elif current_state == "IN_HEURISTIC_BLOCK": # (and not apply_delta, not global b64)
            # Heuristic block termination conditions
            if MARKDOWN_CODE_FENCE_REGEX.match(stripped_line):
                if in_markdown_code_block_heuristic: # End of heuristic code block
                    finalize_current_block()
                    current_state = "LOOKING_FOR_ANY_START"
                    in_markdown_code_block_heuristic = False
                else: # Start of heuristic code block
                    in_markdown_code_block_heuristic = True
                continue # Skip fence line itself
            if not in_markdown_code_block_heuristic and not line_text.strip(): # Blank line outside code block might end it (very loose heuristic)
                 pass # Could be a an empty line within the content too. This heuristic is tricky.
            current_content_lines.append(line_text)

    finalize_current_block() # Finalize any remaining open block at EOF
    return parsed_files, format_description, bundle_text_content_encoding


def apply_delta_commands(original_lines: List[str], delta_commands: List[DeltaCommand], file_path_for_log: str) -> List[str]:
    new_lines = list(original_lines); offset = 0
    for cmd_idx, cmd in enumerate(delta_commands):
        cmd_type = cmd["type"]
        try:
            if cmd_type == "replace":
                s, e = cmd["start"], cmd["end"]
                if not (isinstance(s,int) and isinstance(e,int) and s > 0 and e >= s): raise ValueError("Invalid line numbers")
                adj_s, adj_e = s - 1 + offset, e - 1 + offset
                if not (0 <= adj_s <= adj_e < len(new_lines) or (adj_s==0 and adj_e==-1 and not new_lines)): raise ValueError("Line numbers out of bounds")
                
                del_count = adj_e - adj_s + 1
                content = cmd.get("content_lines", [])
                new_lines[adj_s : adj_e + 1] = content
                offset += len(content) - del_count
            elif cmd_type == "insert":
                ln = cmd["line_num"]
                if not (isinstance(ln, int) and ln >= 0): raise ValueError("Invalid line number")
                adj_ln = ln + offset
                if not (0 <= adj_ln <= len(new_lines)): raise ValueError("Line number out of bounds")
                
                content = cmd.get("content_lines", [])
                new_lines[adj_ln:adj_ln] = content # Insert content at adj_ln
                offset += len(content)
            elif cmd_type == "delete":
                s, e = cmd["start"], cmd["end"]
                if not (isinstance(s,int) and isinstance(e,int) and s > 0 and e >= s): raise ValueError("Invalid line numbers")
                adj_s, adj_e = s - 1 + offset, e - 1 + offset
                if not (0 <= adj_s <= adj_e < len(new_lines)): raise ValueError("Line numbers out of bounds")

                del_count = adj_e - adj_s + 1
                del new_lines[adj_s : adj_e + 1]
                offset -= del_count
        except Exception as e_delta:
            print(f"  Error applying delta #{cmd_idx+1} ({cmd_type}) to '{file_path_for_log}': {e_delta}. Skipping.", file=sys.stderr)
    return new_lines


# --- Extraction to Disk & CLI ---
def extract_bundle_to_disk(
    parsed_files: List[ParsedFile],
    output_dir_base_abs: str,
    overwrite_policy: str, # 'yes', 'no', 'prompt'
    bundle_text_content_encoding_for_delta_output: str, # From parse_bundle_content
    apply_delta_from_original_bundle_path: Optional[str] = None,
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    results: List[ExtractionResult] = []
    always_yes, always_no, user_quit = overwrite_policy == "yes", overwrite_policy == "no", False

    original_bundle_files_for_delta: Dict[str, List[str]] = {}
    if apply_delta_from_original_bundle_path:
        original_bundle_files_for_delta = parse_original_bundle_for_delta(apply_delta_from_original_bundle_path, verbose_logging)
        if not original_bundle_files_for_delta and any(f.get("has_delta_commands") for f in parsed_files):
            print(f"  Warning: Delta active, but failed to load/parse original bundle '{apply_delta_from_original_bundle_path}'. Deltas for text files cannot be applied.", file=sys.stderr)
            apply_delta_from_original_bundle_path = None # Disable delta if base not loaded

    for file_info in parsed_files:
        if user_quit: results.append({"path": file_info["path_in_bundle"], "status": "skipped", "message": "User quit."}); continue

        original_path = file_info["path_in_bundle"]
        sanitized_rel_path = sanitize_relative_path(original_path)
        prospective_abs_path = os.path.normpath(os.path.join(output_dir_base_abs, sanitized_rel_path))

        if not os.path.abspath(prospective_abs_path).startswith(os.path.abspath(output_dir_base_abs)):
            msg = f"Security Alert: Path '{sanitized_rel_path}' (from '{original_path}') escapes base dir. Skipping."
            print(f"  Error: {msg}", file=sys.stderr); results.append({"path": original_path, "status": "error", "message": msg}); continue

        content_to_write: Optional[bytes] = None
        write_action = True

        if apply_delta_from_original_bundle_path and file_info.get("has_delta_commands") and not file_info.get("is_base64_marked"):
            original_lines = original_bundle_files_for_delta.get(original_path)
            delta_cmds = file_info.get("delta_commands")
            if original_lines is None:
                msg = f"Delta for '{original_path}', but not in original bundle. Cannot apply."; print(f"  Error: {msg}", file=sys.stderr)
                results.append({"path": original_path, "status": "error", "message": msg}); write_action = False
            elif not delta_cmds: # Should not happen if has_delta_commands is true
                msg = f"Internal: Delta flagged but no commands for '{original_path}'."; print(f"  Error: {msg}", file=sys.stderr)
                results.append({"path": original_path, "status": "error", "message": msg}); write_action = False
            else:
                new_content_lines = apply_delta_commands(original_lines, delta_cmds, original_path)
                try: # Output of delta is text, encode with bundle's text encoding
                    content_to_write = "\n".join(new_content_lines).encode(bundle_text_content_encoding_for_delta_output)
                    if verbose_logging: print(f"  Info: Delta result for '{original_path}' encoded as {bundle_text_content_encoding_for_delta_output}.")
                except Exception as enc_e:
                    msg = f"Failed to encode delta result for '{original_path}': {enc_e}"; print(f"  Error: {msg}", file=sys.stderr)
                    results.append({"path": original_path, "status": "error", "message": msg}); write_action = False
        else: # Full content (raw text, base64 marked, or from bundle_is_globally_b64)
            content_to_write = file_info.get("content_bytes")
            if content_to_write is None: # Should only happen if delta was expected but failed earlier
                msg = "No content to write (possibly prior delta error or parsing issue)."
                if not any(r["path"] == original_path and r["status"] == "error" for r in results): # Avoid duplicate error
                    results.append({"path": original_path, "status": "error", "message": msg})
                write_action = False
        
        if write_action and content_to_write is not None:
            if os.path.lexists(prospective_abs_path):
                if os.path.isdir(prospective_abs_path) and not os.path.islink(prospective_abs_path):
                    msg = f"Path '{sanitized_rel_path}' is a directory. Skipping."; print(f"  Warning: {msg}", file=sys.stderr)
                    results.append({"path": original_path, "status": "error", "message": msg}); write_action = False
                elif always_no: results.append({"path": original_path, "status": "skipped", "message": "Exists (no overwrite)."}) ; write_action = False
                elif not always_yes: # Prompt
                    if not sys.stdin.isatty(): results.append({"path": original_path, "status": "skipped", "message": "Exists (non-interactive, no overwrite)."}) ; write_action = False
                    else:
                        try:
                            choice = input(f"File '{sanitized_rel_path}' exists. Overwrite? [y/N/a/s/q]: ").strip().lower()
                            if choice == 'y': pass
                            elif choice == 'a': always_yes = True
                            elif choice == 's': always_no = True; write_action = False; results.append({"path": original_path, "status": "skipped", "message": "Exists (skip all)."})
                            elif choice == 'q': user_quit = True; write_action = False
                            else: write_action = False; results.append({"path": original_path, "status": "skipped", "message": "Exists (user no)."})
                        except (KeyboardInterrupt, EOFError): user_quit = True; write_action = False; print("\nExtraction cancelled.")
            
            if user_quit and not write_action:
                if not any(r["path"] == original_path and r["status"] == "skipped" for r in results): results.append({"path": original_path, "status": "skipped", "message": "User quit."})
                continue

            if write_action:
                try:
                    os.makedirs(os.path.dirname(prospective_abs_path), exist_ok=True)
                    if os.path.islink(prospective_abs_path): os.unlink(prospective_abs_path)
                    with open(prospective_abs_path, "wb") as f_out: f_out.write(content_to_write)
                    results.append({"path": original_path, "status": "extracted", "message": f"To {sanitized_rel_path}"})
                except Exception as e_write:
                    msg = f"Error writing '{sanitized_rel_path}': {e_write}"; print(f"  Error: {msg}", file=sys.stderr)
                    results.append({"path": original_path, "status": "error", "message": msg})
    return results


def extract_bundle_to_memory(
    bundle_content_str: Optional[str] = None, bundle_path: Optional[str] = None,
    input_format_override: Optional[str] = None, verbose_logging: bool = False,
) -> List[ParsedFile]: # Returns list of ParsedFile dicts
    if bundle_path and not bundle_content_str:
        try:
            with open(bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace") as f: bundle_content_str = f.read()
        except Exception as e: print(f"Error reading bundle file '{bundle_path}': {e}", file=sys.stderr); return []
    if bundle_content_str is None: print("Error: No bundle content or path.", file=sys.stderr); return []
    
    # For memory extraction, delta application is not supported directly here.
    # We parse with apply_delta=False to get full content representations.
    # The `delta_commands` field in ParsedFile will still be populated if present in the bundle.
    parsed_files, _, _ = parse_bundle_content(bundle_content_str, input_format_override, apply_delta=True, verbose_logging=verbose_logging)
    return parsed_files


def extract_bundle_from_string(
    bundle_content_str: Optional[str] = None, bundle_path: Optional[str] = None,
    output_dir_base: str = ".", overwrite_policy: str = "prompt",
    apply_delta_from_original_bundle_path: Optional[str] = None,
    input_format_override: Optional[str] = None, verbose_logging: bool = False,
) -> List[ExtractionResult]:
    if bundle_path and not bundle_content_str:
        try:
            with open(bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace") as f: bundle_content_str = f.read()
        except Exception as e: return [{"path": bundle_path, "status": "error", "message": f"Read error: {e}"}]
    if bundle_content_str is None: return [{"path": "bundle", "status": "error", "message": "No bundle content."}]

    abs_output_dir = os.path.realpath(os.path.abspath(output_dir_base))
    try: os.makedirs(abs_output_dir, exist_ok=True)
    except Exception as e: return [{"path": output_dir_base, "status": "error", "message": f"Mkdir error: {e}"}]
    if not os.path.isdir(abs_output_dir): return [{"path": output_dir_base, "status": "error", "message": "Not a directory."}]

    parsed_files, format_desc, bundle_text_enc_for_delta = parse_bundle_content(
        bundle_content_str, input_format_override,
        apply_delta=bool(apply_delta_from_original_bundle_path), verbose_logging=verbose_logging
    )
    if verbose_logging: print(f"  Info: Bundle parsing done. Format: {format_desc}. Files: {len(parsed_files)}.")
    if not parsed_files: return [{"path": "bundle", "status": "skipped", "message": "No files in bundle."}]

    return extract_bundle_to_disk(
        parsed_files, abs_output_dir, overwrite_policy,
        bundle_text_enc_for_delta, # Pass the bundle's text encoding for delta output
        apply_delta_from_original_bundle_path, verbose_logging
    )

def confirm_action_cli_prompt(prompt_message: str) -> bool:
    if not sys.stdin.isatty(): return True 
    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "": return True
            if choice == "n": return False
            print("Invalid input.", file=sys.stderr)
        except (KeyboardInterrupt, EOFError): print("\nOperation cancelled.", file=sys.stderr); return False


def main_cli(): # Renamed from main_cli_dogs for consistency
    parser = argparse.ArgumentParser(
        description="dogs.py : Extracts files from a PAWS bundle, handling mixed content and deltas.", 
        epilog="Example: python dogs.py results.bundle ./code -y -d project_orig.bundle", 
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("bundle_file", nargs="?", default=None, metavar="BUNDLE_FILE", help=f"Bundle to extract (default: {DEFAULT_INPUT_BUNDLE_FILENAME} if exists).")
    parser.add_argument("output_directory", nargs="?", default=DEFAULT_OUTPUT_DIR, metavar="OUTPUT_DIR", help=f"Directory to extract into (default: {DEFAULT_OUTPUT_DIR}).")
    parser.add_argument("-d", "--apply-delta", metavar="ORIGINAL_BUNDLE", help="Apply delta commands (for text files) using ORIGINAL_BUNDLE as base.")
    parser.add_argument("-i", "--input-format", choices=["auto", "b64", "utf8", "utf16le"], default="auto", help="Override bundle's primary text format detection (default: auto). Per-file Base64 markers are still honored.")
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument("-y", "--yes", dest="overwrite_policy", action="store_const", const="yes", help="Automatically overwrite existing files.")
    overwrite_group.add_argument("-n", "--no", dest="overwrite_policy", action="store_const", const="no", help="Automatically skip existing files.")
    parser.set_defaults(overwrite_policy="prompt")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging.")

    args = parser.parse_args()
    if args.bundle_file is None:
        if os.path.exists(DEFAULT_INPUT_BUNDLE_FILENAME): args.bundle_file = DEFAULT_INPUT_BUNDLE_FILENAME
        else: parser.error(f"No bundle file specified and default '{DEFAULT_INPUT_BUNDLE_FILENAME}' not found.")

    abs_bundle_file_path = os.path.realpath(os.path.abspath(args.bundle_file))
    if not os.path.isfile(abs_bundle_file_path): 
        print(f"Error: Bundle file not found: '{abs_bundle_file_path}'", file=sys.stderr); sys.exit(1)
    
    abs_original_bundle_path = None
    if args.apply_delta:
        abs_original_bundle_path = os.path.realpath(os.path.abspath(args.apply_delta))
        if not os.path.isfile(abs_original_bundle_path): 
            print(f"Error: Original bundle for delta not found: '{abs_original_bundle_path}'", file=sys.stderr); sys.exit(1)

    bundle_content_str = ""
    try: # Read as text, parsing will handle encodings based on headers/markers
        with open(abs_bundle_file_path, "r", encoding=DEFAULT_ENCODING, errors="replace") as f: 
            bundle_content_str = f.read()
    except Exception as e: 
        print(f"Error reading bundle file '{abs_bundle_file_path}': {e}", file=sys.stderr); sys.exit(1)

    effective_overwrite_policy = args.overwrite_policy
    if not sys.stdin.isatty() and args.overwrite_policy == "prompt": 
        effective_overwrite_policy = "no" # Default to no overwrite in non-interactive if prompt was default
    
    # Pre-parse for confirmation prompt
    parsed_for_confirm, prelim_fmt_desc, _ = parse_bundle_content(
        bundle_content_str,
        forced_format_override=(args.input_format if args.input_format != "auto" else None),
        apply_delta=bool(abs_original_bundle_path), 
        verbose_logging=False 
    )
    num_files_prelim = len(parsed_for_confirm)
    num_delta_files_prelim = sum(1 for pf in parsed_for_confirm if pf.get("has_delta_commands"))
    num_b64_marked_prelim = sum(1 for pf in parsed_for_confirm if pf.get("is_base64_marked"))

    if args.overwrite_policy == "prompt" and sys.stdin.isatty() and num_files_prelim > 0 :
        print(f"\n--- Bundle Extraction Plan ---\n"
              f"  Source Bundle:    {abs_bundle_file_path}\n"
              f"  Output Directory: {os.path.realpath(os.path.abspath(args.output_directory))}\n"
              f"  Detected Format:  {prelim_fmt_desc}" + 
              (f"\n  Format Override:  Interpreting primary text as {args.input_format.upper()}" if args.input_format != "auto" else "") +
              (f"\n  Original Bundle:  {abs_original_bundle_path} (for Delta)" if abs_original_bundle_path else "") +
              f"\n  Overwrite Policy: {args.overwrite_policy.capitalize()}\n"
              f"  Files to process: {num_files_prelim}" +
              (f" ({num_delta_files_prelim} with deltas)" if num_delta_files_prelim > 0 else "") +
              (f" ({num_b64_marked_prelim} marked Base64)" if num_b64_marked_prelim > 0 else ""))
        if not confirm_action_cli_prompt("\nProceed with extraction?"): 
            print("Extraction cancelled.", file=sys.stderr); return

    print("\nStarting extraction process...", file=sys.stderr)
    extraction_results = extract_bundle_from_string(
        bundle_content_str=bundle_content_str, output_dir_base=args.output_directory,
        overwrite_policy=effective_overwrite_policy,
        apply_delta_from_original_bundle_path=abs_original_bundle_path,
        input_format_override=(args.input_format if args.input_format != "auto" else None),
        verbose_logging=args.verbose
    )

    ext = sum(1 for r in extraction_results if r["status"] == "extracted")
    skip = sum(1 for r in extraction_results if r["status"] == "skipped")
    err = sum(1 for r in extraction_results if r["status"] == "error")
    print(f"\n--- Extraction Summary ---\n  Files Extracted: {ext}" + 
          (f"\n  Files Skipped:   {skip}" if skip > 0 else "") + 
          (f"\n  Errors:          {err}" if err > 0 else ""), file=sys.stderr)
    if num_files_prelim == 0 and not any(r["status"]=="error" for r in extraction_results) : 
        print("  No file content was found or parsed in the bundle.", file=sys.stderr)
    if err > 0: sys.exit(1)


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
