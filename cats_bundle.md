# Cats Bundle
# Format: FULL

🐈 --- CATS_START_FILE: js/paws-session.js ---
```
#!/usr/bin/env node
/**
 * PAWS Session Management - Stateful sessions via Git Worktrees
 * Part of the PAWS CLI Evolution - Phase 3 Implementation
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');
const { program } = require('commander');
const inquirer = require('inquirer');
const Table = require('cli-table3');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

// Git support
let simpleGit;
try {
  simpleGit = require('simple-git');
} catch (e) {
  console.error('simple-git is required for session management');
  process.exit(1);
}

/**
 * Session status enum
 */
const SessionStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  MERGED: 'merged',
  ABANDONED: 'abandoned'
};

/**
 * Represents a single turn in a session
 */
class SessionTurn {
  constructor(turnNumber, timestamp, command, commitHash = null, catsFile = null, dogsFile = null, verificationResult = null, notes = null) {
    this.turnNumber = turnNumber;
    this.timestamp = timestamp;
    this.command = command;
    this.commitHash = commitHash;
    this.catsFile = catsFile;
    this.dogsFile = dogsFile;
    this.verificationResult = verificationResult;
    this.notes = notes;
  }

  toJSON() {
    return {
      turnNumber: this.turnNumber,
      timestamp: this.timestamp,
      command: this.command,
      commitHash: this.commitHash,
      catsFile: this.catsFile,
      dogsFile: this.dogsFile,
      verificationResult: this.verificationResult,
      notes: this.notes
    };
  }

  static fromJSON(data) {
    return new SessionTurn(
      data.turnNumber,
      data.timestamp,
      data.command,
      data.commitHash,
      data.catsFile,
      data.dogsFile,
      data.verificationResult,
      data.notes
    );
  }
}

/**
 * Represents a PAWS work session
 */
class Session {
  constructor(sessionId, name, createdAt, status, baseBranch, baseCommit, workspacePath, turns = [], metadata = {}) {
    this.sessionId = sessionId;
    this.name = name;
    this.createdAt = createdAt;
    this.status = status;
    this.baseBranch = baseBranch;
    this.baseCommit = baseCommit;
    this.workspacePath = workspacePath;
    this.turns = turns;
    this.metadata = metadata;
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      name: this.name,
      createdAt: this.createdAt,
      status: this.status,
      baseBranch: this.baseBranch,
      baseCommit: this.baseCommit,
      workspacePath: this.workspacePath,
      turns: this.turns.map(t => t.toJSON()),
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    return new Session(
      data.sessionId,
      data.name,
      data.createdAt,
      data.status,
      data.baseBranch,
      data.baseCommit,
      data.workspacePath,
      (data.turns || []).map(t => SessionTurn.fromJSON(t)),
      data.metadata || {}
    );
  }
}

/**
 * Manages PAWS work sessions using git worktrees
 */
class SessionManager {
  constructor(rootPath = '.') {
    this.rootPath = path.resolve(rootPath);
    this.pawsDir = path.join(this.rootPath, '.paws');
    this.sessionsDir = path.join(this.pawsDir, 'sessions');
    this.git = simpleGit(this.rootPath);
  }

  /**
   * Initialize directories
   */
  async initializeDirectories() {
    await fs.mkdir(this.pawsDir, { recursive: true });
    await fs.mkdir(this.sessionsDir, { recursive: true });

    // Add .paws to gitignore if not already there
    const gitignorePath = path.join(this.rootPath, '.gitignore');
    try {
      let content = await fs.readFile(gitignorePath, 'utf-8');
      if (!content.includes('.paws/')) {
        content += '\n# PAWS session data\n.paws/\n';
        await fs.writeFile(gitignorePath, content);
      }
    } catch {
      // No gitignore file, create one
      await fs.writeFile(gitignorePath, '# PAWS session data\n.paws/\n');
    }
  }

  /**
   * Get session path
   */
  getSessionPath(sessionId) {
    return path.join(this.sessionsDir, sessionId);
  }

  /**
   * Load a session from disk
   */
  async loadSession(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    const manifestPath = path.join(sessionPath, 'session.json');

    try {
      const data = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      return Session.fromJSON(data);
    } catch {
      return null;
    }
  }

  /**
   * Save a session to disk
   */
  async saveSession(session) {
    const sessionPath = this.getSessionPath(session.sessionId);
    await fs.mkdir(sessionPath, { recursive: true });

    const manifestPath = path.join(sessionPath, 'session.json');
    await fs.writeFile(manifestPath, JSON.stringify(session.toJSON(), null, 2));
  }

  /**
   * Check if we're in a git repository
   */
  async isGitRepo() {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new work session
   */
  async createSession(name, baseBranch = null) {
    if (!(await this.isGitRepo())) {
      throw new Error('Not in a git repository');
    }

    await this.initializeDirectories();

    const sessionId = uuidv4().slice(0, 8);
    const timestamp = new Date().toISOString();

    // Get current branch and commit
    if (!baseBranch) {
      const status = await this.git.status();
      baseBranch = status.current;
    }
    const baseCommit = await this.git.revparse(['HEAD']);

    // Create worktree for the session
    const workspacePath = path.join(this.getSessionPath(sessionId), 'workspace');
    const branchName = `paws-session-${sessionId}`;

    try {
      // Create a new branch and worktree
      await this.git.raw(['worktree', 'add', '-b', branchName, workspacePath, baseCommit]);
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error.message}`);
    }

    // Create session object
    const session = new Session(
      sessionId,
      name,
      timestamp,
      SessionStatus.ACTIVE,
      baseBranch,
      baseCommit,
      workspacePath,
      []
    );

    // Save session
    await this.saveSession(session);

    console.log(chalk.green(`✓ Created session: ${sessionId} - ${name}`));
    console.log(chalk.gray(`  Workspace: ${workspacePath}`));
    console.log(chalk.gray(`  Base: ${baseBranch} (${baseCommit.slice(0, 8)})`));

    return session;
  }

  /**
   * List all sessions
   */
  async listSessions(status = null) {
    await this.initializeDirectories();
    const sessions = [];

    try {
      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const session = await this.loadSession(entry.name);
          if (session) {
            if (!status || session.status === status) {
              sessions.push(session);
            }
          }
        }
      }
    } catch {
      // No sessions yet
    }

    return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId) {
    return await this.loadSession(sessionId);
  }

  /**
   * Add a turn to a session
   */
  async addTurn(sessionId, command, options = {}) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const turnNumber = session.turns.length + 1;
    const timestamp = new Date().toISOString();

    const turn = new SessionTurn(
      turnNumber,
      timestamp,
      command,
      options.commitHash,
      options.catsFile,
      options.dogsFile,
      options.verificationResult,
      options.notes
    );

    session.turns.push(turn);

    // Create a checkpoint commit if in workspace
    const workspaceGit = simpleGit(session.workspacePath);
    try {
      const status = await workspaceGit.status();
      if (status.modified.length > 0 || status.not_added.length > 0) {
        await workspaceGit.add('./*');
        const commitMsg = `Turn ${turnNumber}: ${command.slice(0, 50)}`;
        await workspaceGit.commit(commitMsg);
        const commitHash = await workspaceGit.revparse(['HEAD']);
        turn.commitHash = commitHash;
      }
    } catch (error) {
      console.warn(`Could not create checkpoint: ${error.message}`);
    }

    await this.saveSession(session);
    return turn;
  }

  /**
   * Rewind a session to a previous turn
   */
  async rewindSession(sessionId, toTurn) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (toTurn < 1 || toTurn > session.turns.length) {
      throw new Error(`Invalid turn number: ${toTurn}`);
    }

    const targetTurn = session.turns[toTurn - 1];
    if (!targetTurn.commitHash) {
      console.log(chalk.yellow(`Turn ${toTurn} has no checkpoint commit`));
      return false;
    }

    try {
      const workspaceGit = simpleGit(session.workspacePath);
      await workspaceGit.reset(['--hard', targetTurn.commitHash]);

      // Remove turns after the target
      session.turns = session.turns.slice(0, toTurn);
      await this.saveSession(session);

      console.log(chalk.green(`✓ Rewound session to turn ${toTurn}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to rewind: ${error.message}`));
      return false;
    }
  }

  /**
   * Merge a session's changes back to the main branch
   */
  async mergeSession(sessionId, targetBranch = null) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!targetBranch) {
      targetBranch = session.baseBranch;
    }

    try {
      // Switch to target branch in main repo
      await this.git.checkout(targetBranch);

      // Merge the session branch
      const sessionBranch = `paws-session-${sessionId}`;
      await this.git.merge([sessionBranch, '--no-ff', '-m', `Merge PAWS session: ${session.name}`]);

      // Update session status
      session.status = SessionStatus.MERGED;
      await this.saveSession(session);

      // Clean up worktree
      await this.git.raw(['worktree', 'remove', session.workspacePath]);

      console.log(chalk.green(`✓ Merged session ${sessionId} into ${targetBranch}`));
      return true;

    } catch (error) {
      console.error(chalk.red(`Failed to merge: ${error.message}`));
      return false;
    }
  }

  /**
   * Archive a session without merging
   */
  async archiveSession(sessionId) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Remove worktree but keep the branch
      try {
        await this.git.raw(['worktree', 'remove', session.workspacePath]);
      } catch {
        // Worktree might already be removed
      }

      session.status = SessionStatus.ARCHIVED;
      await this.saveSession(session);

      console.log(chalk.green(`✓ Archived session ${sessionId}`));
      return true;

    } catch (error) {
      console.error(chalk.red(`Failed to archive: ${error.message}`));
      return false;
    }
  }

  /**
   * Delete a session completely
   */
  async deleteSession(sessionId) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return false;
    }

    try {
      // Remove worktree if it exists
      try {
        await this.git.raw(['worktree', 'remove', session.workspacePath, '--force']);
      } catch {
        // Worktree might not exist
      }

      // Delete the branch
      const branchName = `paws-session-${sessionId}`;
      try {
        await this.git.branch(['-D', branchName]);
      } catch {
        // Branch might not exist
      }

      // Remove session directory
      const sessionPath = this.getSessionPath(sessionId);
      await fs.rm(sessionPath, { recursive: true, force: true });

      console.log(chalk.green(`✓ Deleted session ${sessionId}`));
      return true;

    } catch (error) {
      console.error(chalk.red(`Failed to delete: ${error.message}`));
      return false;
    }
  }
}

/**
 * Session CLI with interactive interface
 */
class SessionCLI {
  constructor() {
    this.manager = new SessionManager();
  }

