#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extracts files from a PAWS bundle, applying deltas if needed.

This script is a core component of the Prompt-Assisted Workflow System (PAWS).
It supports a rich command-line interface for unpacking bundles, applying
differential changes, and verifying documentation consistency.
"""

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
    r"^\s*(?:🐈|🐕)\s*-{3,}\s*DOGS_(START|END)_FILE\s*:\s*(.+?)(\s+\("
    + re.escape(BASE64_HINT_TEXT)
    + r"\))?\s*-{3,}\s*$",
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


@dataclass
class ExtractionConfig:
    """Encapsulates all configuration for a bundle extraction operation."""

    bundle_file: Optional[Path]
    output_dir: Path
    apply_delta_from: Optional[Path]
    overwrite_policy: str
    verify_docs: bool
    quiet: bool


class Ansi:
    """A utility class for ANSI color codes for terminal output."""

    GREEN, RED, YELLOW, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[0m"

    @staticmethod
    def colorize_diff(diff_lines: List[str]) -> str:
        """
        Colorizes lines of a diff for terminal display.

        Args:
            diff_lines: A list of strings representing the diff output.

        Returns:
            A single string with ANSI color codes applied.
        """
        if not sys.stdout.isatty():
            return "\n".join(diff_lines)
        output = []
        for line in diff_lines:
            if line.startswith("+"):
                output.append(f"{Ansi.GREEN}{line}{Ansi.RESET}")
            elif line.startswith("-"):
                output.append(f"{Ansi.RED}{line}{Ansi.RESET}")
            else:
                output.append(line)
        return "\n".join(output)


class BundleParser:
    """Parses a bundle's content, handling LLM artifacts and delta commands."""

    def __init__(self, bundle_lines: List[str], config: ExtractionConfig):
        """
        Initializes the parser.

        Args:
            bundle_lines: The bundle content split into an array of lines.
            config: The extraction configuration object.
        """
        self.lines = bundle_lines
        self.config = config
        self.parsed_files: List[ParsedFile] = []

    def _parse_delta_command(self, cmd_str: str) -> Optional[DeltaCommand]:
        """Parses a PAWS_CMD string into a structured DeltaCommand dictionary."""
        if DELETE_FILE_REGEX.match(cmd_str):
            return {"type": "delete_file"}
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
        return None

    def _finalize_content_block(self, content_lines: List[str]) -> List[str]:
        """Strips leading/trailing markdown fences and empty lines."""
        if not content_lines:
            return []
        start, end = 0, len(content_lines)
        if MARKDOWN_FENCE_REGEX.match(content_lines[start]):
            start += 1
        if end > start and MARKDOWN_FENCE_REGEX.match(content_lines[end - 1]):
            end -= 1
        while start < end and not content_lines[start].strip():
            start += 1
        while end > start and not content_lines[end - 1].strip():
            end -= 1
        return content_lines[start:end]

    def _finalize_file(self, path, is_binary, content_lines, delta_commands):
        """Finalizes a file block and adds it to the parsed_files list."""
        final_content = self._finalize_content_block(content_lines)
        file_action: ParsedFile = {"path": path, "is_binary": is_binary}

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
                    if is_binary
                    else raw_content_str.encode(DEFAULT_ENCODING)
                )
            except Exception as e:
                print(
                    f"  Error: Failed to decode content for '{path}': {e}",
                    file=sys.stderr,
                )
                return
        self.parsed_files.append(file_action)

    def parse(self) -> List[ParsedFile]:
        """
        Executes the parsing of the entire bundle.

        Returns:
            A list of ParsedFile objects representing the bundle's contents.
        """
        in_file_block = False
        current_file_path: Optional[str] = None
        current_is_binary: bool = False
        content_lines: List[str] = []
        delta_commands: List[DeltaCommand] = []

        for line in self.lines:
            match = START_END_MARKER_REGEX.match(line)
            if not in_file_block:
                if match and match.group(1).upper() == "START":
                    in_file_block = True
                    current_file_path = match.group(2).strip()
                    current_is_binary = bool(match.group(3))
                    content_lines, delta_commands = [], []
            else:
                if (
                    match
                    and match.group(1).upper() == "END"
                    and match.group(2).strip() == current_file_path
                ):
                    self._finalize_file(
                        current_file_path,
                        current_is_binary,
                        content_lines,
                        delta_commands,
                    )
                    in_file_block = False
                elif match and match.group(1).upper() == "START":
                    if not self.config.quiet:
                        print(
                            f"  Warning: New file '{match.group(2).strip()}' started before '{current_file_path}' ended.",
                            file=sys.stderr,
                        )
                    self._finalize_file(
                        current_file_path,
                        current_is_binary,
                        content_lines,
                        delta_commands,
                    )
                    current_file_path, current_is_binary = match.group(2).strip(), bool(
                        match.group(3)
                    )
                    content_lines, delta_commands = [], []
                else:
                    paws_cmd_match = PAWS_CMD_REGEX.match(line)
                    if paws_cmd_match:
                        cmd_str = paws_cmd_match.group(1).strip()
                        delta_cmd = self._parse_delta_command(cmd_str)
                        if delta_cmd and (
                            delta_cmd["type"] == "delete_file"
                            or self.config.apply_delta_from
                        ):
                            final_block = self._finalize_content_block(content_lines)
                            if (
                                final_block
                                and delta_commands
                                and delta_commands[-1].get("type")
                                not in ["delete_lines", "delete_file"]
                            ):
                                delta_commands[-1]["content_lines"] = final_block
                            content_lines = []
                            delta_commands.append(delta_cmd)
                        else:
                            content_lines.append(line)
                    else:
                        content_lines.append(line)
        if in_file_block and not self.config.quiet:
            print(
                f"  Warning: File '{current_file_path}' was not properly terminated. Finalizing.",
                file=sys.stderr,
            )
            self._finalize_file(
                current_file_path, current_is_binary, content_lines, delta_commands
            )
        return self.parsed_files


