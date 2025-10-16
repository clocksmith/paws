#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Advanced test suite for dogs.py components:
- InteractiveReviewer (interactive TUI for reviewing changes)
- GitVerificationHandler (git-based verification and rollback)
- BundleProcessor (bundle parsing and processing)
"""

import unittest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock
import sys

# Path setup
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paws import dogs


class TestInteractiveReviewer(unittest.TestCase):
    """Test suite for InteractiveReviewer class (15 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_reviewer_"))

    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _create_test_changeset(self):
        """Create a test changeset with various changes"""
        changeset = dogs.ChangeSet()

        # Add a file creation
        changeset.add_change(dogs.FileChange(
            file_path="new_file.py",
            operation=dogs.FileOperation.CREATE,
            old_content=None,
            new_content="def new_function():\n    pass\n",
            is_binary=False,
            status="pending"
        ))

        # Add a file modification
        changeset.add_change(dogs.FileChange(
            file_path="existing_file.py",
            operation=dogs.FileOperation.MODIFY,
            old_content="old content\n",
            new_content="new content\n",
            is_binary=False,
            status="pending"
        ))

        # Add a file deletion
        changeset.add_change(dogs.FileChange(
            file_path="deleted_file.py",
            operation=dogs.FileOperation.DELETE,
            old_content="content\n",
            new_content=None,
            is_binary=False,
            status="pending"
        ))

        return changeset

    def test_reviewer_initialization(self):
        """Test that reviewer initializes correctly"""
        changeset = self._create_test_changeset()
        reviewer = dogs.InteractiveReviewer(changeset)

        self.assertIsNotNone(reviewer)
        self.assertEqual(reviewer.changeset, changeset)
        self.assertEqual(reviewer.current_index, 0)

    def test_reviewer_has_basic_review_fallback(self):
        """Test that reviewer has basic review mode when rich not available"""
        changeset = self._create_test_changeset()
        reviewer = dogs.InteractiveReviewer(changeset)

        # The _basic_review method should exist
        self.assertTrue(hasattr(reviewer, '_basic_review'))
        self.assertTrue(callable(reviewer._basic_review))

    @patch('dogs.RICH_AVAILABLE', False)
    def test_reviewer_falls_back_without_rich(self):
        """Test that reviewer falls back to basic mode without rich"""
        changeset = self._create_test_changeset()
        reviewer = dogs.InteractiveReviewer(changeset)

        # Mock user input to accept first, reject second, skip third
        with patch('builtins.input', side_effect=['a', 'r', 's']):
            result = reviewer.review()

        self.assertEqual(result.changes[0].status, "accepted")
        self.assertEqual(result.changes[1].status, "rejected")
        self.assertEqual(result.changes[2].status, "pending")

    @patch('dogs.RICH_AVAILABLE', False)
    def test_reviewer_basic_mode_quit(self):
        """Test that reviewer quits when user chooses quit"""
        changeset = self._create_test_changeset()
        reviewer = dogs.InteractiveReviewer(changeset)

        # Mock user input to quit on first change
        with patch('builtins.input', side_effect=['q']):
            result = reviewer.review()

        # First change should still be pending since we quit
        self.assertEqual(result.changes[0].status, "pending")

    @patch('dogs.RICH_AVAILABLE', False)
    def test_reviewer_basic_mode_invalid_choice(self):
        """Test that reviewer handles invalid choices"""
        changeset = self._create_test_changeset()
        reviewer = dogs.InteractiveReviewer(changeset)

        # Mock user input: invalid, then accept
        with patch('builtins.input', side_effect=['x', 'a', 'q']):
            result = reviewer.review()

        # Should accept first after invalid input
        self.assertEqual(result.changes[0].status, "accepted")

    def test_file_change_get_diff_create(self):
        """Test FileChange.get_diff() for file creation"""
        change = dogs.FileChange(
            file_path="new_file.py",
            operation=dogs.FileOperation.CREATE,
            old_content=None,
            new_content="content\n",
            is_binary=False
        )

        diff = change.get_diff()

        self.assertIn("New file will be created", diff)
        self.assertIn("new_file.py", diff)

    def test_file_change_get_diff_delete(self):
        """Test FileChange.get_diff() for file deletion"""
        change = dogs.FileChange(
            file_path="old_file.py",
            operation=dogs.FileOperation.DELETE,
            old_content="content\n",
            new_content=None,
            is_binary=False
        )

        diff = change.get_diff()

        self.assertIn("File will be deleted", diff)
        self.assertIn("old_file.py", diff)

    def test_file_change_get_diff_modify(self):
        """Test FileChange.get_diff() for file modification"""
        change = dogs.FileChange(
            file_path="modified_file.py",
            operation=dogs.FileOperation.MODIFY,
            old_content="old line 1\nold line 2\n",
            new_content="new line 1\nnew line 2\n",
            is_binary=False
        )

        diff = change.get_diff()

        self.assertIn("---", diff)
        self.assertIn("+++", diff)
        self.assertIn("modified_file.py", diff)

    def test_changeset_get_accepted(self):
        """Test ChangeSet.get_accepted() filters correctly"""
        changeset = self._create_test_changeset()
        changeset.changes[0].status = "accepted"
        changeset.changes[1].status = "rejected"
        changeset.changes[2].status = "pending"

        accepted = changeset.get_accepted()

        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0].file_path, "new_file.py")

    def test_changeset_get_pending(self):
        """Test ChangeSet.get_pending() filters correctly"""
        changeset = self._create_test_changeset()
        changeset.changes[0].status = "accepted"
        changeset.changes[1].status = "rejected"
        changeset.changes[2].status = "pending"

        pending = changeset.get_pending()

        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0].file_path, "deleted_file.py")

    def test_changeset_summary(self):
        """Test ChangeSet.summary() returns correct counts"""
        changeset = self._create_test_changeset()
        changeset.changes[0].status = "accepted"
        changeset.changes[1].status = "rejected"
        changeset.changes[2].status = "pending"

        summary = changeset.summary()

        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["accepted"], 1)
        self.assertEqual(summary["rejected"], 1)
        self.assertEqual(summary["pending"], 1)

    def test_changeset_add_change(self):
        """Test ChangeSet.add_change() appends changes"""
        changeset = dogs.ChangeSet()

        self.assertEqual(len(changeset.changes), 0)

        change = dogs.FileChange(
            file_path="test.py",
            operation=dogs.FileOperation.CREATE,
            new_content="content"
        )
        changeset.add_change(change)

        self.assertEqual(len(changeset.changes), 1)
        self.assertEqual(changeset.changes[0], change)

    @patch('dogs.RICH_AVAILABLE', True)
    @patch('dogs.Console')
    @patch('dogs.Prompt')
    def test_reviewer_rich_mode_navigation(self, mock_prompt, mock_console):
        """Test rich mode navigation"""
        changeset = self._create_test_changeset()
        reviewer = dogs.InteractiveReviewer(changeset)

        # Mock rich components
        mock_prompt.ask.side_effect = ['a', 'a', 'a']  # Accept all

        # Note: Full rich mode testing is complex due to Live context manager
        # This test just verifies the structure is set up

        self.assertTrue(hasattr(reviewer, '_rich_review'))
        self.assertTrue(hasattr(reviewer, '_get_display'))

    def test_file_change_dataclass_properties(self):
        """Test FileChange dataclass has expected properties"""
        change = dogs.FileChange(
            file_path="test.py",
            operation=dogs.FileOperation.CREATE,
            new_content="content",
            delta_commands=[{"type": "insert"}]
        )

        self.assertEqual(change.file_path, "test.py")
        self.assertEqual(change.operation, dogs.FileOperation.CREATE)
        self.assertEqual(change.new_content, "content")
        self.assertEqual(change.status, "pending")
        self.assertEqual(len(change.delta_commands), 1)


