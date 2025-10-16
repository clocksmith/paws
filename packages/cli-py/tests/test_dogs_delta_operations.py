#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive test suite for DOGS delta operations (dogs.py)
Tests file extraction, delta commands, interactive review, and error handling
"""

import unittest
import os
import sys
import tempfile
import shutil
import base64
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock
import io

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from paws import dogs
from paws.dogs import (
    FileChange, FileOperation, ChangeSet, BundleProcessor,
    InteractiveReviewer, GitVerificationHandler
)


class TestFileChange(unittest.TestCase):
    """Test FileChange data class"""

    def test_create_file_change(self):
        """Test creating a file change"""
        change = FileChange(
            file_path="src/test.py",
            operation=FileOperation.CREATE,
            new_content="print('hello')"
        )
        self.assertEqual(change.file_path, "src/test.py")
        self.assertEqual(change.operation, FileOperation.CREATE)
        self.assertEqual(change.status, "pending")

    def test_file_change_modify_operation(self):
        """Test modify operation with diff generation"""
        change = FileChange(
            file_path="test.py",
            operation=FileOperation.MODIFY,
            old_content="old line 1\nold line 2\n",
            new_content="new line 1\nold line 2\n"
        )

        diff = change.get_diff()
        self.assertIn("test.py", diff)
        self.assertIn("-old line 1", diff)
        self.assertIn("+new line 1", diff)

    def test_file_change_delete_operation(self):
        """Test delete operation"""
        change = FileChange(
            file_path="test.py",
            operation=FileOperation.DELETE
        )

        diff = change.get_diff()
        self.assertIn("deleted", diff.lower())
        self.assertIn("test.py", diff)

    def test_file_change_with_binary_content(self):
        """Test binary file change"""
        change = FileChange(
            file_path="image.png",
            operation=FileOperation.CREATE,
            new_content=base64.b64encode(b'\x89PNG').decode(),
            is_binary=True
        )
        self.assertTrue(change.is_binary)


class TestChangeSet(unittest.TestCase):
    """Test ChangeSet collection"""

    def test_create_changeset(self):
        """Test creating empty changeset"""
        changeset = ChangeSet()
        self.assertEqual(len(changeset.changes), 0)

    def test_add_change_to_changeset(self):
        """Test adding changes to changeset"""
        changeset = ChangeSet()
        change1 = FileChange("file1.py", FileOperation.CREATE)
        change2 = FileChange("file2.py", FileOperation.MODIFY)

        changeset.add_change(change1)
        changeset.add_change(change2)

        self.assertEqual(len(changeset.changes), 2)

    def test_get_accepted_changes(self):
        """Test filtering accepted changes"""
        changeset = ChangeSet()
        change1 = FileChange("file1.py", FileOperation.CREATE)
        change1.status = "accepted"
        change2 = FileChange("file2.py", FileOperation.MODIFY)
        change2.status = "rejected"

        changeset.add_change(change1)
        changeset.add_change(change2)

        accepted = changeset.get_accepted()
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0].file_path, "file1.py")

    def test_get_pending_changes(self):
        """Test filtering pending changes"""
        changeset = ChangeSet()
        change1 = FileChange("file1.py", FileOperation.CREATE)
        change1.status = "pending"
        change2 = FileChange("file2.py", FileOperation.MODIFY)
        change2.status = "accepted"

        changeset.add_change(change1)
        changeset.add_change(change2)

        pending = changeset.get_pending()
        self.assertEqual(len(pending), 1)

    def test_changeset_summary(self):
        """Test changeset summary generation"""
        changeset = ChangeSet()

        for i in range(5):
            change = FileChange(f"file{i}.py", FileOperation.CREATE)
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


class TestBundleProcessorParsing(unittest.TestCase):
    """Test BundleProcessor parsing functionality"""

    def test_parse_simple_bundle(self):
        """Test parsing a simple DOGS bundle"""
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
```
print('hello world')
```
🐕 --- DOGS_END_FILE: test.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 1)
        change = changeset.changes[0]
        self.assertEqual(change.file_path, "test.py")
        self.assertIn("hello world", change.new_content)

    def test_parse_binary_file(self):
        """Test parsing binary file in bundle"""
        binary_data = base64.b64encode(b'\x89PNG\r\n\x1a\n').decode()
        bundle_content = f"""