class ActionHandler:
    """Handles file system actions, delta application, and user confirmations."""

    def __init__(self, config: ExtractionConfig):
        """Initializes the action handler with configuration and pre-loads delta reference."""
        self.config = config
        self.always_yes = config.overwrite_policy == "yes"
        self.always_no = config.overwrite_policy == "no"
        self.quit_extraction = False
        self.original_files: Dict[str, List[str]] = (
            self._load_original_bundle_for_delta() if config.apply_delta_from else {}
        )

    def _load_original_bundle_for_delta(self) -> Dict[str, List[str]]:
        """Loads and parses the original bundle for applying deltas."""
        try:
            content = self.config.apply_delta_from.read_text(
                encoding=DEFAULT_ENCODING, errors="replace"
            )
            temp_config = ExtractionConfig(
                bundle_file=None,
                output_dir=Path("."),
                apply_delta_from=None,
                overwrite_policy="no",
                verify_docs=False,
                quiet=True,
            )
            parser = BundleParser(content.splitlines(), temp_config)
            files = {
                pf["path"]: pf["content_bytes"].decode(DEFAULT_ENCODING).splitlines()
                for pf in parser.parse()
                if pf.get("action") == "write" and not pf.get("is_binary")
            }
            if not self.config.quiet:
                print(
                    f"  Info: Loaded {len(files)} files from delta reference '{self.config.apply_delta_from.name}'.",
                    file=sys.stderr,
                )
            return files
        except Exception as e:
            print(
                f"  Error: Could not load original bundle '{self.config.apply_delta_from}': {e}",
                file=sys.stderr,
            )
            return {}

    def _apply_deltas(
        self, original_lines: List[str], commands: List[DeltaCommand], path: str
    ) -> List[str]:
        """Applies a series of delta commands to a list of lines."""
        new_lines, offset = list(original_lines), 0
        for cmd in commands:
            try:
                if cmd["type"] == "replace":
                    start, end, content = (
                        cmd["start"] - 1 + offset,
                        cmd["end"] - 1 + offset,
                        cmd.get("content_lines", []),
                    )
                    num_deleted = end - start + 1
                    new_lines[start : end + 1] = content
                    offset += len(content) - num_deleted
                elif cmd["type"] == "insert":
                    line_num, content = cmd["line_num"] + offset, cmd.get(
                        "content_lines", []
                    )
                    new_lines[line_num:line_num] = content
                    offset += len(content)
                elif cmd["type"] == "delete_lines":
                    start, end = cmd["start"] - 1 + offset, cmd["end"] - 1 + offset
                    del new_lines[start : end + 1]
                    offset -= end - start + 1
            except IndexError:
                print(
                    f"  Error: Delta for '{path}' failed due to out-of-bounds line numbers. Skipping.",
                    file=sys.stderr,
                )
        return new_lines

    def _confirm_action(self, prompt: str, is_destructive: bool) -> bool:
        """Prompts the user for confirmation in an interactive terminal."""
        if not sys.stdin.isatty():
            return self.always_yes
        color = Ansi.RED if is_destructive else Ansi.YELLOW
        options = (
            "[y/N/a(ll)/q(uit)]" if is_destructive else "[y/N/a(ll)/s(kip-all)/q(uit)]"
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
                if choice == "a":
                    self.always_yes = True
                    return True
                if not is_destructive and choice == "s":
                    self.always_no = True
                    return False
            except (KeyboardInterrupt, EOFError):
                self.quit_extraction = True
                print("\nQuit.", file=sys.stderr)
                return False

    def _get_diff(self, old_path: Path, new_bytes: bytes) -> Optional[str]:
        """Generates a unified diff string between a file and new content."""
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
        except Exception:
            return None

    def process_actions(self, parsed_files: List[ParsedFile]):
        """Iterates through parsed files and performs the required file system operations."""
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
                    if abs_path.is_file() and (
                        self.always_yes
                        or self._confirm_action(
                            f"Request to DELETE file: {abs_path}", True
                        )
                    ):
                        abs_path.unlink()
                        print(f"  Deleted: {pf['path']}")
                    else:
                        print(f"  Skipped delete: {pf['path']}")
                elif action in ["write", "delta"]:
                    content_bytes = pf.get("content_bytes")
                    if action == "delta":
                        original = self.original_files.get(pf["path"])
                        if original is None:
                            raise ValueError(
                                f"Cannot apply delta, original not found for '{pf['path']}'"
                            )
                        new_lines = self._apply_deltas(
                            original, pf["delta_commands"], pf["path"]
                        )
                        content_bytes = ("\n".join(new_lines) + "\n").encode(
                            DEFAULT_ENCODING
                        )
                    if content_bytes is None:
                        continue
                    should_write = True
                    if abs_path.exists() and not self.always_yes:
                        if self.always_no:
                            should_write = False
                        else:
                            diff = self._get_diff(abs_path, content_bytes)
                            prompt = (
                                "Overwrite?"
                                if diff and diff.strip()
                                else f"Content for '{pf['path']}' is identical. Overwrite anyway?"
                            )
                            if diff and diff.strip() and not self.config.quiet:
                                print(
                                    f"\nChanges for {Ansi.YELLOW}{pf['path']}{Ansi.RESET}:\n{Ansi.colorize_diff(diff.splitlines())}"
                                )
                            should_write = self._confirm_action(prompt, False)
                    if should_write:
                        abs_path.parent.mkdir(parents=True, exist_ok=True)
                        abs_path.write_bytes(content_bytes)
                        if not self.config.quiet:
                            print(
                                f"  {'Wrote new' if not abs_path.exists() else 'Overwrote'}: {pf['path']}"
                            )
                    elif not self.config.quiet:
                        print(f"  Skipped: {pf['path']}")
            except Exception as e:
                print(
                    f"{Ansi.RED}  Error processing '{pf.get('path', 'unknown')}': {e}{Ansi.RESET}",
                    file=sys.stderr,
                )


def main_cli():
    """Main command-line interface function."""
    parser = argparse.ArgumentParser(
        description="dogs.py: A robust tool to unpack LLM-generated code bundles.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "bundle_file",
        nargs="?",
        default=None,
        help=f"Input bundle (default: {DEFAULT_INPUT_BUNDLE_FILENAME}). Use '-' for stdin.",
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
        help="Suppress all informational output. Implies -n.",
    )
    parser.add_argument(
        "--verify-docs",
        action="store_true",
        help="Warn if a README.md is changed without its CATSCAN.md.",
    )
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument(
        "-y",
        "--yes",
        dest="overwrite_policy",
        action="store_const",
        const="yes",
        help="Auto-confirm all actions.",
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

    using_stdin = args.bundle_file == "-"
    bundle_path_str = (
        args.bundle_file
        if args.bundle_file and not using_stdin
        else DEFAULT_INPUT_BUNDLE_FILENAME
    )

    config = ExtractionConfig(
        bundle_file=None if using_stdin else Path(bundle_path_str).resolve(),
        output_dir=Path(args.output_dir).resolve(),
        apply_delta_from=Path(args.apply_delta).resolve() if args.apply_delta else None,
        overwrite_policy="no" if args.quiet else args.overwrite_policy,
        verify_docs=args.verify_docs,
        quiet=args.quiet,
    )

    try:
        content_lines = (
            sys.stdin.read().splitlines()
            if using_stdin
            else config.bundle_file.read_text(
                encoding=DEFAULT_ENCODING, errors="replace"
            ).splitlines()
        )
        parser_instance = BundleParser(content_lines, config)
        parsed_files = parser_instance.parse()

        if not parsed_files:
            if not config.quiet:
                print(
                    "No valid file blocks found in the bundle. Nothing to do.",
                    file=sys.stderr,
                )
            sys.exit(0)

        handler = ActionHandler(config)
        handler.process_actions(parsed_files)

        if config.verify_docs:
            modified_paths = {pf["path"] for pf in parsed_files}
            readme_changes = {
                p for p in modified_paths if p.lower().endswith("readme.md")
            }
            if readme_changes:
                if not config.quiet:
                    print("\n--- Verifying Documentation Sync ---", file=sys.stderr)
                warnings = 0
                for readme in readme_changes:
                    catscan_path = str(Path(readme).parent / "CATSCAN.md")
                    if catscan_path not in modified_paths:
                        print(
                            f"  Warning: '{readme}' was modified, but '{catscan_path}' was not. Docs may be out of sync.",
                            file=sys.stderr,
                        )
                        warnings += 1
                if warnings == 0 and not config.quiet:
                    print(
                        "  OK: All modified README.md files had corresponding CATSCAN.md changes.",
                        file=sys.stderr,
                    )

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
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(130)
