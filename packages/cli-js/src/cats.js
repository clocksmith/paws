#!/usr/bin/env node
/**
 * Enhanced CATS bundler with AI-curated context selection.
 * Part of the PAWS CLI Evolution - Phase 2 Implementation.
 */
// @sync-checksum: 551a5f232e39d76d9a311b1e8914c35e460de00b0f579e4314bc7f1f950f1522

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const crypto = require('crypto');
const ignore = require('ignore');
const chalk = require('chalk');
const ora = require('ora');
const { program } = require('commander');
const { ProgressBus } = require('./progress-bus');
const { getSysPath, getPersonasPath } = require('@paws/core');

// Default system prompt from core package
const DEFAULT_SYS_PROMPT = path.join(getSysPath(), 'sys_a.md');

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
 * Persists bundle metadata to support incremental bundling.
 */
class CatsCache {
  constructor(rootPath, options = {}) {
    this.rootPath = path.resolve(rootPath);
    this.enabled = options.enabled !== false;
    this.cacheDir = path.join(this.rootPath, '.paws', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'cats-manifest.json');
    this.data = { version: 1, entries: {} };
    this.touched = new Set();
    this.loaded = false;
  }

  normalize(filePath) {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.rootPath, filePath);
    const relative = path.relative(this.rootPath, absolute) || path.basename(absolute);
    return relative.split(path.sep).join('/');
  }

  async load() {
    if (!this.enabled || this.loaded) {
      return;
    }

    try {
      const content = await fs.readFile(this.cacheFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.entries && typeof parsed.entries === 'object') {
        this.data = { ...parsed, entries: parsed.entries };
      }
    } catch {
      // No cache yet or unreadable; start fresh
      this.data = { version: 1, entries: {} };
    }

    this.loaded = true;
  }

  get(filePath) {
    if (!this.enabled) {
      return null;
    }
    const key = this.normalize(filePath);
    const entry = this.data.entries[key];
    if (entry) {
      this.touched.add(key);
    }
    return entry || null;
  }

  set(filePath, entry) {
    if (!this.enabled) {
      return;
    }
    const key = this.normalize(filePath);
    this.data.entries[key] = entry;
    this.touched.add(key);
  }

  purgeUnused() {
    if (!this.enabled) {
      return;
    }
    const entries = this.data.entries;
    for (const key of Object.keys(entries)) {
      if (!this.touched.has(key)) {
        delete entries[key];
      }
    }
  }

  async save() {
    if (!this.enabled) {
      return;
    }

    this.purgeUnused();

    const payload = {
      version: this.data.version,
      generatedAt: new Date().toISOString(),
      entries: this.data.entries
    };

    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this.cacheFile, JSON.stringify(payload, null, 2), 'utf-8');
  }
}

/**
 * Caches AI curation responses keyed by prompt hash.
 */
class AICache {
  constructor(rootPath, options = {}) {
    this.rootPath = path.resolve(rootPath);
    this.enabled = options.enabled !== false;
    this.ttlMs = options.ttlMs ?? 1000 * 60 * 60 * 24; // default 24h
    this.cacheDir = path.join(this.rootPath, '.paws', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'ai-curations.json');
    this.data = { version: 1, entries: {} };
    this.loaded = false;
    this.dirty = false;
  }

  async load() {
    if (!this.enabled || this.loaded) {
      return;
    }

    try {
      const content = await fs.readFile(this.cacheFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.entries && typeof parsed.entries === 'object') {
        this.data = { ...parsed, entries: parsed.entries };
      }
    } catch {
      this.data = { version: 1, entries: {} };
    }

    this.pruneExpired();
    this.loaded = true;
  }

  pruneExpired() {
    if (!this.enabled) {
      return;
    }

    if (!this.ttlMs) {
      return;
    }

    const now = Date.now();
    for (const [key, entry] of Object.entries(this.data.entries)) {
      if (!entry.timestamp || now - entry.timestamp > this.ttlMs) {
        delete this.data.entries[key];
        this.dirty = true;
      }
    }
  }

  get(key) {
    if (!this.enabled) {
      return null;
    }

    const entry = this.data.entries[key];
    if (!entry) {
      return null;
    }

    if (this.ttlMs && entry.timestamp && Date.now() - entry.timestamp > this.ttlMs) {
      delete this.data.entries[key];
      this.dirty = true;
      return null;
    }

    return entry;
  }

