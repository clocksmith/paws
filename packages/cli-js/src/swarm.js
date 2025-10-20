#!/usr/bin/env node
/**
 * PAWS Swarm - Swarm Intelligence Coordinator
 *
 * Unlike Paxos (competitive), Swarm enables agents to collaborate:
 * - Hierarchical task decomposition
 * - Real-time agent communication
 * - Multi-round consensus voting
 * - Specialized agent roles (architect, implementer, reviewer, tester)
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');

// Import from paxos module
const { LLMClient, CompetitorConfig } = require('./paxos');

/**
 * Specialized roles for swarm agents
 */
const AgentRole = {
  ARCHITECT: 'architect',      // High-level design decisions
  IMPLEMENTER: 'implementer',  // Code implementation
  REVIEWER: 'reviewer',        // Code review and critique
  TESTER: 'tester'            // Test case generation
};

/**
 * An agent in the swarm with a specialized role
 */
class SwarmAgent {
  constructor(name, role, config) {
    this.name = name;
    this.role = role;
    this.config = config;
    this._client = null;
  }

  get client() {
    if (!this._client) {
      this._client = new LLMClient(this.config);
    }
    return this._client;
  }
}

/**
 * A message in the swarm communication protocol
 */
class SwarmMessage {
  constructor(fromAgent, toAgent, roundNum, content, messageType) {
    this.fromAgent = fromAgent;
    this.toAgent = toAgent;  // null for broadcast
    this.roundNum = roundNum;
    this.content = content;
    this.messageType = messageType;  // proposal, critique, revision, vote
  }
}

/**
 * Hierarchical decomposition of a complex task
 */
class TaskDecomposition {
  constructor(taskId, description, subtasks = [], assignedTo = null, status = 'pending', solution = null) {
    this.taskId = taskId;
    this.description = description;
    this.subtasks = subtasks;
    this.assignedTo = assignedTo;
    this.status = status;  // pending, in_progress, completed
    this.solution = solution;
  }
}

/**
 * Orchestrates collaborative multi-agent problem solving
 */
class SwarmOrchestrator {
  constructor(task, contextBundle, outputDir = 'workspace/swarm') {
    this.task = task;
    this.contextBundle = contextBundle;
    this.outputDir = outputDir;
    this.contextContent = null;
    this.agents = [];
    this.messages = [];
    this.taskTree = null;
  }

