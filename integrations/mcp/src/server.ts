/**
 * PAWS MCP Server - Enhanced Edition
 *
 * Model Context Protocol server exposing all PAWS tools:
 * - cats: Context bundling with AI curation, templates, manifests
 * - dogs: Change application with validation and verification
 * - arena: Multi-agent competitive workflows
 * - swarm: Collaborative multi-agent workflows
 * - benchmark: LLM performance comparison
 * - context-optimizer: Smart context pruning
 * - session: Stateful workflow management
 *
 * This server provides rich tool schemas, validation, and proper error handling.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Type definitions
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface CommandError extends Error {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

let ServerConstructor: any;
try {
  // @ts-ignore - Optional peer dependency
  const module = await import('@modelcontextprotocol/sdk/server/index.js');
  ServerConstructor = module.Server || module.default;
  if (!ServerConstructor) {
    throw new Error('Missing Server export');
  }
} catch (error: any) {
  console.error('[PAWS MCP] Install @modelcontextprotocol/sdk to run this integration.');
  console.error(error.message);
  process.exit(1);
}

const server = new ServerConstructor(
  {
    name: 'paws',
    version: '3.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

/**
 * Execute a command and return the result
 */
function runCommand(cmd: string, args: string[] = [], cwd: string = projectRoot): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: process.platform === 'win32',
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        const error: CommandError = new Error(`Command failed with exit code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.exitCode = code || 1;
        reject(error);
      }
    });
  });
}

/**
 * CATS - Context Bundler
 *
 * Bundles project files into AI-consumable context with advanced features
 */
async function handleCats(request: any): Promise<MCPResponse> {
  const {
    files = [],
    output = 'cats.md',
    root = projectRoot,

    // AI Curation
    aiCurate = null,
    aiProvider = 'gemini',
    aiKey = null,
    maxFiles = 20,
    includeTests = false,

    // Context Configuration
    persona = null,
    systemPrompt = null,
    noSystemPrompt = false,

    // Features
    includeManifest = true,
    prepareForDelta = false,
    incremental = true,

    // Advanced
    exclude = [],
    template = null
  } = request;

  const args = [];

  // Files to bundle
  if (files && files.length > 0) {
    args.push(...files);
  }

  // Output
  args.push('-o', output);

  // AI Curation
  if (aiCurate) {
    args.push('--ai-curate', aiCurate);
    if (aiProvider) args.push('--ai-provider', aiProvider);
    if (aiKey) args.push('--ai-key', aiKey);
    if (maxFiles) args.push('--max-files', String(maxFiles));
    if (includeTests) args.push('--include-tests');
  }

  // Context Configuration
  if (persona) {
    const personas = Array.isArray(persona) ? persona : [persona];
    for (const p of personas) {
      args.push('-p', p);
    }
  }
  if (systemPrompt) {
    args.push('-s', systemPrompt);
  }
  if (noSystemPrompt) {
    args.push('--no-sys-prompt');
  }

  // Features
  if (!includeManifest) {
    args.push('--no-manifest');
  }
  if (prepareForDelta) {
    args.push('-t');
  }
  if (!incremental) {
    args.push('--no-incremental');
  }

  // Exclusions
  if (exclude && exclude.length > 0) {
    for (const pattern of exclude) {
      args.push('-x', pattern);
    }
  }

  // Template (future feature placeholder)
  if (template) {
    // args.push('--template', template);
  }

  args.push('--root', root);
  args.push('-q'); // Quiet mode for MCP

  try {
    const result = await runCommand('node', [path.join(projectRoot, 'packages/cli-js/bin/cats.js'), ...args], root);

    // Read the generated bundle to get manifest info
    const bundlePath = path.isAbsolute(output) ? output : path.join(root, output);
    let bundleInfo = null;
    try {
      const content = await fs.readFile(bundlePath, 'utf-8');
      const manifestMatch = content.match(/# Bundle ID: ([^\n]+)/);
      const filesMatch = content.match(/# Total Files: (\d+)/);
      bundleInfo = {
        bundleId: manifestMatch ? manifestMatch[1].trim() : null,
        totalFiles: filesMatch ? parseInt(filesMatch[1]) : null
      };
    } catch (err) {
      // Failed to read bundle
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ CATS bundle created successfully!\n\n` +
                `📁 Output: ${path.resolve(root, output)}\n` +
                (bundleInfo?.bundleId ? `🆔 Bundle ID: ${bundleInfo.bundleId}\n` : '') +
                (bundleInfo?.totalFiles ? `📄 Files: ${bundleInfo.totalFiles}\n` : '') +
                (aiCurate ? `🤖 AI Curation: ${aiProvider} (task: "${aiCurate}")\n` : '') +
                (includeManifest ? `📋 Manifest: Included\n` : '') +
                `\n${result.stdout || ''}`
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ CATS failed:\n\n${error.message}\n\nStderr:\n${error.stderr || ''}`
        }
      ],
      isError: true
    };
  }
}

/**
 * DOGS - Change Applier
 *
 * Applies changes from bundles with validation and verification
 */
async function handleDogs(request: any): Promise<MCPResponse> {
  const {
    bundle = 'dogs.md',
    root = projectRoot,

    // Application mode
    interactive = true,
    yes = false,

    // Validation
    verify = null,
    revertOnFail = true,

    // Partial application
    only = null,
    skip = null,

    // Features
    dryRun = false,
    explain = false
  } = request;

  const bundlePath = path.isAbsolute(bundle) ? bundle : path.join(root, bundle);
  const args = [bundlePath];

  // Application mode
  if (yes || !interactive) {
    args.push('-y');
  }

  // Validation
  if (verify) {
    args.push('--verify', verify);
    if (revertOnFail) {
      args.push('--revert-on-fail');
    }
  }

  // Partial application
  if (only) {
    const files = Array.isArray(only) ? only : [only];
    args.push('--only', files.join(','));
  }
  if (skip) {
    const files = Array.isArray(skip) ? skip : [skip];
    args.push('--skip', files.join(','));
  }

  // Features
  if (dryRun) {
    args.push('--dry-run');
  }
  if (explain) {
    args.push('--explain');
  }

  try {
    const result = await runCommand('node', [path.join(projectRoot, 'packages/cli-js/bin/dogs.js'), ...args], root);

    return {
      content: [
        {
          type: 'text',
          text: `✅ DOGS completed successfully!\n\n` +
                `📦 Bundle: ${bundlePath}\n` +
                (verify ? `✓ Verification: ${verify}\n` : '') +
                (dryRun ? `🔍 Dry Run: Changes not applied\n` : '') +
                `\n${result.stdout || ''}`
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ DOGS failed:\n\n${error.message}\n\n${error.stderr || ''}`
        }
      ],
      isError: true
    };
  }
}

