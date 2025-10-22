#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test suite for paws_arena.py
"""

import unittest
import tempfile
import json
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open
import sys
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from paws.arena import (
    CompetitorConfig,
    CompetitionResult,
    LLMClient,
    ArenaOrchestrator,
    GEMINI_AVAILABLE,
    CLAUDE_AVAILABLE,
    OPENAI_AVAILABLE
)


class TestCompetitorConfig(unittest.TestCase):
    """Test CompetitorConfig dataclass"""

    def test_create_basic_config(self):
        """Test creating a basic competitor configuration"""
        config = CompetitorConfig(
            name="Agent1",
            model_id="gemini-pro"
        )
        self.assertEqual(config.name, "Agent1")
        self.assertEqual(config.model_id, "gemini-pro")
        self.assertEqual(config.provider, "gemini")
        self.assertEqual(config.temperature, 0.7)
        self.assertEqual(config.max_tokens, 4000)

    def test_create_full_config(self):
        """Test creating a full configuration with all parameters"""
        config = CompetitorConfig(
            name="Claude",
            model_id="claude-3-opus",
            persona_file="/path/to/persona.txt",
            api_key="test-key",
            provider="claude",
            temperature=0.9,
            max_tokens=8000
        )
        self.assertEqual(config.provider, "claude")
        self.assertEqual(config.temperature, 0.9)
        self.assertEqual(config.max_tokens, 8000)
        self.assertEqual(config.api_key, "test-key")


class TestCompetitionResult(unittest.TestCase):
    """Test CompetitionResult dataclass"""

    def test_create_pass_result(self):
        """Test creating a passing result"""
        result = CompetitionResult(
            name="Agent1",
            model_id="gemini-pro",
            solution_path="/tmp/solution.md",
            status="PASS",
            verification_output="All tests passed",
            execution_time=5.2,
            token_count=1500
        )
        self.assertEqual(result.status, "PASS")
        self.assertIsNone(result.error_message)
        self.assertEqual(result.token_count, 1500)

    def test_create_fail_result(self):
        """Test creating a failing result"""
        result = CompetitionResult(
            name="Agent2",
            model_id="gpt-4",
            solution_path="/tmp/solution2.md",
            status="FAIL",
            verification_output="Test failed",
            error_message="Syntax error in generated code"
        )
        self.assertEqual(result.status, "FAIL")
        self.assertIsNotNone(result.error_message)


class TestLLMClient(unittest.TestCase):
    """Test LLMClient class"""

    def test_init_without_api_key_raises_error(self):
        """Test that initialization without API key raises error"""
        config = CompetitorConfig(
            name="Test",
            model_id="gemini-pro"
        )
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError) as context:
                LLMClient(config)
            self.assertIn("No API key", str(context.exception))

    @unittest.skipIf(not GEMINI_AVAILABLE, "Gemini not available")
    def test_init_gemini_client(self):
        """Test Gemini client initialization"""
        config = CompetitorConfig(
            name="Gemini",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test-key"
        )
        with patch('paws.arena.genai.configure'):
            with patch('paws.arena.genai.GenerativeModel') as mock_model:
                client = LLMClient(config)
                mock_model.assert_called_once_with("gemini-pro")

    def test_init_claude_without_lib_raises_error(self):
        """Test Claude initialization without library raises error"""
        config = CompetitorConfig(
            name="Claude",
            model_id="claude-3",
            provider="claude",
            api_key="test-key"
        )
        if not CLAUDE_AVAILABLE:
            with self.assertRaises(ImportError) as context:
                LLMClient(config)
            self.assertIn("anthropic not installed", str(context.exception))

    def test_generate_with_mock(self):
        """Test generate method with mocked LLM"""
        config = CompetitorConfig(
            name="Test",
            model_id="gemini-pro",
            api_key="test-key"
        )

        with patch('paws.arena.genai.configure'):
            with patch('paws.arena.genai.GenerativeModel') as mock_model_class:
                mock_client = MagicMock()
                mock_response = MagicMock()
                mock_response.text = "Generated solution"
                mock_client.generate_content.return_value = mock_response
                mock_model_class.return_value = mock_client

                client = LLMClient(config)
                text, tokens = client.generate("Test prompt")

                self.assertEqual(text, "Generated solution")
                # Token count is estimated as len(text.split()) * 1.3
                self.assertGreater(tokens, 0)


class TestArenaOrchestrator(unittest.TestCase):
    """Test ArenaOrchestrator class"""

    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="paws_arena_test_"))

        # Create a test context bundle
        self.context_file = self.temp_dir / "context.md"
        self.context_file.write_text("Test context content")

        # Create test config file
        self.config_data = {
            "competitors": [
                {
                    "name": "Agent1",
                    "model_id": "gemini-pro",
                    "provider": "gemini"
                },
                {
                    "name": "Agent2",
                    "model_id": "claude-3-opus"
                }
            ]
        }
        self.config_file = self.temp_dir / "competitors.json"
        self.config_file.write_text(json.dumps(self.config_data))

        self.output_dir = self.temp_dir / "output"
        self.orchestrator = ArenaOrchestrator(
            task="Write a hello world function",
            context_bundle=str(self.context_file),
            verify_cmd="python -m pytest",
            output_dir=str(self.output_dir)
        )

    def tearDown(self):
        """Clean up test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_init_creates_output_dir(self):
        """Test that initialization creates output directory"""
        self.assertTrue(self.output_dir.exists())

    def test_load_competitors(self):
        """Test loading competitors from config file"""
        competitors = self.orchestrator.load_competitors(str(self.config_file))
        self.assertEqual(len(competitors), 2)
        self.assertEqual(competitors[0].name, "Agent1")
        self.assertEqual(competitors[0].provider, "gemini")
        self.assertEqual(competitors[1].name, "Agent2")
        self.assertEqual(competitors[1].provider, "claude")

    def test_load_competitors_infers_provider(self):
        """Test that provider is inferred from model_id"""
        competitors = self.orchestrator.load_competitors(str(self.config_file))
        # Agent2 has "claude" in model_id but no explicit provider
        self.assertEqual(competitors[1].provider, "claude")

    def test_build_prompt_basic(self):
        """Test building a basic prompt"""
        competitor = CompetitorConfig(name="Test", model_id="test-model")
        prompt = self.orchestrator.build_prompt(competitor)

        self.assertIn("TASK", prompt)
        self.assertIn("Write a hello world function", prompt)
        self.assertIn("CONTEXT", prompt)
        self.assertIn("Test context content", prompt)
        self.assertIn("INSTRUCTIONS", prompt)
        self.assertIn("DOGS_START_FILE", prompt)

    def test_build_prompt_with_persona(self):
        """Test building prompt with persona file"""
        persona_file = self.temp_dir / "persona.txt"
        persona_file.write_text("You are a helpful coding assistant.")

        competitor = CompetitorConfig(
            name="Test",
            model_id="test-model",
            persona_file=str(persona_file)
        )
        prompt = self.orchestrator.build_prompt(competitor)

        self.assertIn("helpful coding assistant", prompt)

    def test_run_competition_structure(self):
        """Test the structure of run_competition method"""
        # This test just verifies the method exists and has expected signature
        self.assertTrue(hasattr(self.orchestrator, 'run_competition'))
        self.assertTrue(callable(self.orchestrator.run_competition))

    def test_generate_report_structure(self):
        """Test the structure of generate_report method"""
        # This test just verifies the method exists
        self.assertTrue(hasattr(self.orchestrator, 'generate_report'))
        self.assertTrue(callable(self.orchestrator.generate_report))


