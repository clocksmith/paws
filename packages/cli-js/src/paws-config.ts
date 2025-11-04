#!/usr/bin/env node
/**
 * PAWS Configuration Management CLI
 */

import * as chalk from 'chalk';
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, validateConfig, defaultConfig } from './core/config';
import { handleError, setupGlobalErrorHandler } from './core/errors';
import { createLogger, ConsoleTransport, LogLevel } from './core/logging';

const Table = require('cli-table3');

// Setup logger
const logger = createLogger({
  transports: [new ConsoleTransport({ colorize: true })],
});

// Setup global error handler
setupGlobalErrorHandler(logger);

/**
 * Main CLI program
 */
export async function main() {
  const program = new Command();

  program
    .name('paws-config')
    .description('Manage PAWS configuration')
    .version('1.0.0');

  // Init command
  program
    .command('init')
    .description('Initialize a new configuration file')
    .option('-g, --global', 'Create global configuration (~/.pawsrc.json)')
    .option('-p, --profile <name>', 'Create with named profile')
    .action(async (options) => {
      try {
        const targetPath = options.global
          ? path.join(os.homedir(), '.pawsrc.json')
          : path.join(process.cwd(), '.pawsrc.json');

        await ConfigManager.init(targetPath, options.profile);

        console.log(chalk.green('✓ Configuration initialized'));
        console.log(chalk.gray(`  Location: ${targetPath}`));
        if (options.profile) {
          console.log(chalk.gray(`  Profile: ${options.profile}`));
        }
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  // Get command
  program
    .command('get <path>')
    .description('Get a configuration value')
    .option('-p, --profile <name>', 'Use specific profile')
    .action(async (configPath, options) => {
      try {
        const manager = await ConfigManager.load(process.cwd(), {
          profile: options.profile,
        });

        const value = manager.getValue(configPath);

        if (value === undefined) {
          console.log(chalk.yellow(`No value found for: ${configPath}`));
        } else {
          console.log(JSON.stringify(value, null, 2));
        }
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  // Set command
  program
    .command('set <path> <value>')
    .description('Set a configuration value')
    .option('-p, --profile <name>', 'Use specific profile')
    .option('-g, --global', 'Set in global configuration')
    .action(async (configPath, value, options) => {
      try {
        const cwd = options.global ? os.homedir() : process.cwd();
        const manager = await ConfigManager.load(cwd, {
          profile: options.profile,
          allowMissing: true,
        });

        // Parse value (try JSON first, otherwise string)
        let parsedValue: any = value;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Use as string
        }

        manager.setValue(configPath, parsedValue);
        await manager.save();

        console.log(chalk.green('✓ Configuration updated'));
        console.log(chalk.gray(`  ${configPath} = ${JSON.stringify(parsedValue)}`));
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  // List command
  program
    .command('list')
    .description('List all configuration values')
    .option('-p, --profile <name>', 'Use specific profile')
    .action(async (options) => {
      try {
        const manager = await ConfigManager.load(process.cwd(), {
          profile: options.profile,
          allowMissing: true,
        });

        const config = manager.get();

        console.log(chalk.bold('\nCurrent Configuration:'));
        if (manager.getConfigPath()) {
          console.log(chalk.gray(`Location: ${manager.getConfigPath()}`));
        }
        if (manager.getProfile()) {
          console.log(chalk.gray(`Profile: ${manager.getProfile()}`));
        }
        console.log('');
        console.log(JSON.stringify(config, null, 2));
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  // Validate command
  program
    .command('validate')
    .description('Validate configuration')
    .option('-p, --profile <name>', 'Use specific profile')
    .action(async (options) => {
      try {
        const manager = await ConfigManager.load(process.cwd(), {
          profile: options.profile,
        });

        const config = manager.get();
        const result = validateConfig(config);

        if (result.valid) {
          console.log(chalk.green('✓ Configuration is valid'));
        } else {
          console.log(chalk.red('✖ Configuration has errors:\n'));
          result.errors.forEach((error) => {
            console.log(chalk.red(`  • ${error}`));
          });
          process.exit(1);
        }
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  // Show pricing command
  program
    .command('pricing')
    .description('Show model pricing table')
    .action(async () => {
      try {
        const manager = await ConfigManager.load(process.cwd(), {
          allowMissing: true,
        });

        const config = manager.get();
        const pricing = config.pricing || {};

        const table = new Table({
          head: ['Model', 'Input ($/1K)', 'Output ($/1K)', 'Context Window', 'Display Name'],
          colWidths: [40, 15, 15, 15, 25],
        });

        for (const [modelId, modelPricing] of Object.entries(pricing)) {
          table.push([
            modelId,
            `$${modelPricing.inputCostPer1kTokens.toFixed(6)}`,
            `$${modelPricing.outputCostPer1kTokens.toFixed(6)}`,
            modelPricing.contextWindow?.toLocaleString() || 'N/A',
            modelPricing.displayName || modelId,
          ]);
        }

        console.log(chalk.bold('\nModel Pricing:'));
        console.log(table.toString());
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  // Profiles command
  program
    .command('profiles')
    .description('List available profiles')
    .action(async () => {
      try {
        // Try to read config file directly to get profiles
        const configPath = path.join(process.cwd(), '.pawsrc.json');
        const fs = require('fs');

        if (!fs.existsSync(configPath)) {
          console.log(chalk.yellow('No configuration file found'));
          return;
        }

        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);

        if (config.profiles) {
          const table = new Table({
            head: ['Profile', 'Default'],
          });

          for (const profileName of Object.keys(config.profiles)) {
            const isDefault = config.defaultProfile === profileName;
            table.push([profileName, isDefault ? chalk.green('✓') : '']);
          }

          console.log(chalk.bold('\nAvailable Profiles:'));
          console.log(table.toString());
        } else {
          console.log(chalk.yellow('No profiles defined in configuration'));
        }
      } catch (error) {
        await handleError(error, { logger, exitProcess: true });
      }
    });

  await program.parseAsync(process.argv);
}

// Run if executed directly
if (require.main === module) {
  main().catch(async (error) => {
    await handleError(error, { logger, exitProcess: true });
  });
}
