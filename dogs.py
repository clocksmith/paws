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
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs_in.bundle"  # Changed default
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

# Regex for heuristic parsing (unchanged)
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
# Represents a parsed file block from the bundle.
# If 'delta_commands' is present, 'content_bytes' should be None (and vice-versa).
ParsedFile = Dict[str, Any]
# Expected keys:
#   path_in_bundle: str
#   content_bytes: Optional[bytes]
#   delta_commands: Optional[List[DeltaCommand]]
#   format_used_for_decode: str  # 'utf8', 'utf16le', 'b64', or 'delta'
#   has_delta_commands: bool

# Represents a single delta command parsed from a file block.
DeltaCommand = Dict[str, Any]
# Expected keys:
#   type: str  # 'replace', 'insert', 'delete'
#   start: Optional[int]  # 1-based start line (for replace/delete)
#   end: Optional[int]  # 1-based end line (for replace/delete)
#   line_num: Optional[int]  # 1-based line num insert is *after* (for insert)
#   content_lines: Optional[List[str]]  # Lines for replace/insert

# Represents the outcome of trying to extract one file.
ExtractionResult = Dict[str, str]
# Expected keys:
#   path: str  # Original path from bundle marker
#   status: str  # e.g., 'extracted', 'skipped', 'error'
#   message: str # Description of outcome or error

# Represents the overall result of parsing a bundle.
ParseResult = Tuple[List[ParsedFile], str, Optional[str]]
# Structure: (list_of_parsed_files, format_description_string, effective_encoding_string_or_None)


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
        return {}  # Return empty if original cannot be read

    # Use the main parser to get files, but ignore format/heuristics, just get CATS blocks
    # Need a simpler parser here just for original content lines
    lines = original_content.splitlines()
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    in_block = False

    for line_text in lines:
        stripped_line = line_text.strip()
        start_match = CATS_FILE_START_MARKER_REGEX.match(
            stripped_line
        )  # Only look for CATS in original
        end_match = CATS_FILE_END_MARKER_REGEX.match(stripped_line)

        if start_match:
            if in_block and current_file_path:
                if verbose_logging:
                    print(
                        f"  Warning (Original Parse): New file '{start_match.group(1).strip()}' started before '{current_file_path}' ended.",
                        file=sys.stderr,
                    )
                original_files[current_file_path] = (
                    current_content_lines  # Store potentially incomplete block
                )

            current_file_path = start_match.group(1).strip()
            current_content_lines = []
            in_block = True
            continue

        if end_match and in_block:
            if current_file_path:
                original_files[current_file_path] = current_content_lines
                if verbose_logging:
                    print(
                        f"  Debug (Original Parse): Loaded {len(current_content_lines)} lines for '{current_file_path}'"
                    )
            current_file_path = None
            current_content_lines = []
            in_block = False
            continue

        if in_block:
            current_content_lines.append(
                line_text
            )  # Keep original line endings implicitly via splitlines

    if in_block and current_file_path:  # Handle unclosed block at EOF
        if verbose_logging:
            print(
                f"  Warning (Original Parse): Bundle ended mid-file for '{current_file_path}'. Using content found.",
                file=sys.stderr,
            )
        original_files[current_file_path] = current_content_lines

    return original_files


