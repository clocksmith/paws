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

# Regex for explicit markers with emoji
CATS_FILE_START_MARKER_REGEX = re.compile(
    r"^\s*🐈\s*-{3,}\s*CATS_START_FILE\s*:\s*(.+?)\s*-{3,}$", re.IGNORECASE
)
CATS_FILE_END_MARKER_REGEX = re.compile(
    r"^\s*🐈\s*-{3,}\s*CATS_END_FILE\s*-{3,}$", re.IGNORECASE
)
DOGS_FILE_START_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_START_FILE\s*:\s*(.+?)\s*-{3,}$", re.IGNORECASE
)
DOGS_FILE_END_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_END_FILE\s*-{3,}$", re.IGNORECASE
)

# Delta Command Regex
PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s*(.+?)\s*@@\s*$")
REPLACE_LINES_REGEX = re.compile(
    r"REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)
INSERT_AFTER_LINE_REGEX = re.compile(r"INSERT_AFTER_LINE\(\s*(\d+)\s*\)", re.IGNORECASE)
DELETE_LINES_REGEX = re.compile(
    r"DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)

# Regex for heuristic parsing
LLM_EDITING_FILE_REGEX = re.compile(
    r"^\s*(?:\*\*|__)?(?:editing|generating|file|now generating file|processing|current file)\s*(?::)?\s*[`\"]?(?P<filepath>[\w./\\~-]+)[`\"]?(?:\s*\(.*\)|\s*\b(?:and|also|with|which)\b.*|\s+`?#.*|\s*(?:\*\*|__).*)?$",
    re.IGNORECASE,
)
MARKDOWN_CODE_FENCE_REGEX = re.compile(r"^\s*```(?:[\w+\-.]+)?\s*$")
HUMAN_CONTINUATION_PROMPT_REGEX = re.compile(
    r"^\s*(continue|proceed|c|next|go on|resume|okay[,]? continue|cont\.?)\s*[:.!]?\s*$",
    re.IGNORECASE,
)

# --- Type Aliases ---
ParsedFile = Dict[str, Any]
DeltaCommand = Dict[str, Any]
ExtractionResult = Dict[str, str]
ParseResult = Tuple[List[ParsedFile], str, Optional[str]]


# --- Path Sanitization ---
def sanitize_path_component(comp: str) -> str:
    if not comp or comp == "." or comp == "..":
        return "_sanitized_dots_"
    sanitized = re.sub(r"[^\w.\-_]", "_", comp)
    sanitized = re.sub(r"_+", "_", sanitized)
    sanitized = re.sub(r"^[._]+|[._]+$", "", sanitized)
    return sanitized if sanitized else "sanitized_empty_comp"


def sanitize_relative_path(rel_path_from_bundle: str) -> str:
    normalized_path = rel_path_from_bundle.replace("\\", "/")
    parts = normalized_path.split("/")
    sanitized_parts = [
        sanitize_path_component(part)
        for part in parts
        if part and part != "." and part != ".."
    ]
    if not sanitized_parts:
        return (
            sanitize_path_component(os.path.basename(rel_path_from_bundle))
            or "unnamed_file_from_bundle"
        )
    return os.path.join(*sanitized_parts)


# --- Core Parsing Logic ---


def parse_original_bundle_for_delta(
    original_bundle_path: str, verbose_logging: bool = False
) -> Dict[str, List[str]]:
    """Parses the original cats bundle into a dict mapping relative paths to lines."""
    original_files: Dict[str, List[str]] = {}
    try:
        with open(
            original_bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace"
        ) as f:
            original_content = f.read()
    except Exception as e:
        print(
            f"  Error: Could not read original bundle '{original_bundle_path}' for delta: {e}",
            file=sys.stderr,
        )
        return {}

    lines = original_content.splitlines()
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    in_block = False

    for line_text in lines:
        stripped_line = line_text.strip()
        start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
        end_match = CATS_FILE_END_MARKER_REGEX.match(stripped_line)

        if start_match:
            if in_block and current_file_path:
                if verbose_logging:
                    print(
                        f"  Warning (Original Parse): New file '{start_match.group(1).strip()}' started before '{current_file_path}' ended.",
                        file=sys.stderr,
                    )
                original_files[current_file_path] = current_content_lines
            current_file_path = start_match.group(1).strip()
            current_content_lines = []
            in_block = True
            continue

        if end_match and in_block:
            if current_file_path:
                original_files[current_file_path] = current_content_lines
            current_file_path = None
            current_content_lines = []
            in_block = False
            continue

        if in_block:
            current_content_lines.append(line_text)

    if in_block and current_file_path:
        if verbose_logging:
            print(
                f"  Warning (Original Parse): Bundle ended mid-file for '{current_file_path}'. Using content found.",
                file=sys.stderr,
            )
        original_files[current_file_path] = current_content_lines
    return original_files


def parse_bundle_content(
    bundle_content: str,
    forced_format_override: Optional[str] = None,
    apply_delta: bool = False,
    verbose_logging: bool = False,
) -> ParseResult:
    lines = bundle_content.splitlines()
    parsed_files: List[ParsedFile] = []

    bundle_format_is_b64: Optional[bool] = None
    bundle_format_encoding: str = DEFAULT_ENCODING
    format_description = "Unknown (Header not found or not recognized)"
    header_lines_consumed = 0

    possible_headers = [
        (DOGS_BUNDLE_HEADER_PREFIX, "Dogs Bundle (LLM Output)"),
        (CATS_BUNDLE_HEADER_PREFIX, "Cats Bundle (Original Source)"),
    ]
    header_type_found = None

    for i, line_text in enumerate(lines[:10]): # Check up to 10 lines for header
        stripped = line_text.strip()
        if not header_type_found:
            for prefix_str, desc_str_part in possible_headers:
                if stripped.startswith(prefix_str):
                    header_type_found = desc_str_part
                    header_lines_consumed = max(header_lines_consumed, i + 1)
                    break
            if header_type_found: continue

        if header_type_found and stripped.startswith(BUNDLE_FORMAT_PREFIX):
            header_lines_consumed = max(header_lines_consumed, i + 1)
            temp_format_description = stripped[len(BUNDLE_FORMAT_PREFIX) :].strip()
            format_description = f"{header_type_found} - Format: {temp_format_description}"
            fmt_lower = temp_format_description.lower()

            if "base64" in fmt_lower:
                bundle_format_is_b64 = True
                bundle_format_encoding = "ascii"
            elif "utf-16le" in fmt_lower or "utf-16 le" in fmt_lower:
                bundle_format_is_b64 = False
                bundle_format_encoding = "utf-16le"
            elif "utf-8" in fmt_lower:
                bundle_format_is_b64 = False
                bundle_format_encoding = "utf-8"
            else:
                bundle_format_is_b64 = False
                bundle_format_encoding = "utf-8"
                format_description += f" (Unrecognized format details, defaulting to Raw UTF-8)"
            break 

    if forced_format_override:
        override_lower = forced_format_override.lower()
        if override_lower == "b64":
            bundle_format_is_b64 = True; bundle_format_encoding = "ascii"
            format_description = f"{header_type_found or 'Bundle'} - Format: Base64 (Overridden by user)"
        elif override_lower == "utf16le":
            bundle_format_is_b64 = False; bundle_format_encoding = "utf-16le"
            format_description = f"{header_type_found or 'Bundle'} - Format: Raw UTF-16LE (Overridden by user)"
        elif override_lower == "utf8":
            bundle_format_is_b64 = False; bundle_format_encoding = "utf-8"
            format_description = f"{header_type_found or 'Bundle'} - Format: Raw UTF-8 (Overridden by user)"

    if bundle_format_is_b64 is None:
        bundle_format_is_b64 = False; bundle_format_encoding = "utf-8"
        format_description = f"Raw UTF-8 (Assumed, no valid header found)"
        if verbose_logging: print(f"  Info: {format_description}", file=sys.stderr)

    # effective_encoding is what the bundle content itself *is* (e.g., base64 strings, or utf-8/utf-16le text blocks)
    effective_encoding_for_bundle_content_blocks = "base64" if bundle_format_is_b64 else bundle_format_encoding

    current_state = "LOOKING_FOR_ANY_START"
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    current_delta_commands: List[DeltaCommand] = []
    has_delta_commands_in_block = False
    in_markdown_code_block = False
    line_iter_obj = iter(enumerate(lines[header_lines_consumed:]))

    for line_idx_rel, line_text in line_iter_obj:
        actual_line_num = line_idx_rel + header_lines_consumed + 1
        stripped_line = line_text.strip()
        is_dogs_end = DOGS_FILE_END_MARKER_REGEX.match(stripped_line)
        is_cats_end = CATS_FILE_END_MARKER_REGEX.match(stripped_line)

        if ((is_dogs_end or is_cats_end) and current_file_path and current_state == "IN_EXPLICIT_BLOCK"):
            file_content_or_deltas: Union[bytes, List[DeltaCommand], None] = None
            final_block_format_type = effective_encoding_for_bundle_content_blocks

            if apply_delta and has_delta_commands_in_block:
                if (current_delta_commands and current_delta_commands[-1]["type"] != "delete"):
                    current_delta_commands[-1]["content_lines"] = current_content_lines
                file_content_or_deltas = current_delta_commands
                final_block_format_type = "delta"
            else:
                raw_content = "\n".join(current_content_lines)
                try:
                    if effective_encoding_for_bundle_content_blocks == "base64":
                        file_content_or_deltas = base64.b64decode("".join(raw_content.split()))
                    elif effective_encoding_for_bundle_content_blocks == "utf-16le":
                        file_content_or_deltas = raw_content.encode("utf-16le")
                    else: # utf-8
                        file_content_or_deltas = raw_content.encode("utf-8")
                except Exception as e:
                    print(f"  Error (L{actual_line_num}): Failed to decode content for '{current_file_path}' on explicit END. Skipped. Error: {e}", file=sys.stderr)
                    # Reset state and continue to next file block
                    current_state = "LOOKING_FOR_ANY_START"; current_file_path = None; current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False; in_markdown_code_block = False
                    continue
            
            if file_content_or_deltas is not None:
                parsed_files.append({
                    "path_in_bundle": current_file_path,
                    "content_bytes": file_content_or_deltas if final_block_format_type != "delta" else None,
                    "delta_commands": file_content_or_deltas if final_block_format_type == "delta" else None,
                    "format_used_for_decode": final_block_format_type,
                    "has_delta_commands": has_delta_commands_in_block,
                })
            # Reset state for next file block
            current_state = "LOOKING_FOR_ANY_START"; current_file_path = None; current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False; in_markdown_code_block = False
            continue

        if apply_delta and current_state == "IN_EXPLICIT_BLOCK":
            paws_cmd_match = PAWS_CMD_REGEX.match(line_text)
            if paws_cmd_match:
                command_str = paws_cmd_match.group(1).strip(); delta_cmd: Optional[DeltaCommand] = None
                replace_match = REPLACE_LINES_REGEX.match(command_str); insert_match = INSERT_AFTER_LINE_REGEX.match(command_str); delete_match = DELETE_LINES_REGEX.match(command_str)
                if (current_delta_commands and current_delta_commands[-1]["type"] != "delete"):
                    current_delta_commands[-1]["content_lines"] = current_content_lines
                current_content_lines = []
                if replace_match: delta_cmd = {"type": "replace", "start": int(replace_match.group(1)), "end": int(replace_match.group(2))}
                elif insert_match: delta_cmd = {"type": "insert", "line_num": int(insert_match.group(1))}
                elif delete_match: delta_cmd = {"type": "delete", "start": int(delete_match.group(1)), "end": int(delete_match.group(2))}
                if delta_cmd:
                    current_delta_commands.append(delta_cmd); has_delta_commands_in_block = True
                else: # Unrecognized PAWS_CMD, treat as content line if necessary or log
                    if verbose_logging: print(f"  Warning (L{actual_line_num}): Unrecognized PAWS_CMD format: '{command_str}'", file=sys.stderr)
                    current_content_lines.append(line_text) # Potentially risky, but per original logic
                continue

        if current_state == "LOOKING_FOR_ANY_START":
            dogs_start_match = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            cats_start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            llm_editing_match = LLM_EDITING_FILE_REGEX.match(line_text)
            if dogs_start_match: current_file_path = dogs_start_match.group(1).strip(); current_state = "IN_EXPLICIT_BLOCK"
            elif cats_start_match: current_file_path = cats_start_match.group(1).strip(); current_state = "IN_EXPLICIT_BLOCK"
            elif llm_editing_match and not apply_delta : # Heuristic only if not in delta mode (per original logic)
                current_file_path = llm_editing_match.group("filepath").strip(); current_state = "IN_HEURISTIC_BLOCK"
                try: # Check for markdown fence
                    _, next_line_text = next(line_iter_obj)
                    if MARKDOWN_CODE_FENCE_REGEX.match(next_line_text.strip()): in_markdown_code_block = True
                    else: current_content_lines.append(next_line_text) # Heuristic block starts with this line
                except StopIteration: pass
            # Reset fields for new block if starting
            if current_state != "LOOKING_FOR_ANY_START":
                current_content_lines = []; current_delta_commands = []; has_delta_commands_in_block = False
                if current_state != "IN_HEURISTIC_BLOCK": in_markdown_code_block = False # Reset for explicit blocks

        elif current_state == "IN_EXPLICIT_BLOCK":
            current_content_lines.append(line_text)

        elif current_state == "IN_HEURISTIC_BLOCK": # (and not apply_delta)
            next_dogs_start = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            next_cats_start = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            next_llm_editing = LLM_EDITING_FILE_REGEX.match(line_text)
            if next_dogs_start or next_cats_start or next_llm_editing: # New file starts
                raw_content_h = "\n".join(current_content_lines)
                try:
                    if current_file_path:
                        bytes_h: Optional[bytes] = None
                        if effective_encoding_for_bundle_content_blocks == "base64": bytes_h = base64.b64decode("".join(raw_content_h.split()))
                        elif effective_encoding_for_bundle_content_blocks == "utf-16le": bytes_h = raw_content_h.encode("utf-16le")
                        else: bytes_h = raw_content_h.encode("utf-8")
                        parsed_files.append({"path_in_bundle": current_file_path, "content_bytes": bytes_h, "delta_commands": None, "format_used_for_decode": effective_encoding_for_bundle_content_blocks, "has_delta_commands": False})
                except Exception as e: print(f"  Error (L{actual_line_num}): Failed to decode heuristic block '{current_file_path}'. Skipped. Error: {e}", file=sys.stderr)
                current_state = "LOOKING_FOR_ANY_START"; current_file_path = None; current_content_lines = []; in_markdown_code_block = False # Reset
                line_iter_obj = iter([(line_idx_rel, line_text)] + list(line_iter_obj)); continue # Re-process current line
            
            if MARKDOWN_CODE_FENCE_REGEX.match(stripped_line):
                if in_markdown_code_block: in_markdown_code_block = False
                else: in_markdown_code_block = True
                continue # Skip fence line from content
            current_content_lines.append(line_text)

    # Finalize any open block at EOF
    if current_file_path and (current_content_lines or (apply_delta and has_delta_commands_in_block and current_delta_commands)):
        file_content_or_deltas_eof: Union[bytes, List[DeltaCommand], None] = None
        final_block_format_type_eof = effective_encoding_for_bundle_content_blocks

        if apply_delta and has_delta_commands_in_block and current_state == "IN_EXPLICIT_BLOCK":
            if (current_delta_commands and current_delta_commands[-1]["type"] != "delete"):
                current_delta_commands[-1]["content_lines"] = current_content_lines
            file_content_or_deltas_eof = current_delta_commands
            final_block_format_type_eof = "delta"
        elif current_state in ["IN_EXPLICIT_BLOCK", "IN_HEURISTIC_BLOCK"]:
            raw_content_eof = "\n".join(current_content_lines)
            try:
                if effective_encoding_for_bundle_content_blocks == "base64": file_content_or_deltas_eof = base64.b64decode("".join(raw_content_eof.split()))
                elif effective_encoding_for_bundle_content_blocks == "utf-16le": file_content_or_deltas_eof = raw_content_eof.encode("utf-16le")
                else: file_content_or_deltas_eof = raw_content_eof.encode("utf-8")
            except Exception as e: print(f"  Error: Failed to decode final EOF block '{current_file_path}'. Discarded. Error: {e}", file=sys.stderr)
        
        if file_content_or_deltas_eof is not None:
            parsed_files.append({
                "path_in_bundle": current_file_path,
                "content_bytes": file_content_or_deltas_eof if final_block_format_type_eof != "delta" else None,
                "delta_commands": file_content_or_deltas_eof if final_block_format_type_eof == "delta" else None,
                "format_used_for_decode": final_block_format_type_eof,
                "has_delta_commands": has_delta_commands_in_block and final_block_format_type_eof == "delta",
            })
    # `bundle_format_encoding` is the encoding of text within the bundle if not base64
    # `effective_encoding_for_bundle_content_blocks` is 'base64', 'utf-8', or 'utf-16le' based on header/override
    return parsed_files, format_description, effective_encoding_for_bundle_content_blocks


def apply_delta_commands(
    original_lines: List[str], delta_commands: List[DeltaCommand], file_path_for_log: str
) -> List[str]:
    new_lines = list(original_lines)
    offset = 0
    for cmd_idx, cmd in enumerate(delta_commands):
        cmd_type = cmd["type"]
        try:
            if cmd_type == "replace":
                start_1based, end_1based = cmd["start"], cmd["end"]
                if not (isinstance(start_1based, int) and isinstance(end_1based, int) and start_1based > 0 and end_1based >= start_1based): raise ValueError("Invalid line numbers for REPLACE")
                start_0based, end_0based = start_1based - 1, end_1based - 1
                adj_start, adj_end = start_0based + offset, end_0based + offset
                if not (0 <= adj_start <= adj_end < len(new_lines) + (1 if adj_start == len(new_lines) else 0) ): # Allow replacing end "phantom" line if list is empty
                     # More precise check: adj_start must be valid index, adj_end can be up to len-1
                     if not(0 <= adj_start < len(new_lines) or (adj_start == 0 and len(new_lines) == 0)) or adj_end >= len(new_lines) :
                        raise ValueError(f"Line numbers [{adj_start+1}-{adj_end+1}] out of bounds for {len(new_lines)} lines after offset.")
                
                num_to_delete = (adj_end - adj_start) + 1
                content_to_insert = cmd.get("content_lines", [])
                num_to_insert = len(content_to_insert)
                
                del new_lines[adj_start : adj_end + 1]
                for i, line_content in enumerate(content_to_insert): new_lines.insert(adj_start + i, line_content)
                offset += num_to_insert - num_to_delete

            elif cmd_type == "insert":
                line_num_1based = cmd["line_num"]
                if not (isinstance(line_num_1based, int) and line_num_1based >= 0): raise ValueError("Invalid line number for INSERT")
                insert_idx_0based = line_num_1based # 0 means before first line, N means after line N (at index N)
                adj_insert_idx = insert_idx_0based + offset
                if not (0 <= adj_insert_idx <= len(new_lines)): raise ValueError(f"Line number {adj_insert_idx} out of bounds for {len(new_lines)} lines after offset.")
                
                content_to_insert = cmd.get("content_lines", [])
                num_to_insert = len(content_to_insert)
                for i, line_content in enumerate(content_to_insert): new_lines.insert(adj_insert_idx + i, line_content)
                offset += num_to_insert

            elif cmd_type == "delete":
                start_1based, end_1based = cmd["start"], cmd["end"]
                if not (isinstance(start_1based, int) and isinstance(end_1based, int) and start_1based > 0 and end_1based >= start_1based): raise ValueError("Invalid line numbers for DELETE")
                start_0based, end_0based = start_1based - 1, end_1based - 1
                adj_start, adj_end = start_0based + offset, end_0based + offset
                if not (0 <= adj_start <= adj_end < len(new_lines)): raise ValueError(f"Line numbers [{adj_start+1}-{adj_end+1}] out of bounds for {len(new_lines)} lines after offset.")

                num_to_delete = (adj_end - adj_start) + 1
                del new_lines[adj_start : adj_end + 1]
                offset -= num_to_delete
        except Exception as e:
            print(f"  Error applying delta command #{cmd_idx+1} ({cmd.get('type', 'Unknown')}) to '{file_path_for_log}': {e}. Skipping.", file=sys.stderr)
    return new_lines


# --- Extraction to Disk & CLI ---
def extract_bundle_to_disk(
    parsed_files: List[ParsedFile],
    output_dir_base_abs: str,
    overwrite_policy: str,
    bundle_level_effective_encoding: str, # Added: 'base64', 'utf-8', or 'utf-16le'
    apply_delta_from_original_bundle: Optional[str] = None,
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    results: List[ExtractionResult] = []
    always_yes = overwrite_policy == "yes"; always_no = overwrite_policy == "no"
    user_quit_extraction = False

    original_bundle_files: Dict[str, List[str]] = {}
    if apply_delta_from_original_bundle:
        original_bundle_files = parse_original_bundle_for_delta(apply_delta_from_original_bundle, verbose_logging)
        if not original_bundle_files and any(f.get("has_delta_commands") for f in parsed_files):
            print(f"  Warning: Delta active, but failed to load original bundle '{apply_delta_from_original_bundle}'. Deltas cannot be applied.", file=sys.stderr)
            apply_delta_from_original_bundle = None

    for file_info in parsed_files:
        if user_quit_extraction:
            results.append({"path": file_info["path_in_bundle"], "status": "skipped", "message": "User quit extraction process."}); continue

        original_path_from_marker = file_info["path_in_bundle"]
        sanitized_output_rel_path = sanitize_relative_path(original_path_from_marker)
        prospective_abs_output_path = os.path.normpath(os.path.join(output_dir_base_abs, sanitized_output_rel_path))

        try: # Path Traversal Check
            if not os.path.abspath(prospective_abs_output_path).startswith(os.path.abspath(output_dir_base_abs)):
                raise IsADirectoryError("Path traversal attempt detected")
        except Exception as path_e:
            msg = f"Security Alert: Path '{sanitized_output_rel_path}' (from '{original_path_from_marker}') seems outside base output directory. Skipping. Error: {path_e}"
            print(f"  Error: {msg}", file=sys.stderr); results.append({"path": original_path_from_marker, "status": "error", "message": msg}); continue

        perform_actual_write = True; file_content_to_write: Optional[bytes] = None

        if apply_delta_from_original_bundle and file_info.get("has_delta_commands"):
            original_lines = original_bundle_files.get(original_path_from_marker)
            delta_commands = file_info.get("delta_commands")
            if original_lines is None:
                msg = f"Delta for '{original_path_from_marker}', but file not in original bundle. Cannot apply."
                print(f"  Error: {msg}", file=sys.stderr); results.append({"path": original_path_from_marker, "status": "error", "message": msg}); perform_actual_write = False
            elif not delta_commands:
                msg = f"Internal inconsistency: Delta flagged but no commands for '{original_path_from_marker}'."
                print(f"  Error: {msg}", file=sys.stderr); results.append({"path": original_path_from_marker, "status": "error", "message": msg}); perform_actual_write = False
            else:
                new_content_lines = apply_delta_commands(original_lines, delta_commands, original_path_from_marker)
                # Determine encoding for the output of delta-applied text
                text_encoding_for_delta_output = DEFAULT_ENCODING # Default to utf-8
                if bundle_level_effective_encoding == "utf-16le":
                    text_encoding_for_delta_output = "utf-16le"
                # If bundle_level_effective_encoding is "base64", deltas apply to text, so outputting as UTF-8 is reasonable.
                # If bundle_level_effective_encoding is "utf-8", then use "utf-8".
                
                try:
                    file_content_to_write = "\n".join(new_content_lines).encode(text_encoding_for_delta_output)
                    if verbose_logging: print(f"  Info: Delta result for '{original_path_from_marker}' will be encoded as {text_encoding_for_delta_output}.")
                except Exception as enc_e:
                    msg = f"Failed to encode delta result for '{original_path_from_marker}' as {text_encoding_for_delta_output}: {enc_e}"
                    print(f"  Error: {msg}", file=sys.stderr); results.append({"path": original_path_from_marker, "status": "error", "message": msg}); perform_actual_write = False
        else: # Full content
            file_content_to_write = file_info.get("content_bytes", b"")

        if perform_actual_write and file_content_to_write is not None:
            if os.path.lexists(prospective_abs_output_path):
                if os.path.isdir(prospective_abs_output_path) and not os.path.islink(prospective_abs_output_path):
                    msg = f"Path '{sanitized_output_rel_path}' exists as a directory. Skipping."; print(f"  Warning: {msg}", file=sys.stderr); results.append({"path": original_path_from_marker, "status": "error", "message": msg}); perform_actual_write = False
                elif always_yes: pass # Proceed
                elif always_no: results.append({"path": original_path_from_marker, "status": "skipped", "message": "File exists (policy: no)."}); perform_actual_write = False
                else: # Prompt
                    if not sys.stdin.isatty(): perform_actual_write = False; results.append({"path": original_path_from_marker, "status": "skipped", "message": "File exists (non-interactive, default no)."})
                    else:
                        while True:
                            try:
                                choice = input(f"File '{sanitized_output_rel_path}' exists. Overwrite? [(y)es/(N)o/(a)ll yes/(s)kip all/(q)uit]: ").strip().lower()
                                if choice == "y": break
                                if choice == "n" or choice == "": perform_actual_write = False; results.append({"path": original_path_from_marker, "status": "skipped", "message": "File exists (user chose no)."}); break
                                if choice == "a": always_yes = True; break
                                if choice == "s": always_no = True; perform_actual_write = False; results.append({"path": original_path_from_marker, "status": "skipped", "message": "File exists (user chose skip all)."}); break
                                if choice == "q": user_quit_extraction = True; perform_actual_write = False; break
                                print("Invalid choice.")
                            except (KeyboardInterrupt, EOFError): user_quit_extraction = True; perform_actual_write = False; print("\nExtraction cancelled."); break
            
            if user_quit_extraction and not perform_actual_write:
                if not any(r["path"] == original_path_from_marker and r["status"] == "skipped" for r in results): results.append({"path": original_path_from_marker, "status": "skipped", "message": "User quit extraction process."})
                continue

            if perform_actual_write:
                try:
                    output_file_dir = os.path.dirname(prospective_abs_output_path)
                    if not os.path.exists(output_file_dir): os.makedirs(output_file_dir, exist_ok=True)
                    if os.path.islink(prospective_abs_output_path): os.unlink(prospective_abs_output_path)
                    with open(prospective_abs_output_path, "wb") as f_out: f_out.write(file_content_to_write)
                    results.append({"path": original_path_from_marker, "status": "extracted", "message": f"Extracted to {sanitized_output_rel_path}"})
                except Exception as e_write:
                    msg = f"Error writing file '{sanitized_output_rel_path}': {e_write}"; print(f"  Error: {msg}", file=sys.stderr); results.append({"path": original_path_from_marker, "status": "error", "message": msg})
        elif perform_actual_write and file_content_to_write is None: # Error occurred during delta processing
            if not any(r["path"] == original_path_from_marker and r["status"] == "error" for r in results): results.append({"path": original_path_from_marker, "status": "error", "message": "Content generation failed (e.g. delta error), write skipped."})
    return results


def extract_bundle_to_memory(
    bundle_content: Optional[str] = None, bundle_path: Optional[str] = None,
    input_format_override: Optional[str] = None, verbose_logging: bool = False,
) -> List[ParsedFile]:
    if bundle_path and not bundle_content:
        try:
            with open(bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace") as f: bundle_content = f.read()
        except Exception as e: print(f"Error reading bundle file '{bundle_path}': {e}", file=sys.stderr); return []
    elif not bundle_content and bundle_content != "": print("Error: No bundle content or path provided.", file=sys.stderr); return []
    elif bundle_content is None: print("Error: No bundle content provided.", file=sys.stderr); return []
    
    parsed_files, _, _ = parse_bundle_content(bundle_content, input_format_override, apply_delta=False, verbose_logging=verbose_logging)
    return parsed_files


def extract_bundle_from_string(
    bundle_content: Optional[str] = None, bundle_path: Optional[str] = None,
    output_dir_base: str = ".", overwrite_policy: str = "prompt",
    apply_delta_from_original_bundle: Optional[str] = None,
    input_format_override: Optional[str] = None, verbose_logging: bool = False,
) -> List[ExtractionResult]:
    if bundle_path and not bundle_content:
        try:
            with open(bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace") as f: bundle_content = f.read()
        except Exception as e: return [{"path": bundle_path, "status": "error", "message": f"Failed to read bundle file: {e}"}]
    elif not bundle_content and bundle_content != "": return [{"path": "bundle", "status": "error", "message": "No bundle content or path provided."}]
    elif bundle_content is None: return [{"path": "bundle", "status": "error", "message": "No bundle content provided."}]

    abs_output_dir = os.path.realpath(os.path.abspath(output_dir_base))
    if not os.path.exists(abs_output_dir):
        try: os.makedirs(abs_output_dir, exist_ok=True)
        except Exception as e: return [{"path": output_dir_base, "status": "error", "message": f"Failed to create output directory '{abs_output_dir}': {e}"}]
    elif not os.path.isdir(abs_output_dir): return [{"path": output_dir_base, "status": "error", "message": f"Output path '{abs_output_dir}' exists but is not a directory."}]

    parsed_files, format_desc, effective_bundle_encoding = parse_bundle_content(
        bundle_content, input_format_override,
        apply_delta=bool(apply_delta_from_original_bundle), verbose_logging=verbose_logging
    )
    if verbose_logging: print(f"  Info: Bundle parsing complete. Format: {format_desc}. Files parsed: {len(parsed_files)}.")
    if not parsed_files: return [{"path": "bundle", "status": "skipped", "message": "No files found or parsed from the bundle content."}]

    return extract_bundle_to_disk(
        parsed_files, abs_output_dir, overwrite_policy,
        effective_bundle_encoding, # Pass the determined bundle encoding
        apply_delta_from_original_bundle, verbose_logging
    )


def confirm_action_cli_prompt(prompt_message: str) -> bool:
    if not sys.stdin.isatty(): return True 
    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "": return True
            if choice == "n": return False
            print("Invalid input.")
        except (KeyboardInterrupt, EOFError): print("\nOperation cancelled."); return False


def main_cli_dogs():
    parser = argparse.ArgumentParser(description="dogs.py : Extracts files from a 'cats' or LLM-generated bundle, optionally applying deltas.", epilog="Example: python dogs.py results.bundle ./code -y -d project_orig.bundle", formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("bundle_file", nargs="?", default=None, metavar="BUNDLE_FILE", help=f"Bundle file to extract (default: {DEFAULT_INPUT_BUNDLE_FILENAME} if exists).")
    parser.add_argument("output_directory", nargs="?", default=DEFAULT_OUTPUT_DIR, metavar="OUTPUT_DIR", help=f"Directory to extract files into (default: {DEFAULT_OUTPUT_DIR}).")
    parser.add_argument("-d", "--apply-delta", metavar="ORIGINAL_BUNDLE", help="Apply delta commands using ORIGINAL_BUNDLE as base.")
    parser.add_argument("-i", "--input-format", choices=["auto", "b64", "utf8", "utf16le"], default="auto", help="Override bundle format detection (default: auto).")
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
    if not os.path.isfile(abs_bundle_file_path): print(f"Error: Bundle file not found: '{abs_bundle_file_path}'", file=sys.stderr); sys.exit(1)
    abs_original_bundle_path = None
    if args.apply_delta:
        abs_original_bundle_path = os.path.realpath(os.path.abspath(args.apply_delta))
        if not os.path.isfile(abs_original_bundle_path): print(f"Error: Original bundle for delta not found: '{abs_original_bundle_path}'", file=sys.stderr); sys.exit(1)

    bundle_content_str = ""
    try:
        with open(abs_bundle_file_path, "r", encoding=DEFAULT_ENCODING, errors="replace") as f: bundle_content_str = f.read()
    except Exception as e: print(f"Error reading bundle file '{abs_bundle_file_path}': {e}", file=sys.stderr); sys.exit(1)

    effective_overwrite_policy = args.overwrite_policy
    if not sys.stdin.isatty() and args.overwrite_policy == "prompt": effective_overwrite_policy = "no"
    
    # Pass apply_delta argument to parse_bundle_content to enable delta parsing
    parsed_for_confirmation, prelim_format_desc, _ = parse_bundle_content(
        bundle_content_str,
        forced_format_override=(args.input_format if args.input_format != "auto" else None),
        apply_delta=bool(abs_original_bundle_path), # Enable delta parsing if -d is used
        verbose_logging=False 
    )
    num_files_prelim = len(parsed_for_confirmation)
    num_delta_files_prelim = sum(1 for pf in parsed_for_confirmation if pf.get("has_delta_commands"))

    if args.overwrite_policy == "prompt" and sys.stdin.isatty():
        print(f"\n--- Bundle Extraction Plan ---\n  Source Bundle:    {abs_bundle_file_path}" + (f"\n  Original Bundle:  {abs_original_bundle_path} (for Delta)" if abs_original_bundle_path else "") + f"\n  Detected Format:  {prelim_format_desc}" + (f"\n  Format Override:  Will interpret as {'Base64' if args.input_format == 'b64' else ('UTF-16LE' if args.input_format=='utf16le' else 'UTF-8')}" if args.input_format != "auto" else "") + f"\n  Output Directory: {os.path.realpath(os.path.abspath(args.output_directory))}\n  Overwrite Policy: {args.overwrite_policy.capitalize()}\n  Files to process: {num_files_prelim}" + (f" ({num_delta_files_prelim} with delta commands)" if num_delta_files_prelim > 0 else ""))
        if not confirm_action_cli_prompt("\nProceed with extraction?"): print("Extraction cancelled."); return

    print("\nStarting extraction process...")
    extraction_results = extract_bundle_from_string(
        bundle_content=bundle_content_str, output_dir_base=args.output_directory,
        overwrite_policy=effective_overwrite_policy,
        apply_delta_from_original_bundle=abs_original_bundle_path,
        input_format_override=(args.input_format if args.input_format != "auto" else None),
        verbose_logging=args.verbose
    )

    ext = sum(1 for r in extraction_results if r["status"] == "extracted"); skip = sum(1 for r in extraction_results if r["status"] == "skipped"); err = sum(1 for r in extraction_results if r["status"] == "error")
    print(f"\n--- Extraction Summary ---\n  Files Extracted: {ext}" + (f"\n  Files Skipped:   {skip}" if skip else "") + (f"\n  Errors:          {err}" if err else ""))
    if num_files_prelim == 0: print("  No file content was found or parsed in the bundle.")

if __name__ == "__main__":
    main_cli_dogs()