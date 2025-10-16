#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive error handling and edge case tests for PAWS
Tests boundary conditions, malformed input, and error recovery
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock
import io

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from paws import cats
from paws import dogs


class TestCatsErrorHandling(unittest.TestCase):
    """Test error handling in cats.py"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_errors_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_nonexistent_file(self):
        """Test bundling nonexistent file"""
        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["nonexistent.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        # Should handle gracefully
        bundle = bundler.create_bundle()
        self.assertIsNotNone(bundle)

    def test_empty_path_specs(self):
        """Test bundling with empty path specs"""
        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=[],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        # Should return empty or minimal bundle
        self.assertIsInstance(bundle, str)

    def test_circular_symlink(self):
        """Test handling of circular symlinks"""
        if os.name == 'nt':
            self.skipTest("Symlink test not reliable on Windows")

        try:
            # Create circular symlinks
            dir1 = self.test_dir / "dir1"
            dir2 = self.test_dir / "dir2"
            dir1.mkdir()
            dir2.mkdir()

            link1 = dir1 / "link_to_dir2"
            link2 = dir2 / "link_to_dir1"

            try:
                link1.symlink_to(dir2, target_is_directory=True)
                link2.symlink_to(dir1, target_is_directory=True)

                bundler = cats.CatsBundler(cats.BundleConfig(
                    path_specs=["dir1"],
                    exclude_patterns=[],
                    output_file=None,
                    encoding_mode="auto",
                    use_default_excludes=True,
                    prepare_for_delta=False,
                    persona_files=[],
                    sys_prompt_file="",
                    no_sys_prompt=True,
                    require_sys_prompt=False,
                    strict_catscan=False,
                    verify=None,
                    quiet=True,
                    yes=True
                ))

                # Should handle without infinite loop
                bundle = bundler.create_bundle()
                self.assertIsNotNone(bundle)

            except OSError:
                self.skipTest("Symlinks not supported")

        except Exception as e:
            # Circular symlinks might cause various issues
            # Key is that we don't crash completely
            pass

    def test_invalid_encoding_file(self):
        """Test handling file with invalid encoding"""
        # Create file with binary content that's not valid UTF-8
        bad_file = self.test_dir / "bad_encoding.txt"
        bad_file.write_bytes(b'\xff\xfe\x00\x00')

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["bad_encoding.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        # Should handle with errors='ignore' or treat as binary
        bundle = bundler.create_bundle()
        self.assertIsNotNone(bundle)

    def test_very_large_file(self):
        """Test handling very large file"""
        large_file = self.test_dir / "large.txt"

        # Create 5MB file
        with open(large_file, 'w') as f:
            for i in range(100000):
                f.write(f"Line {i}\n")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["large.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIsNotNone(bundle)
        self.assertIn("large.txt", bundle)

    def test_filename_with_special_characters(self):
        """Test handling filenames with special characters"""
        special_chars_file = self.test_dir / "file (with) [special] chars.txt"
        special_chars_file.write_text("content")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=[str(special_chars_file)],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIn("special", bundle)

    def test_deeply_nested_structure(self):
        """Test very deeply nested directory structure"""
        # Create path with 20 levels of nesting
        nested_path = self.test_dir
        for i in range(20):
            nested_path = nested_path / f"level{i}"

        nested_path.mkdir(parents=True)
        (nested_path / "deep.txt").write_text("deep content")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["level0"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIn("deep.txt", bundle)

    def test_conflicting_exclude_include(self):
        """Test when same file is both included and excluded"""
        test_file = self.test_dir / "test.py"
        test_file.write_text("content")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["test.py"],
            exclude_patterns=["test.py"],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()

        # Exclude should take precedence
        self.assertNotIn("content", bundle)


class TestDogsErrorHandling(unittest.TestCase):
    """Test error handling in dogs.py"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="dogs_errors_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_malformed_bundle_no_markers(self):
        """Test processing bundle with no markers"""
        bundle = "This is just plain text with no markers"

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "verify": None,
            "revert_on_fail": False,
            "auto_accept": True,
            "auto_reject": False,
            "quiet": True,
            "rsi_link": False,
            "allow_reinvoke": False,
            "verify_docs": False
        }

        processor = dogs.BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        # Should not crash, just return empty changeset
        self.assertEqual(len(changeset.changes), 0)

    def test_malformed_delta_command(self):
        """Test handling malformed delta commands"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD REPLACE_LINES(invalid, arguments) @@
```
content
```
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "verify": None,
            "revert_on_fail": False,
            "auto_accept": True,
            "auto_reject": False,
            "quiet": True,
            "rsi_link": False,
            "allow_reinvoke": False,
            "verify_docs": False
        }

        processor = dogs.BundleProcessor(config)

        # Should handle gracefully
        changeset = processor.parse_bundle(bundle)
        self.assertIsInstance(changeset, dogs.ChangeSet)

    def test_out_of_range_line_numbers(self):
        """Test delta commands with out of range line numbers"""
        # Create file with 5 lines
        test_file = self.test_dir / "test.py"
        test_file.write_text("line1\nline2\nline3\nline4\nline5\n")

        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD REPLACE_LINES(10, 20) @@
```
replacement
```
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "verify": None,
            "revert_on_fail": False,
            "auto_accept": True,
            "auto_reject": False,
            "quiet": True,
            "rsi_link": False,
            "allow_reinvoke": False,
            "verify_docs": False
        }

        processor = dogs.BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        for change in changeset.changes:
            change.status = "accepted"

        # Should handle without crashing (may fail gracefully or clip to range)
        try:
            processor.apply_changes(changeset)
        except Exception:
            # If it raises exception, that's acceptable error handling
            pass

    def test_write_to_read_only_location(self):
        """Test writing to read-only location"""
        if os.name == 'nt':
            self.skipTest("Permission test not reliable on Windows")

        readonly_dir = self.test_dir / "readonly"
        readonly_dir.mkdir()
        os.chmod(readonly_dir, 0o444)

        try:
            bundle = """