def parse_bundle_content(
    bundle_content: str,
    forced_format_override: Optional[str] = None,  # 'b64', 'utf8', 'utf16le'
    apply_delta: bool = False,  # Flag indicating if delta commands should be parsed
    verbose_logging: bool = False,
) -> ParseResult:
    lines = bundle_content.splitlines()
    parsed_files: List[ParsedFile] = []

    bundle_format_is_b64: Optional[bool] = None
    bundle_format_encoding: str = DEFAULT_ENCODING  # 'utf-8' or 'utf-16le'
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
                    header_type_found = desc_str_part
                    header_lines_consumed = max(header_lines_consumed, i + 1)
                    break
            if header_type_found:
                continue

        if header_type_found and stripped.startswith(BUNDLE_FORMAT_PREFIX):
            header_lines_consumed = max(header_lines_consumed, i + 1)
            temp_format_description = stripped[len(BUNDLE_FORMAT_PREFIX) :].strip()
            format_description = (
                f"{header_type_found} - Format: {temp_format_description}"
            )

            fmt_lower = temp_format_description.lower()
            if "base64" in fmt_lower:
                bundle_format_is_b64 = True
                bundle_format_encoding = "ascii"  # Base64 uses ascii representation
            elif "utf-16le" in fmt_lower or "utf-16 le" in fmt_lower:
                bundle_format_is_b64 = False
                bundle_format_encoding = "utf-16le"
            elif "utf-8" in fmt_lower:
                bundle_format_is_b64 = False
                bundle_format_encoding = "utf-8"
            else:
                bundle_format_is_b64 = False
                bundle_format_encoding = "utf-8"  # Default
                format_description += (
                    f" (Unrecognized format details, defaulting to Raw UTF-8)"
                )
                if verbose_logging:
                    print(
                        f"  Warning: Unrecognized format details: '{temp_format_description}'. Defaulting to UTF-8.",
                        file=sys.stderr,
                    )
            break

    # Override with user's choice
    if forced_format_override:
        override_lower = forced_format_override.lower()
        if override_lower == "b64":
            bundle_format_is_b64 = True
            bundle_format_encoding = "ascii"
            format_description = (
                f"{header_type_found or 'Bundle'} - Format: Base64 (Overridden by user)"
            )
        elif override_lower == "utf16le":
            bundle_format_is_b64 = False
            bundle_format_encoding = "utf-16le"
            format_description = f"{header_type_found or 'Bundle'} - Format: Raw UTF-16LE (Overridden by user)"
        elif override_lower == "utf8":
            bundle_format_is_b64 = False
            bundle_format_encoding = "utf-8"
            format_description = f"{header_type_found or 'Bundle'} - Format: Raw UTF-8 (Overridden by user)"

    if bundle_format_is_b64 is None:  # Still not determined
        bundle_format_is_b64 = False
        bundle_format_encoding = "utf-8"
        format_description = f"Raw UTF-8 (Assumed, no valid header found)"
        if verbose_logging:
            print(f"  Info: {format_description}", file=sys.stderr)

    effective_encoding = "base64" if bundle_format_is_b64 else bundle_format_encoding

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

        if (
            (is_dogs_end or is_cats_end)
            and current_file_path
            and current_state == "IN_EXPLICIT_BLOCK"
        ):
            if verbose_logging:
                print(
                    f"  Debug (L{actual_line_num}): Matched explicit END marker for '{current_file_path}'"
                )

            file_content_or_deltas: Union[bytes, List[DeltaCommand]]
            final_format = effective_encoding

            if apply_delta and has_delta_commands_in_block:
                # Finalize last delta command's content
                if (
                    current_delta_commands
                    and current_delta_commands[-1]["type"] != "delete"
                ):
                    current_delta_commands[-1]["content_lines"] = current_content_lines
                file_content_or_deltas = current_delta_commands
                final_format = "delta"  # Indicate special handling needed
            else:
                # Treat as full content
                raw_content = "\n".join(current_content_lines)
                try:
                    if effective_encoding == "base64":
                        file_content_or_deltas = base64.b64decode(
                            "".join(raw_content.split())
                        )
                    elif effective_encoding == "utf-16le":
                        file_content_or_deltas = raw_content.encode("utf-16le")
                    else:  # utf-8
                        file_content_or_deltas = raw_content.encode("utf-8")
                except Exception as e:
                    print(
                        f"  Error (L{actual_line_num}): Failed to decode content for '{current_file_path}' on explicit END. Skipped. Error: {e}",
                        file=sys.stderr,
                    )
                    current_state = "LOOKING_FOR_ANY_START"
                    current_file_path = None
                    current_content_lines = []
                    current_delta_commands = []
                    has_delta_commands_in_block = False
                    in_markdown_code_block = False
                    continue  # Skip this file

            parsed_files.append(
                {
                    "path_in_bundle": current_file_path,
                    "content_bytes": (
                        file_content_or_deltas
                        if not (apply_delta and has_delta_commands_in_block)
                        else None
                    ),
                    "delta_commands": (
                        file_content_or_deltas
                        if (apply_delta and has_delta_commands_in_block)
                        else None
                    ),
                    "format_used_for_decode": final_format,  # 'utf8', 'utf16le', 'b64', or 'delta'
                    "has_delta_commands": has_delta_commands_in_block,
                }
            )
            current_state = "LOOKING_FOR_ANY_START"
            current_file_path = None
            current_content_lines = []
            current_delta_commands = []
            has_delta_commands_in_block = False
            in_markdown_code_block = False
            continue

        # Check for Delta Command if in explicit block and delta mode is active
        if apply_delta and current_state == "IN_EXPLICIT_BLOCK":
            paws_cmd_match = PAWS_CMD_REGEX.match(
                line_text
            )  # Match on full line for structure
            if paws_cmd_match:
                command_str = paws_cmd_match.group(1).strip()
                delta_cmd: Optional[DeltaCommand] = None

                replace_match = REPLACE_LINES_REGEX.match(command_str)
                insert_match = INSERT_AFTER_LINE_REGEX.match(command_str)
                delete_match = DELETE_LINES_REGEX.match(command_str)

                # Finalize previous command's content lines before starting new command
                if (
                    current_delta_commands
                    and current_delta_commands[-1]["type"] != "delete"
                ):
                    current_delta_commands[-1]["content_lines"] = current_content_lines
                current_content_lines = []  # Reset for next command's content

                if replace_match:
                    delta_cmd = {
                        "type": "replace",
                        "start": int(replace_match.group(1)),
                        "end": int(replace_match.group(2)),
                    }
                elif insert_match:
                    delta_cmd = {
                        "type": "insert",
                        "line_num": int(insert_match.group(1)),
                    }
                elif delete_match:
                    delta_cmd = {
                        "type": "delete",
                        "start": int(delete_match.group(1)),
                        "end": int(delete_match.group(2)),
                    }

                if delta_cmd:
                    if verbose_logging:
                        print(
                            f"  Debug (L{actual_line_num}): Parsed PAWS_CMD: {delta_cmd['type']}"
                        )
                    current_delta_commands.append(delta_cmd)
                    has_delta_commands_in_block = True
                else:
                    if verbose_logging:
                        print(
                            f"  Warning (L{actual_line_num}): Unrecognized PAWS_CMD format: '{command_str}'"
                        )
                    current_content_lines.append(
                        line_text
                    )  # Treat unrecognized command line as content? Risky. Skip? Log and skip.
                continue  # Skip the command line itself from content

        if current_state == "LOOKING_FOR_ANY_START":
            dogs_start_match = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            cats_start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            llm_editing_match = LLM_EDITING_FILE_REGEX.match(line_text)

            if dogs_start_match:
                current_file_path = dogs_start_match.group(1).strip()
                current_state = "IN_EXPLICIT_BLOCK"
                current_content_lines = []
                current_delta_commands = []
                has_delta_commands_in_block = False
                in_markdown_code_block = False
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): Matched DOGS_START for '{current_file_path}'"
                    )
            elif cats_start_match:
                current_file_path = cats_start_match.group(1).strip()
                current_state = "IN_EXPLICIT_BLOCK"
                current_content_lines = []
                current_delta_commands = []
                has_delta_commands_in_block = False
                in_markdown_code_block = False
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): Matched CATS_START for '{current_file_path}'"
                    )
            elif (
                llm_editing_match
            ):  # Heuristic only works for full file content, not delta
                if apply_delta:
                    if verbose_logging:
                        print(
                            f"  Info (L{actual_line_num}): Ignoring heuristic LLM marker in delta mode: '{line_text[:100]}...'"
                        )
                    continue
                current_file_path = llm_editing_match.group("filepath").strip()
                current_state = "IN_HEURISTIC_BLOCK"
                current_content_lines = []
                current_delta_commands = []
                has_delta_commands_in_block = False
                in_markdown_code_block = False
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): Matched LLM_EDITING heuristic for '{current_file_path}'"
                    )
                try:
                    next_line_idx_rel, next_line_text = next(line_iter_obj)
                    actual_next_line_num = next_line_idx_rel + header_lines_consumed + 1
                    if MARKDOWN_CODE_FENCE_REGEX.match(next_line_text.strip()):
                        in_markdown_code_block = True
                        if verbose_logging:
                            print(
                                f"  Debug (L{actual_next_line_num}): Entered markdown block."
                            )
                    else:
                        current_content_lines.append(next_line_text)
                except StopIteration:
                    pass
            elif stripped_line and not HUMAN_CONTINUATION_PROMPT_REGEX.match(
                stripped_line
            ):
                if verbose_logging:
                    print(
                        f"  Info (L{actual_line_num}): Ignoring line while LOOKING_FOR_ANY_START: '{stripped_line[:100]}...'"
                    )

        elif current_state == "IN_EXPLICIT_BLOCK":
            current_content_lines.append(line_text)

        elif current_state == "IN_HEURISTIC_BLOCK":
            next_dogs_start = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            next_cats_start = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            next_llm_editing = LLM_EDITING_FILE_REGEX.match(line_text)

            if next_dogs_start or next_cats_start or next_llm_editing:
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): New file start detected, ending heuristic block for '{current_file_path}'"
                    )
                raw_content_heuristic = "\n".join(current_content_lines)
                try:
                    if current_file_path:
                        if effective_encoding == "base64":
                            file_bytes_h = base64.b64decode(
                                "".join(raw_content_heuristic.split())
                            )
                        elif effective_encoding == "utf-16le":
                            file_bytes_h = raw_content_heuristic.encode("utf-16le")
                        else:
                            file_bytes_h = raw_content_heuristic.encode("utf-8")

                        parsed_files.append(
                            {
                                "path_in_bundle": current_file_path,
                                "content_bytes": file_bytes_h,
                                "delta_commands": None,
                                "format_used_for_decode": effective_encoding,
                                "has_delta_commands": False,
                            }
                        )
                except Exception as e:
                    print(
                        f"  Error (L{actual_line_num}): Failed to decode heuristic block '{current_file_path}'. Skipped. Error: {e}",
                        file=sys.stderr,
                    )

                current_content_lines = []
                current_delta_commands = []
                has_delta_commands_in_block = False
                in_markdown_code_block = False
                current_state = "LOOKING_FOR_ANY_START"
                # Reprocess this line in next loop iteration
                line_iter_obj = iter(
                    [(line_idx_rel, line_text)] + list(line_iter_obj)
                )  # Push back line
                continue

            if MARKDOWN_CODE_FENCE_REGEX.match(stripped_line):
                if in_markdown_code_block:
                    in_markdown_code_block = False
                    if verbose_logging:
                        print(f"  Debug (L{actual_line_num}): Exited markdown block.")
                else:
                    in_markdown_code_block = True
                    if verbose_logging:
                        print(f"  Debug (L{actual_line_num}): Entered markdown block.")
                continue

            current_content_lines.append(line_text)

    # After loop, finalize any open block
    if current_file_path and (current_content_lines or current_delta_commands):
        if verbose_logging:
            print(
                f"  Info: Bundle ended, finalizing last active block for '{current_file_path}' (State: {current_state})"
            )

        file_content_or_deltas_final: Union[bytes, List[DeltaCommand]]
        final_format_eof = effective_encoding

        if (
            apply_delta
            and has_delta_commands_in_block
            and current_state == "IN_EXPLICIT_BLOCK"
        ):
            if (
                current_delta_commands
                and current_delta_commands[-1]["type"] != "delete"
            ):
                current_delta_commands[-1]["content_lines"] = current_content_lines
            file_content_or_deltas_final = current_delta_commands
            final_format_eof = "delta"
        elif current_state in [
            "IN_EXPLICIT_BLOCK",
            "IN_HEURISTIC_BLOCK",
        ]:  # Handle full content EOF
            raw_content_final = "\n".join(current_content_lines)
            try:
                if effective_encoding == "base64":
                    file_content_or_deltas_final = base64.b64decode(
                        "".join(raw_content_final.split())
                    )
                elif effective_encoding == "utf-16le":
                    file_content_or_deltas_final = raw_content_final.encode("utf-16le")
                else:
                    file_content_or_deltas_final = raw_content_final.encode("utf-8")
            except Exception as e:
                print(
                    f"  Error: Failed to decode final EOF block '{current_file_path}'. Discarded. Error: {e}",
                    file=sys.stderr,
                )
                file_content_or_deltas_final = None  # Mark as failed
        else:  # Should not happen
            file_content_or_deltas_final = None

        if file_content_or_deltas_final is not None:
            parsed_files.append(
                {
                    "path_in_bundle": current_file_path,
                    "content_bytes": (
                        file_content_or_deltas_final
                        if final_format_eof != "delta"
                        else None
                    ),
                    "delta_commands": (
                        file_content_or_deltas_final
                        if final_format_eof == "delta"
                        else None
                    ),
                    "format_used_for_decode": final_format_eof,
                    "has_delta_commands": has_delta_commands_in_block
                    and final_format_eof == "delta",
                }
            )

    return parsed_files, format_description, effective_encoding


