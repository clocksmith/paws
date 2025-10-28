#!/usr/bin/env node
/**
 * PAWS Benchmark - Performance analyzer for comparing LLM performance on your codebase (TypeScript)
 *
 * Tracks metrics:
 * - Execution speed
 * - Token efficiency
 * - Test pass rate
 * - Solution correctness
 * - Cost estimation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';

// Import from arena module
const { ArenaOrchestrator, CompetitorConfig } = require('./arena');

interface BenchmarkMetricsConfig {
  modelName: string;
  modelId: string;
  provider: string;
  executionTime: number;
  tokenCount: number;
  testPassed: boolean;
  solutionQuality: number;
  estimatedCost: number;
  errorRate: number;
}

/**
 * Metrics for a single benchmark run
 */
class BenchmarkMetrics {
  public modelName: string;
  public modelId: string;
  public provider: string;
  public executionTime: number;
  public tokenCount: number;
  public testPassed: boolean;
  public solutionQuality: number;
  public estimatedCost: number;
  public errorRate: number;

  constructor(config: BenchmarkMetricsConfig) {
    this.modelName = config.modelName;
    this.modelId = config.modelId;
    this.provider = config.provider;
    this.executionTime = config.executionTime;
    this.tokenCount = config.tokenCount;
    this.testPassed = config.testPassed;
    this.solutionQuality = config.solutionQuality;  // 0.0 to 1.0
    this.estimatedCost = config.estimatedCost;
    this.errorRate = config.errorRate;
  }
}

/**
 * A suite of benchmark tests
 */
class BenchmarkSuite {
  public name: string;
  public description: string;
  public tasks: any[];

  constructor(name: string, description: string, tasks: any[]) {
    this.name = name;
    this.description = description;
    this.tasks = tasks;  // List of {task, context_bundle, verify_cmd}
  }
}

/**
 * Benchmark system for comparing LLM performance
 */
class PerformanceBenchmark {
  private outputDir: string;
  private costPer1kTokens: Record<string, number>;

  constructor(outputDir: string = 'workspace/benchmarks') {
    this.outputDir = outputDir;

    // Cost estimates per 1K tokens (approximate)
    this.costPer1kTokens = {
      'gemini-pro': 0.00025,
      'gemini-pro-1.5': 0.00125,
      'gemini-1.5-pro': 0.00125,
      'gemini-1.5-flash': 0.000075,
      'claude-3-sonnet-20240229': 0.003,
      'claude-3-opus-20240229': 0.015,
      'claude-3-5-sonnet-20241022': 0.003,
      'gpt-4-turbo-preview': 0.01,
      'gpt-4': 0.03,
      'gpt-4o': 0.005,
      'gpt-3.5-turbo': 0.0005
    };
  }

  /**
   * Estimate cost for a given model and token count
   */
  estimateCost(modelId: string, tokenCount: number): number {
    const costPer1k = this.costPer1kTokens[modelId] || 0.001;  // Default fallback
    return (tokenCount / 1000.0) * costPer1k;
  }

  /**
   * Run a single benchmark test
   */
  async runBenchmark(competitors: any[], task: string, contextBundle: string, verifyCmd: string): Promise<BenchmarkMetrics[]> {
    console.log(chalk.cyan(`\n☇ Running benchmark: ${task.substring(0, 60)}...`));

    // Use Arena orchestrator to run competition
    const orchestrator = new ArenaOrchestrator(
      task,
      contextBundle,
      verifyCmd,
      path.join(this.outputDir, 'temp')
    );

    await orchestrator.initialize();

    const results = await orchestrator.runCompetition(competitors, true);

    // Convert to benchmark metrics
    const metrics: BenchmarkMetrics[] = [];
    for (const result of results) {
      const testPassed = result.status === 'PASS';

      // Calculate solution quality (simplified - could be more sophisticated)
      const solutionQuality = testPassed ? 1.0 : 0.0;

      // Calculate error rate
      const errorRate = result.status === 'ERROR' ? 1.0 : 0.0;

      // Estimate cost
      const estimatedCost = this.estimateCost(result.model_id, result.token_count);

      metrics.push(new BenchmarkMetrics({
        modelName: result.name,
        modelId: result.model_id,
        provider: this._getProvider(result.model_id),
        executionTime: result.execution_time,
        tokenCount: result.token_count,
        testPassed,
        solutionQuality,
        estimatedCost,
        errorRate
      }));
    }

    return metrics;
  }