  /**
   * Start a new session
   */
  async startSession(name, baseBranch) {
    try {
      const session = await this.manager.createSession(name, baseBranch);
      
      console.log(chalk.bold.green('\n📦 New Session Created!\n'));
      console.log(`To work in this session, use:`);
      console.log(chalk.cyan(`  cd ${session.workspacePath}`));
      console.log(`\nOr use with PAWS commands:`);
      console.log(chalk.cyan(`  cats-enhanced --session ${session.sessionId} ...`));
      console.log(chalk.cyan(`  dogs-enhanced --session ${session.sessionId} ...`));
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * List all sessions
   */
  async listSessions(showArchived = false) {
    try {
      const sessions = await this.manager.listSessions();
      
      if (sessions.length === 0) {
        console.log(chalk.yellow('No sessions found.'));
        return;
      }

      const table = new Table({
        head: ['ID', 'Name', 'Status', 'Created', 'Turns', 'Base Branch'],
        style: { head: ['cyan'] }
      });

      for (const session of sessions) {
        if (!showArchived && session.status === SessionStatus.ARCHIVED) {
          continue;
        }

        const statusColor = {
          [SessionStatus.ACTIVE]: chalk.green,
          [SessionStatus.ARCHIVED]: chalk.yellow,
          [SessionStatus.MERGED]: chalk.blue,
          [SessionStatus.ABANDONED]: chalk.red
        }[session.status] || chalk.white;

        table.push([
          session.sessionId,
          session.name,
          statusColor(session.status),
          new Date(session.createdAt).toLocaleDateString(),
          session.turns.length.toString(),
          session.baseBranch
        ]);
      }

      console.log(chalk.bold('\n📋 PAWS Sessions\n'));
      console.log(table.toString());
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Show session details with blessed TUI
   */
  async showSessionInteractive(sessionId) {
    const session = await this.manager.getSession(sessionId);
    if (!session) {
      console.log(chalk.red(`Session ${sessionId} not found.`));
      return;
    }

    const screen = blessed.screen({
      smartCSR: true,
      title: `PAWS Session: ${session.name}`
    });

    const grid = new contrib.grid({ rows: 12, cols: 12, screen });

    // Session info panel
    const infoBox = grid.set(0, 0, 3, 6, blessed.box, {
      label: 'Session Information',
      content: `ID: ${session.sessionId}\n` +
               `Name: ${session.name}\n` +
               `Status: ${session.status}\n` +
               `Created: ${new Date(session.createdAt).toLocaleString()}\n` +
               `Base: ${session.baseBranch} @ ${session.baseCommit.slice(0, 8)}`
    });

    // Turns list
    const turnsList = grid.set(3, 0, 9, 6, blessed.list, {
      label: `Turns (${session.turns.length})`,
      keys: true,
      vi: true,
      style: {
        selected: { bg: 'blue' }
      }
    });

    // Turn details
    const turnDetails = grid.set(0, 6, 12, 6, blessed.box, {
      label: 'Turn Details',
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true
    });

    // Populate turns list
    const turnItems = session.turns.map(turn => {
      const status = turn.verificationResult === true ? '✓' :
                    turn.verificationResult === false ? '✗' : ' ';
      return `${status} Turn ${turn.turnNumber}: ${turn.command.slice(0, 40)}`;
    });
    turnsList.setItems(turnItems);

    // Update turn details when selection changes
    turnsList.on('select', (item, index) => {
      const turn = session.turns[index];
      if (turn) {
        let details = `Turn Number: ${turn.turnNumber}\n`;
        details += `Timestamp: ${new Date(turn.timestamp).toLocaleString()}\n`;
        details += `Command: ${turn.command}\n`;
        if (turn.commitHash) {
          details += `Commit: ${turn.commitHash.slice(0, 8)}\n`;
        }
        if (turn.verificationResult !== null) {
          details += `Verification: ${turn.verificationResult ? 'Passed' : 'Failed'}\n`;
        }
        if (turn.notes) {
          details += `\nNotes:\n${turn.notes}`;
        }
        turnDetails.setContent(details);
        screen.render();
      }
    });

    // Select first turn
    if (session.turns.length > 0) {
      turnsList.select(0);
    }

    screen.key(['q', 'escape', 'C-c'], () => {
      screen.destroy();
    });

    screen.render();
  }

  /**
   * Show session details (simple)
   */
  async showSession(sessionId) {
    try {
      const session = await this.manager.getSession(sessionId);
      if (!session) {
        console.log(chalk.red(`Session ${sessionId} not found.`));
        return;
      }

      console.log(chalk.bold(`\n📦 Session: ${session.name} (${sessionId})\n`));
      console.log(`Status: ${session.status}`);
      console.log(`Created: ${new Date(session.createdAt).toLocaleString()}`);
      console.log(`Base: ${session.baseBranch} @ ${session.baseCommit.slice(0, 8)}`);
      console.log(`Workspace: ${session.workspacePath}`);
      console.log(`Turns: ${session.turns.length}`);

      if (session.turns.length > 0) {
        console.log(chalk.bold('\nRecent Turns:'));
        const recentTurns = session.turns.slice(-5);
        for (const turn of recentTurns) {
          const status = turn.verificationResult === true ? chalk.green('✓') :
                        turn.verificationResult === false ? chalk.red('✗') : ' ';
          console.log(`  ${status} Turn ${turn.turnNumber}: ${turn.command.slice(0, 50)}`);
        }
        if (session.turns.length > 5) {
          console.log(chalk.gray(`  ... and ${session.turns.length - 5} more`));
        }
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Interactive session operations
   */
  async interactiveMenu() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Start new session', value: 'start' },
          { name: 'List sessions', value: 'list' },
          { name: 'Show session details', value: 'show' },
          { name: 'Merge session', value: 'merge' },
          { name: 'Archive session', value: 'archive' },
          { name: 'Delete session', value: 'delete' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'start':
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Session name:',
            validate: input => input.length > 0
          }
        ]);
        await this.startSession(name);
        break;

      case 'list':
        await this.listSessions(true);
        break;

      case 'show':
      case 'merge':
      case 'archive':
      case 'delete':
        const sessions = await this.manager.listSessions();
        if (sessions.length === 0) {
          console.log(chalk.yellow('No sessions found.'));
          break;
        }

        const { sessionId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sessionId',
            message: 'Select session:',
            choices: sessions.map(s => ({
              name: `${s.sessionId} - ${s.name} [${s.status}]`,
              value: s.sessionId
            }))
          }
        ]);

        if (action === 'show') {
          await this.showSession(sessionId);
        } else if (action === 'merge') {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Merge this session?',
              default: false
            }
          ]);
          if (confirm) {
            await this.manager.mergeSession(sessionId);
          }
        } else if (action === 'archive') {
          await this.manager.archiveSession(sessionId);
        } else if (action === 'delete') {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: chalk.red('Permanently delete this session?'),
              default: false
            }
          ]);
          if (confirm) {
            await this.manager.deleteSession(sessionId);
          }
        }
        break;

      case 'exit':
        return;
    }

    // Show menu again
    await this.interactiveMenu();
  }
}

/**
 * Main CLI
 */
async function main() {
  program
    .name('paws-session')
    .description('PAWS Session Management - Stateful sessions via Git Worktrees')
    .version('1.0.0');

  program
    .command('start <name>')
    .description('Start a new session')
    .option('--base <branch>', 'Base branch (default: current branch)')
    .action(async (name, options) => {
      const cli = new SessionCLI();
      await cli.startSession(name, options.base);
    });

  program
    .command('list')
    .description('List all sessions')
    .option('--all', 'Include archived sessions')
    .action(async (options) => {
      const cli = new SessionCLI();
      await cli.listSessions(options.all);
    });

  program
    .command('show <sessionId>')
    .description('Show session details')
    .option('--interactive', 'Use interactive TUI')
    .action(async (sessionId, options) => {
      const cli = new SessionCLI();
      if (options.interactive) {
        await cli.showSessionInteractive(sessionId);
      } else {
        await cli.showSession(sessionId);
      }
    });

  program
    .command('rewind <sessionId>')
    .description('Rewind session to a turn')
    .requiredOption('--to-turn <n>', 'Turn number', parseInt)
    .action(async (sessionId, options) => {
      const manager = new SessionManager();
      await manager.rewindSession(sessionId, options.toTurn);
    });

  program
    .command('merge <sessionId>')
    .description('Merge session changes')
    .option('--into <branch>', 'Target branch (default: base branch)')
    .action(async (sessionId, options) => {
      const manager = new SessionManager();
      await manager.mergeSession(sessionId, options.into);
    });

  program
    .command('archive <sessionId>')
    .description('Archive a session')
    .action(async (sessionId) => {
      const manager = new SessionManager();
      await manager.archiveSession(sessionId);
    });

  program
    .command('delete <sessionId>')
    .description('Delete a session')
    .action(async (sessionId) => {
      const manager = new SessionManager();
      await manager.deleteSession(sessionId);
    });

  program
    .command('interactive')
    .description('Interactive session management')
    .action(async () => {
      const cli = new SessionCLI();
      await cli.interactiveMenu();
    });

  program.parse();

  // Show interactive menu if no command specified
  if (!process.argv.slice(2).length) {
    const cli = new SessionCLI();
    await cli.interactiveMenu();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  });
}

// Export for use as module
module.exports = {
  SessionStatus,
  SessionTurn,
  Session,
  SessionManager,
  SessionCLI
};
```
🐈 --- CATS_END_FILE: js/paws-session.js ---

🐈 --- CATS_START_FILE: js/cats.js ---
```
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
```
🐈 --- CATS_END_FILE: js/cats.js ---

🐈 --- CATS_START_FILE: py/dogs.py ---
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DOGS - Differential Output Generator System

Extracts files from PAWS bundles with support for:
- Interactive review mode with visual diffs
- Git-based verification and atomic rollback
- Delta command application
- Binary file handling
- PAWS_CMD support for AI-driven workflows
"""

import sys
import os
import argparse
import base64
import re
import difflib
import subprocess
import json
import tempfile
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict, Tuple
from enum import Enum

# For interactive mode
try:
    from rich.console import Console
    from rich.layout import Layout
    from rich.panel import Panel
    from rich.syntax import Syntax
    from rich.table import Table
    from rich.prompt import Prompt, Confirm
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.live import Live
    from rich.text import Text
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# For git operations
try:
    import git
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False

# --- Configuration Constants ---
DEFAULT_ENCODING = "utf-8"
DEFAULT_INPUT_BUNDLE_FILENAME = "dogs.md"
DEFAULT_OUTPUT_DIR = "."

# --- Bundle Structure Constants ---
BASE64_HINT_TEXT = "Content:Base64"
DOGS_MARKER_REGEX = re.compile(
    r"^\s*🐕\s*-{3,}\s*DOGS_(START|END)_FILE\s*:\s*(.+?)(\s*\("
    + re.escape(BASE64_HINT_TEXT)
    + r"\))?\s*-{3,}\s*$",
    re.IGNORECASE,
)
RSI_MARKER_REGEX = re.compile(
    r"^\s*⛓️\s*-{3,}\s*RSI_LINK_(START|END)_FILE\s*:\s*(.+?)(\s*\("
    + re.escape(BASE64_HINT_TEXT)
    + r"\))?\s*-{3,}\s*$",
    re.IGNORECASE,
)
PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$")
MARKDOWN_FENCE_REGEX = re.compile(r"^\s*```[\w-]*\s*$")

