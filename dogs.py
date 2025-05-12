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
DEFAULT_INPUT_BUNDLE_FILENAME = "cats_out.bundle"
DEFAULT_OUTPUT_DIR = "."

CATS_BUNDLE_HEADER_PREFIX = "# Cats Bundle"
DOGS_BUNDLE_HEADER_PREFIX = "# Dogs Bundle"  # For LLM output
BUNDLE_FORMAT_PREFIX = "# Format: "

# Regex for explicit CATS/DOGS markers (case-insensitive for robustness)
CATS_FILE_START_MARKER_REGEX = re.compile(
    r"^-{3,}\s*CATS_START_FILE\s*:\s*(.+?)\s*-{3,}$", re.IGNORECASE
)
CATS_FILE_END_MARKER_REGEX = re.compile(
    r"^-{3,}\s*CATS_END_FILE\s*-{3,}$", re.IGNORECASE
)
DOGS_FILE_START_MARKER_REGEX = re.compile(
    r"^-{3,}\s*DOGS_START_FILE\s*:\s*(.+?)\s*-{3,}$", re.IGNORECASE
)
DOGS_FILE_END_MARKER_REGEX = re.compile(
    r"^-{3,}\s*DOGS_END_FILE\s*-{3,}$", re.IGNORECASE
)

# Regex for heuristic parsing of LLM-generated file indicators
LLM_EDITING_FILE_REGEX = re.compile(
    r"^\s*(?:\*\*|__)?(?:editing|generating|file|now generating file|processing|current file)\s*(?::)?\s*[`\"]?(?P<filepath>[\w./\\~-]+)[`\"]?(?:\s*\(.*\)|\s*\b(?:and|also|with|which)\b.*|\s+`?#.*|\s*(?:\*\*|__).*)?$",
    re.IGNORECASE,
)
MARKDOWN_CODE_FENCE_REGEX = re.compile(
    r"^\s*```(?:[\w+\-.]+)?\s*$"
)  # Allow lang hints like ```python
# Regex for human "continue" prompts that might be in LLM output
HUMAN_CONTINUATION_PROMPT_REGEX = re.compile(
    r"^\s*(continue|proceed|c|next|go on|resume|okay[,]? continue|cont\.?)\s*[:.!]?\s*$",
    re.IGNORECASE,
)

# --- Type Aliases ---
ParsedFile = Dict[
    str, Any
]  # {"path_in_bundle": str, "content_bytes": bytes, "format_used_for_decode": str}
ExtractionResult = Dict[str, str]  # {"path": str, "status": str, "message": str}
ParseResult = Tuple[
    List[ParsedFile], str, Optional[bool]
]  # (files, format_desc, is_b64_effective)


# --- Path Sanitization ---
def sanitize_path_component(comp: str) -> str:
    """Sanitizes a single path component to prevent unsafe characters or traversal."""
    if not comp or comp == "." or comp == "..":
        return "_sanitized_dots_"  # Replace potentially problematic dot components
    # Replace non-alphanumeric (but keep ., -, _) with underscore
    sanitized = re.sub(r"[^\w.\-_]", "_", comp)
    sanitized = re.sub(r"_+", "_", sanitized)  # Collapse multiple underscores
    sanitized = re.sub(r"^[._]+|[._]+$", "", sanitized)  # Trim leading/trailing _ or .
    return sanitized if sanitized else "sanitized_empty_comp"


def sanitize_relative_path(rel_path_from_bundle: str) -> str:
    """
    Sanitizes a relative path from the bundle to ensure it's safe for file system operations.
    Normalizes separators to OS-specific, then splits and sanitizes components.
    Prevents path traversal (e.g., '..') components from being effective.
    """
    # Normalize to forward slashes first for consistent splitting
    normalized_path = rel_path_from_bundle.replace("\\", "/")
    parts = normalized_path.split("/")

    sanitized_parts = [
        sanitize_path_component(part)
        for part in parts
        if part
        and part != "."
        and part != ".."  # Filter out empty, '.', and '..' parts explicitly
    ]
    if not sanitized_parts:
        return (
            sanitize_path_component(os.path.basename(rel_path_from_bundle))
            or "unnamed_file_from_bundle"
        )  # Fallback

    # Join using os.path.join for OS-correct paths
    return os.path.join(*sanitized_parts)


