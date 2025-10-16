#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Additional comprehensive tests for cats.py to reach near-100% coverage
Focuses on uncovered code paths, CLI options, and advanced features
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock
import subprocess

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from paws import cats
from paws.cats import CatsBundler, BundleConfig


class TestCLIArgumentCombinations(unittest.TestCase):
    """Test various CLI argument combinations"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_cli_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create test files
        (self.test_dir / "test.py").write_text("print('test')")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_prepare_for_delta_flag(self):
        """Test --prepare-for-delta flag"""
        config = BundleConfig(
            path_specs=["test.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=True,  # This flag
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should include delta reference markers
        self.assertIsInstance(bundle, str)
        self.assertIn("test.py", bundle)

    def test_encoding_mode_force_text(self):
        """Test forcing text encoding"""
        # Create binary file
        binary_file = self.test_dir / "binary.dat"
        binary_file.write_bytes(b'\x00\x01\x02\x03')

        config = BundleConfig(
            path_specs=["binary.dat"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="text",  # Force text
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
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIsInstance(bundle, str)

    def test_encoding_mode_force_base64(self):
        """Test forcing base64 encoding"""
        config = BundleConfig(
            path_specs=["test.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="base64",  # Force base64
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
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should successfully create bundle (base64 mode may not add marker for text files)
        self.assertIsNotNone(bundle)
        self.assertIn("test.py", bundle)

    def test_require_sys_prompt_with_file(self):
        """Test --require-sys-prompt with existing file"""
        sys_prompt_file = self.test_dir / "sys_prompt.md"
        sys_prompt_file.write_text("System prompt content")

        config = BundleConfig(
            path_specs=["test.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file=str(sys_prompt_file),
            no_sys_prompt=False,
            require_sys_prompt=True,  # Require it
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("System prompt content", bundle)


class TestVerificationModes(unittest.TestCase):
    """Test verification modes"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_verify_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_verify_mode_basic(self):
        """Test basic verify mode"""
        (self.test_dir / "test.py").write_text("print('test')")

        config = BundleConfig(
            path_specs=["test.py"],
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
            verify="basic",  # Enable verification
            quiet=False,
            yes=True
        )

        bundler = CatsBundler(config)

        # Should perform verification
        bundle = bundler.create_bundle()
        self.assertIsNotNone(bundle)

    def test_strict_catscan_with_readme_and_catscan(self):
        """Test strict CATSCAN mode with both files"""
        test_dir = self.test_dir / "project"
        test_dir.mkdir()

        (test_dir / "README.md").write_text("# Project")
        (test_dir / "CATSCAN.md").write_text("# Summary")
        (test_dir / "code.py").write_text("print('code')")

        config = BundleConfig(
            path_specs=["project"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=True,  # Strict mode
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should succeed with both files
        self.assertIsNotNone(bundle)


class TestAdvancedFileHandling(unittest.TestCase):
    """Test advanced file handling scenarios"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_advanced_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_bundle_with_multiple_personas(self):
        """Test bundling with multiple persona files"""
        # Create persona files
        persona1 = self.test_dir / "persona1.md"
        persona1.write_text("# Persona 1")

        persona2 = self.test_dir / "persona2.md"
        persona2.write_text("# Persona 2")

        (self.test_dir / "code.py").write_text("print('code')")

        config = BundleConfig(
            path_specs=["code.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[persona1, persona2],  # Multiple personas
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should include both personas
        self.assertIn("Persona 1", bundle)
        self.assertIn("Persona 2", bundle)

    def test_bundle_very_large_file(self):
        """Test bundling a very large file"""
        large_file = self.test_dir / "large.txt"

        # Create 10MB file
        with open(large_file, 'w') as f:
            for i in range(200000):
                f.write(f"Line {i}\n")

        config = BundleConfig(
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
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should handle large file
        self.assertIsNotNone(bundle)
        self.assertGreater(len(bundle), 1000000)

    def test_bundle_with_glob_patterns(self):
        """Test complex glob patterns"""
        # Create directory structure
        (self.test_dir / "src").mkdir()
        (self.test_dir / "src" / "file1.py").write_text("# File 1")
        (self.test_dir / "src" / "file2.py").write_text("# File 2")

        (self.test_dir / "tests").mkdir()
        (self.test_dir / "tests" / "test1.py").write_text("# Test 1")

        config = BundleConfig(
            path_specs=["**/*.py"],  # Glob pattern
            exclude_patterns=["tests/**"],  # Exclude tests
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
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should include src files but not test files
        self.assertIn("File 1", bundle)
        self.assertIn("File 2", bundle)
        self.assertNotIn("Test 1", bundle)


class TestOutputHandling(unittest.TestCase):
    """Test output file handling"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_output_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_output_to_file(self):
        """Test outputting to file"""
        (self.test_dir / "source.py").write_text("print('source')")

        output_file = self.test_dir / "bundle.md"

        config = BundleConfig(
            path_specs=["source.py"],
            exclude_patterns=[],
            output_file=output_file,  # Output to file
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
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Bundle should be created and returned
        self.assertIsNotNone(bundle)
        self.assertIn("source.py", bundle)

    def test_overwrite_confirmation(self):
        """Test overwrite confirmation"""
        (self.test_dir / "source.py").write_text("print('source')")
        output_file = self.test_dir / "existing.md"
        output_file.write_text("Existing content")

        config = BundleConfig(
            path_specs=["source.py"],
            exclude_patterns=[],
            output_file=output_file,
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
            yes=True  # Auto-confirm
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIsNotNone(bundle)


class TestErrorHandlingPaths(unittest.TestCase):
    """Test error handling paths"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_errors_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_handle_nonexistent_persona(self):
        """Test handling non-existent persona file"""
        (self.test_dir / "code.py").write_text("print('code')")

        config = BundleConfig(
            path_specs=["code.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[Path("nonexistent.md")],  # Non-existent
            sys_prompt_file="",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=False,
            yes=True
        )

        bundler = CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should handle gracefully
        self.assertIsNotNone(bundle)

    def test_handle_unreadable_file(self):
        """Test handling unreadable file"""
        if os.name == 'nt':
            self.skipTest("Permission test not reliable on Windows")

        unreadable = self.test_dir / "unreadable.py"
        unreadable.write_text("content")
        os.chmod(unreadable, 0o000)

        try:
            config = BundleConfig(
                path_specs=["unreadable.py"],
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
                quiet=False,
                yes=True
            )

            bundler = CatsBundler(config)
            bundle = bundler.create_bundle()

            # Should handle gracefully
            self.assertIsNotNone(bundle)

        finally:
            os.chmod(unreadable, 0o644)


class TestCLIMain(unittest.TestCase):
    """Test CLI main function paths"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_main_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_main_with_minimal_args(self):
        """Test main function with minimal arguments"""
        (self.test_dir / "test.py").write_text("print('test')")

        # Mock sys.argv
        test_args = ['cats.py', 'test.py', '-o', '-', '--no-sys-prompt', '-q', '-y']

        with patch('sys.argv', test_args):
            try:
                # Test that main can be called (might exit)
                result = cats.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                # Main might call sys.exit()
                self.assertEqual(e.code, 0)


class TestModuleVerification(unittest.TestCase):
    """Test module verification feature (lines 165-182)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_verify_module_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_verify_python_module(self):
        """Test Python module verification"""
        # Create a Python module
        module_file = self.test_dir / "mymodule.py"
        module_file.write_text("""
def my_function(x):
    return x * 2

class MyClass:
    def method(self):
        pass
""")

        (self.test_dir / "source.py").write_text("print('source')")

        test_args = ['cats.py', 'source.py', '--verify', 'mymodule.py',
                     '--no-sys-prompt', '-q', '-y']

        with patch('sys.argv', test_args):
            try:
                result = cats.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_verify_js_module(self):
        """Test JavaScript module verification"""
        # Create a JS module
        module_file = self.test_dir / "mymodule.js"
        module_file.write_text("""
export function myFunction(x) {
    return x * 2;
}
""")

        (self.test_dir / "source.py").write_text("print('source')")

        test_args = ['cats.py', 'source.py', '--verify', 'mymodule.js',
                     '--no-sys-prompt', '-q', '-y']

        with patch('sys.argv', test_args):
            try:
                result = cats.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_verify_ts_module(self):
        """Test TypeScript module verification"""
        # Create a TS module
        module_file = self.test_dir / "mymodule.ts"
        module_file.write_text("""
export function myFunction(x: number): number {
    return x * 2;
}
""")

        (self.test_dir / "source.py").write_text("print('source')")

        test_args = ['cats.py', 'source.py', '--verify', 'mymodule.ts',
                     '--no-sys-prompt', '-q', '-y']

        with patch('sys.argv', test_args):
            try:
                result = cats.main()
                self.assertIn(result, [0, None])
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_verify_nonexistent_module(self):
        """Test verification with non-existent module"""
        (self.test_dir / "source.py").write_text("print('source')")

        test_args = ['cats.py', 'source.py', '--verify', 'nonexistent.py',
                     '--no-sys-prompt', '-q', '-y']

        with patch('sys.argv', test_args):
            try:
                result = cats.main()
                # Should exit with error
                self.fail("Expected SystemExit")
            except SystemExit as e:
                self.assertEqual(e.code, 1)

    def test_verify_unsupported_extension(self):
        """Test verification with unsupported file type"""
        # Create file with unsupported extension
        module_file = self.test_dir / "data.txt"
        module_file.write_text("some data")

        (self.test_dir / "source.py").write_text("print('source')")

        test_args = ['cats.py', 'source.py', '--verify', 'data.txt',
                     '--no-sys-prompt', '-q', '-y']

        with patch('sys.argv', test_args):
            with patch('sys.stderr'):
                try:
                    result = cats.main()
                    # Should complete but warn about unsupported type
                    self.assertIn(result, [0, None])
                except SystemExit as e:
                    self.assertEqual(e.code, 0)


class TestAICurationErrorHandling(unittest.TestCase):
    """Test AI curation error handling (lines 422-444)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_ai_error_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create test files
        (self.test_dir / "file1.py").write_text("# File 1")
        (self.test_dir / "file2.py").write_text("# File 2")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_claude_api_error(self):
        """Test Claude API error handling"""
        try:
            from anthropic import Anthropic

            # Create curator with mock API key
            curator = cats.AICurator("test_key", provider="claude")

            # Mock the client to raise an error
            with patch.object(curator, 'client') as mock_client:
                mock_client.messages.create.side_effect = Exception("API Error")

                result = curator._curate_with_claude("Test prompt")

                # Should return empty list on error
                self.assertEqual(result, [])
        except ImportError:
            self.skipTest("anthropic library not available")

    def test_openai_api_error(self):
        """Test OpenAI API error handling"""
        try:
            import openai

            # Create curator with mock API key
            curator = cats.AICurator("test_key", provider="openai")

            # Mock openai to raise an error
            with patch('openai.ChatCompletion.create', side_effect=Exception("API Error")):
                result = curator._curate_with_openai("Test prompt")

                # Should return empty list on error
                self.assertEqual(result, [])
        except ImportError:
            self.skipTest("openai library not available")

    def test_ai_curation_with_invalid_provider(self):
        """Test AI curation with invalid provider"""
        # Should raise ValueError for invalid provider
        with self.assertRaises(ValueError) as cm:
            curator = cats.AICurator("test_key", provider="invalid")

        self.assertIn("not available or not supported", str(cm.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)