# --- Command Regexes (Full backward compatibility) ---
REPLACE_LINES_REGEX = re.compile(
    r"REPLACE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)
INSERT_AFTER_LINE_REGEX = re.compile(r"INSERT_AFTER_LINE\(\s*(\d+)\s*\)", re.IGNORECASE)
DELETE_LINES_REGEX = re.compile(
    r"DELETE_LINES\(\s*(\d+)\s*,\s*(\d+)\s*\)", re.IGNORECASE
)
DELETE_FILE_REGEX = re.compile(r"DELETE_FILE\(\s*\)", re.IGNORECASE)
REQUEST_CONTEXT_REGEX = re.compile(r"REQUEST_CONTEXT\((.+)\)", re.IGNORECASE)
EXECUTE_AND_REINVOKE_REGEX = re.compile(r"EXECUTE_AND_REINVOKE\((.+)\)", re.IGNORECASE)


class FileOperation(Enum):
    CREATE = "CREATE"
    MODIFY = "MODIFY"
    DELETE = "DELETE"


@dataclass
class FileChange:
    """Represents a single file change in the bundle"""
    file_path: str
    operation: FileOperation
    old_content: Optional[str] = None
    new_content: Optional[str] = None
    is_binary: bool = False
    status: str = "pending"  # pending, accepted, rejected, skipped
    delta_commands: List[Dict] = field(default_factory=list)  # For backward compatibility
    
    def get_diff(self) -> str:
        """Generate a unified diff for this change"""
        if self.operation == FileOperation.DELETE:
            return f"File will be deleted: {self.file_path}"
        elif self.operation == FileOperation.CREATE:
            return f"New file will be created: {self.file_path}"
        elif self.old_content is not None and self.new_content is not None:
            old_lines = self.old_content.splitlines(keepends=True)
            new_lines = self.new_content.splitlines(keepends=True)
            return "".join(
                difflib.unified_diff(
                    old_lines,
                    new_lines,
                    fromfile=f"a/{self.file_path}",
                    tofile=f"b/{self.file_path}",
                )
            )
        return ""


@dataclass
class ChangeSet:
    """Collection of all file changes in a bundle"""
    changes: List[FileChange] = field(default_factory=list)
    
    def add_change(self, change: FileChange):
        self.changes.append(change)
    
    def get_accepted(self) -> List[FileChange]:
        return [c for c in self.changes if c.status == "accepted"]
    
    def get_pending(self) -> List[FileChange]:
        return [c for c in self.changes if c.status == "pending"]
    
    def summary(self) -> Dict[str, int]:
        return {
            "total": len(self.changes),
            "accepted": len([c for c in self.changes if c.status == "accepted"]),
            "rejected": len([c for c in self.changes if c.status == "rejected"]),
            "pending": len([c for c in self.changes if c.status == "pending"]),
        }


class InteractiveReviewer:
    """Interactive TUI for reviewing changes"""
    
    def __init__(self, changeset: ChangeSet):
        self.changeset = changeset
        self.current_index = 0
        self.console = Console() if RICH_AVAILABLE else None
    
    def review(self) -> ChangeSet:
        """Main review loop"""
        if not RICH_AVAILABLE:
            print("Rich library not available. Falling back to basic review mode.")
            return self._basic_review()
        
        return self._rich_review()
    
    def _basic_review(self) -> ChangeSet:
        """Fallback review without rich TUI"""
        print("\n=== Interactive Review Mode ===\n")
        
        for i, change in enumerate(self.changeset.changes):
            print(f"\n[{i+1}/{len(self.changeset.changes)}] {change.file_path}")
            print(f"Operation: {change.operation.value}")
            
            if change.operation == FileOperation.MODIFY:
                diff = change.get_diff()
                if diff:
                    print("\nDiff:")
                    print(diff[:1000])  # Limit diff output
                    if len(diff) > 1000:
                        print("... (diff truncated)")
            
            while True:
                choice = input("\n[a]ccept / [r]eject / [s]kip / [q]uit: ").lower()
                if choice == 'a':
                    change.status = "accepted"
                    break
                elif choice == 'r':
                    change.status = "rejected"
                    break
                elif choice == 's':
                    change.status = "pending"
                    break
                elif choice == 'q':
                    return self.changeset
                else:
                    print("Invalid choice. Please try again.")
        
        return self.changeset
    
    def _rich_review(self) -> ChangeSet:
        """Interactive review with rich TUI"""
        self.console.clear()
        
        with Live(self._get_display(), console=self.console, refresh_per_second=4) as live:
            while self.current_index < len(self.changeset.changes):
                change = self.changeset.changes[self.current_index]
                
                # Update display
                live.update(self._get_display())
                
                # Get user input
                choice = Prompt.ask(
                    "[bold yellow]Action[/]",
                    choices=["a", "r", "s", "p", "n", "q"],
                    default="s"
                )
                
                if choice == 'a':  # Accept
                    change.status = "accepted"
                    self.current_index += 1
                elif choice == 'r':  # Reject
                    change.status = "rejected"
                    self.current_index += 1
                elif choice == 's':  # Skip
                    change.status = "pending"
                    self.current_index += 1
                elif choice == 'p':  # Previous
                    if self.current_index > 0:
                        self.current_index -= 1
                elif choice == 'n':  # Next
                    if self.current_index < len(self.changeset.changes) - 1:
                        self.current_index += 1
                elif choice == 'q':  # Quit
                    if Confirm.ask("Apply accepted changes and exit?"):
                        break
        
        return self.changeset
    
    def _get_display(self) -> Layout:
        """Generate the display layout"""
        layout = Layout()
        
        # Create the layout structure
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body"),
            Layout(name="footer", size=5)
        )
        
        # Header with progress
        summary = self.changeset.summary()
        header_text = f"[bold]PAWS Interactive Review[/] | File {self.current_index + 1}/{summary['total']} | Accepted: {summary['accepted']} | Rejected: {summary['rejected']}"
        layout["header"].update(Panel(header_text))
        
        # Body with current file and diff
        if self.current_index < len(self.changeset.changes):
            change = self.changeset.changes[self.current_index]
            
            # File info
            file_info = Table(show_header=False, box=None)
            file_info.add_column("Property", style="cyan")
            file_info.add_column("Value")
            file_info.add_row("File", change.file_path)
            file_info.add_row("Operation", change.operation.value)
            file_info.add_row("Status", change.status)
            
            # Diff display
            diff_text = change.get_diff()
            if diff_text:
                syntax = Syntax(diff_text, "diff", theme="monokai", line_numbers=True)
            else:
                syntax = Text("No diff available", style="dim")
            
            body_layout = Layout()
            body_layout.split_row(
                Layout(Panel(file_info, title="File Info"), ratio=1),
                Layout(Panel(syntax, title="Changes"), ratio=3)
            )
            layout["body"].update(body_layout)
        
        # Footer with controls
        controls = "[bold]Controls:[/] [a]ccept | [r]eject | [s]kip | [p]revious | [n]ext | [q]uit & apply"
        layout["footer"].update(Panel(controls))
        
        return layout