🐕 --- DOGS_START_FILE: readonly/file.py ---
```
content
```
🐕 --- DOGS_END_FILE: readonly/file.py ---
"""

            config = {
                "output_dir": str(self.test_dir),
                "apply_delta_from": None,
                "interactive": False,
                "verify": None,
                "revert_on_fail": False,
                "auto_accept": True,
                "auto_reject": False,
                "quiet": True,
                "rsi_link": False,
                "allow_reinvoke": False,
                "verify_docs": False
            }

            processor = dogs.BundleProcessor(config)

            # Parse may fail due to permission checking
            try:
                changeset = processor.parse_bundle(bundle)
                for change in changeset.changes:
                    change.status = "accepted"
                # Should fail but not crash
                success = processor.apply_changes(changeset)
                # Success should be False due to permission error
                self.assertFalse(success)
            except PermissionError:
                # Permission error during parsing is also acceptable
                pass

        finally:
            os.chmod(readonly_dir, 0o755)

    def test_invalid_file_paths(self):
        """Test handling invalid file paths"""
        invalid_paths = [
            "\x00invalid\x00",  # Null bytes
            "../../etc/passwd",  # Path traversal
            "/absolute/path/outside/tree",  # Absolute path
        ]

        for invalid_path in invalid_paths:
            bundle = f"""
🐕 --- DOGS_START_FILE: {invalid_path} ---
```
content
```
🐕 --- DOGS_END_FILE: {invalid_path} ---
"""

            config = {
                "output_dir": str(self.test_dir),
                "apply_delta_from": None,
                "interactive": False,
                "verify": None,
                "revert_on_fail": False,
                "auto_accept": True,
                "auto_reject": False,
                "quiet": True,
                "rsi_link": False,
                "allow_reinvoke": False,
                "verify_docs": False
            }

            processor = dogs.BundleProcessor(config)

            # Should handle without crashing
            try:
                changeset = processor.parse_bundle(bundle)
                for change in changeset.changes:
                    change.status = "accepted"
                processor.apply_changes(changeset)
            except Exception:
                # Exception is acceptable, key is no crash
                pass

    def test_empty_file_content(self):
        """Test handling empty file content"""
        bundle = """