🐕 --- DOGS_START_FILE: image.png (Content:Base64) ---
{binary_data}
🐕 --- DOGS_END_FILE: image.png (Content:Base64) ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 1)
        change = changeset.changes[0]
        self.assertTrue(change.is_binary)

    def test_parse_multiple_files(self):
        """Test parsing bundle with multiple files"""
        bundle_content = """
🐕 --- DOGS_START_FILE: file1.py ---
```
content 1
```
🐕 --- DOGS_END_FILE: file1.py ---

🐕 --- DOGS_START_FILE: file2.py ---
```
content 2
```
🐕 --- DOGS_END_FILE: file2.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 2)
        paths = [c.file_path for c in changeset.changes]
        self.assertIn("file1.py", paths)
        self.assertIn("file2.py", paths)

    def test_parse_empty_bundle(self):
        """Test parsing empty bundle"""
        bundle_content = "# Empty bundle\n\nNo files here."

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 0)


class TestBundleProcessorDeltaCommands(unittest.TestCase):
    """Test delta command parsing and application"""

    def test_parse_delete_file_command(self):
        """Test parsing DELETE_FILE command"""
        bundle_content = """
🐕 --- DOGS_START_FILE: old_file.py ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: old_file.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 1)
        change = changeset.changes[0]
        self.assertEqual(change.operation, FileOperation.DELETE)

    def test_parse_replace_lines_command(self):
        """Test parsing REPLACE_LINES command"""
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD REPLACE_LINES(1, 2) @@
```
new line 1
new line 2
```
🐕 --- DOGS_END_FILE: test.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        # Should have parsed the delta command
        self.assertEqual(len(changeset.changes), 1)
        change = changeset.changes[0]
        self.assertTrue(len(change.delta_commands) > 0)

    def test_parse_insert_after_line_command(self):
        """Test parsing INSERT_AFTER_LINE command"""
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD INSERT_AFTER_LINE(5) @@
```
inserted line
```
🐕 --- DOGS_END_FILE: test.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 1)

    def test_parse_delete_lines_command(self):
        """Test parsing DELETE_LINES command"""
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD DELETE_LINES(3, 5) @@
🐕 --- DOGS_END_FILE: test.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 1)

    def test_apply_replace_lines_delta(self):
        """Test applying REPLACE_LINES delta command"""
        original_lines = ["line 1", "line 2", "line 3", "line 4"]

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        commands = [{
            "type": "replace",
            "start": 2,
            "end": 3,
            "content_lines": ["new line 2", "new line 3"]
        }]

        result = processor._apply_delta_commands(original_lines, commands)
        result_lines = result.split('\n')

        self.assertIn("line 1", result_lines)
        self.assertIn("new line 2", result_lines)
        self.assertIn("new line 3", result_lines)
        self.assertIn("line 4", result_lines)

    def test_apply_insert_after_line_delta(self):
        """Test applying INSERT_AFTER_LINE delta command"""
        original_lines = ["line 1", "line 2", "line 3"]

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        commands = [{
            "type": "insert",
            "line_num": 1,
            "content_lines": ["inserted line"]
        }]

        result = processor._apply_delta_commands(original_lines, commands)
        result_lines = result.split('\n')

        self.assertEqual(result_lines[0], "line 1")
        self.assertEqual(result_lines[1], "inserted line")
        self.assertEqual(result_lines[2], "line 2")

    def test_apply_delete_lines_delta(self):
        """Test applying DELETE_LINES delta command"""
        original_lines = ["line 1", "line 2", "line 3", "line 4"]

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        commands = [{
            "type": "delete_lines",
            "start": 2,
            "end": 3
        }]

        result = processor._apply_delta_commands(original_lines, commands)
        result_lines = result.split('\n')

        self.assertIn("line 1", result_lines)
        self.assertNotIn("line 2", result_lines)
        self.assertNotIn("line 3", result_lines)
        self.assertIn("line 4", result_lines)

    def test_apply_multiple_delta_commands(self):
        """Test applying multiple delta commands in sequence"""
        original_lines = ["line 1", "line 2", "line 3", "line 4", "line 5"]

        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        commands = [
            {"type": "replace", "start": 1, "end": 2, "content_lines": ["replaced"]},
            {"type": "insert", "line_num": 3, "content_lines": ["inserted"]},
            {"type": "delete_lines", "start": 4, "end": 5}
        ]

        result = processor._apply_delta_commands(original_lines, commands)
        result_lines = result.split('\n')

        self.assertIn("replaced", result_lines)
        self.assertIn("inserted", result_lines)
        # line 4 and 5 should be deleted


