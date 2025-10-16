#!/usr/bin/env node

/**
 * REPLOID CLI - Command-line interface for PAWS orchestration
 * Manage agent goals, sessions, checkpoints, and monitoring
 */

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load configuration
let config = { server: { host: 'localhost', port: 8000 } };
try {
  const { getConfig } = require('../utils/config-loader.js');
  const configLoader = getConfig();
  configLoader.load();
  config = configLoader.getAll();
} catch (err) {
  // Use defaults if config loader not available
}

const DEFAULT_SERVER = `http://${config.server.host}:${config.server.port}`;

// HTTP request helper
const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
};

// CLI Commands

yargs(hideBin(process.argv))
  .command('status', 'Show agent status and current state', {}, async (argv) => {
    try {
      const server = argv.server || DEFAULT_SERVER;
      const response = await makeRequest(`${server}/api/status`);

      console.log('\n🤖 REPLOID Agent Status\n');
      console.log(`State:        ${response.state || 'Unknown'}`);
      console.log(`Session:      ${response.session || 'None'}`);
      console.log(`Goal:         ${response.goal || 'None'}`);
      console.log(`Cycle:        ${response.cycle || 0}`);
      console.log(`Server:       ${server}`);
      console.log();

      if (response.pendingApproval) {
        console.log('⚠️  Pending approval:', response.pendingApproval);
      }

    } catch (err) {
      console.error('❌ Failed to get status:', err.message);
      console.error('\nTroubleshooting:');
      console.error('  • Is the server running? Start with: npm start');
      console.error('  • Check server URL with --server flag');
      console.error(`  • Default server: ${DEFAULT_SERVER}`);
      process.exit(1);
    }
  })

  .command('sessions', 'Manage agent sessions', (yargs) => {
    return yargs
      .command('list', 'List all sessions', {
        limit: { type: 'number', default: 10, desc: 'Number of sessions to show' }
      }, async (argv) => {
        try {
          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/sessions?limit=${argv.limit}`);
          const sessions = response.sessions || [];

          console.log(`\n📁 Sessions (${sessions.length})\n`);

          if (sessions.length === 0) {
            console.log('No sessions found.');
            return;
          }

          sessions.forEach(s => {
            console.log(`${s.id} ${s.active ? '✓ (active)' : ''}`);
            console.log(`  Goal:    ${s.goal || 'None'}`);
            console.log(`  State:   ${s.state || 'Unknown'}`);
            console.log(`  Created: ${s.createdAt ? new Date(s.createdAt).toLocaleString() : 'Unknown'}`);
            console.log();
          });

        } catch (err) {
          console.error('❌ Failed to list sessions:', err.message);
          process.exit(1);
        }
      })

      .command('view <id>', 'View session details', {
        id: { desc: 'Session ID' }
      }, async (argv) => {
        try {
          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/sessions/${argv.id}`);

          console.log('\n📄 Session Details\n');
          console.log(`ID:         ${response.id}`);
          console.log(`Goal:       ${response.goal}`);
          console.log(`State:      ${response.state}`);
          console.log(`Cycles:     ${response.totalCycles || 0}`);
          console.log(`Created:    ${new Date(response.createdAt).toLocaleString()}`);
          console.log(`Updated:    ${new Date(response.updatedAt).toLocaleString()}`);

          if (response.turns && response.turns.length > 0) {
            console.log(`\nTurns (${response.turns.length}):`);
            response.turns.forEach((turn, i) => {
              console.log(`  ${i + 1}. ${turn.status} - ${turn.cats_path || 'No context'}`);
            });
          }

        } catch (err) {
          console.error('❌ Failed to view session:', err.message);
          process.exit(1);
        }
      })

      .command('clean', 'Remove old sessions', {
        days: { type: 'number', default: 7, desc: 'Remove sessions older than N days' },
        force: { type: 'boolean', alias: 'f', desc: 'Skip confirmation' }
      }, async (argv) => {
        try {
          if (!argv.force) {
            console.log(`⚠️  This will remove sessions older than ${argv.days} days.`);
            console.log('Use --force to confirm.');
            process.exit(0);
          }

          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/sessions/clean`, {
            method: 'POST',
            body: { days: argv.days }
          });

          console.log(`✓ Cleaned ${response.removed || 0} sessions older than ${argv.days} days`);

        } catch (err) {
          console.error('❌ Failed to clean sessions:', err.message);
          process.exit(1);
        }
      })

      .demandCommand(1, 'Specify a subcommand: list, view, or clean');
  })

  .command('goal <text>', 'Set agent goal and start new session', {
    text: { desc: 'The goal description for the agent' },
    session: { desc: 'Resume existing session ID', type: 'string' }
  }, async (argv) => {
    try {
      const server = argv.server || DEFAULT_SERVER;
      const response = await makeRequest(`${server}/api/goal`, {
        method: 'POST',
        body: {
          goal: argv.text,
          sessionId: argv.session
        }
      });

      console.log('✓ Goal set:', argv.text);
      console.log('Session ID:', response.sessionId);
      console.log('\nMonitor progress with: reploid status');

    } catch (err) {
      console.error('❌ Failed to set goal:', err.message);
      process.exit(1);
    }
  })

  .command('approve [type]', 'Approve pending agent request', {
    type: { choices: ['context', 'proposal'], default: 'proposal', desc: 'Type of approval' }
  }, async (argv) => {
    try {
      const server = argv.server || DEFAULT_SERVER;
      await makeRequest(`${server}/api/approve`, {
        method: 'POST',
        body: { type: argv.type }
      });

      console.log(`✓ Approved ${argv.type}`);

    } catch (err) {
      console.error('❌ Failed to approve:', err.message);
      process.exit(1);
    }
  })

  .command('reject [type]', 'Reject pending agent request', {
    type: { choices: ['context', 'proposal'], default: 'proposal', desc: 'Type of rejection' },
    reason: { type: 'string', desc: 'Reason for rejection' }
  }, async (argv) => {
    try {
      const server = argv.server || DEFAULT_SERVER;
      await makeRequest(`${server}/api/reject`, {
        method: 'POST',
        body: {
          type: argv.type,
          reason: argv.reason
        }
      });

      console.log(`✓ Rejected ${argv.type}`);

    } catch (err) {
      console.error('❌ Failed to reject:', err.message);
      process.exit(1);
    }
  })

  .command('checkpoints', 'Manage state checkpoints', (yargs) => {
    return yargs
      .command('list', 'List available checkpoints', {}, async (argv) => {
        try {
          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/checkpoints`);
          const checkpoints = response.checkpoints || [];

          console.log(`\n💾 Checkpoints (${checkpoints.length})\n`);

          if (checkpoints.length === 0) {
            console.log('No checkpoints found.');
            return;
          }

          checkpoints.forEach(cp => {
            console.log(`${cp.id}`);
            console.log(`  Description: ${cp.description || 'None'}`);
            console.log(`  Created:     ${new Date(cp.timestamp).toLocaleString()}`);
            console.log(`  Files:       ${cp.fileCount || 0}`);
            console.log();
          });

        } catch (err) {
          console.error('❌ Failed to list checkpoints:', err.message);
          process.exit(1);
        }
      })

      .command('create [description]', 'Create new checkpoint', {
        description: { desc: 'Checkpoint description', default: 'Manual checkpoint' }
      }, async (argv) => {
        try {
          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/checkpoints`, {
            method: 'POST',
            body: { description: argv.description }
          });

          console.log('✓ Checkpoint created:', response.id);

        } catch (err) {
          console.error('❌ Failed to create checkpoint:', err.message);
          process.exit(1);
        }
      })

      .command('restore <id>', 'Restore to checkpoint', {
        id: { desc: 'Checkpoint ID to restore' },
        force: { type: 'boolean', alias: 'f', desc: 'Skip confirmation' }
      }, async (argv) => {
        try {
          if (!argv.force) {
            console.log(`⚠️  This will restore state to checkpoint: ${argv.id}`);
            console.log('Current state will be lost. Use --force to confirm.');
            process.exit(0);
          }

          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/checkpoints/${argv.id}/restore`, {
            method: 'POST'
          });

          console.log('✓ Restored to checkpoint:', argv.id);
          console.log('  Files restored:', response.filesRestored || 0);

        } catch (err) {
          console.error('❌ Failed to restore checkpoint:', err.message);
          process.exit(1);
        }
      })

      .demandCommand(1, 'Specify a subcommand: list, create, or restore');
  })

  .command('logs [lines]', 'Show recent agent logs', {
    lines: { type: 'number', default: 50, desc: 'Number of lines to show' },
    follow: { type: 'boolean', alias: 'f', desc: 'Follow log output (live tail)' },
    level: { choices: ['debug', 'info', 'warn', 'error'], desc: 'Filter by log level' }
  }, async (argv) => {
    try {
      const server = argv.server || DEFAULT_SERVER;

      if (argv.follow) {
        console.log('📡 Following logs (Ctrl+C to stop)...\n');
        // Note: WebSocket streaming would require 'ws' package
        console.log('⚠️  Live log following not yet implemented.');
        console.log('Tip: Use `reploid logs` repeatedly or check the web dashboard.');
        process.exit(0);
      } else {
        const params = new URLSearchParams({
          lines: argv.lines,
          ...(argv.level && { level: argv.level })
        });

        const response = await makeRequest(`${server}/api/logs?${params}`);
        const logs = response.logs || [];

        if (logs.length === 0) {
          console.log('No logs found.');
          return;
        }

        console.log(`\n📋 Recent Logs (${logs.length} entries)\n`);
        logs.forEach(log => console.log(log));
      }

    } catch (err) {
      console.error('❌ Failed to fetch logs:', err.message);
      process.exit(1);
    }
  })

  .command('vfs', 'VFS operations', (yargs) => {
    return yargs
      .command('ls [path]', 'List VFS files', {
        path: { default: '/vfs', desc: 'VFS path' }
      }, async (argv) => {
        try {
          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/vfs/list?path=${encodeURIComponent(argv.path)}`);
          const files = response.files || [];

          console.log(`\n📁 VFS: ${argv.path}\n`);
          files.forEach(f => {
            const icon = f.type === 'directory' ? '📁' : '📄';
            console.log(`${icon} ${f.name} ${f.size ? `(${f.size} bytes)` : ''}`);
          });

        } catch (err) {
          console.error('❌ Failed to list VFS:', err.message);
          process.exit(1);
        }
      })

      .command('cat <path>', 'Show file contents', {
        path: { desc: 'File path in VFS' }
      }, async (argv) => {
        try {
          const server = argv.server || DEFAULT_SERVER;
          const response = await makeRequest(`${server}/api/vfs/read?path=${encodeURIComponent(argv.path)}`);

          console.log(response.content);

        } catch (err) {
          console.error('❌ Failed to read file:', err.message);
          process.exit(1);
        }
      })

      .demandCommand(1, 'Specify a subcommand: ls or cat');
  })

  .option('server', {
    alias: 's',
    type: 'string',
    description: 'Server URL',
    default: DEFAULT_SERVER
  })

  .option('json', {
    type: 'boolean',
    description: 'Output as JSON',
    default: false
  })

  .demandCommand(1, 'You need at least one command')
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .epilogue('For more information, visit https://github.com/anthropics/reploid')
  .argv;