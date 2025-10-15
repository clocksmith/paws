#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive test suite for PAWS Session Management (paws_session.py)
Tests session creation, management, git worktree integration, and lifecycle operations
"""

import unittest
import os
import sys
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import git
    from git import Repo
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False

if sys.version_info >= (3, 7):
    import paws_session
    from paws_session import (
        Session, SessionStatus, SessionTurn, SessionManager, SessionCLI
    )


@unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
@unittest.skipIf(sys.version_info < (3, 7), "Requires Python 3.7+")
class TestSessionTurn(unittest.TestCase):
    """Test SessionTurn data class"""

    def test_create_session_turn(self):
        """Test creating a basic session turn"""
        turn = SessionTurn(
            turn_number=1,
            timestamp="2024-01-01T12:00:00",
            command="cats src -o bundle.md"
        )
        self.assertEqual(turn.turn_number, 1)
        self.assertEqual(turn.command, "cats src -o bundle.md")
        self.assertIsNone(turn.commit_hash)

    def test_session_turn_with_all_fields(self):
        """Test session turn with all optional fields"""
        turn = SessionTurn(
            turn_number=1,
            timestamp="2024-01-01T12:00:00",
            command="test command",
            commit_hash="abc123",
            cats_file="bundle.md",
            dogs_file="output.md",
            verification_result=True,
            notes="Test notes"
        )
        self.assertEqual(turn.commit_hash, "abc123")
        self.assertTrue(turn.verification_result)
        self.assertEqual(turn.notes, "Test notes")


@unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
@unittest.skipIf(sys.version_info < (3, 7), "Requires Python 3.7+")
class TestSession(unittest.TestCase):
    """Test Session data class and serialization"""

    def test_create_session(self):
        """Test creating a basic session"""
        session = Session(
            session_id="test123",
            name="Test Session",
            created_at="2024-01-01T12:00:00",
            status=SessionStatus.ACTIVE,
            base_branch="main",
            base_commit="abc123",
            workspace_path="/tmp/workspace",
            turns=[],
            metadata={}
        )
        self.assertEqual(session.session_id, "test123")
        self.assertEqual(session.status, SessionStatus.ACTIVE)
        self.assertEqual(len(session.turns), 0)

    def test_session_to_dict(self):
        """Test session serialization to dict"""
        session = Session(
            session_id="test123",
            name="Test Session",
            created_at="2024-01-01T12:00:00",
            status=SessionStatus.ACTIVE,
            base_branch="main",
            base_commit="abc123",
            workspace_path="/tmp/workspace",
            turns=[],
            metadata={"key": "value"}
        )
        data = session.to_dict()

        self.assertEqual(data["session_id"], "test123")
        self.assertEqual(data["status"], "active")
        self.assertEqual(data["metadata"]["key"], "value")

    def test_session_from_dict(self):
        """Test session deserialization from dict"""
        data = {
            "session_id": "test123",
            "name": "Test Session",
            "created_at": "2024-01-01T12:00:00",
            "status": "active",
            "base_branch": "main",
            "base_commit": "abc123",
            "workspace_path": "/tmp/workspace",
            "turns": [],
            "metadata": {}
        }
        session = Session.from_dict(data)

        self.assertEqual(session.session_id, "test123")
        self.assertEqual(session.status, SessionStatus.ACTIVE)

    def test_session_with_turns_serialization(self):
        """Test session with turns serialization round-trip"""
        turn = SessionTurn(
            turn_number=1,
            timestamp="2024-01-01T12:00:00",
            command="test",
            commit_hash="def456"
        )
        session = Session(
            session_id="test123",
            name="Test Session",
            created_at="2024-01-01T12:00:00",
            status=SessionStatus.ACTIVE,
            base_branch="main",
            base_commit="abc123",
            workspace_path="/tmp/workspace",
            turns=[turn],
            metadata={}
        )

        # Serialize and deserialize
        data = session.to_dict()
        restored = Session.from_dict(data)

        self.assertEqual(len(restored.turns), 1)
        self.assertEqual(restored.turns[0].command, "test")
        self.assertEqual(restored.turns[0].commit_hash, "def456")


@unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
@unittest.skipIf(sys.version_info < (3, 7), "Requires Python 3.7+")
class TestSessionManager(unittest.TestCase):
    """Test SessionManager class with git integration"""

    def setUp(self):
        """Set up test environment with git repo"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_session_test_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Initialize git repo
        self.repo = Repo.init(self.test_dir)

        # Create initial commit
        test_file = self.test_dir / "test.txt"
        test_file.write_text("initial content")
        # Use relative path to avoid macOS symlink issues (/var vs /private/var)
        self.repo.index.add(["test.txt"])
        self.repo.index.commit("Initial commit")

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_session_manager_initialization(self):
        """Test SessionManager initialization"""
        manager = SessionManager(self.test_dir)

        self.assertTrue((self.test_dir / ".paws").exists())
        self.assertTrue((self.test_dir / ".paws" / "sessions").exists())

    def test_create_session(self):
        """Test creating a new session"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        self.assertIsNotNone(session.session_id)
        self.assertEqual(session.name, "Test Session")
        self.assertEqual(session.status, SessionStatus.ACTIVE)

        # Check worktree was created
        workspace_path = Path(session.workspace_path)
        self.assertTrue(workspace_path.exists())
        self.assertTrue((workspace_path / ".git").exists())

    def test_create_session_with_base_branch(self):
        """Test creating session with specific base branch"""
        manager = SessionManager(self.test_dir)

        # Create a new branch
        self.repo.create_head("feature")

        session = manager.create_session("Test Session", base_branch="feature")
        self.assertEqual(session.base_branch, "feature")

    def test_list_sessions(self):
        """Test listing sessions"""
        manager = SessionManager(self.test_dir)

        # Create multiple sessions
        session1 = manager.create_session("Session 1")
        session2 = manager.create_session("Session 2")

        sessions = manager.list_sessions()
        self.assertEqual(len(sessions), 2)

        # Sessions should be sorted by created_at (newest first)
        session_ids = [s.session_id for s in sessions]
        self.assertIn(session1.session_id, session_ids)
        self.assertIn(session2.session_id, session_ids)

    def test_list_sessions_by_status(self):
        """Test filtering sessions by status"""
        manager = SessionManager(self.test_dir)

        session1 = manager.create_session("Active Session")
        session2 = manager.create_session("Archived Session")

        # Archive second session
        manager.archive_session(session2.session_id)

        active_sessions = manager.list_sessions(status=SessionStatus.ACTIVE)
        self.assertEqual(len(active_sessions), 1)
        self.assertEqual(active_sessions[0].session_id, session1.session_id)

        archived_sessions = manager.list_sessions(status=SessionStatus.ARCHIVED)
        self.assertEqual(len(archived_sessions), 1)

    def test_get_session(self):
        """Test retrieving a specific session"""
        manager = SessionManager(self.test_dir)
        created_session = manager.create_session("Test Session")

        retrieved_session = manager.get_session(created_session.session_id)
        self.assertIsNotNone(retrieved_session)
        self.assertEqual(retrieved_session.session_id, created_session.session_id)
        self.assertEqual(retrieved_session.name, "Test Session")

    def test_get_nonexistent_session(self):
        """Test retrieving non-existent session returns None"""
        manager = SessionManager(self.test_dir)
        session = manager.get_session("nonexistent")
        self.assertIsNone(session)

    def test_add_turn(self):
        """Test adding a turn to a session"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        turn = manager.add_turn(
            session.session_id,
            "cats src -o bundle.md",
            cats_file="bundle.md"
        )

        self.assertEqual(turn.turn_number, 1)
        self.assertEqual(turn.command, "cats src -o bundle.md")

        # Verify turn was persisted
        updated_session = manager.get_session(session.session_id)
        self.assertEqual(len(updated_session.turns), 1)

    def test_add_multiple_turns(self):
        """Test adding multiple turns increments turn numbers"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        turn1 = manager.add_turn(session.session_id, "command 1")
        turn2 = manager.add_turn(session.session_id, "command 2")
        turn3 = manager.add_turn(session.session_id, "command 3")

        self.assertEqual(turn1.turn_number, 1)
        self.assertEqual(turn2.turn_number, 2)
        self.assertEqual(turn3.turn_number, 3)

    def test_add_turn_creates_commit(self):
        """Test that adding turn with changes creates a commit"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        # Make changes in workspace
        workspace_path = Path(session.workspace_path)
        (workspace_path / "new_file.txt").write_text("new content")

        turn = manager.add_turn(session.session_id, "test command")

        # Should have created a commit
        self.assertIsNotNone(turn.commit_hash)

    def test_rewind_session(self):
        """Test rewinding session to previous turn"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        # Add some turns with file changes
        workspace_path = Path(session.workspace_path)

        (workspace_path / "file1.txt").write_text("content 1")
        turn1 = manager.add_turn(session.session_id, "add file1")

        (workspace_path / "file2.txt").write_text("content 2")
        turn2 = manager.add_turn(session.session_id, "add file2")

        # Rewind to turn 1
        success = manager.rewind_session(session.session_id, 1)
        self.assertTrue(success)

        # Verify file state
        self.assertTrue((workspace_path / "file1.txt").exists())
        self.assertFalse((workspace_path / "file2.txt").exists())

        # Verify turns were removed
        updated_session = manager.get_session(session.session_id)
        self.assertEqual(len(updated_session.turns), 1)

    def test_rewind_to_invalid_turn(self):
        """Test rewinding to invalid turn number"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        with self.assertRaises(ValueError):
            manager.rewind_session(session.session_id, 99)

    def test_archive_session(self):
        """Test archiving a session"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        success = manager.archive_session(session.session_id)
        self.assertTrue(success)

        # Verify status changed
        updated_session = manager.get_session(session.session_id)
        self.assertEqual(updated_session.status, SessionStatus.ARCHIVED)

        # Workspace should be removed
        workspace_path = Path(session.workspace_path)
        self.assertFalse(workspace_path.exists())

    def test_delete_session(self):
        """Test deleting a session completely"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")
        session_id = session.session_id

        success = manager.delete_session(session_id)
        self.assertTrue(success)

        # Session should no longer exist
        retrieved = manager.get_session(session_id)
        self.assertIsNone(retrieved)

        # Session directory should be removed
        session_path = manager._get_session_path(session_id)
        self.assertFalse(session_path.exists())

    def test_merge_session(self):
        """Test merging session back to base branch"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test Session")

        # Make some changes in session workspace
        workspace_path = Path(session.workspace_path)
        (workspace_path / "feature.txt").write_text("feature content")
        manager.add_turn(session.session_id, "add feature")

        # Merge session
        success = manager.merge_session(session.session_id)
        self.assertTrue(success)

        # Verify status changed
        updated_session = manager.get_session(session.session_id)
        self.assertEqual(updated_session.status, SessionStatus.MERGED)

        # Verify changes are in main repo
        self.assertTrue((self.test_dir / "feature.txt").exists())

    def test_session_persistence(self):
        """Test that sessions persist across SessionManager instances"""
        manager1 = SessionManager(self.test_dir)
        session = manager1.create_session("Test Session")
        session_id = session.session_id

        # Create new manager instance
        manager2 = SessionManager(self.test_dir)
        retrieved = manager2.get_session(session_id)

        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.name, "Test Session")


@unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
@unittest.skipIf(sys.version_info < (3, 7), "Requires Python 3.7+")
class TestSessionCLI(unittest.TestCase):
    """Test SessionCLI user interface"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_cli_test_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Initialize git repo
        self.repo = Repo.init(self.test_dir)
        test_file = self.test_dir / "test.txt"
        test_file.write_text("initial content")
        # Use relative path to avoid macOS symlink issues
        self.repo.index.add(["test.txt"])
        self.repo.index.commit("Initial commit")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_cli_start_session(self):
        """Test CLI start_session command"""
        cli = SessionCLI()

        with patch('builtins.print'):
            cli.start_session("My Session")

        # Verify session was created
        sessions = cli.manager.list_sessions()
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0].name, "My Session")

    def test_cli_list_sessions(self):
        """Test CLI list_sessions command"""
        cli = SessionCLI()
        cli.manager.create_session("Session 1")
        cli.manager.create_session("Session 2")

        with patch('builtins.print'):
            cli.list_sessions()

    def test_cli_show_session(self):
        """Test CLI show_session command"""
        cli = SessionCLI()
        session = cli.manager.create_session("Test Session")

        with patch('builtins.print'):
            cli.show_session(session.session_id)


@unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
@unittest.skipIf(sys.version_info < (3, 7), "Requires Python 3.7+")
class TestSessionEdgeCases(unittest.TestCase):
    """Test edge cases and error scenarios"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_edge_test_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        self.repo = Repo.init(self.test_dir)
        test_file = self.test_dir / "test.txt"
        test_file.write_text("initial")
        # Use relative path to avoid macOS symlink issues
        self.repo.index.add(["test.txt"])
        self.repo.index.commit("Initial commit")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_session_with_special_characters_in_name(self):
        """Test session names with special characters"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test / Session: [Special] Characters!")

        self.assertEqual(session.name, "Test / Session: [Special] Characters!")

        # Should be able to retrieve it
        retrieved = manager.get_session(session.session_id)
        self.assertIsNotNone(retrieved)

    def test_session_with_very_long_name(self):
        """Test session with very long name"""
        manager = SessionManager(self.test_dir)
        long_name = "A" * 500
        session = manager.create_session(long_name)

        self.assertEqual(session.name, long_name)

    def test_add_turn_with_empty_command(self):
        """Test adding turn with empty command"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test")

        turn = manager.add_turn(session.session_id, "")
        self.assertEqual(turn.command, "")

    def test_add_turn_to_nonexistent_session(self):
        """Test adding turn to non-existent session raises error"""
        manager = SessionManager(self.test_dir)

        with self.assertRaises(ValueError):
            manager.add_turn("nonexistent", "command")

    def test_rewind_session_without_commits(self):
        """Test rewinding session when turns have no commits"""
        manager = SessionManager(self.test_dir)
        session = manager.create_session("Test")

        # Add turn but don't make any changes (no commit will be created)
        # We'll mock this by directly adding a turn to the session
        session.turns.append(SessionTurn(
            turn_number=1,
            timestamp="2024-01-01T12:00:00",
            command="test",
            commit_hash=None
        ))
        manager._save_session(session)

        # Rewinding should fail gracefully
        success = manager.rewind_session(session.session_id, 1)
        self.assertFalse(success)

    def test_concurrent_session_operations(self):
        """Test multiple sessions can be managed concurrently"""
        manager = SessionManager(self.test_dir)

        session1 = manager.create_session("Session 1")
        session2 = manager.create_session("Session 2")

        # Make changes in both sessions
        workspace1 = Path(session1.workspace_path)
        workspace2 = Path(session2.workspace_path)

        (workspace1 / "file1.txt").write_text("content 1")
        (workspace2 / "file2.txt").write_text("content 2")

        manager.add_turn(session1.session_id, "add file1")
        manager.add_turn(session2.session_id, "add file2")

        # Both sessions should exist independently
        self.assertTrue((workspace1 / "file1.txt").exists())
        self.assertTrue((workspace2 / "file2.txt").exists())
        self.assertFalse((workspace1 / "file2.txt").exists())
        self.assertFalse((workspace2 / "file1.txt").exists())

    def test_session_metadata_persistence(self):
        """Test that session metadata is properly persisted"""
        manager = SessionManager(self.test_dir)

        # Create session and add metadata
        session = manager.create_session("Test")
        session.metadata["custom_field"] = "custom_value"
        session.metadata["tags"] = ["tag1", "tag2"]
        manager._save_session(session)

        # Retrieve and verify metadata
        retrieved = manager.get_session(session.session_id)
        self.assertEqual(retrieved.metadata["custom_field"], "custom_value")
        self.assertEqual(retrieved.metadata["tags"], ["tag1", "tag2"])


if __name__ == "__main__":
    # Run with verbose output
    unittest.main(verbosity=2)