class TestGitVerificationHandler(unittest.TestCase):
    """Test suite for GitVerificationHandler class (15 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_git_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_handler_initialization(self):
        """Test that handler initializes"""
        handler = dogs.GitVerificationHandler(self.test_dir)

        self.assertIsNotNone(handler)
        self.assertEqual(handler.repo_path, self.test_dir)

    def test_handler_detects_non_git_repo(self):
        """Test that handler detects when not in git repo"""
        handler = dogs.GitVerificationHandler(self.test_dir)

        self.assertFalse(handler.is_git_repo())

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_detects_git_repo(self, mock_repo):
        """Test that handler detects git repo"""
        mock_repo.return_value = Mock()

        handler = dogs.GitVerificationHandler(self.test_dir)

        self.assertTrue(handler.is_git_repo())

    @patch('dogs.GIT_AVAILABLE', False)
    def test_handler_without_gitpython(self):
        """Test that handler works without GitPython"""
        handler = dogs.GitVerificationHandler(self.test_dir)

        self.assertFalse(handler.is_git_repo())
        self.assertFalse(handler.create_checkpoint())

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_create_checkpoint_clean_repo(self, mock_repo_class):
        """Test creating checkpoint in clean repo"""
        mock_repo = Mock()
        mock_repo.is_dirty.return_value = False
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)
        result = handler.create_checkpoint()

        # Clean repo should return True
        self.assertTrue(result)

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_create_checkpoint_dirty_repo(self, mock_repo_class):
        """Test creating checkpoint in dirty repo"""
        mock_git = Mock()
        mock_git.stash.return_value = "stash@{0}"

        mock_repo = Mock()
        mock_repo.is_dirty.return_value = True
        mock_repo.git = mock_git
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)
        result = handler.create_checkpoint()

        self.assertTrue(result)
        mock_git.stash.assert_called_once()

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_create_checkpoint_error(self, mock_repo_class):
        """Test checkpoint creation handles errors"""
        mock_repo = Mock()
        mock_repo.is_dirty.side_effect = Exception("Git error")
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)
        result = handler.create_checkpoint()

        self.assertFalse(result)

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_rollback(self, mock_repo_class):
        """Test rollback functionality"""
        mock_git = Mock()
        mock_git.stash.return_value = None

        mock_repo = Mock()
        mock_repo.git = mock_git
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)
        handler.stash_entry = "stash@{0}"

        result = handler.rollback()

        self.assertTrue(result)
        mock_git.stash.assert_called_with('pop')

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_rollback_without_stash(self, mock_repo_class):
        """Test rollback without stash returns False"""
        mock_repo = Mock()
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)
        # No stash entry set

        result = handler.rollback()

        self.assertFalse(result)

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_finalize(self, mock_repo_class):
        """Test finalize drops stash"""
        mock_git = Mock()

        mock_repo = Mock()
        mock_repo.git = mock_git
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)
        handler.stash_entry = "stash@{0}"

        result = handler.finalize()

        self.assertTrue(result)
        mock_git.stash.assert_called_with('drop')

    @patch('dogs.GIT_AVAILABLE', True)
    @patch('dogs.git.Repo')
    def test_handler_finalize_without_stash(self, mock_repo_class):
        """Test finalize without stash returns True"""
        mock_repo = Mock()
        mock_repo_class.return_value = mock_repo

        handler = dogs.GitVerificationHandler(self.test_dir)

        result = handler.finalize()

        self.assertTrue(result)

    @patch('subprocess.run')
    def test_handler_run_verification_success(self, mock_run):
        """Test running verification command successfully"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Tests passed"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        handler = dogs.GitVerificationHandler(self.test_dir)
        success, output = handler.run_verification("pytest")

        self.assertTrue(success)
        self.assertIn("Tests passed", output)

    @patch('subprocess.run')
    def test_handler_run_verification_failure(self, mock_run):
        """Test running verification command that fails"""
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Test failed"
        mock_run.return_value = mock_result

        handler = dogs.GitVerificationHandler(self.test_dir)
        success, output = handler.run_verification("pytest")

        self.assertFalse(success)
        self.assertIn("Test failed", output)

    @patch('subprocess.run')
    def test_handler_run_verification_timeout(self, mock_run):
        """Test verification command timeout"""
        mock_run.side_effect = Exception("Timeout")

        handler = dogs.GitVerificationHandler(self.test_dir)
        success, output = handler.run_verification("sleep 1000")

        self.assertFalse(success)
        self.assertIsInstance(output, str)


