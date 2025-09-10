#!/usr/bin/env node
/**
 * Enhanced DOGS extractor with interactive review and verification features.
 * Part of the PAWS CLI Evolution - Phase 1 & 2 Implementation.
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { diffLines, createTwoFilesPatch } = require('diff');
const { spawn, execSync } = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

// Try to load optional dependencies
let simpleGit;
try {
  simpleGit = require('simple-git');
} catch (e) {
  console.warn('simple-git not installed. Git features will be limited.');
}

// Bundle parsing regexes
const DOGS_MARKER_REGEX = /^\s*🐕\s*-{3,}\s*DOGS_(START|END)_FILE\s*:\s*(.+?)(\s*\(Content:Base64\))?\s*-{3,}\s*$/i;
const MARKDOWN_FENCE_REGEX = /^\s*```[\w-]*\s*$/;

// File operation types
const FileOperation = {
  CREATE: 'CREATE',
  MODIFY: 'MODIFY',
  DELETE: 'DELETE'
};

/**
 * Represents a single file change
 */
class FileChange {
  constructor(filePath, operation, oldContent = null, newContent = null, isBinary = false) {
    this.filePath = filePath;
    this.operation = operation;
    this.oldContent = oldContent;
    this.newContent = newContent;
    this.isBinary = isBinary;
    this.status = 'pending'; // pending, accepted, rejected, skipped
  }

  /**
   * Generate a unified diff for this change
   */
  getDiff() {
    if (this.operation === FileOperation.DELETE) {
      return `File will be deleted: ${this.filePath}`;
    } else if (this.operation === FileOperation.CREATE) {
      return `New file will be created: ${this.filePath}`;
    } else if (this.oldContent !== null && this.newContent !== null) {
      return createTwoFilesPatch(
        `a/${this.filePath}`,
        `b/${this.filePath}`,
        this.oldContent,
        this.newContent,
        'old',
        'new'
      );
    }
    return '';
  }

  /**
   * Get a colorized diff for terminal display
   */
  getColorizedDiff() {
    const diff = this.getDiff();
    const lines = diff.split('\n');
    
    return lines.map(line => {
      if (line.startsWith('+')) {
        return chalk.green(line);
      } else if (line.startsWith('-')) {
        return chalk.red(line);
      } else if (line.startsWith('@@')) {
        return chalk.cyan(line);
      }
      return line;
    }).join('\n');
  }
}

/**
 * Collection of all file changes in a bundle
 */
class ChangeSet {
  constructor() {
    this.changes = [];
  }

  addChange(change) {
    this.changes.push(change);
  }

  getAccepted() {
    return this.changes.filter(c => c.status === 'accepted');
  }

  getPending() {
    return this.changes.filter(c => c.status === 'pending');
  }

  getRejected() {
    return this.changes.filter(c => c.status === 'rejected');
  }

  getSummary() {
    return {
      total: this.changes.length,
      accepted: this.getAccepted().length,
      rejected: this.getRejected().length,
      pending: this.getPending().length
    };
  }
}

/**
 * Interactive reviewer using blessed for TUI
 */
class InteractiveReviewer {
  constructor(changeSet) {
    this.changeSet = changeSet;
    this.currentIndex = 0;
  }