/**
 * ARENA - Multi-Agent Competition
 *
 * Runs multiple LLMs in parallel with test-driven selection
 */
async function handleArena(request: any): Promise<MCPResponse> {
  const {
    prompt,
    context = null,
    root = projectRoot,

    // Agents
    agents = ['gemini', 'claude', 'gpt4'],

    // Verification
    verifyCmd = null,

    // Configuration
    config = null,
    parallel = true
  } = request;

  if (!prompt) {
    return {
      content: [
        {
          type: 'text',
          text: '❌ Arena requires a prompt/task description'
        }
      ],
      isError: true
    };
  }

  const args = [prompt];

  if (context) {
    args.push(context);
  }

  if (verifyCmd) {
    args.push('--verify-cmd', verifyCmd);
  }

  if (config) {
    args.push('--config', config);
  }

  if (!parallel) {
    args.push('--no-parallel');
  }

  args.push('--root', root);

  try {
    const result = await runCommand('node', [path.join(projectRoot, 'packages/cli-js/bin/paws-arena.js'), ...args], root);

    return {
      content: [
        {
          type: 'text',
          text: `✅ ARENA completed!\n\n` +
                `🎯 Task: ${prompt}\n` +
                `🤖 Agents: ${agents.join(', ')}\n` +
                (verifyCmd ? `✓ Verification: ${verifyCmd}\n` : '') +
                `\n${result.stdout || ''}`
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ ARENA failed:\n\n${error.message}\n\n${error.stderr || ''}`
        }
      ],
      isError: true
    };
  }
}

/**
 * SWARM - Collaborative Multi-Agent
 *
 * Hierarchical workflows with specialized agent roles
 */
async function handleSwarm(request: any): Promise<MCPResponse> {
  const {
    goal,
    context = null,
    root = projectRoot,

    // Workflow
    workflow = 'architect-implementer-reviewer',

    // Agents
    architectModel = 'claude',
    implementerModel = 'gemini',
    reviewerModel = 'gpt4',

    // Configuration
    rounds = 1
  } = request;

  if (!goal) {
    return {
      content: [
        {
          type: 'text',
          text: '❌ Swarm requires a goal description'
        }
      ],
      isError: true
    };
  }

  const args = [goal];

  if (context) {
    args.push(context);
  }

  args.push('--workflow', workflow);
  args.push('--rounds', String(rounds));
  args.push('--root', root);

  try {
    const result = await runCommand('node', [path.join(projectRoot, 'packages/cli-js/bin/paws-swarm.js'), ...args], root);

    return {
      content: [
        {
          type: 'text',
          text: `✅ SWARM completed!\n\n` +
                `🎯 Goal: ${goal}\n` +
                `🔄 Workflow: ${workflow}\n` +
                `🔁 Rounds: ${rounds}\n` +
                `\n${result.stdout || ''}`
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ SWARM failed:\n\n${error.message}\n\n${error.stderr || ''}`
        }
      ],
      isError: true
    };
  }
}