  async initialize() {
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });

    // Load context
    this.contextContent = await fs.readFile(this.contextBundle, 'utf-8');
  }

  addAgent(agent) {
    this.agents.push(agent);
  }

  getAgentsByRole(role) {
    return this.agents.filter(a => a.role === role);
  }

  /**
   * Use architect agents to decompose the main task into subtasks
   */
  async decomposeTask() {
    console.log(chalk.cyan(`\n☇ PHASE 1: TASK DECOMPOSITION`));
    console.log(`${'='.repeat(60)}\n`);

    const architects = this.getAgentsByRole(AgentRole.ARCHITECT);

    if (architects.length === 0) {
      // Fallback: create a single task without decomposition
      return new TaskDecomposition('task_1', this.task, []);
    }

    // Ask architect to decompose the task
    const architect = architects[0];

    const prompt = `You are a senior software architect. Analyze this task and break it down into smaller, manageable subtasks.

TASK:
${this.task}

CONTEXT:
${this.contextContent.substring(0, 2000)}  // Truncated for brevity

INSTRUCTIONS:
Decompose this task into 2-5 clear subtasks that can be worked on semi-independently.
Return your response as JSON in this format:

{
  "subtasks": [
    {"id": "1", "description": "Subtask description"},
    {"id": "2", "description": "Another subtask"}
  ]
}`;

    console.log(chalk.gray(`[${architect.name}] Decomposing task...`));
    const { text: response } = await architect.client.generate(prompt);

    // Parse response
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        const subtasks = data.subtasks || [];

        const taskTree = new TaskDecomposition(
          'root',
          this.task,
          subtasks.map(st => new TaskDecomposition(st.id, st.description))
        );

        console.log(chalk.green(`\n[${architect.name}] Task decomposed into ${taskTree.subtasks.length} subtasks:`));
        for (const st of taskTree.subtasks) {
          console.log(`  - ${st.taskId}: ${st.description.substring(0, 60)}...`);
        }

        this.taskTree = taskTree;
        return taskTree;
      }
    } catch (error) {
      console.log(chalk.yellow(`[${architect.name}] Failed to parse decomposition: ${error.message}`));
    }

    // Fallback
    return new TaskDecomposition('task_1', this.task, []);
  }

  /**
   * Collaborative problem solving with multiple rounds:
   * 1. Implementer proposes solution
   * 2. Reviewer critiques
   * 3. Implementer revises
   */
  async solveSubtaskCollaboratively(subtask, roundLimit = 3) {
    console.log(chalk.cyan(`\n☇ SOLVING: ${subtask.description.substring(0, 60)}...`));
    console.log(`${'='.repeat(60)}\n`);

    const implementers = this.getAgentsByRole(AgentRole.IMPLEMENTER);
    const reviewers = this.getAgentsByRole(AgentRole.REVIEWER);

    if (implementers.length === 0) {
      console.log(chalk.red('No implementer agents available!'));
      return '';
    }

    const implementer = implementers[0];
    const reviewer = reviewers.length > 0 ? reviewers[0] : null;

    // Round 1: Initial proposal
    let currentSolution = await this._generateInitialSolution(implementer, subtask);

    // Rounds 2+: Critique and revision
    for (let roundNum = 2; roundNum <= roundLimit; roundNum++) {
      if (!reviewer) {
        break;
      }

      console.log(chalk.magenta(`\n--- Round ${roundNum}: Review and Revision ---`));

      // Reviewer critiques
      const critique = await this._generateCritique(reviewer, subtask, currentSolution);

      if (critique.includes('LGTM') || critique.toLowerCase().includes('looks good')) {
        console.log(chalk.green(`[${reviewer.name}] Approved solution`));
        break;
      }

      // Implementer revises
      currentSolution = await this._reviseSolution(implementer, subtask, currentSolution, critique);
    }

    return currentSolution;
  }

  async _generateInitialSolution(implementer, subtask) {
    console.log(chalk.gray(`[${implementer.name}] Generating initial solution...`));

    const prompt = `You are an experienced software engineer. Implement a solution for this subtask.

SUBTASK:
${subtask.description}

FULL CONTEXT:
${this.contextContent}

INSTRUCTIONS:
Generate a complete solution using the DOGS format for file changes:

🐕 --- DOGS_START_FILE: path/to/file.js ---
\`\`\`javascript
// Your implementation here
\`\`\`
🐕 --- DOGS_END_FILE: path/to/file.js ---`;

    const { text: response, token_count } = await implementer.client.generate(prompt);

    // Save message
    this.messages.push(new SwarmMessage(
      implementer.name,
      null,
      1,
      response,
      'proposal'
    ));

    console.log(chalk.green(`[${implementer.name}] Generated solution (${token_count} tokens)`));
    return response;
  }

  async _generateCritique(reviewer, subtask, solution) {
    console.log(chalk.gray(`[${reviewer.name}] Reviewing solution...`));

    const prompt = `You are a senior code reviewer. Review this solution and provide constructive feedback.

SUBTASK:
${subtask.description}

PROPOSED SOLUTION:
${solution}

INSTRUCTIONS:
Review the solution for:
- Correctness
- Code quality
- Edge cases
- Performance
- Security

If the solution is good, respond with "LGTM: [brief approval note]"
Otherwise, provide specific, actionable feedback for improvement.`;

    const { text: response, token_count } = await reviewer.client.generate(prompt);

    // Save message
    this.messages.push(new SwarmMessage(
      reviewer.name,
      null,
      2,
      response,
      'critique'
    ));

    console.log(chalk.green(`[${reviewer.name}] Review complete`));
    return response;
  }

  async _reviseSolution(implementer, subtask, originalSolution, critique) {
    console.log(chalk.gray(`[${implementer.name}] Revising based on feedback...`));

    const prompt = `You are revising your previous solution based on code review feedback.

SUBTASK:
${subtask.description}

YOUR PREVIOUS SOLUTION:
${originalSolution}

REVIEWER FEEDBACK:
${critique}

INSTRUCTIONS:
Address the reviewer's feedback and provide an improved solution using the same DOGS format.`;

    const { text: response, token_count } = await implementer.client.generate(prompt);

    // Save message
    this.messages.push(new SwarmMessage(
      implementer.name,
      null,
      3,
      response,
      'revision'
    ));

    console.log(chalk.green(`[${implementer.name}] Revision complete`));
    return response;
  }

  /**
   * Merge multiple subtask solutions into a coherent whole
   */
  async mergeSolutions(solutions) {
    console.log(chalk.cyan(`\n☇ PHASE 3: SOLUTION INTEGRATION`));
    console.log(`${'='.repeat(60)}\n`);

    const architects = this.getAgentsByRole(AgentRole.ARCHITECT);

    if (architects.length === 0 || Object.keys(solutions).length <= 1) {
      // Just concatenate if no architect or only one solution
      return Object.values(solutions).join('\n\n');
    }

    const architect = architects[0];

    const solutionsText = Object.entries(solutions)
      .map(([taskId, solution]) => `SUBTASK: ${taskId}\n${solution}`)
      .join('\n\n---\n\n');

    const prompt = `You are integrating multiple subtask solutions into a coherent whole.

ORIGINAL TASK:
${this.task}

SUBTASK SOLUTIONS:
${solutionsText}

INSTRUCTIONS:
Merge these solutions into a single, coherent implementation.
Ensure proper integration, no conflicts, and consistent style.
Use the DOGS format for the final merged solution.`;

    console.log(chalk.gray(`[${architect.name}] Integrating solutions...`));
    const { text: response } = await architect.client.generate(prompt);
    console.log(chalk.green(`[${architect.name}] Integration complete`));

    return response;
  }

  /**
   * Main swarm orchestration flow:
   * 1. Decompose task (Architect)
   * 2. Solve subtasks collaboratively (Implementer + Reviewer)
   * 3. Integrate solutions (Architect)
   */
  async runSwarm() {
    console.log(chalk.cyan(`\n☇ Starting PAWS Swarm Intelligence`));
    console.log(`Task: ${this.task.substring(0, 80)}...`);
    console.log(`Agents: ${this.agents.length}`);
    console.log();

    // Phase 1: Decomposition
    const taskTree = await this.decomposeTask();

    // Phase 2: Collaborative solving
    console.log(chalk.cyan(`\n☇ PHASE 2: COLLABORATIVE SOLVING`));
    console.log(`${'='.repeat(60)}\n`);

    let solutions = {};

    if (taskTree.subtasks.length === 0) {
      // No decomposition, solve as single task
      const implementer = this.getAgentsByRole(AgentRole.IMPLEMENTER)[0];
      const solution = await this._generateInitialSolution(
        implementer,
        new TaskDecomposition('main', this.task)
      );
      solutions['main'] = solution;
    } else {
      for (const subtask of taskTree.subtasks) {
        const solution = await this.solveSubtaskCollaboratively(subtask);
        solutions[subtask.taskId] = solution;
      }
    }

    // Phase 3: Integration
    const finalSolution = await this.mergeSolutions(solutions);

    // Save final solution
    const outputPath = path.join(this.outputDir, 'swarm_solution.dogs.md');
    await fs.writeFile(outputPath, finalSolution);

    console.log(chalk.green(`\n♲ Final solution saved to: ${outputPath}`));
    console.log(chalk.green(`♲ Total messages exchanged: ${this.messages.length}`));

    return outputPath;
  }
}

