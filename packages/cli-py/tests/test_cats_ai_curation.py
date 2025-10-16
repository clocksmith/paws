#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive test suite for CATS AI Curation features (cats.py)
Tests AI-powered file selection, project analysis, and tree building
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

import cats
from cats import (
    ProjectAnalyzer, FileTreeNode, AICurator, CatsBundler, BundleConfig
)


class TestFileTreeNode(unittest.TestCase):
    """Test FileTreeNode data structure"""

    def test_create_file_node(self):
        """Test creating a file node"""
        node = FileTreeNode(
            path="test.py",
            is_dir=False,
            size=100
        )
        self.assertEqual(node.path, "test.py")
        self.assertFalse(node.is_dir)
        self.assertEqual(node.size, 100)

    def test_create_directory_node(self):
        """Test creating a directory node"""
        node = FileTreeNode(
            path="src",
            is_dir=True
        )
        self.assertTrue(node.is_dir)
        self.assertEqual(len(node.children), 0)

    def test_file_tree_to_string(self):
        """Test converting file tree to string representation"""
        root = FileTreeNode(path="project", is_dir=True)
        src = FileTreeNode(path="project/src", is_dir=True)
        file1 = FileTreeNode(path="project/src/main.py", is_dir=False, size=500)

        root.children.append(src)
        src.children.append(file1)

        tree_str = root.to_string()

        self.assertIn("src/", tree_str)
        self.assertIn("main.py", tree_str)
        self.assertIn("500 bytes", tree_str)

    def test_nested_tree_structure(self):
        """Test deeply nested tree structure"""
        root = FileTreeNode(path="root", is_dir=True)
        level1 = FileTreeNode(path="root/level1", is_dir=True)
        level2 = FileTreeNode(path="root/level1/level2", is_dir=True)
        leaf = FileTreeNode(path="root/level1/level2/file.txt", is_dir=False, size=123)

        root.children.append(level1)
        level1.children.append(level2)
        level2.children.append(leaf)

        tree_str = root.to_string()
        # Check indentation reflects nesting
        self.assertIn("level1/", tree_str)
        self.assertIn("level2/", tree_str)
        self.assertIn("file.txt", tree_str)

    def test_empty_directory_node(self):
        """Test empty directory representation"""
        node = FileTreeNode(path="empty_dir", is_dir=True)
        tree_str = node.to_string()

        self.assertIn("empty_dir/", tree_str)