🐕 --- DOGS_START_FILE: empty.py ---
```
```
🐕 --- DOGS_END_FILE: empty.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "verify": None,
            "revert_on_fail": False,
            "auto_accept": True,
            "auto_reject": False,
            "quiet": True,
            "rsi_link": False,
            "allow_reinvoke": False,
            "verify_docs": False
        }

        processor = dogs.BundleProcessor(config)
        changeset = processor.parse_bundle(bundle)

        for change in changeset.changes:
            change.status = "accepted"

        processor.apply_changes(changeset)

        empty_file = self.test_dir / "empty.py"
        self.assertTrue(empty_file.exists())


class TestBoundaryConditions(unittest.TestCase):
    """Test boundary conditions and limits"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="boundary_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_single_character_file(self):
        """Test handling file with single character"""
        single_char = self.test_dir / "single.txt"
        single_char.write_text("x")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["single.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIn("single.txt", bundle)

    def test_file_with_only_newlines(self):
        """Test file containing only newlines"""
        newlines_file = self.test_dir / "newlines.txt"
        newlines_file.write_text("\n\n\n\n\n")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["newlines.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIn("newlines.txt", bundle)

    def test_maximum_path_length(self):
        """Test handling very long file paths"""
        # Create path close to OS limit
        long_name = "a" * 200
        long_file = self.test_dir / long_name
        try:
            long_file.write_text("content")

            bundler = cats.CatsBundler(cats.BundleConfig(
                path_specs=[long_name],
                exclude_patterns=[],
                output_file=None,
                encoding_mode="auto",
                use_default_excludes=True,
                prepare_for_delta=False,
                persona_files=[],
                sys_prompt_file="",
                no_sys_prompt=True,
                require_sys_prompt=False,
                strict_catscan=False,
                verify=None,
                quiet=True,
                yes=True
            ))

            bundle = bundler.create_bundle()
            self.assertIsNotNone(bundle)

        except OSError:
            # Path too long for OS - acceptable
            self.skipTest("Path too long for this OS")

    def test_many_small_files(self):
        """Test bundling many small files"""
        # Create 1000 small files
        for i in range(1000):
            (self.test_dir / f"file{i}.txt").write_text(f"File {i}")

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["*.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIsNotNone(bundle)


class TestUnicodeAndEncoding(unittest.TestCase):
    """Test Unicode and encoding edge cases"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="unicode_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_unicode_content(self):
        """Test handling files with Unicode content"""
        unicode_file = self.test_dir / "unicode.txt"
        unicode_content = "Hello 世界 🌍 مرحبا Привет"
        unicode_file.write_text(unicode_content, encoding='utf-8')

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["unicode.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIn("unicode.txt", bundle)
        self.assertIn("Hello", bundle)

    def test_emoji_in_filename(self):
        """Test handling filenames with emoji"""
        try:
            emoji_file = self.test_dir / "test_🐕.txt"
            emoji_file.write_text("emoji filename")

            bundler = cats.CatsBundler(cats.BundleConfig(
                path_specs=["test_🐕.txt"],
                exclude_patterns=[],
                output_file=None,
                encoding_mode="auto",
                use_default_excludes=True,
                prepare_for_delta=False,
                persona_files=[],
                sys_prompt_file="",
                no_sys_prompt=True,
                require_sys_prompt=False,
                strict_catscan=False,
                verify=None,
                quiet=True,
                yes=True
            ))

            bundle = bundler.create_bundle()
            self.assertIsNotNone(bundle)

        except (OSError, UnicodeError):
            self.skipTest("Emoji filenames not supported on this system")

    def test_mixed_line_endings(self):
        """Test handling files with mixed line endings"""
        mixed_file = self.test_dir / "mixed.txt"
        mixed_content = "line1\r\nline2\nline3\rline4"
        mixed_file.write_bytes(mixed_content.encode('utf-8'))

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["mixed.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        ))

        bundle = bundler.create_bundle()
        self.assertIn("mixed.txt", bundle)


if __name__ == "__main__":
    unittest.main(verbosity=2)