  /**
   * Infer provider from model ID
   */
  _getProvider(modelId: string): string {
    const modelIdLower = modelId.toLowerCase();
    if (modelIdLower.includes('gemini')) {
      return 'gemini';
    } else if (modelIdLower.includes('claude')) {
      return 'claude';
    } else if (modelIdLower.includes('gpt')) {
      return 'openai';
    }
    return 'unknown';
  }

  /**
   * Run a full benchmark suite
   */
  async runBenchmarkSuite(suite: BenchmarkSuite, competitors: any[]): Promise<Record<string, BenchmarkMetrics[]>> {
    console.log(chalk.yellow(`\n♃ Starting Benchmark Suite: ${suite.name}`));
    console.log(`Description: ${suite.description}`);
    console.log(`Tasks: ${suite.tasks.length}`);
    console.log(`Models: ${competitors.length}`);
    console.log();

    const allResults: Record<string, BenchmarkMetrics[]> = {};

    for (let i = 0; i < suite.tasks.length; i++) {
      const taskConfig = suite.tasks[i];
      console.log(chalk.cyan(`\n--- Task ${i + 1}/${suite.tasks.length} ---`));

      const metrics = await this.runBenchmark(
        competitors,
        taskConfig.task,
        taskConfig.context_bundle,
        taskConfig.verify_cmd
      );

      allResults[`task_${i + 1}`] = metrics;
    }

    return allResults;
  }

