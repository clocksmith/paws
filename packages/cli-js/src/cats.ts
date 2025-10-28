#!/usr/bin/env node
/**
 * Enhanced CATS bundler with AI-curated context selection (TypeScript).
 * Part of the PAWS CLI Evolution - Phase 2 Implementation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as crypto from 'crypto';
import ignore from 'ignore';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';
import { ProgressBus, ProgressEvent } from './progress-bus';
import { getSysPath, getPersonasPath } from '@paws/core';
import { generateManifest, serializeManifestAsComments } from './bundle-manifest';
import type { BundleManifest } from './bundle-manifest';

// Default system prompt from core package
const DEFAULT_SYS_PROMPT = path.join(getSysPath(), 'sys_a.md');

// Type Definitions
export interface BundlerConfig {
  root?: string;
  maxFiles?: number;
  includeTests?: boolean;
  exclude?: string[];
  persona?: string[];
  sysPromptFile?: string | null;
  requireSysPrompt?: boolean;
  prepareForDelta?: boolean;
  strictCatscan?: boolean;
  noDefaultExcludes?: boolean;
  verify?: string;
  quiet?: boolean;
  yes?: boolean;
  incremental?: boolean;
  aiCache?: boolean;
  aiCacheTtlMs?: number;
  progressStream?: boolean;
  includeManifest?: boolean;
}

export interface CacheEntry {
  meta?: {
    mtime?: number;
    mtimeMs?: number;
    size: number;
    binary?: boolean;
  };
  content?: string;
  hash?: string;
}

export interface AIProvider {
  name: 'gemini' | 'claude' | 'openai';
  apiKey?: string;
}

// AI Provider SDKs (optional dependencies)
let GoogleGenerativeAI: any, Anthropic: any, OpenAI: any;

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

// For git operations (optional dependency)
let simpleGit: any;
try {
  simpleGit = require('simple-git');
} catch {
  console.warn('simple-git not installed. Git-based file discovery disabled.');
}

/**
 * Represents a file or directory in the project tree
 */
class FileTreeNode {
  path: string;
  isDir: boolean;
  size: number;
  children: FileTreeNode[];

  constructor(filePath: string, isDir: boolean = false, size: number = 0) {
    this.path = filePath;
    this.isDir = isDir;
    this.size = size;
    this.children = [];
  }

  /**
   * Add a child node
   */
  addChild(node: FileTreeNode): void {
    this.children.push(node);
  }

  /**
   * Convert to string representation for LLM context
   */
  toString(indent: number = 0): string {
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
  private rootPath: string;
  private gitignorePatterns: string[] | null;
  private ig: any;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
    this.gitignorePatterns = null;
    this.ig = ignore();
  }