class GitVerificationHandler:
    """Handles git-based verification and rollback"""
    
    def __init__(self, repo_path: Path = Path(".")):
        self.repo_path = repo_path
        self.repo = None
        self.stash_entry = None
        
        if GIT_AVAILABLE:
            try:
                self.repo = git.Repo(repo_path)
            except:
                self.repo = None
    
    def is_git_repo(self) -> bool:
        """Check if we're in a git repository"""
        return self.repo is not None
    
    def create_checkpoint(self) -> bool:
        """Create a git stash checkpoint"""
        if not self.repo:
            return False
        
        try:
            # Check if there are changes to stash
            if self.repo.is_dirty(untracked_files=True):
                self.stash_entry = self.repo.git.stash('push', '-m', 'PAWS: Pre-apply checkpoint')
                return True
            return True  # Clean state is also valid
        except Exception as e:
            print(f"Failed to create checkpoint: {e}")
            return False
    
    def rollback(self) -> bool:
        """Rollback to the checkpoint"""
        if not self.repo or not self.stash_entry:
            return False
        
        try:
            self.repo.git.stash('pop')
            self.stash_entry = None
            return True
        except Exception as e:
            print(f"Failed to rollback: {e}")
            return False
    
    def finalize(self) -> bool:
        """Finalize changes by dropping the stash"""
        if not self.repo or not self.stash_entry:
            return True
        
        try:
            self.repo.git.stash('drop')
            self.stash_entry = None
            return True
        except Exception as e:
            print(f"Failed to finalize: {e}")
            return False
    
    def run_verification(self, command: str) -> Tuple[bool, str]:
        """Run verification command and return success status and output"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            output = result.stdout + result.stderr
            return result.returncode == 0, output
        except subprocess.TimeoutExpired:
            return False, "Verification command timed out after 5 minutes"
        except Exception as e:
            return False, str(e)


class BundleProcessor:
    """Main processor for DOGS bundle extraction and application"""
    
    def __init__(self, config):
        self.config = config
        self.changeset = ChangeSet()
        self.git_handler = GitVerificationHandler() if config.get("verify") else None
        self.use_rsi_link = config.get("rsi_link", False)
        self.allow_reinvoke = config.get("allow_reinvoke", False)
        self.verify_docs = config.get("verify_docs", False)
        self.apply_delta_from = config.get("apply_delta_from")
        self.original_files = self._load_original_bundle() if self.apply_delta_from else {}
    
    def _load_original_bundle(self) -> Dict[str, List[str]]:
        """Load original bundle for delta application"""
        if not self.apply_delta_from:
            return {}
        
        print(f"Loading delta reference from '{self.apply_delta_from}'...")
        try:
            with open(self.apply_delta_from, 'r', encoding=DEFAULT_ENCODING) as f:
                content = f.read()
            
            # Parse the original bundle to extract file contents
            temp_processor = BundleProcessor({"apply_delta_from": None})
            temp_changeset = temp_processor.parse_bundle(content)
            
            original_files = {}
            for change in temp_changeset.changes:
                if change.new_content:
                    original_files[change.file_path] = change.new_content.splitlines()
            
            return original_files
        except Exception as e:
            raise IOError(f"Could not load delta reference bundle: {e}")
    
    def parse_bundle(self, bundle_content: str) -> ChangeSet:
        """Parse bundle content into a ChangeSet with FULL backward compatibility"""
        lines = bundle_content.splitlines()
        in_file = False
        current_file = None
        current_content = []
        is_binary = False
        current_commands = []
        
        # Choose marker based on RSI-Link mode
        marker_regex = RSI_MARKER_REGEX if self.use_rsi_link else DOGS_MARKER_REGEX
        
        for line_num, line in enumerate(lines, 1):
            match = marker_regex.match(line)
            
            if match:
                if match.group(1).upper() == "START":
                    in_file = True
                    current_file = match.group(2).strip()
                    is_binary = bool(match.group(3))
                    current_content = []
                    current_commands = []
                elif match.group(1).upper() == "END" and in_file:
                    # Process the collected file
                    self._process_file(current_file, current_content, is_binary, current_commands)
                    in_file = False
                    current_file = None
            elif in_file:
                # Check for PAWS_CMD
                cmd_match = PAWS_CMD_REGEX.match(line)
                if cmd_match:
                    cmd = self._parse_paws_command(cmd_match.group(1).strip())
                    if cmd:
                        # Handle agentic commands immediately
                        if cmd["type"] in ["request_context", "execute_and_reinvoke"]:
                            self._handle_agentic_command(cmd)
                        else:
                            current_commands.append(cmd)
                            # Collect content for this command
                            if current_content and current_commands and \
                               current_commands[-1].get("type") not in ["delete_lines", "delete_file"]:
                                current_commands[-1]["content_lines"] = self._clean_content(current_content)
                                current_content = []
                else:
                    current_content.append(line)
        
        return self.changeset
    
    def _parse_paws_command(self, cmd_str: str) -> Optional[Dict[str, Any]]:
        """Parse PAWS_CMD for FULL backward compatibility"""
        # REQUEST_CONTEXT command
        if m := REQUEST_CONTEXT_REGEX.match(cmd_str):
            return {
                "type": "request_context",
                "args": self._parse_cmd_args(m.group(1))
            }
        # EXECUTE_AND_REINVOKE command
        if m := EXECUTE_AND_REINVOKE_REGEX.match(cmd_str):
            return {
                "type": "execute_and_reinvoke",
                "args": self._parse_cmd_args(m.group(1))
            }
        # Delta commands
        if DELETE_FILE_REGEX.match(cmd_str):
            return {"type": "delete_file"}
        if m := REPLACE_LINES_REGEX.match(cmd_str):
            return {"type": "replace", "start": int(m.group(1)), "end": int(m.group(2))}
        if m := INSERT_AFTER_LINE_REGEX.match(cmd_str):
            return {"type": "insert", "line_num": int(m.group(1))}
        if m := DELETE_LINES_REGEX.match(cmd_str):
            return {
                "type": "delete_lines",
                "start": int(m.group(1)),
                "end": int(m.group(2))
            }
        return None
    
    def _parse_cmd_args(self, arg_str: str) -> Dict[str, str]:
        """Parse PAWS_CMD arguments"""
        args = {}
        try:
            raw_args = re.findall(r'(\w+)\s*=\s*"((?:\\"|[^"])*)"', arg_str)
            for key, value in raw_args:
                args[key] = value.replace('\\"', '"')
        except Exception:
            pass
        return args
    
    def _handle_agentic_command(self, cmd: Dict[str, Any]):
        """Handle REQUEST_CONTEXT and EXECUTE_AND_REINVOKE commands"""
        if cmd["type"] == "request_context":
            print(f"\n--- AI Context Request ---", file=sys.stderr)
            print("The AI has paused execution and requires more context.", file=sys.stderr)
            if reason := cmd["args"].get("reason"):
                print(f"\nReason: {reason}", file=sys.stderr)
            if suggested := cmd["args"].get("suggested_command"):
                print(f"\nSuggested command: {suggested}", file=sys.stderr)
            sys.exit(0)
        elif cmd["type"] == "execute_and_reinvoke":
            if not self.allow_reinvoke:
                print("AI requested command execution, but --allow-reinvoke is not set.", file=sys.stderr)
                sys.exit(1)
            command = cmd["args"].get("command_to_run")
            if not command:
                print("AI requested command execution but provided no command.", file=sys.stderr)
                sys.exit(1)
            
            # Security: Validate command against allowlist
            allowed_patterns = [
                r'^npm (test|run test|run build|run lint)$',
                r'^yarn (test|build|lint)$',
                r'^pnpm (test|build|lint)$',
                r'^make (test|check|build)$',
                r'^pytest',
                r'^cargo (test|build|check)$',
                r'^go test',
                r'^python -m pytest',
                r'^\./test\.sh$'
            ]
            
            import re
            command_safe = command.strip()
            if not any(re.match(pattern, command_safe) for pattern in allowed_patterns):
                print(f"\n⚠️  Security: Command not in allowlist: {command}", file=sys.stderr)
                print("Allowed patterns: npm test, yarn test, pytest, cargo test, etc.", file=sys.stderr)
                sys.exit(1)
            
            print(f"\nAI wants to execute: {command}", file=sys.stderr)
            if input("Proceed? [y/N]: ").lower().strip() == "y":
                # Use subprocess without shell for safety
                parts = command_safe.split()
                subprocess.run(parts, check=True)
                print("Command finished. Re-invoke the AI with new context.", file=sys.stderr)
            sys.exit(0)
    
    def _process_file(self, file_path: str, content_lines: List[str], is_binary: bool, commands: List[Dict] = None):
        """Process a single file from the bundle with FULL delta support"""
        # Check for delete command
        if commands and any(cmd.get("type") == "delete_file" for cmd in commands):
            change = FileChange(
                file_path=file_path,
                operation=FileOperation.DELETE,
                old_content=None,
                new_content=None,
                is_binary=is_binary
            )
            self.changeset.add_change(change)
            return
        
        # Clean up content
        content_lines = self._clean_content(content_lines)
        
        # Determine operation
        abs_path = Path(self.config.get("output_dir", ".")) / file_path
        
        if abs_path.exists():
            operation = FileOperation.MODIFY
            old_content = abs_path.read_text(encoding=DEFAULT_ENCODING) if not is_binary else None
        else:
            operation = FileOperation.CREATE
            old_content = None
        
        # Handle delta commands if present
        if commands:
            # Check if we need original content from delta reference
            if self.original_files and file_path in self.original_files:
                original_lines = self.original_files[file_path]
            elif old_content:
                original_lines = old_content.splitlines()
            else:
                original_lines = []
            
            if original_lines:
                new_content = self._apply_delta_commands(original_lines, commands)
            else:
                # Can't apply deltas without original content
                print(f"Warning: Cannot apply delta commands for '{file_path}' - no original content")
                new_content = "\n".join(content_lines) if content_lines else ""
        else:
            # Handle content normally
            if is_binary:
                content_str = "\n".join(content_lines)
                new_content = base64.b64decode(content_str).decode(DEFAULT_ENCODING, errors='ignore')
            else:
                new_content = "\n".join(content_lines)
        
        change = FileChange(
            file_path=file_path,
            operation=operation,
            old_content=old_content,
            new_content=new_content,
            is_binary=is_binary,
            delta_commands=commands or []
        )
        
        self.changeset.add_change(change)
    
    def _apply_delta_commands(self, original_lines: List[str], commands: List[Dict]) -> str:
        """Apply delta commands to original content - FULL compatibility"""
        new_lines = list(original_lines)
        offset = 0
        
        for cmd in commands:
            cmd_type = cmd["type"]
            content = cmd.get("content_lines", [])
            
            if cmd_type == "replace":
                start = cmd["start"] - 1 + offset
                end = cmd["end"] + offset
                num_deleted = end - start
                new_lines[start:end] = content
                offset += len(content) - num_deleted
            elif cmd_type == "insert":
                line_num = cmd["line_num"] + offset
                new_lines[line_num:line_num] = content
                offset += len(content)
            elif cmd_type == "delete_lines":
                start = cmd["start"] - 1 + offset
                end = cmd["end"] + offset
                del new_lines[start:end]
                offset -= (end - start)
        
        return "\n".join(new_lines)
    
    def _clean_content(self, lines: List[str]) -> List[str]:
        """Remove markdown fences and clean up content"""
        if not lines:
            return []
        
        # Remove markdown fences
        if lines and MARKDOWN_FENCE_REGEX.match(lines[0]):
            lines = lines[1:]
        if lines and MARKDOWN_FENCE_REGEX.match(lines[-1]):
            lines = lines[:-1]
        
        # Remove leading/trailing empty lines
        while lines and not lines[0].strip():
            lines = lines[1:]
        while lines and not lines[-1].strip():
            lines = lines[:-1]
        
        return lines
    
    def apply_changes(self, changeset: ChangeSet) -> bool:
        """Apply accepted changes to the filesystem"""
        success_count = 0
        error_count = 0
        modified_paths = set()
        
        for change in changeset.get_accepted():
            try:
                abs_path = Path(self.config.get("output_dir", ".")) / change.file_path
                
                if change.operation == FileOperation.DELETE:
                    if abs_path.exists():
                        abs_path.unlink()
                        print(f"✓ Deleted: {change.file_path}")
                        success_count += 1
                else:
                    # Create parent directories if needed
                    abs_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Write content
                    if change.is_binary:
                        abs_path.write_bytes(change.new_content.encode(DEFAULT_ENCODING))
                    else:
                        abs_path.write_text(change.new_content, encoding=DEFAULT_ENCODING)
                    
                    action = "Created" if change.operation == FileOperation.CREATE else "Modified"
                    print(f"✓ {action}: {change.file_path}")
                    success_count += 1
                    modified_paths.add(change.file_path)
                    
            except Exception as e:
                print(f"✗ Failed to apply {change.file_path}: {e}")
                error_count += 1
        
        print(f"\nSummary: {success_count} succeeded, {error_count} failed")
        
        # Verify docs sync if requested
        if self.verify_docs and modified_paths:
            self._verify_docs_sync(modified_paths)
        
        return error_count == 0
    
    def _verify_docs_sync(self, modified_paths: set):
        """Verify README.md and CATSCAN.md are in sync"""
        print("\n--- Verifying Documentation Sync ---")
        warnings = 0
        for path in modified_paths:
            if path.lower().endswith("readme.md"):
                catscan_path = path.replace("README.md", "CATSCAN.md").replace("readme.md", "CATSCAN.md")
                if catscan_path not in modified_paths:
                    print(f"Warning: '{path}' was modified, but '{catscan_path}' was not.")
                    warnings += 1
        if warnings == 0:
            print("All README.md files have corresponding CATSCAN.md changes.")
    
    def run_with_verification(self, changeset: ChangeSet, verify_command: str) -> bool:
        """Apply changes with verification and rollback support"""
        if not self.git_handler or not self.git_handler.is_git_repo():
            print("Warning: Not in a git repository. Verification without rollback.")
            return self.apply_changes(changeset)
        
        # Create checkpoint
        print("Creating git checkpoint...")
        if not self.git_handler.create_checkpoint():
            print("Failed to create checkpoint. Aborting.")
            return False
        
        # Apply changes
        print("Applying changes...")
        if not self.apply_changes(changeset):
            print("Failed to apply some changes.")
            self.git_handler.rollback()
            return False
        
        # Run verification
        print(f"Running verification: {verify_command}")
        success, output = self.git_handler.run_verification(verify_command)
        
        if success:
            print("✓ Verification successful!")
            self.git_handler.finalize()
            return True
        else:
            print(f"✗ Verification failed:\n{output}")
            if self.config.get("revert_on_fail", False):
                print("Reverting changes...")
                self.git_handler.rollback()
                print("Changes reverted.")
            return False


def main():
    parser = argparse.ArgumentParser(
        description="DOGS - Extract and apply files from PAWS bundles with interactive review and verification"
    )
    parser.add_argument("bundle_file", nargs="?", default=DEFAULT_INPUT_BUNDLE_FILENAME,
                       help=f"Bundle file (default: {DEFAULT_INPUT_BUNDLE_FILENAME})")
    parser.add_argument("output_dir", nargs="?", default=DEFAULT_OUTPUT_DIR,
                       help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})")
    
    # Interactive mode (NEW)
    parser.add_argument("--interactive", "-i", action="store_true",
                       help="Enable interactive review mode")
    
    # Verification options (NEW)
    parser.add_argument("--verify", metavar="COMMAND",
                       help="Run verification command after applying changes")
    parser.add_argument("--revert-on-fail", action="store_true",
                       help="Automatically revert changes if verification fails")
    
    # BACKWARD COMPATIBILITY - Delta support
    parser.add_argument("-d", "--apply-delta", metavar="REF_BUNDLE",
                       help="Apply deltas using a reference bundle")
    
    # BACKWARD COMPATIBILITY - RSI-Link protocol
    parser.add_argument("--rsi-link", action="store_true",
                       help="Use RSI-Link protocol for self-modification")
    
    # BACKWARD COMPATIBILITY - Allow reinvoke
    parser.add_argument("--allow-reinvoke", action="store_true",
                       help="Allow AI to request command execution")
    
    # BACKWARD COMPATIBILITY - Verify docs
    parser.add_argument("--verify-docs", action="store_true",
                       help="Warn if README.md changed without CATSCAN.md")
    
    # Standard options
    parser.add_argument("-y", "--yes", action="store_true",
                       help="Auto-accept all changes")
    parser.add_argument("-n", "--no", action="store_true",
                       help="Auto-reject all changes")
    parser.add_argument("-q", "--quiet", action="store_true",
                       help="Suppress output")
    
    args = parser.parse_args()
    
    # Build config
    config = {
        "output_dir": args.output_dir,
        "interactive": args.interactive,
        "verify": args.verify,
        "revert_on_fail": args.revert_on_fail,
        "auto_accept": args.yes,
        "auto_reject": args.no,
        "quiet": args.quiet,
        "apply_delta_from": args.apply_delta,
        "rsi_link": args.rsi_link,
        "allow_reinvoke": args.allow_reinvoke,
        "verify_docs": args.verify_docs,
    }
    
    # Read bundle
    if args.bundle_file == "-":
        bundle_content = sys.stdin.read()
    else:
        with open(args.bundle_file, "r", encoding=DEFAULT_ENCODING) as f:
            bundle_content = f.read()
    
    # Process bundle
    processor = BundleProcessor(config)
    changeset = processor.parse_bundle(bundle_content)
    
    if not changeset.changes:
        print("No changes found in bundle.")
        return 0
    
    # Review changes
    if config["interactive"]:
        reviewer = InteractiveReviewer(changeset)
        changeset = reviewer.review()
    elif config["auto_accept"]:
        for change in changeset.changes:
            change.status = "accepted"
    elif config["auto_reject"]:
        for change in changeset.changes:
            change.status = "rejected"
    else:
        # Default: accept all
        for change in changeset.changes:
            change.status = "accepted"
    
    # Apply changes
    if config["verify"]:
        success = processor.run_with_verification(changeset, config["verify"])
    else:
        success = processor.apply_changes(changeset)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
```
🐈 --- CATS_END_FILE: py/dogs.py ---

🐈 --- CATS_START_FILE: js/dogs.js ---
```
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
```
🐈 --- CATS_END_FILE: js/dogs.js ---

🐈 --- CATS_START_FILE: py/cats.py ---
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CATS - Context Aggregation and Transformation System

Bundles project files into a single text artifact for Language Models with:
- AI-powered file curation based on task description
- Smart project structure analysis
- System prompt and persona support
- CATSCAN-aware bundling mode
- Module verification and API extraction
"""