  /**
   * Run interactive review with blessed TUI
   */
  async reviewWithBlessed() {
    return new Promise((resolve) => {
      const screen = blessed.screen({
        smartCSR: true,
        title: 'PAWS Interactive Review'
      });

      // Create layout
      const grid = new contrib.grid({ rows: 12, cols: 12, screen });

      // File list
      const fileList = grid.set(0, 0, 4, 3, blessed.list, {
        label: 'Files',
        keys: true,
        vi: true,
        style: {
          selected: { bg: 'blue' }
        }
      });

      // Diff viewer
      const diffViewer = grid.set(0, 3, 10, 9, blessed.box, {
        label: 'Diff',
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        vi: true,
        scrollbar: {
          style: { bg: 'blue' }
        }
      });

      // Status bar
      const statusBar = grid.set(10, 0, 2, 12, blessed.box, {
        label: 'Controls',
        content: '[a]ccept | [r]eject | [s]kip | [p]revious | [n]ext | [q]uit & apply'
      });

      // Summary panel
      const summaryPanel = grid.set(4, 0, 6, 3, blessed.box, {
        label: 'Summary'
      });

      // Populate file list
      const fileItems = this.changeSet.changes.map((change, i) => {
        const status = change.status === 'accepted' ? '✓' :
                       change.status === 'rejected' ? '✗' : ' ';
        const op = change.operation === FileOperation.CREATE ? '[A]' :
                   change.operation === FileOperation.MODIFY ? '[M]' :
                   '[D]';
        return `${status} ${op} ${change.filePath}`;
      });
      fileList.setItems(fileItems);

      // Update display function
      const updateDisplay = () => {
        const change = this.changeSet.changes[this.currentIndex];
        if (change) {
          // Update diff viewer
          diffViewer.setContent(change.getDiff());
          
          // Update summary
          const summary = this.changeSet.getSummary();
          summaryPanel.setContent(
            `Total: ${summary.total}\n` +
            `Accepted: ${summary.accepted}\n` +
            `Rejected: ${summary.rejected}\n` +
            `Pending: ${summary.pending}`
          );

          // Update file list highlighting
          fileList.select(this.currentIndex);
          
          // Update file items with status
          const updatedItems = this.changeSet.changes.map((c, i) => {
            const status = c.status === 'accepted' ? '✓' :
                          c.status === 'rejected' ? '✗' : ' ';
            const op = c.operation === FileOperation.CREATE ? '[A]' :
                      c.operation === FileOperation.MODIFY ? '[M]' :
                      '[D]';
            return `${status} ${op} ${c.filePath}`;
          });
          fileList.setItems(updatedItems);
        }
        screen.render();
      };

      // Initial display
      updateDisplay();

      // Handle keyboard input
      screen.key(['a'], () => {
        if (this.currentIndex < this.changeSet.changes.length) {
          this.changeSet.changes[this.currentIndex].status = 'accepted';
          if (this.currentIndex < this.changeSet.changes.length - 1) {
            this.currentIndex++;
          }
          updateDisplay();
        }
      });

      screen.key(['r'], () => {
        if (this.currentIndex < this.changeSet.changes.length) {
          this.changeSet.changes[this.currentIndex].status = 'rejected';
          if (this.currentIndex < this.changeSet.changes.length - 1) {
            this.currentIndex++;
          }
          updateDisplay();
        }
      });

      screen.key(['s'], () => {
        if (this.currentIndex < this.changeSet.changes.length) {
          this.changeSet.changes[this.currentIndex].status = 'pending';
          if (this.currentIndex < this.changeSet.changes.length - 1) {
            this.currentIndex++;
          }
          updateDisplay();
        }
      });

      screen.key(['p', 'up'], () => {
        if (this.currentIndex > 0) {
          this.currentIndex--;
          updateDisplay();
        }
      });

      screen.key(['n', 'down'], () => {
        if (this.currentIndex < this.changeSet.changes.length - 1) {
          this.currentIndex++;
          updateDisplay();
        }
      });

      screen.key(['q', 'escape', 'C-c'], () => {
        screen.destroy();
        resolve(this.changeSet);
      });

      // Handle file list selection
      fileList.on('select', (item, index) => {
        this.currentIndex = index;
        updateDisplay();
      });

      screen.render();
    });
  }

