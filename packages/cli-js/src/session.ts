#!/usr/bin/env node
/**
 * PAWS Session Management - Stateful sessions via Git Worktrees
 * Part of the PAWS CLI Evolution - Phase 3 Implementation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { Command } from 'commander';

// Using require for libraries without types
const inquirer = require('inquirer');
const Table = require('cli-table3');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

// Git support
let simpleGit: any;
try {
  simpleGit = require('simple-git');
} catch (e: any) {
  console.error('simple-git is required for session management');
  process.exit(1);
}

/**
 * Session status enum
 */
const SessionStatus = {
  ACTIVE: 'active' as const,
  ARCHIVED: 'archived' as const,
  MERGED: 'merged' as const,
  ABANDONED: 'abandoned' as const
};

type SessionStatusType = typeof SessionStatus[keyof typeof SessionStatus];

/**
 * Represents a single turn in a session
 */
class SessionTurn {
  public turnNumber: number;
  public timestamp: string;
  public command: string;
  public commitHash: string | null;
  public catsFile: string | null;
  public dogsFile: string | null;
  public verificationResult: string | null;
  public notes: string | null;

  constructor(turnNumber: number, timestamp: string, command: string, commitHash: string | null = null, catsFile: string | null = null, dogsFile: string | null = null, verificationResult: string | null = null, notes: string | null = null) {
    this.turnNumber = turnNumber;
    this.timestamp = timestamp;
    this.command = command;
    this.commitHash = commitHash;
    this.catsFile = catsFile;
    this.dogsFile = dogsFile;
    this.verificationResult = verificationResult;
    this.notes = notes;
  }