import sys
import os
import argparse
import base64
import subprocess
import json
import re
import glob as glob_module
import ast
from pathlib import Path
from typing import List, Optional, Dict, Set, Any
from dataclasses import dataclass

# For AI curation
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# For git operations
try:
    import git
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False

# --- Configuration Constants ---
DEFAULT_SYS_PROMPT_FILENAME = "sys/sys_a.md"
DEFAULT_OUTPUT_FILENAME = "cats.md"
DEFAULT_ENCODING = "utf-8"
PAWSIGNORE_FILENAME = ".pawsignore"
DEFAULT_EXCLUDES = [
    ".git",
    "node_modules",
    "**/__pycache__",
    "**/*.pyc",
    ".DS_Store",
    "cats.md",
    "dogs.md",
]

# --- Bundle Structure Constants ---
PERSONA_HEADER = "\n--- START PERSONA ---\n"
PERSONA_FOOTER = "\n--- END PERSONA ---\n"
SYS_PROMPT_POST_SEPARATOR = (
    "\n--- END PREPENDED INSTRUCTIONS ---\nThe following content is the Cats Bundle.\n"
)
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: "
BASE64_HINT_TEXT = "(Content:Base64)"
START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {path}{hint} ---"
END_MARKER_TEMPLATE = "🐈 --- CATS_END_FILE: {path}{hint} ---"


@dataclass
class BundleConfig:
    """Configuration for bundling operation"""
    path_specs: List[str]
    exclude_patterns: List[str]
    output_file: Optional[Path]
    encoding_mode: str
    use_default_excludes: bool
    prepare_for_delta: bool
    persona_files: List[Path]
    sys_prompt_file: str
    no_sys_prompt: bool
    require_sys_prompt: bool
    strict_catscan: bool
    verify: Optional[str]
    quiet: bool
    yes: bool
    # AI curation (NEW)
    ai_curate: Optional[str] = None
    ai_provider: str = "gemini"
    ai_key: Optional[str] = None
    max_files: int = 20
    include_tests: bool = False


class PythonASTVisitor(ast.NodeVisitor):
    """Extract Python module API for verification"""
    def __init__(self):
        self.functions = []
        self.classes = {}
        self.imports = []
        self.public_api = {}

    def visit_FunctionDef(self, node: ast.FunctionDef):
        if not node.name.startswith("_"):
            self.functions.append(node.name)
            self.public_api[node.name] = {
                "type": "function",
                "args": [arg.arg for arg in node.args.args],
            }
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        if not node.name.startswith("_"):
            methods = []
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and not item.name.startswith("_"):
                    methods.append(item.name)
            self.classes[node.name] = methods
            self.public_api[node.name] = {"type": "class", "methods": methods}
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append(alias.name)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            self.imports.append(node.module)


def verify_python_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    """Verify Python module and extract API"""
    try:
        with open(module_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=str(module_path))
        visitor = PythonASTVisitor()
        visitor.visit(tree)
        return visitor.public_api
    except Exception as e:
        if not quiet:
            print(f"Warning: Could not analyze {module_path}: {e}", file=sys.stderr)
        return {}


def verify_js_ts_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    """Verify JavaScript/TypeScript module"""
    # Basic verification - could be enhanced with proper parser
    return {"verified": True}


def run_verification(config: BundleConfig, cwd: Path):
    """Run module verification if requested"""
    if not config.verify:
        return
    
    print(f"Running verification for module: {config.verify}")
    module_path = cwd / config.verify
    
    if not module_path.exists():
        print(f"Error: Module {config.verify} not found", file=sys.stderr)
        sys.exit(1)
    
    if module_path.suffix == ".py":
        api = verify_python_module(module_path, config.quiet)
        if api:
            print(f"Module API: {json.dumps(api, indent=2)}")
    elif module_path.suffix in [".js", ".ts"]:
        verify_js_ts_module(module_path, config.quiet)
    else:
        print(f"Warning: No verification support for {module_path.suffix} files", file=sys.stderr)


@dataclass
class FileTreeNode:
    """Represents a file or directory in the project tree"""
    path: str
    is_dir: bool
    size: int = 0
    children: List['FileTreeNode'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []
    
    def to_string(self, indent=0) -> str:
        """Convert to string representation for LLM context"""
        prefix = "  " * indent
        if self.is_dir:
            result = f"{prefix}{Path(self.path).name}/\n"
            for child in self.children:
                result += child.to_string(indent + 1)
            return result
        else:
            size_str = f" ({self.size} bytes)" if self.size > 0 else ""
            return f"{prefix}{Path(self.path).name}{size_str}\n"


class ProjectAnalyzer:
    """Analyzes project structure for AI curation"""
    
    def __init__(self, root_path: Path):
        self.root_path = root_path
        self.file_tree = None
        self.gitignore_patterns = self._load_gitignore()
    
    def _load_gitignore(self) -> Set[str]:
        """Load gitignore patterns"""
        patterns = set()
        gitignore_path = self.root_path / ".gitignore"
        
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        patterns.add(line)
        
        # Always ignore common patterns
        patterns.update([
            '__pycache__', '*.pyc', 'node_modules', '.git',
            '.venv', 'venv', 'env', '.env', '*.log', '.DS_Store'
        ])
        
        return patterns
    
    def _should_ignore(self, path: Path) -> bool:
        """Check if path should be ignored"""
        path_str = str(path.relative_to(self.root_path))
        
        for pattern in self.gitignore_patterns:
            if pattern in path_str:
                return True
            if path.name == pattern:
                return True
        
        return False
    
    def build_file_tree(self) -> FileTreeNode:
        """Build a tree representation of the project"""
        if GIT_AVAILABLE:
            return self._build_tree_with_git()
        else:
            return self._build_tree_with_walk()
    
    def _build_tree_with_git(self) -> FileTreeNode:
        """Build tree using git ls-files for tracked files"""
        try:
            repo = git.Repo(self.root_path)
            tracked_files = repo.git.ls_files().splitlines()
            
            root = FileTreeNode(path=str(self.root_path), is_dir=True)
            nodes = {str(self.root_path): root}
            
            for file_path in tracked_files:
                full_path = self.root_path / file_path
                if full_path.exists():
                    self._add_file_to_tree(full_path, root, nodes)
            
            return root
        except:
            return self._build_tree_with_walk()
    
    def _build_tree_with_walk(self) -> FileTreeNode:
        """Build tree by walking the filesystem"""
        root = FileTreeNode(path=str(self.root_path), is_dir=True)
        nodes = {str(self.root_path): root}
        
        for dirpath, dirnames, filenames in os.walk(self.root_path):
            # Filter ignored directories
            dirnames[:] = [d for d in dirnames if not self._should_ignore(Path(dirpath) / d)]
            
            dir_path = Path(dirpath)
            if self._should_ignore(dir_path):
                continue
            
            # Add files
            for filename in filenames:
                file_path = dir_path / filename
                if not self._should_ignore(file_path):
                    self._add_file_to_tree(file_path, root, nodes)
        
        return root
    
    def _add_file_to_tree(self, file_path: Path, root: FileTreeNode, nodes: Dict[str, FileTreeNode]):
        """Add a file to the tree structure"""
        parts = file_path.relative_to(self.root_path).parts
        current = root
        
        for i, part in enumerate(parts[:-1]):
            dir_path = self.root_path / Path(*parts[:i+1])
            dir_key = str(dir_path)
            
            if dir_key not in nodes:
                new_dir = FileTreeNode(path=dir_key, is_dir=True)
                nodes[dir_key] = new_dir
                current.children.append(new_dir)
                current = new_dir
            else:
                current = nodes[dir_key]
        
        # Add the file
        try:
            size = file_path.stat().st_size
        except:
            size = 0
        
        file_node = FileTreeNode(
            path=str(file_path),
            is_dir=False,
            size=size
        )
        current.children.append(file_node)


class AICurator:
    """Handles AI-powered context curation"""
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "gemini"):
        self.provider = provider
        self.api_key = api_key or os.environ.get(f"{provider.upper()}_API_KEY")
        self.client = None
        
        if not self.api_key:
            raise ValueError(f"No API key provided for {provider}")
        
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the AI client based on provider"""
        if self.provider == "gemini" and GEMINI_AVAILABLE:
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel('gemini-pro')
        elif self.provider == "claude" and CLAUDE_AVAILABLE:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        elif self.provider == "openai" and OPENAI_AVAILABLE:
            openai.api_key = self.api_key
            self.client = openai
        else:
            raise ValueError(f"Provider {self.provider} not available or not supported")
    
    def curate_files(self, task_description: str, file_tree: str, max_files: int = 20) -> List[str]:
        """Use AI to select relevant files for the task"""
        prompt = self._build_curation_prompt(task_description, file_tree, max_files)
        
        if self.provider == "gemini":
            return self._curate_with_gemini(prompt)
        elif self.provider == "claude":
            return self._curate_with_claude(prompt)
        elif self.provider == "openai":
            return self._curate_with_openai(prompt)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")
    
    def _build_curation_prompt(self, task: str, tree: str, max_files: int) -> str:
        """Build the prompt for file curation"""
        return f"""You are an expert Staff Software Engineer specializing in codebase analysis.