class TestBundleProcessorApplication(unittest.TestCase):
    """Test applying changes to filesystem"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="dogs_test_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_apply_create_file(self):
        """Test applying CREATE operation"""
        config = {"output_dir": str(self.test_dir), "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = ChangeSet()
        change = FileChange(
            file_path="new_file.py",
            operation=FileOperation.CREATE,
            new_content="print('new file')"
        )
        change.status = "accepted"
        changeset.add_change(change)

        success = processor.apply_changes(changeset)
        self.assertTrue(success)

        created_file = self.test_dir / "new_file.py"
        self.assertTrue(created_file.exists())
        self.assertEqual(created_file.read_text(), "print('new file')")

    def test_apply_modify_file(self):
        """Test applying MODIFY operation"""
        # Create existing file
        test_file = self.test_dir / "existing.py"
        test_file.write_text("old content")

        config = {"output_dir": str(self.test_dir), "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = ChangeSet()
        change = FileChange(
            file_path="existing.py",
            operation=FileOperation.MODIFY,
            old_content="old content",
            new_content="new content"
        )
        change.status = "accepted"
        changeset.add_change(change)

        processor.apply_changes(changeset)

        self.assertEqual(test_file.read_text(), "new content")

    def test_apply_delete_file(self):
        """Test applying DELETE operation"""
        # Create file to delete
        test_file = self.test_dir / "to_delete.py"
        test_file.write_text("content")

        config = {"output_dir": str(self.test_dir), "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = ChangeSet()
        change = FileChange(
            file_path="to_delete.py",
            operation=FileOperation.DELETE
        )
        change.status = "accepted"
        changeset.add_change(change)

        processor.apply_changes(changeset)

        self.assertFalse(test_file.exists())

    def test_apply_creates_parent_directories(self):
        """Test that applying changes creates parent directories"""
        config = {"output_dir": str(self.test_dir), "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = ChangeSet()
        change = FileChange(
            file_path="deep/nested/path/file.py",
            operation=FileOperation.CREATE,
            new_content="content"
        )
        change.status = "accepted"
        changeset.add_change(change)

        processor.apply_changes(changeset)

        created_file = self.test_dir / "deep" / "nested" / "path" / "file.py"
        self.assertTrue(created_file.exists())

    def test_apply_skips_rejected_changes(self):
        """Test that rejected changes are not applied"""
        config = {"output_dir": str(self.test_dir), "apply_delta_from": None}
        processor = BundleProcessor(config)

        changeset = ChangeSet()
        change = FileChange(
            file_path="rejected.py",
            operation=FileOperation.CREATE,
            new_content="should not be created"
        )
        change.status = "rejected"
        changeset.add_change(change)

        processor.apply_changes(changeset)

        created_file = self.test_dir / "rejected.py"
        self.assertFalse(created_file.exists())


class TestInteractiveReviewer(unittest.TestCase):
    """Test interactive review functionality"""

    def test_reviewer_initialization(self):
        """Test creating interactive reviewer"""
        changeset = ChangeSet()
        reviewer = InteractiveReviewer(changeset)

        self.assertEqual(reviewer.current_index, 0)
        self.assertEqual(reviewer.changeset, changeset)

    def test_basic_review_accept(self):
        """Test basic review mode with accept"""
        changeset = ChangeSet()
        change = FileChange("test.py", FileOperation.CREATE, new_content="content")
        changeset.add_change(change)

        reviewer = InteractiveReviewer(changeset)

        # Mock user input to accept
        with patch('builtins.input', return_value='a'):
            result = reviewer._basic_review()

        self.assertEqual(result.changes[0].status, "accepted")

    def test_basic_review_reject(self):
        """Test basic review mode with reject"""
        changeset = ChangeSet()
        change = FileChange("test.py", FileOperation.CREATE, new_content="content")
        changeset.add_change(change)

        reviewer = InteractiveReviewer(changeset)

        with patch('builtins.input', return_value='r'):
            result = reviewer._basic_review()

        self.assertEqual(result.changes[0].status, "rejected")

    def test_basic_review_quit(self):
        """Test basic review mode with quit"""
        changeset = ChangeSet()
        for i in range(3):
            change = FileChange(f"test{i}.py", FileOperation.CREATE)
            changeset.add_change(change)

        reviewer = InteractiveReviewer(changeset)

        # Accept first, then quit
        with patch('builtins.input', side_effect=['a', 'q']):
            result = reviewer._basic_review()

        # First should be accepted, rest pending
        self.assertEqual(result.changes[0].status, "accepted")
        self.assertEqual(result.changes[1].status, "pending")


class TestRSILinkProtocol(unittest.TestCase):
    """Test RSI-Link protocol support"""

    def test_parse_rsi_link_markers(self):
        """Test parsing RSI-Link markers instead of DOGS markers"""
        bundle_content = """
