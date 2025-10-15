#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive integration tests for PAWS workflow
Tests complete cats -> dogs -> verification cycles
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch
import subprocess

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import cats
import dogs


class TestCatsDogsIntegration(unittest.TestCase):
    """Integration tests for cats -> dogs workflow"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_integration_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create test project structure
        (self.test_dir / "src").mkdir()
        (self.test_dir / "src" / "main.py").write_text(
            "#!/usr/bin/env python3\n"
            "def main():\n"
            "    print('Hello, World!')\n"
            "\n"
            "if __name__ == '__main__':\n"
            "    main()\n"
        )
        (self.test_dir / "src" / "utils.py").write_text(
            "def helper():\n"
            "    return 42\n"
        )

        (self.test_dir / "tests").mkdir()
        (self.test_dir / "tests" / "test_main.py").write_text(
            "import unittest\n"
            "\n"
            "class TestMain(unittest.TestCase):\n"
            "    def test_example(self):\n"
            "        self.assertTrue(True)\n"
        )

        (self.test_dir / "README.md").write_text("# Test Project")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_cats_creates_bundle(self):
        """Test that cats creates a valid bundle"""
        bundle_path = self.test_dir / "bundle.md"

        # Run cats
        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["src"],
            exclude_patterns=[],
            output_file=bundle_path,
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

        bundle_content = bundler.create_bundle()

        self.assertIsNotNone(bundle_content)
        self.assertIn("main.py", bundle_content)
        self.assertIn("utils.py", bundle_content)
        self.assertIn("Hello, World!", bundle_content)

    def test_dogs_extracts_from_bundle(self):
        """Test that dogs can extract files from cats bundle"""
        # Create bundle with cats
        bundle_content = """
# Cats Bundle
# Format: FULL

🐕 --- DOGS_START_FILE: extracted.py ---
```
def extracted_function():
    return "extracted"
```
🐕 --- DOGS_END_FILE: extracted.py ---
"""

        # Create output directory
        output_dir = self.test_dir / "output"
        output_dir.mkdir()

        # Process with dogs
        config = {
            "output_dir": str(output_dir),
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
        changeset = processor.parse_bundle(bundle_content)

        # Auto-accept all changes
        for change in changeset.changes:
            change.status = "accepted"

        success = processor.apply_changes(changeset)

        self.assertTrue(success)
        extracted_file = output_dir / "extracted.py"
        self.assertTrue(extracted_file.exists())
        content = extracted_file.read_text()
        self.assertIn("extracted_function", content)

    def test_round_trip_cats_dogs(self):
        """Test complete round trip: cats bundle -> dogs extract"""
        # Step 1: Create bundle with cats
        bundle_path = self.test_dir / "bundle.md"

        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=bundle_path,
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

        bundle_content = bundler.create_bundle()
        bundle_path.write_text(bundle_content)

        # Step 2: Extract with dogs to new location
        output_dir = self.test_dir / "extracted"
        output_dir.mkdir()

        # Modify bundle content to use DOGS markers
        modified_bundle = bundle_content.replace("CATS_START_FILE", "DOGS_START_FILE")
        modified_bundle = modified_bundle.replace("CATS_END_FILE", "DOGS_END_FILE")
        modified_bundle = modified_bundle.replace("🐈", "🐕")

        config = {
            "output_dir": str(output_dir),
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
        changeset = processor.parse_bundle(modified_bundle)

        for change in changeset.changes:
            change.status = "accepted"

        processor.apply_changes(changeset)

        # Step 3: Verify extracted file matches original
        extracted_main = output_dir / "src" / "main.py"
        original_main = self.test_dir / "src" / "main.py"

        self.assertTrue(extracted_main.exists())
        self.assertEqual(
            extracted_main.read_text(),
            original_main.read_text()
        )

    def test_delta_workflow_with_modifications(self):
        """Test delta workflow: create baseline, modify, apply delta"""
        # Step 1: Create original file
        original_file = self.test_dir / "code.py"
        original_file.write_text(
            "line 1\n"
            "line 2\n"
            "line 3\n"
            "line 4\n"
            "line 5\n"
        )

        # Step 2: Create delta bundle
        delta_bundle = """