Your task is to identify the most relevant set of files for a developer to complete a task.

**Task Description:**
{task}

**Project File Tree:**
```
{tree}
```

**Instructions:**
1. Analyze the task and the file tree carefully
2. Identify a concise set of files (maximum {max_files}) that are absolutely essential
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
{{"files": ["src/auth/login.py", "src/models/user.py", "config/auth.yaml"]}}
"""
    
    def _curate_with_gemini(self, prompt: str) -> List[str]:
        """Use Gemini to curate files"""
        try:
            response = self.client.generate_content(prompt)
            return self._parse_ai_response(response.text)
        except Exception as e:
            print(f"Gemini curation failed: {e}")
            return []
    
    def _curate_with_claude(self, prompt: str) -> List[str]:
        """Use Claude to curate files"""
        try:
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            return self._parse_ai_response(response.content[0].text)
        except Exception as e:
            print(f"Claude curation failed: {e}")
            return []
    
    def _curate_with_openai(self, prompt: str) -> List[str]:
        """Use OpenAI to curate files"""
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            return self._parse_ai_response(response.choices[0].message.content)
        except Exception as e:
            print(f"OpenAI curation failed: {e}")
            return []
    
    def _parse_ai_response(self, response: str) -> List[str]:
        """Parse the AI response to extract file paths"""
        try:
            # Try to extract JSON from the response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data.get("files", [])
        except:
            pass
        
        # Fallback: extract file paths directly
        paths = []
        for line in response.split('\n'):
            line = line.strip()
            if line and (line.endswith('.py') or line.endswith('.js') or 
                        line.endswith('.ts') or line.endswith('.java') or
                        line.endswith('.go') or line.endswith('.rs')):
                # Clean up the path
                line = line.strip('"\'`,-')
                if line and not line.startswith('#'):
                    paths.append(line)
        
        return paths


def load_pawsignore(cwd: Path) -> List[str]:
    """Load .pawsignore patterns"""
    pawsignore_path = cwd / PAWSIGNORE_FILENAME
    if pawsignore_path.exists():
        with open(pawsignore_path, "r") as f:
            return [line.strip() for line in f if line.strip() and not line.startswith("#")]
    return []


def get_paths_to_process(config: BundleConfig, cwd: Path) -> Dict[str, Any]:
    """Get all paths to process based on config"""
    included_paths = set()
    excluded_patterns = list(config.exclude_patterns)
    
    # Add default excludes
    if config.use_default_excludes:
        excluded_patterns.extend(DEFAULT_EXCLUDES)
        excluded_patterns.extend(load_pawsignore(cwd))
    
    # Process path specs
    for spec in config.path_specs:
        spec_path = Path(spec)
        if spec_path.is_absolute():
            if spec_path.exists():
                if spec_path.is_file():
                    included_paths.add(spec_path)
                else:
                    for file_path in spec_path.rglob("*"):
                        if file_path.is_file():
                            included_paths.add(file_path)
        else:
            # Use glob for relative paths
            matches = glob_module.glob(spec, recursive=True)
            for match in matches:
                match_path = Path(match)
                if match_path.is_file():
                    included_paths.add(match_path.resolve())
    
    # Apply exclusions
    final_paths = []
    for path in included_paths:
        should_exclude = False
        for pattern in excluded_patterns:
            if glob_module.fnmatch.fnmatch(str(path), pattern):
                should_exclude = True
                break
        if not should_exclude:
            final_paths.append(path)
    
    return {
        "paths": final_paths,
        "common_ancestor": find_common_ancestor(final_paths, cwd)
    }


def find_common_ancestor(paths: List[Path], cwd: Path) -> Path:
    """Find common ancestor directory"""
    if not paths:
        return cwd
    common = Path(os.path.commonpath([str(p) for p in paths]))
    return common if common.is_dir() else common.parent


def detect_is_binary(content_bytes: bytes) -> bool:
    """Detect if content is binary"""
    return b"\x00" in content_bytes[:1024]


def prepare_file_object(file_path: Path, common_ancestor: Path, encoding_mode: str) -> Dict[str, Any]:
    """Prepare a file object for bundling"""
    try:
        with open(file_path, "rb") as f:
            content_bytes = f.read()
        
        is_binary = detect_is_binary(content_bytes)
        rel_path = file_path.relative_to(common_ancestor)
        
        if is_binary:
            content = base64.b64encode(content_bytes).decode("ascii")
        else:
            content = content_bytes.decode(DEFAULT_ENCODING, errors="ignore")
        
        return {
            "path": str(rel_path),
            "content": content,
            "is_binary": is_binary,
            "exists": True
        }
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return None


def find_catscan_replacement(file_path: Path) -> Optional[Path]:
    """Find CATSCAN.md replacement for README.md (strict mode)"""
    if file_path.name.lower() == "readme.md":
        catscan_path = file_path.parent / "CATSCAN.md"
        if catscan_path.exists():
            return catscan_path
    return None


def create_bundle_string_from_objects(file_objects: List[Dict], config: BundleConfig) -> str:
    """Create the bundle string from file objects"""
    lines = []
    
    # Add headers
    lines.append(BUNDLE_HEADER_PREFIX)
    if config.prepare_for_delta:
        lines.append(f"{BUNDLE_FORMAT_PREFIX}DELTA")
    else:
        lines.append(f"{BUNDLE_FORMAT_PREFIX}FULL")
    lines.append("")
    
    # Add files
    for obj in file_objects:
        if obj is None:
            continue
        
        path = obj["path"]
        content = obj["content"]
        is_binary = obj["is_binary"]
        
        hint = f" {BASE64_HINT_TEXT}" if is_binary else ""
        lines.append(START_MARKER_TEMPLATE.format(path=path, hint=hint))
        
        if not is_binary:
            lines.append("```")
        lines.append(content)
        if not is_binary:
            lines.append("```")
        
        lines.append(END_MARKER_TEMPLATE.format(path=path, hint=hint))
        lines.append("")
    
    return "\n".join(lines)


def find_and_read_prepended_files(config: BundleConfig, cwd: Path) -> tuple:
    """Find and read persona and system prompt files"""
    persona_contents = []
    for persona_path in config.persona_files:
        if persona_path.exists():
            with open(persona_path, "r", encoding=DEFAULT_ENCODING) as f:
                persona_contents.append(f.read())
    
    sys_prompt_content = None
    if not config.no_sys_prompt:
        sys_prompt_path = cwd / config.sys_prompt_file
        if sys_prompt_path.exists():
            with open(sys_prompt_path, "r", encoding=DEFAULT_ENCODING) as f:
                sys_prompt_content = f.read()
        elif config.require_sys_prompt:
            raise FileNotFoundError(f"Required system prompt file not found: {config.sys_prompt_file}")
    
    return persona_contents, sys_prompt_content


class CatsBundler:
    """CATS bundler with AI curation support"""
    
    def __init__(self, config: BundleConfig):
        self.config = config
        self.root_path = Path(config.path_specs[0] if config.path_specs else ".")
    
    def create_bundle(self, files: Optional[List[str]] = None) -> str:
        """Create a CATS bundle with optional AI curation"""
        
        # Get files to bundle
        if self.config.ai_curate:
            files = self._get_ai_curated_files()
            if not files:
                print("AI curation failed or returned no files.")
                return ""
        
        if not files:
            # Use path specs from config
            paths_info = get_paths_to_process(self.config, Path.cwd())
            files = paths_info["paths"]
            common_ancestor = paths_info["common_ancestor"]
        else:
            # Convert string paths to Path objects
            files = [Path(f) for f in files]
            common_ancestor = find_common_ancestor(files, Path.cwd())
        
        if not files:
            print("No files specified for bundling.")
            return ""
        
        # Prepare file objects
        file_objects = []
        for file_path in files:
            # Handle CATSCAN mode
            if self.config.strict_catscan:
                replacement = find_catscan_replacement(file_path)
                if replacement:
                    file_path = replacement
            
            obj = prepare_file_object(file_path, common_ancestor, self.config.encoding_mode)
            if obj:
                file_objects.append(obj)
                if not self.config.quiet:
                    print(f"✓ Added: {obj['path']}")
        
        # Create bundle
        bundle_content = create_bundle_string_from_objects(file_objects, self.config)
        
        # Add persona and system prompt if configured
        persona_contents, sys_prompt_content = find_and_read_prepended_files(
            self.config, Path.cwd()
        )
        
        final_content = []
        
        # Add personas
        for persona in persona_contents:
            final_content.append(PERSONA_HEADER)
            final_content.append(persona)
            final_content.append(PERSONA_FOOTER)
        
        # Add system prompt
        if sys_prompt_content:
            final_content.append(sys_prompt_content)
            final_content.append(SYS_PROMPT_POST_SEPARATOR)
        
        # Add bundle
        final_content.append(bundle_content)
        
        return "\n".join(final_content)
    
    def _get_ai_curated_files(self) -> List[str]:
        """Get AI-curated list of files for the task"""
        print(f"[AI] Analyzing codebase for task: {self.config.ai_curate[:50]}...")
        
        # Build file tree
        analyzer = ProjectAnalyzer(self.root_path)
        file_tree = analyzer.build_file_tree()
        tree_str = file_tree.to_string()
        
        # Curate files with AI
        try:
            curator = AICurator(api_key=self.config.ai_key, provider=self.config.ai_provider)
            files = curator.curate_files(
                self.config.ai_curate, 
                tree_str,
                self.config.max_files
            )
            
            print(f"[AI] Selected {len(files)} files:")
            for f in files:
                print(f"  - {f}")
            
            return files
        except Exception as e:
            print(f"[AI] Curation failed: {e}")
            return []


def main():
    parser = argparse.ArgumentParser(
        description="CATS - Bundle project files for AI/LLM consumption with optional AI-powered curation"
    )
    
    # File specification
    parser.add_argument(
        "path_specs",
        nargs="*",
        help="Files or directories to include"
    )
    
    # AI curation (NEW)
    parser.add_argument(
        "--ai-curate",
        metavar="TASK",
        help="Use AI to select files based on task description"
    )
    parser.add_argument(
        "--ai-provider",
        choices=["gemini", "claude", "openai"],
        default="gemini",
        help="AI provider to use for curation"
    )
    parser.add_argument(
        "--ai-key",
        help="API key for AI provider (or set via environment variable)"
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=20,
        help="Maximum number of files to include with AI curation"
    )
    parser.add_argument(
        "--include-tests",
        action="store_true",
        help="Include test files in AI curation"
    )
    
    # Output options
    parser.add_argument(
        "-o", "--output",
        default=DEFAULT_OUTPUT_FILENAME,
        help=f"Output file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout."
    )
    
    # BACKWARD COMPATIBILITY - Exclusion patterns
    parser.add_argument(
        "-x", "--exclude",
        action="append",
        default=[],
        help="Exclude pattern (can be used multiple times)"
    )
    
    # BACKWARD COMPATIBILITY - Persona files
    parser.add_argument(
        "-p", "--persona",
        action="append",
        default=[],
        help="Persona file to prepend (can be used multiple times)"
    )
    
    # BACKWARD COMPATIBILITY - System prompt
    parser.add_argument(
        "-s", "--sys-prompt-file",
        default=DEFAULT_SYS_PROMPT_FILENAME,
        help=f"System prompt file (default: {DEFAULT_SYS_PROMPT_FILENAME})"
    )
    parser.add_argument(
        "--no-sys-prompt",
        action="store_true",
        help="Disable system prompt prepending"
    )
    parser.add_argument(
        "--require-sys-prompt",
        action="store_true",
        help="Fail if system prompt file not found"
    )
    
    # BACKWARD COMPATIBILITY - Bundle format
    parser.add_argument(
        "--prepare-for-delta",
        action="store_true",
        help="Prepare bundle for delta application"
    )
    
    # BACKWARD COMPATIBILITY - CATSCAN mode
    parser.add_argument(
        "--strict-catscan",
        action="store_true",
        help="Replace README.md with CATSCAN.md when available"
    )
    
    # BACKWARD COMPATIBILITY - Default excludes
    parser.add_argument(
        "--no-default-excludes",
        action="store_false",
        dest="use_default_excludes",
        help=f"Disable default excludes and {PAWSIGNORE_FILENAME}"
    )
    
    # BACKWARD COMPATIBILITY - Module verification
    parser.add_argument(
        "--verify",
        metavar="MODULE",
        help="Verify module and extract API"
    )
    
    # Standard options
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress informational output"
    )
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Auto-confirm all prompts"
    )
    
    args = parser.parse_args()
    
    # Build config
    config = BundleConfig(
        path_specs=args.path_specs or ["."],
        exclude_patterns=args.exclude,
        output_file=Path(args.output) if args.output != "-" else None,
        encoding_mode="auto",
        use_default_excludes=args.use_default_excludes,
        prepare_for_delta=args.prepare_for_delta,
        persona_files=[Path(p) for p in args.persona],
        sys_prompt_file=args.sys_prompt_file,
        no_sys_prompt=args.no_sys_prompt,
        require_sys_prompt=args.require_sys_prompt,
        strict_catscan=args.strict_catscan,
        verify=args.verify,
        quiet=args.quiet,
        yes=args.yes,
        ai_curate=args.ai_curate,
        ai_provider=args.ai_provider,
        ai_key=args.ai_key,
        max_files=args.max_files,
        include_tests=args.include_tests
    )
    
    # Run verification if requested
    if config.verify:
        run_verification(config, Path.cwd())
        return 0
    
    # Create bundler
    bundler = CatsBundler(config)
    
    # Create bundle
    bundle_content = bundler.create_bundle()
    
    if bundle_content:
        # Write to output
        if config.output_file:
            with open(config.output_file, 'w', encoding=DEFAULT_ENCODING) as f:
                f.write(bundle_content)
            if not config.quiet:
                print(f"\n✓ Bundle written to: {config.output_file}")
        else:
            print(bundle_content)
        return 0
    else:
        print("✗ Failed to create bundle")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```
🐈 --- CATS_END_FILE: py/cats.py ---

🐈 --- CATS_START_FILE: py/paws_session.py ---
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAWS Session Management - Stateful sessions via Git Worktrees
Part of the PAWS CLI Evolution - Phase 3 Implementation
"""