  /**
   * Load gitignore patterns
   */
  async loadGitignore(): Promise<string[]> {
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
  shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.rootPath, filePath);
    return this.ig.ignores(relativePath);
  }

  /**
   * Build a tree representation of the project
   */
  async buildFileTree(): Promise<FileTreeNode> {
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
  async buildTreeWithGit(): Promise<FileTreeNode> {
    const git = simpleGit(this.rootPath);
    const files = await git.raw(['ls-files']);
    const fileList = files.split('\n').filter((f: string) => f);

    const root = new FileTreeNode(this.rootPath, true);
    const nodes = new Map<string, FileTreeNode>();
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
  async buildTreeWithWalk(): Promise<FileTreeNode> {
    const root = new FileTreeNode(this.rootPath, true);
    const nodes = new Map<string, FileTreeNode>();
    nodes.set(this.rootPath, root);

    const walkDir = async (dirPath: string, parentNode: FileTreeNode): Promise<void> => {
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
  async addFileToTree(filePath: string, root: FileTreeNode, nodes: Map<string, FileTreeNode>): Promise<void> {
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
        current = nodes.get(dirPath)!;
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
  private rootPath: string;
  public enabled: boolean;
  private cacheDir: string;
  private cacheFile: string;
  private data: { version: number; entries: Record<string, CacheEntry> };
  private touched: Set<string>;
  private loaded: boolean;

  constructor(rootPath: string, options: { enabled?: boolean } = {}) {
    this.rootPath = path.resolve(rootPath);
    this.enabled = options.enabled !== false;
    this.cacheDir = path.join(this.rootPath, '.paws', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'cats-manifest.json');
    this.data = { version: 1, entries: {} };
    this.touched = new Set();
    this.loaded = false;
  }

  normalize(filePath: string): string {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.rootPath, filePath);
    const relative = path.relative(this.rootPath, absolute) || path.basename(absolute);
    return relative.split(path.sep).join('/');
  }

  async load(): Promise<void> {
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

  get(filePath: string): CacheEntry | null {
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

  set(filePath: string, entry: CacheEntry): void {
    if (!this.enabled) {
      return;
    }
    const key = this.normalize(filePath);
    this.data.entries[key] = entry;
    this.touched.add(key);
  }

  purgeUnused(): void {
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

  async save(): Promise<void> {
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
  private rootPath: string;
  public enabled: boolean;
  private ttlMs: number;
  private cacheDir: string;
  private cacheFile: string;
  private data: { version: number; entries: Record<string, any> };
  private loaded: boolean;
  private dirty: boolean;

  constructor(rootPath: string, options: { enabled?: boolean; ttlMs?: number } = {}) {
    this.rootPath = path.resolve(rootPath);
    this.enabled = options.enabled !== false;
    this.ttlMs = options.ttlMs ?? 1000 * 60 * 60 * 24; // default 24h
    this.cacheDir = path.join(this.rootPath, '.paws', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'ai-curations.json');
    this.data = { version: 1, entries: {} };
    this.loaded = false;
    this.dirty = false;
  }

  async load(): Promise<void> {
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

  pruneExpired(): void {
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

  get(key: string): any | null {
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

  set(key: string, value: any): void {
    if (!this.enabled) {
      return;
    }

    this.data.entries[key] = {
      ...value,
      timestamp: Date.now()
    };
    this.dirty = true;
  }

  async save(): Promise<void> {
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
  private provider: string;
  private apiKey: string;
  private cache: AICache | null;
  private quiet: boolean;
  private client: any;
  public lastCacheStatus: string;

  constructor(apiKey: string | undefined, provider: string = 'gemini', options: { cache?: AICache; quiet?: boolean } = {}) {
    this.provider = provider;
    this.apiKey = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || '';
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
  initializeClient(): void {
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
  async curateFiles(taskDescription: string, fileTree: string, maxFiles: number = 20): Promise<string[]> {
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

  buildCacheKey(prompt: string, maxFiles: number): string {
    const hash = crypto.createHash('sha256').update(prompt).digest('hex');
    return `${this.provider}:${maxFiles}:${hash}`;
  }

  /**
   * Build the prompt for file curation
   */
  buildCurationPrompt(task: string, tree: string, maxFiles: number): string {
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
  async curateWithGemini(prompt: string, cacheKey: string | null): Promise<string[]> {
    try {
      const result = await this.client.generateContent(prompt);
      const response = await result.response;
      return await this.handleAIResponse(response.text(), cacheKey);
    } catch (error: any) {
      this.lastCacheStatus = 'error';
      console.error(`Gemini curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Use Claude to curate files
   */
  async curateWithClaude(prompt: string, cacheKey: string | null): Promise<string[]> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });
      return await this.handleAIResponse(response.content[0].text, cacheKey);
    } catch (error: any) {
      this.lastCacheStatus = 'error';
      console.error(`Claude curation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Use OpenAI to curate files
   */
  async curateWithOpenAI(prompt: string, cacheKey: string | null): Promise<string[]> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });
      return await this.handleAIResponse(response.choices[0].message.content, cacheKey);
    } catch (error: any) {
      this.lastCacheStatus = 'error';
      console.error(`OpenAI curation failed: ${error.message}`);
      return [];
    }
  }

  async handleAIResponse(raw: string, cacheKey: string | null): Promise<string[]> {
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
  parseAIResponse(response: string): string[] {
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
  private config: BundlerConfig;
  private rootPath: string;
  private cache: CatsCache;
  private aiCache: AICache;
  private progressBus: ProgressBus | null;

  constructor(config: BundlerConfig) {
    this.config = config;
    this.rootPath = path.resolve(config.root || '.');
    this.cache = new CatsCache(this.rootPath, { enabled: config.incremental !== false });
    this.aiCache = new AICache(this.rootPath, {
      enabled: config.aiCache !== false,
      ttlMs: config.aiCacheTtlMs
    });
    this.progressBus = config.progressStream === false ? null : new ProgressBus(this.rootPath);
  }

  emitProgress(event: ProgressEvent): void {
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
  async isBinary(filePath: string, buffer: Buffer | null = null): Promise<boolean> {
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
  async createBundle(files: string[], aiCurate: string | undefined, aiProvider: string = 'gemini', aiKey?: string): Promise<string> {
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

        const globOptions: any = {
          nodir: true,
          dot: this.config.noDefaultExcludes,
          ignore: this.config.noDefaultExcludes ? (this.config.exclude || []) : [
            ...(this.config.exclude || []),
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
          expandedFiles.push(...matches.map((m: string) => path.join(cwdPath, m)));
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

    // Add persona files first
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

    // Add system prompt after persona
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
    
    // Generate and add reproducibility manifest (if enabled)
    if (this.config.includeManifest !== false) {
      const manifest = await generateManifest({
        rootPath: this.rootPath,
        bundleFormat: this.config.prepareForDelta ? 'DELTA' : 'FULL',
        fileSelectionCriteria: aiCurate ? {
          patterns: files,
          aiReasoning: 'AI-curated file selection based on task: ' + aiCurate,
          aiProvider: aiProvider || 'gemini'
        } : {
          patterns: files,
          aiReasoning: null,
          aiProvider: null
        },
        fileList: files,
        personaFiles: this.config.persona || [],
        systemPrompt: this.config.sysPromptFile,
        baseBundle: null, // TODO: Support for delta bundles
        customMetadata: {
          catsVersion: require('../package.json').version,
          cacheEnabled: this.cache.enabled,
          aiCacheEnabled: this.aiCache.enabled
        }
      });

      // Add manifest header
      const manifestHeader = serializeManifestAsComments(manifest);
      bundleLines.push(manifestHeader);
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
              binary: isBinary
            },
            content,
            hash
          };
          this.cache.set(fullPath, cacheEntry);
          if (this.cache.enabled) {
            cacheStats.misses += 1;
          }
        } else {
          isBinary = !!(cacheEntry && cacheEntry.meta && cacheEntry.meta.binary);
          content = cacheEntry?.content || '';
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

      } catch (error: any) {
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
  async getAICuratedFiles(task: string, provider: string, apiKey?: string): Promise<string[]> {
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
      const files = await curator.curateFiles(task, treeStr, this.config.maxFiles || 20);

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
    } catch (error: any) {
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
async function main(): Promise<number> {
  program
    .name('cats')
    .description('CATS - Bundle project files for AI/LLM consumption with optional AI curation')
    .argument('[files...]', 'Files to include in the bundle')
    .option('--ai-curate <task>', 'Use AI to select files based on task description')
    .option('--ai-provider <provider>', 'AI provider (gemini, claude, openai)', 'gemini')
    .option('--ai-key <key>', 'API key for AI provider')
    .option('-o, --output <file>', 'Output file for the bundle', 'cats.md')
    .option('-x, --exclude <pattern>', 'Exclude pattern (can be used multiple times)', (value: string, previous: string[]) => {
      return previous ? [...previous, value] : [value];
    }, [])
    .option('-p, --persona <file>', 'Persona file to prepend (can be used multiple times)', (value: string, previous: string[]) => {
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
    .option('--no-manifest', 'Disable reproducibility manifest in bundle header')
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
    progressStream: options.progressStream,
    includeManifest: options.manifest !== false
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

  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  main().then(code => process.exit(code));
}

// Convenience function for API usage
async function createBundle(options: any): Promise<string> {
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
  return await bundler.createBundle(options.files || [], undefined);
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
