#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAWS Session Management - Stateful sessions via Git Worktrees
Part of the PAWS CLI Evolution - Phase 3 Implementation
"""

import sys
import os
import argparse
import json
import uuid
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import git
    from git import Repo
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False
    print("Warning: GitPython not installed. Session management requires git.")

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.tree import Tree
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


class SessionStatus(Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    MERGED = "merged"
    ABANDONED = "abandoned"


@dataclass
class SessionTurn:
    """Represents a single turn in a session"""
    turn_number: int
    timestamp: str
    command: str
    commit_hash: Optional[str] = None
    cats_file: Optional[str] = None
    dogs_file: Optional[str] = None
    verification_result: Optional[bool] = None
    notes: Optional[str] = None


@dataclass
class Session:
    """Represents a PAWS work session"""
    session_id: str
    name: str
    created_at: str
    status: SessionStatus
    base_branch: str
    base_commit: str
    workspace_path: str
    turns: List[SessionTurn]
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict:
        """Convert session to dictionary for JSON serialization"""
        return {
            "session_id": self.session_id,
            "name": self.name,
            "created_at": self.created_at,
            "status": self.status.value,
            "base_branch": self.base_branch,
            "base_commit": self.base_commit,
            "workspace_path": self.workspace_path,
            "turns": [asdict(turn) for turn in self.turns],
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Session':
        """Create session from dictionary"""
        return cls(
            session_id=data["session_id"],
            name=data["name"],
            created_at=data["created_at"],
            status=SessionStatus(data["status"]),
            base_branch=data["base_branch"],
            base_commit=data["base_commit"],
            workspace_path=data["workspace_path"],
            turns=[SessionTurn(**turn) for turn in data.get("turns", [])],
            metadata=data.get("metadata", {})
        )


class SessionManager:
    """Manages PAWS work sessions using git worktrees"""
    
    def __init__(self, root_path: Path = Path(".")):
        self.root_path = root_path.resolve()
        self.paws_dir = self.root_path / ".paws"
        self.sessions_dir = self.paws_dir / "sessions"
        self.repo = None
        
        if not GIT_AVAILABLE:
            raise RuntimeError("Git support is required for session management")
        
        try:
            self.repo = Repo(self.root_path)
        except:
            raise RuntimeError("Not in a git repository")
        
        # Initialize PAWS directory structure
        self._initialize_directories()
    
    def _initialize_directories(self):
        """Create necessary directories"""
        self.paws_dir.mkdir(exist_ok=True)
        self.sessions_dir.mkdir(exist_ok=True)
        
        # Add .paws to gitignore if not already there
        gitignore_path = self.root_path / ".gitignore"
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                content = f.read()
            if ".paws/" not in content:
                with open(gitignore_path, 'a') as f:
                    f.write("\n# PAWS session data\n.paws/\n")
    
    def _get_session_path(self, session_id: str) -> Path:
        """Get the path for a session"""
        return self.sessions_dir / session_id
    
    def _load_session(self, session_id: str) -> Optional[Session]:
        """Load a session from disk"""
        session_path = self._get_session_path(session_id)
        manifest_path = session_path / "session.json"
        
        if not manifest_path.exists():
            return None
        
        with open(manifest_path, 'r') as f:
            data = json.load(f)
        
        return Session.from_dict(data)
    
    def _save_session(self, session: Session):
        """Save a session to disk"""
        session_path = self._get_session_path(session.session_id)
        session_path.mkdir(exist_ok=True)
        
        manifest_path = session_path / "session.json"
        with open(manifest_path, 'w') as f:
            json.dump(session.to_dict(), f, indent=2)
    
    def create_session(self, name: str, base_branch: Optional[str] = None) -> Session:
        """Create a new work session"""
        session_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().isoformat()
        
        # Get current branch and commit
        if base_branch is None:
            base_branch = self.repo.active_branch.name
        base_commit = self.repo.head.commit.hexsha
        
        # Create worktree for the session
        workspace_path = self._get_session_path(session_id) / "workspace"
        branch_name = f"paws-session-{session_id}"
        
        try:
            # Create a new branch and worktree
            self.repo.git.worktree('add', '-b', branch_name, str(workspace_path), base_commit)
        except Exception as e:
            raise RuntimeError(f"Failed to create worktree: {e}")
        
        # Create session object
        session = Session(
            session_id=session_id,
            name=name,
            created_at=timestamp,
            status=SessionStatus.ACTIVE,
            base_branch=base_branch,
            base_commit=base_commit,
            workspace_path=str(workspace_path),
            turns=[],
            metadata={}
        )
        
        # Save session
        self._save_session(session)
        
        print(f"✓ Created session: {session_id} - {name}")
        print(f"  Workspace: {workspace_path}")
        print(f"  Base: {base_branch} ({base_commit[:8]})")
        
        return session
    
    def list_sessions(self, status: Optional[SessionStatus] = None) -> List[Session]:
        """List all sessions, optionally filtered by status"""
        sessions = []
        
        for session_dir in self.sessions_dir.iterdir():
            if session_dir.is_dir():
                session = self._load_session(session_dir.name)
                if session:
                    if status is None or session.status == status:
                        sessions.append(session)
        
        return sorted(sessions, key=lambda s: s.created_at, reverse=True)
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """Get a specific session"""
        return self._load_session(session_id)
    
    def add_turn(self, session_id: str, command: str, **kwargs) -> SessionTurn:
        """Add a turn to a session"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        turn_number = len(session.turns) + 1
        timestamp = datetime.now().isoformat()
        
        turn = SessionTurn(
            turn_number=turn_number,
            timestamp=timestamp,
            command=command,
            **kwargs
        )
        
        session.turns.append(turn)
        
        # Create a checkpoint commit if in workspace
        workspace_repo = Repo(session.workspace_path)
        if workspace_repo.is_dirty(untracked_files=True):
            try:
                workspace_repo.git.add('-A')
                commit_msg = f"Turn {turn_number}: {command[:50]}"
                workspace_repo.index.commit(commit_msg)
                turn.commit_hash = workspace_repo.head.commit.hexsha
            except Exception as e:
                print(f"Warning: Could not create checkpoint: {e}")
        
        self._save_session(session)
        return turn
    
    def rewind_session(self, session_id: str, to_turn: int) -> bool:
        """Rewind a session to a previous turn"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if to_turn < 1 or to_turn > len(session.turns):
            raise ValueError(f"Invalid turn number: {to_turn}")
        
        target_turn = session.turns[to_turn - 1]
        if not target_turn.commit_hash:
            print(f"Turn {to_turn} has no checkpoint commit")
            return False
        
        try:
            workspace_repo = Repo(session.workspace_path)
            workspace_repo.git.reset('--hard', target_turn.commit_hash)
            
            # Remove turns after the target
            session.turns = session.turns[:to_turn]
            self._save_session(session)
            
            print(f"✓ Rewound session to turn {to_turn}")
            return True
        except Exception as e:
            print(f"Failed to rewind: {e}")
            return False
    
    def merge_session(self, session_id: str, target_branch: Optional[str] = None) -> bool:
        """Merge a session's changes back to the main branch"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if target_branch is None:
            target_branch = session.base_branch
        
        try:
            # Switch to target branch in main repo
            self.repo.git.checkout(target_branch)
            
            # Merge the session branch
            session_branch = f"paws-session-{session_id}"
            self.repo.git.merge(session_branch, '--no-ff', 
                              '-m', f"Merge PAWS session: {session.name}")
            
            # Update session status
            session.status = SessionStatus.MERGED
            self._save_session(session)
            
            # Clean up worktree
            self.repo.git.worktree('remove', session.workspace_path)
            
            print(f"✓ Merged session {session_id} into {target_branch}")
            return True
            
        except Exception as e:
            print(f"Failed to merge: {e}")
            return False
    
    def archive_session(self, session_id: str) -> bool:
        """Archive a session without merging"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        try:
            # Remove worktree but keep the branch
            if Path(session.workspace_path).exists():
                self.repo.git.worktree('remove', session.workspace_path)
            
            session.status = SessionStatus.ARCHIVED
            self._save_session(session)
            
            print(f"✓ Archived session {session_id}")
            return True
            
        except Exception as e:
            print(f"Failed to archive: {e}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """Completely delete a session"""
        session = self._load_session(session_id)
        if not session:
            return False
        
        try:
            # Remove worktree if it exists
            if Path(session.workspace_path).exists():
                self.repo.git.worktree('remove', session.workspace_path, '--force')
            
            # Delete the branch
            branch_name = f"paws-session-{session_id}"
            try:
                self.repo.git.branch('-D', branch_name)
            except:
                pass  # Branch might not exist
            
            # Remove session directory
            session_path = self._get_session_path(session_id)
            shutil.rmtree(session_path)
            
            print(f"✓ Deleted session {session_id}")
            return True
            
        except Exception as e:
            print(f"Failed to delete: {e}")
            return False


class SessionCLI:
    """Command-line interface for session management"""
    
    def __init__(self):
        self.manager = SessionManager()
        self.console = Console() if RICH_AVAILABLE else None
    
    def start_session(self, name: str, base_branch: Optional[str] = None):
        """Start a new session"""
        session = self.manager.create_session(name, base_branch)
        
        if RICH_AVAILABLE and self.console:
            panel = Panel(
                f"[green]Session created successfully![/]\n\n"
                f"ID: {session.session_id}\n"
                f"Name: {session.name}\n"
                f"Workspace: {session.workspace_path}\n\n"
                f"To work in this session, use:\n"
                f"  cd {session.workspace_path}\n"
                f"Or use --session {session.session_id} with PAWS commands",
                title="New Session"
            )
            self.console.print(panel)
    
    def list_sessions(self, show_archived: bool = False):
        """List all sessions"""
        sessions = self.manager.list_sessions()
        
        if not sessions:
            print("No sessions found.")
            return
        
        if RICH_AVAILABLE and self.console:
            table = Table(title="PAWS Sessions")
            table.add_column("ID", style="cyan")
            table.add_column("Name", style="green")
            table.add_column("Status")
            table.add_column("Created")
            table.add_column("Turns")
            table.add_column("Base Branch")
            
            for session in sessions:
                if not show_archived and session.status == SessionStatus.ARCHIVED:
                    continue
                
                status_style = {
                    SessionStatus.ACTIVE: "green",
                    SessionStatus.ARCHIVED: "yellow",
                    SessionStatus.MERGED: "blue",
                    SessionStatus.ABANDONED: "red"
                }.get(session.status, "white")
                
                table.add_row(
                    session.session_id,
                    session.name,
                    f"[{status_style}]{session.status.value}[/]",
                    session.created_at[:10],
                    str(len(session.turns)),
                    session.base_branch
                )
            
            self.console.print(table)
        else:
            # Fallback to simple text output
            print("\nPAWS Sessions:")
            print("-" * 60)
            for session in sessions:
                if not show_archived and session.status == SessionStatus.ARCHIVED:
                    continue
                print(f"{session.session_id}: {session.name} [{session.status.value}]")
                print(f"  Created: {session.created_at[:10]}, Turns: {len(session.turns)}")
    
    def show_session(self, session_id: str):
        """Show details of a specific session"""
        session = self.manager.get_session(session_id)
        if not session:
            print(f"Session {session_id} not found.")
            return
        
        if RICH_AVAILABLE and self.console:
            # Create a tree view of the session
            tree = Tree(f"[bold]Session: {session.name}[/] ({session.session_id})")
            
            info_branch = tree.add("📋 Information")
            info_branch.add(f"Status: {session.status.value}")
            info_branch.add(f"Created: {session.created_at}")
            info_branch.add(f"Base: {session.base_branch} @ {session.base_commit[:8]}")
            info_branch.add(f"Workspace: {session.workspace_path}")
            
            if session.turns:
                turns_branch = tree.add(f"🔄 Turns ({len(session.turns)})")
                for turn in session.turns[-5:]:  # Show last 5 turns
                    turn_text = f"Turn {turn.turn_number}: {turn.command[:50]}"
                    if turn.verification_result is not None:
                        status = "✓" if turn.verification_result else "✗"
                        turn_text += f" [{status}]"
                    turns_branch.add(turn_text)
                
                if len(session.turns) > 5:
                    turns_branch.add(f"... and {len(session.turns) - 5} more")
            
            self.console.print(tree)
        else:
            # Fallback to simple text output
            print(f"\nSession: {session.name} ({session.session_id})")
            print(f"Status: {session.status.value}")
            print(f"Created: {session.created_at}")
            print(f"Base: {session.base_branch} @ {session.base_commit[:8]}")
            print(f"Turns: {len(session.turns)}")
    
    def rewind_session(self, session_id: str, to_turn: int):
        """Rewind a session to a specific turn"""
        if self.manager.rewind_session(session_id, to_turn):
            print(f"Session {session_id} rewound to turn {to_turn}")
    
    def merge_session(self, session_id: str, target_branch: Optional[str] = None):
        """Merge a session"""
        if RICH_AVAILABLE and self.console:
            if not Confirm.ask(f"Merge session {session_id} into {target_branch or 'base branch'}?"):
                return
        else:
            response = input(f"Merge session {session_id}? [y/N]: ")
            if response.lower() != 'y':
                return
        
        if self.manager.merge_session(session_id, target_branch):
            print(f"Session {session_id} merged successfully")
    
    def archive_session(self, session_id: str):
        """Archive a session"""
        if self.manager.archive_session(session_id):
            print(f"Session {session_id} archived")
    
    def delete_session(self, session_id: str):
        """Delete a session"""
        if RICH_AVAILABLE and self.console:
            if not Confirm.ask(f"[red]Permanently delete session {session_id}?[/]"):
                return
        else:
            response = input(f"Permanently delete session {session_id}? [y/N]: ")
            if response.lower() != 'y':
                return
        
        if self.manager.delete_session(session_id):
            print(f"Session {session_id} deleted")


def main():
    parser = argparse.ArgumentParser(
        description="PAWS Session Management - Stateful sessions via Git Worktrees"
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Start command
    start_parser = subparsers.add_parser('start', help='Start a new session')
    start_parser.add_argument('name', help='Name for the session')
    start_parser.add_argument('--base', help='Base branch (default: current branch)')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List all sessions')
    list_parser.add_argument('--all', action='store_true', help='Include archived sessions')
    
    # Show command
    show_parser = subparsers.add_parser('show', help='Show session details')
    show_parser.add_argument('session_id', help='Session ID')
    
    # Rewind command
    rewind_parser = subparsers.add_parser('rewind', help='Rewind session to a turn')
    rewind_parser.add_argument('session_id', help='Session ID')
    rewind_parser.add_argument('--to-turn', type=int, required=True, help='Turn number')
    
    # Merge command
    merge_parser = subparsers.add_parser('merge', help='Merge session changes')
    merge_parser.add_argument('session_id', help='Session ID')
    merge_parser.add_argument('--into', help='Target branch (default: base branch)')
    
    # Archive command
    archive_parser = subparsers.add_parser('archive', help='Archive a session')
    archive_parser.add_argument('session_id', help='Session ID')
    
    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete a session')
    delete_parser.add_argument('session_id', help='Session ID')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    try:
        cli = SessionCLI()
        
        if args.command == 'start':
            cli.start_session(args.name, args.base)
        elif args.command == 'list':
            cli.list_sessions(args.all)
        elif args.command == 'show':
            cli.show_session(args.session_id)
        elif args.command == 'rewind':
            cli.rewind_session(args.session_id, args.to_turn)
        elif args.command == 'merge':
            cli.merge_session(args.session_id, args.into)
        elif args.command == 'archive':
            cli.archive_session(args.session_id)
        elif args.command == 'delete':
            cli.delete_session(args.session_id)
        
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())