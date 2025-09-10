#!/usr/bin/env node
/**
 * Enhanced CATS bundler with AI-curated context selection.
 * Part of the PAWS CLI Evolution - Phase 2 Implementation.
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const ignore = require('ignore');
const chalk = require('chalk');
const ora = require('ora');
const { program } = require('commander');

// AI Provider SDKs
let GoogleGenerativeAI, Anthropic, OpenAI;

try {
  ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch {
  console.warn('Google Generative AI not installed. Gemini support disabled.');
}

try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  console.warn('Anthropic SDK not installed. Claude support disabled.');
}

try {
  OpenAI = require('openai');
} catch {
  console.warn('OpenAI SDK not installed. OpenAI support disabled.');
}

// For git operations
let simpleGit;
try {
  simpleGit = require('simple-git');
} catch {
  console.warn('simple-git not installed. Git-based file discovery disabled.');
}

/**
 * Represents a file or directory in the project tree
 */
class FileTreeNode {
  constructor(filePath, isDir = false, size = 0) {
    this.path = filePath;
    this.isDir = isDir;
    this.size = size;
    this.children = [];
  }

  /**
   * Add a child node
   */
  addChild(node) {
    this.children.push(node);
  }

  /**
   * Convert to string representation for LLM context
   */
  toString(indent = 0) {
    const prefix = '  '.repeat(indent);
    const name = path.basename(this.path);
    
    if (this.isDir) {
      let result = `${prefix}${name}/\n`;
      for (const child of this.children) {
        result += child.toString(indent + 1);
      }
      return result;
    } else {
      const sizeStr = this.size > 0 ? ` (${this.size} bytes)` : '';
      return `${prefix}${name}${sizeStr}\n`;
    }
  }
}

/**
 * Analyzes project structure for AI curation
 */
class ProjectAnalyzer {
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
    this.gitignorePatterns = null;
    this.ig = ignore();
  }

  /**
   * Load gitignore patterns
   */
  async loadGitignore() {
    const patterns = [];
    
    try {
      const gitignorePath = path.join(this.rootPath, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          patterns.push(trimmed);
          this.ig.add(trimmed);
        }
      }
    } catch {
      // No .gitignore file
    }

    // Always ignore common patterns
    const defaultPatterns = [
      'node_modules',
      '.git',
      '.venv',
      'venv',
      'env',
      '.env',
      '*.log',
      '.DS_Store',
      'dist',
      'build',
      '*.pyc',
      '__pycache__',
      '.idea',
      '.vscode'
    ];

    for (const pattern of defaultPatterns) {
      this.ig.add(pattern);
      patterns.push(pattern);
    }

    this.gitignorePatterns = patterns;
    return patterns;
  }

  /**
   * Check if path should be ignored
   */
  shouldIgnore(filePath) {
    const relativePath = path.relative(this.rootPath, filePath);
    return this.ig.ignores(relativePath);
  }

  /**
   * Build a tree representation of the project
   */
  async buildFileTree() {
    await this.loadGitignore();
    
    if (simpleGit) {
      try {
        return await this.buildTreeWithGit();
      } catch {
        // Fallback to filesystem walk
      }
    }
    
    return await this.buildTreeWithWalk();
  }

  /**
   * Build tree using git ls-files
   */
  async buildTreeWithGit() {
    const git = simpleGit(this.rootPath);
    const files = await git.raw(['ls-files']);
    const fileList = files.split('\n').filter(f => f);
    
    const root = new FileTreeNode(this.rootPath, true);
    const nodes = new Map();
    nodes.set(this.rootPath, root);

    for (const filePath of fileList) {
      const fullPath = path.join(this.rootPath, filePath);
      await this.addFileToTree(fullPath, root, nodes);
    }

    return root;
  }

  /**
   * Build tree by walking filesystem
   */
  async buildTreeWithWalk() {
    const root = new FileTreeNode(this.rootPath, true);
    const nodes = new Map();
    nodes.set(this.rootPath, root);

    const walkDir = async (dirPath, parentNode) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldIgnore(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          const dirNode = new FileTreeNode(fullPath, true);
          parentNode.addChild(dirNode);
          nodes.set(fullPath, dirNode);
          await walkDir(fullPath, dirNode);
        } else {
          const stats = await fs.stat(fullPath);
          const fileNode = new FileTreeNode(fullPath, false, stats.size);
          parentNode.addChild(fileNode);
        }
      }
    };

    await walkDir(this.rootPath, root);
    return root;
  }

  /**
   * Add a file to the tree structure
   */
  async addFileToTree(filePath, root, nodes) {
    const relativePath = path.relative(this.rootPath, filePath);
    const parts = relativePath.split(path.sep);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = path.join(this.rootPath, ...parts.slice(0, i + 1));
      
      if (!nodes.has(dirPath)) {
        const dirNode = new FileTreeNode(dirPath, true);
        nodes.set(dirPath, dirNode);
        current.addChild(dirNode);
        current = dirNode;
      } else {
        current = nodes.get(dirPath);
      }
    }

    // Add the file
    try {
      const stats = await fs.stat(filePath);
      const fileNode = new FileTreeNode(filePath, false, stats.size);
      current.addChild(fileNode);
    } catch {
      // File doesn't exist or can't be accessed
    }
  }
}

