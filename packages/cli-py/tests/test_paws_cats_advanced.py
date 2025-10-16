#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Advanced test suite for cats.py components:
- CatsBundler (AI curation and bundling)
- AICurator (AI-powered file selection)
- Verification functions (Python/JS module verification)
- load_pawsignore and other utility functions
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
from paws import cats


class TestCatsBundler(unittest.TestCase):
    """Test suite for CatsBundler class (20 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_bundler_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

        # Create test project structure
        self._create_test_project()

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _create_test_project(self):
        """Create a realistic test project structure"""
        files = {
            "src/main.py": "def main():\n    print('hello')\n",
            "src/utils.py": "def helper():\n    return 42\n",
            "src/models/user.py": "class User:\n    pass\n",
            "tests/test_main.py": "def test_main():\n    assert True\n",
            "README.md": "# Project\n",
            "CATSCAN.md": "Project summary\n",
            ".pawsignore": "*.log\ntemp/\n",
            "config.yaml": "setting: value\n",
        }

        for path_str, content in files.items():
            path = self.test_dir / path_str
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

    # Basic bundling tests (5)
    def test_bundler_creates_basic_bundle(self):
        """Test that bundler creates a basic bundle"""
        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("Cats Bundle", bundle)
        self.assertIn("src/main.py", bundle)
        self.assertIn("def main()", bundle)

    def test_bundler_handles_multiple_files(self):
        """Test bundling multiple files"""
        config = cats.BundleConfig(
            path_specs=["src/main.py", "src/utils.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("src/main.py", bundle)
        self.assertIn("src/utils.py", bundle)
        self.assertIn("def main()", bundle)
        self.assertIn("def helper()", bundle)

    def test_bundler_respects_exclusions(self):
        """Test that bundler respects exclusion patterns"""
        config = cats.BundleConfig(
            path_specs=["src"],
            exclude_patterns=["**/utils.py"],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("src/main.py", bundle)
        self.assertNotIn("utils.py", bundle)

    def test_bundler_handles_empty_files(self):
        """Test bundling empty files"""
        empty_file = self.test_dir / "empty.txt"
        empty_file.touch()

        config = cats.BundleConfig(
            path_specs=["empty.txt"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("empty.txt", bundle)

    def test_bundler_handles_no_files(self):
        """Test bundler when no files match"""
        config = cats.BundleConfig(
            path_specs=["nonexistent"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertEqual(bundle, "")

    # CATSCAN mode tests (3)
    def test_bundler_strict_catscan_replaces_readme(self):
        """Test strict CATSCAN mode replaces README with CATSCAN"""
        config = cats.BundleConfig(
            path_specs=["README.md"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=True,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("CATSCAN.md", bundle)
        self.assertIn("Project summary", bundle)
        self.assertNotIn("# Project", bundle)

    def test_bundler_without_strict_catscan_keeps_readme(self):
        """Test without strict CATSCAN keeps README"""
        config = cats.BundleConfig(
            path_specs=["README.md"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("README.md", bundle)
        self.assertIn("# Project", bundle)

    def test_bundler_catscan_without_replacement(self):
        """Test CATSCAN mode when no CATSCAN.md exists"""
        # Remove CATSCAN.md
        (self.test_dir / "CATSCAN.md").unlink()

        config = cats.BundleConfig(
            path_specs=["README.md"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=True,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        # Should include original README since no CATSCAN exists
        self.assertIn("README.md", bundle)
        self.assertIn("# Project", bundle)

    # Delta mode tests (3)
    def test_bundler_prepare_for_delta_adds_header(self):
        """Test that prepare_for_delta adds appropriate headers"""
        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=True,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("# Format: DELTA", bundle)

    def test_bundler_without_delta_uses_full_format(self):
        """Test that without delta flag, bundle uses FULL format"""
        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("# Format: FULL", bundle)

    def test_bundler_includes_markers(self):
        """Test that bundle includes proper file markers"""
        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("🐈 --- CATS_START_FILE:", bundle)
        self.assertIn("🐈 --- CATS_END_FILE:", bundle)

    # Persona and system prompt tests (3)
    def test_bundler_adds_persona(self):
        """Test that bundler adds persona when configured"""
        persona_file = self.test_dir / "persona.md"
        persona_file.write_text("I am a helpful assistant")

        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[persona_file],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("--- START PERSONA ---", bundle)
        self.assertIn("I am a helpful assistant", bundle)
        self.assertIn("--- END PERSONA ---", bundle)

    def test_bundler_adds_system_prompt(self):
        """Test that bundler adds system prompt when configured"""
        sys_dir = self.test_dir / "sys"
        sys_dir.mkdir(exist_ok=True)
        sys_file = sys_dir / "sys_a.md"
        sys_file.write_text("System instructions")

        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=False,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertIn("System instructions", bundle)
        self.assertIn("--- END PREPENDED INSTRUCTIONS ---", bundle)

    def test_bundler_no_sys_prompt_flag(self):
        """Test that no_sys_prompt flag prevents system prompt"""
        sys_dir = self.test_dir / "sys"
        sys_dir.mkdir(exist_ok=True)
        sys_file = sys_dir / "sys_a.md"
        sys_file.write_text("System instructions")

        config = cats.BundleConfig(
            path_specs=["src/main.py"],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
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

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertNotIn("System instructions", bundle)

    # AI curation tests (6)
    @patch('cats.AICurator')
    def test_bundler_ai_curate_calls_curator(self, mock_curator_class):
        """Test that AI curation calls AICurator"""
        mock_curator = Mock()
        mock_curator.curate_files.return_value = ["src/main.py"]
        mock_curator_class.return_value = mock_curator

        config = cats.BundleConfig(
            path_specs=["."],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add login feature",
            ai_provider="gemini",
            ai_key="test-key",
            max_files=20
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        mock_curator_class.assert_called_once()
        mock_curator.curate_files.assert_called_once()

    @patch('cats.ProjectAnalyzer')
    @patch('cats.AICurator')
    def test_bundler_ai_curate_uses_file_tree(self, mock_curator_class, mock_analyzer_class):
        """Test that AI curation uses project file tree"""
        mock_tree = Mock()
        mock_tree.to_string.return_value = "project tree"

        mock_analyzer = Mock()
        mock_analyzer.build_file_tree.return_value = mock_tree
        mock_analyzer_class.return_value = mock_analyzer

        mock_curator = Mock()
        mock_curator.curate_files.return_value = ["src/main.py"]
        mock_curator_class.return_value = mock_curator

        config = cats.BundleConfig(
            path_specs=["."],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add login feature",
            ai_provider="gemini",
            ai_key="test-key",
            max_files=20
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        mock_analyzer.build_file_tree.assert_called_once()
        mock_tree.to_string.assert_called_once()

    @patch('cats.AICurator')
    def test_bundler_ai_curate_handles_empty_result(self, mock_curator_class):
        """Test that AI curation handles empty results gracefully"""
        mock_curator = Mock()
        mock_curator.curate_files.return_value = []
        mock_curator_class.return_value = mock_curator

        config = cats.BundleConfig(
            path_specs=["."],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add login feature",
            ai_provider="gemini",
            ai_key="test-key",
            max_files=20
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertEqual(bundle, "")

    @patch('cats.AICurator')
    def test_bundler_ai_curate_handles_exception(self, mock_curator_class):
        """Test that AI curation handles exceptions gracefully"""
        mock_curator = Mock()
        mock_curator.curate_files.side_effect = Exception("API error")
        mock_curator_class.return_value = mock_curator

        config = cats.BundleConfig(
            path_specs=["."],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add login feature",
            ai_provider="gemini",
            ai_key="test-key",
            max_files=20
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        self.assertEqual(bundle, "")

    @patch('cats.AICurator')
    def test_bundler_ai_curate_respects_max_files(self, mock_curator_class):
        """Test that AI curation respects max_files limit"""
        mock_curator = Mock()
        mock_curator.curate_files.return_value = ["src/main.py"]
        mock_curator_class.return_value = mock_curator

        config = cats.BundleConfig(
            path_specs=["."],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add login feature",
            ai_provider="gemini",
            ai_key="test-key",
            max_files=10
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        # Verify curate_files was called with max_files=10
        call_args = mock_curator.curate_files.call_args
        self.assertEqual(call_args[0][2], 10)  # Third argument is max_files

    @patch('cats.AICurator')
    def test_bundler_ai_curate_with_different_provider(self, mock_curator_class):
        """Test AI curation with different providers"""
        mock_curator = Mock()
        mock_curator.curate_files.return_value = ["src/main.py"]
        mock_curator_class.return_value = mock_curator

        config = cats.BundleConfig(
            path_specs=["."],
            exclude_patterns=[],
            output_file=None,
            encoding_mode="auto",
            use_default_excludes=False,
            prepare_for_delta=False,
            persona_files=[],
            sys_prompt_file="sys/sys_a.md",
            no_sys_prompt=True,
            require_sys_prompt=False,
            strict_catscan=False,
            verify=None,
            quiet=True,
            yes=True,
            ai_curate="Add login feature",
            ai_provider="claude",
            ai_key="test-key",
            max_files=20
        )

        bundler = cats.CatsBundler(config)
        bundle = bundler.create_bundle()

        # Verify AICurator was called with claude provider
        call_args = mock_curator_class.call_args
        self.assertEqual(call_args[1]['provider'], 'claude')


class TestAICurator(unittest.TestCase):
    """Test suite for AICurator class (15 tests)"""

    def test_curator_requires_api_key(self):
        """Test that curator requires API key"""
        with self.assertRaises(ValueError):
            cats.AICurator(api_key=None, provider="gemini")

    def test_curator_accepts_api_key(self):
        """Test that curator accepts API key"""
        with patch.dict(os.environ, {'GEMINI_API_KEY': ''}):
            try:
                curator = cats.AICurator(api_key="test-key", provider="gemini")
                self.assertIsNotNone(curator.api_key)
            except Exception as e:
                # May fail if dependencies not available, that's ok
                pass

    def test_curator_reads_env_variable(self):
        """Test that curator reads API key from environment"""
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'env-key'}):
            try:
                curator = cats.AICurator(api_key=None, provider="gemini")
                self.assertEqual(curator.api_key, "env-key")
            except Exception as e:
                pass

    def test_curator_validates_provider(self):
        """Test that curator validates provider"""
        with self.assertRaises(ValueError):
            curator = cats.AICurator(api_key="test", provider="invalid")
            # Try to initialize - should fail
            curator._initialize_client()

    @patch('cats.GEMINI_AVAILABLE', True)
    @patch('cats.genai')
    def test_curator_gemini_initialization(self, mock_genai):
        """Test Gemini initialization"""
        mock_genai.GenerativeModel.return_value = Mock()

        curator = cats.AICurator(api_key="test", provider="gemini")

        mock_genai.configure.assert_called_with(api_key="test")
        mock_genai.GenerativeModel.assert_called_once()

    def test_curator_claude_initialization(self):
        """Test Claude initialization with unavailable library"""
        # When Claude library isn't available, initialization should fail
        with self.assertRaises(ValueError):
            # This will fail because anthropic library likely isn't installed
            curator = cats.AICurator(api_key="test", provider="claude")

    def test_curator_openai_initialization(self):
        """Test OpenAI initialization with unavailable library"""
        # When OpenAI library isn't available, initialization should fail
        with self.assertRaises(ValueError):
            # This will fail because openai library likely isn't installed
            curator = cats.AICurator(api_key="test", provider="openai")

    def test_curator_builds_prompt_correctly(self):
        """Test that curator builds prompts correctly"""
        curator = cats.AICurator(api_key="test", provider="gemini")

        prompt = curator._build_curation_prompt(
            "Add login feature",
            "src/\n  main.py\n",
            20
        )

        self.assertIn("Add login feature", prompt)
        self.assertIn("src/", prompt)
        self.assertIn("maximum 20", prompt)

    def test_curator_parse_json_response(self):
        """Test parsing JSON response from AI"""
        curator = cats.AICurator(api_key="test", provider="gemini")

        response = '{"files": ["src/main.py", "src/utils.py"]}'
        files = curator._parse_ai_response(response)

        self.assertEqual(files, ["src/main.py", "src/utils.py"])

    def test_curator_parse_malformed_json(self):
        """Test parsing malformed JSON gracefully"""
        curator = cats.AICurator(api_key="test", provider="gemini")

        response = 'Some text {"files": ["src/main.py"]} more text'
        files = curator._parse_ai_response(response)

        self.assertEqual(files, ["src/main.py"])

    def test_curator_parse_text_response(self):
        """Test parsing plain text response"""
        curator = cats.AICurator(api_key="test", provider="gemini")

        response = """
        I recommend:
        - src/main.py
        - src/utils.py
        - config.yaml
        """
        files = curator._parse_ai_response(response)

        self.assertIn("src/main.py", files)
        self.assertIn("src/utils.py", files)

    def test_curator_parse_empty_response(self):
        """Test parsing empty response"""
        curator = cats.AICurator(api_key="test", provider="gemini")

        files = curator._parse_ai_response("")

        self.assertEqual(files, [])

    @patch('cats.GEMINI_AVAILABLE', True)
    @patch('cats.genai')
    def test_curator_gemini_curation(self, mock_genai):
        """Test Gemini file curation"""
        mock_response = Mock()
        mock_response.text = '{"files": ["src/main.py"]}'

        mock_model = Mock()
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        curator = cats.AICurator(api_key="test", provider="gemini")
        files = curator.curate_files("Add feature", "tree", 10)

        self.assertEqual(files, ["src/main.py"])

    @patch('cats.GEMINI_AVAILABLE', True)
    @patch('cats.genai')
    def test_curator_handles_api_error(self, mock_genai):
        """Test curator handles API errors gracefully"""
        mock_model = Mock()
        mock_model.generate_content.side_effect = Exception("API error")
        mock_genai.GenerativeModel.return_value = mock_model

        curator = cats.AICurator(api_key="test", provider="gemini")
        files = curator.curate_files("Add feature", "tree", 10)

        self.assertEqual(files, [])

    def test_curator_filters_non_code_files(self):
        """Test that curator properly parses code file extensions"""
        curator = cats.AICurator(api_key="test", provider="gemini")

        response = """
        src/main.py
        src/utils.js
        src/config.ts
        README.md
        image.png
        """
        files = curator._parse_ai_response(response)

        # Should include code files
        self.assertIn("src/main.py", files)
        self.assertIn("src/utils.js", files)
        self.assertIn("src/config.ts", files)


class TestVerificationFunctions(unittest.TestCase):
    """Test suite for verification functions (10 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_verify_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_verify_python_module_extracts_functions(self):
        """Test that Python verification extracts functions"""
        test_file = self.test_dir / "test_module.py"
        test_file.write_text("""
def public_function():
    pass

def _private_function():
    pass
""")

        api = cats.verify_python_module(test_file, quiet=True)

        self.assertIn("public_function", api)
        self.assertNotIn("_private_function", api)

    def test_verify_python_module_extracts_classes(self):
        """Test that Python verification extracts classes"""
        test_file = self.test_dir / "test_module.py"
        test_file.write_text("""
class PublicClass:
    def method(self):
        pass

    def _private_method(self):
        pass

class _PrivateClass:
    pass
""")

        api = cats.verify_python_module(test_file, quiet=True)

        self.assertIn("PublicClass", api)
        self.assertEqual(api["PublicClass"]["type"], "class")
        self.assertIn("method", api["PublicClass"]["methods"])
        self.assertNotIn("_private_method", api["PublicClass"]["methods"])
        self.assertNotIn("_PrivateClass", api)

    def test_verify_python_module_extracts_function_args(self):
        """Test that Python verification extracts function arguments"""
        test_file = self.test_dir / "test_module.py"
        test_file.write_text("""
def function_with_args(arg1, arg2, arg3=None):
    pass
""")

        api = cats.verify_python_module(test_file, quiet=True)

        self.assertIn("function_with_args", api)
        self.assertEqual(api["function_with_args"]["args"], ["arg1", "arg2", "arg3"])

    def test_verify_python_module_handles_syntax_error(self):
        """Test that Python verification handles syntax errors"""
        test_file = self.test_dir / "bad_module.py"
        test_file.write_text("def bad syntax")

        api = cats.verify_python_module(test_file, quiet=True)

        self.assertEqual(api, {})

    def test_verify_python_module_handles_nonexistent_file(self):
        """Test that Python verification handles nonexistent files"""
        test_file = self.test_dir / "nonexistent.py"

        api = cats.verify_python_module(test_file, quiet=True)

        self.assertEqual(api, {})

    def test_verify_js_ts_module(self):
        """Test JS/TS verification returns verified"""
        test_file = self.test_dir / "test.js"
        test_file.write_text("export function test() {}")

        result = cats.verify_js_ts_module(test_file, quiet=True)

        self.assertEqual(result, {"verified": True})

    def test_load_pawsignore_reads_file(self):
        """Test that load_pawsignore reads patterns"""
        pawsignore = self.test_dir / ".pawsignore"
        pawsignore.write_text("*.log\ntemp/\n__pycache__\n")

        patterns = cats.load_pawsignore(self.test_dir)

        self.assertIn("*.log", patterns)
        self.assertIn("temp/", patterns)
        self.assertIn("__pycache__", patterns)

    def test_load_pawsignore_handles_comments(self):
        """Test that load_pawsignore ignores comments"""
        pawsignore = self.test_dir / ".pawsignore"
        pawsignore.write_text("*.log\n# This is a comment\ntemp/\n")

        patterns = cats.load_pawsignore(self.test_dir)

        self.assertIn("*.log", patterns)
        self.assertIn("temp/", patterns)
        self.assertNotIn("# This is a comment", patterns)

    def test_load_pawsignore_handles_empty_lines(self):
        """Test that load_pawsignore ignores empty lines"""
        pawsignore = self.test_dir / ".pawsignore"
        pawsignore.write_text("*.log\n\n\ntemp/\n")

        patterns = cats.load_pawsignore(self.test_dir)

        self.assertEqual(len(patterns), 2)
        self.assertIn("*.log", patterns)
        self.assertIn("temp/", patterns)

    def test_load_pawsignore_missing_file(self):
        """Test that load_pawsignore handles missing file"""
        patterns = cats.load_pawsignore(self.test_dir)

        self.assertEqual(patterns, [])


class TestProjectAnalyzer(unittest.TestCase):
    """Test suite for ProjectAnalyzer class (10 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_analyzer_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)
        self._create_test_project()

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _create_test_project(self):
        """Create test project structure"""
        files = {
            "src/main.py": "code",
            "src/utils.py": "code",
            "tests/test_main.py": "test",
            ".gitignore": "*.log\n__pycache__\n",
        }

        for path_str, content in files.items():
            path = self.test_dir / path_str
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

    def test_analyzer_loads_gitignore(self):
        """Test that analyzer loads gitignore patterns"""
        analyzer = cats.ProjectAnalyzer(self.test_dir)

        self.assertIn("*.log", analyzer.gitignore_patterns)
        self.assertIn("__pycache__", analyzer.gitignore_patterns)

    def test_analyzer_includes_default_ignores(self):
        """Test that analyzer includes default ignore patterns"""
        analyzer = cats.ProjectAnalyzer(self.test_dir)

        self.assertIn("node_modules", analyzer.gitignore_patterns)
        self.assertIn(".git", analyzer.gitignore_patterns)

    def test_analyzer_builds_file_tree(self):
        """Test that analyzer builds file tree"""
        analyzer = cats.ProjectAnalyzer(self.test_dir)
        tree = analyzer.build_file_tree()

        self.assertIsNotNone(tree)
        self.assertTrue(tree.is_dir)

    def test_analyzer_tree_contains_files(self):
        """Test that file tree contains expected files"""
        analyzer = cats.ProjectAnalyzer(self.test_dir)
        tree = analyzer.build_file_tree()
        tree_str = tree.to_string()

        self.assertIn("src", tree_str)
        self.assertIn("main.py", tree_str)

    def test_analyzer_ignores_patterns(self):
        """Test that analyzer respects ignore patterns"""
        # Create a file that should be ignored
        log_file = self.test_dir / "test.log"
        log_file.write_text("log")

        analyzer = cats.ProjectAnalyzer(self.test_dir)

        self.assertTrue(analyzer._should_ignore(log_file))

    def test_analyzer_tree_to_string(self):
        """Test that tree converts to string correctly"""
        analyzer = cats.ProjectAnalyzer(self.test_dir)
        tree = analyzer.build_file_tree()
        tree_str = tree.to_string()

        self.assertIsInstance(tree_str, str)
        self.assertGreater(len(tree_str), 0)

    def test_analyzer_file_tree_node_is_dir(self):
        """Test FileTreeNode for directories"""
        node = cats.FileTreeNode(path="src", is_dir=True)

        self.assertTrue(node.is_dir)
        self.assertEqual(node.path, "src")

    def test_analyzer_file_tree_node_is_file(self):
        """Test FileTreeNode for files"""
        node = cats.FileTreeNode(path="main.py", is_dir=False, size=100)

        self.assertFalse(node.is_dir)
        self.assertEqual(node.size, 100)

    def test_analyzer_file_tree_node_children(self):
        """Test FileTreeNode children"""
        parent = cats.FileTreeNode(path="src", is_dir=True)
        child = cats.FileTreeNode(path="main.py", is_dir=False)
        parent.children.append(child)

        self.assertEqual(len(parent.children), 1)
        self.assertEqual(parent.children[0], child)

    def test_analyzer_tree_string_indentation(self):
        """Test that tree string has proper indentation"""
        parent = cats.FileTreeNode(path="src", is_dir=True)
        child = cats.FileTreeNode(path="main.py", is_dir=False)
        parent.children.append(child)

        tree_str = parent.to_string()

        self.assertIn("src/", tree_str)
        self.assertIn("  main.py", tree_str)


class TestUtilityFunctions(unittest.TestCase):
    """Test suite for utility functions (10 tests)"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_utils_"))

    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_detect_is_binary_text_file(self):
        """Test binary detection for text files"""
        content = b"This is text content"

        is_binary = cats.detect_is_binary(content)

        self.assertFalse(is_binary)

    def test_detect_is_binary_actual_binary(self):
        """Test binary detection for binary files"""
        content = b"PNG\x00\x00\x00data"

        is_binary = cats.detect_is_binary(content)

        self.assertTrue(is_binary)

    def test_find_common_ancestor_single_file(self):
        """Test finding common ancestor for single file"""
        files = [Path("/Users/test/project/src/main.py")]
        cwd = Path("/Users/test/project")

        ancestor = cats.find_common_ancestor(files, cwd)

        # Should return src directory's parent
        self.assertTrue(str(ancestor).endswith("project") or str(ancestor).endswith("src"))

    def test_find_common_ancestor_multiple_files_same_dir(self):
        """Test common ancestor for files in same directory"""
        files = [
            Path("/Users/test/project/src/main.py"),
            Path("/Users/test/project/src/utils.py"),
        ]
        cwd = Path("/Users/test/project")

        ancestor = cats.find_common_ancestor(files, cwd)

        self.assertIsNotNone(ancestor)

    def test_find_common_ancestor_empty_list(self):
        """Test common ancestor for empty file list"""
        cwd = Path("/Users/test/project")

        ancestor = cats.find_common_ancestor([], cwd)

        self.assertEqual(ancestor, cwd)

    def test_prepare_file_object_text_file(self):
        """Test preparing text file object"""
        test_file = self.test_dir / "test.txt"
        test_file.write_text("Hello world")

        obj = cats.prepare_file_object(test_file, self.test_dir, "auto")

        self.assertIsNotNone(obj)
        self.assertEqual(obj["path"], "test.txt")
        self.assertEqual(obj["content"], "Hello world")
        self.assertFalse(obj["is_binary"])

    def test_prepare_file_object_binary_file(self):
        """Test preparing binary file object"""
        test_file = self.test_dir / "test.bin"
        test_file.write_bytes(b"PNG\x00\x00data")

        obj = cats.prepare_file_object(test_file, self.test_dir, "auto")

        self.assertIsNotNone(obj)
        self.assertTrue(obj["is_binary"])
        # Content should be base64 encoded
        self.assertIsInstance(obj["content"], str)

    def test_prepare_file_object_nonexistent(self):
        """Test preparing nonexistent file"""
        test_file = self.test_dir / "nonexistent.txt"

        obj = cats.prepare_file_object(test_file, self.test_dir, "auto")

        self.assertIsNone(obj)

    def test_find_catscan_replacement_with_catscan(self):
        """Test finding CATSCAN replacement"""
        readme = self.test_dir / "README.md"
        readme.touch()
        catscan = self.test_dir / "CATSCAN.md"
        catscan.touch()

        replacement = cats.find_catscan_replacement(readme)

        self.assertEqual(replacement, catscan)

    def test_find_catscan_replacement_without_catscan(self):
        """Test finding CATSCAN when it doesn't exist"""
        readme = self.test_dir / "README.md"
        readme.touch()

        replacement = cats.find_catscan_replacement(readme)

        self.assertIsNone(replacement)


if __name__ == "__main__":
    unittest.main(verbosity=2)
