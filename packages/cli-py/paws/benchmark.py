#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAWS Benchmark - Performance analyzer for comparing LLM performance on your codebase

Tracks metrics:
- Execution speed
- Token efficiency
- Test pass rate
- Solution correctness
- Cost estimation
"""

import argparse
import json
import time
import sys
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Any
from paws_paxos import PaxosOrchestrator, CompetitorConfig


@dataclass
class BenchmarkMetrics:
    """Metrics for a single benchmark run"""
    model_name: str
    model_id: str
    provider: str
    execution_time: float
    token_count: int
    test_passed: bool
    solution_quality: float  # 0.0 to 1.0
    estimated_cost: float
    error_rate: float


@dataclass
class BenchmarkSuite:
    """A suite of benchmark tests"""
    name: str
    description: str
    tasks: List[Dict[str, str]]  # List of {task, context_bundle, verify_cmd}


class PerformanceBenchmark:
    """Benchmark system for comparing LLM performance"""

    def __init__(self, output_dir: str = "workspace/benchmarks"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Cost estimates per 1K tokens (approximate)
        self.cost_per_1k_tokens = {
            "gemini-pro": 0.00025,
            "gemini-pro-1.5": 0.00125,
            "claude-3-sonnet-20240229": 0.003,
            "claude-3-opus-20240229": 0.015,
            "gpt-4-turbo-preview": 0.01,
            "gpt-4": 0.03,
            "gpt-3.5-turbo": 0.0005,
        }

    def estimate_cost(self, model_id: str, token_count: int) -> float:
        """Estimate cost for a given model and token count"""
        cost_per_1k = self.cost_per_1k_tokens.get(model_id, 0.001)  # Default fallback
        return (token_count / 1000.0) * cost_per_1k

    def run_benchmark(self, competitors: List[CompetitorConfig],
                     task: str, context_bundle: str, verify_cmd: str) -> List[BenchmarkMetrics]:
        """Run a single benchmark test"""
        print(f"\n☇ Running benchmark: {task[:60]}...")

        # Use Paxos orchestrator to run competition
        orchestrator = PaxosOrchestrator(
            task=task,
            context_bundle=context_bundle,
            verify_cmd=verify_cmd,
            output_dir=str(self.output_dir / "temp")
        )

        results = orchestrator.run_competition(competitors, parallel=True)

        # Convert to benchmark metrics
        metrics = []
        for result in results:
            test_passed = result.status == "PASS"

            # Calculate solution quality (simplified - could be more sophisticated)
            solution_quality = 1.0 if test_passed else 0.0

            # Calculate error rate
            error_rate = 0.0 if result.status != "ERROR" else 1.0

            # Estimate cost
            estimated_cost = self.estimate_cost(result.model_id, result.token_count)

            metrics.append(BenchmarkMetrics(
                model_name=result.name,
                model_id=result.model_id,
                provider=self._get_provider(result.model_id),
                execution_time=result.execution_time,
                token_count=result.token_count,
                test_passed=test_passed,
                solution_quality=solution_quality,
                estimated_cost=estimated_cost,
                error_rate=error_rate
            ))

        return metrics

    def _get_provider(self, model_id: str) -> str:
        """Infer provider from model ID"""
        model_id_lower = model_id.lower()
        if "gemini" in model_id_lower:
            return "gemini"
        elif "claude" in model_id_lower:
            return "claude"
        elif "gpt" in model_id_lower:
            return "openai"
        return "unknown"

    def run_benchmark_suite(self, suite: BenchmarkSuite,
                           competitors: List[CompetitorConfig]) -> Dict[str, List[BenchmarkMetrics]]:
        """Run a full benchmark suite"""
        print(f"\n♃ Starting Benchmark Suite: {suite.name}")
        print(f"Description: {suite.description}")
        print(f"Tasks: {len(suite.tasks)}")
        print(f"Models: {len(competitors)}")
        print()

        all_results = {}

        for i, task_config in enumerate(suite.tasks, 1):
            print(f"\n--- Task {i}/{len(suite.tasks)} ---")
            metrics = self.run_benchmark(
                competitors,
                task_config["task"],
                task_config["context_bundle"],
                task_config["verify_cmd"]
            )
            all_results[f"task_{i}"] = metrics

        return all_results

    def generate_report(self, results: Dict[str, List[BenchmarkMetrics]],
                       output_file: str = "benchmark_report.json"):
        """Generate comprehensive benchmark report"""
        report = {
            "summary": self._calculate_summary(results),
            "detailed_results": {
                task: [asdict(m) for m in metrics]
                for task, metrics in results.items()
            },
            "rankings": self._calculate_rankings(results)
        }

        # Save JSON report
        output_path = self.output_dir / output_file
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n♲ Report saved to: {output_path}")

        # Print summary
        self._print_report(report)

        return report

    def _calculate_summary(self, results: Dict[str, List[BenchmarkMetrics]]) -> Dict[str, Any]:
        """Calculate summary statistics across all tasks"""
        all_metrics = []
        for metrics_list in results.values():
            all_metrics.extend(metrics_list)

        if not all_metrics:
            return {}

        # Group by model
        by_model = {}
        for metric in all_metrics:
            if metric.model_name not in by_model:
                by_model[metric.model_name] = []
            by_model[metric.model_name].append(metric)

        summary = {}
        for model_name, model_metrics in by_model.items():
            summary[model_name] = {
                "total_runs": len(model_metrics),
                "pass_rate": sum(1 for m in model_metrics if m.test_passed) / len(model_metrics),
                "avg_execution_time": sum(m.execution_time for m in model_metrics) / len(model_metrics),
                "avg_token_count": sum(m.token_count for m in model_metrics) / len(model_metrics),
                "total_cost": sum(m.estimated_cost for m in model_metrics),
                "avg_solution_quality": sum(m.solution_quality for m in model_metrics) / len(model_metrics),
                "error_rate": sum(m.error_rate for m in model_metrics) / len(model_metrics)
            }

        return summary

    def _calculate_rankings(self, results: Dict[str, List[BenchmarkMetrics]]) -> Dict[str, List[str]]:
        """Calculate rankings across different criteria"""
        summary = self._calculate_summary(results)

        if not summary:
            return {}

        # Rank by different criteria
        rankings = {}

        # Best pass rate
        rankings["by_pass_rate"] = sorted(
            summary.keys(),
            key=lambda k: summary[k]["pass_rate"],
            reverse=True
        )

        # Fastest
        rankings["by_speed"] = sorted(
            summary.keys(),
            key=lambda k: summary[k]["avg_execution_time"]
        )

        # Most token efficient
        rankings["by_token_efficiency"] = sorted(
            summary.keys(),
            key=lambda k: summary[k]["avg_token_count"]
        )

        # Best cost efficiency
        rankings["by_cost"] = sorted(
            summary.keys(),
            key=lambda k: summary[k]["total_cost"]
        )

        # Best solution quality
        rankings["by_quality"] = sorted(
            summary.keys(),
            key=lambda k: summary[k]["avg_solution_quality"],
            reverse=True
        )

        return rankings

    def _print_report(self, report: Dict[str, Any]):
        """Print formatted report to console"""
        print(f"\n{'='*70}")
        print(f"☉ BENCHMARK REPORT")
        print(f"{'='*70}\n")

        summary = report["summary"]
        rankings = report["rankings"]

        # Summary table
        print("Model Performance Summary:")
        print(f"{'Model':<25} {'Pass Rate':<12} {'Avg Time':<12} {'Tokens':<12} {'Cost':<10}")
        print("-" * 70)

        for model_name, stats in summary.items():
            print(f"{model_name:<25} "
                  f"{stats['pass_rate']*100:>6.1f}%     "
                  f"{stats['avg_execution_time']:>6.1f}s      "
                  f"{int(stats['avg_token_count']):>6}      "
                  f"${stats['total_cost']:>6.3f}")

        print()

        # Rankings
        print("Rankings:")
        print(f"  ☇ Best Pass Rate:         {rankings['by_pass_rate'][0]}")
        print(f"  ⚡ Fastest:                {rankings['by_speed'][0]}")
        print(f"  ☉ Most Token Efficient:   {rankings['by_token_efficiency'][0]}")
        print(f"  ♢ Best Cost Efficiency:   {rankings['by_cost'][0]}")
        print(f"  ♃ Best Solution Quality:  {rankings['by_quality'][0]}")


def main():
    parser = argparse.ArgumentParser(
        description="PAWS Benchmark - Compare LLM performance on your codebase"
    )

    parser.add_argument(
        "--config",
        default="paxos_config.json",
        help="Path to competitor config file"
    )
    parser.add_argument(
        "--suite",
        help="Path to benchmark suite JSON file"
    )
    parser.add_argument(
        "--task",
        help="Single task description (alternative to suite)"
    )
    parser.add_argument(
        "--context",
        help="Context bundle for single task"
    )
    parser.add_argument(
        "--verify-cmd",
        help="Verification command for single task"
    )
    parser.add_argument(
        "--output-dir",
        default="workspace/benchmarks",
        help="Directory to store benchmark results"
    )
    parser.add_argument(
        "--output-file",
        default="benchmark_report.json",
        help="Output file name for report"
    )

    args = parser.parse_args()

    # Create benchmark system
    benchmark = PerformanceBenchmark(output_dir=args.output_dir)

    # Load competitors
    with open(args.config, 'r') as f:
        config_data = json.load(f)

    from paws_paxos import CompetitorConfig
    competitors = []
    for comp in config_data.get("competitors", []):
        provider = comp.get("provider", "gemini")
        competitors.append(CompetitorConfig(
            name=comp["name"],
            model_id=comp["model_id"],
            persona_file=comp.get("persona"),
            provider=provider,
            temperature=comp.get("temperature", 0.7),
            max_tokens=comp.get("max_tokens", 4000)
        ))

    # Run benchmark
    if args.suite:
        # Load benchmark suite
        with open(args.suite, 'r') as f:
            suite_data = json.load(f)

        suite = BenchmarkSuite(
            name=suite_data["name"],
            description=suite_data["description"],
            tasks=suite_data["tasks"]
        )

        results = benchmark.run_benchmark_suite(suite, competitors)
    elif args.task and args.context and args.verify_cmd:
        # Single task benchmark
        metrics = benchmark.run_benchmark(
            competitors,
            args.task,
            args.context,
            args.verify_cmd
        )
        results = {"task_1": metrics}
    else:
        print("Error: Either --suite or (--task, --context, --verify-cmd) required")
        return 1

    # Generate report
    benchmark.generate_report(results, output_file=args.output_file)

    return 0


if __name__ == "__main__":
    sys.exit(main())