  /**
   * Fallback review using inquirer
   */
  async reviewWithInquirer() {
    console.log(chalk.bold('\n=== Interactive Review Mode ===\n'));

    for (let i = 0; i < this.changeSet.changes.length; i++) {
      const change = this.changeSet.changes[i];
      
      console.log(chalk.yellow(`\n[${i + 1}/${this.changeSet.changes.length}] ${change.filePath}`));
      console.log(`Operation: ${change.operation}`);
      
      if (change.operation === FileOperation.MODIFY) {
        console.log('\nDiff:');
        console.log(change.getColorizedDiff());
      }

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Accept', value: 'accept' },
            { name: 'Reject', value: 'reject' },
            { name: 'Skip', value: 'skip' },
            { name: 'Quit and apply', value: 'quit' }
          ],
          default: 'skip'
        }
      ]);

      if (action === 'accept') {
        change.status = 'accepted';
      } else if (action === 'reject') {
        change.status = 'rejected';
      } else if (action === 'skip') {
        change.status = 'pending';
      } else if (action === 'quit') {
        break;
      }
    }

    return this.changeSet;
  }

  /**
   * Main review method
   */
  async review(useBlessed = true) {
    try {
      if (useBlessed && blessed) {
        return await this.reviewWithBlessed();
      }
    } catch (e) {
      console.log('Falling back to inquirer interface...');
    }
    return await this.reviewWithInquirer();
  }
}

/**
 * Git verification handler
 */
class GitVerificationHandler {
  constructor(repoPath = '.') {
    this.repoPath = path.resolve(repoPath);
    this.git = simpleGit ? simpleGit(this.repoPath) : null;
    this.stashName = null;
  }

  async isGitRepo() {
    if (!this.git) return false;
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async createCheckpoint() {
    if (!this.git) return false;
    
    try {
      const status = await this.git.status();
      if (status.modified.length > 0 || status.not_added.length > 0) {
        this.stashName = `PAWS: Pre-apply checkpoint ${Date.now()}`;
        await this.git.stash(['push', '-m', this.stashName]);
        return true;
      }
      return true; // Clean state is valid
    } catch (e) {
      console.error(`Failed to create checkpoint: ${e.message}`);
      return false;
    }
  }

  async rollback() {
    if (!this.git || !this.stashName) return false;
    
    try {
      await this.git.stash(['pop']);
      this.stashName = null;
      return true;
    } catch (e) {
      console.error(`Failed to rollback: ${e.message}`);
      return false;
    }
  }

  async finalize() {
    if (!this.git || !this.stashName) return true;
    
    try {
      const stashList = await this.git.stashList();
      if (stashList.latest && stashList.latest.message === this.stashName) {
        await this.git.stash(['drop']);
      }
      this.stashName = null;
      return true;
    } catch (e) {
      console.error(`Failed to finalize: ${e.message}`);
      return false;
    }
  }

  async runVerification(command) {
    // Security: Validate command to prevent injection attacks
    const allowedCommands = [
      /^npm (test|run test|run build|run lint)$/,
      /^yarn (test|build|lint)$/,
      /^pnpm (test|build|lint)$/,
      /^make (test|check|build)$/,
      /^pytest/,
      /^cargo (test|build|check)$/,
      /^go test/,
      /^\.\/test\.sh$/
    ];
    
    const isAllowed = allowedCommands.some(pattern => pattern.test(command.trim()));
    if (!isAllowed) {
      console.error(chalk.red(`Security: Command not in allowlist: ${command}`));
      console.error(chalk.yellow('Allowed patterns: npm test, yarn test, make test, pytest, cargo test, etc.'));
      return { success: false, output: 'Command not allowed for security reasons' };
    }
    
    return new Promise((resolve) => {
      const spinner = ora(`Running verification: ${command}`).start();
      
      // Use execFile for safer execution (no shell interpretation)
      const parts = command.trim().split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      
      const { execFile } = require('child_process');
      execFile(cmd, args, { cwd: this.repoPath }, (error, stdout, stderr) => {
        if (error) {
          spinner.fail('Verification failed');
          resolve({ success: false, output: stderr || stdout });
        } else {
          spinner.succeed('Verification successful');
          resolve({ success: true, output: stdout });
        }
      });
    });
  }
}

/**
 * Main bundle processor for DOGS functionality
 */
class BundleProcessor {
  constructor(config) {
    this.config = config;
    this.changeSet = new ChangeSet();
    this.gitHandler = config.verify ? new GitVerificationHandler(config.outputDir) : null;
  }

