#!/usr/bin/env node
/**
 * PAWS Context Optimizer - Handle 500K+ line refactors
 *
 * Strategies:
 * - Hierarchical chunking with CATSCAN summaries
 * - Dependency graph analysis
 * - Smart context windowing
 * - Iterative refinement with context expansion
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const { glob } = require('glob');

/**
 * Represents a code module with metadata
 */
class CodeModule {
  constructor(filePath, sizeLines, imports, exports, complexityScore, summary = null) {
    this.path = filePath;
    this.sizeLines = sizeLines;
    this.imports = imports;
    this.exports = exports;
    this.complexityScore = complexityScore;
    this.summary = summary;
  }
}

/**
 * A context window for a specific task
 */
class ContextWindow {
  constructor(coreFiles, summaryFiles, totalLines, estimatedTokens) {
    this.coreFiles = coreFiles;
    this.summaryFiles = summaryFiles;  // Files to include as CATSCAN summaries only
    this.totalLines = totalLines;
    this.estimatedTokens = estimatedTokens;
  }
}

/**
 * Analyze code dependencies to build optimal context windows
 */
class DependencyAnalyzer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.modules = new Map();
  }

  /**
   * Analyze a JavaScript/TypeScript file
   */
  async analyzeJavaScriptFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;

      // Simple parsing for imports and exports
      const imports = new Set();
      const exports = new Set();

      // Match import statements
      const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.add(match[1]);
      }

      // Match require statements
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        imports.add(match[1]);
      }

      // Match exports
      const exportRegex = /export\s+(const|let|var|function|class|default)\s+(\w+)/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.add(match[2]);
      }

      // Match module.exports
      const moduleExportsRegex = /module\.exports\s*=\s*\{([^}]+)\}/;
      const moduleExportsMatch = content.match(moduleExportsRegex);
      if (moduleExportsMatch) {
        const exportNames = moduleExportsMatch[1].split(',').map(e => e.trim().split(':')[0]);
        exportNames.forEach(name => exports.add(name));
      }

      // Simple complexity score based on control structures
      const complexityIndicators = [
        /\bif\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bswitch\b/g,
        /\btry\b/g,
        /\bcatch\b/g,
        /\basync\b/g,
        /\bawait\b/g
      ];

      let complexity = 0;
      complexityIndicators.forEach(regex => {
        const matches = content.match(regex);
        complexity += matches ? matches.length : 0;
      });

      const complexityScore = complexity / 100.0;

      return new CodeModule(
        filePath,
        lines,
        imports,
        exports,
        complexityScore
      );

    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not analyze ${filePath}: ${error.message}`));
      return new CodeModule(
        filePath,
        0,
        new Set(),
        new Set(),
        0.0
      );
    }
  }

  /**
   * Build a dependency graph from files
   */
  async buildDependencyGraph(files) {
    const graph = new Map();

    for (const filePath of files) {
      const ext = path.extname(filePath);
      if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        const module = await this.analyzeJavaScriptFile(filePath);
        this.modules.set(filePath, module);

        // Build graph edges
        const deps = new Set();

        for (const imp of module.imports) {
          // Try to resolve import to file path
          for (const otherPath of files) {
            if (imp.includes(path.basename(otherPath, path.extname(otherPath)))) {
              deps.add(otherPath);
            }
          }
        }

        graph.set(filePath, deps);
      }
    }

    return graph;
  }

  /**
   * Find transitive dependencies up to max_depth
   */
  findDependencies(filePath, graph, maxDepth = 2) {
    const dependencies = new Set();
    const toVisit = [[filePath, 0]];
    const visited = new Set();

    while (toVisit.length > 0) {
      const [current, depth] = toVisit.shift();

      if (visited.has(current) || depth > maxDepth) {
        continue;
      }

      visited.add(current);
      dependencies.add(current);

      if (graph.has(current)) {
        for (const dep of graph.get(current)) {
          if (!visited.has(dep)) {
            toVisit.push([dep, depth + 1]);
          }
        }
      }
    }

    return dependencies;
  }
}

/**
 * Optimize context windows for large codebases
 */
class ContextOptimizer {
  constructor(rootPath, maxTokens = 100000) {
    this.rootPath = rootPath;
    this.maxTokens = maxTokens;
    this.maxLines = Math.floor(maxTokens / 4);  // Rough estimate: 4 tokens per line
    this.analyzer = new DependencyAnalyzer(rootPath);
  }

  /**
   * Generate a CATSCAN summary for a file
   */
  generateCatscanSummary(filePath) {
    const module = this.analyzer.modules.get(filePath);

    if (!module) {
      return `# ${path.basename(filePath)}\n\nFile not analyzed.`;
    }

    const summaryLines = [
      `# ${path.basename(filePath)}`,
      '',
      `**Size:** ${module.sizeLines} lines`,
      `**Complexity:** ${module.complexityScore.toFixed(2)}`,
      '',
      '## Public API',
      ''
    ];

    for (const exp of Array.from(module.exports).sort()) {
      summaryLines.push(`- \`${exp}\``);
    }

    summaryLines.push('');
    summaryLines.push('## Dependencies');
    summaryLines.push('');

    for (const imp of Array.from(module.imports).sort()) {
      summaryLines.push(`- \`${imp}\``);
    }

    return summaryLines.join('\n');
  }

  /**
   * Create an optimized context window for a task
   */
  async createContextWindow(task, relevantFiles) {
    console.log(chalk.cyan(`\n☉ Optimizing context window...`));
    console.log(`Analyzing ${relevantFiles.length} files...`);

    // Build dependency graph
    const graph = await this.analyzer.buildDependencyGraph(relevantFiles);

    // Rank files by relevance
    const rankedFiles = this._rankFilesByRelevance(task, relevantFiles, graph);

    // Allocate to core vs summary
    const coreFiles = [];
    const summaryFiles = [];
    let totalLines = 0;

    for (const filePath of rankedFiles) {
      const module = this.analyzer.modules.get(filePath);
      if (!module) {
        continue;
      }

      // If adding this file keeps us under limit, add to core
      if (totalLines + module.sizeLines < this.maxLines * 0.7) {  // Reserve 30% for summaries
        coreFiles.push(filePath);
        totalLines += module.sizeLines;
      } else {
        summaryFiles.push(filePath);
      }
    }

    // Estimate tokens
    const estimatedTokens = totalLines * 4 + summaryFiles.length * 100;  // Summaries are small

    console.log(chalk.green(`\n☉ Context window created:`));
    console.log(`  Core files (full content): ${coreFiles.length}`);
    console.log(`  Summary files (CATSCAN): ${summaryFiles.length}`);
    console.log(`  Total lines: ${totalLines}`);
    console.log(`  Estimated tokens: ${estimatedTokens}`);

    return new ContextWindow(
      coreFiles,
      summaryFiles,
      totalLines,
      estimatedTokens
    );
  }

  /**
   * Rank files by relevance to task
   */
  _rankFilesByRelevance(task, files, graph) {
    // Simple heuristic: keyword matching + dependency centrality
    const taskKeywords = new Set(task.toLowerCase().split(/\s+/));

    const scores = new Map();

    for (const filePath of files) {
      let score = 0.0;

      // Keyword matching
      const fileNameLower = filePath.toLowerCase();
      for (const keyword of taskKeywords) {
        if (fileNameLower.includes(keyword)) {
          score += 10.0;
        }
      }

      // Dependency centrality (how many files depend on this one)
      let dependents = 0;
      for (const deps of graph.values()) {
        if (deps.has(filePath)) {
          dependents++;
        }
      }
      score += dependents * 2.0;

      // Module complexity (prefer simpler files in core)
      const module = this.analyzer.modules.get(filePath);
      if (module) {
        score -= module.complexityScore * 0.5;
      }

      scores.set(filePath, score);
    }

    return Array.from(files).sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0));
  }

  /**
   * Create an optimized CATS bundle with hierarchical content
   */
  async createOptimizedBundle(window, outputPath) {
    const lines = [];

    lines.push('# Optimized Context Bundle');
    lines.push('# Generated by PAWS Context Optimizer');
    lines.push('');
    lines.push('## Context Strategy');
    lines.push(`- Core files (full): ${window.coreFiles.length}`);
    lines.push(`- Summary files: ${window.summaryFiles.length}`);
    lines.push(`- Total estimated tokens: ${window.estimatedTokens}`);
    lines.push('');

    // Core files with full content
    lines.push('## Core Files (Full Content)');
    lines.push('');

    for (const filePath of window.coreFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relPath = path.relative(this.rootPath, filePath);
        const ext = path.extname(filePath).substring(1);

        lines.push(`🐈 --- CATS_START_FILE: ${relPath} ---`);
        lines.push(`\`\`\`${ext}`);
        lines.push(content);
        lines.push('```');
        lines.push(`🐈 --- CATS_END_FILE: ${relPath} ---`);
        lines.push('');

      } catch (error) {
        console.log(chalk.yellow(`Warning: Could not read ${filePath}: ${error.message}`));
      }
    }

    // Summary files
    if (window.summaryFiles.length > 0) {
      lines.push('## Related Files (CATSCAN Summaries)');
      lines.push('');
      lines.push('The following files are relevant but summarized to save tokens:');
      lines.push('');

      for (const filePath of window.summaryFiles) {
        const relPath = path.relative(this.rootPath, filePath);
        const summary = this.generateCatscanSummary(filePath);
        lines.push(`### ${relPath}`);
        lines.push(summary);
        lines.push('');
      }
    }

    // Write bundle
    await fs.writeFile(outputPath, lines.join('\n'));

    console.log(chalk.green(`\n☉ Optimized bundle written to: ${outputPath}`));
  }
}