def apply_delta_commands(
    original_lines: List[str],
    delta_commands: List[DeltaCommand],
    file_path_for_log: str,
) -> List[str]:
    """Applies delta commands to original lines. Returns new lines."""
    new_lines = list(original_lines)  # Work on a copy
    offset = 0  # Tracks line number shift due to inserts/deletes

    for cmd in delta_commands:
        cmd_type = cmd["type"]
        try:
            if cmd_type == "replace":
                start_1based = cmd["start"]
                end_1based = cmd["end"]
                if start_1based <= 0 or end_1based < start_1based:
                    raise ValueError("Invalid line numbers")
                start_0based = start_1based - 1
                end_0based = end_1based - 1

                # Adjust indices based on previous operations
                adj_start = start_0based + offset
                adj_end = end_0based + offset
                if adj_start < 0 or adj_end >= len(new_lines):
                    raise ValueError("Line numbers out of bounds after offset")

                num_to_delete = (adj_end - adj_start) + 1
                num_to_insert = len(cmd.get("content_lines", []))

                del new_lines[adj_start : adj_end + 1]
                for i, line in enumerate(cmd.get("content_lines", [])):
                    new_lines.insert(adj_start + i, line)

                offset += num_to_insert - num_to_delete

            elif cmd_type == "insert":
                line_num_1based = cmd["line_num"]
                if line_num_1based < 0:
                    raise ValueError("Invalid line number")
                # 0 means insert at beginning, otherwise insert *after* the line
                insert_idx_0based = 0 if line_num_1based == 0 else line_num_1based

                # Adjust index based on previous operations
                adj_insert_idx = insert_idx_0based + offset
                if adj_insert_idx < 0 or adj_insert_idx > len(new_lines):
                    raise ValueError("Line number out of bounds after offset")

                num_to_insert = len(cmd.get("content_lines", []))
                for i, line in enumerate(cmd.get("content_lines", [])):
                    # If line_num=0, inserts at index 0. If line_num=N, inserts at index N (after original line N).
                    new_lines.insert(adj_insert_idx + i, line)
                offset += num_to_insert

            elif cmd_type == "delete":
                start_1based = cmd["start"]
                end_1based = cmd["end"]
                if start_1based <= 0 or end_1based < start_1based:
                    raise ValueError("Invalid line numbers")
                start_0based = start_1based - 1
                end_0based = end_1based - 1

                adj_start = start_0based + offset
                adj_end = end_0based + offset
                if adj_start < 0 or adj_end >= len(new_lines):
                    raise ValueError("Line numbers out of bounds after offset")

                num_to_delete = (adj_end - adj_start) + 1
                del new_lines[adj_start : adj_end + 1]
                offset -= num_to_delete

        except Exception as e:
            print(
                f"  Error applying delta command {cmd} to '{file_path_for_log}': {e}. Skipping command.",
                file=sys.stderr,
            )
            # Potentially stop processing deltas for this file? Or continue? Continue for now.

    return new_lines