  /**
   * Parse bundle content into a ChangeSet
   */
  async parseBundle(bundleContent) {
    const lines = bundleContent.split('\n');
    let inFile = false;
    let currentFile = null;
    let currentContent = [];
    let isBinary = false;

    for (const line of lines) {
      const match = DOGS_MARKER_REGEX.exec(line);
      
      if (match) {
        if (match[1].toUpperCase() === 'START') {
          inFile = true;
          currentFile = match[2].trim();
          isBinary = Boolean(match[3]);
          currentContent = [];
        } else if (match[1].toUpperCase() === 'END' && inFile) {
          await this.processFile(currentFile, currentContent, isBinary);
          inFile = false;
          currentFile = null;
        }
      } else if (inFile) {
        currentContent.push(line);
      }
    }

    return this.changeSet;
  }

  /**
   * Process a single file from the bundle
   */
  async processFile(filePath, contentLines, isBinary) {
    // Clean up content
    contentLines = this.cleanContent(contentLines);
    
    // Determine operation
    const absPath = path.join(this.config.outputDir || '.', filePath);
    let operation;
    let oldContent = null;

    try {
      oldContent = await fs.readFile(absPath, 'utf-8');
      operation = FileOperation.MODIFY;
    } catch {
      operation = FileOperation.CREATE;
    }

    // Handle content
    let newContent;
    if (isBinary) {
      const contentStr = contentLines.join('\n');
      newContent = Buffer.from(contentStr, 'base64').toString('utf-8');
    } else {
      newContent = contentLines.join('\n');
    }

    const change = new FileChange(
      filePath,
      operation,
      oldContent,
      newContent,
      isBinary
    );

    this.changeSet.addChange(change);
  }

  /**
   * Clean content lines
   */
  cleanContent(lines) {
    if (!lines.length) return [];

    // Remove markdown fences
    if (MARKDOWN_FENCE_REGEX.test(lines[0])) {
      lines = lines.slice(1);
    }
    if (lines.length && MARKDOWN_FENCE_REGEX.test(lines[lines.length - 1])) {
      lines = lines.slice(0, -1);
    }

    // Remove leading/trailing empty lines
    while (lines.length && !lines[0].trim()) {
      lines = lines.slice(1);
    }
    while (lines.length && !lines[lines.length - 1].trim()) {
      lines = lines.slice(0, -1);
    }

    return lines;
  }

  /**
   * Apply accepted changes to filesystem
   */
  async applyChanges(changeSet) {
    let successCount = 0;
    let errorCount = 0;

    for (const change of changeSet.getAccepted()) {
      try {
        const absPath = path.join(this.config.outputDir || '.', change.filePath);

        if (change.operation === FileOperation.DELETE) {
          await fs.unlink(absPath);
          console.log(chalk.green(`✓ Deleted: ${change.filePath}`));
          successCount++;
        } else {
          // Create parent directories if needed
          await fs.mkdir(path.dirname(absPath), { recursive: true });

          // Write content
          if (change.isBinary) {
            await fs.writeFile(absPath, Buffer.from(change.newContent, 'utf-8'));
          } else {
            await fs.writeFile(absPath, change.newContent, 'utf-8');
          }

          const action = change.operation === FileOperation.CREATE ? 'Created' : 'Modified';
          console.log(chalk.green(`✓ ${action}: ${change.filePath}`));
          successCount++;
        }
      } catch (e) {
        console.log(chalk.red(`✗ Failed to apply ${change.filePath}: ${e.message}`));
        errorCount++;
      }
    }

    console.log(`\nSummary: ${successCount} succeeded, ${errorCount} failed`);
    return errorCount === 0;
  }