import sys
import os
import argparse
import json
import uuid
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import git
    from git import Repo
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False
    print("Warning: GitPython not installed. Session management requires git.")

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.tree import Tree
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


class SessionStatus(Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    MERGED = "merged"
    ABANDONED = "abandoned"


@dataclass
class SessionTurn:
    """Represents a single turn in a session"""
    turn_number: int
    timestamp: str
    command: str
    commit_hash: Optional[str] = None
    cats_file: Optional[str] = None
    dogs_file: Optional[str] = None
    verification_result: Optional[bool] = None
    notes: Optional[str] = None


@dataclass
class Session:
    """Represents a PAWS work session"""
    session_id: str
    name: str
    created_at: str
    status: SessionStatus
    base_branch: str
    base_commit: str
    workspace_path: str
    turns: List[SessionTurn]
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict:
        """Convert session to dictionary for JSON serialization"""
        return {
            "session_id": self.session_id,
            "name": self.name,
            "created_at": self.created_at,
            "status": self.status.value,
            "base_branch": self.base_branch,
            "base_commit": self.base_commit,
            "workspace_path": self.workspace_path,
            "turns": [asdict(turn) for turn in self.turns],
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Session':
        """Create session from dictionary"""
        return cls(
            session_id=data["session_id"],
            name=data["name"],
            created_at=data["created_at"],
            status=SessionStatus(data["status"]),
            base_branch=data["base_branch"],
            base_commit=data["base_commit"],
            workspace_path=data["workspace_path"],
            turns=[SessionTurn(**turn) for turn in data.get("turns", [])],
            metadata=data.get("metadata", {})
        )


class SessionManager:
    """Manages PAWS work sessions using git worktrees"""
    
    def __init__(self, root_path: Path = Path(".")):
        self.root_path = root_path.resolve()
        self.paws_dir = self.root_path / ".paws"
        self.sessions_dir = self.paws_dir / "sessions"
        self.repo = None
        
        if not GIT_AVAILABLE:
            raise RuntimeError("Git support is required for session management")
        
        try:
            self.repo = Repo(self.root_path)
        except:
            raise RuntimeError("Not in a git repository")
        
        # Initialize PAWS directory structure
        self._initialize_directories()
    
    def _initialize_directories(self):
        """Create necessary directories"""
        self.paws_dir.mkdir(exist_ok=True)
        self.sessions_dir.mkdir(exist_ok=True)
        
        # Add .paws to gitignore if not already there
        gitignore_path = self.root_path / ".gitignore"
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                content = f.read()
            if ".paws/" not in content:
                with open(gitignore_path, 'a') as f:
                    f.write("\n# PAWS session data\n.paws/\n")
    
    def _get_session_path(self, session_id: str) -> Path:
        """Get the path for a session"""
        return self.sessions_dir / session_id
    
    def _load_session(self, session_id: str) -> Optional[Session]:
        """Load a session from disk"""
        session_path = self._get_session_path(session_id)
        manifest_path = session_path / "session.json"
        
        if not manifest_path.exists():
            return None
        
        with open(manifest_path, 'r') as f:
            data = json.load(f)
        
        return Session.from_dict(data)
    
    def _save_session(self, session: Session):
        """Save a session to disk"""
        session_path = self._get_session_path(session.session_id)
        session_path.mkdir(exist_ok=True)
        
        manifest_path = session_path / "session.json"
        with open(manifest_path, 'w') as f:
            json.dump(session.to_dict(), f, indent=2)
    
    def create_session(self, name: str, base_branch: Optional[str] = None) -> Session:
        """Create a new work session"""
        session_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().isoformat()
        
        # Get current branch and commit
        if base_branch is None:
            base_branch = self.repo.active_branch.name
        base_commit = self.repo.head.commit.hexsha
        
        # Create worktree for the session
        workspace_path = self._get_session_path(session_id) / "workspace"
        branch_name = f"paws-session-{session_id}"
        
        try:
            # Create a new branch and worktree
            self.repo.git.worktree('add', '-b', branch_name, str(workspace_path), base_commit)
        except Exception as e:
            raise RuntimeError(f"Failed to create worktree: {e}")
        
        # Create session object
        session = Session(
            session_id=session_id,
            name=name,
            created_at=timestamp,
            status=SessionStatus.ACTIVE,
            base_branch=base_branch,
            base_commit=base_commit,
            workspace_path=str(workspace_path),
            turns=[],
            metadata={}
        )
        
        # Save session
        self._save_session(session)
        
        print(f"✓ Created session: {session_id} - {name}")
        print(f"  Workspace: {workspace_path}")
        print(f"  Base: {base_branch} ({base_commit[:8]})")
        
        return session
    
    def list_sessions(self, status: Optional[SessionStatus] = None) -> List[Session]:
        """List all sessions, optionally filtered by status"""
        sessions = []
        
        for session_dir in self.sessions_dir.iterdir():
            if session_dir.is_dir():
                session = self._load_session(session_dir.name)
                if session:
                    if status is None or session.status == status:
                        sessions.append(session)
        
        return sorted(sessions, key=lambda s: s.created_at, reverse=True)
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """Get a specific session"""
        return self._load_session(session_id)
    
    def add_turn(self, session_id: str, command: str, **kwargs) -> SessionTurn:
        """Add a turn to a session"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        turn_number = len(session.turns) + 1
        timestamp = datetime.now().isoformat()
        
        turn = SessionTurn(
            turn_number=turn_number,
            timestamp=timestamp,
            command=command,
            **kwargs
        )
        
        session.turns.append(turn)
        
        # Create a checkpoint commit if in workspace
        workspace_repo = Repo(session.workspace_path)
        if workspace_repo.is_dirty(untracked_files=True):
            try:
                workspace_repo.git.add('-A')
                commit_msg = f"Turn {turn_number}: {command[:50]}"
                workspace_repo.index.commit(commit_msg)
                turn.commit_hash = workspace_repo.head.commit.hexsha
            except Exception as e:
                print(f"Warning: Could not create checkpoint: {e}")
        
        self._save_session(session)
        return turn
    
    def rewind_session(self, session_id: str, to_turn: int) -> bool:
        """Rewind a session to a previous turn"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if to_turn < 1 or to_turn > len(session.turns):
            raise ValueError(f"Invalid turn number: {to_turn}")
        
        target_turn = session.turns[to_turn - 1]
        if not target_turn.commit_hash:
            print(f"Turn {to_turn} has no checkpoint commit")
            return False
        
        try:
            workspace_repo = Repo(session.workspace_path)
            workspace_repo.git.reset('--hard', target_turn.commit_hash)
            
            # Remove turns after the target
            session.turns = session.turns[:to_turn]
            self._save_session(session)
            
            print(f"✓ Rewound session to turn {to_turn}")
            return True
        except Exception as e:
            print(f"Failed to rewind: {e}")
            return False
    
    def merge_session(self, session_id: str, target_branch: Optional[str] = None) -> bool:
        """Merge a session's changes back to the main branch"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if target_branch is None:
            target_branch = session.base_branch
        
        try:
            # Switch to target branch in main repo
            self.repo.git.checkout(target_branch)
            
            # Merge the session branch
            session_branch = f"paws-session-{session_id}"
            self.repo.git.merge(session_branch, '--no-ff', 
                              '-m', f"Merge PAWS session: {session.name}")
            
            # Update session status
            session.status = SessionStatus.MERGED
            self._save_session(session)
            
            # Clean up worktree
            self.repo.git.worktree('remove', session.workspace_path)
            
            print(f"✓ Merged session {session_id} into {target_branch}")
            return True
            
        except Exception as e:
            print(f"Failed to merge: {e}")
            return False
    
    def archive_session(self, session_id: str) -> bool:
        """Archive a session without merging"""
        session = self._load_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        try:
            # Remove worktree but keep the branch
            if Path(session.workspace_path).exists():
                self.repo.git.worktree('remove', session.workspace_path)
            
            session.status = SessionStatus.ARCHIVED
            self._save_session(session)
            
            print(f"✓ Archived session {session_id}")
            return True
            
        except Exception as e:
            print(f"Failed to archive: {e}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """Completely delete a session"""
        session = self._load_session(session_id)
        if not session:
            return False
        
        try:
            # Remove worktree if it exists
            if Path(session.workspace_path).exists():
                self.repo.git.worktree('remove', session.workspace_path, '--force')
            
            # Delete the branch
            branch_name = f"paws-session-{session_id}"
            try:
                self.repo.git.branch('-D', branch_name)
            except:
                pass  # Branch might not exist
            
            # Remove session directory
            session_path = self._get_session_path(session_id)
            shutil.rmtree(session_path)
            
            print(f"✓ Deleted session {session_id}")
            return True
            
        except Exception as e:
            print(f"Failed to delete: {e}")
            return False


class SessionCLI:
    """Command-line interface for session management"""
    
    def __init__(self):
        self.manager = SessionManager()
        self.console = Console() if RICH_AVAILABLE else None
    
    def start_session(self, name: str, base_branch: Optional[str] = None):
        """Start a new session"""
        session = self.manager.create_session(name, base_branch)
        
        if RICH_AVAILABLE and self.console:
            panel = Panel(
                f"[green]Session created successfully![/]\n\n"
                f"ID: {session.session_id}\n"
                f"Name: {session.name}\n"
                f"Workspace: {session.workspace_path}\n\n"
                f"To work in this session, use:\n"
                f"  cd {session.workspace_path}\n"
                f"Or use --session {session.session_id} with PAWS commands",
                title="New Session"
            )
            self.console.print(panel)
    
    def list_sessions(self, show_archived: bool = False):
        """List all sessions"""
        sessions = self.manager.list_sessions()
        
        if not sessions:
            print("No sessions found.")
            return
        
        if RICH_AVAILABLE and self.console:
            table = Table(title="PAWS Sessions")
            table.add_column("ID", style="cyan")
            table.add_column("Name", style="green")
            table.add_column("Status")
            table.add_column("Created")
            table.add_column("Turns")
            table.add_column("Base Branch")
            
            for session in sessions:
                if not show_archived and session.status == SessionStatus.ARCHIVED:
                    continue
                
                status_style = {
                    SessionStatus.ACTIVE: "green",
                    SessionStatus.ARCHIVED: "yellow",
                    SessionStatus.MERGED: "blue",
                    SessionStatus.ABANDONED: "red"
                }.get(session.status, "white")
                
                table.add_row(
                    session.session_id,
                    session.name,
                    f"[{status_style}]{session.status.value}[/]",
                    session.created_at[:10],
                    str(len(session.turns)),
                    session.base_branch
                )
            
            self.console.print(table)
        else:
            # Fallback to simple text output
            print("\nPAWS Sessions:")
            print("-" * 60)
            for session in sessions:
                if not show_archived and session.status == SessionStatus.ARCHIVED:
                    continue
                print(f"{session.session_id}: {session.name} [{session.status.value}]")
                print(f"  Created: {session.created_at[:10]}, Turns: {len(session.turns)}")
    
    def show_session(self, session_id: str):
        """Show details of a specific session"""
        session = self.manager.get_session(session_id)
        if not session:
            print(f"Session {session_id} not found.")
            return
        
        if RICH_AVAILABLE and self.console:
            # Create a tree view of the session
            tree = Tree(f"[bold]Session: {session.name}[/] ({session.session_id})")
            
            info_branch = tree.add("📋 Information")
            info_branch.add(f"Status: {session.status.value}")
            info_branch.add(f"Created: {session.created_at}")
            info_branch.add(f"Base: {session.base_branch} @ {session.base_commit[:8]}")
            info_branch.add(f"Workspace: {session.workspace_path}")
            
            if session.turns:
                turns_branch = tree.add(f"🔄 Turns ({len(session.turns)})")
                for turn in session.turns[-5:]:  # Show last 5 turns
                    turn_text = f"Turn {turn.turn_number}: {turn.command[:50]}"
                    if turn.verification_result is not None:
                        status = "✓" if turn.verification_result else "✗"
                        turn_text += f" [{status}]"
                    turns_branch.add(turn_text)
                
                if len(session.turns) > 5:
                    turns_branch.add(f"... and {len(session.turns) - 5} more")
            
            self.console.print(tree)
        else:
            # Fallback to simple text output
            print(f"\nSession: {session.name} ({session.session_id})")
            print(f"Status: {session.status.value}")
            print(f"Created: {session.created_at}")
            print(f"Base: {session.base_branch} @ {session.base_commit[:8]}")
            print(f"Turns: {len(session.turns)}")
    
    def rewind_session(self, session_id: str, to_turn: int):
        """Rewind a session to a specific turn"""
        if self.manager.rewind_session(session_id, to_turn):
            print(f"Session {session_id} rewound to turn {to_turn}")
    
    def merge_session(self, session_id: str, target_branch: Optional[str] = None):
        """Merge a session"""
        if RICH_AVAILABLE and self.console:
            if not Confirm.ask(f"Merge session {session_id} into {target_branch or 'base branch'}?"):
                return
        else:
            response = input(f"Merge session {session_id}? [y/N]: ")
            if response.lower() != 'y':
                return
        
        if self.manager.merge_session(session_id, target_branch):
            print(f"Session {session_id} merged successfully")
    
    def archive_session(self, session_id: str):
        """Archive a session"""
        if self.manager.archive_session(session_id):
            print(f"Session {session_id} archived")
    
    def delete_session(self, session_id: str):
        """Delete a session"""
        if RICH_AVAILABLE and self.console:
            if not Confirm.ask(f"[red]Permanently delete session {session_id}?[/]"):
                return
        else:
            response = input(f"Permanently delete session {session_id}? [y/N]: ")
            if response.lower() != 'y':
                return
        
        if self.manager.delete_session(session_id):
            print(f"Session {session_id} deleted")


def main():
    parser = argparse.ArgumentParser(
        description="PAWS Session Management - Stateful sessions via Git Worktrees"
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Start command
    start_parser = subparsers.add_parser('start', help='Start a new session')
    start_parser.add_argument('name', help='Name for the session')
    start_parser.add_argument('--base', help='Base branch (default: current branch)')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List all sessions')
    list_parser.add_argument('--all', action='store_true', help='Include archived sessions')
    
    # Show command
    show_parser = subparsers.add_parser('show', help='Show session details')
    show_parser.add_argument('session_id', help='Session ID')
    
    # Rewind command
    rewind_parser = subparsers.add_parser('rewind', help='Rewind session to a turn')
    rewind_parser.add_argument('session_id', help='Session ID')
    rewind_parser.add_argument('--to-turn', type=int, required=True, help='Turn number')
    
    # Merge command
    merge_parser = subparsers.add_parser('merge', help='Merge session changes')
    merge_parser.add_argument('session_id', help='Session ID')
    merge_parser.add_argument('--into', help='Target branch (default: base branch)')
    
    # Archive command
    archive_parser = subparsers.add_parser('archive', help='Archive a session')
    archive_parser.add_argument('session_id', help='Session ID')
    
    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete a session')
    delete_parser.add_argument('session_id', help='Session ID')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    try:
        cli = SessionCLI()
        
        if args.command == 'start':
            cli.start_session(args.name, args.base)
        elif args.command == 'list':
            cli.list_sessions(args.all)
        elif args.command == 'show':
            cli.show_session(args.session_id)
        elif args.command == 'rewind':
            cli.rewind_session(args.session_id, args.to_turn)
        elif args.command == 'merge':
            cli.merge_session(args.session_id, args.into)
        elif args.command == 'archive':
            cli.archive_session(args.session_id)
        elif args.command == 'delete':
            cli.delete_session(args.session_id)
        
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```
🐈 --- CATS_END_FILE: py/paws_session.py ---

🐈 --- CATS_START_FILE: js/test.js ---
```

```
🐈 --- CATS_END_FILE: js/test.js ---
