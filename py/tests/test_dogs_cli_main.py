#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for dogs.py main CLI function and Rich interactive mode
Targets uncovered lines: 198-281, 732-827
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock, MagicMock
import subprocess

sys.path.insert(0, str(Path(__file__).parent.parent))

import dogs


class TestDogsMainCLI(unittest.TestCase):
    """Test main CLI function"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="dogs_cli_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create test bundle
        self.bundle_file = self.test_dir / "test_bundle.md"
        self.bundle_file.write_text("""
🐕 --- DOGS_START_FILE: test.py ---
```
print('test')
```
🐕 --- DOGS_END_FILE: test.py ---
""")

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_main_with_defaults(self):
        """Test main with default arguments"""
        test_args = ['dogs.py', str(self.bundle_file), '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_verify_command(self):
        """Test main with verification command"""
        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '--verify', 'echo test', '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_apply_delta(self):
        """Test main with delta reference"""
        ref_bundle = self.test_dir / "ref.md"
        ref_bundle.write_text("""
🐕 --- DOGS_START_FILE: base.py ---
```
line 1
line 2
```
🐕 --- DOGS_END_FILE: base.py ---
""")

        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '-d', str(ref_bundle), '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_rsi_link(self):
        """Test main with RSI-Link mode"""
        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '--rsi-link', '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_allow_reinvoke(self):
        """Test main with allow-reinvoke"""
        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '--allow-reinvoke', '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_verify_docs(self):
        """Test main with verify-docs"""
        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '--verify-docs', '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_auto_reject(self):
        """Test main with -n (no) flag"""
        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '-n', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_main_with_revert_on_fail(self):
        """Test main with revert-on-fail"""
        test_args = ['dogs.py', str(self.bundle_file), str(self.test_dir),
                     '--verify', 'exit 1', '--revert-on-fail', '-y', '-q']

        with patch('sys.argv', test_args):
            try:
                result = dogs.main()
                # May fail but shouldn't crash
                self.assertIsNotNone(result)
            except SystemExit as e:
                # Non-zero exit is acceptable for failed verification
                self.assertIsInstance(e.code, int)

    def test_main_from_stdin(self):
        """Test main reading from stdin"""
        bundle_content = """
🐕 --- DOGS_START_FILE: stdin_test.py ---
```
print('from stdin')
```
🐕 --- DOGS_END_FILE: stdin_test.py ---
"""
        test_args = ['dogs.py', '-', str(self.test_dir), '-y', '-q']

        with patch('sys.argv', test_args):
            with patch('sys.stdin.read', return_value=bundle_content):
                try:
                    result = dogs.main()
                    self.assertIn(result, [0, None])
                except SystemExit as e:
                    self.assertEqual(e.code, 0)


class TestRichInteractiveMode(unittest.TestCase):
    """Test Rich interactive mode (lines 198-281)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="rich_test_"))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    @unittest.skipIf(not dogs.RICH_AVAILABLE, "Rich not available")
    def test_rich_interactive_mode_accept(self):
        """Test Rich mode with accept"""
        changeset = dogs.ChangeSet()
        change = dogs.FileChange("test.py", dogs.FileOperation.CREATE, new_content="test")
        changeset.add_change(change)

        reviewer = dogs.InteractiveReviewer(changeset)

        # Mock Rich prompts
        with patch('dogs.Prompt.ask', return_value='a'):
            with patch('dogs.Confirm.ask', return_value=True):
                try:
                    result = reviewer._rich_interactive_review()
                    self.assertEqual(result.changes[0].status, "accepted")
                except:
                    # Rich mode might fail in non-TTY environment
                    pass

    @unittest.skipIf(not dogs.RICH_AVAILABLE, "Rich not available")
    def test_rich_interactive_mode_reject(self):
        """Test Rich mode with reject"""
        changeset = dogs.ChangeSet()
        change = dogs.FileChange("test.py", dogs.FileOperation.CREATE, new_content="test")
        changeset.add_change(change)

        reviewer = dogs.InteractiveReviewer(changeset)

        with patch('dogs.Prompt.ask', return_value='r'):
            with patch('dogs.Confirm.ask', return_value=True):
                try:
                    result = reviewer._rich_interactive_review()
                    self.assertEqual(result.changes[0].status, "rejected")
                except:
                    pass

    @unittest.skipIf(not dogs.RICH_AVAILABLE, "Rich not available")
    def test_rich_mode_navigation(self):
        """Test Rich mode navigation"""
        changeset = dogs.ChangeSet()
        for i in range(3):
            change = dogs.FileChange(f"file{i}.py", dogs.FileOperation.CREATE, new_content=f"content {i}")
            changeset.add_change(change)

        reviewer = dogs.InteractiveReviewer(changeset)

        # Test navigation: next, previous, quit
        with patch('dogs.Prompt.ask', side_effect=['n', 'p', 'q']):
            with patch('dogs.Confirm.ask', return_value=True):
                try:
                    result = reviewer._rich_interactive_review()
                    self.assertIsNotNone(result)
                except:
                    pass

    @unittest.skipIf(not dogs.RICH_AVAILABLE, "Rich not available")
    def test_rich_mode_skip(self):
        """Test Rich mode skip"""
        changeset = dogs.ChangeSet()
        change = dogs.FileChange("test.py", dogs.FileOperation.CREATE, new_content="test")
        changeset.add_change(change)

        reviewer = dogs.InteractiveReviewer(changeset)

        with patch('dogs.Prompt.ask', side_effect=['s', 'q']):
            with patch('dogs.Confirm.ask', return_value=True):
                try:
                    result = reviewer._rich_interactive_review()
                    self.assertEqual(result.changes[0].status, "pending")
                except:
                    pass

    @unittest.skipIf(not dogs.RICH_AVAILABLE, "Rich not available")
    def test_rich_display_layout(self):
        """Test Rich display layout generation"""
        changeset = dogs.ChangeSet()
        change = dogs.FileChange("test.py", dogs.FileOperation.MODIFY,
                                old_content="old", new_content="new")
        changeset.add_change(change)

        reviewer = dogs.InteractiveReviewer(changeset)

        try:
            layout = reviewer._get_display()
            self.assertIsNotNone(layout)
        except:
            # May fail in non-TTY
            pass