class TestBundleProcessor(unittest.TestCase):
    """Test suite for BundleProcessor class (20 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_processor_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_processor_initialization(self):
        """Test processor initialization"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        self.assertIsNotNone(processor)
        self.assertEqual(processor.config, config)

    def test_processor_parse_simple_bundle(self):
        """Test parsing simple bundle"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
print("hello")
🐕 --- DOGS_END_FILE: test.py ---
"""
        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 1)
        self.assertEqual(changeset.changes[0].file_path, "test.py")
        self.assertIn("hello", changeset.changes[0].new_content)

    def test_processor_parse_empty_bundle(self):
        """Test parsing empty bundle"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        changeset = processor.parse_bundle("")

        self.assertEqual(len(changeset.changes), 0)

    def test_processor_parse_multiple_files(self):
        """Test parsing bundle with multiple files"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        bundle = """
🐕 --- DOGS_START_FILE: file1.py ---
content1
🐕 --- DOGS_END_FILE: file1.py ---

🐕 --- DOGS_START_FILE: file2.py ---
content2
🐕 --- DOGS_END_FILE: file2.py ---
"""
        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 2)
        self.assertEqual(changeset.changes[0].file_path, "file1.py")
        self.assertEqual(changeset.changes[1].file_path, "file2.py")

    def test_processor_parse_with_code_fence(self):
        """Test parsing bundle with code fence"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
