#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for paws_paxos.py
Tests CompetitorConfig, CompetitionResult, LLMClient, and PaxosOrchestrator
"""

import unittest
import os
import sys
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import patch, Mock, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

import paws_paxos
from paws_paxos import (
    CompetitorConfig, CompetitionResult, LLMClient, PaxosOrchestrator
)


class TestCompetitorConfig(unittest.TestCase):
    """Test CompetitorConfig dataclass"""

    def test_competitor_config_defaults(self):
        """Test CompetitorConfig with defaults"""
        config = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro"
        )

        self.assertEqual(config.name, "Test Agent")
        self.assertEqual(config.model_id, "gemini-pro")
        self.assertIsNone(config.persona_file)
        self.assertIsNone(config.api_key)
        self.assertEqual(config.provider, "gemini")
        self.assertEqual(config.temperature, 0.7)
        self.assertEqual(config.max_tokens, 4000)

    def test_competitor_config_custom(self):
        """Test CompetitorConfig with custom values"""
        config = CompetitorConfig(
            name="Claude Agent",
            model_id="claude-3-sonnet-20240229",
            persona_file="persona.md",
            api_key="sk-test-123",
            provider="claude",
            temperature=0.5,
            max_tokens=8000
        )

        self.assertEqual(config.name, "Claude Agent")
        self.assertEqual(config.provider, "claude")
        self.assertEqual(config.temperature, 0.5)
        self.assertEqual(config.max_tokens, 8000)
        self.assertEqual(config.api_key, "sk-test-123")


class TestCompetitionResult(unittest.TestCase):
    """Test CompetitionResult dataclass"""

    def test_competition_result_pass(self):
        """Test CompetitionResult for passing solution"""
        result = CompetitionResult(
            name="Agent1",
            model_id="gemini-pro",
            solution_path="/path/to/solution",
            status="PASS",
            verification_output="All tests passed",
            execution_time=2.5,
            token_count=1500
        )

        self.assertEqual(result.name, "Agent1")
        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.execution_time, 2.5)
        self.assertEqual(result.token_count, 1500)
        self.assertIsNone(result.error_message)

    def test_competition_result_fail(self):
        """Test CompetitionResult for failing solution"""
        result = CompetitionResult(
            name="Agent2",
            model_id="gpt-4",
            solution_path="/path/to/solution",
            status="FAIL",
            verification_output="2 tests failed",
            error_message="Syntax error on line 10"
        )

        self.assertEqual(result.status, "FAIL")
        self.assertIsNotNone(result.error_message)


class TestLLMClient(unittest.TestCase):
    """Test LLMClient class"""

    def test_llm_client_missing_api_key(self):
        """Test LLMClient with missing API key (lines 80-83)"""
        config = CompetitorConfig(
            name="Test",
            model_id="gemini-pro",
            provider="gemini"
        )

        # Ensure no API key in environment
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ValueError) as cm:
                client = LLMClient(config)

            self.assertIn("No API key found", str(cm.exception))

    def test_llm_client_unknown_provider(self):
        """Test LLMClient with unknown provider (line 102)"""
        config = CompetitorConfig(
            name="Test",
            model_id="unknown-model",
            provider="unknown",
            api_key="test_key"
        )

        with self.assertRaises(ValueError) as cm:
            client = LLMClient(config)

        self.assertIn("Unknown provider", str(cm.exception))

    def test_llm_client_gemini_not_available(self):
        """Test LLMClient when Gemini is not installed (lines 86-87)"""
        config = CompetitorConfig(
            name="Test",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        with patch('paws_paxos.GEMINI_AVAILABLE', False):
            with self.assertRaises(ImportError) as cm:
                client = LLMClient(config)

            self.assertIn("google-generativeai not installed", str(cm.exception))

    def test_llm_client_claude_not_available(self):
        """Test LLMClient when Claude is not installed (lines 92-93)"""
        config = CompetitorConfig(
            name="Test",
            model_id="claude-3-sonnet-20240229",
            provider="claude",
            api_key="test_key"
        )

        with patch('paws_paxos.CLAUDE_AVAILABLE', False):
            with self.assertRaises(ImportError) as cm:
                client = LLMClient(config)

            self.assertIn("anthropic not installed", str(cm.exception))

    def test_llm_client_openai_not_available(self):
        """Test LLMClient when OpenAI is not installed (lines 97-98)"""
        config = CompetitorConfig(
            name="Test",
            model_id="gpt-4",
            provider="openai",
            api_key="test_key"
        )

        with patch('paws_paxos.OPENAI_AVAILABLE', False):
            with self.assertRaises(ImportError) as cm:
                client = LLMClient(config)

            self.assertIn("openai not installed", str(cm.exception))

    def test_llm_client_api_key_from_env(self):
        """Test LLMClient getting API key from environment (line 80)"""
        config = CompetitorConfig(
            name="Test",
            model_id="gemini-pro",
            provider="gemini"
        )

        with patch.dict('os.environ', {'GEMINI_API_KEY': 'env_key'}):
            with patch('paws_paxos.GEMINI_AVAILABLE', True):
                with patch('paws_paxos.genai') as mock_genai:
                    mock_genai.GenerativeModel.return_value = Mock()

                    client = LLMClient(config)

                    # Should configure with env key
                    mock_genai.configure.assert_called_once_with(api_key='env_key')

    def test_generate_gemini(self):
        """Test generate with Gemini (lines 116-128)"""
        config = CompetitorConfig(
            name="Test",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        with patch('paws_paxos.GEMINI_AVAILABLE', True):
            with patch('paws_paxos.genai') as mock_genai:
                # Mock Gemini response
                mock_response = Mock()
                mock_response.text = "Test response from Gemini"

                mock_model = Mock()
                mock_model.generate_content.return_value = mock_response
                mock_genai.GenerativeModel.return_value = mock_model
                mock_genai.types.GenerationConfig = Mock

                client = LLMClient(config)
                text, token_count = client.generate("Test prompt")

                self.assertEqual(text, "Test response from Gemini")
                self.assertGreater(token_count, 0)
                mock_model.generate_content.assert_called_once()


class TestPaxosOrchestrator(unittest.TestCase):
    """Test PaxosOrchestrator class"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paxos_test_"))

        # Create test context bundle
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("""
# Test Context Bundle
This is test context for the orchestrator
""")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_orchestrator_initialization(self):
        """Test PaxosOrchestrator initialization (lines 160-170)"""
        orchestrator = PaxosOrchestrator(
            task="Implement feature X",
            context_bundle=str(self.context_file),
            verify_cmd="pytest",
            output_dir=str(self.test_dir / "output")
        )

        self.assertEqual(orchestrator.task, "Implement feature X")
        self.assertEqual(orchestrator.verify_cmd, "pytest")
        self.assertTrue((self.test_dir / "output").exists())
        self.assertIn("Test Context Bundle", orchestrator.context_content)

    def test_orchestrator_without_verify_cmd(self):
        """Test PaxosOrchestrator without verification command"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        self.assertIsNone(orchestrator.verify_cmd)

    def test_load_competitors_from_json(self):
        """Test loading competitors from JSON (lines 172-179)"""
        # Create competitors config file
        config_file = self.test_dir / "competitors.json"
        config_data = {
            "competitors": [
                {
                    "name": "Gemini Agent",
                    "model_id": "gemini-pro",
                    "provider": "gemini"
                },
                {
                    "name": "Claude Agent",
                    "model_id": "claude-3-sonnet-20240229",
                    "provider": "claude"
                }
            ]
        }
        config_file.write_text(json.dumps(config_data))

        orchestrator = PaxosOrchestrator(
            task="Test",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitors = orchestrator.load_competitors(str(config_file))

        # Should load both competitors
        self.assertEqual(len(competitors), 2)
        self.assertEqual(competitors[0].name, "Gemini Agent")
        self.assertEqual(competitors[1].name, "Claude Agent")

    def test_load_competitors_empty_file(self):
        """Test loading competitors from empty config"""
        config_file = self.test_dir / "empty.json"
        config_file.write_text('{"competitors": []}')

        orchestrator = PaxosOrchestrator(
            task="Test",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitors = orchestrator.load_competitors(str(config_file))

        self.assertEqual(len(competitors), 0)


class TestPaxosRunCompetitor(unittest.TestCase):
    """Test run_competitor method (lines 235-290)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paxos_competitor_"))
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("# Test context")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_run_competitor_success_with_verification(self):
        """Test successful competitor run with verification (lines 237-283)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd="echo VERIFICATION PASSED",
            output_dir=str(self.test_dir / "output")
        )

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        # Mock LLMClient
        with patch('paws_paxos.LLMClient') as mock_llm:
            mock_client = Mock()
            mock_client.generate.return_value = ("Solution code", 100)
            mock_llm.return_value = mock_client

            # Mock verify_solution
            with patch.object(orchestrator, 'verify_solution', return_value="VERIFICATION PASSED"):
                with patch('sys.stdout', new=MagicMock()):
                    result = orchestrator.run_competitor(competitor)

        # Check result
        self.assertEqual(result.name, "Test Agent")
        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.token_count, 100)
        self.assertGreater(result.execution_time, 0)

    def test_run_competitor_verification_failed(self):
        """Test competitor run with failed verification (lines 265-268)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd="pytest",
            output_dir=str(self.test_dir / "output")
        )

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        # Mock LLMClient
        with patch('paws_paxos.LLMClient') as mock_llm:
            mock_client = Mock()
            mock_client.generate.return_value = ("Solution code", 100)
            mock_llm.return_value = mock_client

            # Mock verify_solution to return failure
            with patch.object(orchestrator, 'verify_solution', return_value="Tests failed"):
                with patch('sys.stdout', new=MagicMock()):
                    result = orchestrator.run_competitor(competitor)

        # Should be FAIL
        self.assertEqual(result.status, "FAIL")

    def test_run_competitor_no_verification(self):
        """Test competitor run without verification (lines 269-271)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        # Mock LLMClient
        with patch('paws_paxos.LLMClient') as mock_llm:
            mock_client = Mock()
            mock_client.generate.return_value = ("Solution code", 100)
            mock_llm.return_value = mock_client

            with patch('sys.stdout', new=MagicMock()):
                result = orchestrator.run_competitor(competitor)

        # Should pass without verification
        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.verification_output, "No verification requested")

    def test_run_competitor_exception(self):
        """Test competitor run with exception (lines 285-290)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        # Mock LLMClient to raise exception
        with patch('paws_paxos.LLMClient') as mock_llm:
            mock_llm.side_effect = Exception("API error")

            with patch('sys.stdout', new=MagicMock()):
                result = orchestrator.run_competitor(competitor)

        # Should return ERROR status
        self.assertEqual(result.status, "ERROR")
        self.assertIn("API error", result.error_message)