/**
 * Main CLI function
 */
async function main() {
  const program = new Command();

  program
    .name('paws-swarm')
    .description('PAWS Swarm - Collaborative multi-agent problem solving')
    .argument('[task]', 'Task description')
    .argument('[context_bundle]', 'Context bundle path')
    .option('--config <path>', 'Agent config file', 'packages/core/configs/paxos_config.json')
    .option('--output-dir <path>', 'Output directory', 'workspace/swarm')
    .option('--rounds <number>', 'Max collaboration rounds', '3')
    .parse(process.argv);

  const options = program.opts();
  let [task, contextBundle] = program.args;

  // Interactive prompts
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  if (!task) {
    task = await question('Enter task description:\n> ');
  }

  if (!contextBundle) {
    contextBundle = await question('Enter context bundle path:\n> ');
  }

  rl.close();

  // Create orchestrator
  const orchestrator = new SwarmOrchestrator(task, contextBundle, options.outputDir);
  await orchestrator.initialize();

  // Load config and create agents
  try {
    const configData = JSON.parse(await fs.readFile(options.config, 'utf-8'));

    // Create swarm with specialized roles
    const competitors = configData.competitors || [];

    // Assign roles (simple strategy: first is architect, rest split between implementer/reviewer)
    for (let i = 0; i < competitors.length; i++) {
      const comp = competitors[i];
      const provider = comp.provider || 'gemini';

      let role;
      if (i === 0) {
        role = AgentRole.ARCHITECT;
      } else if (i % 2 === 1) {
        role = AgentRole.IMPLEMENTER;
      } else {
        role = AgentRole.REVIEWER;
      }

      const agent = new SwarmAgent(
        comp.name,
        role,
        new CompetitorConfig({
          name: comp.name,
          model_id: comp.model_id,
          persona_file: comp.persona,
          provider,
          temperature: comp.temperature || 0.7,
          max_tokens: comp.max_tokens || 4000
        })
      );

      orchestrator.addAgent(agent);
      console.log(chalk.gray(`Added agent: ${agent.name} (${agent.role})`));
    }
  } catch (error) {
    console.error(chalk.red(`Error: Config file not found: ${options.config}`));
    process.exit(1);
  }

  // Run swarm
  const solutionPath = await orchestrator.runSwarm();

  console.log(chalk.green(`\n☉ Swarm collaboration complete!`));
  console.log(chalk.cyan(`Review solution: node packages/cli-js/src/dogs.js ${solutionPath} --interactive`));

  process.exit(0);
}

// Export for use as a module
module.exports = {
  AgentRole,
  SwarmAgent,
  SwarmMessage,
  TaskDecomposition,
  SwarmOrchestrator
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