  /**
   * Apply changes with verification and rollback
   */
  async runWithVerification(changeSet, verifyCommand) {
    if (!this.gitHandler || !(await this.gitHandler.isGitRepo())) {
      console.log(chalk.yellow('Warning: Not in a git repository. Verification without rollback.'));
      return await this.applyChanges(changeSet);
    }

    // Create checkpoint
    console.log('Creating git checkpoint...');
    if (!(await this.gitHandler.createCheckpoint())) {
      console.log(chalk.red('Failed to create checkpoint. Aborting.'));
      return false;
    }

    // Apply changes
    console.log('Applying changes...');
    if (!(await this.applyChanges(changeSet))) {
      console.log(chalk.red('Failed to apply some changes.'));
      await this.gitHandler.rollback();
      return false;
    }

    // Run verification
    const { success, output } = await this.gitHandler.runVerification(verifyCommand);

    if (success) {
      console.log(chalk.green('✓ Verification successful!'));
      await this.gitHandler.finalize();
      return true;
    } else {
      console.log(chalk.red(`✗ Verification failed:\n${output}`));
      if (this.config.revertOnFail) {
        console.log('Reverting changes...');
        await this.gitHandler.rollback();
        console.log('Changes reverted.');
      }
      return false;
    }
  }
}

/**
 * Main CLI
 */
async function main() {
  const { program } = require('commander');

  program
    .name('dogs')
    .description('DOGS - Extract and apply files from PAWS bundles with interactive review')
    .argument('[bundle]', 'Bundle file to process', 'dogs.md')
    .argument('[output]', 'Output directory', '.')
    .option('-i, --interactive', 'Enable interactive review mode')
    .option('--verify <command>', 'Run verification command after applying changes')
    .option('--revert-on-fail', 'Automatically revert changes if verification fails')
    .option('-d, --apply-delta <ref_bundle>', 'Apply deltas using a reference bundle')
    .option('--rsi-link', 'Use RSI-Link protocol for self-modification')
    .option('--allow-reinvoke', 'Allow AI to request command execution')
    .option('--verify-docs', 'Warn if README.md changed without CATSCAN.md')
    .option('--test-cmd <command>', 'Test command to run after changes')
    .option('-y, --yes', 'Auto-accept all changes')
    .option('-n, --no', 'Auto-reject all changes')
    .option('-q, --quiet', 'Suppress output')
    .option('--no-blessed', 'Use simple interface instead of TUI')
    .parse();

  const options = program.opts();
  const [bundleFile, outputDir] = program.args;

  // Build config
  const config = {
    outputDir,
    interactive: options.interactive,
    verify: options.verify || options.testCmd,
    revertOnFail: options.revertOnFail,
    applyDelta: options.applyDelta,
    rsiLink: options.rsiLink,
    allowReinvoke: options.allowReinvoke,
    verifyDocs: options.verifyDocs,
    testCmd: options.testCmd,
    autoAccept: options.yes,
    autoReject: options.no,
    quiet: options.quiet,
    useBlessed: options.blessed !== false
  };

  try {
    // Read bundle
    let bundleContent;
    if (bundleFile === '-') {
      bundleContent = await new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
      });
    } else {
      bundleContent = await fs.readFile(bundleFile, 'utf-8');
    }

    // Process bundle
    const processor = new BundleProcessor(config);
    const changeSet = await processor.parseBundle(bundleContent);

    if (!changeSet.changes.length) {
      console.log('No changes found in bundle.');
      return 0;
    }

    // Review changes
    if (config.interactive) {
      const reviewer = new InteractiveReviewer(changeSet);
      await reviewer.review(config.useBlessed);
    } else if (config.autoAccept) {
      changeSet.changes.forEach(c => c.status = 'accepted');
    } else if (config.autoReject) {
      changeSet.changes.forEach(c => c.status = 'rejected');
    } else {
      // Default: accept all
      changeSet.changes.forEach(c => c.status = 'accepted');
    }

    // Apply changes
    let success;
    if (config.verify) {
      success = await processor.runWithVerification(changeSet, config.verify);
    } else {
      success = await processor.applyChanges(changeSet);
    }

    return success ? 0 : 1;

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
  FileChange,
  ChangeSet,
  InteractiveReviewer,
  GitVerificationHandler,
  BundleProcessor,
  FileOperation
};