/**
 * Main CLI function
 */
async function main() {
  const program = new Command();

  program
    .name('paws-context-optimizer')
    .description('PAWS Context Optimizer - Handle massive codebases')
    .argument('[task]', 'Task description for context optimization')
    .option('--files <files...>', 'Files to include (or use --scan)')
    .option('--scan <directory>', 'Scan directory for relevant files')
    .option('--output <path>', 'Output bundle path', 'optimized_context.md')
    .option('--max-tokens <number>', 'Maximum tokens for context window', '100000')
    .parse(process.argv);

  const options = program.opts();
  let [task] = program.args;

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

  rl.close();

  // Determine files
  let files;
  if (options.files) {
    files = options.files;
  } else if (options.scan) {
    const scanPath = options.scan;
    console.log(chalk.gray(`Scanning ${scanPath}...`));

    const jsFiles = await glob(`${scanPath}/**/*.js`);
    const tsFiles = await glob(`${scanPath}/**/*.ts`);
    const jsxFiles = await glob(`${scanPath}/**/*.jsx`);
    const tsxFiles = await glob(`${scanPath}/**/*.tsx`);

    files = [...jsFiles, ...tsFiles, ...jsxFiles, ...tsxFiles];
    console.log(chalk.green(`Scanned ${files.length} files from ${scanPath}`));
  } else {
    console.error(chalk.red('Error: Either --files or --scan required'));
    process.exit(1);
  }

  // Create optimizer
  const rootPath = process.cwd();
  const optimizer = new ContextOptimizer(rootPath, parseInt(options.maxTokens));

  // Create optimized window
  const window = await optimizer.createContextWindow(task, files);

  // Generate bundle
  const outputPath = options.output;
  await optimizer.createOptimizedBundle(window, outputPath);

  console.log(chalk.green(`\n☉ Context optimization complete!`));
  console.log('Use this optimized bundle with:');
  console.log(chalk.cyan(`  node packages/cli-js/src/paxos.js "${task}" ${outputPath} --verify-cmd "npm test"`));

  process.exit(0);
}

// Export for use as a module
module.exports = {
  CodeModule,
  ContextWindow,
  DependencyAnalyzer,
  ContextOptimizer
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