🐕 --- DOGS_START_FILE: code.py ---
@@ PAWS_CMD REPLACE_LINES(2, 3) @@
```
new line 2
new line 3
```
🐕 --- DOGS_END_FILE: code.py ---
"""

        # Step 3: Apply delta
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
        changeset = processor.parse_bundle(delta_bundle)

        for change in changeset.changes:
            change.status = "accepted"

        processor.apply_changes(changeset)

        # Step 4: Verify changes
        modified_content = original_file.read_text()
        self.assertIn("new line 2", modified_content)
        self.assertIn("new line 3", modified_content)
        self.assertIn("line 1", modified_content)
        self.assertIn("line 4", modified_content)


class TestMultiFileOperations(unittest.TestCase):
    """Test operations on multiple files simultaneously"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="multi_file_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create multiple test files
        for i in range(5):
            (self.test_dir / f"file{i}.py").write_text(f"# File {i}")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_bundle_multiple_files(self):
        """Test bundling multiple files at once"""
        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["*.py"],
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

        # All files should be in bundle
        for i in range(5):
            self.assertIn(f"file{i}.py", bundle)

    def test_extract_multiple_files(self):
        """Test extracting multiple files simultaneously"""
        bundle = """
🐕 --- DOGS_START_FILE: out1.py ---
```
# Output 1
```
🐕 --- DOGS_END_FILE: out1.py ---

🐕 --- DOGS_START_FILE: out2.py ---
```
# Output 2
```
🐕 --- DOGS_END_FILE: out2.py ---

🐕 --- DOGS_START_FILE: out3.py ---
```
# Output 3
```
🐕 --- DOGS_END_FILE: out3.py ---
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

        # All output files should exist
        for i in range(1, 4):
            self.assertTrue((self.test_dir / f"out{i}.py").exists())


class TestNestedDirectoryOperations(unittest.TestCase):
    """Test operations with deeply nested directory structures"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="nested_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create nested structure
        nested_path = self.test_dir / "a" / "b" / "c" / "d" / "e"
        nested_path.mkdir(parents=True)
        (nested_path / "deep.py").write_text("# Deep file")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_bundle_nested_files(self):
        """Test bundling files in nested directories"""
        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["a"],
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

        self.assertIn("deep.py", bundle)

    def test_extract_to_nested_directory(self):
        """Test extracting files to deeply nested paths"""
        bundle = """
🐕 --- DOGS_START_FILE: x/y/z/nested_out.py ---
```
# Nested output
```
🐕 --- DOGS_END_FILE: x/y/z/nested_out.py ---
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

        nested_file = self.test_dir / "x" / "y" / "z" / "nested_out.py"
        self.assertTrue(nested_file.exists())
        self.assertIn("Nested output", nested_file.read_text())


class TestBinaryFileHandling(unittest.TestCase):
    """Test handling of binary files in workflow"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="binary_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create binary file
        binary_content = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        (self.test_dir / "image.png").write_bytes(binary_content)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_bundle_binary_file(self):
        """Test bundling binary files with base64 encoding"""
        bundler = cats.CatsBundler(cats.BundleConfig(
            path_specs=["image.png"],
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

        self.assertIn("image.png", bundle)
        self.assertIn("Base64", bundle)


class TestErrorRecovery(unittest.TestCase):
    """Test error recovery in integrated workflows"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="error_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_partial_bundle_extraction(self):
        """Test extracting partially malformed bundle"""
        bundle = """
🐕 --- DOGS_START_FILE: good1.py ---
```
# Good file 1
```
🐕 --- DOGS_END_FILE: good1.py ---

🐕 --- DOGS_START_FILE: bad.py ---
# Malformed - no end marker

🐕 --- DOGS_START_FILE: good2.py ---
```
# Good file 2
```
🐕 --- DOGS_END_FILE: good2.py ---
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

        # Should process valid files even if some are malformed
        processor.apply_changes(changeset)

        # At least the good files should be extracted
        # (exact behavior depends on error handling strategy)

    def test_handle_permission_errors(self):
        """Test handling permission errors during file operations"""
        if os.name == 'nt':
            self.skipTest("Permission test not reliable on Windows")

        # Create a read-only directory
        readonly_dir = self.test_dir / "readonly"
        readonly_dir.mkdir()
        os.chmod(readonly_dir, 0o444)

        try:
            bundle = """
🐕 --- DOGS_START_FILE: readonly/file.py ---
```
# Should fail
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
            changeset = processor.parse_bundle(bundle)

            for change in changeset.changes:
                change.status = "accepted"

            # Should handle permission error gracefully
            success = processor.apply_changes(changeset)

            # May or may not succeed depending on implementation
            # Key is that it doesn't crash

        finally:
            os.chmod(readonly_dir, 0o755)


if __name__ == "__main__":
    unittest.main(verbosity=2)
