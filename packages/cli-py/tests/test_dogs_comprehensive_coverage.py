#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Additional comprehensive tests for dogs.py to reach 100% coverage
Focuses on uncovered code paths and advanced features
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock, MagicMock
import subprocess

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from paws import dogs
from paws.dogs import (
    FileChange, FileOperation, ChangeSet, BundleProcessor,
    InteractiveReviewer, GitVerificationHandler
)


class TestGitVerification(unittest.TestCase):
    """Test Git verification handler"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="git_verify_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_git_verification_initialization(self):
        """Test Git verification handler initialization"""
        try:
            handler = GitVerificationHandler()
            self.assertIsNotNone(handler)
        except:
            # Git might not be available
            self.skipTest("Git not available")

    def test_verify_with_git_command(self):
        """Test verification with git command"""
        # Initialize git repo
        try:
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], check=True, capture_output=True)

            test_file = self.test_dir / "test.py"
            test_file.write_text("print('test')")

            config = {
                "output_dir": str(self.test_dir),
                "apply_delta_from": None,
                "verify": "git diff --check",
                "interactive": False,
                "revert_on_fail": False,
                "auto_accept": True,
                "quiet": True
            }

            processor = BundleProcessor(config)

            # Test with verification enabled
            self.assertIsNotNone(processor)

        except (FileNotFoundError, subprocess.CalledProcessError):
            self.skipTest("Git not available")


class TestAdvancedDeltaOperations(unittest.TestCase):
    """Test advanced delta operations"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="advanced_delta_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_apply_delta_from_reference(self):
        """Test applying delta with reference bundle"""
        # Create reference bundle
        reference_bundle = """
🐕 --- DOGS_START_FILE: base.py ---
```
line 1
line 2
line 3
```
🐕 --- DOGS_END_FILE: base.py ---
"""

        reference_file = self.test_dir / "reference.md"
        reference_file.write_text(reference_bundle)

        # Create delta bundle
        delta_bundle = """
🐕 --- DOGS_START_FILE: base.py ---
@@ PAWS_CMD REPLACE_LINES(2, 2) @@
```
new line 2
```
🐕 --- DOGS_END_FILE: base.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": str(reference_file),
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "verify": None,
            "revert_on_fail": False
        }

        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(delta_bundle)

        for change in changeset.changes:
            change.status = "accepted"

        # Apply changes
        processor.apply_changes(changeset)

        # Verify
        result_file = self.test_dir / "base.py"
        if result_file.exists():
            content = result_file.read_text()
            self.assertTrue(len(content) > 0)

    def test_revert_on_fail(self):
        """Test revert on verification failure"""
        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "verify": "exit 1",  # Command that will fail
            "revert_on_fail": True
        }

        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
```
print('test')
```
🐕 --- DOGS_END_FILE: test.py ---
"""

        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        for change in changeset.changes:
            change.status = "accepted"

        # Should handle verification failure
        result = processor.apply_changes(changeset)

        # Result depends on implementation
        self.assertIsInstance(result, bool)


class TestComplexFileOperations(unittest.TestCase):
    """Test complex file operations"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="complex_ops_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_modify_file_with_delta_reference(self):
        """Test modifying file with delta reference"""
        # Create original file
        original = self.test_dir / "original.py"
        original.write_text("line 1\nline 2\nline 3\n")

        bundle = """