/**
 * Handles AI-powered context curation
 */
class AICurator {
  constructor(apiKey, provider = 'gemini') {
    this.provider = provider;
    this.apiKey = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    this.client = null;

    if (!this.apiKey) {
      throw new Error(`No API key provided for ${provider}`);
    }

    this.initializeClient();
  }

  /**
   * Initialize the AI client based on provider
   */
  initializeClient() {
    switch (this.provider) {
      case 'gemini':
        if (!GoogleGenerativeAI) {
          throw new Error('Google Generative AI SDK not installed');
        }
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.client = genAI.getGenerativeModel({ model: 'gemini-pro' });
        break;

      case 'claude':
        if (!Anthropic) {
          throw new Error('Anthropic SDK not installed');
        }
        this.client = new Anthropic({ apiKey: this.apiKey });
        break;

      case 'openai':
        if (!OpenAI) {
          throw new Error('OpenAI SDK not installed');
        }
        this.client = new OpenAI({ apiKey: this.apiKey });
        break;

      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  /**
   * Use AI to select relevant files for the task
   */
  async curateFiles(taskDescription, fileTree, maxFiles = 20) {
    const prompt = this.buildCurationPrompt(taskDescription, fileTree, maxFiles);
    
    switch (this.provider) {
      case 'gemini':
        return await this.curateWithGemini(prompt);
      case 'claude':
        return await this.curateWithClaude(prompt);
      case 'openai':
        return await this.curateWithOpenAI(prompt);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  /**
   * Build the prompt for file curation
   */
  buildCurationPrompt(task, tree, maxFiles) {
    return `You are an expert Staff Software Engineer specializing in codebase analysis.
Your task is to identify the most relevant set of files for a developer to complete a task.

**Task Description:**
${task}

**Project File Tree:**
\`\`\`
${tree}
\`\`\`

**Instructions:**
1. Analyze the task and the file tree carefully
2. Identify a concise set of files (maximum ${maxFiles}) that are absolutely essential
3. Prioritize:
   - Core implementation files directly related to the task
   - Interface/API definitions that need modification
   - Configuration files if relevant
   - Data models or schemas that are affected
4. AVOID including:
   - Test files (unless the task is specifically about testing)
   - Documentation files (unless the task is about documentation)
   - Build artifacts or generated files
   - Unrelated modules or components

**Output Format:**
Return ONLY a JSON object with a single key "files" containing an array of relative file paths.
Do not include any explanation or other text.

Example:
{"files": ["src/auth/login.js", "src/models/user.js", "config/auth.yaml"]}`;
  }

  /**
   * Use Gemini to curate files
   */
  async curateWithGemini(prompt) {
    try {
      const result = await this.client.generateContent(prompt);
      const response = await result.response;
      return this.parseAIResponse(response.text());
    } catch (error) {
      console.error(`Gemini curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Use Claude to curate files
   */
  async curateWithClaude(prompt) {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });
      return this.parseAIResponse(response.content[0].text);
    } catch (error) {
      console.error(`Claude curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Use OpenAI to curate files
   */
  async curateWithOpenAI(prompt) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });
      return this.parseAIResponse(response.choices[0].message.content);
    } catch (error) {
      console.error(`OpenAI curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse the AI response to extract file paths
   */
  parseAIResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data.files || [];
      }
    } catch {
      // JSON parsing failed
    }

    // Fallback: extract file paths directly
    const paths = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && 
          (trimmed.endsWith('.js') || trimmed.endsWith('.ts') || 
           trimmed.endsWith('.jsx') || trimmed.endsWith('.tsx') ||
           trimmed.endsWith('.json') || trimmed.endsWith('.yaml') ||
           trimmed.endsWith('.yml') || trimmed.endsWith('.md'))) {
        // Clean up the path
        const cleaned = trimmed.replace(/["`',]/g, '');
        if (cleaned && !cleaned.startsWith('#')) {
          paths.push(cleaned);
        }
      }
    }

    return paths;
  }
}

/**
 * Enhanced CATS bundler with AI curation support
 */
class CatsBundler {
  constructor(config) {
    this.config = config;
    this.rootPath = path.resolve(config.root || '.');
  }

  /**
   * Check if file is binary
   */
  async isBinary(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const slice = buffer.slice(0, 1024);
      
      // Check for null bytes
      for (let i = 0; i < slice.length; i++) {
        if (slice[i] === 0) return true;
      }
      
      // Try to decode as UTF-8
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(slice);
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Create a CATS bundle with optional AI curation
   */
  async createBundle(files, aiCurate, aiProvider = 'gemini', aiKey) {
    // Get files to bundle
    if (aiCurate) {
      const spinner = ora('AI is analyzing your codebase...').start();
      files = await this.getAICuratedFiles(aiCurate, aiProvider, aiKey);
      spinner.stop();
      
      if (!files || files.length === 0) {
        console.log(chalk.red('AI curation failed or returned no files.'));
        return '';
      }
    }

    if (!files || files.length === 0) {
      // Handle glob patterns and directories
      if (this.config.root) {
        files = ['**/*.js', '**/*.py', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.md'];
      } else {
        if (!this.config.quiet) {
          console.log(chalk.red('No files specified for bundling.'));
        }
        return '';
      }
    }

    // Build the bundle
    const bundleLines = [];
    
    // Add system prompt if configured
    if (this.config.sysPromptFile) {
      try {
        const sysPromptPath = path.resolve(this.config.sysPromptFile);
        const sysPromptContent = await fs.readFile(sysPromptPath, 'utf-8');
        bundleLines.push(sysPromptContent);
        bundleLines.push('\n--- END PREPENDED INSTRUCTIONS ---\n');
        bundleLines.push('');
      } catch (error) {
        if (this.config.requireSysPrompt) {
          throw new Error(`System prompt file not found: ${this.config.sysPromptFile}`);
        }
      }
    }
    
    // Add persona files
    if (this.config.persona && this.config.persona.length > 0) {
      for (const personaFile of this.config.persona) {
        try {
          bundleLines.push('\n--- START PERSONA ---');
          const personaPath = path.resolve(personaFile);
          const personaContent = await fs.readFile(personaPath, 'utf-8');
          bundleLines.push(personaContent);
          bundleLines.push('--- END PERSONA ---\n');
          bundleLines.push('');
        } catch (error) {
          if (!this.config.quiet) {
            console.log(chalk.yellow(`Warning: Persona file not found: ${personaFile}`));
          }
        }
      }
    }
    
    bundleLines.push('# Cats Bundle');
    if (this.config.prepareForDelta) {
      bundleLines.push('# Format: DELTA');
      bundleLines.push('# Delta Reference: Yes');
    } else {
      bundleLines.push('# Format: FULL');
    }
    bundleLines.push('');

    for (const filePath of files) {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.rootPath, filePath);
      
      try {
        await fs.access(fullPath);
      } catch {
        if (!this.config.quiet) {
          console.log(chalk.yellow(`Warning: File not found: ${filePath}`));
        }
        continue;
      }

      try {
        // Check if binary
        const isBinary = await this.isBinary(fullPath);
        let content;

        if (isBinary) {
          const buffer = await fs.readFile(fullPath);
          content = buffer.toString('base64');
          bundleLines.push(`🐈 --- CATS_START_FILE: ${filePath} (Content:Base64) ---`);
        } else {
          content = await fs.readFile(fullPath, 'utf-8');
          bundleLines.push(`🐈 --- CATS_START_FILE: ${filePath} ---`);
          
          // Add language hint
          const ext = path.extname(fullPath).slice(1);
          if (ext) {
            bundleLines.push(`\`\`\`${ext}`);
          }
        }

        bundleLines.push(content);

        if (!isBinary) {
          const ext = path.extname(fullPath).slice(1);
          if (ext) {
            bundleLines.push('```');
          }
        }

        bundleLines.push(`🐈 --- CATS_END_FILE: ${filePath} ---`);
        bundleLines.push('');

        if (!this.config.quiet) {
          console.log(chalk.green(`✓ Added: ${filePath}`));
        }

      } catch (error) {
        if (!this.config.quiet) {
          console.log(chalk.red(`✗ Failed to add ${filePath}: ${error.message}`));
        }
      }
    }

    return bundleLines.join('\n');
  }

  /**
   * Get AI-curated list of files for the task
   */
  async getAICuratedFiles(task, provider, apiKey) {
    console.log(chalk.blue(`[AI] Analyzing codebase for task: ${task.slice(0, 50)}...`));

    // Build file tree
    const analyzer = new ProjectAnalyzer(this.rootPath);
    const fileTree = await analyzer.buildFileTree();
    const treeStr = fileTree.toString();

    // Curate files with AI
    try {
      const curator = new AICurator(apiKey, provider);
      const files = await curator.curateFiles(task, treeStr, this.config.maxFiles);

      console.log(chalk.blue(`[AI] Selected ${files.length} files:`));
      for (const file of files) {
        console.log(chalk.gray(`  - ${file}`));
      }

      return files;
    } catch (error) {
      console.error(chalk.red(`[AI] Curation failed: ${error.message}`));
      return [];
    }
  }
}

/**
 * Main CLI
 */
async function main() {
  program
    .name('cats')
    .description('CATS - Bundle project files for AI/LLM consumption with optional AI curation')
    .argument('[files...]', 'Files to include in the bundle')
    .option('--ai-curate <task>', 'Use AI to select files based on task description')
    .option('--ai-provider <provider>', 'AI provider (gemini, claude, openai)', 'gemini')
    .option('--ai-key <key>', 'API key for AI provider')
    .option('-o, --output <file>', 'Output file for the bundle', 'cats.md')
    .option('-x, --exclude <pattern>', 'Exclude pattern (can be used multiple times)', (value, previous) => {
      return previous ? [...previous, value] : [value];
    }, [])
    .option('-p, --persona <file>', 'Persona file to prepend (can be used multiple times)', (value, previous) => {
      return previous ? [...previous, value] : [value];
    }, [])
    .option('-s, --sys-prompt-file <file>', 'System prompt file to prepend', 'sys/sys_a.md')
    .option('--no-sys-prompt', 'Disable system prompt prepending')
    .option('--require-sys-prompt', 'Fail if system prompt file not found')
    .option('-t, --prepare-for-delta', 'Prepare bundle for delta application')
    .option('--strict-catscan', 'Replace README.md with CATSCAN.md when available')
    .option('-N, --no-default-excludes', 'Disable default excludes')
    .option('--verify <module>', 'Verify module and extract API')
    .option('-q, --quiet', 'Suppress informational output')
    .option('-y, --yes', 'Auto-confirm all prompts')
    .option('--root <dir>', 'Root directory for relative paths', '.')
    .option('--max-files <n>', 'Maximum files for AI curation', '20')
    .option('--include-tests', 'Include test files in AI curation')
    .parse();

  const options = program.opts();
  const files = program.args;

  // Build config
  const config = {
    root: options.root,
    maxFiles: parseInt(options.maxFiles),
    includeTests: options.includeTests,
    exclude: options.exclude || [],
    persona: options.persona || [],
    sysPromptFile: options.sysPrompt === false ? null : options.sysPromptFile,
    requireSysPrompt: options.requireSysPrompt,
    prepareForDelta: options.prepareForDelta,
    strictCatscan: options.strictCatscan,
    noDefaultExcludes: options.noDefaultExcludes,
    verify: options.verify,
    quiet: options.quiet,
    yes: options.yes
  };

  try {
    // Create bundler
    const bundler = new CatsBundler(config);

    // Create bundle
    const bundleContent = await bundler.createBundle(
      files,
      options.aiCurate,
      options.aiProvider,
      options.aiKey
    );

    if (bundleContent) {
      // Write to output file or stdout
      if (options.output === '-') {
        console.log(bundleContent);
      } else {
        await fs.writeFile(options.output, bundleContent, 'utf-8');
        if (!options.quiet) {
          console.log(chalk.green(`\n✓ Bundle written to: ${options.output}`));
        }
      }
      return 0;
    } else {
      if (!options.quiet) {
        console.log(chalk.red('✗ Failed to create bundle'));
      }
      return 1;
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  main().then(code => process.exit(code));
}

// Export for use as module
module.exports = {
  FileTreeNode,
  ProjectAnalyzer,
  AICurator,
  CatsBundler
};