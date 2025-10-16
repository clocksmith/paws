#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Test suite for paws_benchmark.py"""

import unittest
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from paws.benchmark import BenchmarkMetrics, BenchmarkSuite, PerformanceBenchmark


class TestBenchmarkMetrics(unittest.TestCase):
    """Test BenchmarkMetrics dataclass"""

    def test_create_metrics(self):
        """Test creating benchmark metrics"""
        metrics = BenchmarkMetrics(
            model_name="TestModel",
            model_id="test-1",
            provider="gemini",
            execution_time=5.2,
            token_count=1000,
            test_passed=True,
            solution_quality=0.95,
            estimated_cost=0.01,
            error_rate=0.0
        )
        self.assertEqual(metrics.model_name, "TestModel")
        self.assertEqual(metrics.execution_time, 5.2)
        self.assertEqual(metrics.token_count, 1000)


class TestBenchmarkSuite(unittest.TestCase):
    """Test BenchmarkSuite dataclass"""

    def test_create_suite(self):
        """Test creating a benchmark suite"""
        suite = BenchmarkSuite(
            name="Full Suite",
            description="Comprehensive benchmarks",
            tasks=[
                {"task": "Task1", "context_bundle": "bundle1.md", "verify_cmd": "pytest"},
                {"task": "Task2", "context_bundle": "bundle2.md", "verify_cmd": "npm test"}
            ]
        )
        self.assertEqual(suite.name, "Full Suite")
        self.assertEqual(len(suite.tasks), 2)


class TestPerformanceBenchmark(unittest.TestCase):
    """Test PerformanceBenchmark class"""

    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="paws_benchmark_test_"))
        self.benchmark = PerformanceBenchmark(output_dir=str(self.temp_dir))

    def tearDown(self):
        """Clean up"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_init(self):
        """Test initialization"""
        self.assertTrue(self.temp_dir.exists())

    def test_has_required_methods(self):
        """Test that benchmark has expected methods"""
        self.assertTrue(hasattr(self.benchmark, 'run_benchmark'))
        self.assertTrue(hasattr(self.benchmark, 'run_benchmark_suite'))
        self.assertTrue(hasattr(self.benchmark, 'generate_report'))

    def test_estimate_cost(self):
        """Test cost estimation"""
        cost = self.benchmark.estimate_cost("gemini-pro", 1000)
        self.assertIsNotNone(cost)
        self.assertGreaterEqual(cost, 0)


def suite():
    """Create test suite"""
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestBenchmarkMetrics))
    suite.addTests(loader.loadTestsFromTestCase(TestBenchmarkSuite))
    suite.addTests(loader.loadTestsFromTestCase(TestPerformanceBenchmark))

    return suite


if __name__ == '__main__':
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())
