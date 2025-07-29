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
import subprocess
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Any, Dict

# --- Configuration Constants ---
DEFAULT_ENCODING = "utf-8"
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs.md"
DEFAULT_OUTPUT_DIR = "."

# --- Bundle Structure Constants ---
BASE64_HINT_TEXT = "Content:Base64"
# Standard Protocol
DOGS_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_(START|END)_FILE\s*:\s*(.+?)(\s*\("
    + re.escape(BASE64_HINT_TEXT)
    + r"\))?\s*-{3,}\s*$",
    re.IGNORECASE,
)
# RSI-Link Protocol for Self-Modification
RSI_MARKER_REGEX = re.compile(
    r"^\s*⛓️\s*-{3,}\s*RSI_LINK_(START|END)_FILE\s*:\s*(.+?)(\s*\("
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
REQUEST_CONTEXT_REGEX = re.compile(r"REQUEST_CONTEXT\((.+)\)", re.IGNORECASE)
EXECUTE_AND_REINVOKE_REGEX = re.compile(r"EXECUTE_AND_REINVOKE\((.+)\)", re.IGNORECASE)


class Ansi:
    """A utility class for ANSI color codes for terminal output."""

    GREEN, RED, YELLOW, BLUE, RESET = (
        "\033[92m",
        "\033[91m",
        "\033[93m",
        "\033[94m",
        "\033[0m",
    )

    @staticmethod
    def colorize_diff(diff_lines: List[str]) -> str:
        """Colorizes lines of a diff for terminal display."""
        if not sys.stdout.isatty():
            return "\n".join(diff_lines)
        output = [f"{Ansi.YELLOW}--- a/original\n+++ b/proposed{Ansi.RESET}"]
        for line in diff_lines:
            if line.startswith("+"):
                output.append(f"{Ansi.GREEN}{line}{Ansi.RESET}")
            elif line.startswith("-"):
                output.append(f"{Ansi.RED}{line}{Ansi.RESET}")
            elif line.startswith("@@"):
                output.append(f"{Ansi.BLUE}{line}{Ansi.RESET}")
            else:
                output.append(line)
        return "\n".join(output)


def log_info(message: str, quiet: bool):
    if not quiet:
        print(f"{Ansi.GREEN}Info:{Ansi.RESET} {message}", file=sys.stderr)


def log_warning(message: str, quiet: bool):
    if not quiet:
        print(f"{Ansi.YELLOW}Warning:{Ansi.RESET} {message}", file=sys.stderr)


def log_error(message: str):
    print(f"{Ansi.RED}Error:{Ansi.RESET} {message}", file=sys.stderr)


@dataclass
class ExtractionConfig:
    bundle_file: Optional[Path]
    output_dir: Path
    apply_delta_from: Optional[Path]
    overwrite_policy: str
    verify_docs: bool
    rsi_link: bool
    allow_reinvoke: bool
    quiet: bool


class BundleParser:
    def __init__(self, bundle_lines: List[str], config: ExtractionConfig):
        self.lines = bundle_lines
        self.config = config
        self.parsed_files: List[Dict[str, Any]] = []
        self.marker_regex = RSI_MARKER_REGEX if config.rsi_link else DOGS_MARKER_REGEX

    def _parse_paws_cmd_args(self, arg_str: str) -> Dict[str, str]:
        args = {}
        try:
            raw_args = re.findall(r'(\w+)\s*=\s*"((?:\\"|[^"])*)"', arg_str)
            for key, value in raw_args:
                args[key] = value.replace('\\"', '"')
        except Exception:
            log_warning(f"Could not parse PAWS_CMD args '{arg_str}'", self.config.quiet)
        return args

    def _parse_paws_command(self, cmd_str: str) -> Optional[Dict[str, Any]]:
        if m := REQUEST_CONTEXT_REGEX.match(cmd_str):
            return {
                "type": "request_context",
                "args": self._parse_paws_cmd_args(m.group(1)),
            }
        if m := EXECUTE_AND_REINVOKE_REGEX.match(cmd_str):
            return {
                "type": "execute_and_reinvoke",
                "args": self._parse_paws_cmd_args(m.group(1)),
            }
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

    def _finalize_file(self, path, is_binary, content_lines, commands):
        final_content = self._finalize_content_block(content_lines)
        file_action: Dict[str, Any] = {"path": path, "is_binary": is_binary}

        agentic_cmd = next(
            (
                cmd
                for cmd in commands
                if cmd["type"] in ["request_context", "execute_and_reinvoke"]
            ),
            None,
        )
        if agentic_cmd:
            file_action.update(agentic_cmd)
            self.parsed_files.append(file_action)
            return

        if any(cmd.get("type") == "delete_file" for cmd in commands):
            file_action["action"] = "delete"
        elif commands:
            file_action["action"] = "delta"
            if final_content and commands[-1].get("type") not in [
                "delete_lines",
                "delete_file",
            ]:
                commands[-1]["content_lines"] = final_content
            file_action["delta_commands"] = commands
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
                log_error(f"Failed to decode content for '{path}': {e}")
                return
        self.parsed_files.append(file_action)

    def parse(self) -> List[Dict[str, Any]]:
        in_file_block, current_path, is_binary = False, None, False
        content, commands = [], []
        for line_num, line in enumerate(self.lines, 1):
            match = self.marker_regex.match(line)
            if not in_file_block:
                if match and match.group(1).upper() == "START":
                    in_file_block, current_path, is_binary = (
                        True,
                        match.group(2).strip(),
                        bool(match.group(3)),
                    )
                    content, commands = [], []
            else:
                if (
                    match
                    and match.group(1).upper() == "END"
                    and match.group(2).strip() == current_path
                ):
                    self._finalize_file(current_path, is_binary, content, commands)
                    in_file_block = False
                elif match and match.group(1).upper() == "START":
                    log_warning(
                        f"New file '{match.group(2).strip()}' started before '{current_path}' ended. Finalizing.",
                        self.config.quiet,
                    )
                    self._finalize_file(current_path, is_binary, content, commands)
                    in_file_block, current_path, is_binary = (
                        True,
                        match.group(2).strip(),
                        bool(match.group(3)),
                    )
                    content, commands = [], []
                else:
                    cmd_match = PAWS_CMD_REGEX.match(line)
                    if cmd_match and (
                        delta_cmd := self._parse_paws_command(
                            cmd_match.group(1).strip()
                        )
                    ):
                        if content:
                            final_block = self._finalize_content_block(content)
                            if (
                                final_block
                                and commands
                                and commands[-1].get("type")
                                not in ["delete_lines", "delete_file"]
                            ):
                                commands[-1]["content_lines"] = final_block
                            content = []
                        commands.append(delta_cmd)
                    else:
                        content.append(line)
        if in_file_block:
            log_warning(
                f"File '{current_path}' was not properly terminated. Finalizing.",
                self.config.quiet,
            )
            self._finalize_file(current_path, is_binary, content, commands)
        return self.parsed_files


class ActionHandler:
    def __init__(self, config: ExtractionConfig):
        self.config = config
        self.always_yes, self.always_no, self.quit_extraction = (
            config.overwrite_policy == "yes",
            config.overwrite_policy == "no",
            False,
        )
        self.original_files: Dict[str, List[str]] = (
            self._load_original_bundle() if config.apply_delta_from else {}
        )

    def _load_original_bundle(self) -> Dict[str, List[str]]:
        if not self.config.apply_delta_from:
            return {}
        log_info(
            f"Loading delta reference from '{self.config.apply_delta_from.name}'...",
            self.config.quiet,
        )
        try:
            content = self.config.apply_delta_from.read_text(encoding=DEFAULT_ENCODING)
            temp_config = ExtractionConfig(
                None, Path("."), None, "no", False, False, False, True
            )
            parser = BundleParser(content.splitlines(), temp_config)
            return {
                pf["path"]: pf["content_bytes"].decode(DEFAULT_ENCODING).splitlines()
                for pf in parser.parse()
                if pf.get("action") == "write" and not pf.get("is_binary")
            }
        except Exception as e:
            raise IOError(
                f"Could not load or parse delta reference bundle '{self.config.apply_delta_from}': {e}"
            )

    def _validate_deltas(
        self, original_lines: List[str], commands: List[Dict], path: str
    ):
        last_line = 0
        for cmd in commands:
            start = cmd.get("start") or cmd.get("line_num")
            if start is None:
                continue  # Not a line-based command
            # 1-based to 0-based for comparison
            start_idx = start - 1 if cmd["type"] != "insert" else start

            if (
                start_idx < last_line and start != 0
            ):  # allow multiple INSERT_AFTER_LINE(0)
                raise ValueError(
                    f"Delta commands for '{path}' are out of order. Command '{cmd['type']}({start})' cannot follow a command affecting line {last_line+1}."
                )

            end = cmd.get("end", start)
            if end > len(original_lines):
                raise ValueError(
                    f"Delta for '{path}' failed: line number {end} is out of bounds for file with {len(original_lines)} lines."
                )
            last_line = end

    def _apply_deltas(
        self, original_lines: List[str], commands: List[Dict]
    ) -> List[str]:
        new_lines, offset = list(original_lines), 0
        for cmd in commands:
            cmd_type = cmd["type"]
            content = cmd.get("content_lines", [])
            if cmd_type == "replace":
                start, end = cmd["start"] - 1 + offset, cmd["end"] + offset
                num_deleted = end - start
                new_lines[start:end] = content
                offset += len(content) - num_deleted
            elif cmd_type == "insert":
                line_num = cmd["line_num"] + offset
                new_lines[line_num:line_num] = content
                offset += len(content)
            elif cmd_type == "delete_lines":
                start, end = cmd["start"] - 1 + offset, cmd["end"] + offset
                del new_lines[start:end]
                offset -= end - start
        return new_lines

    def _confirm_action(self, prompt: str, is_destructive: bool) -> bool:
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
                if choice in ("n", ""):
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

    def _get_diff(self, old_path: Path, new_bytes: bytes) -> str:
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
            return ""

    def process_actions(self, parsed_files: List[Dict[str, Any]]):
        if not self.config.quiet:
            print("\n--- Processing File Actions ---", file=sys.stderr)
        modified_paths = set()
        for pf in parsed_files:
            if self.quit_extraction:
                break
            try:
                action = pf.get("action") or pf.get("type")
                path_str = pf.get("path")

                if action in ["request_context", "execute_and_reinvoke"]:
                    # Agentic handlers exit the process
                    if action == "request_context":
                        self._handle_request_context(pf.get("args", {}))
                    elif action == "execute_and_reinvoke":
                        self._handle_execute_and_reinvoke(pf.get("args", {}))
                    continue

                if not path_str:
                    continue

                abs_path = (self.config.output_dir / path_str).resolve()
                if not str(abs_path).startswith(str(self.config.output_dir.resolve())):
                    raise PermissionError(
                        f"Security Alert: Path '{path_str}' escapes output directory."
                    )

                if action == "delete":
                    if abs_path.is_file() and (
                        self.always_yes
                        or self._confirm_action(f"DELETE file: {path_str}?", True)
                    ):
                        abs_path.unlink()
                        log_info(f"Deleted: {path_str}", self.config.quiet)
                        modified_paths.add(path_str)
                    else:
                        log_info(f"Skipped delete: {path_str}", self.config.quiet)

                elif action in ["write", "delta"]:
                    content_bytes = pf.get("content_bytes")
                    if action == "delta":
                        original = self.original_files.get(path_str)
                        if original is None:
                            raise FileNotFoundError(
                                f"Cannot apply delta, original not found for '{path_str}' in reference bundle."
                            )
                        self._validate_deltas(original, pf["delta_commands"], path_str)
                        new_lines = self._apply_deltas(original, pf["delta_commands"])
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
                            if diff and diff.strip():
                                print(
                                    f"\nChanges for {Ansi.YELLOW}{path_str}{Ansi.RESET}:\n{Ansi.colorize_diff(diff.splitlines())}"
                                )
                                should_write = self._confirm_action("Overwrite?", False)
                            else:
                                should_write = self._confirm_action(
                                    f"Content for '{path_str}' is identical. Overwrite anyway?",
                                    False,
                                )

                    if should_write:
                        abs_path.parent.mkdir(parents=True, exist_ok=True)
                        abs_path.write_bytes(content_bytes)
                        log_info(
                            f"{'Wrote' if abs_path.exists() else 'Created'}: {path_str}",
                            self.config.quiet,
                        )
                        modified_paths.add(path_str)
                    elif not self.config.quiet:
                        log_info(f"Skipped: {path_str}", self.config.quiet)
            except Exception as e:
                log_error(f"Processing '{pf.get('path', 'unknown')}': {e}")

        if self.config.verify_docs:
            self._verify_docs_sync(modified_paths)

    def _verify_docs_sync(self, modified_paths: set):
        if not self.config.quiet:
            print("\n--- Verifying Documentation Sync ---", file=sys.stderr)
        warnings = 0
        for readme in {p for p in modified_paths if p.lower().endswith("readme.md")}:
            catscan_path = str(Path(readme).parent / "CATSCAN.md")
            if catscan_path not in modified_paths:
                log_warning(
                    f"'{readme}' was modified, but '{catscan_path}' was not. Docs may be out of sync.",
                    self.config.quiet,
                )
                warnings += 1
        if warnings == 0 and not self.config.quiet:
            log_info(
                "All modified README.md files had corresponding CATSCAN.md changes.",
                self.config.quiet,
            )

    def _handle_request_context(self, args: Dict[str, str]):
        print(f"\n--- {Ansi.BLUE}AI Context Request{Ansi.RESET} ---", file=sys.stderr)
        print("The AI has paused execution and requires more context.", file=sys.stderr)
        if reason := args.get("reason"):
            print(f"\n{Ansi.YELLOW}Reason:{Ansi.RESET} {reason}", file=sys.stderr)
        if cmd := args.get("suggested_command"):
            print("\nTo provide the requested context, you could run:", file=sys.stderr)
            print(f"  {Ansi.GREEN}{cmd}{Ansi.RESET}", file=sys.stderr)
        sys.exit(0)

    def _handle_execute_and_reinvoke(self, args: Dict[str, str]):
        if not self.config.allow_reinvoke:
            log_error(
                "AI requested command execution, but --allow-reinvoke is not set. Aborting."
            )
            sys.exit(1)

        cmd = args.get("command_to_run")
        if not cmd:
            log_error(
                "AI requested command execution but provided no command. Aborting."
            )
            sys.exit(1)

        print(
            f"\n--- {Ansi.BLUE}AI Agentic Execution Request{Ansi.RESET} ---",
            file=sys.stderr,
        )
        if reason := args.get("reason"):
            print(f"{Ansi.YELLOW}Reason:{Ansi.RESET} {reason}", file=sys.stderr)
        print(f"\nThe AI wishes to execute the following command:", file=sys.stderr)
        print(f"  {Ansi.GREEN}{cmd}{Ansi.RESET}")

        if sys.stdin.isatty() and input("Proceed? [y/N]: ").lower().strip() == "y":
            log_info("Executing command...", self.config.quiet)
            try:
                subprocess.run(
                    cmd,
                    shell=True,
                    check=True,
                    text=True,
                    stderr=sys.stderr,
                    stdout=sys.stdout,
                )
                log_info(
                    "Command finished. Please re-invoke the AI with the new context bundle.",
                    self.config.quiet,
                )
            except subprocess.CalledProcessError as e:
                log_error(f"Command failed with exit code {e.returncode}.")
        else:
            log_info("Execution cancelled by user.", self.config.quiet)
        sys.exit(0)


def main_cli():
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
        "-q", "--quiet", action="store_true", help="Suppress all informational output."
    )
    parser.add_argument(
        "--verify-docs",
        action="store_true",
        help="Warn if a README.md is changed without its CATSCAN.md.",
    )
    parser.add_argument(
        "--rsi-link",
        action="store_true",
        help="Use the RSI-Link protocol for self-modification.",
    )
    parser.add_argument(
        "--allow-reinvoke",
        action="store_true",
        help="Allow the AI to request command execution via agentic commands.",
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

    config = ExtractionConfig(
        bundle_file=(
            Path(args.bundle_file)
            if args.bundle_file and args.bundle_file != "-"
            else None
        ),
        output_dir=Path(args.output_dir),
        apply_delta_from=Path(args.apply_delta) if args.apply_delta else None,
        overwrite_policy="no" if args.quiet else args.overwrite_policy,
        verify_docs=args.verify_docs,
        rsi_link=args.rsi_link,
        allow_reinvoke=args.allow_reinvoke,
        quiet=args.quiet,
    )

    try:
        if config.bundle_file:
            log_info(f"Reading bundle from: {config.bundle_file.name}", config.quiet)
            bundle_content = config.bundle_file.read_text(encoding=DEFAULT_ENCODING)
        else:
            log_info("Reading bundle from stdin...", config.quiet)
            bundle_content = sys.stdin.read()

        if not bundle_content.strip():
            log_warning("Bundle is empty. Nothing to do.", config.quiet)
            sys.exit(0)

        parser = BundleParser(bundle_content.splitlines(), config)
        parsed_items = parser.parse()

        if not parsed_items:
            log_warning("No valid file blocks found in the bundle.", config.quiet)
            sys.exit(0)

        handler = ActionHandler(config)
        handler.process_actions(parsed_items)

        if not config.quiet:
            print("\n--- Extraction Complete ---", file=sys.stderr)

    except FileNotFoundError:
        log_error(f"Input file '{args.bundle_file}' not found.")
        sys.exit(1)
    except (IOError, OSError) as e:
        log_error(f"A file system error occurred: {e}")
        sys.exit(1)
    except Exception as e:
        log_error(f"A critical error occurred: {e}")
        # In non-quiet mode, a traceback is helpful for debugging
        if not config.quiet:
            import traceback

            traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main_cli()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.", file=sys.stderr)
        sys.exit(130)