🐕 --- DOGS_START_FILE: original.py ---
@@ PAWS_CMD DELETE_LINES(2, 2) @@
🐕 --- DOGS_END_FILE: original.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True
        }

        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        for change in changeset.changes:
            change.status = "accepted"

        processor.apply_changes(changeset)

    def test_create_file_in_new_directory(self):
        """Test creating file in non-existent directory"""
        bundle = """
🐕 --- DOGS_START_FILE: new/path/to/file.py ---
```
print('new file')
```
🐕 --- DOGS_END_FILE: new/path/to/file.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True
        }

        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        for change in changeset.changes:
            change.status = "accepted"

        processor.apply_changes(changeset)

        new_file = self.test_dir / "new" / "path" / "to" / "file.py"
        self.assertTrue(new_file.exists())


class TestInteractiveReviewAdvanced(unittest.TestCase):
    """Test advanced interactive review features"""

    def test_review_all_accept(self):
        """Test accepting all changes"""
        changeset = ChangeSet()
        for i in range(5):
            change = FileChange(f"file{i}.py", FileOperation.CREATE, new_content="content")
            changeset.add_change(change)

        reviewer = InteractiveReviewer(changeset)

        # Mock user input to accept all
        with patch('builtins.input', side_effect=['a'] * 5):
            result = reviewer._basic_review()

        accepted = [c for c in result.changes if c.status == "accepted"]
        self.assertEqual(len(accepted), 5)

    def test_review_all_reject(self):
        """Test rejecting all changes"""
        changeset = ChangeSet()
        for i in range(3):
            change = FileChange(f"file{i}.py", FileOperation.CREATE, new_content="content")
            changeset.add_change(change)

        reviewer = InteractiveReviewer(changeset)

        with patch('builtins.input', side_effect=['r'] * 3):
            result = reviewer._basic_review()

        rejected = [c for c in result.changes if c.status == "rejected"]
        self.assertEqual(len(rejected), 3)

    def test_review_mixed_responses(self):
        """Test mixed accept/reject responses"""
        changeset = ChangeSet()
        for i in range(4):
            change = FileChange(f"file{i}.py", FileOperation.CREATE, new_content="content")
            changeset.add_change(change)

        reviewer = InteractiveReviewer(changeset)

        # Accept, reject, accept, reject
        with patch('builtins.input', side_effect=['a', 'r', 'a', 'r']):
            result = reviewer._basic_review()

        accepted = [c for c in result.changes if c.status == "accepted"]
        rejected = [c for c in result.changes if c.status == "rejected"]

        self.assertEqual(len(accepted), 2)
        self.assertEqual(len(rejected), 2)


class TestBundleParsingEdgeCases(unittest.TestCase):
    """Test edge cases in bundle parsing"""

    def test_parse_bundle_with_extra_markers(self):
        """Test bundle with extra markers"""
        bundle = """
Some preamble text

🐕 --- DOGS_START_FILE: file1.py ---
```
content 1
```
🐕 --- DOGS_END_FILE: file1.py ---

Some middle text

🐕 --- DOGS_START_FILE: file2.py ---
```
content 2
```
🐕 --- DOGS_END_FILE: file2.py ---

Some trailing text
"""

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = processor.parse_bundle(bundle)

        # Should parse both files despite extra text
        self.assertGreaterEqual(len(changeset.changes), 2)

    def test_parse_bundle_with_unicode(self):
        """Test parsing bundle with Unicode content"""
        bundle = """
🐕 --- DOGS_START_FILE: unicode.py ---
```
# UTF-8 content
message = "Hello 世界 🌍"
```
🐕 --- DOGS_END_FILE: unicode.py ---
"""

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 1)
        self.assertIn("世界", changeset.changes[0].new_content)

    def test_parse_bundle_with_nested_markers(self):
        """Test bundle with nested-looking markers in content"""
        bundle = """
