#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import argparse
import base64
import re
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Any

# Default character encoding for reading and writing text files.
DEFAULT_ENCODING = "utf-8"

# Default filename for the input bundle if not specified.
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs_in.bundle"

# Default directory for extracted files.
DEFAULT_OUTPUT_DIR = "."

# Header prefixes used in Cats and Dogs bundles for identification.
CATS_BUNDLE_HEADER_PREFIX = "# Cats Bundle"
DOGS_BUNDLE_HEADER_PREFIX = "# Dogs Bundle"

# Prefix for the format description line within the bundle header.
BUNDLE_FORMAT_PREFIX = "# Format: "

# Prefix for the delta reference hint within the bundle header (from cats.py).
DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: "

# Text indicating Base64 encoded content in file markers.
BASE64_HINT_TEXT_IN_MARKER = "Content:Base64"

# Regex for Cats bundle file start markers.
FILE_START_MARKER_REGEX_TEMPLATE = r"^\s*{emoji}\s*-{{3,}}\s*{type}_START_FILE\s*:\s*(.+?)(?:\s+\(({hint_text_in_marker})\))?\s*-{{3,}}\s*$"
CATS_FILE_START_MARKER_REGEX = re.compile(
    FILE_START_MARKER_REGEX_TEMPLATE.format(
        emoji="🐈",
        type="CATS",
        hint_text_in_marker=re.escape(BASE64_HINT_TEXT_IN_MARKER),
    ),
    re.IGNORECASE,
)

# Regex for Cats bundle file end markers.
CATS_FILE_END_MARKER_REGEX = re.compile(
    r"^\s*🐈\s*-{3,}\s*CATS_END_FILE\s*-{3,}\s*$", re.IGNORECASE
)

# Regex for Dogs bundle file start markers (used in LLM output).
DOGS_FILE_START_MARKER_REGEX = re.compile(
    FILE_START_MARKER_REGEX_TEMPLATE.format(
        emoji="🐕",
        type="DOGS",
        hint_text_in_marker=re.escape(BASE64_HINT_TEXT_IN_MARKER),
    ),
    re.IGNORECASE,
)

# Regex for Dogs bundle file end markers.
DOGS_FILE_END_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_END_FILE\s*-{3,}\s*$", re.IGNORECASE
)

# Regex for PAWS_CMD delta instructions.
PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$")