  /**
   * Generate comprehensive benchmark report
   */
  async generateReport(results: Record<string, BenchmarkMetrics[]>, outputFile: string = 'benchmark_report.json'): Promise<any> {
    const report: any = {
      summary: this._calculateSummary(results),
      detailed_results: {},
      rankings: this._calculateRankings(results)
    };

    // Convert results to plain objects
    for (const [task, metrics] of Object.entries(results)) {
      report.detailed_results[task] = (metrics as BenchmarkMetrics[]).map((m: BenchmarkMetrics) => ({
        modelName: m.modelName,
        modelId: m.modelId,
        provider: m.provider,
        executionTime: m.executionTime,
        tokenCount: m.tokenCount,
        testPassed: m.testPassed,
        solutionQuality: m.solutionQuality,
        estimatedCost: m.estimatedCost,
        errorRate: m.errorRate
      }));
    }

    // Save JSON report
    await fs.mkdir(this.outputDir, { recursive: true });
    const outputPath = path.join(this.outputDir, outputFile);
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));

    console.log(chalk.green(`\n♲ Report saved to: ${outputPath}`));

    // Print summary
    this._printReport(report);

    return report;
  }

  /**
   * Calculate summary statistics across all tasks
   */
  _calculateSummary(results: Record<string, BenchmarkMetrics[]>): Record<string, any> {
    const allMetrics: BenchmarkMetrics[] = [];
    for (const metricsList of Object.values(results)) {
      allMetrics.push(...metricsList);
    }

    if (allMetrics.length === 0) {
      return {};
    }

    // Group by model
    const byModel = new Map<string, BenchmarkMetrics[]>();
    for (const metric of allMetrics) {
      if (!byModel.has(metric.modelName)) {
        byModel.set(metric.modelName, []);
      }
      byModel.get(metric.modelName)!.push(metric);
    }

    const summary: Record<string, any> = {};
    for (const [modelName, modelMetrics] of byModel.entries()) {
      summary[modelName] = {
        total_runs: modelMetrics.length,
        pass_rate: modelMetrics.filter(m => m.testPassed).length / modelMetrics.length,
        avg_execution_time: modelMetrics.reduce((sum, m) => sum + m.executionTime, 0) / modelMetrics.length,
        avg_token_count: modelMetrics.reduce((sum, m) => sum + m.tokenCount, 0) / modelMetrics.length,
        total_cost: modelMetrics.reduce((sum, m) => sum + m.estimatedCost, 0),
        avg_solution_quality: modelMetrics.reduce((sum, m) => sum + m.solutionQuality, 0) / modelMetrics.length,
        error_rate: modelMetrics.reduce((sum, m) => sum + m.errorRate, 0) / modelMetrics.length
      };
    }

    return summary;
  }

  /**
   * Calculate rankings across different criteria
   */
  _calculateRankings(results: Record<string, BenchmarkMetrics[]>): Record<string, string[]> {
    const summary = this._calculateSummary(results);

    if (Object.keys(summary).length === 0) {
      return {};
    }

    const rankings: Record<string, string[]> = {};

    // Best pass rate
    rankings.by_pass_rate = Object.keys(summary).sort(
      (a, b) => summary[b].pass_rate - summary[a].pass_rate
    );

    // Fastest
    rankings.by_speed = Object.keys(summary).sort(
      (a, b) => summary[a].avg_execution_time - summary[b].avg_execution_time
    );

    // Most token efficient
    rankings.by_token_efficiency = Object.keys(summary).sort(
      (a, b) => summary[a].avg_token_count - summary[b].avg_token_count
    );

    // Best cost efficiency
    rankings.by_cost = Object.keys(summary).sort(
      (a, b) => summary[a].total_cost - summary[b].total_cost
    );

    // Best solution quality
    rankings.by_quality = Object.keys(summary).sort(
      (a, b) => summary[b].avg_solution_quality - summary[a].avg_solution_quality
    );

    return rankings;
  }

  /**
   * Print formatted report to console
   */
  _printReport(report: any): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(chalk.yellow('☉ BENCHMARK REPORT'));
    console.log(`${'='.repeat(70)}\n`);

    const summary = report.summary;
    const rankings = report.rankings;

    // Summary table
    console.log('Model Performance Summary:');
    console.log(`${'Model'.padEnd(25)} ${'Pass Rate'.padEnd(12)} ${'Avg Time'.padEnd(12)} ${'Tokens'.padEnd(12)} ${'Cost'.padEnd(10)}`);
    console.log('-'.repeat(70));

    for (const [modelName, stats] of Object.entries(summary)) {
      const statsTyped = stats as any;
      console.log(
        `${modelName.padEnd(25)} ` +
        `${(statsTyped.pass_rate * 100).toFixed(1).padStart(6)}%     ` +
        `${statsTyped.avg_execution_time.toFixed(1).padStart(6)}s      ` +
        `${Math.floor(statsTyped.avg_token_count).toString().padStart(6)}      ` +
        `$${statsTyped.total_cost.toFixed(3).padStart(6)}`
      );
    }

    console.log();

    // Rankings
    if (rankings.by_pass_rate && rankings.by_pass_rate.length > 0) {
      console.log('Rankings:');
      console.log(chalk.cyan(`  ☇ Best Pass Rate:         ${rankings.by_pass_rate[0]}`));
      console.log(chalk.yellow(`  ⚡ Fastest:                ${rankings.by_speed[0]}`));
      console.log(chalk.green(`  ☉ Most Token Efficient:   ${rankings.by_token_efficiency[0]}`));
      console.log(chalk.magenta(`  ♢ Best Cost Efficiency:   ${rankings.by_cost[0]}`));
      console.log(chalk.blue(`  ♃ Best Solution Quality:  ${rankings.by_quality[0]}`));
    }
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('paws-benchmark')
    .description('PAWS Benchmark - Compare LLM performance on your codebase')
    .option('--config <path>', 'Path to competitor config file', 'packages/core/configs/arena_config.json')
    .option('--suite <path>', 'Path to benchmark suite JSON file')
    .option('--task <description>', 'Single task description (alternative to suite)')
    .option('--context <path>', 'Context bundle for single task')
    .option('--verify-cmd <command>', 'Verification command for single task')
    .option('--output-dir <path>', 'Directory to store benchmark results', 'workspace/benchmarks')
    .option('--output-file <name>', 'Output file name for report', 'benchmark_report.json')
    .parse(process.argv);

  const options = program.opts();

  // Create benchmark system
  const benchmark = new PerformanceBenchmark(options.outputDir);

  // Load competitors
  const configData = JSON.parse(await fs.readFile(options.config, 'utf-8'));
  const competitors = [];

  for (const comp of configData.competitors || []) {
    const provider = comp.provider || 'gemini';
    competitors.push(new CompetitorConfig({
      name: comp.name,
      model_id: comp.model_id,
      persona_file: comp.persona,
      provider,
      temperature: comp.temperature || 0.7,
      max_tokens: comp.max_tokens || 4000
    }));
  }

  // Run benchmark
  let results;

  if (options.suite) {
    // Load benchmark suite
    const suiteData = JSON.parse(await fs.readFile(options.suite, 'utf-8'));

    const suite = new BenchmarkSuite(
      suiteData.name,
      suiteData.description,
      suiteData.tasks
    );

    results = await benchmark.runBenchmarkSuite(suite, competitors);
  } else if (options.task && options.context && options.verifyCmd) {
    // Single task benchmark
    const metrics = await benchmark.runBenchmark(
      competitors,
      options.task,
      options.context,
      options.verifyCmd
    );
    results = { task_1: metrics };
  } else {
    console.error(chalk.red('Error: Either --suite or (--task, --context, --verify-cmd) required'));
    process.exit(1);
  }

  // Generate report
  await benchmark.generateReport(results, options.outputFile);

  process.exit(0);
}

// Export for use as a module
module.exports = {
  BenchmarkMetrics,
  BenchmarkSuite,
  PerformanceBenchmark
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
