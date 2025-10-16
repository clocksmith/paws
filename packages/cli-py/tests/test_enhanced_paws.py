#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test suite for enhanced PAWS functionality
"""

import unittest
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dogs import FileChange, ChangeSet, FileOperation, BundleProcessor, GIT_AVAILABLE
from cats import ProjectAnalyzer, FileTreeNode
from paws_session import Session, SessionStatus, SessionManager, SessionTurn


class TestFileChange(unittest.TestCase):
    """Test FileChange class"""
    
    def test_create_file_change(self):
        """Test creating a file change"""
        change = FileChange(
            file_path="test.py",
            operation=FileOperation.CREATE,
            new_content="print('hello')"
        )
        self.assertEqual(change.file_path, "test.py")
        self.assertEqual(change.operation, FileOperation.CREATE)
        self.assertEqual(change.status, "pending")
    
    def test_get_diff(self):
        """Test diff generation"""
        change = FileChange(
            file_path="test.py",
            operation=FileOperation.MODIFY,
            old_content="print('hello')",
            new_content="print('world')"
        )
        diff = change.get_diff()
        self.assertIn("-print('hello')", diff)
        self.assertIn("+print('world')", diff)


class TestChangeSet(unittest.TestCase):
    """Test ChangeSet class"""
    
    def test_add_change(self):
        """Test adding changes to changeset"""
        changeset = ChangeSet()
        change = FileChange(
            file_path="test.py",
            operation=FileOperation.CREATE,
            new_content="print('hello')"
        )
        changeset.add_change(change)
        self.assertEqual(len(changeset.changes), 1)
    
    def test_get_accepted(self):
        """Test filtering accepted changes"""
        changeset = ChangeSet()
        
        change1 = FileChange(
            file_path="test1.py",
            operation=FileOperation.CREATE,
            new_content="print('1')"
        )
        change1.status = "accepted"
        
        change2 = FileChange(
            file_path="test2.py",
            operation=FileOperation.CREATE,
            new_content="print('2')"
        )
        change2.status = "rejected"
        
        changeset.add_change(change1)
        changeset.add_change(change2)
        
        accepted = changeset.get_accepted()
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0].file_path, "test1.py")
    
    def test_summary(self):
        """Test changeset summary"""
        changeset = ChangeSet()
        
        for i in range(5):
            change = FileChange(
                file_path=f"test{i}.py",
                operation=FileOperation.CREATE,
                new_content=f"print('{i}')"
            )
            if i < 2:
                change.status = "accepted"
            elif i < 4:
                change.status = "rejected"
            changeset.add_change(change)
        
        summary = changeset.summary()
        self.assertEqual(summary["total"], 5)
        self.assertEqual(summary["accepted"], 2)
        self.assertEqual(summary["rejected"], 2)
        self.assertEqual(summary["pending"], 1)


class TestBundleProcessor(unittest.TestCase):
    """Test enhanced bundle processor"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = tempfile.mkdtemp()
        self.config = {
            "output_dir": self.temp_dir,
            "interactive": False,
            "verify": None,
            "auto_accept": True
        }
    
    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.temp_dir)
    
    def test_parse_bundle(self):
        """Test parsing a bundle"""
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
```python
print('hello world')
```
🐕 --- DOGS_END_FILE: test.py ---
"""
        processor = BundleProcessor(self.config)
        changeset = processor.parse_bundle(bundle_content)
        
        self.assertEqual(len(changeset.changes), 1)
        change = changeset.changes[0]
        self.assertEqual(change.file_path, "test.py")
        self.assertEqual(change.operation, FileOperation.CREATE)
        self.assertIn("print('hello world')", change.new_content)
    
    def test_apply_changes(self):
        """Test applying changes to filesystem"""
        processor = BundleProcessor(self.config)
        
        changeset = ChangeSet()
        change = FileChange(
            file_path="test.py",
            operation=FileOperation.CREATE,
            new_content="print('hello')"
        )
        change.status = "accepted"
        changeset.add_change(change)
        
        success = processor.apply_changes(changeset)
        self.assertTrue(success)
        
        # Check file was created
        test_file = Path(self.temp_dir) / "test.py"
        self.assertTrue(test_file.exists())
        self.assertEqual(test_file.read_text(), "print('hello')")


class TestProjectAnalyzer(unittest.TestCase):
    """Test project analyzer"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp())
        
        # Create test project structure
        (self.temp_dir / "src").mkdir()
        (self.temp_dir / "src" / "main.py").write_text("print('main')")
        (self.temp_dir / "src" / "utils.py").write_text("print('utils')")
        (self.temp_dir / "tests").mkdir()
        (self.temp_dir / "tests" / "test_main.py").write_text("print('test')")
        (self.temp_dir / ".gitignore").write_text("*.pyc\n__pycache__/\n")
    
    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.temp_dir)
    
    def test_build_file_tree(self):
        """Test building file tree"""
        analyzer = ProjectAnalyzer(self.temp_dir)
        tree = analyzer.build_file_tree()
        
        self.assertIsNotNone(tree)
        self.assertTrue(tree.is_dir)
        self.assertEqual(Path(tree.path), self.temp_dir)
        
        # Check that files are in tree
        tree_str = tree.to_string()
        self.assertIn("main.py", tree_str)
        self.assertIn("utils.py", tree_str)
        self.assertIn("test_main.py", tree_str)
    
    def test_gitignore_patterns(self):
        """Test gitignore pattern loading"""
        analyzer = ProjectAnalyzer(self.temp_dir)
        
        self.assertIn("*.pyc", analyzer.gitignore_patterns)
        self.assertIn("__pycache__", analyzer.gitignore_patterns)
        self.assertIn("node_modules", analyzer.gitignore_patterns)  # Default pattern