# Regex for REPLACE_LINES delta command.
REPLACE_LINES_REGEX = re.compile(
    r"REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)

# Regex for INSERT_AFTER_LINE delta command.
INSERT_AFTER_LINE_REGEX = re.compile(r"INSERT_AFTER_LINE\(\s*(\d+)\s*\)", re.IGNORECASE)

# Regex for DELETE_LINES delta command.
DELETE_LINES_REGEX = re.compile(
    r"DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)

# Regex for LLM's ad-hoc file editing hints (less reliable than markers).
LLM_EDITING_FILE_REGEX = re.compile(
    r"^\s*(?:\*\*|__)?(?:editing|generating|file|now generating file|processing|current file)\s*[:`\"]?\s*(?P<filepath>[\w./\\~-]+)[`\"]?.*$",
    re.IGNORECASE,
)

# Regex for Markdown code fences, used as a heuristic for LLM output.
MARKDOWN_CODE_FENCE_REGEX = re.compile(r"^\s*```(?:[\w+\-.]+)?\s*$")

# Type alias for a dictionary representing a parsed file's properties.
ParsedFile = Dict[str, Any]

# Type alias for a dictionary representing a delta command.
DeltaCommand = Dict[str, Any]

# Type alias for a dictionary representing an extraction result.
ExtractionResult = Dict[str, str]


def sanitize_path_component(comp: str) -> str:
    """
    Sanitizes a single path component to prevent directory traversal or invalid characters.

    Args:
        comp (str): A single path component.

    Returns:
        str: The sanitized path component.
    """
    # Handle special dot components.
    if not comp or comp == "." or comp == "..":
        return "_sanitized_dots_"

    # Replace non-alphanumeric, non-dot, non-dash, non-underscore with underscore.
    sanitized = re.sub(r"[^\w.\-_]", "_", comp)

    # Collapse multiple underscores.
    sanitized = re.sub(r"_+", "_", sanitized)

    # Remove leading/trailing dots or underscores.
    sanitized = re.sub(r"^[._]+|[._]+$", "", sanitized)

    # Ensure it's not empty after sanitization.
    return sanitized if sanitized else "_sanitized_empty_"


def sanitize_relative_path(rel_path_from_bundle: str) -> str:
    """
    Sanitizes a full relative path to prevent directory traversal.

    Args:
        rel_path_from_bundle (str): The relative path as provided in the bundle.

    Returns:
        str: The sanitized relative path.
    """
    # Normalize path separators to forward slashes.
    normalized_path = rel_path_from_bundle.replace("\\", "/")

    # Split into components and sanitize each one.
    parts = [p for p in normalized_path.split("/") if p and p != "." and p != ".."]
    sanitized_parts = [sanitize_path_component(part) for part in parts]

    # If no valid parts, fall back to a sanitized version of the original filename.
    if not sanitized_parts:
        return (
            sanitize_path_component(Path(rel_path_from_bundle).name) or "unnamed_file"
        )

    # Reconstruct the path using os.path.join for platform compatibility.
    return os.path.join(*sanitized_parts)


def parse_original_bundle_for_delta(
    original_bundle_path: Path, verbose_logging: bool = False
) -> Dict[str, List[str]]:
    """
    Parses an original Cats bundle to create a mapping of file paths to their
    line content, used as a reference for delta operations.

    Args:
        original_bundle_path (Path): Absolute path to the original Cats bundle.
        verbose_logging (bool): Whether to print verbose log messages.

    Returns:
        Dict[str, List[str]]: A dictionary mapping relative file paths to their
                              list of content lines.
    """
    original_files: Dict[str, List[str]] = {}

    try:
        # Read the bundle content as bytes.
        bundle_bytes = original_bundle_path.read_bytes()
    except Exception as e:
        print(
            f"  Error: Could not read original bundle '{original_bundle_path}' for delta: {e}",
            file=sys.stderr,
        )
        return {}

    # Attempt to detect encoding, prioritizing UTF-16 BOMs.
    original_bundle_encoding = DEFAULT_ENCODING
    if bundle_bytes.startswith(b"\xff\xfe"):
        original_bundle_encoding = "utf-16le"
    elif bundle_bytes.startswith(b"\xfe\xff"):
        original_bundle_encoding = "utf-16be"

    try:
        # Decode the bundle content into a string.
        original_content_str = bundle_bytes.decode(
            original_bundle_encoding, errors="replace"
        )
    except Exception as e:
        print(
            f"  Error: Could not decode original bundle '{original_bundle_path}' as {original_bundle_encoding}: {e}",
            file=sys.stderr,
        )
        return {}

    lines = original_content_str.splitlines()
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    in_block = False

    for line_text in lines:
        stripped_line = line_text.strip()
        start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
        end_match = CATS_FILE_END_MARKER_REGEX.match(stripped_line)

        if start_match:
            # If already in a block, finalize the previous one (indicates nested/unclosed).
            if in_block and current_file_path:
                if verbose_logging:
                    print(
                        f"  Warning (Original Parse): New file '{start_match.group(1).strip()}' started before '{current_file_path}' ended.",
                        file=sys.stderr,
                    )
                original_files[current_file_path] = current_content_lines

            # Start new file block.
            current_file_path = start_match.group(1).strip()
            current_content_lines = []
            in_block = True
        elif end_match and in_block:
            # Finalize current file block.
            if current_file_path:
                original_files[current_file_path] = current_content_lines

            # Reset state.
            current_file_path = None
            current_content_lines = []
            in_block = False
        elif in_block:
            # Add line to current file content.
            current_content_lines.append(line_text)

    # Handle case where bundle ends mid-file.
    if in_block and current_file_path:
        if verbose_logging:
            print(
                f"  Warning (Original Parse): Bundle ended mid-file for '{current_file_path}'.",
                file=sys.stderr,
            )
        original_files[current_file_path] = current_content_lines

    return original_files


def parse_bundle_content(
    bundle_lines: List[str],
    forced_format_override: Optional[str] = None,
    apply_delta_mode: bool = False,
    verbose_logging: bool = False,
) -> Tuple[List[ParsedFile], str, str, bool]:
    """
    Parses a bundle's content lines into a list of file objects.
    Identifies bundle format, handles encoding, and extracts delta commands.

    Args:
        bundle_lines (List[str]): List of lines from the bundle file.
        forced_format_override (Optional[str]): User-specified override for
                                                the bundle's primary text format.
        apply_delta_mode (bool): True if delta commands should be parsed.
        verbose_logging (bool): Whether to print verbose log messages.

    Returns:
        Tuple[List[ParsedFile], str, str, bool]:
            - List of parsed file dictionaries.
            - Detected/forced format description.
            - Determined bundle text content encoding.
            - Boolean indicating if the bundle is marked as a delta reference.
    """

    parsed_files: List[ParsedFile] = []
    bundle_is_globally_b64 = False
    bundle_text_content_encoding = DEFAULT_ENCODING
    format_description = "Unknown (Header not found or not recognized)"
    bundle_is_delta_reference = False
    header_lines_consumed = 0
    header_type_found: Optional[str] = None

    # Parse bundle header for format and type.
    for i, line_text in enumerate(bundle_lines[:10]):
        stripped = line_text.strip()

        # Detect bundle type (Cats or Dogs).
        if not header_type_found:
            if stripped.startswith(DOGS_BUNDLE_HEADER_PREFIX):
                header_type_found = "Dogs Bundle"
            elif stripped.startswith(CATS_BUNDLE_HEADER_PREFIX):
                header_type_found = "Cats Bundle"
            if header_type_found:
                header_lines_consumed = max(header_lines_consumed, i + 1)
                continue

        # Detect bundle format.
        if header_type_found and stripped.startswith(BUNDLE_FORMAT_PREFIX):
            header_lines_consumed = max(header_lines_consumed, i + 1)
            temp_format_desc_val = stripped[len(BUNDLE_FORMAT_PREFIX) :].strip()
            format_description = f"{header_type_found} - Format: {temp_format_desc_val}"
            fmt_lower = temp_format_desc_val.lower()

            if "base64" in fmt_lower:
                bundle_is_globally_b64 = True
                bundle_text_content_encoding = "ascii"
            elif "utf-16le" in fmt_lower or "utf-16 le" in fmt_lower:
                bundle_text_content_encoding = "utf-16le"
            elif "utf-8" in fmt_lower:
                bundle_text_content_encoding = "utf-8"
            else:
                # Default to UTF-8 if specific encoding not clearly stated.
                format_description += (
                    f" (Unrecognized details, assuming Raw UTF-8 for text)"
                )

        # Detect if bundle is marked as a delta reference.
        if stripped.startswith(DELTA_REFERENCE_HINT_PREFIX):
            bundle_is_delta_reference = True
            header_lines_consumed = max(
                header_lines_consumed, i + 1
            )  # Ensure this line is skipped too

    # Apply user's format override if specified.
    if forced_format_override:
        override_lower = forced_format_override.lower()
        desc_prefix = f"{header_type_found or 'Bundle'} - Format:"
        if override_lower == "b64":
            bundle_is_globally_b64 = True
            bundle_text_content_encoding = "ascii"
            format_description = f"{desc_prefix} Base64 (User Override)"
        elif override_lower == "utf16le":
            bundle_is_globally_b64 = False
            bundle_text_content_encoding = "utf-16le"
            format_description = f"{desc_prefix} Raw UTF-16LE (User Override)"
        elif override_lower == "utf8":
            bundle_is_globally_b64 = False
            bundle_text_content_encoding = "utf-8"
            format_description = f"{desc_prefix} Raw UTF-8 (User Override)"

    # Set default format if no header was found and no override was given.
    if not header_type_found and not forced_format_override:
        format_description = "Raw UTF-8 (Assumed, no valid bundle header found)"
        if verbose_logging:
            print(f"  Info: {format_description}", file=sys.stderr)

    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    current_delta_commands: List[DeltaCommand] = []
    is_current_file_base64_by_hint = False
    in_markdown_heuristic_block = False

    # Iterate through bundle lines starting after the header.
    line_iter = iter(bundle_lines[header_lines_consumed:])

    for line_text in line_iter:
        stripped_line = line_text.strip()

        # Check for Cats or Dogs file start markers.
        dogs_start_match = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
        cats_start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
        start_match = dogs_start_match or cats_start_match

        # Check for Cats or Dogs file end markers.
        end_match = DOGS_FILE_END_MARKER_REGEX.match(
            stripped_line
        ) or CATS_FILE_END_MARKER_REGEX.match(stripped_line)

        # Check for Markdown code fences (for LLM heuristic mode).
        markdown_fence_match = MARKDOWN_CODE_FENCE_REGEX.match(stripped_line)

        if current_file_path:
            # If currently inside a file block.
            if end_match or (in_markdown_heuristic_block and markdown_fence_match):
                # End of current file block detected.
                file_content_bytes: Optional[bytes] = None
                delta_cmds_to_store: Optional[List[DeltaCommand]] = None
                decode_format_used = "text"

                # Determine if content should be treated as Base64.
                is_effectively_base64 = (
                    bundle_is_globally_b64 or is_current_file_base64_by_hint
                )

                # Process delta commands if delta mode is active and not a Base64 file.
                if (
                    apply_delta_mode
                    and current_delta_commands
                    and not is_effectively_base64
                ):
                    # Ensure content lines are stored for the last delta command (if not delete).
                    if (
                        current_delta_commands[-1].get("type") != "delete"
                        and current_content_lines
                    ):
                        current_delta_commands[-1]["content_lines"] = list(
                            current_content_lines
                        )
                    delta_cmds_to_store = list(current_delta_commands)
                    decode_format_used = "delta"
                else:
                    # If not delta mode or Base64 file, process as raw content.
                    raw_content_str = "\n".join(current_content_lines)
                    try:
                        if is_effectively_base64:
                            # Decode Base64 content. Remove whitespace before decoding.
                            file_content_bytes = base64.b64decode(
                                "".join(raw_content_str.split())
                            )
                            decode_format_used = "base64"
                        else:
                            # Encode text content to bytes using the determined encoding.
                            file_content_bytes = raw_content_str.encode(
                                bundle_text_content_encoding
                            )
                            decode_format_used = bundle_text_content_encoding
                    except Exception as e:
                        print(
                            f"  Error: Failed to decode content for '{current_file_path}'. Skipped. Error: {e}",
                            file=sys.stderr,
                        )
                        file_content_bytes = None

                # Add the parsed file to the list if content or deltas were found.
                if file_content_bytes is not None or delta_cmds_to_store:
                    parsed_files.append(
                        {
                            "path_in_bundle": current_file_path,
                            "content_bytes": file_content_bytes,
                            "delta_commands": delta_cmds_to_store,
                            "format_used_for_decode": decode_format_used,
                            "is_base64_marked_by_hint": is_current_file_base64_by_hint,
                            "is_globally_base64": bundle_is_globally_b64,
                            "has_delta_commands": bool(delta_cmds_to_store),
                        }
                    )

                # Reset state for next file.
                current_file_path = None
                current_content_lines = []
                current_delta_commands = []
                is_current_file_base64_by_hint = False
                in_markdown_heuristic_block = False
                continue

            # Process lines within a file block.
            is_effectively_base64_for_block = (
                bundle_is_globally_b64 or is_current_file_base64_by_hint
            )

            # If in delta mode and not a Base64 file, check for PAWS_CMD.
            if apply_delta_mode and not is_effectively_base64_for_block:
                paws_cmd_match = PAWS_CMD_REGEX.match(line_text)
                if paws_cmd_match:
                    command_str = paws_cmd_match.group(1).strip()
                    delta_cmd: Optional[DeltaCommand] = None

                    # If previous command was not 'delete', store its accumulated content.
                    if (
                        current_delta_commands
                        and current_delta_commands[-1].get("type") != "delete"
                    ):
                        current_delta_commands[-1]["content_lines"] = list(
                            current_content_lines
                        )
                    current_content_lines = []  # Reset for new command's content.

                    # Match specific delta command types.
                    replace_m = REPLACE_LINES_REGEX.match(command_str)
                    insert_m = INSERT_AFTER_LINE_REGEX.match(command_str)
                    delete_m = DELETE_LINES_REGEX.match(command_str)

                    if replace_m:
                        delta_cmd = {
                            "type": "replace",
                            "start": int(replace_m.group(1)),
                            "end": int(replace_m.group(2)),
                        }
                    elif insert_m:
                        delta_cmd = {
                            "type": "insert",
                            "line_num": int(insert_m.group(1)),
                        }
                    elif delete_m:
                        delta_cmd = {
                            "type": "delete",
                            "start": int(delete_m.group(1)),
                            "end": int(delete_m.group(2)),
                            "content_lines": [],  # Delete commands have no content.
                        }

                    if delta_cmd:
                        current_delta_commands.append(delta_cmd)
                    else:
                        if verbose_logging:
                            print(
                                f"  Warning: Unrecognized PAWS_CMD: '{command_str}' for '{current_file_path}'. Treating as content.",
                                file=sys.stderr,
                            )
                        current_content_lines.append(line_text)
                    continue  # Skip adding command line to content.

            # Add line to current file's content (either raw content or delta command content).
            current_content_lines.append(line_text)

        elif start_match:
            # New file block detected.
            current_file_path = start_match.group(1).strip()
            current_content_lines = []
            current_delta_commands = []

            # Check for Base64 hint in the start marker.
            try:
                is_current_file_base64_by_hint = bool(
                    start_match.group(2)
                    and BASE64_HINT_TEXT_IN_MARKER in start_match.group(2)
                )
            except IndexError:
                is_current_file_base64_by_hint = False

            in_markdown_heuristic_block = False  # Reset heuristic for new file.

        elif (
            not current_file_path
            and not apply_delta_mode
            and not bundle_is_globally_b64
        ):
            # Heuristic for LLM output without explicit markers (less reliable).
            llm_edit_match = LLM_EDITING_FILE_REGEX.match(stripped_line)
            if llm_edit_match:
                current_file_path = llm_edit_match.group("filepath").strip()
                is_current_file_base64_by_hint = False
                current_content_lines = []
                current_delta_commands = []

                # Check next line for markdown fence.
                try:
                    next_line = next(line_iter)
                    if MARKDOWN_CODE_FENCE_REGEX.match(next_line.strip()):
                        in_markdown_heuristic_block = True
                    else:
                        current_content_lines.append(next_line)
                        in_markdown_heuristic_block = False  # Explicitly set
                except StopIteration:
                    pass  # End of bundle after path hint.
                continue

    # Handle the case where the bundle ends abruptly mid-file.
    if current_file_path:
        if verbose_logging:
            print(
                f"  Warning: Bundle ended mid-file for '{current_file_path}'. Finalizing.",
                file=sys.stderr,
            )
        is_effectively_base64 = bundle_is_globally_b64 or is_current_file_base64_by_hint
        if apply_delta_mode and current_delta_commands and not is_effectively_base64:
            # Finalize content for the last delta command.
            if (
                current_delta_commands[-1].get("type") != "delete"
                and current_content_lines
            ):
                current_delta_commands[-1]["content_lines"] = list(
                    current_content_lines
                )
            parsed_files.append(
                {
                    "path_in_bundle": current_file_path,
                    "delta_commands": current_delta_commands,
                    "format_used_for_decode": "delta",
                    "has_delta_commands": True,
                }
            )
        elif current_content_lines:
            # Process as full content if no deltas or is Base64.
            raw_content_str = "\n".join(current_content_lines)
            try:
                if is_effectively_base64:
                    file_bytes = base64.b64decode("".join(raw_content_str.split()))
                    parsed_files.append(
                        {
                            "path_in_bundle": current_file_path,
                            "content_bytes": file_bytes,
                            "format_used_for_decode": "base64",
                        }
                    )
                else:
                    file_bytes = raw_content_str.encode(bundle_text_content_encoding)
                    parsed_files.append(
                        {
                            "path_in_bundle": current_file_path,
                            "content_bytes": file_bytes,
                            "format_used_for_decode": bundle_text_content_encoding,
                        }
                    )
            except Exception as e:
                print(
                    f"  Error decoding final block for '{current_file_path}': {e}",
                    file=sys.stderr,
                )

    return (
        parsed_files,
        format_description,
        bundle_text_content_encoding,
        bundle_is_delta_reference,
    )


def apply_delta_commands(
    original_lines: List[str],
    delta_commands: List[DeltaCommand],
    file_path_for_log: str,
) -> List[str]:
    """
    Applies a list of delta commands to an original list of text lines.

    Args:
        original_lines (List[str]): The original content lines of the file.
        delta_commands (List[DeltaCommand]): The list of delta commands to apply.
        file_path_for_log (str): The file path for logging purposes.

    Returns:
        List[str]: The new list of content lines after applying deltas.
    """
    new_lines = list(original_lines)
    # Track the cumulative change in line numbers.
    line_offset = 0

    for i, cmd in enumerate(delta_commands):
        cmd_type = cmd.get("type")
        content = cmd.get("content_lines", [])

        try:
            if cmd_type == "replace":
                start_1based, end_1based = cmd["start"], cmd["end"]
                # Validate line numbers. end_1based can be 0 for replacing an empty file.
                if not (
                    isinstance(start_1based, int)
                    and isinstance(end_1based, int)
                    and 0 < start_1based <= end_1based + 1
                ):
                    raise ValueError(
                        f"Invalid line numbers for replace: {start_1based}-{end_1based}"
                    )

                # Adjust to 0-based indexing and apply cumulative offset.
                start_0based = start_1based - 1 + line_offset
                end_0based = end_1based - 1 + line_offset

                # Validate adjusted indices against current file length.
                if not (
                    0 <= start_0based <= end_0based + 1
                    and start_0based <= len(new_lines)
                    and end_0based < len(new_lines)
                    # Special case: replace first line (1-based index 1) in an empty file (0-based index 0)
                    or (start_1based == 1 and end_1based == 0 and not new_lines)
                ):
                    raise ValueError(
                        f"Replace line numbers {start_1based}-{end_1based} (adj {start_0based+1}-{end_0based+1}) out of bounds for current length {len(new_lines)}"
                    )

                # Calculate number of lines deleted by the replace operation.
                num_deleted = (
                    (end_0based - start_0based + 1) if end_0based >= start_0based else 0
                )

                # Perform replacement in slice.
                new_lines[start_0based : end_0based + 1] = content

                # Update offset based on change in line count.
                line_offset += len(content) - num_deleted

            elif cmd_type == "insert":
                after_line_1based = cmd["line_num"]
                # Validate line number for insertion.
                if not (isinstance(after_line_1based, int) and after_line_1based >= 0):
                    raise ValueError(
                        f"Invalid line number for insert: {after_line_1based}"
                    )

                # Adjust to 0-based insertion point and apply cumulative offset.
                insert_at_0based = after_line_1based + line_offset

                # Validate adjusted insertion point.
                if not (0 <= insert_at_0based <= len(new_lines)):
                    raise ValueError(
                        f"Insert position {after_line_1based} (adj {insert_at_0based}) out of bounds for current length {len(new_lines)}"
                    )

                # Perform insertion using slice assignment.
                new_lines[insert_at_0based:insert_at_0based] = content

                # Update offset.
                line_offset += len(content)

            elif cmd_type == "delete":
                start_1based, end_1based = cmd["start"], cmd["end"]
                # Validate line numbers for deletion.
                if not (
                    isinstance(start_1based, int)
                    and isinstance(end_1based, int)
                    and 0 < start_1based <= end_1based
                ):
                    raise ValueError(
                        f"Invalid line numbers for delete: {start_1based}-{end_1based}"
                    )

                # Adjust to 0-based indices and apply cumulative offset.
                start_0based = start_1based - 1 + line_offset
                end_0based = end_1based - 1 + line_offset

                # Validate adjusted indices against current file length.
                if not (0 <= start_0based <= end_0based < len(new_lines)):
                    raise ValueError(
                        f"Delete line numbers {start_1based}-{end_1based} (adj {start_0based+1}-{end_0based+1}) out of bounds for current length {len(new_lines)}"
                    )

                # Calculate number of lines to delete.
                num_deleted = end_0based - start_0based + 1

                # Perform deletion.
                del new_lines[start_0based : end_0based + 1]

                # Update offset.
                line_offset -= num_deleted
            else:
                print(
                    f"  Warning: Unknown delta command type '{cmd_type}' for '{file_path_for_log}'. Skipping command.",
                    file=sys.stderr,
                )

        except Exception as e_delta:
            print(
                f"  Error applying delta #{i+1} ({cmd_type}) to '{file_path_for_log}': {e_delta}. File may be inconsistent.",
                file=sys.stderr,
            )
            # If an error occurs, it's safer to return the original lines
            # or the lines as they were before this problematic delta.
            # For simplicity, returning original_lines here, but in a production
            # system, more sophisticated error recovery might be needed.
            return original_lines

    return new_lines


def extract_bundle_to_disk(
    parsed_files: List[ParsedFile],
    output_dir_base: Path,
    overwrite_policy: str,
    bundle_text_content_encoding_for_delta_output: str,
    apply_delta_from_original_bundle_path: Optional[Path] = None,
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    """
    Extracts parsed file content to disk, handling paths, overwriting, and deltas.

    Args:
        parsed_files (List[ParsedFile]): List of parsed file dictionaries from the bundle.
        output_dir_base (Path): The base directory to extract files into.
        overwrite_policy (str): How to handle existing files ("yes", "no", "prompt").
        bundle_text_content_encoding_for_delta_output (str): Encoding to use when
                                                            writing delta-applied text files.
        apply_delta_from_original_bundle_path (Optional[Path]): Path to the original
                                                                  bundle for delta reference.
        verbose_logging (bool): Whether to print verbose log messages.

    Returns:
        List[ExtractionResult]: A list of dictionaries detailing the result for each file.
    """
    results: List[ExtractionResult] = []

    # Determine auto-overwrite/skip behavior.
    always_yes, always_no = overwrite_policy == "yes", overwrite_policy == "no"
    user_quit_extraction = False

    original_bundle_files_content: Dict[str, List[str]] = {}
    # Load original bundle content if delta mode is active.
    if apply_delta_from_original_bundle_path:
        original_bundle_files_content = parse_original_bundle_for_delta(
            apply_delta_from_original_bundle_path, verbose_logging
        )
        if not original_bundle_files_content and any(
            f.get("has_delta_commands") for f in parsed_files
        ):
            print(
                f"  Warning: Delta active, but failed to load/parse original bundle '{apply_delta_from_original_bundle_path}'. Deltas cannot be applied.",
                file=sys.stderr,
            )
            # Disable delta application if original bundle failed to load.
            apply_delta_from_original_bundle_path = None

    for file_info in parsed_files:
        # If user decided to quit, skip remaining files.
        if user_quit_extraction:
            results.append(
                {
                    "path": file_info["path_in_bundle"],
                    "status": "skipped",
                    "message": "User quit.",
                }
            )
            continue

        original_path_str = file_info["path_in_bundle"]

        # Sanitize path to prevent directory traversal vulnerabilities.
        sanitized_rel_path_str = sanitize_relative_path(original_path_str)
        prospective_abs_path = output_dir_base.joinpath(
            sanitized_rel_path_str
        ).resolve()

        # Final security check: ensure resolved path is still within the output base directory.
        if not str(prospective_abs_path).startswith(str(output_dir_base.resolve())):
            msg = f"Security Alert: Path '{sanitized_rel_path_str}' (from '{original_path_str}') escapes base dir. Skipping."
            print(f"  Error: {msg}", file=sys.stderr)
            results.append(
                {"path": original_path_str, "status": "error", "message": msg}
            )
            continue

        content_to_write_bytes: Optional[bytes] = None

        # Apply delta commands if applicable and not a Base64 file.
        if (
            apply_delta_from_original_bundle_path
            and file_info.get("has_delta_commands")
            and file_info.get("delta_commands")
        ):
            original_file_lines = original_bundle_files_content.get(original_path_str)
            if original_file_lines is None:
                msg = f"Delta for '{original_path_str}', but file not found in original bundle. Attempting full content write."
                print(f"  Warning: {msg}", file=sys.stderr)
                content_to_write_bytes = file_info.get("content_bytes")
            else:
                # Apply deltas and encode result.
                new_content_lines = apply_delta_commands(
                    original_file_lines, file_info["delta_commands"], original_path_str
                )
                try:
                    # Join lines with newline and encode based on the determined text encoding.
                    content_to_write_bytes = "\n".join(new_content_lines).encode(
                        bundle_text_content_encoding_for_delta_output
                    )
                    if verbose_logging:
                        print(
                            f"  Info: Delta result for '{original_path_str}' encoded as {bundle_text_content_encoding_for_delta_output}."
                        )
                except Exception as enc_e:
                    msg = f"Failed to encode delta result for '{original_path_str}': {enc_e}"
                    print(f"  Error: {msg}", file=sys.stderr)
                    results.append(
                        {"path": original_path_str, "status": "error", "message": msg}
                    )
                    content_to_write_bytes = None
        else:
            # If no delta, use the direct content bytes from parsing.
            content_to_write_bytes = file_info.get("content_bytes")

        # If no content to write (e.g., parsing error), skip.
        if content_to_write_bytes is None:
            if not file_info.get(
                "has_delta_commands"
            ):  # Only report if it wasn't a delta failure.
                msg = "No content to write (parsing issue or empty block)."
                results.append(
                    {"path": original_path_str, "status": "error", "message": msg}
                )
            continue

        should_write_this_file = True
        # Handle existing files based on overwrite policy.
        if prospective_abs_path.exists():
            if prospective_abs_path.is_dir():
                msg = f"Path '{sanitized_rel_path_str}' is an existing directory. Skipping file write."
                print(f"  Warning: {msg}", file=sys.stderr)
                results.append(
                    {"path": original_path_str, "status": "error", "message": msg}
                )
                should_write_this_file = False
            elif always_no:
                # Skip if always_no is set.
                results.append(
                    {
                        "path": original_path_str,
                        "status": "skipped",
                        "message": "Exists (no overwrite).",
                    }
                )
                should_write_this_file = False
            elif not always_yes:
                # If not auto-yes, and not auto-no, then prompt.
                if not sys.stdin.isatty():
                    # In non-interactive mode, if no -y, default to skip.
                    results.append(
                        {
                            "path": original_path_str,
                            "status": "skipped",
                            "message": "Exists (non-interactive, no -y).",
                        }
                    )
                    should_write_this_file = False
                else:
                    # Interactive overwrite prompt options:
                    # 'y': yes, overwrite current file
                    # 'N': no, skip current file (default)
                    # 'a': always yes, overwrite this and all subsequent files
                    # 's': skip all, skip this and all subsequent files
                    # 'q': quit, cancel the entire extraction process
                    try:
                        choice = (
                            input(
                                f"File '{sanitized_rel_path_str}' exists. Overwrite? [y/N/a/s/q]: "
                            )
                            .strip()
                            .lower()
                        )
                        if choice == "y":
                            pass  # Proceed to write.
                        elif choice == "a":
                            always_yes = True  # Set flag for future files.
                        elif choice == "s":
                            always_no = True  # Set flag for future files.
                            should_write_this_file = False
                            results.append(
                                {
                                    "path": original_path_str,
                                    "status": "skipped",
                                    "message": "Exists (skip all).",
                                }
                            )
                        elif choice == "q":
                            user_quit_extraction = (
                                True  # Set flag to stop all processing.
                            )
                            should_write_this_file = False
                        else:
                            # Default to 'no' if invalid input or 'N'.
                            should_write_this_file = False
                            results.append(
                                {
                                    "path": original_path_str,
                                    "status": "skipped",
                                    "message": "Exists (user 'no').",
                                }
                            )
                    except (KeyboardInterrupt, EOFError):
                        # Handle Ctrl+C or Ctrl+D.
                        user_quit_extraction = True
                        should_write_this_file = False
                        print("\nExtraction cancelled by user prompt.")

        # Ensure not to write if user decided to quit or skip.
        if user_quit_extraction and not should_write_this_file:
            # Add skipped status if not already added by 's' or 'q'.
            if not any(
                r["path"] == original_path_str and r["status"] == "skipped"
                for r in results
            ):
                results.append(
                    {
                        "path": original_path_str,
                        "status": "skipped",
                        "message": "User quit.",
                    }
                )
            continue

        # If all checks pass, write the file.
        if should_write_this_file:
            try:
                # Create parent directories.
                prospective_abs_path.parent.mkdir(parents=True, exist_ok=True)

                # If it's a symlink, unlink it before writing.
                if prospective_abs_path.is_symlink():
                    prospective_abs_path.unlink()

                with open(prospective_abs_path, "wb") as f_out:
                    f_out.write(content_to_write_bytes)
                results.append(
                    {
                        "path": original_path_str,
                        "status": "extracted",
                        "message": f"To {sanitized_rel_path_str}",
                    }
                )
            except Exception as e_write:
                msg = f"Error writing '{sanitized_rel_path_str}': {e_write}"
                print(f"  Error: {msg}", file=sys.stderr)
                results.append(
                    {"path": original_path_str, "status": "error", "message": msg}
                )

    return results


def extract_bundle_to_memory_api(
    bundle_content_str: Optional[str] = None,
    bundle_path: Optional[Path] = None,
    input_format_override: Optional[str] = None,
    verbose_logging: bool = False,
) -> List[ParsedFile]:
    """
    API function to extract bundle content into memory (as ParsedFile objects)
    without writing to disk.

    Args:
        bundle_content_str (Optional[str]): The bundle content as a string.
        bundle_path (Optional[Path]): Path to the bundle file if content string not provided.
        input_format_override (Optional[str]): Override for bundle's primary text format.
        verbose_logging (bool): Whether to enable verbose logging.

    Returns:
        List[ParsedFile]: A list of parsed file dictionaries.
    """

    actual_bundle_content_str = bundle_content_str
    # Read from file if content string is not provided.
    if bundle_path and not actual_bundle_content_str:
        try:
            actual_bundle_content_str = bundle_path.read_text(
                encoding=DEFAULT_ENCODING, errors="replace"
            )
        except Exception as e:
            print(
                f"Error reading bundle file '{bundle_path}' for memory extraction: {e}",
                file=sys.stderr,
            )
            return []

    if actual_bundle_content_str is None:
        print(
            "Error: No bundle content or path provided for memory extraction.",
            file=sys.stderr,
        )
        return []

    # Parse the bundle content. Delta mode is enabled as memory extraction might need it.
    parsed_files, _, _, _ = parse_bundle_content(
        actual_bundle_content_str.splitlines(),
        forced_format_override=input_format_override,
        apply_delta_mode=True,  # Always parse deltas for memory extraction.
        verbose_logging=verbose_logging,
    )
    return parsed_files


def extract_bundle_from_string_api(
    bundle_content_str: Optional[str] = None,
    bundle_path: Optional[Path] = None,
    output_dir_base_str: str = ".",
    overwrite_policy: str = "prompt",
    apply_delta_from_original_bundle_path_str: Optional[str] = None,
    input_format_override: Optional[str] = None,
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    """
    API function to extract bundle content to disk from a string or file path.

    Args:
        bundle_content_str (Optional[str]): The bundle content as a string.
        bundle_path (Optional[Path]): Path to the bundle file if content string not provided.
        output_dir_base_str (str): The base directory to extract files into.
        overwrite_policy (str): How to handle existing files ("yes", "no", "prompt").
        apply_delta_from_original_bundle_path_str (Optional[str]): Path to the original
                                                                  bundle for delta reference.
        input_format_override (Optional[str]): Override for bundle's primary text format.
        verbose_logging (bool): Whether to enable verbose logging.

    Returns:
        List[ExtractionResult]: A list of dictionaries detailing the result for each file.
    """

    actual_bundle_content_str = bundle_content_str
    # Read bundle content from file if not provided as a string.
    if bundle_path and not actual_bundle_content_str:
        try:
            actual_bundle_content_str = bundle_path.read_text(
                encoding=DEFAULT_ENCODING, errors="replace"
            )
        except Exception as e:
            return [
                {
                    "path": str(bundle_path),
                    "status": "error",
                    "message": f"Read error: {e}",
                }
            ]

    if actual_bundle_content_str is None:
        return [
            {
                "path": "bundle",
                "status": "error",
                "message": "No bundle content provided.",
            }
        ]

    # Resolve output directory path and create it if it doesn't exist.
    output_dir_base = Path(output_dir_base_str).resolve()
    try:
        output_dir_base.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return [
            {
                "path": output_dir_base_str,
                "status": "error",
                "message": f"Mkdir error: {e}",
            }
        ]

    # Verify output path is indeed a directory.
    if not output_dir_base.is_dir():
        return [
            {
                "path": output_dir_base_str,
                "status": "error",
                "message": "Output path is not a directory.",
            }
        ]

    original_bundle_for_delta_path: Optional[Path] = None
    # Resolve path to original bundle for delta operations.
    if apply_delta_from_original_bundle_path_str:
        original_bundle_for_delta_path = Path(
            apply_delta_from_original_bundle_path_str
        ).resolve()
        if not original_bundle_for_delta_path.is_file():
            print(
                f"  Error: Original bundle for delta '{original_bundle_for_delta_path}' not found. Deltas disabled.",
                file=sys.stderr,
            )
            original_bundle_for_delta_path = None

    # Parse the input bundle content.
    parsed_files, format_desc, bundle_text_enc_for_delta, _ = parse_bundle_content(
        actual_bundle_content_str.splitlines(),
        forced_format_override=input_format_override,
        apply_delta_mode=bool(original_bundle_for_delta_path),
        verbose_logging=verbose_logging,
    )

    if verbose_logging:
        print(
            f"  Info: Bundle parsing done. Format: {format_desc}. Files found: {len(parsed_files)}."
        )

    if not parsed_files:
        return [
            {
                "path": "bundle",
                "status": "skipped",
                "message": "No files parsed from the bundle.",
            }
        ]

    # Perform the actual extraction to disk.
    return extract_bundle_to_disk(
        parsed_files,
        output_dir_base,
        overwrite_policy,
        bundle_text_enc_for_delta,
        original_bundle_for_delta_path,
        verbose_logging,
    )


def confirm_action_cli_prompt(prompt_message: str) -> bool:
    """
    Asks the user for confirmation via a Y/n prompt in CLI.

    Args:
        prompt_message (str): The message to display to the user.

    Returns:
        bool: True if the user confirms (Y/y/Enter), False otherwise (N/n/Ctrl+C).
    """
    # If not running in an interactive terminal, assume 'yes'.
    if not sys.stdin.isatty():
        return True

    while True:
        try:
            choice = input(f"{prompt_message} [Y/n]: ").strip().lower()
            if choice == "y" or choice == "":
                return True
            if choice == "n":
                return False
            print("Invalid input.", file=sys.stderr)
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.", file=sys.stderr)
            return False


def main_cli():
    """
    Main command-line interface function for dogs.py.
    Handles argument parsing, bundle parsing, and file extraction.
    """
    parser = argparse.ArgumentParser(
        description="""
dogs.py : Extracts files from a PAWS bundle back into a directory structure.

It intelligently decodes text and Base64-encoded binary content.
Supports applying line-based delta changes from an original bundle.
""",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    # Positional argument for the bundle file.
    parser.add_argument(
        "bundle_file",
        nargs="?",
        default=None,
        metavar="BUNDLE_FILE",
        help=f"Input bundle to extract (default: '{DEFAULT_INPUT_BUNDLE_FILENAME}' if exists). Use '-' for stdin (not yet supported).",
    )

    # Positional argument for the output directory.
    parser.add_argument(
        "output_directory",
        nargs="?",
        default=DEFAULT_OUTPUT_DIR,
        metavar="OUTPUT_DIR",
        help=f"Directory to extract files into (default: '{DEFAULT_OUTPUT_DIR}').",
    )

    # Optional argument for applying delta commands.
    parser.add_argument(
        "-d",
        "--apply-delta",
        metavar="ORIGINAL_BUNDLE",
        help="Apply delta commands found in BUNDLE_FILE using ORIGINAL_BUNDLE as the reference base. "
        "Deltas apply to text files only; full content is used for binary files.",
    )

    # Optional argument to override input bundle's format detection.
    parser.add_argument(
        "-i",
        "--input-format",
        choices=["auto", "b64", "utf8", "utf16le"],
        default="auto",
        help="Override bundle's primary text format detection (default: 'auto'). "
        "Affects how non-Base64 marked text content is interpreted.",
    )

    # Mutually exclusive group for overwrite policies.
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument(
        "-y",
        "--yes",
        dest="overwrite_policy",
        action="store_const",
        const="yes",
        help="Automatically overwrite any existing files without prompting.",
    )
    overwrite_group.add_argument(
        "-n",
        "--no",
        dest="overwrite_policy",
        action="store_const",
        const="no",
        help="Automatically skip existing files without prompting.",
    )

    # Default overwrite policy to 'prompt' if neither -y nor -n is given.
    parser.set_defaults(overwrite_policy="prompt")

    # Verbose logging flag.
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging during parsing and extraction.",
    )

    args = parser.parse_args()

    bundle_file_path_str = args.bundle_file
    # If no bundle file specified, try default filename.
    if bundle_file_path_str is None:
        if Path(DEFAULT_INPUT_BUNDLE_FILENAME).exists():
            bundle_file_path_str = DEFAULT_INPUT_BUNDLE_FILENAME
        else:
            parser.error(
                f"No bundle file specified and default '{DEFAULT_INPUT_BUNDLE_FILENAME}' not found."
            )

    abs_bundle_file_path = Path(bundle_file_path_str).resolve()
    if not abs_bundle_file_path.is_file():
        print(
            f"Error: Bundle file not found: '{abs_bundle_file_path}'", file=sys.stderr
        )
        sys.exit(1)

    abs_original_bundle_path_for_delta_str: Optional[str] = None
    if args.apply_delta:
        abs_original_bundle_path_for_delta_str = str(Path(args.apply_delta).resolve())

    effective_overwrite_policy = args.overwrite_policy
    # In non-interactive mode, if policy is 'prompt', default to 'no' (skip).
    if not sys.stdin.isatty() and args.overwrite_policy == "prompt":
        effective_overwrite_policy = "no"

    # Pre-check and confirmation prompt.
    num_files_prelim = 0
    num_delta_files_prelim = 0
    num_b64_marked_prelim = 0
    prelim_fmt_desc = "Unknown"
    bundle_is_delta_ref_hint = False

    try:
        # Read bundle content for pre-check.
        temp_bundle_content_for_confirm = abs_bundle_file_path.read_text(
            encoding=DEFAULT_ENCODING, errors="replace"
        )
        # Parse bundle header and file info for summary.
        parsed_for_confirm, prelim_fmt_desc, _, bundle_is_delta_ref_hint = (
            parse_bundle_content(
                temp_bundle_content_for_confirm.splitlines(),
                forced_format_override=(
                    args.input_format if args.input_format != "auto" else None
                ),
                apply_delta_mode=bool(abs_original_bundle_path_for_delta_str),
                verbose_logging=False,  # Do not print verbose parsing output here.
            )
        )
        num_files_prelim = len(parsed_for_confirm)
        num_delta_files_prelim = sum(
            1 for pf in parsed_for_confirm if pf.get("has_delta_commands")
        )
        num_b64_marked_prelim = sum(
            1 for pf in parsed_for_confirm if pf.get("is_base64_marked_by_hint")
        )

        # Display pre-extraction summary if in interactive 'prompt' mode.
        if (
            args.overwrite_policy == "prompt"
            and sys.stdin.isatty()
            and num_files_prelim > 0
        ):
            print(
                f"\n--- Bundle Extraction Plan ---\n"
                f"  Source Bundle:    '{abs_bundle_file_path}'\n"
                f"  Output Directory: '{Path(args.output_directory).resolve()}'\n"
                f"  Detected Format:  {prelim_fmt_desc}"
                + (
                    f"\n  Format Override:  Interpreting primary text as {args.input_format.upper()}"
                    if args.input_format != "auto"
                    else ""
                )
                + (
                    f"\n  Delta Reference:  Bundle is marked as suitable for delta operations."
                    if bundle_is_delta_ref_hint
                    else ""
                )
                + (
                    f"\n  Original Bundle:  '{abs_original_bundle_path_for_delta_str}' (for Delta Application)"
                    if abs_original_bundle_path_for_delta_str
                    else ""
                )
                + f"\n  Overwrite Policy: {args.overwrite_policy.capitalize()}\n"
                f"  Files to process: {num_files_prelim}"
                + (
                    f" ({num_delta_files_prelim} with delta commands)"
                    if num_delta_files_prelim > 0
                    else ""
                )
                + (
                    f" ({num_b64_marked_prelim} marked Base64)"
                    if num_b64_marked_prelim > 0
                    else ""
                )
            )
            # Prompt for overall confirmation before starting extraction.
            if not confirm_action_cli_prompt("\nProceed with extraction?"):
                print("Extraction cancelled by user.", file=sys.stderr)
                return
    except Exception as e_precheck:
        if args.verbose:
            print(
                f"Pre-check/confirmation prompt failed: {e_precheck}", file=sys.stderr
            )
        # If pre-check fails and not auto-confirming, ask user if they want to proceed anyway.
        if not args.overwrite_policy == "yes":
            print(
                f"Warning: Could not pre-process bundle for confirmation. This might indicate a malformed bundle.",
                file=sys.stderr,
            )
            if not confirm_action_cli_prompt(
                f"Attempt extraction to '{Path(args.output_directory).resolve()}' anyway?"
            ):
                print("Extraction cancelled.", file=sys.stderr)
                return

    print("\nStarting extraction process...", file=sys.stderr)
    # Call the API function to perform extraction.
    extraction_results = extract_bundle_from_string_api(
        bundle_path=abs_bundle_file_path,
        output_dir_base_str=args.output_directory,
        overwrite_policy=effective_overwrite_policy,
        apply_delta_from_original_bundle_path_str=abs_original_bundle_path_for_delta_str,
        input_format_override=(
            args.input_format if args.input_format != "auto" else None
        ),
        verbose_logging=args.verbose,
    )

    # Summarize results.
    ext = sum(1 for r in extraction_results if r["status"] == "extracted")
    skip = sum(1 for r in extraction_results if r["status"] == "skipped")
    err = sum(1 for r in extraction_results if r["status"] == "error")
    print(
        f"\n--- Extraction Summary ---\n  Files Extracted: {ext}"
        + (f"\n  Files Skipped:   {skip}" if skip > 0 else "")
        + (f"\n  Errors:          {err}" if err > 0 else ""),
        file=sys.stderr,
    )
    if not extraction_results or (
        num_files_prelim == 0
        and not any(r["status"] == "error" for r in extraction_results)
    ):
        print("  No file content was found or parsed in the bundle.", file=sys.stderr)

    # Exit with error code if any errors occurred.
    if err > 0:
        sys.exit(1)


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
            f"\nAn unexpected critical error occurred in dogs.py main: {e}",
            file=sys.stderr,
        )
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