class TestIntegration(unittest.TestCase):
    """Integration tests for paws_arena"""

    def test_full_workflow_dry_run(self):
        """Test a complete workflow without actual LLM calls"""
        with tempfile.TemporaryDirectory(prefix="paws_arena_integration_") as temp_dir:
            temp_path = Path(temp_dir)

            # Create context
            context_file = temp_path / "context.md"
            context_file.write_text("# Test Project\nSome context")

            # Create config
            config_file = temp_path / "config.json"
            config_data = {
                "competitors": [
                    {"name": "TestAgent", "model_id": "gemini-pro"}
                ]
            }
            config_file.write_text(json.dumps(config_data))

            # Create orchestrator
            output_dir = temp_path / "output"
            orchestrator = ArenaOrchestrator(
                task="Test task",
                context_bundle=str(context_file),
                verify_cmd=None,
                output_dir=str(output_dir)
            )

            # Verify setup
            self.assertTrue(output_dir.exists())
            self.assertEqual(orchestrator.task, "Test task")

            # Load competitors
            competitors = orchestrator.load_competitors(str(config_file))
            self.assertEqual(len(competitors), 1)
            self.assertEqual(competitors[0].name, "TestAgent")


def suite():
    """Create test suite"""
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestCompetitorConfig))
    suite.addTests(loader.loadTestsFromTestCase(TestCompetitionResult))
    suite.addTests(loader.loadTestsFromTestCase(TestLLMClient))
    suite.addTests(loader.loadTestsFromTestCase(TestArenaOrchestrator))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))

    return suite


if __name__ == '__main__':
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())