  set(key, value) {
    if (!this.enabled) {
      return;
    }

    this.data.entries[key] = {
      ...value,
      timestamp: Date.now()
    };
    this.dirty = true;
  }

  async save() {
    if (!this.enabled || !this.dirty) {
      return;
    }

    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(
      this.cacheFile,
      JSON.stringify(
        {
          version: this.data.version,
          generatedAt: new Date().toISOString(),
          entries: this.data.entries
        },
        null,
        2
      ),
      'utf-8'
    );
    this.dirty = false;
  }
}

/**
 * Handles AI-powered context curation
 */
class AICurator {
  constructor(apiKey, provider = 'gemini', options = {}) {
    this.provider = provider;
    this.apiKey = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    this.cache = options.cache && options.cache.enabled !== false ? options.cache : null;
    this.quiet = options.quiet ?? false;
    this.client = null;
    this.lastCacheStatus = 'unknown';

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
    const cacheKey = this.cache
      ? this.buildCacheKey(prompt, maxFiles)
      : null;

    if (cacheKey && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Array.isArray(cached.files)) {
        this.lastCacheStatus = 'hit';
        if (!this.quiet) {
          console.log(chalk.gray(`[AI] Using cached file selection (${cached.files.length} files).`));
        }
        return cached.files;
      }
    }

    this.lastCacheStatus = 'miss';
    