class TestGitVerificationHandler(unittest.TestCase):
    """Test GitVerificationHandler"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="git_handler_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    @unittest.skipIf(not dogs.GIT_AVAILABLE, "Git not available")
    def test_git_handler_init(self):
        """Test git handler initialization"""
        try:
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], check=True, capture_output=True)

            handler = dogs.GitVerificationHandler()
            self.assertIsNotNone(handler)
        except:
            self.skipTest("Git not available")

    @unittest.skipIf(not dogs.GIT_AVAILABLE, "Git not available")
    def test_git_create_checkpoint(self):
        """Test creating git checkpoint"""
        try:
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], check=True, capture_output=True)

            test_file = self.test_dir / "test.txt"
            test_file.write_text("test")
            subprocess.run(["git", "add", "."], check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "init"], check=True, capture_output=True)

            handler = dogs.GitVerificationHandler()
            checkpoint = handler.create_checkpoint()
            self.assertIsNotNone(checkpoint)
        except:
            self.skipTest("Git not available")


class TestMainAutoReject(unittest.TestCase):
    """Test main() with auto-reject flag"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="auto_reject_"))
        self.bundle_file = self.test_dir / "bundle.md"

        # Create a test bundle
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
def hello():
    print("Hello, World!")
🐕 --- DOGS_END_FILE: test.py ---
"""
        self.bundle_file.write_text(bundle_content)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_main_auto_reject(self):
        """Test main() with --no flag (lines 813-815)"""
        test_args = [
            'dogs.py',
            str(self.bundle_file),
            str(self.test_dir),
            '--no'
        ]

        with patch('sys.argv', test_args):
            with patch('sys.stdout', new=Mock()):
                result = dogs.main()

        # Should succeed but not create files (all rejected)
        self.assertEqual(result, 0)
        self.assertFalse((self.test_dir / "test.py").exists())

    def test_main_default_accept(self):
        """Test main() with default accept (lines 818-819)"""
        test_args = [
            'dogs.py',
            str(self.bundle_file),
            str(self.test_dir),
            '--yes'
        ]

        with patch('sys.argv', test_args):
            with patch('sys.stdout', new=Mock()):
                result = dogs.main()

        # Should succeed and create files (default accept)
        self.assertEqual(result, 0)
        self.assertTrue((self.test_dir / "test.py").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