  toJSON(): any {
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

  static fromJSON(data: any): SessionTurn {
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
  public sessionId: string;
  public name: string;
  public createdAt: string;
  public status: SessionStatusType;
  public baseBranch: string;
  public baseCommit: string;
  public workspacePath: string;
  public turns: SessionTurn[];
  public metadata: any;

  constructor(sessionId: string, name: string, createdAt: string, status: SessionStatusType, baseBranch: string, baseCommit: string, workspacePath: string, turns: SessionTurn[] = [], metadata: any = {}) {
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

  toJSON(): any {
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

  static fromJSON(data: any): Session {
    return new Session(
      data.sessionId,
      data.name,
      data.createdAt,
      data.status,
      data.baseBranch,
      data.baseCommit,
      data.workspacePath,
      (data.turns || []).map((t: any) => SessionTurn.fromJSON(t)),
      data.metadata || {}
    );
  }
}

/**
 * Manages PAWS work sessions using git worktrees
 */
class SessionManager {
  private rootPath: string;
  private pawsDir: string;
  private sessionsDir: string;
  private git: any;

  constructor(rootPath: string = '.') {
    this.rootPath = path.resolve(rootPath);
    this.pawsDir = path.join(this.rootPath, '.paws');
    this.sessionsDir = path.join(this.pawsDir, 'sessions');
    this.git = simpleGit(this.rootPath);
  }

  /**
   * Initialize directories
   */
  async initializeDirectories(): Promise<void> {
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
  getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId);
  }

  /**
   * Load a session from disk
   */
  async loadSession(sessionId: string): Promise<Session | null> {
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
  async saveSession(session: Session): Promise<void> {
    const sessionPath = this.getSessionPath(session.sessionId);
    await fs.mkdir(sessionPath, { recursive: true });

    const manifestPath = path.join(sessionPath, 'session.json');
    await fs.writeFile(manifestPath, JSON.stringify(session.toJSON(), null, 2));
  }

  /**
   * Check if we're in a git repository
   */
  async isGitRepo(): Promise<boolean> {
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
  async createSession(name: string, baseBranch: string | null = null): Promise<Session> {
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
    } catch (error: any) {
      throw new Error(`Failed to create worktree: ${error.message}`);
    }

    // Create session object
    const session = new Session(
      sessionId,
      name,
      timestamp,
      SessionStatus.ACTIVE,
      baseBranch!,  // baseBranch is guaranteed to be string at this point
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
  async listSessions(status: SessionStatusType | null = null): Promise<Session[]> {
    await this.initializeDirectories();
    const sessions: Session[] = [];

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
  async getSession(sessionId: string): Promise<Session | null> {
    return await this.loadSession(sessionId);
  }

  /**
   * Add a turn to a session
   */
  async addTurn(sessionId: string, command: string, options: any = {}): Promise<SessionTurn> {
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
      options.commitHash || null,
      options.catsFile || null,
      options.dogsFile || null,
      options.verificationResult || null,
      options.notes || null
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
    } catch (error: any) {
      console.warn(`Could not create checkpoint: ${error.message}`);
    }

    await this.saveSession(session);
    return turn;
  }

  /**
   * Rewind a session to a previous turn
   */
  async rewindSession(sessionId: string, toTurn: number): Promise<boolean> {
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
    } catch (error: any) {
      console.error(chalk.red(`Failed to rewind: ${error.message}`));
      return false;
    }
  }

  /**
   * Merge a session's changes back to the main branch
   */
  async mergeSession(sessionId: string, targetBranch: string | null = null): Promise<boolean> {
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

    } catch (error: any) {
      console.error(chalk.red(`Failed to merge: ${error.message}`));
      return false;
    }
  }

  /**
   * Archive a session without merging
   */
  async archiveSession(sessionId: string): Promise<boolean> {
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

    } catch (error: any) {
      console.error(chalk.red(`Failed to archive: ${error.message}`));
      return false;
    }
  }

  /**
   * Delete a session completely
   */
  async deleteSession(sessionId: string): Promise<boolean> {
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

    } catch (error: any) {
      console.error(chalk.red(`Failed to delete: ${error.message}`));
      return false;
    }
  }
}

/**
 * Session CLI with interactive interface
 */
class SessionCLI {
  private manager: SessionManager;

  constructor() {
    this.manager = new SessionManager();
  }

  /**
   * Start a new session
   */
  async startSession(name: string, baseBranch: string | null = null): Promise<void> {
    try {
      const session = await this.manager.createSession(name, baseBranch);
      
      console.log(chalk.bold.green('\n📦 New Session Created!\n'));
      console.log(`To work in this session, use:`);
      console.log(chalk.cyan(`  cd ${session.workspacePath}`));
      console.log(`\nOr use with PAWS commands:`);
      console.log(chalk.cyan(`  cats-enhanced --session ${session.sessionId} ...`));
      console.log(chalk.cyan(`  dogs-enhanced --session ${session.sessionId} ...`));
      
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * List all sessions
   */
  async listSessions(showArchived: boolean = false): Promise<void> {
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

    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Show session details with blessed TUI
   */
  async showSessionInteractive(sessionId: string): Promise<void> {
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
      const status = turn.verificationResult === 'PASS' ? '✓' :
                    turn.verificationResult === 'FAIL' ? '✗' : ' ';
      return `${status} Turn ${turn.turnNumber}: ${turn.command.slice(0, 40)}`;
    });
    turnsList.setItems(turnItems);

    // Update turn details when selection changes
    turnsList.on('select', (item: any, index: number) => {
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
  async showSession(sessionId: string): Promise<void> {
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
          const status = turn.verificationResult === 'PASS' ? chalk.green('✓') :
                        turn.verificationResult === 'FAIL' ? chalk.red('✗') : ' ';
          console.log(`  ${status} Turn ${turn.turnNumber}: ${turn.command.slice(0, 50)}`);
        }
        if (session.turns.length > 5) {
          console.log(chalk.gray(`  ... and ${session.turns.length - 5} more`));
        }
      }

    } catch (error: any) {
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
            validate: (input: string) => input.length > 0
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
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('paws-session')
    .description('PAWS Session Management - Stateful sessions via Git Worktrees')
    .version('1.0.0');

  program
    .command('start <name>')
    .description('Start a new session')
    .option('--base <branch>', 'Base branch (default: current branch)')
    .action(async (name: string, options: any) => {
      const cli = new SessionCLI();
      await cli.startSession(name, options.base);
    });

  program
    .command('list')
    .description('List all sessions')
    .option('--all', 'Include archived sessions')
    .action(async (options: any) => {
      const cli = new SessionCLI();
      await cli.listSessions(options.all);
    });

  program
    .command('show <sessionId>')
    .description('Show session details')
    .option('--interactive', 'Use interactive TUI')
    .action(async (sessionId: string, options: any) => {
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
    .action(async (sessionId: string, options: any) => {
      const manager = new SessionManager();
      await manager.rewindSession(sessionId, options.toTurn);
    });

  program
    .command('merge <sessionId>')
    .description('Merge session changes')
    .option('--into <branch>', 'Target branch (default: base branch)')
    .action(async (sessionId: string, options: any) => {
      const manager = new SessionManager();
      await manager.mergeSession(sessionId, options.into);
    });

  program
    .command('archive <sessionId>')
    .description('Archive a session')
    .action(async (sessionId: string) => {
      const manager = new SessionManager();
      await manager.archiveSession(sessionId);
    });

  program
    .command('delete <sessionId>')
    .description('Delete a session')
    .action(async (sessionId: string) => {
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
  SessionCLI,
  main
};