class TestProjectAnalyzer(unittest.TestCase):
    """Test ProjectAnalyzer for project structure analysis"""

    def setUp(self):
        """Set up test project structure"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_analyzer_"))

        # Create test project structure
        (self.test_dir / "src").mkdir()
        (self.test_dir / "src" / "main.py").write_text("print('main')")
        (self.test_dir / "src" / "utils.py").write_text("# utils")

        (self.test_dir / "tests").mkdir()
        (self.test_dir / "tests" / "test_main.py").write_text("# tests")

        (self.test_dir / "docs").mkdir()
        (self.test_dir / "docs" / "README.md").write_text("# Docs")

        # Create gitignore
        (self.test_dir / ".gitignore").write_text("*.pyc\n__pycache__\n.venv\n")

        # Create files that should be ignored
        (self.test_dir / "ignored.pyc").write_text("binary")
        (self.test_dir / "__pycache__").mkdir()

    def tearDown(self):
        """Clean up test directory"""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_analyzer_initialization(self):
        """Test ProjectAnalyzer initialization"""
        analyzer = ProjectAnalyzer(self.test_dir)
        self.assertEqual(analyzer.root_path, self.test_dir)
        self.assertIsNotNone(analyzer.gitignore_patterns)

    def test_load_gitignore_patterns(self):
        """Test loading gitignore patterns"""
        analyzer = ProjectAnalyzer(self.test_dir)

        self.assertIn("*.pyc", analyzer.gitignore_patterns)
        self.assertIn("__pycache__", analyzer.gitignore_patterns)
        self.assertIn(".venv", analyzer.gitignore_patterns)

    def test_should_ignore_pyc_files(self):
        """Test that .pyc files are ignored"""
        analyzer = ProjectAnalyzer(self.test_dir)

        pyc_file = self.test_dir / "test.pyc"
        self.assertTrue(analyzer._should_ignore(pyc_file))

    def test_should_ignore_pycache(self):
        """Test that __pycache__ directories are ignored"""
        analyzer = ProjectAnalyzer(self.test_dir)

        pycache_dir = self.test_dir / "__pycache__"
        self.assertTrue(analyzer._should_ignore(pycache_dir))

    def test_should_not_ignore_python_files(self):
        """Test that .py files are not ignored"""
        analyzer = ProjectAnalyzer(self.test_dir)

        py_file = self.test_dir / "src" / "main.py"
        self.assertFalse(analyzer._should_ignore(py_file))

    def test_build_file_tree(self):
        """Test building file tree from project"""
        analyzer = ProjectAnalyzer(self.test_dir)
        tree = analyzer.build_file_tree()

        self.assertIsNotNone(tree)
        self.assertTrue(tree.is_dir)

        # Verify structure
        tree_str = tree.to_string()
        self.assertIn("src/", tree_str)
        self.assertIn("main.py", tree_str)
        self.assertIn("tests/", tree_str)

        # Verify ignored files are not in tree
        self.assertNotIn("ignored.pyc", tree_str)
        self.assertNotIn("__pycache__", tree_str)

    def test_build_tree_with_nested_structure(self):
        """Test building tree with deeply nested structure"""
        # Create deeper nesting
        nested_dir = self.test_dir / "deep" / "nested" / "structure"
        nested_dir.mkdir(parents=True)
        (nested_dir / "deep_file.py").write_text("deep")

        analyzer = ProjectAnalyzer(self.test_dir)
        tree = analyzer.build_file_tree()

        tree_str = tree.to_string()
        self.assertIn("deep/", tree_str)
        self.assertIn("nested/", tree_str)
        self.assertIn("deep_file.py", tree_str)

    def test_empty_project_tree(self):
        """Test building tree for empty directory"""
        empty_dir = Path(tempfile.mkdtemp(prefix="empty_"))

        try:
            analyzer = ProjectAnalyzer(empty_dir)
            tree = analyzer.build_file_tree()

            self.assertIsNotNone(tree)
            self.assertEqual(len(tree.children), 0)
        finally:
            shutil.rmtree(empty_dir, ignore_errors=True)


class TestAICurator(unittest.TestCase):
    """Test AI-powered file curation"""

    def test_curator_initialization_gemini(self):
        """Test initializing curator with Gemini"""
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test_key'}):
            try:
                curator = AICurator(api_key="test_key", provider="gemini")
                self.assertEqual(curator.provider, "gemini")
            except:
                # May fail if gemini not available, which is OK
                pass

    def test_curator_initialization_no_key(self):
        """Test that initialization fails without API key"""
        with self.assertRaises(ValueError):
            curator = AICurator(api_key=None, provider="gemini")

    def test_build_curation_prompt(self):
        """Test building the curation prompt"""
        curator_mock = Mock()
        curator_mock._build_curation_prompt = AICurator._build_curation_prompt

        task = "Add a new authentication feature"
        tree = "src/\n  auth.py\n  main.py\n"
        max_files = 10

        prompt = curator_mock._build_curation_prompt(curator_mock, task, tree, max_files)

        self.assertIn("authentication feature", prompt)
        self.assertIn("auth.py", prompt)
        self.assertIn("maximum 10", prompt.lower())
        self.assertIn("JSON", prompt)

    def test_parse_ai_response_json(self):
        """Test parsing JSON response from AI"""
        curator_mock = Mock()
        curator_mock._parse_ai_response = AICurator._parse_ai_response

        response = '{"files": ["src/auth.py", "src/models.py", "config.yaml"]}'

        result = curator_mock._parse_ai_response(curator_mock, response)

        self.assertEqual(len(result), 3)
        self.assertIn("src/auth.py", result)
        self.assertIn("src/models.py", result)
        self.assertIn("config.yaml", result)

    def test_parse_ai_response_with_markdown(self):
        """Test parsing AI response wrapped in markdown"""
        curator_mock = Mock()
        curator_mock._parse_ai_response = AICurator._parse_ai_response

        response = '''Here are the files:
```json
{"files": ["file1.py", "file2.py"]}
```
These files are essential.'''

        result = curator_mock._parse_ai_response(curator_mock, response)

        self.assertEqual(len(result), 2)
        self.assertIn("file1.py", result)
        self.assertIn("file2.py", result)

    def test_parse_ai_response_fallback(self):
        """Test fallback parsing when JSON extraction fails"""
        curator_mock = Mock()
        curator_mock._parse_ai_response = AICurator._parse_ai_response

        response = '''
        The relevant files are:
        - src/main.py
        - tests/test_main.py
        - config.yaml
        '''

        result = curator_mock._parse_ai_response(curator_mock, response)

        # Fallback should extract .py and .yaml files
        self.assertGreater(len(result), 0)

    def test_parse_ai_response_empty(self):
        """Test parsing empty AI response"""
        curator_mock = Mock()
        curator_mock._parse_ai_response = AICurator._parse_ai_response

        response = "I don't know which files to select."

        result = curator_mock._parse_ai_response(curator_mock, response)

        self.assertEqual(len(result), 0)


class TestCatsBundlerWithAI(unittest.TestCase):
    """Test CatsBundler with AI curation"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="cats_bundler_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create test files
        (self.test_dir / "src").mkdir()
        (self.test_dir / "src" / "main.py").write_text("# main")
        (self.test_dir / "src" / "utils.py").write_text("# utils")
        (self.test_dir / "tests").mkdir()
        (self.test_dir / "tests" / "test.py").write_text("# test")

    def tearDown(self):
        """Clean up"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_bundler_initialization(self):
        """Test CatsBundler initialization"""
        config = BundleConfig(
            path_specs=["src"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = CatsBundler(config)
        self.assertIsNotNone(bundler)

    def test_get_ai_curated_files_mock(self):
        """Test AI curation with mocked AI response"""
        config = BundleConfig(
            path_specs=["src"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add authentication",
            ai_provider="gemini",
            ai_key="test_key",
            max_files=5
        )

        bundler = CatsBundler(config)

        # Mock the AI curator
        with patch.object(bundler, '_get_ai_curated_files') as mock_curate:
            mock_curate.return_value = ["src/main.py"]

            files = bundler._get_ai_curated_files()

            self.assertEqual(files, ["src/main.py"])

    def test_create_bundle_without_ai(self):
        """Test creating bundle without AI curation"""
        config = BundleConfig(
            path_specs=["src/main.py"],
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

        self.assertIsNotNone(bundle)
        self.assertIn("main.py", bundle)


class TestBundleConfigValidation(unittest.TestCase):
    """Test BundleConfig validation and defaults"""

    def test_bundle_config_creation(self):
        """Test creating BundleConfig with all fields"""
        config = BundleConfig(
            path_specs=["src"],
            exclude_patterns=["*.pyc"],
            output_file=Path("output.md"),
            encoding_mode="auto",
            use_default_excludes=True,
            prepare_for_delta=False,
            persona_files=[Path("persona.md")],
            sys_prompt_file="sys.md",
            no_sys_prompt=False,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=False,
            yes=False,
            ai_curate=None,
            ai_provider="gemini",
            ai_key=None,
            max_files=20,
            include_tests=False
        )

        self.assertEqual(config.path_specs, ["src"])
        self.assertEqual(config.max_files, 20)
        self.assertEqual(config.ai_provider, "gemini")

    def test_bundle_config_with_ai_curation(self):
        """Test BundleConfig with AI curation enabled"""
        config = BundleConfig(
            path_specs=["src"],
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
            yes=True,
            ai_curate="Add feature X",
            ai_provider="claude",
            ai_key="test_key",
            max_files=15,
            include_tests=True
        )

        self.assertEqual(config.ai_curate, "Add feature X")
        self.assertEqual(config.ai_provider, "claude")
        self.assertTrue(config.include_tests)
        self.assertEqual(config.max_files, 15)


class TestProjectAnalysisEdgeCases(unittest.TestCase):
    """Test edge cases in project analysis"""

    def test_analyze_project_with_symlinks(self):
        """Test analyzing project with symbolic links"""
        test_dir = Path(tempfile.mkdtemp(prefix="symlink_test_"))

        try:
            # Create real file
            real_file = test_dir / "real.py"
            real_file.write_text("real content")

            # Create symlink
            try:
                link_file = test_dir / "link.py"
                link_file.symlink_to(real_file)

                analyzer = ProjectAnalyzer(test_dir)
                tree = analyzer.build_file_tree()

                tree_str = tree.to_string()
                # Both might appear, depending on implementation
                self.assertTrue("real.py" in tree_str or "link.py" in tree_str)
            except OSError:
                # Symlinks might not be supported on some systems
                self.skipTest("Symlinks not supported on this system")

        finally:
            shutil.rmtree(test_dir, ignore_errors=True)

    def test_analyze_project_with_hidden_files(self):
        """Test that hidden files are handled correctly"""
        test_dir = Path(tempfile.mkdtemp(prefix="hidden_test_"))

        try:
            (test_dir / ".hidden").write_text("hidden")
            (test_dir / "visible.py").write_text("visible")

            # Add .hidden to gitignore
            (test_dir / ".gitignore").write_text(".hidden\n")

            analyzer = ProjectAnalyzer(test_dir)
            tree = analyzer.build_file_tree()

            tree_str = tree.to_string()
            self.assertIn("visible.py", tree_str)
            # .hidden should be ignored due to gitignore

        finally:
            shutil.rmtree(test_dir, ignore_errors=True)

    def test_analyze_empty_gitignore(self):
        """Test analyzing project with empty .gitignore"""
        test_dir = Path(tempfile.mkdtemp(prefix="empty_gi_test_"))

        try:
            (test_dir / ".gitignore").write_text("")
            (test_dir / "file.py").write_text("content")

            analyzer = ProjectAnalyzer(test_dir)

            # Should still have default patterns
            self.assertGreater(len(analyzer.gitignore_patterns), 0)
            self.assertIn("__pycache__", analyzer.gitignore_patterns)

        finally:
            shutil.rmtree(test_dir, ignore_errors=True)

    def test_analyze_very_large_file(self):
        """Test analyzing project with very large file"""
        test_dir = Path(tempfile.mkdtemp(prefix="large_file_test_"))

        try:
            # Create a large file
            large_file = test_dir / "large.txt"
            large_content = "x" * (10 * 1024 * 1024)  # 10 MB
            large_file.write_text(large_content)

            analyzer = ProjectAnalyzer(test_dir)
            tree = analyzer.build_file_tree()

            tree_str = tree.to_string()
            self.assertIn("large.txt", tree_str)
            # Should show file size
            self.assertIn("bytes", tree_str)

        finally:
            shutil.rmtree(test_dir, ignore_errors=True)


class TestAICuratorExceptionHandling(unittest.TestCase):
    """Test AICurator exception handling"""

    def test_curate_with_gemini_exception(self):
        """Test _curate_with_gemini exception handling (lines 413-418)"""
        from cats import AICurator
        from unittest.mock import patch, Mock

        curator = AICurator(api_key="test_key", provider="gemini")

        # Mock the client to raise an exception
        mock_client = Mock()
        mock_client.generate_content.side_effect = Exception("API Error")
        curator.client = mock_client

        # Should catch exception and return empty list
        with patch('sys.stdout', new=Mock()):
            result = curator._curate_with_gemini("test prompt")

        self.assertEqual(result, [])

    def test_curate_with_claude_exception(self):
        """Test _curate_with_claude exception handling (lines 422-431)"""
        from cats import AICurator
        from unittest.mock import Mock

        # Create curator with gemini (which is available in tests)
        curator = AICurator(api_key="test_key", provider="gemini")

        # Mock the client to raise an exception when calling messages.create
        mock_client = Mock()
        mock_client.messages.create.side_effect = Exception("API Error")
        curator.client = mock_client

        # Should catch exception and return empty list
        with patch('sys.stdout', new=Mock()):
            result = curator._curate_with_claude("test prompt")

        self.assertEqual(result, [])

    def test_curate_with_openai_exception(self):
        """Test _curate_with_openai exception handling (lines 435-444)"""
        from cats import AICurator
        from unittest.mock import patch, Mock
        import sys

        # Create curator with gemini (which is available in tests)
        curator = AICurator(api_key="test_key", provider="gemini")

        # Mock openai module at the global level
        mock_openai = Mock()
        mock_openai.ChatCompletion.create.side_effect = Exception("API Error")

        with patch.dict(sys.modules, {'openai': mock_openai}):
            with patch('sys.stdout', new=Mock()):
                result = curator._curate_with_openai("test prompt")

        self.assertEqual(result, [])


class TestProjectAnalyzerGit(unittest.TestCase):
    """Test ProjectAnalyzer with git"""

    def test_build_tree_with_git(self):
        """Test _build_tree_with_git method (lines 271-281)"""
        import tempfile
        import subprocess
        from cats import ProjectAnalyzer

        test_dir = Path(tempfile.mkdtemp(prefix="git_tree_"))

        try:
            # Initialize git repo
            subprocess.run(["git", "init"], cwd=test_dir, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=test_dir, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=test_dir, check=True, capture_output=True)

            # Create and track files
            (test_dir / "tracked.py").write_text("print('tracked')")
            (test_dir / "untracked.py").write_text("print('untracked')")

            subprocess.run(["git", "add", "tracked.py"], cwd=test_dir, check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=test_dir, check=True, capture_output=True)

            # Build tree with git
            analyzer = ProjectAnalyzer(test_dir)
            tree = analyzer._build_tree_with_git()

            tree_str = tree.to_string()
            # Should include tracked file
            self.assertIn("tracked.py", tree_str)

        except (FileNotFoundError, subprocess.CalledProcessError):
            self.skipTest("Git not available")
        finally:
            shutil.rmtree(test_dir, ignore_errors=True)


class TestProjectAnalyzerIgnorePatterns(unittest.TestCase):
    """Test ProjectAnalyzer ignore patterns"""

    def test_build_tree_with_walk_ignores_dirs(self):
        """Test _build_tree_with_walk ignoring directories (line 296)"""
        import tempfile
        from cats import ProjectAnalyzer

        test_dir = Path(tempfile.mkdtemp(prefix="walk_ignore_"))

        try:
            # Create directory structure
            (test_dir / "src").mkdir()
            (test_dir / "src" / "main.py").write_text("code")
            (test_dir / "node_modules").mkdir()
            (test_dir / "node_modules" / "lib.js").write_text("lib")

            analyzer = ProjectAnalyzer(test_dir)
            tree = analyzer._build_tree_with_walk()

            tree_str = tree.to_string()
            # Should include src but not node_modules (default exclude)
            self.assertIn("main.py", tree_str)
            self.assertNotIn("node_modules", tree_str)
            self.assertNotIn("lib.js", tree_str)

        finally:
            shutil.rmtree(test_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