# --- Core Parsing Logic ---
def parse_bundle_content(
    bundle_content: str,
    forced_format_override: Optional[str] = None,
    verbose_logging: bool = False,
) -> ParseResult:
    """
    Parses the bundle content string to extract file information.
    Prioritizes DOGS_ markers, then CATS_ markers, then heuristic LLM output.
    """
    lines = bundle_content.splitlines()
    parsed_files: List[ParsedFile] = []

    bundle_format_is_b64: Optional[bool] = None
    format_description = "Unknown (Header not found or not recognized)"
    header_lines_consumed = 0

    # Check for DOGS_ bundle header first, then CATS_
    possible_headers = [
        (DOGS_BUNDLE_HEADER_PREFIX, "Dogs Bundle (LLM Output)"),
        (CATS_BUNDLE_HEADER_PREFIX, "Cats Bundle (Original Source)"),
    ]

    header_type_found = None
    # Scan first few lines for headers
    for i, line_text in enumerate(lines[:10]):  # Check up to 10 lines for headers
        if not header_type_found:
            for prefix_str, desc_str_part in possible_headers:
                if line_text.strip().startswith(prefix_str):
                    header_type_found = desc_str_part
                    header_lines_consumed = max(header_lines_consumed, i + 1)
                    break  # Found a primary bundle type prefix
            if (
                header_type_found
            ):  # If we found a bundle type, continue to look for Format line
                continue

        if header_type_found and line_text.strip().startswith(BUNDLE_FORMAT_PREFIX):
            header_lines_consumed = max(header_lines_consumed, i + 1)
            temp_format_description = line_text.strip()[
                len(BUNDLE_FORMAT_PREFIX) :
            ].strip()
            format_description = (
                f"{header_type_found} - Format: {temp_format_description}"
            )

            if "base64" in temp_format_description.lower():
                bundle_format_is_b64 = True
            elif (
                f"raw {DEFAULT_ENCODING.lower()}" in temp_format_description.lower()
                or "utf-8 compatible" in temp_format_description.lower()
                or "raw utf-8"
                in temp_format_description.lower()  # More general UTF-8 check
            ):
                bundle_format_is_b64 = False
            else:
                # Unrecognized format string, but header type was found. Default to UTF-8.
                bundle_format_is_b64 = False  # Default for safety
                format_description += (
                    f" (Unrecognized format details, defaulting to Raw UTF-8)"
                )
                if verbose_logging:
                    print(
                        f"  Info: Bundle prefix '{header_type_found}' found, but format details ('{temp_format_description}') unrecognized. Defaulting to UTF-8.",
                        file=sys.stderr,
                    )
            break  # Found Format line, header processing complete

    # Override with user's choice if provided
    if forced_format_override:
        bundle_format_is_b64 = forced_format_override.lower() == "b64"
        # Update format_description to reflect override, even if a header was parsed.
        if header_type_found:
            format_description = f"{format_description.split(' - Format: ')[0]} - Format: {'Base64' if bundle_format_is_b64 else f'Raw {DEFAULT_ENCODING}'} (Overridden by user)"
        else:  # No header found, but format forced
            format_description = f"Forced by user: {'Base64' if bundle_format_is_b64 else f'Raw {DEFAULT_ENCODING}'}"

    if bundle_format_is_b64 is None:  # Still not determined (no header, no override)
        bundle_format_is_b64 = False  # Default to UTF-8 for safety
        format_description = f"Raw {DEFAULT_ENCODING} (Assumed, no valid header found. Override with --input-format if needed.)"
        if verbose_logging:
            print(
                f"  Info: {format_description}",
                file=sys.stderr,
            )

    effective_is_b64_for_decode = bundle_format_is_b64 is True

    current_state = "LOOKING_FOR_ANY_START"  # Initial state
    current_file_path: Optional[str] = None
    current_content_lines: List[str] = []
    in_markdown_code_block = False  # For heuristic parsing

    # Use an iterator to allow advancing past markdown fence lines within heuristic parsing
    line_iter_obj = iter(enumerate(lines[header_lines_consumed:]))

    for line_idx_rel, line_text in line_iter_obj:
        actual_line_num = line_idx_rel + header_lines_consumed + 1  # For logging
        stripped_line = line_text.strip()

        # --- Check for explicit END markers first if a file is active ---
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
            raw_content = "\n".join(current_content_lines)
            try:
                file_bytes = (
                    base64.b64decode(
                        "".join(raw_content.split())
                    )  # Remove all whitespace for b64
                    if effective_is_b64_for_decode
                    else raw_content.encode(DEFAULT_ENCODING)
                )
                parsed_files.append(
                    {
                        "path_in_bundle": current_file_path,
                        "content_bytes": file_bytes,
                        "format_used_for_decode": (
                            "b64" if effective_is_b64_for_decode else "utf8"
                        ),
                    }
                )
            except Exception as e:
                print(
                    f"  Error (L{actual_line_num}): Failed to decode content for '{current_file_path}' on explicit END. Skipped. Error: {e}",
                    file=sys.stderr,
                )
            # Reset for next file
            current_state = "LOOKING_FOR_ANY_START"
            current_file_path = None
            current_content_lines = []
            in_markdown_code_block = False  # Reset markdown state
            continue

        # --- State: Looking for any kind of file start marker ---
        if current_state == "LOOKING_FOR_ANY_START":
            dogs_start_match = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            cats_start_match = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            llm_editing_match = LLM_EDITING_FILE_REGEX.match(
                line_text
            )  # Use full line_text for LLM regex

            if dogs_start_match:
                current_file_path = dogs_start_match.group(1).strip()
                current_state = "IN_EXPLICIT_BLOCK"  # DOGS markers are explicit
                current_content_lines = []
                in_markdown_code_block = (
                    False  # Explicit block, no markdown heuristic needed
                )
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): Matched DOGS_START for '{current_file_path}'"
                    )
            elif cats_start_match:
                current_file_path = cats_start_match.group(1).strip()
                current_state = "IN_EXPLICIT_BLOCK"  # CATS markers are explicit
                current_content_lines = []
                in_markdown_code_block = False
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): Matched CATS_START for '{current_file_path}'"
                    )
            elif llm_editing_match:
                current_file_path = llm_editing_match.group("filepath").strip()
                current_state = (
                    "IN_HEURISTIC_BLOCK"  # LLM editing lines start heuristic mode
                )
                current_content_lines = []
                in_markdown_code_block = False  # Check next line for markdown
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): Matched LLM_EDITING heuristic for '{current_file_path}' from line: '{line_text}'"
                    )
                # Check if the *next* line is a markdown code fence start
                try:
                    # Peek or consume the next line
                    next_line_idx_rel, next_line_text = next(line_iter_obj)
                    actual_next_line_num = next_line_idx_rel + header_lines_consumed + 1
                    if MARKDOWN_CODE_FENCE_REGEX.match(next_line_text.strip()):
                        in_markdown_code_block = True
                        if verbose_logging:
                            print(
                                f"  Debug (L{actual_next_line_num}): Entered markdown code block after LLM_EDITING."
                            )
                    else:
                        # Not a code fence, so this line is content
                        current_content_lines.append(next_line_text)
                except StopIteration:
                    # Bundle ends right after LLM editing line
                    pass
            elif stripped_line and not HUMAN_CONTINUATION_PROMPT_REGEX.match(
                stripped_line
            ):
                if verbose_logging:  # Log ignored lines only in verbose mode
                    print(
                        f"  Info (L{actual_line_num}): Ignoring line while LOOKING_FOR_ANY_START: '{stripped_line[:100]}...'"
                    )

        # --- State: Inside an explicit DOGS_ or CATS_ block ---
        elif current_state == "IN_EXPLICIT_BLOCK":
            # All lines are content until an END marker (handled at the top of the loop)
            current_content_lines.append(line_text)

        # --- State: Inside a heuristically detected LLM file block ---
        elif current_state == "IN_HEURISTIC_BLOCK":
            # Check if this line signals the start of a *new* file (explicitly or heuristically)
            # This would terminate the current heuristic block.
            next_dogs_start = DOGS_FILE_START_MARKER_REGEX.match(stripped_line)
            next_cats_start = CATS_FILE_START_MARKER_REGEX.match(stripped_line)
            next_llm_editing = LLM_EDITING_FILE_REGEX.match(line_text)  # Use full line

            if next_dogs_start or next_cats_start or next_llm_editing:
                if verbose_logging:
                    print(
                        f"  Debug (L{actual_line_num}): New file start detected, ending current heuristic block for '{current_file_path}'"
                    )
                # Finalize current heuristic file
                raw_content_heuristic = "\n".join(current_content_lines)
                try:
                    if current_file_path:  # Ensure there was a path
                        file_bytes_heuristic = (
                            base64.b64decode("".join(raw_content_heuristic.split()))
                            if effective_is_b64_for_decode
                            else raw_content_heuristic.encode(DEFAULT_ENCODING)
                        )
                        parsed_files.append(
                            {
                                "path_in_bundle": current_file_path,
                                "content_bytes": file_bytes_heuristic,
                                "format_used_for_decode": (
                                    "b64" if effective_is_b64_for_decode else "utf8"
                                ),
                            }
                        )
                except Exception as e:
                    print(
                        f"  Error (L{actual_line_num}): Failed to decode content for heuristic block '{current_file_path}'. Skipped. Error: {e}",
                        file=sys.stderr,
                    )

                # Reset and re-process the current line as a new start
                current_content_lines = []
                in_markdown_code_block = False  # Reset markdown state
                # Effectively "rewind" and let the next iteration of LOOKING_FOR_ANY_START catch this line
                current_state = "LOOKING_FOR_ANY_START"
                # To re-process current line, we can go back one step in iterator (not standard) or handle here:
                if next_dogs_start:
                    current_file_path = next_dogs_start.group(1).strip()
                    current_state = "IN_EXPLICIT_BLOCK"
                elif next_cats_start:
                    current_file_path = next_cats_start.group(1).strip()
                    current_state = "IN_EXPLICIT_BLOCK"
                elif next_llm_editing:
                    current_file_path = next_llm_editing.group("filepath").strip()
                    current_state = "IN_HEURISTIC_BLOCK"
                    # Check next line for markdown
                    try:
                        next_line_idx_rel_re, next_line_text_re = next(line_iter_obj)
                        if MARKDOWN_CODE_FENCE_REGEX.match(next_line_text_re.strip()):
                            in_markdown_code_block = True
                        else:
                            current_content_lines.append(next_line_text_re)
                    except StopIteration:
                        pass
                continue  # Re-process with new state if needed, or collect content

            # Handle markdown code fences within heuristic block
            if MARKDOWN_CODE_FENCE_REGEX.match(stripped_line):
                if in_markdown_code_block:
                    # This is the closing fence ```
                    in_markdown_code_block = False
                    if verbose_logging:
                        print(
                            f"  Debug (L{actual_line_num}): Exited markdown code block for '{current_file_path}'"
                        )
                    # The fence itself is not content
                else:
                    # This is the opening fence ```
                    in_markdown_code_block = True
                    if verbose_logging:
                        print(
                            f"  Debug (L{actual_line_num}): Entered markdown code block for '{current_file_path}'"
                        )
                    # The fence itself is not content
                continue  # Don't add fence lines to content

            # If not a new file start and not a fence, it's content for the heuristic block
            current_content_lines.append(line_text)

    # After loop, if a file was still "open" (e.g., bundle ended mid-file)
    if current_file_path and current_content_lines:
        if verbose_logging:
            print(
                f"  Info: Bundle ended, finalizing last active block for '{current_file_path}' (State: {current_state})"
            )
        raw_content_final = "\n".join(current_content_lines)
        try:
            file_bytes_final = (
                base64.b64decode("".join(raw_content_final.split()))
                if effective_is_b64_for_decode
                else raw_content_final.encode(DEFAULT_ENCODING)
            )
            parsed_files.append(
                {
                    "path_in_bundle": current_file_path,
                    "content_bytes": file_bytes_final,
                    "format_used_for_decode": (
                        "b64" if effective_is_b64_for_decode else "utf8"
                    ),
                }
            )
        except Exception as e:
            print(
                f"  Error: Failed to decode content for final EOF block '{current_file_path}'. Discarded. Error: {e}",
                file=sys.stderr,
            )

    return parsed_files, format_description, bundle_format_is_b64