# --- Extraction to Disk & CLI ---
def extract_bundle_to_disk(
    parsed_files: List[ParsedFile],
    output_dir_base_abs: str,
    overwrite_policy: str,
    apply_delta_from_original_bundle: Optional[str] = None,  # Path to original bundle
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    results: List[ExtractionResult] = []
    always_yes = overwrite_policy == "yes"
    always_no = overwrite_policy == "no"
    user_quit_extraction = False

    original_bundle_files: Dict[str, List[str]] = {}
    if apply_delta_from_original_bundle:
        original_bundle_files = parse_original_bundle_for_delta(
            apply_delta_from_original_bundle, verbose_logging
        )
        if not original_bundle_files and any(
            f.get("has_delta_commands") for f in parsed_files
        ):
            print(
                f"  Warning: Delta application requested, but failed to load original bundle '{apply_delta_from_original_bundle}'. Delta commands cannot be applied.",
                file=sys.stderr,
            )
            apply_delta_from_original_bundle = None  # Disable delta if original failed

    for file_info in parsed_files:
        if user_quit_extraction:
            results.append(
                {
                    "path": file_info["path_in_bundle"],
                    "status": "skipped",
                    "message": "User quit extraction process.",
                }
            )
            continue

        original_path_from_marker = file_info["path_in_bundle"]
        sanitized_output_rel_path = sanitize_relative_path(original_path_from_marker)
        prospective_abs_output_path = os.path.normpath(
            os.path.join(output_dir_base_abs, sanitized_output_rel_path)
        )

        # Path Traversal Check
        try:
            # Check if the realpath of the prospective output starts with the realpath of the base output dir
            # Need to handle dir creation carefully before realpath
            prospective_dir = os.path.dirname(prospective_abs_output_path)
            # Create intermediate dirs first IF we decide to write later
            # For check, use commonpath or string startswith on abspaths
            if not os.path.abspath(prospective_abs_output_path).startswith(
                os.path.abspath(output_dir_base_abs)
            ):
                raise IsADirectoryError(
                    "Path traversal attempt detected"
                )  # Use an error type
        except Exception as path_e:
            msg = f"Security Alert: Path '{sanitized_output_rel_path}' (from '{original_path_from_marker}') resolved to '{prospective_abs_output_path}', which seems outside base output directory '{output_dir_base_abs}'. Skipping. Error: {path_e}"
            print(f"  Error: {msg}", file=sys.stderr)
            results.append(
                {"path": original_path_from_marker, "status": "error", "message": msg}
            )
            continue

        perform_actual_write = True
        file_content_to_write: Optional[bytes] = None

        # Decide whether to apply delta or use full content
        if apply_delta_from_original_bundle and file_info.get("has_delta_commands"):
            if verbose_logging:
                print(
                    f"  Info: Applying delta commands for '{original_path_from_marker}'"
                )
            original_lines = original_bundle_files.get(original_path_from_marker)
            delta_commands = file_info.get("delta_commands")

            if original_lines is None:
                msg = f"Delta commands present for '{original_path_from_marker}', but file not found in original bundle '{apply_delta_from_original_bundle}'. Cannot apply deltas."
                print(f"  Error: {msg}", file=sys.stderr)
                results.append(
                    {
                        "path": original_path_from_marker,
                        "status": "error",
                        "message": msg,
                    }
                )
                perform_actual_write = False
            elif (
                not delta_commands
            ):  # Should have delta_commands if has_delta_commands is true
                msg = f"Internal inconsistency: Delta flagged but no commands for '{original_path_from_marker}'."
                print(f"  Error: {msg}", file=sys.stderr)
                results.append(
                    {
                        "path": original_path_from_marker,
                        "status": "error",
                        "message": msg,
                    }
                )
                perform_actual_write = False
            else:
                new_content_lines = apply_delta_commands(
                    original_lines, delta_commands, original_path_from_marker
                )
                # Re-encode using the bundle's original effective text encoding
                output_encoding = file_info.get(
                    "format_used_for_decode", "utf-8"
                )  # Default to utf8 if format missing? Should use bundle's
                # Get bundle format again - needs bundle effective format passed down
                # Let's assume UTF-8 for now if delta applied, needs refinement
                try:
                    # Join lines with '\n' - assumes original bundle used that. Could be fragile.
                    file_content_to_write = "\n".join(new_content_lines).encode(
                        "utf-8"
                    )  # TODO: Detect original encoding?
                except Exception as enc_e:
                    msg = f"Failed to encode delta result for '{original_path_from_marker}': {enc_e}"
                    print(f"  Error: {msg}", file=sys.stderr)
                    results.append(
                        {
                            "path": original_path_from_marker,
                            "status": "error",
                            "message": msg,
                        }
                    )
                    perform_actual_write = False
        else:
            # Use full content
            if file_info.get("content_bytes") is None and not file_info.get(
                "has_delta_commands"
            ):
                msg = f"No content bytes found for '{original_path_from_marker}' and not a delta operation."
                print(
                    f"  Warning: {msg}", file=sys.stderr
                )  # Allow empty file write? Yes.
                file_content_to_write = b""
            else:
                file_content_to_write = file_info.get(
                    "content_bytes", b""
                )  # Default to empty if missing

        # Overwrite check only if we plan to write
        if perform_actual_write and file_content_to_write is not None:
            if os.path.lexists(prospective_abs_output_path):
                if os.path.isdir(prospective_abs_output_path) and not os.path.islink(
                    prospective_abs_output_path
                ):
                    msg = f"Path '{sanitized_output_rel_path}' exists as a directory. Cannot overwrite. Skipping."
                    if verbose_logging:
                        print(f"  Warning: {msg}", file=sys.stderr)
                    results.append(
                        {
                            "path": original_path_from_marker,
                            "status": "error",
                            "message": msg,
                        }
                    )
                    perform_actual_write = False
                elif always_yes:
                    if verbose_logging:
                        print(
                            f"  Info: Overwriting '{sanitized_output_rel_path}' (forced yes)."
                        )
                elif always_no:
                    if verbose_logging:
                        print(
                            f"  Info: Skipping existing file '{sanitized_output_rel_path}' (forced no)."
                        )
                    results.append(
                        {
                            "path": original_path_from_marker,
                            "status": "skipped",
                            "message": "File exists (overwrite policy: no).",
                        }
                    )
                    perform_actual_write = False
                else:  # Prompt
                    if not sys.stdin.isatty():
                        perform_actual_write = False
                        results.append(
                            {
                                "path": original_path_from_marker,
                                "status": "skipped",
                                "message": "File exists (non-interactive, default no).",
                            }
                        )
                        if verbose_logging:
                            print(
                                f"  Info: Skipping existing file '{sanitized_output_rel_path}' (non-interactive prompt)."
                            )
                    else:
                        while True:
                            try:
                                choice = (
                                    input(
                                        f"File '{sanitized_output_rel_path}' exists. Overwrite? [(y)es/(N)o/(a)ll yes/(s)kip all/(q)uit]: "
                                    )
                                    .strip()
                                    .lower()
                                )
                                if choice == "y":
                                    break
                                if choice == "n" or choice == "":
                                    perform_actual_write = False
                                    results.append(
                                        {
                                            "path": original_path_from_marker,
                                            "status": "skipped",
                                            "message": "File exists (user chose no).",
                                        }
                                    )
                                    break
                                if choice == "a":
                                    always_yes = True
                                    break
                                if choice == "s":
                                    always_no = True
                                    perform_actual_write = False
                                    results.append(
                                        {
                                            "path": original_path_from_marker,
                                            "status": "skipped",
                                            "message": "File exists (user chose skip all).",
                                        }
                                    )
                                    break
                                if choice == "q":
                                    user_quit_extraction = True
                                    perform_actual_write = False
                                    break
                                print("Invalid choice.")
                            except (KeyboardInterrupt, EOFError):
                                user_quit_extraction = True
                                perform_actual_write = False
                                print("\nExtraction cancelled.")
                                break

        if user_quit_extraction and not perform_actual_write:
            if not any(
                r["path"] == original_path_from_marker and r["status"] == "skipped"
                for r in results
            ):
                results.append(
                    {
                        "path": original_path_from_marker,
                        "status": "skipped",
                        "message": "User quit extraction process.",
                    }
                )
            continue

        # Perform the actual write if decided
        if perform_actual_write and file_content_to_write is not None:
            try:
                output_file_dir = os.path.dirname(prospective_abs_output_path)
                if not os.path.exists(output_file_dir):
                    os.makedirs(output_file_dir, exist_ok=True)
                if os.path.islink(prospective_abs_output_path):
                    os.unlink(prospective_abs_output_path)

                with open(prospective_abs_output_path, "wb") as f_out:
                    f_out.write(file_content_to_write)
                results.append(
                    {
                        "path": original_path_from_marker,
                        "status": "extracted",
                        "message": f"Extracted to {sanitized_output_rel_path}",
                    }
                )
                if verbose_logging:
                    print(f"  Extracted: {sanitized_output_rel_path}")
            except Exception as e_write:
                msg = f"Error writing file '{sanitized_output_rel_path}': {e_write}"
                print(f"  Error: {msg}", file=sys.stderr)
                results.append(
                    {
                        "path": original_path_from_marker,
                        "status": "error",
                        "message": msg,
                    }
                )
        elif perform_actual_write and file_content_to_write is None:
            # This case happens if delta failed but overwrite checks passed
            # Result should already contain the error message from delta stage
            if not any(
                r["path"] == original_path_from_marker and r["status"] == "error"
                for r in results
            ):  # Avoid duplicate error
                results.append(
                    {
                        "path": original_path_from_marker,
                        "status": "error",
                        "message": "Delta application failed, write skipped.",
                    }
                )

    return results


def extract_bundle_to_memory(
    bundle_content: Optional[str] = None,
    bundle_path: Optional[str] = None,
    input_format_override: Optional[str] = None,
    verbose_logging: bool = False,
) -> List[ParsedFile]:
    """Parses bundle to memory. Does not apply deltas."""
    if bundle_path and not bundle_content:
        try:
            # Determine read encoding - assume UTF-8 for reading the bundle file itself
            with open(
                bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace"
            ) as f:
                bundle_content = f.read()
        except Exception as e:
            print(f"Error reading bundle file '{bundle_path}': {e}", file=sys.stderr)
            return []
    elif not bundle_content:
        print("Error: No bundle content or path provided.", file=sys.stderr)
        return []

    # Parse, but disable delta command processing for memory extraction
    parsed_files, _, _ = parse_bundle_content(
        bundle_content,
        input_format_override,
        apply_delta=False,
        verbose_logging=verbose_logging,
    )
    return parsed_files


def extract_bundle_from_string(
    bundle_content: Optional[str] = None,
    bundle_path: Optional[str] = None,
    output_dir_base: str = ".",
    overwrite_policy: str = "prompt",
    apply_delta_from_original_bundle: Optional[str] = None,  # Path to original bundle
    input_format_override: Optional[str] = None,
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    """High-level function to parse and extract to disk, handling deltas."""
    if bundle_path and not bundle_content:
        try:
            # Read bundle file itself as UTF-8 initially
            with open(
                bundle_path, "r", encoding=DEFAULT_ENCODING, errors="replace"
            ) as f:
                bundle_content = f.read()
        except Exception as e:
            return [
                {
                    "path": bundle_path,
                    "status": "error",
                    "message": f"Failed to read bundle file: {e}",
                }
            ]
    elif not bundle_content and bundle_content != "":  # Allow empty string content
        return [
            {
                "path": "bundle",
                "status": "error",
                "message": "No bundle content or path provided.",
            }
        ]
    elif bundle_content is None:  # Handle None case explicitly if path wasn't provided
        return [
            {
                "path": "bundle",
                "status": "error",
                "message": "No bundle content provided.",
            }
        ]

    abs_output_dir = os.path.realpath(os.path.abspath(output_dir_base))
    if not os.path.exists(abs_output_dir):
        try:
            os.makedirs(abs_output_dir, exist_ok=True)
            if verbose_logging:
                print(f"  Info: Created output directory '{abs_output_dir}'.")
        except Exception as e:
            return [
                {
                    "path": output_dir_base,
                    "status": "error",
                    "message": f"Failed to create output directory '{abs_output_dir}': {e}",
                }
            ]
    elif not os.path.isdir(abs_output_dir):
        return [
            {
                "path": output_dir_base,
                "status": "error",
                "message": f"Output path '{abs_output_dir}' exists but is not a directory.",
            }
        ]

    parsed_files, format_desc, effective_encoding = parse_bundle_content(
        bundle_content,
        input_format_override,
        apply_delta=bool(
            apply_delta_from_original_bundle
        ),  # Enable delta parsing if flag is set
        verbose_logging=verbose_logging,
    )

    if verbose_logging:
        print(
            f"  Info: Bundle parsing complete. Format: {format_desc}. Files parsed: {len(parsed_files)}."
        )
        if apply_delta_from_original_bundle:
            print(
                f"  Info: Delta application mode active, using original: {apply_delta_from_original_bundle}"
            )

    if not parsed_files:
        return [
            {
                "path": "bundle",
                "status": "skipped",
                "message": "No files found or parsed from the bundle content.",
            }
        ]

    # Pass the original bundle path to the extraction function
    return extract_bundle_to_disk(
        parsed_files,
        abs_output_dir,
        overwrite_policy,
        apply_delta_from_original_bundle,  # Pass the path here
        verbose_logging,
    )


def confirm_action_cli_prompt(prompt_message: str) -> bool:
    if not sys.stdin.isatty():
        print(
            "  Info: Non-interactive mode detected, proceeding automatically based on -y/-n flags (defaulting to no if neither)."
        )
        return True  # Let overwrite logic handle -y/-n
    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "":
                return True
            if choice == "n":
                return False
            print("Invalid input.")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            return False


def main_cli_dogs():
    parser = argparse.ArgumentParser(
        description="dogs.py : Extracts files from a 'cats' or LLM-generated bundle, optionally applying deltas.",
        epilog="Example: python dogs.py results.bundle ./code -y -d project_orig.bundle",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "bundle_file",
        nargs="?",
        default=None,
        metavar="BUNDLE_FILE",
        help=f"Bundle file to extract (default: {DEFAULT_INPUT_BUNDLE_FILENAME} if exists).",
    )
    parser.add_argument(
        "output_directory",
        nargs="?",
        default=DEFAULT_OUTPUT_DIR,
        metavar="OUTPUT_DIR",
        help=f"Directory to extract files into (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "-d",
        "--apply-delta",
        metavar="ORIGINAL_BUNDLE",
        help="Apply delta commands using ORIGINAL_BUNDLE as base.",
    )
    parser.add_argument(
        "-i",
        "--input-format",
        choices=["auto", "b64", "utf8", "utf16le"],
        default="auto",
        help="Override bundle format detection (default: auto).",
    )
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument(
        "-y",
        "--yes",
        dest="overwrite_policy",
        action="store_const",
        const="yes",
        help="Automatically overwrite existing files.",
    )
    overwrite_group.add_argument(
        "-n",
        "--no",
        dest="overwrite_policy",
        action="store_const",
        const="no",
        help="Automatically skip existing files.",
    )
    parser.set_defaults(overwrite_policy="prompt")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose logging."
    )

    args = parser.parse_args()

    if args.bundle_file is None:
        if os.path.exists(DEFAULT_INPUT_BUNDLE_FILENAME):
            args.bundle_file = DEFAULT_INPUT_BUNDLE_FILENAME
            if args.verbose:
                print(
                    f"Info: No bundle file specified, defaulting to '{DEFAULT_INPUT_BUNDLE_FILENAME}'."
                )
        else:
            parser.error(
                f"No bundle file specified and default '{DEFAULT_INPUT_BUNDLE_FILENAME}' not found."
            )

    abs_bundle_file_path = os.path.realpath(os.path.abspath(args.bundle_file))
    if not os.path.isfile(abs_bundle_file_path):
        print(
            f"Error: Bundle file not found or is not a file: '{abs_bundle_file_path}'",
            file=sys.stderr,
        )
        sys.exit(1)

    abs_original_bundle_path = None
    if args.apply_delta:
        abs_original_bundle_path = os.path.realpath(os.path.abspath(args.apply_delta))
        if not os.path.isfile(abs_original_bundle_path):
            print(
                f"Error: Original bundle file for delta not found: '{abs_original_bundle_path}'",
                file=sys.stderr,
            )
            sys.exit(1)

    # Read content once for preliminary check if prompting
    bundle_content_str = ""
    try:
        with open(
            abs_bundle_file_path, "r", encoding=DEFAULT_ENCODING, errors="replace"
        ) as f:
            bundle_content_str = f.read()
    except Exception as e:
        print(
            f"Error reading bundle file '{abs_bundle_file_path}': {e}", file=sys.stderr
        )
        sys.exit(1)

    # Determine effective overwrite policy if non-interactive prompt
    effective_overwrite_policy = args.overwrite_policy
    if not sys.stdin.isatty() and args.overwrite_policy == "prompt":
        effective_overwrite_policy = "no"  # Default to non-destructive in non-TTY
        if args.verbose:
            print(
                "Info: Non-interactive mode, 'prompt' overwrite policy defaults to 'no'."
            )

    # Preliminary parse for confirmation info
    parsed_for_confirmation, prelim_format_desc, _ = parse_bundle_content(
        bundle_content_str,
        forced_format_override=(
            args.input_format if args.input_format != "auto" else None
        ),
        apply_delta=bool(abs_original_bundle_path),
        verbose_logging=False,  # Keep confirmation brief unless verbose main flag
    )
    num_files_prelim = len(parsed_for_confirmation)
    num_delta_files_prelim = sum(
        1 for pf in parsed_for_confirmation if pf.get("has_delta_commands")
    )

    if args.overwrite_policy == "prompt" and sys.stdin.isatty():
        print("\n--- Bundle Extraction Plan ---")
        print(f"  Source Bundle:    {abs_bundle_file_path}")
        if abs_original_bundle_path:
            print(f"  Original Bundle:  {abs_original_bundle_path} (for Delta)")
        print(f"  Detected Format:  {prelim_format_desc}")
        if args.input_format != "auto":
            print(
                f"  Format Override:  Will interpret as {'Base64' if args.input_format == 'b64' else ('UTF-16LE' if args.input_format=='utf16le' else 'UTF-8')}"
            )
        print(
            f"  Output Directory: {os.path.realpath(os.path.abspath(args.output_directory))}"
        )
        print(f"  Overwrite Policy: {args.overwrite_policy.capitalize()}")
        print(
            f"  Files to process: {num_files_prelim}"
            + (
                f" ({num_delta_files_prelim} with delta commands)"
                if num_delta_files_prelim > 0
                else ""
            )
        )

        if not confirm_action_cli_prompt("\nProceed with extraction?"):
            print("Extraction cancelled.")
            return
    elif args.verbose:  # Not prompting, but verbose
        print("\n--- Extraction Details ---")
        print(
            f"  Source: {abs_bundle_file_path}"
            + (
                f", Original: {abs_original_bundle_path}"
                if abs_original_bundle_path
                else ""
            )
        )
        print(
            f"  Format: {prelim_format_desc}"
            + (
                f", Override: {args.input_format}"
                if args.input_format != "auto"
                else ""
            )
        )
        print(
            f"  Output: {os.path.realpath(os.path.abspath(args.output_directory))}, Overwrite: {effective_overwrite_policy}"
        )
        print(
            f"  Files to process: {num_files_prelim}"
            + (
                f" ({num_delta_files_prelim} delta)"
                if num_delta_files_prelim > 0
                else ""
            )
        )

    print("\nStarting extraction process...")
    extraction_results = extract_bundle_from_string(
        bundle_content=bundle_content_str,  # Pass content directly
        output_dir_base=args.output_directory,
        overwrite_policy=effective_overwrite_policy,  # Use determined policy
        apply_delta_from_original_bundle=abs_original_bundle_path,  # Pass original path if provided
        input_format_override=(
            args.input_format if args.input_format != "auto" else None
        ),
        verbose_logging=args.verbose,
    )

    ext = sum(1 for r in extraction_results if r["status"] == "extracted")
    skip = sum(1 for r in extraction_results if r["status"] == "skipped")
    err = sum(1 for r in extraction_results if r["status"] == "error")
    print("\n--- Extraction Summary ---")
    print(f"  Files Extracted: {ext}")
    if skip:
        print(f"  Files Skipped:   {skip}")
    if err:
        print(f"  Errors:          {err}")
    if num_files_prelim == 0:
        print("  No file content was found or parsed in the bundle.")


if __name__ == "__main__":
    main_cli_dogs()