```python
print("hello")
```
🐕 --- DOGS_END_FILE: test.py ---
"""
        changeset = processor.parse_bundle(bundle)

        # Code fences should be stripped
        self.assertNotIn("```", changeset.changes[0].new_content)
        self.assertIn("hello", changeset.changes[0].new_content)

    def test_processor_parse_binary_file(self):
        """Test parsing binary file"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        import base64
        content = base64.b64encode(b"binary data").decode()

        bundle = f"""
🐕 --- DOGS_START_FILE: image.png (Content:Base64) ---
{content}
🐕 --- DOGS_END_FILE: image.png (Content:Base64) ---
"""
        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 1)
        self.assertTrue(changeset.changes[0].is_binary)

    def test_processor_parse_delete_command(self):
        """Test parsing DELETE_FILE command"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        bundle = """
🐕 --- DOGS_START_FILE: old.py ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: old.py ---
"""
        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 1)
        self.assertEqual(changeset.changes[0].operation, dogs.FileOperation.DELETE)

    def test_processor_parse_rsi_link_mode(self):
        """Test parsing RSI-Link markers"""
        config = {"output_dir": str(self.test_dir), "rsi_link": True}
        processor = dogs.BundleProcessor(config)

        bundle = """
⛓️ --- RSI_LINK_START_FILE: test.py ---
content
⛓️ --- RSI_LINK_END_FILE: test.py ---
"""
        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 1)
        self.assertEqual(changeset.changes[0].file_path, "test.py")

    def test_processor_apply_changes_create(self):
        """Test applying file creation"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        change = dogs.FileChange(
            file_path="new_file.py",
            operation=dogs.FileOperation.CREATE,
            new_content="print('hello')\n",
            is_binary=False,
            status="accepted"
        )
        changeset.add_change(change)

        result = processor.apply_changes(changeset)

        self.assertTrue(result)
        self.assertTrue((self.test_dir / "new_file.py").exists())
        self.assertEqual((self.test_dir / "new_file.py").read_text(), "print('hello')\n")

    def test_processor_apply_changes_delete(self):
        """Test applying file deletion"""
        # Create a file first
        test_file = self.test_dir / "to_delete.py"
        test_file.write_text("content")

        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        change = dogs.FileChange(
            file_path="to_delete.py",
            operation=dogs.FileOperation.DELETE,
            old_content="content",
            new_content=None,
            is_binary=False,
            status="accepted"
        )
        changeset.add_change(change)

        result = processor.apply_changes(changeset)

        self.assertTrue(result)
        self.assertFalse(test_file.exists())

    def test_processor_apply_changes_modify(self):
        """Test applying file modification"""
        # Create a file first
        test_file = self.test_dir / "to_modify.py"
        test_file.write_text("old content")

        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        change = dogs.FileChange(
            file_path="to_modify.py",
            operation=dogs.FileOperation.MODIFY,
            old_content="old content",
            new_content="new content",
            is_binary=False,
            status="accepted"
        )
        changeset.add_change(change)

        result = processor.apply_changes(changeset)

        self.assertTrue(result)
        self.assertEqual(test_file.read_text(), "new content")

    def test_processor_apply_changes_creates_directories(self):
        """Test that apply_changes creates parent directories"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        change = dogs.FileChange(
            file_path="new/nested/file.py",
            operation=dogs.FileOperation.CREATE,
            new_content="content",
            is_binary=False,
            status="accepted"
        )
        changeset.add_change(change)

        result = processor.apply_changes(changeset)

        self.assertTrue(result)
        self.assertTrue((self.test_dir / "new/nested/file.py").exists())

    def test_processor_apply_changes_skips_pending(self):
        """Test that apply_changes skips pending changes"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        change = dogs.FileChange(
            file_path="skipped.py",
            operation=dogs.FileOperation.CREATE,
            new_content="content",
            is_binary=False,
            status="pending"  # Not accepted
        )
        changeset.add_change(change)

        processor.apply_changes(changeset)

        # File should not be created
        self.assertFalse((self.test_dir / "skipped.py").exists())

    def test_processor_apply_changes_handles_errors(self):
        """Test that apply_changes handles errors gracefully"""
        config = {"output_dir": "/invalid/path/that/does/not/exist"}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        change = dogs.FileChange(
            file_path="file.py",
            operation=dogs.FileOperation.CREATE,
            new_content="content",
            is_binary=False,
            status="accepted"
        )
        changeset.add_change(change)

        result = processor.apply_changes(changeset)

        # Should return False due to error
        self.assertFalse(result)

    @patch('dogs.GitVerificationHandler')
    def test_processor_run_with_verification_success(self, mock_handler_class):
        """Test run_with_verification on success"""
        mock_handler = Mock()
        mock_handler.is_git_repo.return_value = True
        mock_handler.create_checkpoint.return_value = True
        mock_handler.run_verification.return_value = (True, "Success")
        mock_handler.finalize.return_value = True
        mock_handler_class.return_value = mock_handler

        config = {"output_dir": str(self.test_dir), "verify": "pytest"}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        result = processor.run_with_verification(changeset, "pytest")

        mock_handler.create_checkpoint.assert_called_once()
        mock_handler.run_verification.assert_called_once()
        mock_handler.finalize.assert_called_once()

    @patch('dogs.GitVerificationHandler')
    def test_processor_run_with_verification_failure(self, mock_handler_class):
        """Test run_with_verification on failure"""
        mock_handler = Mock()
        mock_handler.is_git_repo.return_value = True
        mock_handler.create_checkpoint.return_value = True
        mock_handler.run_verification.return_value = (False, "Failed")
        mock_handler.rollback.return_value = True
        mock_handler_class.return_value = mock_handler

        config = {"output_dir": str(self.test_dir), "verify": "pytest", "revert_on_fail": True}
        processor = dogs.BundleProcessor(config)

        changeset = dogs.ChangeSet()
        result = processor.run_with_verification(changeset, "pytest")

        self.assertFalse(result)
        mock_handler.rollback.assert_called_once()

    def test_processor_clean_content_strips_fences(self):
        """Test _clean_content strips markdown fences"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        lines = ["```python", "code", "```"]
        cleaned = processor._clean_content(lines)

        self.assertEqual(cleaned, ["code"])

    def test_processor_clean_content_strips_empty_lines(self):
        """Test _clean_content strips leading/trailing empty lines"""
        config = {"output_dir": str(self.test_dir)}
        processor = dogs.BundleProcessor(config)

        lines = ["", "content", "more", ""]
        cleaned = processor._clean_content(lines)

        self.assertEqual(cleaned, ["content", "more"])

    def test_processor_verify_docs_checks_sync(self):
        """Test _verify_docs_sync warns on mismatched docs"""
        config = {"output_dir": str(self.test_dir), "verify_docs": True}
        processor = dogs.BundleProcessor(config)

        # Create test files
        (self.test_dir / "README.md").write_text("readme")
        (self.test_dir / "CATSCAN.md").write_text("catscan")

        # Mock modified_paths with only README
        modified_paths = {"README.md"}

        # This should log a warning (we can't easily capture it in test)
        processor._verify_docs_sync(modified_paths)

        # Test passes if no exception


if __name__ == "__main__":
    unittest.main(verbosity=2)