class TestPaxosVerification(unittest.TestCase):
    """Test verify_solution method (lines 302-373)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paxos_verify_"))
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("# Test context")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_verify_solution_worktree_creation_failed(self):
        """Test verification when worktree creation fails (lines 317-318)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd="pytest",
            output_dir=str(self.test_dir / "output")
        )

        solution_path = self.test_dir / "solution.dogs.md"
        solution_path.write_text("test")

        # Mock subprocess to fail worktree creation
        with patch('subprocess.run') as mock_run:
            mock_result = Mock()
            mock_result.returncode = 1
            mock_result.stderr = "Worktree error"
            mock_run.return_value = mock_result

            with patch('sys.stdout', new=MagicMock()):
                output = orchestrator.verify_solution("TestAgent", solution_path)

        # Should indicate failure
        self.assertIn("VERIFICATION FAILED", output)
        self.assertIn("worktree", output.lower())


class TestPaxosRunCompetition(unittest.TestCase):
    """Test run_competition method (lines 375-397)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paxos_comp_"))
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("# Test context")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_run_competition_sequential(self):
        """Test sequential competition execution (lines 391-395)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitors = [
            CompetitorConfig(name="Agent1", model_id="gemini-pro", api_key="key1"),
            CompetitorConfig(name="Agent2", model_id="gemini-pro", api_key="key2")
        ]

        # Mock run_competitor
        mock_results = [
            CompetitionResult(name="Agent1", model_id="gemini-pro", solution_path="/path1", status="PASS"),
            CompetitionResult(name="Agent2", model_id="gemini-pro", solution_path="/path2", status="PASS")
        ]

        with patch.object(orchestrator, 'run_competitor', side_effect=mock_results):
            with patch('sys.stdout', new=MagicMock()):
                results = orchestrator.run_competition(competitors, parallel=False)

        # Should return both results
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].name, "Agent1")
        self.assertEqual(results[1].name, "Agent2")

    def test_run_competition_parallel(self):
        """Test parallel competition execution (lines 380-390)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitors = [
            CompetitorConfig(name="Agent1", model_id="gemini-pro", api_key="key1"),
            CompetitorConfig(name="Agent2", model_id="gemini-pro", api_key="key2")
        ]

        # Mock run_competitor
        mock_result = CompetitionResult(
            name="TestAgent", model_id="gemini-pro", solution_path="/path", status="PASS"
        )

        with patch.object(orchestrator, 'run_competitor', return_value=mock_result):
            with patch('sys.stdout', new=MagicMock()):
                results = orchestrator.run_competition(competitors, parallel=True)

        # Should return results for both (parallel)
        self.assertEqual(len(results), 2)

    def test_run_competition_single_competitor_parallel(self):
        """Test parallel with single competitor (line 380 check)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        competitors = [
            CompetitorConfig(name="Agent1", model_id="gemini-pro", api_key="key1")
        ]

        mock_result = CompetitionResult(
            name="Agent1", model_id="gemini-pro", solution_path="/path", status="PASS"
        )

        with patch.object(orchestrator, 'run_competitor', return_value=mock_result):
            with patch('sys.stdout', new=MagicMock()):
                # With parallel=True but only 1 competitor, should run sequentially
                results = orchestrator.run_competition(competitors, parallel=True)

        self.assertEqual(len(results), 1)


