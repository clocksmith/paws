#!/usr/bin/env node

/**
 * CLI tool for MCP server management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { MCPServer } from './server.js';
import { loadConfig, resolveEnvVariables } from './config.js';
import { logger } from './logger.js';

const program = new Command();

program
  .name('mwp-server')
  .description('MCP server for MWP dashboard')
  .version('1.0.0');

/**
 * Start command
 */
program
  .command('start')
  .description('Start the MCP server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-d, --daemon', 'Run as daemon')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting MWP Server...\n'));

      // Load configuration
      const config = options.config
        ? loadConfig(options.config)
        : {
            port: parseInt(options.port),
            host: options.host,
          };

      // Resolve environment variables
      const resolvedConfig = resolveEnvVariables(config);

      // Create and start server
      const server = new MCPServer(resolvedConfig);

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log(chalk.yellow('\n\n⏸  Shutting down server...'));
        await server.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      await server.start();

      const status = server.getStatus();

      console.log(chalk.green('✓ Server started successfully!\n'));
      console.log(chalk.cyan('Server Information:'));
      console.log(`  URL: ${chalk.white(`http://${config.host}:${config.port}`)}`);
      console.log(`  WebSocket: ${chalk.white(`ws://${config.host}:${config.port}/ws`)}`);
      console.log(`  Health: ${chalk.white(`http://${config.host}:${config.port}/api/health`)}`);

      if (config.mcpServers && config.mcpServers.length > 0) {
        console.log(chalk.cyan('\nConnected MCP Servers:'));
        config.mcpServers.forEach((server) => {
          const statusColor = status.mcpServers[server.name] === 'connected' ? chalk.green : chalk.red;
          console.log(`  ${statusColor('●')} ${server.name}`);
        });
      } else {
        console.log(chalk.yellow('\n⚠  No MCP servers configured'));
      }

      console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
    } catch (error: any) {
      console.error(chalk.red('✗ Failed to start server:'), error.message);
      logger.error('Server start failed', { error: error.message, stack: error.stack });
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Check server status')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:3000')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Checking server status...\n'));

      const response = await fetch(`${options.url}/api/health`);
      const status = await response.json();

      if (status.status === 'healthy') {
        console.log(chalk.green('✓ Server is healthy\n'));
      } else {
        console.log(chalk.yellow('⚠ Server is degraded\n'));
      }

      console.log(chalk.cyan('Server Status:'));
      console.log(`  Status: ${chalk.white(status.status)}`);
      console.log(`  Uptime: ${chalk.white(formatUptime(status.uptime))}`);
      console.log(`  Version: ${chalk.white(status.version)}`);

      if (status.connections) {
        console.log(chalk.cyan('\nConnections:'));
        console.log(`  WebSocket: ${chalk.white(status.connections.websocket)}`);
        console.log(`  HTTP: ${chalk.white(status.connections.http)}`);
      }

      if (status.mcpServers) {
        console.log(chalk.cyan('\nMCP Servers:'));
        Object.entries(status.mcpServers).forEach(([name, serverStatus]) => {
          const color = serverStatus === 'connected' ? chalk.green : chalk.red;
          console.log(`  ${color('●')} ${name}: ${serverStatus}`);
        });
      }

      if (status.memory) {
        console.log(chalk.cyan('\nMemory Usage:'));
        console.log(`  Heap Used: ${chalk.white(formatBytes(status.memory.heapUsed))}`);
        console.log(`  Heap Total: ${chalk.white(formatBytes(status.memory.heapTotal))}`);
        console.log(`  External: ${chalk.white(formatBytes(status.memory.external))}`);
      }

      console.log();
    } catch (error: any) {
      console.error(chalk.red('✗ Failed to get status:'), error.message);
      console.error(chalk.gray('Make sure the server is running'));
      process.exit(1);
    }
  });

/**
 * Config command
 */
program
  .command('config')
  .description('Validate and display configuration')
  .option('-c, --config <path>', 'Path to configuration file')
  .action((options) => {
    try {
      console.log(chalk.blue('Loading configuration...\n'));

      const config = options.config ? loadConfig(options.config) : loadConfig();

      console.log(chalk.green('✓ Configuration is valid\n'));

      console.log(chalk.cyan('Server Configuration:'));
      console.log(JSON.stringify(config, null, 2));
    } catch (error: any) {
      console.error(chalk.red('✗ Invalid configuration:'), error.message);
      process.exit(1);
    }
  });

/**
 * Generate config command
 */
program
  .command('init')
  .description('Generate a default configuration file')
  .option('-o, --output <path>', 'Output file path', 'mcp-server.config.json')
  .action((options) => {
    try {
      const defaultConfig = {
        server: {
          port: 3000,
          host: 'localhost',
        },
        mcpServers: [
          {
            name: 'github',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
            },
          },
        ],
        security: {
          cors: {
            origin: ['http://localhost:5173'],
            credentials: true,
          },
          rateLimit: {
            windowMs: 900000,
            max: 100,
          },
        },
        logging: {
          level: 'info',
          file: './logs/mcp-server.log',
        },
      };

      const fs = require('fs');
      fs.writeFileSync(options.output, JSON.stringify(defaultConfig, null, 2));

      console.log(chalk.green(`✓ Configuration file created: ${options.output}`));
      console.log(chalk.gray('\nEdit the file to customize your server configuration'));
    } catch (error: any) {
      console.error(chalk.red('✗ Failed to create configuration file:'), error.message);
      process.exit(1);
    }
  });

/**
 * Helper: Format uptime
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Helper: Format bytes
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