class TestSession(unittest.TestCase):
    """Test Session class"""
    
    def test_session_creation(self):
        """Test creating a session"""
        session = Session(
            session_id="test123",
            name="Test Session",
            created_at="2024-01-01T00:00:00",
            status=SessionStatus.ACTIVE,
            base_branch="main",
            base_commit="abc123",
            workspace_path="/tmp/workspace",
            turns=[],
            metadata={}
        )
        
        self.assertEqual(session.session_id, "test123")
        self.assertEqual(session.name, "Test Session")
        self.assertEqual(session.status, SessionStatus.ACTIVE)
    
    def test_session_serialization(self):
        """Test session to/from dict"""
        turn = SessionTurn(
            turn_number=1,
            timestamp="2024-01-01T00:00:00",
            command="test command",
            commit_hash="def456"
        )
        
        session = Session(
            session_id="test123",
            name="Test Session",
            created_at="2024-01-01T00:00:00",
            status=SessionStatus.ACTIVE,
            base_branch="main",
            base_commit="abc123",
            workspace_path="/tmp/workspace",
            turns=[turn],
            metadata={"key": "value"}
        )
        
        # Convert to dict
        data = session.to_dict()
        self.assertEqual(data["session_id"], "test123")
        self.assertEqual(data["status"], "active")
        self.assertEqual(len(data["turns"]), 1)
        
        # Convert back from dict
        restored = Session.from_dict(data)
        self.assertEqual(restored.session_id, session.session_id)
        self.assertEqual(restored.status, session.status)
        self.assertEqual(len(restored.turns), 1)
        self.assertEqual(restored.turns[0].command, "test command")


class TestSessionManager(unittest.TestCase):
    """Test SessionManager class"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp())
        
        # Initialize git repo
        os.system(f"cd {self.temp_dir} && git init && git config user.name 'Test' && git config user.email 'test@test.com'")
        
        # Create initial commit
        (self.temp_dir / "README.md").write_text("# Test")
        os.system(f"cd {self.temp_dir} && git add . && git commit -m 'Initial'")
    
    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.temp_dir)
    
    @unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
    def test_create_session(self):
        """Test creating a session"""
        manager = SessionManager(self.temp_dir)
        session = manager.create_session("Test Session")
        
        self.assertIsNotNone(session)
        self.assertEqual(session.name, "Test Session")
        self.assertEqual(session.status, SessionStatus.ACTIVE)
        
        # Check that workspace was created
        workspace_path = Path(session.workspace_path)
        self.assertTrue(workspace_path.exists())
    
    @unittest.skipIf(not GIT_AVAILABLE, "GitPython not available")
    def test_list_sessions(self):
        """Test listing sessions"""
        manager = SessionManager(self.temp_dir)
        
        # Create multiple sessions
        session1 = manager.create_session("Session 1")
        session2 = manager.create_session("Session 2")
        
        sessions = manager.list_sessions()
        self.assertEqual(len(sessions), 2)
        
        # Archive one session
        manager.archive_session(session1.session_id)
        
        # List only active sessions
        active_sessions = manager.list_sessions(status=SessionStatus.ACTIVE)
        self.assertEqual(len(active_sessions), 1)
        self.assertEqual(active_sessions[0].session_id, session2.session_id)


class TestIntegration(unittest.TestCase):
    """Integration tests for the full workflow"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp())
        
        # Initialize git repo
        os.system(f"cd {self.temp_dir} && git init && git config user.name 'Test' && git config user.email 'test@test.com'")
        
        # Create test files
        (self.temp_dir / "main.py").write_text("def main():\n    print('hello')\n")
        os.system(f"cd {self.temp_dir} && git add . && git commit -m 'Initial'")
    
    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.temp_dir)
    
    def test_full_workflow(self):
        """Test complete PAWS workflow"""
        # 1. Create a bundle with changes
        bundle_content = """
🐕 --- DOGS_START_FILE: main.py ---
def main():
    print('hello world')
    return 0
🐕 --- DOGS_END_FILE: main.py ---

🐕 --- DOGS_START_FILE: utils.py ---
def helper():
    return "help"
🐕 --- DOGS_END_FILE: utils.py ---
"""
        
        # 2. Process the bundle
        config = {
            "output_dir": str(self.temp_dir),
            "interactive": False,
            "verify": None,
            "auto_accept": True
        }
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)
        
        # 3. Accept all changes
        for change in changeset.changes:
            change.status = "accepted"
        
        # 4. Apply changes
        success = processor.apply_changes(changeset)
        self.assertTrue(success)
        
        # 5. Verify files were updated/created
        main_py = self.temp_dir / "main.py"
        utils_py = self.temp_dir / "utils.py"
        
        self.assertTrue(main_py.exists())
        self.assertTrue(utils_py.exists())
        self.assertIn("hello world", main_py.read_text())
        self.assertIn("helper", utils_py.read_text())


def run_tests():
    """Run all tests"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestFileChange))
    suite.addTests(loader.loadTestsFromTestCase(TestChangeSet))
    suite.addTests(loader.loadTestsFromTestCase(TestBundleProcessor))
    suite.addTests(loader.loadTestsFromTestCase(TestProjectAnalyzer))
    suite.addTests(loader.loadTestsFromTestCase(TestSession))
    suite.addTests(loader.loadTestsFromTestCase(TestSessionManager))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == "__main__":
    # Try to import git for session tests
    try:
        import git
        GIT_AVAILABLE = True
    except ImportError:
        GIT_AVAILABLE = False
        print("Warning: GitPython not available, some tests will be skipped")
    
    success = run_tests()
    sys.exit(0 if success else 1)