class TestPaxosGenerateReport(unittest.TestCase):
    """Test generate_report method (lines 399-446)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paxos_report_"))
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("# Test context")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_generate_report_all_pass(self):
        """Test report generation with all passing (lines 432, 437-446)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "output")
        )

        results = [
            CompetitionResult(
                name="Agent1",
                model_id="gemini-pro",
                solution_path="/path1",
                status="PASS",
                execution_time=2.5,
                token_count=1000
            ),
            CompetitionResult(
                name="Agent2",
                model_id="gpt-4",
                solution_path="/path2",
                status="PASS",
                execution_time=3.0,
                token_count=1500
            )
        ]

        with patch('sys.stdout', new=MagicMock()):
            exit_code = orchestrator.generate_report(results)

        # Should return 0 (success)
        self.assertEqual(exit_code, 0)

    def test_generate_report_all_fail(self):
        """Test report generation with no passing (lines 432-436)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd="pytest",
            output_dir=str(self.test_dir / "output")
        )

        results = [
            CompetitionResult(
                name="Agent1",
                model_id="gemini-pro",
                solution_path="/path1",
                status="FAIL",
                execution_time=2.5,
                token_count=1000
            ),
            CompetitionResult(
                name="Agent2",
                model_id="gpt-4",
                solution_path="",
                status="ERROR",
                error_message="API error",
                execution_time=1.0,
                token_count=0
            )
        ]

        with patch('sys.stdout', new=MagicMock()):
            exit_code = orchestrator.generate_report(results)

        # Should return 1 (failure)
        self.assertEqual(exit_code, 1)

    def test_generate_report_mixed_results(self):
        """Test report with mixed pass/fail/error (lines 405-429)"""
        orchestrator = PaxosOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            verify_cmd="pytest",
            output_dir=str(self.test_dir / "output")
        )

        results = [
            CompetitionResult(
                name="Agent1",
                model_id="gemini-pro",
                solution_path="/path1",
                status="PASS",
                execution_time=2.5,
                token_count=1000
            ),
            CompetitionResult(
                name="Agent2",
                model_id="gpt-4",
                solution_path="/path2",
                status="FAIL",
                execution_time=3.0,
                token_count=1500
            ),
            CompetitionResult(
                name="Agent3",
                model_id="claude-3",
                solution_path="",
                status="ERROR",
                error_message="Timeout",
                execution_time=5.0,
                token_count=500
            )
        ]

        with patch('sys.stdout', new=MagicMock()):
            exit_code = orchestrator.generate_report(results)

        # Should return 0 (at least one passed)
        self.assertEqual(exit_code, 0)


class TestPaxosEdgeCases(unittest.TestCase):
    """Test edge cases"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paxos_edge_"))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_orchestrator_with_empty_context(self):
        """Test orchestrator with empty context"""
        context_file = self.test_dir / "empty.md"
        context_file.write_text("")

        orchestrator = PaxosOrchestrator(
            task="Test",
            context_bundle=str(context_file),
            verify_cmd=None,
            output_dir=str(self.test_dir / "out")
        )

        self.assertEqual(orchestrator.context_content, "")

    def test_competitor_config_with_persona(self):
        """Test CompetitorConfig with persona file"""
        config = CompetitorConfig(
            name="Agent with Persona",
            model_id="gemini-pro",
            persona_file="/path/to/persona.md"
        )

        self.assertEqual(config.persona_file, "/path/to/persona.md")

    def test_competition_result_with_defaults(self):
        """Test CompetitionResult default values"""
        result = CompetitionResult(
            name="Agent",
            model_id="gemini-pro",
            solution_path="/path",
            status="ERROR"
        )

        self.assertEqual(result.verification_output, "")
        self.assertEqual(result.execution_time, 0.0)
        self.assertEqual(result.token_count, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
