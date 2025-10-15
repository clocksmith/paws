#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for paws_benchmark.py
Tests PerformanceBenchmark class and related functionality
"""

import unittest
import os
import sys
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import patch, Mock, MagicMock
from dataclasses import asdict

sys.path.insert(0, str(Path(__file__).parent.parent))

import paws_benchmark
from paws_benchmark import (
    BenchmarkMetrics, BenchmarkSuite, PerformanceBenchmark
)
from paws_paxos import CompetitorConfig, CompetitionResult


class TestBenchmarkMetrics(unittest.TestCase):
    """Test BenchmarkMetrics dataclass"""

    def test_benchmark_metrics_creation(self):
        """Test creating BenchmarkMetrics"""
        metrics = BenchmarkMetrics(
            model_name="Gemini Pro",
            model_id="gemini-pro",
            provider="gemini",
            execution_time=2.5,
            token_count=1500,
            test_passed=True,
            solution_quality=1.0,
            estimated_cost=0.00375,
            error_rate=0.0
        )

        self.assertEqual(metrics.model_name, "Gemini Pro")
        self.assertEqual(metrics.model_id, "gemini-pro")
        self.assertTrue(metrics.test_passed)
        self.assertEqual(metrics.solution_quality, 1.0)
        self.assertEqual(metrics.error_rate, 0.0)


class TestBenchmarkSuite(unittest.TestCase):
    """Test BenchmarkSuite dataclass"""

    def test_benchmark_suite_creation(self):
        """Test creating BenchmarkSuite"""
        tasks = [
            {
                "task": "Implement feature X",
                "context_bundle": "context1.md",
                "verify_cmd": "pytest"
            },
            {
                "task": "Fix bug Y",
                "context_bundle": "context2.md",
                "verify_cmd": "npm test"
            }
        ]

        suite = BenchmarkSuite(
            name="Test Suite",
            description="Test suite description",
            tasks=tasks
        )

        self.assertEqual(suite.name, "Test Suite")
        self.assertEqual(len(suite.tasks), 2)
        self.assertEqual(suite.tasks[0]["task"], "Implement feature X")


class TestPerformanceBenchmark(unittest.TestCase):
    """Test PerformanceBenchmark class"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="benchmark_test_"))
        self.benchmark = PerformanceBenchmark(
            output_dir=str(self.test_dir / "benchmarks")
        )

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_benchmark_initialization(self):
        """Test PerformanceBenchmark initialization"""
        self.assertTrue(self.benchmark.output_dir.exists())
        self.assertIn("gemini-pro", self.benchmark.cost_per_1k_tokens)
        self.assertIn("claude-3-sonnet-20240229", self.benchmark.cost_per_1k_tokens)
        self.assertIn("gpt-4", self.benchmark.cost_per_1k_tokens)

    def test_estimate_cost_known_model(self):
        """Test cost estimation for known models (lines 64-67)"""
        # Test Gemini Pro
        cost = self.benchmark.estimate_cost("gemini-pro", 1000)
        self.assertEqual(cost, 0.00025)

        # Test Claude
        cost = self.benchmark.estimate_cost("claude-3-sonnet-20240229", 1000)
        self.assertEqual(cost, 0.003)

        # Test GPT-4
        cost = self.benchmark.estimate_cost("gpt-4", 1000)
        self.assertEqual(cost, 0.03)

    def test_estimate_cost_unknown_model(self):
        """Test cost estimation for unknown models (fallback)"""
        cost = self.benchmark.estimate_cost("unknown-model", 1000)
        self.assertEqual(cost, 0.001)  # Default fallback

    def test_estimate_cost_calculation(self):
        """Test cost calculation formula"""
        # 5000 tokens at $0.001 per 1k tokens = $0.005
        cost = self.benchmark.estimate_cost("unknown-model", 5000)
        self.assertEqual(cost, 0.005)

    def test_get_provider_gemini(self):
        """Test provider inference for Gemini (lines 112-121)"""
        provider = self.benchmark._get_provider("gemini-pro")
        self.assertEqual(provider, "gemini")

        provider = self.benchmark._get_provider("GEMINI-1.5-PRO")
        self.assertEqual(provider, "gemini")

    def test_get_provider_claude(self):
        """Test provider inference for Claude"""
        provider = self.benchmark._get_provider("claude-3-sonnet-20240229")
        self.assertEqual(provider, "claude")

        provider = self.benchmark._get_provider("CLAUDE-3-OPUS")
        self.assertEqual(provider, "claude")

    def test_get_provider_openai(self):
        """Test provider inference for OpenAI"""
        provider = self.benchmark._get_provider("gpt-4-turbo-preview")
        self.assertEqual(provider, "openai")

        provider = self.benchmark._get_provider("GPT-3.5-TURBO")
        self.assertEqual(provider, "openai")

    def test_get_provider_unknown(self):
        """Test provider inference for unknown model"""
        provider = self.benchmark._get_provider("unknown-model-xyz")
        self.assertEqual(provider, "unknown")

    def test_run_benchmark_single_competitor(self):
        """Test running benchmark with single competitor (lines 69-110)"""
        # Create test context file
        context_file = self.test_dir / "context.md"
        context_file.write_text("# Test context")

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        # Mock PaxosOrchestrator
        with patch('paws_benchmark.PaxosOrchestrator') as mock_paxos:
            # Mock competition results
            mock_result = CompetitionResult(
                name="Test Agent",
                model_id="gemini-pro",
                solution_path="/path/to/solution",
                status="PASS",
                verification_output="All tests passed",
                execution_time=2.5,
                token_count=1500
            )

            mock_orchestrator = Mock()
            mock_orchestrator.run_competition.return_value = [mock_result]
            mock_paxos.return_value = mock_orchestrator

            # Run benchmark
            metrics = self.benchmark.run_benchmark(
                competitors=[competitor],
                task="Test task",
                context_bundle=str(context_file),
                verify_cmd="pytest"
            )

            # Verify results
            self.assertEqual(len(metrics), 1)
            self.assertEqual(metrics[0].model_name, "Test Agent")
            self.assertEqual(metrics[0].model_id, "gemini-pro")
            self.assertTrue(metrics[0].test_passed)
            self.assertEqual(metrics[0].solution_quality, 1.0)
            self.assertEqual(metrics[0].error_rate, 0.0)
            self.assertGreater(metrics[0].estimated_cost, 0)

    def test_run_benchmark_failed_test(self):
        """Test benchmark with failed test (lines 87-94)"""
        context_file = self.test_dir / "context.md"
        context_file.write_text("# Test context")

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        with patch('paws_benchmark.PaxosOrchestrator') as mock_paxos:
            mock_result = CompetitionResult(
                name="Test Agent",
                model_id="gemini-pro",
                solution_path="/path/to/solution",
                status="FAIL",
                verification_output="2 tests failed",
                execution_time=1.5,
                token_count=1000
            )

            mock_orchestrator = Mock()
            mock_orchestrator.run_competition.return_value = [mock_result]
            mock_paxos.return_value = mock_orchestrator

            metrics = self.benchmark.run_benchmark(
                competitors=[competitor],
                task="Test task",
                context_bundle=str(context_file),
                verify_cmd="pytest"
            )

            self.assertEqual(len(metrics), 1)
            self.assertFalse(metrics[0].test_passed)
            self.assertEqual(metrics[0].solution_quality, 0.0)
            self.assertEqual(metrics[0].error_rate, 0.0)

    def test_run_benchmark_error_status(self):
        """Test benchmark with error status (line 93)"""
        context_file = self.test_dir / "context.md"
        context_file.write_text("# Test context")

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        with patch('paws_benchmark.PaxosOrchestrator') as mock_paxos:
            mock_result = CompetitionResult(
                name="Test Agent",
                model_id="gemini-pro",
                solution_path="/path/to/solution",
                status="ERROR",
                verification_output="",
                error_message="Syntax error",
                execution_time=0.5,
                token_count=500
            )

            mock_orchestrator = Mock()
            mock_orchestrator.run_competition.return_value = [mock_result]
            mock_paxos.return_value = mock_orchestrator

            metrics = self.benchmark.run_benchmark(
                competitors=[competitor],
                task="Test task",
                context_bundle=str(context_file),
                verify_cmd="pytest"
            )

            self.assertEqual(len(metrics), 1)
            self.assertFalse(metrics[0].test_passed)
            self.assertEqual(metrics[0].solution_quality, 0.0)
            self.assertEqual(metrics[0].error_rate, 1.0)

    def test_run_benchmark_suite(self):
        """Test running full benchmark suite (lines 123-144)"""
        # Create context files
        context1 = self.test_dir / "context1.md"
        context1.write_text("# Context 1")
        context2 = self.test_dir / "context2.md"
        context2.write_text("# Context 2")

        suite = BenchmarkSuite(
            name="Test Suite",
            description="Test description",
            tasks=[
                {
                    "task": "Task 1",
                    "context_bundle": str(context1),
                    "verify_cmd": "pytest"
                },
                {
                    "task": "Task 2",
                    "context_bundle": str(context2),
                    "verify_cmd": "npm test"
                }
            ]
        )

        competitor = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        with patch('paws_benchmark.PaxosOrchestrator') as mock_paxos:
            mock_result = CompetitionResult(
                name="Test Agent",
                model_id="gemini-pro",
                solution_path="/path",
                status="PASS",
                execution_time=2.0,
                token_count=1000
            )

            mock_orchestrator = Mock()
            mock_orchestrator.run_competition.return_value = [mock_result]
            mock_paxos.return_value = mock_orchestrator

            # Run benchmark suite
            results = self.benchmark.run_benchmark_suite(suite, [competitor])

            # Should have results for both tasks
            self.assertEqual(len(results), 2)
            self.assertIn("task_1", results)
            self.assertIn("task_2", results)
            self.assertEqual(len(results["task_1"]), 1)
            self.assertEqual(len(results["task_2"]), 1)

    def test_calculate_summary_empty(self):
        """Test summary calculation with empty results (lines 170-198)"""
        summary = self.benchmark._calculate_summary({})
        self.assertEqual(summary, {})

    def test_calculate_summary_single_model(self):
        """Test summary calculation for single model"""
        metrics = [
            BenchmarkMetrics(
                model_name="Agent1",
                model_id="gemini-pro",
                provider="gemini",
                execution_time=2.0,
                token_count=1000,
                test_passed=True,
                solution_quality=1.0,
                estimated_cost=0.001,
                error_rate=0.0
            ),
            BenchmarkMetrics(
                model_name="Agent1",
                model_id="gemini-pro",
                provider="gemini",
                execution_time=3.0,
                token_count=1500,
                test_passed=True,
                solution_quality=1.0,
                estimated_cost=0.0015,
                error_rate=0.0
            )
        ]

        results = {"task_1": metrics}
        summary = self.benchmark._calculate_summary(results)

        self.assertIn("Agent1", summary)
        self.assertEqual(summary["Agent1"]["total_runs"], 2)
        self.assertEqual(summary["Agent1"]["pass_rate"], 1.0)
        self.assertEqual(summary["Agent1"]["avg_execution_time"], 2.5)
        self.assertEqual(summary["Agent1"]["avg_token_count"], 1250)
        self.assertEqual(summary["Agent1"]["total_cost"], 0.0025)

    def test_calculate_summary_multiple_models(self):
        """Test summary calculation for multiple models"""
        metrics = [
            BenchmarkMetrics(
                model_name="Agent1",
                model_id="gemini-pro",
                provider="gemini",
                execution_time=2.0,
                token_count=1000,
                test_passed=True,
                solution_quality=1.0,
                estimated_cost=0.001,
                error_rate=0.0
            ),
            BenchmarkMetrics(
                model_name="Agent2",
                model_id="gpt-4",
                provider="openai",
                execution_time=3.0,
                token_count=1500,
                test_passed=False,
                solution_quality=0.0,
                estimated_cost=0.045,
                error_rate=0.0
            )
        ]

        results = {"task_1": metrics}
        summary = self.benchmark._calculate_summary(results)

        self.assertEqual(len(summary), 2)
        self.assertIn("Agent1", summary)
        self.assertIn("Agent2", summary)
        self.assertEqual(summary["Agent1"]["pass_rate"], 1.0)
        self.assertEqual(summary["Agent2"]["pass_rate"], 0.0)

    def test_generate_report(self):
        """Test generating benchmark report (lines 146-168)"""
        metrics = [
            BenchmarkMetrics(
                model_name="Agent1",
                model_id="gemini-pro",
                provider="gemini",
                execution_time=2.0,
                token_count=1000,
                test_passed=True,
                solution_quality=1.0,
                estimated_cost=0.001,
                error_rate=0.0
            )
        ]

        results = {"task_1": metrics}

        # Mock _calculate_rankings and _print_report
        with patch.object(self.benchmark, '_calculate_rankings', return_value={}):
            with patch.object(self.benchmark, '_print_report'):
                report = self.benchmark.generate_report(results, "test_report.json")

                # Check report structure
                self.assertIn("summary", report)
                self.assertIn("detailed_results", report)
                self.assertIn("rankings", report)

                # Check report file was created
                report_file = self.benchmark.output_dir / "test_report.json"
                self.assertTrue(report_file.exists())

                # Verify JSON content
                with open(report_file) as f:
                    saved_report = json.load(f)
                self.assertIn("summary", saved_report)
                self.assertIn("detailed_results", saved_report)


if __name__ == "__main__":
    unittest.main(verbosity=2)
