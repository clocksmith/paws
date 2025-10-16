#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Edge case tests for cats.py to improve coverage
Targets specific uncovered lines: 120, 135-140, 153, 242-243, 250-251, 256, 265
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).parent.parent))

from paws import cats
from paws.cats import ProjectAnalyzer, FileTreeNode


class TestGitignoreEdgeCases(unittest.TestCase):
    """Test gitignore pattern matching edge cases (lines 242-243, 250-251, 256)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_edge_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_gitignore_exact_filename_match(self):
        """Test exact filename match in gitignore (line 250-251)"""
        # Create gitignore with exact filename
        gitignore = self.test_dir / ".gitignore"
        gitignore.write_text("config.ini\n")

        analyzer = ProjectAnalyzer(self.test_dir)

        # Create file with that exact name in subdirectory
        subdir = self.test_dir / "configs"
        subdir.mkdir()
        config_file = subdir / "config.ini"
        config_file.write_text("settings")

        # Should match exact filename (using private method)
        self.assertTrue(analyzer._should_ignore(config_file))

    def test_gitignore_glob_pattern_match(self):
        """Test glob pattern matching (line 256)"""
        # Create gitignore with glob pattern
        gitignore = self.test_dir / ".gitignore"
        gitignore.write_text("*.log\ntemp_*\n")

        analyzer = ProjectAnalyzer(self.test_dir)

        # Test wildcard extension match
        log_file = self.test_dir / "app.log"
        log_file.write_text("logs")
        self.assertTrue(analyzer._should_ignore(log_file))

        # Test prefix wildcard match
        temp_file = self.test_dir / "temp_data.txt"
        temp_file.write_text("temp")
        self.assertTrue(analyzer._should_ignore(temp_file))

    def test_gitignore_absolute_path_fallback(self):
        """Test gitignore with non-relative path (lines 242-243)"""
        # Create analyzer at a different location
        other_dir = Path(tempfile.mkdtemp(prefix="cats_other_"))
        try:
            analyzer = ProjectAnalyzer(self.test_dir)

            # Try to check a file that's not relative to root_path
            # This should trigger the ValueError fallback
            external_file = other_dir / "external.txt"
            external_file.write_text("external")

            # Should handle gracefully using str(path)
            result = analyzer._should_ignore(external_file)
            self.assertIsInstance(result, bool)
        finally:
            shutil.rmtree(other_dir, ignore_errors=True)


class TestFileTreeBuilding(unittest.TestCase):
    """Test file tree building without git (line 265)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_tree_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_build_tree_without_git(self):
        """Test building file tree without git (line 265)"""
        # Create directory structure without git
        (self.test_dir / "src").mkdir()
        (self.test_dir / "src" / "main.py").write_text("# main")
        (self.test_dir / "README.md").write_text("# README")

        # Mock git to be unavailable
        with patch('paws.cats.GIT_AVAILABLE', False):
            analyzer = ProjectAnalyzer(self.test_dir)
            tree = analyzer.build_file_tree()

            # Should successfully build tree using os.walk
            self.assertIsInstance(tree, FileTreeNode)
            self.assertTrue(tree.is_dir)


class TestPythonModuleVerification(unittest.TestCase):
    """Test Python module verification edge cases (lines 135-140, 153)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_verify_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_verify_module_with_import_from(self):
        """Test AST visitor with ImportFrom statements (lines 138-140)"""
        # Create module with ImportFrom and functions
        module = self.test_dir / "mymodule.py"
        module.write_text("""
from os.path import join, exists
from typing import Dict, List

def public_func():
    '''Public function'''
    pass

def _private_func():
    '''Private function'''
    pass
""")

        api = cats.verify_python_module(module, quiet=True)

        # Should return API info for public functions
        self.assertIn("public_func", api)
        self.assertEqual(api["public_func"]["type"], "function")

    def test_verify_module_with_classes(self):
        """Test AST visitor with classes (lines 124-132)"""
        # Create module with classes
        module = self.test_dir / "mymodule.py"
        module.write_text("""
class MyClass:
    def public_method(self):
        pass

    def _private_method(self):
        pass

class _PrivateClass:
    def method(self):
        pass
""")

        api = cats.verify_python_module(module, quiet=True)

        # Should capture public class with public methods
        self.assertIn("MyClass", api)
        self.assertEqual(api["MyClass"]["type"], "class")
        self.assertIn("public_method", api["MyClass"]["methods"])
        self.assertNotIn("_private_method", api["MyClass"]["methods"])

    def test_verify_module_error_with_quiet_false(self):
        """Test module verification error with quiet=False (line 153)"""
        # Create invalid Python file
        module = self.test_dir / "invalid.py"
        module.write_text("this is not valid python syntax !@#$%")

        # Should print warning when quiet=False
        with patch('sys.stderr'):
            api = cats.verify_python_module(module, quiet=False)

        # Should return empty dict on error
        self.assertEqual(api, {})


class TestDogsEdgeCases(unittest.TestCase):
    """Test dogs.py edge cases"""

    def test_file_change_get_diff_empty_return(self):
        """Test FileChange.get_diff() with no content (line 120 in dogs.py)"""
        from paws import dogs

        # Create MODIFY change with None content
        change = dogs.FileChange(
            file_path="test.txt",
            operation=dogs.FileOperation.MODIFY,
            old_content=None,  # No old content
            new_content="new"
        )

        # Should return empty string
        diff = change.get_diff()
        self.assertEqual(diff, "")

        # Also test with old_content but no new_content
        change2 = dogs.FileChange(
            file_path="test.txt",
            operation=dogs.FileOperation.MODIFY,
            old_content="old",
            new_content=None  # No new content
        )

        diff2 = change2.get_diff()
        self.assertEqual(diff2, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
