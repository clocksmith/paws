#!/usr/bin/env node
/**
 * PAWS Arena - Multi-Agent Competitive Verification Orchestrator
 *
 * Runs multiple LLM agents in parallel on the same task with:
 * - Isolated git worktree environments
 * - Automated test-driven verification
 * - Test-driven solution selection (not Paxos consensus)
 * - Performance metrics and benchmarking
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Command } from 'commander';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

// LLM Client imports (conditional)
let GoogleGenerativeAI: any, Anthropic: any, OpenAI: any;

try {
  const { GoogleGenerativeAI: GeminiAI } = require('@google/generative-ai');
  GoogleGenerativeAI = GeminiAI;
} catch (e: any) {
  // Gemini not available
}

try {
  Anthropic = require('@anthropic-ai/sdk').default;
} catch (e: any) {
  // Claude not available
}

try {
  OpenAI = require('openai').default;
} catch (e: any) {
  // OpenAI not available
}

interface CompetitorConfigOptions {
  name: string;
  model_id: string;
  persona_file?: string | null;
  api_key?: string | null;
  base_url?: string | null;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Configuration for a single competitor agent
 */
class CompetitorConfig {
  public name: string;
  public model_id: string;
  public persona_file: string | null;
  public api_key: string | null;
  public base_url: string | null;
  public provider: string;
  public temperature: number;
  public max_tokens: number;

  constructor({
    name,
    model_id,
    persona_file = null,
    api_key = null,
    base_url = null,
    provider = 'gemini',
    temperature = 0.7,
    max_tokens = 4000
  }: CompetitorConfigOptions) {
    this.name = name;
    this.model_id = model_id;
    this.persona_file = persona_file;
    this.api_key = api_key;
    this.base_url = base_url;
    this.provider = provider;
    this.temperature = temperature;
    this.max_tokens = max_tokens;
  }
}

interface CompetitionResultOptions {
  name: string;
  model_id: string;
  solution_path: string;
  status: string;
  verification_output?: string;
  execution_time?: number;
  token_count?: number;
  error_message?: string | null;
}

/**
 * Result from a single competitor
 */
class CompetitionResult {
  public name: string;
  public model_id: string;
  public solution_path: string;
  public status: string;
  public verification_output: string;
  public execution_time: number;
  public token_count: number;
  public error_message: string | null;

  constructor({
    name,
    model_id,
    solution_path,
    status, // PASS, FAIL, ERROR
    verification_output = '',
    execution_time = 0.0,
    token_count = 0,
    error_message = null
  }: CompetitionResultOptions) {
    this.name = name;
    this.model_id = model_id;
    this.solution_path = solution_path;
    this.status = status;
    this.verification_output = verification_output;
    this.execution_time = execution_time;
    this.token_count = token_count;
    this.error_message = error_message;
  }
}

/**
 * Unified client for multiple LLM providers
 */
class LLMClient {
  private config: CompetitorConfig;
  private client: any;

  constructor(config: CompetitorConfig) {
    this.config = config;
    this.client = null;
    this._initializeClient();
  }

  _initializeClient(): void {
    const apiKey = this.config.api_key || process.env[`${this.config.provider.toUpperCase()}_API_KEY`];

    if (!apiKey) {
      throw new Error(`No API key found for ${this.config.provider}`);
    }

    if (this.config.provider === 'gemini') {
      if (!GoogleGenerativeAI) {
        throw new Error('Google Generative AI not installed. Run: npm install @google/generative-ai');
      }
      this.client = new GoogleGenerativeAI(apiKey);
    } else if (this.config.provider === 'claude') {
      if (!Anthropic) {
        throw new Error('Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
      }
      this.client = new Anthropic({ apiKey });
    } else if (this.config.provider === 'openai' || this.config.provider === 'openai_compatible') {
      if (!OpenAI) {
        throw new Error('OpenAI SDK not installed. Run: npm install openai');
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: this.config.base_url
      });
    } else {
      throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  /**
   * Generate a response from the LLM
   * @returns {Promise<{text: string, token_count: number}>}
   */
  async generate(prompt: string): Promise<{ text: string; token_count: number }> {
    if (this.config.provider === 'gemini') {
      return this._generateGemini(prompt);
    } else if (this.config.provider === 'claude') {
      return this._generateClaude(prompt);
    } else if (this.config.provider === 'openai' || this.config.provider === 'openai_compatible') {
      return this._generateOpenAI(prompt);
    }
    throw new Error(`Unknown provider: ${this.config.provider}`);
  }

  async _generateGemini(prompt: string): Promise<{ text: string; token_count: number }> {
    const model = this.client.getGenerativeModel({ model: this.config.model_id });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.max_tokens
      }
    });