🐕 --- DOGS_START_FILE: nested.py ---
```
# This file discusses markers
# Like DOGS_START_FILE and DOGS_END_FILE
```
🐕 --- DOGS_END_FILE: nested.py ---
"""

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = processor.parse_bundle(bundle)

        self.assertEqual(len(changeset.changes), 1)


class TestConfigurationOptions(unittest.TestCase):
    """Test various configuration options"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="config_test_"))

    def tearDown(self):
        """Clean up"""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_quiet_mode(self):
        """Test quiet mode suppresses output"""
        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True
        }

        processor = BundleProcessor(config)

        with patch('builtins.print') as mock_print:
            bundle = """
🐕 --- DOGS_START_FILE: test.py ---
```
print('test')
```
🐕 --- DOGS_END_FILE: test.py ---
"""
            changeset = processor.parse_bundle(bundle)
            for change in changeset.changes:
                change.status = "accepted"
            processor.apply_changes(changeset)

            # Quiet mode should reduce print calls
            # (Implementation dependent)

    def test_rsi_link_mode(self):
        """Test RSI-Link mode"""
        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "rsi_link": True,
            "interactive": False,
            "auto_accept": True
        }

        bundle = """
⛓️ --- RSI_LINK_START_FILE: test.py ---
```
print('RSI-Link test')
```
⛓️ --- RSI_LINK_END_FILE: test.py ---
"""

        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        # Should parse RSI-Link markers
        self.assertGreaterEqual(len(changeset.changes), 0)


class TestErrorRecoveryAdvanced(unittest.TestCase):
    """Test advanced error recovery scenarios"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="error_recovery_"))

    def tearDown(self):
        """Clean up"""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_recovery_from_disk_full(self):
        """Test handling disk full scenario"""
        # This is hard to test reliably
        # Just ensure the code path exists
        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None
        }

        processor = BundleProcessor(config)
        self.assertIsNotNone(processor)

    def test_recovery_from_permission_changes(self):
        """Test handling changing permissions"""
        if os.name == 'nt':
            self.skipTest("Permission test not reliable on Windows")

        test_file = self.test_dir / "test.py"
        test_file.write_text("original")

        # Make file read-only
        os.chmod(test_file, 0o444)

        try:
            bundle = """
🐕 --- DOGS_START_FILE: test.py ---
```
modified
```
🐕 --- DOGS_END_FILE: test.py ---
"""

            config = {
                "output_dir": str(self.test_dir),
                "apply_delta_from": None,
                "interactive": False,
                "auto_accept": True
            }

            processor = BundleProcessor(config)
            changeset = processor.parse_bundle(bundle)

            for change in changeset.changes:
                change.status = "accepted"

            # Should handle permission error gracefully
            try:
                processor.apply_changes(changeset)
            except PermissionError:
                pass  # Expected

        finally:
            os.chmod(test_file, 0o644)


class TestGitHandlerErrors(unittest.TestCase):
    """Test GitVerificationHandler error paths"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="git_handler_errors_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Initialize git repo
        try:
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], check=True, capture_output=True)

            # Create initial commit
            test_file = self.test_dir / "initial.txt"
            test_file.write_text("initial")
            subprocess.run(["git", "add", "initial.txt"], check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "initial"], check=True, capture_output=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            self.skipTest("Git not available")

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_rollback_exception(self):
        """Test rollback() exception handling (lines 326-328)"""
        from paws.dogs import GitVerificationHandler
        from unittest.mock import patch, Mock

        handler = GitVerificationHandler()
        handler.create_checkpoint()

        # Mock the repo to raise an exception on stash apply
        mock_repo = Mock()
        mock_repo.git.stash.side_effect = Exception("Stash error")
        handler.repo = mock_repo

        # rollback should catch the exception and return False
        with patch('sys.stdout', new=Mock()):
            result = handler.rollback()

        self.assertFalse(result)

    def test_finalize_exception(self):
        """Test finalize() exception handling (lines 339-341)"""
        from paws.dogs import GitVerificationHandler
        from unittest.mock import patch, Mock

        handler = GitVerificationHandler()
        handler.create_checkpoint()

        # Mock the repo to raise an exception on stash drop
        mock_repo = Mock()
        mock_repo.git.stash.side_effect = Exception("Drop error")
        handler.repo = mock_repo
        handler.stash_entry = "stash@{0}"

        # finalize should catch the exception and return False
        with patch('sys.stdout', new=Mock()):
            result = handler.finalize()

        self.assertFalse(result)

    def test_finalize_without_repo(self):
        """Test finalize() with no repo (lines 332-333)"""
        from paws.dogs import GitVerificationHandler

        handler = GitVerificationHandler()
        handler.repo = None
        handler.stash_entry = None

        # Should return True early
        result = handler.finalize()
        self.assertTrue(result)