# --- Extraction to Disk & CLI ---
def extract_bundle_to_disk(
    parsed_files: List[ParsedFile],
    output_dir_base_abs: str,  # Must be absolute, real path
    overwrite_policy: str,  # "yes", "no", "prompt"
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    """
    Writes parsed files to disk according to the overwrite policy.
    output_dir_base_abs must be an absolute, existing directory path.
    """
    results: List[ExtractionResult] = []
    always_yes = overwrite_policy == "yes"
    always_no = overwrite_policy == "no"
    user_quit_extraction = False  # Flag if user quits during prompt

    for file_info in parsed_files:
        if user_quit_extraction:  # If user quit, skip remaining files
            results.append(
                {
                    "path": file_info["path_in_bundle"],
                    "status": "skipped",
                    "message": "User quit extraction process.",
                }
            )
            continue

        original_path_from_marker = file_info["path_in_bundle"]
        # Sanitize the relative path from bundle BEFORE joining with base output dir
        sanitized_output_rel_path = sanitize_relative_path(original_path_from_marker)

        # Construct prospective absolute path and normalize it
        prospective_abs_output_path = os.path.normpath(
            os.path.join(output_dir_base_abs, sanitized_output_rel_path)
        )

        # --- Path Traversal Check ---
        # Ensure the normalized prospective path is still within the base output directory
        # os.path.commonpath can be used, or string prefix check on realpaths.
        # output_dir_base_abs is already realpath.
        if not os.path.realpath(prospective_abs_output_path).startswith(
            output_dir_base_abs
        ):
            msg = (
                f"Security Alert: Path '{sanitized_output_rel_path}' (from bundle path '{original_path_from_marker}') "
                f"resolved to '{os.path.realpath(prospective_abs_output_path)}', "
                f"which is outside base output directory '{output_dir_base_abs}'. Skipping."
            )
            print(f"  Error: {msg}", file=sys.stderr)
            results.append(
                {"path": original_path_from_marker, "status": "error", "message": msg}
            )
            continue

        perform_actual_write = True
        if os.path.lexists(
            prospective_abs_output_path
        ):  # Use lexists to check symlinks as well
            if os.path.isdir(prospective_abs_output_path) and not os.path.islink(
                prospective_abs_output_path  # Allow overwriting symlink, but not actual dir
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
            else:  # Prompt user
                if not sys.stdin.isatty():  # Non-interactive, default to 'no'
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
                else:  # Interactive prompt
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
                            if choice == "n" or choice == "":  # Default to No
                                perform_actual_write = False
                                results.append(
                                    {
                                        "path": original_path_from_marker,
                                        "status": "skipped",
                                        "message": "File exists (user chose no).",
                                    }
                                )
                                break
                            if choice == "a":  # All yes
                                always_yes = True
                                break
                            if choice == "s":  # Skip all
                                always_no = True
                                perform_actual_write = False  # For current file
                                results.append(
                                    {
                                        "path": original_path_from_marker,
                                        "status": "skipped",
                                        "message": "File exists (user chose skip all).",
                                    }
                                )
                                break
                            if choice == "q":  # Quit
                                user_quit_extraction = True
                                perform_actual_write = False  # Don't write current file
                                break
                            print("Invalid choice. Please enter y, n, a, s, or q.")
                        except KeyboardInterrupt:
                            user_quit_extraction = True
                            perform_actual_write = False
                            print("\nExtraction cancelled by user.")
                            break
                        except EOFError:
                            user_quit_extraction = True
                            perform_actual_write = False
                            print("\nExtraction cancelled (EOF).")
                            break

        if (
            user_quit_extraction and not perform_actual_write
        ):  # If quit, ensure current is marked skipped
            if not any(
                r["path"] == file_info["path_in_bundle"] and r["status"] == "skipped"
                for r in results
            ):
                results.append(
                    {
                        "path": file_info["path_in_bundle"],
                        "status": "skipped",
                        "message": "User quit extraction process.",
                    }
                )
            continue

        if perform_actual_write:
            try:
                output_file_dir = os.path.dirname(prospective_abs_output_path)
                if not os.path.exists(output_file_dir):
                    os.makedirs(output_file_dir, exist_ok=True)

                # If overwriting a symlink, remove it first
                if os.path.islink(prospective_abs_output_path):
                    os.unlink(prospective_abs_output_path)

                with open(
                    prospective_abs_output_path, "wb"
                ) as f_out:  # Write as binary
                    f_out.write(file_info["content_bytes"])
                results.append(
                    {
                        "path": original_path_from_marker,  # Report original path
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
    return results


def extract_bundle_from_string(
    bundle_content: str,
    output_dir_base: str,
    overwrite_policy: str = "prompt",  # "yes", "no", "prompt"
    input_format_override: Optional[str] = None,  # "b64" or "utf8"
    verbose_logging: bool = False,
) -> List[ExtractionResult]:
    """
    High-level function to parse a bundle string and extract files to disk.
    Args:
        bundle_content: The string content of the bundle.
        output_dir_base: The base directory where files will be extracted.
        overwrite_policy: "yes", "no", or "prompt".
        input_format_override: "b64" or "utf8" to force decoding, or None for auto.
        verbose_logging: Enable detailed operational logging.
    Returns:
        A list of ExtractionResult dictionaries.
    """
    # Ensure output_dir_base is an absolute, real path
    abs_output_dir = os.path.realpath(os.path.abspath(output_dir_base))

    if not os.path.exists(abs_output_dir):
        try:
            os.makedirs(abs_output_dir, exist_ok=True)
            if verbose_logging:
                print(f"  Info: Created output directory '{abs_output_dir}'.")
        except Exception as e:
            return [
                {
                    "path": output_dir_base,  # Use original path for error reporting
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

    parsed_files, format_desc, _ = parse_bundle_content(
        bundle_content, input_format_override, verbose_logging
    )

    if verbose_logging:
        print(
            f"  Info: Bundle parsing complete. Detected format: {format_desc}. Files parsed: {len(parsed_files)}."
        )

    if not parsed_files:
        return [
            {
                "path": "bundle",  # Generic path for bundle-level issue
                "status": "skipped",
                "message": "No files found or parsed from the bundle content.",
            }
        ]
    return extract_bundle_to_disk(
        parsed_files, abs_output_dir, overwrite_policy, verbose_logging
    )


def confirm_action_cli_prompt(prompt_message: str) -> bool:
    """Asks user for Y/n confirmation for CLI, defaults to Y."""
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


def main_cli_dogs():
    parser = argparse.ArgumentParser(
        description="dogs.py : Extracts files from a 'cats' or LLM-generated bundle.",
        epilog="Example: python dogs.py my_project.bundle ./extracted_code -y -v",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "bundle_file",
        nargs="?",  # Optional, defaults to DEFAULT_INPUT_BUNDLE_FILENAME
        default=None,  # Handle default intelligently based on file existence
        metavar="BUNDLE_FILE",
        help=f"Bundle file to extract (default: {DEFAULT_INPUT_BUNDLE_FILENAME} if exists, else error).",
    )
    parser.add_argument(
        "output_directory",
        nargs="?",
        default=DEFAULT_OUTPUT_DIR,
        metavar="OUTPUT_DIR",
        help=f"Directory to extract files into (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "-i",
        "--input-format",
        choices=["auto", "b64", "utf8"],
        default="auto",
        help="Override bundle format detection: auto (default), b64 (Base64), utf8 (Raw UTF-8).",
    )
    # Overwrite policy group
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument(
        "-y",
        "--yes",
        dest="overwrite_policy",
        action="store_const",
        const="yes",
        help="Automatically overwrite existing files without asking.",
    )
    overwrite_group.add_argument(
        "-n",
        "--no",
        dest="overwrite_policy",
        action="store_const",
        const="no",
        help="Automatically skip overwriting any existing files without asking.",
    )
    parser.set_defaults(overwrite_policy="prompt")  # Default is to prompt

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging for parsing and extraction.",
    )

    args = parser.parse_args()

    # Handle default bundle_file intelligently
    if args.bundle_file is None:
        if os.path.exists(DEFAULT_INPUT_BUNDLE_FILENAME):
            args.bundle_file = DEFAULT_INPUT_BUNDLE_FILENAME
            if args.verbose:
                print(
                    f"Info: No bundle file specified, defaulting to '{DEFAULT_INPUT_BUNDLE_FILENAME}'."
                )
        else:
            parser.error(
                f"No bundle file specified and default '{DEFAULT_INPUT_BUNDLE_FILENAME}' not found. "
                "Please provide a BUNDLE_FILE argument or ensure the default exists."
            )

    abs_bundle_file_path = os.path.realpath(os.path.abspath(args.bundle_file))
    # output_directory is handled by extract_bundle_from_string for path resolution

    if not os.path.exists(abs_bundle_file_path) or not os.path.isfile(
        abs_bundle_file_path
    ):
        print(
            f"Error: Bundle file not found or is not a file: '{abs_bundle_file_path}'",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        with open(
            abs_bundle_file_path,
            "r",
            encoding=DEFAULT_ENCODING,
            errors="replace",  # Read with replace for robustness
        ) as f:
            bundle_content_str = f.read()
    except Exception as e:
        print(
            f"Error reading bundle file '{abs_bundle_file_path}': {e}", file=sys.stderr
        )
        sys.exit(1)

    # Preliminary parse for confirmation prompt, if interactive
    # This parse helps display info before actual extraction.
    # The main extraction call will re-parse, which is fine for consistency.
    parsed_for_confirmation, preliminary_format_desc, _ = parse_bundle_content(
        bundle_content_str,
        forced_format_override=(
            args.input_format if args.input_format != "auto" else None
        ),
        verbose_logging=args.verbose,  # Use verbose for this pre-parse too
    )

    if not sys.stdin.isatty() and args.overwrite_policy == "prompt":
        if args.verbose:
            print(
                "Info: Non-interactive mode, 'prompt' for overwrite policy defaults to 'no'."
            )
        args.overwrite_policy = (
            "no"  # Default to non-destructive in non-TTY if prompt was chosen
        )

    if (
        args.overwrite_policy == "prompt" and sys.stdin.isatty()
    ):  # Only show detailed confirm if prompting
        print("\n--- Bundle Extraction Plan ---")
        print(f"  Source Bundle:    {abs_bundle_file_path}")
        print(f"  Detected Format:  {preliminary_format_desc}")
        if args.input_format != "auto":
            print(
                f"  Format Override:  Will interpret as {'Base64' if args.input_format == 'b64' else 'Raw UTF-8'}"
            )
        print(
            f"  Output Directory: {os.path.realpath(os.path.abspath(args.output_directory))}"
        )
        print(f"  Overwrite Policy: {args.overwrite_policy.capitalize()}")
        print(f"  Files to be processed: {len(parsed_for_confirmation)}")
        if args.verbose and parsed_for_confirmation:
            print("  First few file paths from bundle:")
            for pf in parsed_for_confirmation[: min(5, len(parsed_for_confirmation))]:
                print(f"    - {pf['path_in_bundle']}")
            if len(parsed_for_confirmation) > 5:
                print(f"    ... and {len(parsed_for_confirmation)-5} more.")

        if not confirm_action_cli_prompt("\nProceed with extraction?"):
            print("Extraction cancelled by user.")
            return
    elif args.verbose:  # Not prompting, but verbose
        print("\n--- Extraction Details ---")
        print(f"  Source: {abs_bundle_file_path}, Format: {preliminary_format_desc}")
        if args.input_format != "auto":
            print(f"  Format Override: {args.input_format}")
        print(
            f"  Output: {os.path.realpath(os.path.abspath(args.output_directory))}, Overwrite: {args.overwrite_policy}"
        )
        print(f"  Files to process: {len(parsed_for_confirmation)}")

    print("\nStarting extraction process...")
    # Actual extraction call
    extraction_results = extract_bundle_from_string(
        bundle_content_str,
        args.output_directory,
        args.overwrite_policy,
        args.input_format if args.input_format != "auto" else None,
        args.verbose,
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

    if (
        not parsed_for_confirmation and not extraction_results
    ):  # No files parsed initially
        print(
            "  No file content was found or parsed in the bundle to attempt extraction."
        )
    elif (
        not ext and not skip and not err and extraction_results
    ):  # Some results, but none fit categories
        print(
            "  Extraction process completed, but no files were actioned (extracted, skipped, or errored). Check logs if verbose."
        )


if __name__ == "__main__":
    main_cli_dogs()
