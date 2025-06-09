#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import argparse
import base64
import re
import difflib
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional, Any

# --- Configuration Constants ---
DEFAULT_ENCODING = "utf-8"
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs.md"
DEFAULT_OUTPUT_DIR = "."

# --- Bundle Structure Constants ---
BASE64_HINT_TEXT = "Content:Base64"
START_END_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_(START|END)_FILE\s*:\s*(.+?)(?:\s+\({hint_text}\))?\s*-{{3,}}\s*$".format(
        hint_text=re.escape(BASE64_HINT_TEXT)
    ),
    re.IGNORECASE,
)
PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$")
MARKDOWN_FENCE_REGEX = re.compile(r"^\s*```[\w-]*\s*$")

# --- Command Regexes ---
REPLACE_LINES_REGEX = re.compile(
    r"REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)
INSERT_AFTER_LINE_REGEX = re.compile(r"INSERT_AFTER_LINE\(\s*(\d+)\s*\)", re.IGNORECASE)
DELETE_LINES_REGEX = re.compile(
    r"DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)
DELETE_FILE_REGEX = re.compile(r"DELETE_FILE\(\s*\)", re.IGNORECASE)

# --- Type Aliases ---
ParsedFile = Dict[str, Any]
DeltaCommand = Dict[str, Any]


# --- Dataclass for Configuration ---
@dataclass
class ExtractionConfig:
    bundle_file: Path
    output_dir: Path
    apply_delta_from: Optional[Path]
    overwrite_policy: str
    quiet: bool


# --- ANSI Colors for Diffs ---
class Ansi:
    GREEN, RED, YELLOW, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[0m"

    @staticmethod
    def colorize_diff(diff_lines: List[str]) -> str:
        output = []
        for line in diff_lines:
            if line.startswith("+"):
                output.append(f"{Ansi.GREEN}{line}{Ansi.RESET}")
            elif line.startswith("-"):
                output.append(f"{Ansi.RED}{line}{Ansi.RESET}")
            else:
                output.append(line)
        return "\n".join(output)


# --- Core Logic Classes ---


class BundleParser:
    """Parses a bundle's content, ignoring common LLM artifacts."""

    def __init__(self, bundle_lines: List[str], config: ExtractionConfig):
        self.lines = bundle_lines
        self.config = config

    def _parse_delta_command(self, cmd_str: str) -> Optional[DeltaCommand]:
        """Parses a PAWS_CMD string into a DeltaCommand dictionary."""
        if m := REPLACE_LINES_REGEX.match(cmd_str):
            return {"type": "replace", "start": int(m.group(1)), "end": int(m.group(2))}
        if m := INSERT_AFTER_LINE_REGEX.match(cmd_str):
            return {"type": "insert", "line_num": int(m.group(1))}
        if m := DELETE_LINES_REGEX.match(cmd_str):
            return {
                "type": "delete_lines",
                "start": int(m.group(1)),
                "end": int(m.group(2)),
            }
        if m := DELETE_FILE_REGEX.match(cmd_str):
            return {"type": "delete_file"}
        return None

    def _finalize_content_block(self, content_lines: List[str]) -> List[str]:
        """Strips leading/trailing markdown fences and empty lines from a content block."""
        if not content_lines:
            return []

        start, end = 0, len(content_lines)
        if MARKDOWN_FENCE_REGEX.match(content_lines[start]):
            start += 1
        if end > start and MARKDOWN_FENCE_REGEX.match(content_lines[end - 1]):
            end -= 1

        # Strip blank lines from start and end of the content block
        while start < end and not content_lines[start].strip():
            start += 1
        while end > start and not content_lines[end - 1].strip():
            end -= 1

        return content_lines[start:end]

    def parse(self) -> List[ParsedFile]:
        """Main parsing method, hardened against LLM artifacts."""
        parsed_files: List[ParsedFile] = []
        in_file_block = False
        current_file_path: Optional[str] = None
        content_lines: List[str] = []
        delta_commands: List[DeltaCommand] = []

        for line in self.lines:
            match = START_END_MARKER_REGEX.match(line)

            if match:
                marker_type, path, hint = match.groups()
                path = path.strip()
                is_base64_by_hint = bool(hint and BASE64_HINT_TEXT in hint)

                if marker_type.upper() == "START":
                    if in_file_block and not self.config.quiet:
                        print(
                            f"  Warning: New file '{path}' started before '{current_file_path}' ended. Finalizing previous.",
                            file=sys.stderr,
                        )
                    in_file_block = True
                    current_file_path = path
                    content_lines, delta_commands = [], []
                elif marker_type.upper() == "END" and in_file_block:
                    final_content = self._finalize_content_block(content_lines)

                    file_action: ParsedFile = {
                        "path": current_file_path,
                        "is_binary": is_base64_by_hint,
                    }

                    if any(cmd.get("type") == "delete_file" for cmd in delta_commands):
                        file_action["action"] = "delete"
                    elif delta_commands:
                        file_action["action"] = "delta"
                        if final_content and delta_commands[-1].get("type") not in [
                            "delete_lines",
                            "delete_file",
                        ]:
                            delta_commands[-1]["content_lines"] = final_content
                        file_action["delta_commands"] = delta_commands
                    else:
                        file_action["action"] = "write"
                        raw_content_str = "\n".join(final_content)
                        try:
                            file_action["content_bytes"] = (
                                base64.b64decode(raw_content_str)
                                if is_base64_by_hint
                                else raw_content_str.encode(DEFAULT_ENCODING)
                            )
                        except Exception as e:
                            print(
                                f"  Error: Failed to decode content for '{current_file_path}': {e}",
                                file=sys.stderr,
                            )
                            file_action = None

                    if file_action:
                        parsed_files.append(file_action)
                    in_file_block = False
                    current_file_path = None

            elif in_file_block:
                paws_cmd_match = PAWS_CMD_REGEX.match(line)
                if self.config.apply_delta_from and paws_cmd_match:
                    cmd_str = paws_cmd_match.group(1).strip()
                    delta_cmd = self._parse_delta_command(cmd_str)
                    if delta_cmd:
                        finalized_block = self._finalize_content_block(content_lines)
                        if (
                            finalized_block
                            and delta_commands
                            and delta_commands[-1].get("type")
                            not in ["delete_lines", "delete_file"]
                        ):
                            delta_commands[-1]["content_lines"] = finalized_block
                        content_lines = []
                        delta_commands.append(delta_cmd)
                    else:
                        content_lines.append(line)
                else:
                    content_lines.append(line)

        return parsed_files


class ActionHandler:
    """Handles file system actions and user confirmations."""

    def __init__(self, config: ExtractionConfig):
        self.config = config
        self.always_yes = config.overwrite_policy == "yes"
        self.always_no = config.overwrite_policy == "no"
        self.quit_extraction = False
        self.original_files: Dict[str, List[str]] = (
            self._load_original_bundle_for_delta() if config.apply_delta_from else {}
        )

    def _load_original_bundle_for_delta(self) -> Dict[str, List[str]]:
        try:
            content = self.config.apply_delta_from.read_text(
                encoding=DEFAULT_ENCODING, errors="replace"
            )
            parser = BundleParser(content.splitlines(), self.config)
            parsed_files = parser.parse()
            if not self.config.quiet:
                print(
                    f"Loaded {len(parsed_files)} files from delta reference bundle '{self.config.apply_delta_from.name}'.",
                    file=sys.stderr,
                )
            return {
                pf["path"]: pf["content_bytes"].decode(DEFAULT_ENCODING).splitlines()
                for pf in parsed_files
                if pf.get("action") == "write" and not pf.get("is_binary")
            }
        except Exception as e:
            print(
                f"  Error: Could not load/parse original bundle '{self.config.apply_delta_from}': {e}",
                file=sys.stderr,
            )
            return {}

    def _apply_deltas(
        self, original_lines: List[str], commands: List[DeltaCommand], path: str
    ) -> List[str]:
        # Implementation is complex and omitted for brevity, but would function as described in the prompt
        new_lines = list(original_lines)
        offset = 0
        for cmd in commands:
            cmd_type = cmd.get("type")
            try:
                if cmd_type == "replace":
                    start, end = cmd["start"] - 1 + offset, cmd["end"] - 1 + offset
                    content = cmd.get("content_lines", [])
                    num_deleted = end - start + 1
                    new_lines[start : end + 1] = content
                    offset += len(content) - num_deleted
                elif cmd_type == "insert":
                    line_num = cmd["line_num"] + offset
                    content = cmd.get("content_lines", [])
                    new_lines[line_num:line_num] = content
                    offset += len(content)
                elif cmd_type == "delete_lines":
                    start, end = cmd["start"] - 1 + offset, cmd["end"] - 1 + offset
                    del new_lines[start : end + 1]
                    offset -= end - start + 1
            except IndexError:
                print(
                    f"  Error: Delta command for '{path}' failed due to out-of-bounds line numbers. Skipping command.",
                    file=sys.stderr,
                )
        return new_lines

    def _confirm_action(self, prompt: str, is_destructive: bool) -> bool:
        if not sys.stdin.isatty():
            return False  # Never auto-confirm destructive actions non-interactively

        color = Ansi.RED if is_destructive else Ansi.YELLOW
        options = (
            "[y/N/q(quit)]"
            if is_destructive
            else "[y/N/a(yes-all)/s(skip-all)/q(quit)]"
        )

        while True:
            try:
                choice = (
                    input(f"{color}{prompt}{Ansi.RESET} {options}: ").strip().lower()
                )
                if choice == "y":
                    return True
                if choice == "n" or choice == "":
                    return False
                if choice == "q":
                    self.quit_extraction = True
                    return False
                if not is_destructive:
                    if choice == "a":
                        self.always_yes = True
                        return True
                    if choice == "s":
                        self.always_no = True
                        return False
            except (KeyboardInterrupt, EOFError):
                self.quit_extraction = True
                print("\nQuit.")
                return False

    def _get_diff(self, old_path: Path, new_bytes: bytes) -> Optional[str]:
        try:
            old_content = old_path.read_text(DEFAULT_ENCODING).splitlines(keepends=True)
            new_content = new_bytes.decode(DEFAULT_ENCODING).splitlines(keepends=True)
            return "".join(
                difflib.unified_diff(
                    old_content,
                    new_content,
                    fromfile=f"a/{old_path.name}",
                    tofile=f"b/{old_path.name}",
                )
            )
        except:
            return None  # Binary file or read error

    def process_actions(self, parsed_files: List[ParsedFile]):
        if not self.config.quiet:
            print("\n--- Processing File Actions ---", file=sys.stderr)
        for pf in parsed_files:
            if self.quit_extraction:
                break

            try:
                abs_path = (self.config.output_dir / pf["path"]).resolve()
                if not str(abs_path).startswith(str(self.config.output_dir.resolve())):
                    raise ValueError(
                        f"Security Alert: Path '{pf['path']}' escapes output directory."
                    )

                action = pf.get("action")
                if action == "delete":
                    if abs_path.is_file():
                        if self.always_yes or self._confirm_action(
                            f"Request to DELETE file: {abs_path}", True
                        ):
                            abs_path.unlink()
                            print(f"  Deleted: {pf['path']}")
                        else:
                            print(f"  Skipped delete: {pf['path']}")
                    else:
                        print(f"  Info: Cannot delete non-existent file: {pf['path']}")

                elif action in ["write", "delta"]:
                    content_bytes = pf.get("content_bytes")
                    if action == "delta":
                        original_lines = self.original_files.get(pf["path"])
                        if original_lines is None:
                            raise ValueError(
                                f"Cannot apply delta, original not found for '{pf['path']}'"
                            )
                        new_lines = self._apply_deltas(
                            original_lines, pf["delta_commands"], pf["path"]
                        )
                        content_bytes = "\n".join(new_lines).encode(DEFAULT_ENCODING)

                    if content_bytes is None:
                        raise ValueError("No content to write.")

                    should_write = True
                    if abs_path.exists():
                        if self.always_no:
                            should_write = False
                        elif not self.always_yes:
                            diff_str = self._get_diff(abs_path, content_bytes)
                            if not self.config.quiet and diff_str:
                                print(
                                    f"\nChanges for {Ansi.YELLOW}{pf['path']}{Ansi.RESET}:"
                                )
                                print(Ansi.colorize_diff(diff_str.splitlines()))
                            should_write = self._confirm_action("Overwrite?", False)

                    if should_write:
                        abs_path.parent.mkdir(parents=True, exist_ok=True)
                        abs_path.write_bytes(content_bytes)
                        if not self.config.quiet:
                            print(
                                f"  {'Wrote' if not abs_path.exists() else 'Overwrote'}: {pf['path']}"
                            )
                    elif not self.config.quiet:
                        print(f"  Skipped: {pf['path']}")

            except Exception as e:
                print(
                    f"{Ansi.RED}  Error processing '{pf.get('path', 'unknown')}': {e}{Ansi.RESET}",
                    file=sys.stderr,
                )


def main_cli():
    parser = argparse.ArgumentParser(
        description="dogs.py: A robust tool to unpack LLM-generated code bundles.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "bundle_file",
        nargs="?",
        default=None,
        help=f"Input bundle (default: {DEFAULT_INPUT_BUNDLE_FILENAME}).",
    )
    parser.add_argument(
        "output_dir",
        nargs="?",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "-d",
        "--apply-delta",
        metavar="REF_BUNDLE",
        help="Apply deltas using a reference bundle.",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Suppress all informational output and prompts.",
    )
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument(
        "-y",
        "--yes",
        dest="overwrite_policy",
        action="store_const",
        const="yes",
        help="Auto-confirm all actions (overwrite/delete).",
    )
    overwrite_group.add_argument(
        "-n",
        "--no",
        dest="overwrite_policy",
        action="store_const",
        const="no",
        help="Auto-skip all conflicting actions.",
    )
    parser.set_defaults(overwrite_policy="prompt")

    args = parser.parse_args()

    bundle_path_str = args.bundle_file or DEFAULT_INPUT_BUNDLE_FILENAME
    if not Path(bundle_path_str).is_file():
        parser.error(f"Bundle file not found: '{Path(bundle_path_str).resolve()}'")

    config = ExtractionConfig(
        bundle_file=Path(bundle_path_str).resolve(),
        output_dir=Path(args.output_dir).resolve(),
        apply_delta_from=Path(args.apply_delta).resolve() if args.apply_delta else None,
        overwrite_policy="no" if args.quiet else args.overwrite_policy,
        quiet=args.quiet,
    )

    try:
        content_lines = config.bundle_file.read_text(
            encoding=DEFAULT_ENCODING, errors="replace"
        ).splitlines()
        parser = BundleParser(content_lines, config)
        parsed_files = parser.parse()

        if not parsed_files:
            print(
                "No valid file blocks found in the bundle. Nothing to do.",
                file=sys.stderr,
            )
            sys.exit(0)

        handler = ActionHandler(config)
        handler.process_actions(parsed_files)
        if not config.quiet:
            print("\n--- Extraction Complete ---", file=sys.stderr)

    except Exception as e:
        print(
            f"\n{Ansi.RED}An unexpected critical error occurred: {e}{Ansi.RESET}",
            file=sys.stderr,
        )
        if not args.quiet:
            import traceback

            traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main_cli()
    except SystemExit as e:
        sys.exit(e.code)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(130)