    const response = await result.response;
    const text = response.text();

    // Estimate token count (Gemini doesn't always provide this)
    const token_count = Math.floor(text.split(/\s+/).length * 1.3);

    return { text, token_count };
  }

  async _generateClaude(prompt: string): Promise<{ text: string; token_count: number }> {
    const response = await this.client.messages.create({
      model: this.config.model_id,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const token_count = response.usage.input_tokens + response.usage.output_tokens;

    return { text, token_count };
  }

  async _generateOpenAI(prompt: string): Promise<{ text: string; token_count: number }> {
    const response = await this.client.chat.completions.create({
      model: this.config.model_id,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature,
      max_tokens: this.config.max_tokens
    });

    const text = response.choices[0].message.content;
    const token_count = response.usage.total_tokens;

    return { text, token_count };
  }
}

/**
 * Orchestrates multi-agent competition with test-driven selection
 */
class ArenaOrchestrator {
  public task: string;
  public contextBundle: string;
  public verifyCmd: string;
  public outputDir: string;
  public contextContent: string | null;
  private git: any;

  constructor(task: string, contextBundle: string, verifyCmd: string, outputDir: string = 'workspace/competition') {
    this.task = task;
    this.contextBundle = contextBundle;
    this.verifyCmd = verifyCmd;
    this.outputDir = outputDir;
    this.contextContent = null;
    this.git = simpleGit();
  }

  async initialize(): Promise<void> {
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });

    // Load context
    this.contextContent = await fs.readFile(this.contextBundle, 'utf-8');
  }

  /**
   * Load competitor configurations from JSON file
   */
  async loadCompetitors(configPath: string): Promise<CompetitorConfig[]> {
    const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const competitors = [];

    for (const comp of configData.competitors || []) {
      // Infer provider from model_id if not specified
      let provider = comp.provider;
      const baseUrl = comp.base_url;

      if (!provider) {
        const modelIdLower = comp.model_id.toLowerCase();
        if (baseUrl) {
          provider = 'openai_compatible';
        } else if (modelIdLower.includes('gemini')) {
          provider = 'gemini';
        } else if (modelIdLower.includes('claude')) {
          provider = 'claude';
        } else if (modelIdLower.includes('gpt') || modelIdLower.includes('davinci')) {
          provider = 'openai';
        } else {
          provider = 'gemini'; // default
        }
      }

      competitors.push(new CompetitorConfig({
        name: comp.name,
        model_id: comp.model_id,
        persona_file: comp.persona,
        provider,
        base_url: baseUrl,
        temperature: comp.temperature || 0.7,
        max_tokens: comp.max_tokens || 4000
      }));
    }

    return competitors;
  }

  /**
   * Build the full prompt for a competitor
   */
  async buildPrompt(competitor: CompetitorConfig): Promise<string> {
    const promptParts = [];

    // Add persona if specified
    if (competitor.persona_file && fsSync.existsSync(competitor.persona_file)) {
      const personaContent = await fs.readFile(competitor.persona_file, 'utf-8');
      promptParts.push(personaContent);
      promptParts.push('\n');
    }

    // Add task
    promptParts.push('--- TASK ---\n');
    promptParts.push(this.task);
    promptParts.push('\n\n');

    // Add context
    promptParts.push('--- CONTEXT ---\n');
    promptParts.push(this.contextContent);
    promptParts.push('\n\n');

    // Add instructions
    promptParts.push('--- INSTRUCTIONS ---\n');
    promptParts.push('Generate a complete solution for the task above.\n');
    promptParts.push('Format your response as file changes using the DOGS format:\n\n');
    promptParts.push('🐕 --- DOGS_START_FILE: path/to/file.js ---\n');
    promptParts.push('```javascript\n');
    promptParts.push('// Your code here\n');
    promptParts.push('```\n');
    promptParts.push('🐕 --- DOGS_END_FILE: path/to/file.js ---\n');

    return promptParts.join('');
  }

  /**
   * Run a single competitor and verify their solution
   */
  async runCompetitor(competitor: CompetitorConfig): Promise<CompetitionResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(chalk.cyan(`☇ PHASE: PROPOSAL from Agent: ${competitor.name}`));
    console.log(`${'='.repeat(60)}`);

    const startTime = Date.now();

    try {
      // 1. Generate solution
      console.log(chalk.gray(`[${competitor.name}] Generating solution...`));
      const client = new LLMClient(competitor);
      const prompt = await this.buildPrompt(competitor);

      const { text: solutionText, token_count } = await client.generate(prompt);

      // Save solution
      const solutionPath = path.join(this.outputDir, `${competitor.name}_solution.dogs.md`);
      await fs.writeFile(solutionPath, solutionText, 'utf-8');

      console.log(chalk.green(`[${competitor.name}] Solution saved to ${solutionPath}`));
      console.log(chalk.gray(`[${competitor.name}] Token count: ${token_count}`));

      // 2. Verify solution if verification command provided
      let status, verificationOutput;

      if (this.verifyCmd) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(chalk.magenta(`⚘ PHASE: VERIFICATION for ${competitor.name}`));
        console.log(`${'='.repeat(60)}`);

        verificationOutput = await this.verifySolution(competitor.name, solutionPath);
        status = verificationOutput.includes('VERIFICATION PASSED') ? 'PASS' : 'FAIL';

        console.log(chalk[status === 'PASS' ? 'green' : 'red'](`[${competitor.name}] Vote Result: ${status}`));
      } else {
        status = 'PASS'; // No verification requested
        verificationOutput = 'No verification requested';
      }

      const executionTime = (Date.now() - startTime) / 1000;

      return new CompetitionResult({
        name: competitor.name,
        model_id: competitor.model_id,
        solution_path: solutionPath,
        status,
        verification_output: verificationOutput,
        execution_time: executionTime,
        token_count
      });

    } catch (error: any) {
      const executionTime = (Date.now() - startTime) / 1000;
      const errorMsg = `Error: ${error.message}`;
      console.log(chalk.red(`[${competitor.name}] ${errorMsg}`));

      return new CompetitionResult({
        name: competitor.name,
        model_id: competitor.model_id,
        solution_path: '',
        status: 'ERROR',
        verification_output: '',
        execution_time: executionTime,
        token_count: 0,
        error_message: errorMsg
      });
    }
  }

  /**
   * Verify a solution in an isolated environment
   */
  async verifySolution(competitorName: string, solutionPath: string): Promise<string> {
    // Create a temporary worktree for verification
    const sessionId = `arena-${competitorName}-${uuidv4().substring(0, 6)}`;
    const worktreePath = `.paws_sessions/${sessionId}`;

    try {
      // Create worktree
      console.log(chalk.gray(`[${competitorName}] Creating isolated environment...`));

      try {
        await execPromise(`git worktree add ${worktreePath} HEAD`);
      } catch (error: any) {
        return `VERIFICATION FAILED: Could not create worktree\n${error.stderr}`;
      }

      // Apply solution using dogs.js
      console.log(chalk.gray(`[${competitorName}] Applying solution...`));

      const dogsPath = path.join(__dirname, 'dogs.js');
      const applyCmd = `node "${dogsPath}" "${path.resolve(solutionPath)}" "${worktreePath}" --yes`;

      try {
        await execPromise(applyCmd, { cwd: worktreePath });
      } catch (error: any) {
        return `VERIFICATION FAILED: Could not apply solution\n${error.stderr}`;
      }

      // Run verification command
      console.log(chalk.gray(`[${competitorName}] Running tests: ${this.verifyCmd}`));

      try {
        const { stdout, stderr } = await execPromise(this.verifyCmd, {
          cwd: worktreePath,
          timeout: 300000 // 5 minute timeout
        });

        const output = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
        return `VERIFICATION PASSED\n\n${output}`;
      } catch (error: any) {
        if (error.killed) {
          return 'VERIFICATION FAILED: Timeout (5 minutes)';
        }

        const output = `STDOUT:\n${error.stdout}\n\nSTDERR:\n${error.stderr}`;
        return `VERIFICATION FAILED\n\n${output}`;
      }

    } catch (error: any) {
      return `VERIFICATION FAILED: ${error.message}`;
    } finally {
      // Clean up worktree
      try {
        await execPromise(`git worktree remove ${worktreePath} --force`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Run all competitors and return results
   */
  async runCompetition(competitors: CompetitorConfig[], parallel: boolean = true): Promise<CompetitionResult[]> {
    const results: CompetitionResult[] = [];

    if (parallel && competitors.length > 1) {
      console.log(chalk.cyan(`\n☇ Running ${competitors.length} agents in parallel...\n`));

      const promises = competitors.map((comp: CompetitorConfig) => this.runCompetitor(comp));
      const settled = await Promise.allSettled(promises);

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    } else {
      console.log(chalk.cyan(`\n☇ Running ${competitors.length} agents sequentially...\n`));

      for (const competitor of competitors) {
        const result = await this.runCompetitor(competitor);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Persist analytics snapshot for front-end consumption
   */
  async writeAnalyticsSnapshot(results: CompetitionResult[], passing: CompetitionResult[]): Promise<void> {
    try {
      const cacheDir = '.paws/cache';
      await fs.mkdir(cacheDir, { recursive: true });
      const analyticsPath = path.join(cacheDir, 'arena-analytics.json');

      const entry = {
        task: this.task,
        timestamp: new Date().toISOString(),
        verify: Boolean(this.verifyCmd),
        context_bundle: this.contextBundle,
        agents: results.map(result => ({
          name: result.name,
          model: result.model_id,
          status: result.status,
          execution_time: Math.round(result.execution_time * 1000) / 1000,
          token_count: result.token_count,
          solution_path: result.solution_path,
          error: result.error_message
        })),
        consensus: {
          status: passing.length > 0 ? 'success' : 'failure',
          passing: passing.map(r => r.name)
        }
      };

      let historyPayload: any = { history: [] };

      if (fsSync.existsSync(analyticsPath)) {
        try {
          const content = await fs.readFile(analyticsPath, 'utf-8');
          historyPayload = JSON.parse(content);
        } catch (e: any) {
          historyPayload = { history: [] };
        }
      }

      const history: any[] = historyPayload.history || [];
      history.push(entry);
      historyPayload.history = history.slice(-10); // Keep last 10
      historyPayload.latest = entry;

      await fs.writeFile(analyticsPath, JSON.stringify(historyPayload, null, 2));

      // Progress stream
      const progressStream = path.join(cacheDir, 'progress-stream.ndjson');
      const progressLine = JSON.stringify({
        source: 'arena',
        event: 'analytics',
        timestamp: entry.timestamp,
        payload: entry
      });

      await fs.appendFile(progressStream, progressLine + '\n');
    } catch (err) {
      console.log(chalk.gray(`[analytics] Failed to record Arena analytics: ${err}`));
    }
  }

  /**
   * Generate and display final consensus report
   */
  async generateReport(results: CompetitionResult[]): Promise<number> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(chalk.yellow(`♃ PHASE: CONSENSUS REPORT`));
    console.log(`${'='.repeat(60)}\n`);

    const passing = results.filter((r: CompetitionResult) => r.status === 'PASS');
    const failing = results.filter((r: CompetitionResult) => r.status === 'FAIL');
    const errors = results.filter((r: CompetitionResult) => r.status === 'ERROR');

    // Summary table
    console.log('Summary:');
    console.log(`  Total agents: ${results.length}`);
    console.log(chalk.green(`  ☉ Passed: ${passing.length}`));
    console.log(chalk.red(`  ☋ Failed: ${failing.length}`));
    console.log(chalk.yellow(`  ☊ Errors: ${errors.length}`));
    console.log();

    // Individual results
    console.log('Individual Results:');
    for (const result of results) {
      const statusSymbol: string = ({ PASS: '☉', FAIL: '☋', ERROR: '☊' } as any)[result.status] || '?';
      const color: 'green' | 'red' | 'yellow' = ({ PASS: 'green', FAIL: 'red', ERROR: 'yellow' } as any)[result.status] || 'gray';

      console.log(chalk[color](`  ${statusSymbol} ${result.name} (${result.model_id})`));
      console.log(`     Status: ${result.status}`);
      console.log(`     Time: ${result.execution_time.toFixed(2)}s`);
      console.log(`     Tokens: ${result.token_count}`);

      if (result.solution_path) {
        console.log(`     Solution: ${result.solution_path}`);
      }
      if (result.error_message) {
        console.log(chalk.red(`     Error: ${result.error_message}`));
      }
      console.log();
    }

    await this.writeAnalyticsSnapshot(results, passing);

    // Consensus outcome
    if (passing.length === 0) {
      console.log(chalk.red('☋ CONSENSUS FAILED'));
      console.log('No solutions passed verification.');
      console.log(`\nAll proposals available for review in: ${this.outputDir}`);
      return 1;
    } else {
      console.log(chalk.green('☉ CONSENSUS REACHED'));
      console.log(`\n${passing.length} solution(s) passed verification:`);

      for (const result of passing) {
        console.log(chalk.green(`  ☉ ${result.name}: ${result.solution_path}`));
      }

      console.log(chalk.cyan('\n♲ NEXT STEP: Review and apply the best solution:'));
      const best = passing[0]; // Could add ranking logic here
      console.log(`  node packages/cli-js/src/dogs.js ${best.solution_path} --interactive`);
      return 0;
    }
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('paws-arena')
    .description('PAWS Arena - Multi-Agent Competitive Verification Orchestrator')
    .argument('[task]', 'The detailed task description for the AI agents')
    .argument('[context_bundle]', 'Path to the cats.md context bundle')
    .option('--verify-cmd <command>', 'Shell command to run for verification (e.g., "npm test")')
    .option('--config <path>', 'Path to competitor config file', 'packages/core/configs/arena_config.json')
    .option('--output-dir <path>', 'Directory to store results', 'workspace/competition')
    .option('--sequential', 'Run competitors sequentially instead of in parallel')
    .parse(process.argv);

  const options = program.opts();
  let [task, contextBundle] = program.args;

  // Interactive prompts if arguments not provided (using readline for simplicity)
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => new Promise(resolve => rl.question(prompt, resolve));

  if (!task) {
    task = await question('Enter the task description:\n> ') as string;
  }

  if (!contextBundle) {
    contextBundle = await question('Enter path to context bundle (e.g., context.md):\n> ') as string;
  }

  let verifyCmd = options.verifyCmd;
  if (!verifyCmd) {
    verifyCmd = await question('Enter verification command (e.g., "npm test", or press Enter to skip):\n> ');
    if (!verifyCmd.trim()) {
      verifyCmd = null;
    }
  }

  rl.close();

  // Create orchestrator
  const orchestrator = new ArenaOrchestrator(
    task,
    contextBundle,
    verifyCmd,
    options.outputDir
  );

  await orchestrator.initialize();

  // Load competitors
  let competitors;
  try {
    competitors = await orchestrator.loadCompetitors(options.config);
  } catch (error) {
    console.error(chalk.red(`Error: Config file not found: ${options.config}`));
    console.log('Create a config file with competitor definitions. Example:');
    console.log(JSON.stringify({
      competitors: [
        {
          name: 'gemini-pro',
          model_id: 'gemini-pro',
          provider: 'gemini',
          persona: 'personas/p_refactor.md'
        },
        {
          name: 'claude-sonnet',
          model_id: 'claude-3-sonnet-20240229',
          provider: 'claude',
          persona: 'personas/p_refactor.md'
        }
      ]
    }, null, 2));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n☇ Starting PAWS Multi-Agent Competition`));
  console.log(`Task: ${task.substring(0, 80)}...`);
  console.log(`Competitors: ${competitors.length}`);
  console.log(`Verification: ${verifyCmd ? 'Yes' : 'No'}`);

  // Run competition
  const results = await orchestrator.runCompetition(
    competitors,
    !options.sequential
  );

  // Generate report
  const exitCode = await orchestrator.generateReport(results);
  process.exit(exitCode);
}

// Export for use as a module
module.exports = {
  CompetitorConfig,
  CompetitionResult,
  LLMClient,
  ArenaOrchestrator,
  main
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