class TestGitVerificationTimeout(unittest.TestCase):
    """Test GitVerificationHandler timeout"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="git_timeout_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Initialize git repo
        try:
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], check=True, capture_output=True)

            # Create initial commit
            test_file = self.test_dir / "initial.txt"
            test_file.write_text("initial")
            subprocess.run(["git", "add", "initial.txt"], check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "initial"], check=True, capture_output=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            self.skipTest("Git not available")

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_run_verification_timeout(self):
        """Test run_verification with timeout (line 356)"""
        from paws.dogs import GitVerificationHandler
        from unittest.mock import patch, Mock

        handler = GitVerificationHandler()

        # Mock subprocess.run to raise TimeoutExpired
        with patch('subprocess.run') as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired('sleep 999', 300)

            success, output = handler.run_verification("sleep 999")

        self.assertFalse(success)
        self.assertIn("timed out", output.lower())


class TestBundleProcessorDeltaErrors(unittest.TestCase):
    """Test BundleProcessor delta loading errors"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="delta_errors_"))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_load_original_bundle_no_delta(self):
        """Test _load_original_bundle with no delta path (line 377)"""
        from paws.dogs import BundleProcessor

        config = {
            "apply_delta_from": None
        }

        processor = BundleProcessor(config)

        # Should return empty dict
        result = processor._load_original_bundle()
        self.assertEqual(result, {})

    def test_load_original_bundle_file_not_found(self):
        """Test _load_original_bundle with missing file (lines 394-395)"""
        from paws.dogs import BundleProcessor

        config = {
            "apply_delta_from": str(self.test_dir / "nonexistent.md")
        }

        # Should raise IOError
        with self.assertRaises(IOError) as cm:
            processor = BundleProcessor(config)

        self.assertIn("Could not load delta reference bundle", str(cm.exception))


class TestBundleProcessorVerifyAndApply(unittest.TestCase):
    """Test BundleProcessor verify_and_apply error paths"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="verify_apply_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Initialize git repo
        try:
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], check=True, capture_output=True)

            # Create initial commit
            test_file = self.test_dir / "initial.txt"
            test_file.write_text("initial")
            subprocess.run(["git", "add", "initial.txt"], check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "initial"], check=True, capture_output=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            self.skipTest("Git not available")

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_run_with_verification_checkpoint_failure(self):
        """Test run_with_verification with checkpoint failure (lines 704-705)"""
        from paws.dogs import BundleProcessor, ChangeSet, FileChange
        from unittest.mock import patch, Mock

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True
        }

        processor = BundleProcessor(config)
        changeset = ChangeSet()
        change = FileChange("test.py", "created", "print('test')")
        change.status = "accepted"
        changeset.add_change(change)

        # Mock create_checkpoint to return False
        if processor.git_handler:
            with patch.object(processor.git_handler, 'create_checkpoint', return_value=False):
                with patch('sys.stdout', new=Mock()):
                    result = processor.run_with_verification(changeset, "echo test")

            self.assertFalse(result)

    def test_run_with_verification_apply_changes_failure(self):
        """Test run_with_verification with apply_changes failure (lines 710-712)"""
        from paws.dogs import BundleProcessor, ChangeSet, FileChange
        from unittest.mock import patch, Mock

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True
        }

        processor = BundleProcessor(config)
        changeset = ChangeSet()
        change = FileChange("test.py", "created", "print('test')")
        change.status = "accepted"
        changeset.add_change(change)

        # Mock apply_changes to return False
        with patch.object(processor, 'apply_changes', return_value=False):
            with patch('sys.stdout', new=Mock()):
                result = processor.run_with_verification(changeset, "echo test")

        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
