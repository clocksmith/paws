#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DOGS - Differential Output Generator System

Extracts files from PAWS bundles with support for:
- Interactive review mode with visual diffs
- Git-based verification and atomic rollback
- Delta command application
- Binary file handling
- PAWS_CMD support for AI-driven workflows
"""

import sys
import os
import argparse
import base64
import re
import difflib
import subprocess
import json
import tempfile
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict, Tuple
from enum import Enum

# For interactive mode
try:
    from rich.console import Console
    from rich.layout import Layout
    from rich.panel import Panel
    from rich.syntax import Syntax
    from rich.table import Table
    from rich.prompt import Prompt, Confirm
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.live import Live
    from rich.text import Text
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# For git operations
try:
    import git
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False

# --- Configuration Constants ---
DEFAULT_ENCODING = "utf-8"
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs.md"
DEFAULT_OUTPUT_DIR = "."

# --- Bundle Structure Constants ---
BASE64_HINT_TEXT = "Content:Base64"
DOGS_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_(START|END)_FILE\s*:\s*(.+?)(\s*\("
    + re.escape(BASE64_HINT_TEXT)
    + r"\))?\s*-{3,}\s*$",
    re.IGNORECASE,
)
RSI_MARKER_REGEX = re.compile(
    r"^\s*⛓️\s*-{3,}\s*RSI_LINK_(START|END)_FILE\s*:\s*(.+?)(\s*\("
    + re.escape(BASE64_HINT_TEXT)
    + r"\))?\s*-{3,}\s*$",
    re.IGNORECASE,
)
PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$")
MARKDOWN_FENCE_REGEX = re.compile(r"^\s*```[\w-]*\s*$")

# --- Command Regexes (Full backward compatibility) ---
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


class FileOperation(Enum):
    CREATE = "CREATE"
    MODIFY = "MODIFY"
    DELETE = "DELETE"


@dataclass
class FileChange:
    """Represents a single file change in the bundle"""
    file_path: str
    operation: FileOperation
    old_content: Optional[str] = None
    new_content: Optional[str] = None
    is_binary: bool = False
    status: str = "pending"  # pending, accepted, rejected, skipped
    delta_commands: List[Dict] = field(default_factory=list)  # For backward compatibility
    
    def get_diff(self) -> str:
        """Generate a unified diff for this change"""
        if self.operation == FileOperation.DELETE:
            return f"File will be deleted: {self.file_path}"
        elif self.operation == FileOperation.CREATE:
            return f"New file will be created: {self.file_path}"
        elif self.old_content is not None and self.new_content is not None:
            old_lines = self.old_content.splitlines(keepends=True)
            new_lines = self.new_content.splitlines(keepends=True)
            return "".join(
                difflib.unified_diff(
                    old_lines,
                    new_lines,
                    fromfile=f"a/{self.file_path}",
                    tofile=f"b/{self.file_path}",
                )
            )
        return ""


@dataclass
class ChangeSet:
    """Collection of all file changes in a bundle"""
    changes: List[FileChange] = field(default_factory=list)
    
    def add_change(self, change: FileChange):
        self.changes.append(change)
    
    def get_accepted(self) -> List[FileChange]:
        return [c for c in self.changes if c.status == "accepted"]
    
    def get_pending(self) -> List[FileChange]:
        return [c for c in self.changes if c.status == "pending"]
    
    def summary(self) -> Dict[str, int]:
        return {
            "total": len(self.changes),
            "accepted": len([c for c in self.changes if c.status == "accepted"]),
            "rejected": len([c for c in self.changes if c.status == "rejected"]),
            "pending": len([c for c in self.changes if c.status == "pending"]),
        }


class InteractiveReviewer:
    """Interactive TUI for reviewing changes"""
    
    def __init__(self, changeset: ChangeSet):
        self.changeset = changeset
        self.current_index = 0
        self.console = Console() if RICH_AVAILABLE else None
    
    def review(self) -> ChangeSet:
        """Main review loop"""
        if not RICH_AVAILABLE:
            print("Rich library not available. Falling back to basic review mode.")
            return self._basic_review()
        
        return self._rich_review()
    
    def _basic_review(self) -> ChangeSet:
        """Fallback review without rich TUI"""
        print("\n=== Interactive Review Mode ===\n")
        
        for i, change in enumerate(self.changeset.changes):
            print(f"\n[{i+1}/{len(self.changeset.changes)}] {change.file_path}")
            print(f"Operation: {change.operation.value}")
            
            if change.operation == FileOperation.MODIFY:
                diff = change.get_diff()
                if diff:
                    print("\nDiff:")
                    print(diff[:1000])  # Limit diff output
                    if len(diff) > 1000:
                        print("... (diff truncated)")
            
            while True:
                choice = input("\n[a]ccept / [r]eject / [s]kip / [q]uit: ").lower()
                if choice == 'a':
                    change.status = "accepted"
                    break
                elif choice == 'r':
                    change.status = "rejected"
                    break
                elif choice == 's':
                    change.status = "pending"
                    break
                elif choice == 'q':
                    return self.changeset
                else:
                    print("Invalid choice. Please try again.")
        
        return self.changeset
    
    def _rich_review(self) -> ChangeSet:
        """Interactive review with rich TUI"""
        self.console.clear()
        
        with Live(self._get_display(), console=self.console, refresh_per_second=4) as live:
            while self.current_index < len(self.changeset.changes):
                change = self.changeset.changes[self.current_index]
                
                # Update display
                live.update(self._get_display())
                
                # Get user input
                choice = Prompt.ask(
                    "[bold yellow]Action[/]",
                    choices=["a", "r", "s", "p", "n", "q"],
                    default="s"
                )
                
                if choice == 'a':  # Accept
                    change.status = "accepted"
                    self.current_index += 1
                elif choice == 'r':  # Reject
                    change.status = "rejected"
                    self.current_index += 1
                elif choice == 's':  # Skip
                    change.status = "pending"
                    self.current_index += 1
                elif choice == 'p':  # Previous
                    if self.current_index > 0:
                        self.current_index -= 1
                elif choice == 'n':  # Next
                    if self.current_index < len(self.changeset.changes) - 1:
                        self.current_index += 1
                elif choice == 'q':  # Quit
                    if Confirm.ask("Apply accepted changes and exit?"):
                        break
        
        return self.changeset
    
    def _get_display(self) -> Layout:
        """Generate the display layout"""
        layout = Layout()
        
        # Create the layout structure
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body"),
            Layout(name="footer", size=5)
        )
        
        # Header with progress
        summary = self.changeset.summary()
        header_text = f"[bold]PAWS Interactive Review[/] | File {self.current_index + 1}/{summary['total']} | Accepted: {summary['accepted']} | Rejected: {summary['rejected']}"
        layout["header"].update(Panel(header_text))
        
        # Body with current file and diff
        if self.current_index < len(self.changeset.changes):
            change = self.changeset.changes[self.current_index]
            
            # File info
            file_info = Table(show_header=False, box=None)
            file_info.add_column("Property", style="cyan")
            file_info.add_column("Value")
            file_info.add_row("File", change.file_path)
            file_info.add_row("Operation", change.operation.value)
            file_info.add_row("Status", change.status)
            
            # Diff display
            diff_text = change.get_diff()
            if diff_text:
                syntax = Syntax(diff_text, "diff", theme="monokai", line_numbers=True)
            else:
                syntax = Text("No diff available", style="dim")
            
            body_layout = Layout()
            body_layout.split_row(
                Layout(Panel(file_info, title="File Info"), ratio=1),
                Layout(Panel(syntax, title="Changes"), ratio=3)
            )
            layout["body"].update(body_layout)
        
        # Footer with controls
        controls = "[bold]Controls:[/] [a]ccept | [r]eject | [s]kip | [p]revious | [n]ext | [q]uit & apply"
        layout["footer"].update(Panel(controls))
        
        return layout


class GitVerificationHandler:
    """Handles git-based verification and rollback"""
    
    def __init__(self, repo_path: Path = Path(".")):
        self.repo_path = repo_path
        self.repo = None
        self.stash_entry = None
        
        if GIT_AVAILABLE:
            try:
                self.repo = git.Repo(repo_path)
            except:
                self.repo = None
    
    def is_git_repo(self) -> bool:
        """Check if we're in a git repository"""
        return self.repo is not None
    
    def create_checkpoint(self) -> bool:
        """Create a git stash checkpoint"""
        if not self.repo:
            return False
        
        try:
            # Check if there are changes to stash
            if self.repo.is_dirty(untracked_files=True):
                self.stash_entry = self.repo.git.stash('push', '-m', 'PAWS: Pre-apply checkpoint')
                return True
            return True  # Clean state is also valid
        except Exception as e:
            print(f"Failed to create checkpoint: {e}")
            return False
    
    def rollback(self) -> bool:
        """Rollback to the checkpoint"""
        if not self.repo or not self.stash_entry:
            return False
        
        try:
            self.repo.git.stash('pop')
            self.stash_entry = None
            return True
        except Exception as e:
            print(f"Failed to rollback: {e}")
            return False
    
    def finalize(self) -> bool:
        """Finalize changes by dropping the stash"""
        if not self.repo or not self.stash_entry:
            return True
        
        try:
            self.repo.git.stash('drop')
            self.stash_entry = None
            return True
        except Exception as e:
            print(f"Failed to finalize: {e}")
            return False
    
    def run_verification(self, command: str) -> Tuple[bool, str]:
        """Run verification command and return success status and output"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            output = result.stdout + result.stderr
            return result.returncode == 0, output
        except subprocess.TimeoutExpired:
            return False, "Verification command timed out after 5 minutes"
        except Exception as e:
            return False, str(e)


class BundleProcessor:
    """Main processor for DOGS bundle extraction and application"""
    
    def __init__(self, config):
        self.config = config
        self.changeset = ChangeSet()
        self.git_handler = GitVerificationHandler() if config.get("verify") else None
        self.use_rsi_link = config.get("rsi_link", False)
        self.allow_reinvoke = config.get("allow_reinvoke", False)
        self.verify_docs = config.get("verify_docs", False)
        self.apply_delta_from = config.get("apply_delta_from")
        self.original_files = self._load_original_bundle() if self.apply_delta_from else {}
    
    def _load_original_bundle(self) -> Dict[str, List[str]]:
        """Load original bundle for delta application"""
        if not self.apply_delta_from:
            return {}
        
        print(f"Loading delta reference from '{self.apply_delta_from}'...")
        try:
            with open(self.apply_delta_from, 'r', encoding=DEFAULT_ENCODING) as f:
                content = f.read()
            
            # Parse the original bundle to extract file contents
            temp_processor = BundleProcessor({"apply_delta_from": None})
            temp_changeset = temp_processor.parse_bundle(content)
            
            original_files = {}
            for change in temp_changeset.changes:
                if change.new_content:
                    original_files[change.file_path] = change.new_content.splitlines()
            
            return original_files
        except Exception as e:
            raise IOError(f"Could not load delta reference bundle: {e}")
    
    def parse_bundle(self, bundle_content: str) -> ChangeSet:
        """Parse bundle content into a ChangeSet with FULL backward compatibility"""
        lines = bundle_content.splitlines()
        in_file = False
        current_file = None
        current_content = []
        is_binary = False
        current_commands = []
        
        # Choose marker based on RSI-Link mode
        marker_regex = RSI_MARKER_REGEX if self.use_rsi_link else DOGS_MARKER_REGEX
        
        for line_num, line in enumerate(lines, 1):
            match = marker_regex.match(line)
            
            if match:
                if match.group(1).upper() == "START":
                    in_file = True
                    current_file = match.group(2).strip()
                    is_binary = bool(match.group(3))
                    current_content = []
                    current_commands = []
                elif match.group(1).upper() == "END" and in_file:
                    # Process the collected file
                    self._process_file(current_file, current_content, is_binary, current_commands)
                    in_file = False
                    current_file = None
            elif in_file:
                # Check for PAWS_CMD
                cmd_match = PAWS_CMD_REGEX.match(line)
                if cmd_match:
                    cmd = self._parse_paws_command(cmd_match.group(1).strip())
                    if cmd:
                        # Handle agentic commands immediately
                        if cmd["type"] in ["request_context", "execute_and_reinvoke"]:
                            self._handle_agentic_command(cmd)
                        else:
                            current_commands.append(cmd)
                            # Collect content for this command
                            if current_content and current_commands and \
                               current_commands[-1].get("type") not in ["delete_lines", "delete_file"]:
                                current_commands[-1]["content_lines"] = self._clean_content(current_content)
                                current_content = []
                else:
                    current_content.append(line)
        
        return self.changeset
    
    def _parse_paws_command(self, cmd_str: str) -> Optional[Dict[str, Any]]:
        """Parse PAWS_CMD for FULL backward compatibility"""
        # REQUEST_CONTEXT command
        if m := REQUEST_CONTEXT_REGEX.match(cmd_str):
            return {
                "type": "request_context",
                "args": self._parse_cmd_args(m.group(1))
            }
        # EXECUTE_AND_REINVOKE command
        if m := EXECUTE_AND_REINVOKE_REGEX.match(cmd_str):
            return {
                "type": "execute_and_reinvoke",
                "args": self._parse_cmd_args(m.group(1))
            }
        # Delta commands
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
                "end": int(m.group(2))
            }
        return None
    
    def _parse_cmd_args(self, arg_str: str) -> Dict[str, str]:
        """Parse PAWS_CMD arguments"""
        args = {}
        try:
            raw_args = re.findall(r'(\w+)\s*=\s*"((?:\\"|[^"])*)"', arg_str)
            for key, value in raw_args:
                args[key] = value.replace('\\"', '"')
        except Exception:
            pass
        return args
    
    def _handle_agentic_command(self, cmd: Dict[str, Any]):
        """Handle REQUEST_CONTEXT and EXECUTE_AND_REINVOKE commands"""
        if cmd["type"] == "request_context":
            print(f"\n--- AI Context Request ---", file=sys.stderr)
            print("The AI has paused execution and requires more context.", file=sys.stderr)
            if reason := cmd["args"].get("reason"):
                print(f"\nReason: {reason}", file=sys.stderr)
            if suggested := cmd["args"].get("suggested_command"):
                print(f"\nSuggested command: {suggested}", file=sys.stderr)
            sys.exit(0)
        elif cmd["type"] == "execute_and_reinvoke":
            if not self.allow_reinvoke:
                print("AI requested command execution, but --allow-reinvoke is not set.", file=sys.stderr)
                sys.exit(1)
            command = cmd["args"].get("command_to_run")
            if not command:
                print("AI requested command execution but provided no command.", file=sys.stderr)
                sys.exit(1)
            
            # Security: Validate command against allowlist
            allowed_patterns = [
                r'^npm (test|run test|run build|run lint)$',
                r'^yarn (test|build|lint)$',
                r'^pnpm (test|build|lint)$',
                r'^make (test|check|build)$',
                r'^pytest',
                r'^cargo (test|build|check)$',
                r'^go test',
                r'^python -m pytest',
                r'^\./test\.sh$'
            ]
            
            import re
            command_safe = command.strip()
            if not any(re.match(pattern, command_safe) for pattern in allowed_patterns):
                print(f"\n⚠️  Security: Command not in allowlist: {command}", file=sys.stderr)
                print("Allowed patterns: npm test, yarn test, pytest, cargo test, etc.", file=sys.stderr)
                sys.exit(1)
            
            print(f"\nAI wants to execute: {command}", file=sys.stderr)
            if input("Proceed? [y/N]: ").lower().strip() == "y":
                # Use subprocess without shell for safety
                parts = command_safe.split()
                subprocess.run(parts, check=True)
                print("Command finished. Re-invoke the AI with new context.", file=sys.stderr)
            sys.exit(0)
    
    def _process_file(self, file_path: str, content_lines: List[str], is_binary: bool, commands: List[Dict] = None):
        """Process a single file from the bundle with FULL delta support"""
        # Check for delete command
        if commands and any(cmd.get("type") == "delete_file" for cmd in commands):
            change = FileChange(
                file_path=file_path,
                operation=FileOperation.DELETE,
                old_content=None,
                new_content=None,
                is_binary=is_binary
            )
            self.changeset.add_change(change)
            return
        
        # Clean up content
        content_lines = self._clean_content(content_lines)
        
        # Determine operation
        abs_path = Path(self.config.get("output_dir", ".")) / file_path
        
        if abs_path.exists():
            operation = FileOperation.MODIFY
            old_content = abs_path.read_text(encoding=DEFAULT_ENCODING) if not is_binary else None
        else:
            operation = FileOperation.CREATE
            old_content = None
        
        # Handle delta commands if present
        if commands:
            # Check if we need original content from delta reference
            if self.original_files and file_path in self.original_files:
                original_lines = self.original_files[file_path]
            elif old_content:
                original_lines = old_content.splitlines()
            else:
                original_lines = []
            
            if original_lines:
                new_content = self._apply_delta_commands(original_lines, commands)
            else:
                # Can't apply deltas without original content
                print(f"Warning: Cannot apply delta commands for '{file_path}' - no original content")
                new_content = "\n".join(content_lines) if content_lines else ""
        else:
            # Handle content normally
            if is_binary:
                content_str = "\n".join(content_lines)
                new_content = base64.b64decode(content_str).decode(DEFAULT_ENCODING, errors='ignore')
            else:
                new_content = "\n".join(content_lines)
        
        change = FileChange(
            file_path=file_path,
            operation=operation,
            old_content=old_content,
            new_content=new_content,
            is_binary=is_binary,
            delta_commands=commands or []
        )
        
        self.changeset.add_change(change)
    
    def _apply_delta_commands(self, original_lines: List[str], commands: List[Dict]) -> str:
        """Apply delta commands to original content - FULL compatibility"""
        new_lines = list(original_lines)
        offset = 0
        
        for cmd in commands:
            cmd_type = cmd["type"]
            content = cmd.get("content_lines", [])
            
            if cmd_type == "replace":
                start = cmd["start"] - 1 + offset
                end = cmd["end"] + offset
                num_deleted = end - start
                new_lines[start:end] = content
                offset += len(content) - num_deleted
            elif cmd_type == "insert":
                line_num = cmd["line_num"] + offset
                new_lines[line_num:line_num] = content
                offset += len(content)
            elif cmd_type == "delete_lines":
                start = cmd["start"] - 1 + offset
                end = cmd["end"] + offset
                del new_lines[start:end]
                offset -= (end - start)
        
        return "\n".join(new_lines)
    
    def _clean_content(self, lines: List[str]) -> List[str]:
        """Remove markdown fences and clean up content"""
        if not lines:
            return []
        
        # Remove markdown fences
        if lines and MARKDOWN_FENCE_REGEX.match(lines[0]):
            lines = lines[1:]
        if lines and MARKDOWN_FENCE_REGEX.match(lines[-1]):
            lines = lines[:-1]
        
        # Remove leading/trailing empty lines
        while lines and not lines[0].strip():
            lines = lines[1:]
        while lines and not lines[-1].strip():
            lines = lines[:-1]
        
        return lines
    
    def apply_changes(self, changeset: ChangeSet) -> bool:
        """Apply accepted changes to the filesystem"""
        success_count = 0
        error_count = 0
        modified_paths = set()
        
        for change in changeset.get_accepted():
            try:
                abs_path = Path(self.config.get("output_dir", ".")) / change.file_path
                
                if change.operation == FileOperation.DELETE:
                    if abs_path.exists():
                        abs_path.unlink()
                        print(f"✓ Deleted: {change.file_path}")
                        success_count += 1
                else:
                    # Create parent directories if needed
                    abs_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Write content
                    if change.is_binary:
                        abs_path.write_bytes(change.new_content.encode(DEFAULT_ENCODING))
                    else:
                        abs_path.write_text(change.new_content, encoding=DEFAULT_ENCODING)
                    
                    action = "Created" if change.operation == FileOperation.CREATE else "Modified"
                    print(f"✓ {action}: {change.file_path}")
                    success_count += 1
                    modified_paths.add(change.file_path)
                    
            except Exception as e:
                print(f"✗ Failed to apply {change.file_path}: {e}")
                error_count += 1
        
        print(f"\nSummary: {success_count} succeeded, {error_count} failed")
        
        # Verify docs sync if requested
        if self.verify_docs and modified_paths:
            self._verify_docs_sync(modified_paths)
        
        return error_count == 0
    
    def _verify_docs_sync(self, modified_paths: set):
        """Verify README.md and CATSCAN.md are in sync"""
        print("\n--- Verifying Documentation Sync ---")
        warnings = 0
        for path in modified_paths:
            if path.lower().endswith("readme.md"):
                catscan_path = path.replace("README.md", "CATSCAN.md").replace("readme.md", "CATSCAN.md")
                if catscan_path not in modified_paths:
                    print(f"Warning: '{path}' was modified, but '{catscan_path}' was not.")
                    warnings += 1
        if warnings == 0:
            print("All README.md files have corresponding CATSCAN.md changes.")
    
    def run_with_verification(self, changeset: ChangeSet, verify_command: str) -> bool:
        """Apply changes with verification and rollback support"""
        if not self.git_handler or not self.git_handler.is_git_repo():
            print("Warning: Not in a git repository. Verification without rollback.")
            return self.apply_changes(changeset)
        
        # Create checkpoint
        print("Creating git checkpoint...")
        if not self.git_handler.create_checkpoint():
            print("Failed to create checkpoint. Aborting.")
            return False
        
        # Apply changes
        print("Applying changes...")
        if not self.apply_changes(changeset):
            print("Failed to apply some changes.")
            self.git_handler.rollback()
            return False
        
        # Run verification
        print(f"Running verification: {verify_command}")
        success, output = self.git_handler.run_verification(verify_command)
        
        if success:
            print("✓ Verification successful!")
            self.git_handler.finalize()
            return True
        else:
            print(f"✗ Verification failed:\n{output}")
            if self.config.get("revert_on_fail", False):
                print("Reverting changes...")
                self.git_handler.rollback()
                print("Changes reverted.")
            return False


def main():
    parser = argparse.ArgumentParser(
        description="DOGS - Extract and apply files from PAWS bundles with interactive review and verification"
    )
    parser.add_argument("bundle_file", nargs="?", default=DEFAULT_INPUT_BUNDLE_FILENAME,
                       help=f"Bundle file (default: {DEFAULT_INPUT_BUNDLE_FILENAME})")
    parser.add_argument("output_dir", nargs="?", default=DEFAULT_OUTPUT_DIR,
                       help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})")
    
    # Interactive mode (NEW)
    parser.add_argument("--interactive", "-i", action="store_true",
                       help="Enable interactive review mode")
    
    # Verification options (NEW)
    parser.add_argument("--verify", metavar="COMMAND",
                       help="Run verification command after applying changes")
    parser.add_argument("--revert-on-fail", action="store_true",
                       help="Automatically revert changes if verification fails")
    
    # BACKWARD COMPATIBILITY - Delta support
    parser.add_argument("-d", "--apply-delta", metavar="REF_BUNDLE",
                       help="Apply deltas using a reference bundle")
    
    # BACKWARD COMPATIBILITY - RSI-Link protocol
    parser.add_argument("--rsi-link", action="store_true",
                       help="Use RSI-Link protocol for self-modification")
    
    # BACKWARD COMPATIBILITY - Allow reinvoke
    parser.add_argument("--allow-reinvoke", action="store_true",
                       help="Allow AI to request command execution")
    
    # BACKWARD COMPATIBILITY - Verify docs
    parser.add_argument("--verify-docs", action="store_true",
                       help="Warn if README.md changed without CATSCAN.md")
    
    # Standard options
    parser.add_argument("-y", "--yes", action="store_true",
                       help="Auto-accept all changes")
    parser.add_argument("-n", "--no", action="store_true",
                       help="Auto-reject all changes")
    parser.add_argument("-q", "--quiet", action="store_true",
                       help="Suppress output")
    
    args = parser.parse_args()
    
    # Build config
    config = {
        "output_dir": args.output_dir,
        "interactive": args.interactive,
        "verify": args.verify,
        "revert_on_fail": args.revert_on_fail,
        "auto_accept": args.yes,
        "auto_reject": args.no,
        "quiet": args.quiet,
        "apply_delta_from": args.apply_delta,
        "rsi_link": args.rsi_link,
        "allow_reinvoke": args.allow_reinvoke,
        "verify_docs": args.verify_docs,
    }
    
    # Read bundle
    if args.bundle_file == "-":
        bundle_content = sys.stdin.read()
    else:
        with open(args.bundle_file, "r", encoding=DEFAULT_ENCODING) as f:
            bundle_content = f.read()
    
    # Process bundle
    processor = BundleProcessor(config)
    changeset = processor.parse_bundle(bundle_content)
    
    if not changeset.changes:
        print("No changes found in bundle.")
        return 0
    
    # Review changes
    if config["interactive"]:
        reviewer = InteractiveReviewer(changeset)
        changeset = reviewer.review()
    elif config["auto_accept"]:
        for change in changeset.changes:
            change.status = "accepted"
    elif config["auto_reject"]:
        for change in changeset.changes:
            change.status = "rejected"
    else:
        # Default: accept all
        for change in changeset.changes:
            change.status = "accepted"
    
    # Apply changes
    if config["verify"]:
        success = processor.run_with_verification(changeset, config["verify"])
    else:
        success = processor.apply_changes(changeset)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())