    switch (this.provider) {
      case 'gemini':
        return await this.curateWithGemini(prompt, cacheKey);
      case 'claude':
        return await this.curateWithClaude(prompt, cacheKey);
      case 'openai':
        return await this.curateWithOpenAI(prompt, cacheKey);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  buildCacheKey(prompt, maxFiles) {
    const hash = crypto.createHash('sha256').update(prompt).digest('hex');
    return `${this.provider}:${maxFiles}:${hash}`;
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
  async curateWithGemini(prompt, cacheKey) {
    try {
      const result = await this.client.generateContent(prompt);
      const response = await result.response;
      return await this.handleAIResponse(response.text(), cacheKey);
    } catch (error) {
      this.lastCacheStatus = 'error';
      console.error(`Gemini curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Use Claude to curate files
   */
  async curateWithClaude(prompt, cacheKey) {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });
      return await this.handleAIResponse(response.content[0].text, cacheKey);
    } catch (error) {
      this.lastCacheStatus = 'error';
      console.error(`Claude curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Use OpenAI to curate files
   */
  async curateWithOpenAI(prompt, cacheKey) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });
      return await this.handleAIResponse(response.choices[0].message.content, cacheKey);
    } catch (error) {
      this.lastCacheStatus = 'error';
      console.error(`OpenAI curation failed: ${error.message}`);
      return [];
    }
  }

  async handleAIResponse(raw, cacheKey) {
    const files = this.parseAIResponse(raw);
    if (this.cache && cacheKey && files.length) {
      this.cache.set(cacheKey, { files });
      await this.cache.save();
    }
    if (this.lastCacheStatus !== 'hit') {
      this.lastCacheStatus = 'miss';
    }
    return files;
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
    this.cache = new CatsCache(this.rootPath, { enabled: config.incremental !== false });
    this.aiCache = new AICache(this.rootPath, {
      enabled: config.aiCache !== false,
      ttlMs: config.aiCacheTtlMs
    });
    this.progressBus = config.progressStream === false ? null : new ProgressBus(this.rootPath);
  }

  emitProgress(event) {
    if (!this.progressBus) {
      return;
    }

    this.progressBus.publish({
      source: 'cats',
      ...event
    }).catch(() => {});
  }

  /**
   * Check if file is binary
   */
  async isBinary(filePath, buffer = null) {
    try {
      const data = buffer ?? await fs.readFile(filePath);
      const slice = data.slice(0, 1024);
      
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

    // Expand glob patterns to actual file paths
    const expandedFiles = [];
    let baseDir = this.rootPath; // Track base directory for relative path display
    const defaultIgnores = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.gitignore',
      '**/.env',
      '**/.env.*',
      '**/*.log',
      '**/dist/**',
      '**/build/**',
      '**/.paws_cache/**'
    ];

    for (const pattern of files) {
      try {
        // Check if pattern contains glob characters
        const hasGlob = /[*?{}\[\]]/.test(pattern);

        if (!hasGlob) {
          // No glob pattern, treat as literal file
          expandedFiles.push(pattern);
          // Update baseDir if this is an absolute path
          if (path.isAbsolute(pattern)) {
            baseDir = path.dirname(pattern);
          }
          continue;
        }

        // Pattern has glob characters
        const isAbsolute = path.isAbsolute(pattern);

        const globOptions = {
          nodir: true,
          dot: this.config.noDefaultExcludes,
          ignore: this.config.noDefaultExcludes ? this.config.exclude : [
            ...this.config.exclude,
            ...defaultIgnores
          ]
        };

        if (isAbsolute) {
          // For absolute glob patterns like /tmp/foo/src/**/*.js
          // We want baseDir to be /tmp/foo (parent of src) so files appear as src/main.js
          // and use src as the glob cwd
          let cwdPath = this.rootPath;
          let relativePattern = '**/*';

          // Find where glob patterns start
          const globStart = pattern.search(/[*?{}\[\]]/);
          if (globStart > 0) {
            // Get the directory containing the first glob character
            const beforeGlob = pattern.substring(0, globStart);
            const lastSlash = beforeGlob.lastIndexOf(path.sep);
            if (lastSlash > 0) {
              cwdPath = beforeGlob.substring(0, lastSlash);
              relativePattern = pattern.substring(lastSlash + 1);

              // Set baseDir to parent of cwdPath for display purposes
              // e.g., if pattern is /tmp/foo/src/**/*.js
              // cwdPath = /tmp/foo/src
              // baseDir = /tmp/foo (so files show as src/main.js)
              baseDir = path.dirname(cwdPath);
            }
          }

          globOptions.cwd = cwdPath;
          globOptions.absolute = false;
          const matches = await glob(relativePattern, globOptions);
          // Convert back to absolute paths
          expandedFiles.push(...matches.map(m => path.join(cwdPath, m)));
        } else {
          // Relative pattern
          globOptions.cwd = this.rootPath;
          globOptions.absolute = false;
          const matches = await glob(pattern, globOptions);
          expandedFiles.push(...matches);
        }
      } catch (error) {
        // If glob fails, treat as literal file path
        expandedFiles.push(pattern);
      }
    }

    files = expandedFiles;

    if (files.length === 0) {
      if (!this.config.quiet) {
        console.log(chalk.red('No files matched the specified patterns.'));
      }
      return '';
    }

    await this.cache.load();

    // Build the bundle
    const bundleLines = [];
    const cacheStats = { hits: 0, misses: 0 };
    let processedCount = 0;

    this.emitProgress({
      event: 'bundle:start',
      totalRequested: files.length,
      aiCurate: Boolean(aiCurate),
      incremental: this.cache.enabled,
      aiCache: this.aiCache.enabled
    });
    
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

      // Compute relative path for display in bundle
      const displayPath = path.isAbsolute(filePath)
        ? path.relative(baseDir, filePath)
        : filePath;

      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch {
        if (!this.config.quiet) {
          console.log(chalk.yellow(`Warning: File not found: ${displayPath}`));
        }
        continue;
      }

      let cacheEntry = this.cache.get(fullPath);
      let fromCache = false;

      if (cacheEntry && cacheEntry.meta) {
        const { mtimeMs, size } = cacheEntry.meta;
        if (mtimeMs === stats.mtimeMs && size === stats.size) {
          fromCache = true;
          cacheStats.hits += 1;
        } else {
          cacheEntry = null;
        }
      }

      try {
        let isBinary;
        let content;

        if (!fromCache) {
          const buffer = await fs.readFile(fullPath);
          isBinary = await this.isBinary(fullPath, buffer);
          if (isBinary) {
            content = buffer.toString('base64');
          } else {
            content = buffer.toString('utf-8');
          }

          const hash = crypto.createHash('sha256').update(buffer).digest('hex');
          cacheEntry = {
            meta: {
              mtimeMs: stats.mtimeMs,
              size: stats.size,
              hash,
              binary: isBinary
            },
            content
          };
          this.cache.set(fullPath, cacheEntry);
          if (this.cache.enabled) {
            cacheStats.misses += 1;
          }
        } else {
          isBinary = !!cacheEntry.meta.binary;
          content = cacheEntry.content;
        }

        if (isBinary) {
          bundleLines.push(`🐈 --- CATS_START_FILE: ${displayPath} (Content:Base64) ---`);
        } else {
          bundleLines.push(`🐈 --- CATS_START_FILE: ${displayPath} ---`);

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

        bundleLines.push(`🐈 --- CATS_END_FILE: ${displayPath} ---`);
        bundleLines.push('');

        if (!this.config.quiet) {
          const cacheNote = fromCache ? chalk.gray(' (cache)') : '';
          console.log(chalk.green(`✓ Added: ${displayPath}`) + cacheNote);
        }

        processedCount += 1;
        this.emitProgress({
          event: 'bundle:file',
          path: displayPath,
          cache: fromCache,
          binary: isBinary,
          size: stats.size
        });

      } catch (error) {
        if (!this.config.quiet) {
          console.log(chalk.red(`✗ Failed to add ${displayPath}: ${error.message}`));
        }
        this.emitProgress({
          event: 'bundle:error',
          path: displayPath,
          message: error.message
        });
      }
    }

    await this.cache.save();

    if (this.cache.enabled && !this.config.quiet) {
      console.log(
        chalk.blue(
          `[cache] hits: ${cacheStats.hits}, misses: ${cacheStats.misses}`
        )
      );
    }

    this.emitProgress({
      event: 'bundle:complete',
      processed: processedCount,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses
    });

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
      await this.aiCache.load();
      const curator = new AICurator(apiKey, provider, {
        cache: this.aiCache,
        quiet: this.config.quiet
      });
      const files = await curator.curateFiles(task, treeStr, this.config.maxFiles);

      console.log(chalk.blue(`[AI] Selected ${files.length} files:`));
      for (const file of files) {
        console.log(chalk.gray(`  - ${file}`));
      }

      this.emitProgress({
        event: 'ai:curation',
        provider,
        status: curator.lastCacheStatus,
        selected: files.length
      });

      return files;
    } catch (error) {
      console.error(chalk.red(`[AI] Curation failed: ${error.message}`));
      this.emitProgress({
        event: 'ai:error',
        provider,
        message: error.message
      });
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
    .option('-s, --sys-prompt-file <file>', 'System prompt file to prepend', DEFAULT_SYS_PROMPT)
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
    .option('--no-incremental', 'Disable incremental caching of bundle content')
    .option('--no-ai-cache', 'Disable AI response caching for file selection')
    .option('--ai-cache-ttl <hours>', 'Set AI curation cache TTL in hours (default: 24)')
    .option('--no-progress-stream', 'Disable progress streaming events')
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
    yes: options.yes,
    incremental: options.incremental,
    aiCache: options.aiCache,
    aiCacheTtlMs: options.aiCacheTtl
      ? Math.max(Number(options.aiCacheTtl) || 0, 0) * 60 * 60 * 1000
      : undefined,
    progressStream: options.progressStream
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

// Convenience function for API usage
async function createBundle(options) {
  const config = {
    outputFile: options.outputFile || 'cats.md',
    sysPrompt: options.sysPrompt || null,
    personas: options.personas || [],
    excludes: options.excludes || [],
    noDefaultExcludes: options.noDefaultExcludes || false,
    includeGitignore: options.includeGitignore || false,
    deltaMode: options.deltaMode || false,
    strictCatscan: options.strictCatscan || false,
    quiet: options.quiet !== false,
    rootDir: options.rootDir || process.cwd(),
    virtualFS: options.virtualFS
  };

  const bundler = new CatsBundler(config);

  // If virtualFS is provided, handle it directly
  if (config.virtualFS && Array.isArray(config.virtualFS)) {
    let bundle = '';

    for (const file of config.virtualFS) {
      const isBinary = Buffer.isBuffer(file.content);

      if (isBinary) {
        bundle += `--- CATS_START_FILE: ${file.path} (Content:Base64) ---\n`;
        bundle += file.content.toString('base64') + '\n';
        bundle += `--- CATS_END_FILE: ${file.path} ---\n\n`;
      } else {
        bundle += `--- CATS_START_FILE: ${file.path} ---\n`;
        bundle += file.content + '\n';
        bundle += `--- CATS_END_FILE: ${file.path} ---\n\n`;
      }
    }

    return bundle;
  }

  // Otherwise use the normal file-based bundling
  return await bundler.createBundle(options.files || [], false);
}

// Export for use as module
module.exports = {
  FileTreeNode,
  ProjectAnalyzer,
  AICurator,
  CatsBundler,
  createBundle,
  main
};