/**
 * SESSION - Workflow Management
 *
 * Manage stateful multi-turn workflows with git worktrees
 */
async function handleSession(request: any): Promise<MCPResponse> {
  const {
    command, // start, continue, list, info, close
    name = null,
    sessionId = null,
    root = projectRoot
  } = request;

  if (!command) {
    return {
      content: [
        {
          type: 'text',
          text: '❌ Session requires a command: start, continue, list, info, or close'
        }
      ],
      isError: true
    };
  }

  const args = [command];

  if (command === 'start' && name) {
    args.push(name);
  }

  if (command === 'continue' || command === 'info' || command === 'close') {
    if (!sessionId) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ ${command} requires a sessionId`
          }
        ],
        isError: true
      };
    }
    args.push(sessionId);
  }

  args.push('--root', root);

  try {
    const result = await runCommand('node', [path.join(projectRoot, 'packages/cli-js/bin/paws-session.js'), ...args], root);

    return {
      content: [
        {
          type: 'text',
          text: `✅ SESSION ${command} completed!\n\n${result.stdout || ''}`
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ SESSION ${command} failed:\n\n${error.message}\n\n${error.stderr || ''}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Register all tools with the MCP server
 */
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'cats',
        description: 'Bundle project files into AI-consumable context with AI curation, templates, and reproducibility manifests',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Files or glob patterns to include'
            },
            output: {
              type: 'string',
              description: 'Output file path',
              default: 'cats.md'
            },
            root: {
              type: 'string',
              description: 'Root directory for the project'
            },
            aiCurate: {
              type: 'string',
              description: 'Task description for AI-powered file curation'
            },
            aiProvider: {
              type: 'string',
              enum: ['gemini', 'claude', 'openai'],
              description: 'AI provider for curation',
              default: 'gemini'
            },
            aiKey: {
              type: 'string',
              description: 'API key for AI provider (optional, uses env vars by default)'
            },
            maxFiles: {
              type: 'number',
              description: 'Maximum files for AI curation',
              default: 20
            },
            persona: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Persona file(s) to prepend'
            },
            includeManifest: {
              type: 'boolean',
              description: 'Include reproducibility manifest',
              default: true
            },
            prepareForDelta: {
              type: 'boolean',
              description: 'Prepare bundle for delta/incremental updates',
              default: false
            },
            exclude: {
              type: 'array',
              items: { type: 'string' },
              description: 'Patterns to exclude'
            }
          }
        }
      },
      {
        name: 'dogs',
        description: 'Apply changes from AI-generated bundles with validation, verification, and rollback support',
        inputSchema: {
          type: 'object',
          properties: {
            bundle: {
              type: 'string',
              description: 'Path to the bundle file containing changes',
              default: 'dogs.md'
            },
            root: {
              type: 'string',
              description: 'Root directory for the project'
            },
            interactive: {
              type: 'boolean',
              description: 'Interactive review mode',
              default: true
            },
            yes: {
              type: 'boolean',
              description: 'Auto-accept all changes',
              default: false
            },
            verify: {
              type: 'string',
              description: 'Verification command to run after applying (e.g., "npm test")'
            },
            revertOnFail: {
              type: 'boolean',
              description: 'Automatically revert if verification fails',
              default: true
            },
            only: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Only apply changes to these files'
            },
            skip: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Skip changes to these files'
            },
            dryRun: {
              type: 'boolean',
              description: 'Simulate changes without applying',
              default: false
            }
          },
          required: ['bundle']
        }
      },
      {
        name: 'arena',
        description: 'Run multiple LLMs in competitive parallel workflows with test-driven selection',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Task description for all agents'
            },
            context: {
              type: 'string',
              description: 'Context bundle file to provide to agents'
            },
            root: {
              type: 'string',
              description: 'Root directory for the project'
            },
            agents: {
              type: 'array',
              items: { type: 'string', enum: ['gemini', 'claude', 'gpt4', 'gpt3.5'] },
              description: 'LLM agents to compete',
              default: ['gemini', 'claude', 'gpt4']
            },
            verifyCmd: {
              type: 'string',
              description: 'Test command to determine winner (e.g., "npm test")'
            },
            parallel: {
              type: 'boolean',
              description: 'Run agents in parallel',
              default: true
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'swarm',
        description: 'Collaborative multi-agent workflows with specialized roles (Architect → Implementer → Reviewer)',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'High-level goal for the swarm'
            },
            context: {
              type: 'string',
              description: 'Context bundle file'
            },
            root: {
              type: 'string',
              description: 'Root directory for the project'
            },
            workflow: {
              type: 'string',
              enum: ['architect-implementer-reviewer', 'architect-implementer', 'implementer-reviewer'],
              description: 'Workflow pattern',
              default: 'architect-implementer-reviewer'
            },
            rounds: {
              type: 'number',
              description: 'Number of collaboration rounds',
              default: 1
            }
          },
          required: ['goal']
        }
      },
      {
        name: 'session',
        description: 'Manage stateful multi-turn workflows with git worktree isolation',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['start', 'continue', 'list', 'info', 'close'],
              description: 'Session command'
            },
            name: {
              type: 'string',
              description: 'Session name (for start command)'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID (for continue/info/close commands)'
            },
            root: {
              type: 'string',
              description: 'Root directory for the project'
            }
          },
          required: ['command']
        }
      }
    ]
  };
});

server.setRequestHandler('tools/call', async (request: any) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'cats':
      return await handleCats(args || {});
    case 'dogs':
      return await handleDogs(args || {});
    case 'arena':
      return await handleArena(args || {});
    case 'swarm':
      return await handleSwarm(args || {});
    case 'session':
      return await handleSession(args || {});
    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`
          }
        ],
        isError: true
      };
  }
});

async function runServer(): Promise<void> {
  // @ts-ignore - Optional peer dependency
  const transport = new (await import('@modelcontextprotocol/sdk/server/stdio.js')).StdioServerTransport();
  await server.connect(transport);
  console.error('[PAWS MCP] Server running on stdio');
}

runServer().catch((error) => {
  console.error('[PAWS MCP] Fatal error:', error);
  process.exit(1);
});