⛓️ --- RSI_LINK_START_FILE: test.py ---
```
print('hello')
```
⛓️ --- RSI_LINK_END_FILE: test.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None, "rsi_link": True}
        processor = BundleProcessor(config)
        changeset = processor.parse_bundle(bundle_content)

        self.assertEqual(len(changeset.changes), 1)
        self.assertEqual(changeset.changes[0].file_path, "test.py")


class TestErrorHandling(unittest.TestCase):
    """Test error handling and edge cases"""

    def test_malformed_bundle_parsing(self):
        """Test parsing malformed bundle doesn't crash"""
        bundle_content = """
🐕 --- DOGS_START_FILE: incomplete.py ---
print('incomplete')
# No end marker
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        # Should not raise exception
        changeset = processor.parse_bundle(bundle_content)

        # May have 0 or 1 change depending on error recovery
        self.assertIsInstance(changeset, ChangeSet)

    def test_invalid_delta_command(self):
        """Test handling invalid delta command"""
        bundle_content = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD INVALID_COMMAND(1, 2) @@
🐕 --- DOGS_END_FILE: test.py ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        # Should parse without crashing
        changeset = processor.parse_bundle(bundle_content)
        self.assertIsInstance(changeset, ChangeSet)

    def test_binary_decode_error(self):
        """Test handling invalid base64 binary content"""
        bundle_content = """
🐕 --- DOGS_START_FILE: image.png (Content:Base64) ---
INVALID_BASE64_DATA!!!
🐕 --- DOGS_END_FILE: image.png (Content:Base64) ---
"""
        config = {"output_dir": ".", "apply_delta_from": None}
        processor = BundleProcessor(config)

        # Should handle decode error gracefully
        try:
            changeset = processor.parse_bundle(bundle_content)
            self.assertIsInstance(changeset, ChangeSet)
        except Exception as e:
            # Base64 decode error is expected - this is acceptable behavior
            self.assertIn("base64", str(e).lower())


class TestDocVerification(unittest.TestCase):
    """Test documentation verification features"""

    def test_verify_docs_sync_warning(self):
        """Test that modifying README without CATSCAN generates warning"""
        config = {"output_dir": ".", "apply_delta_from": None, "verify_docs": True}
        processor = BundleProcessor(config)

        changeset = ChangeSet()
        change = FileChange(
            file_path="README.md",
            operation=FileOperation.MODIFY,
            old_content="old",
            new_content="new"
        )
        change.status = "accepted"
        changeset.add_change(change)

        # Should generate warning output
        with patch('builtins.print') as mock_print:
            processor.apply_changes(changeset)
            # Check that warning was printed
            print_calls = [str(call) for call in mock_print.call_args_list]
            warning_found = any('Warning' in str(call) or 'CATSCAN' in str(call)
                              for call in print_calls)
            self.assertTrue(warning_found)


if __name__ == "__main__":
    unittest.main(verbosity=2)
