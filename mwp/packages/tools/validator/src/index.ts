/**
 * @mwp/validator
 *
 * MWP protocol conformance validator
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  rule: string;
  message: string;
  file?: string;
  line?: number;
}

interface ValidationWarning {
  rule: string;
  message: string;
  file?: string;
}

export async function main(args: string[]): Promise<void> {
  const program = new Command();

  program
    .name('mwp-validate')
    .description('Validate MWP widget conformance')
    .argument('[path]', 'Widget path to validate', '.')
    .option('-f, --fix', 'Auto-fix issues where possible')
    .option('-s, --strict', 'Strict mode (warnings as errors)')
    .option('-q, --quiet', 'Only show errors')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-types', 'Skip TypeScript checking')
    .option('--no-schema', 'Skip schema validation')
    .action(async (path: string, options: any) => {
      try {
        await validateWidget(path, options);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program.parse(args);
}

async function validateWidget(widgetPath: string, options: any): Promise<void> {
  console.log(chalk.cyan.bold('\n🔍 Validating MCP Widget\n'));

  const spinner = ora('Analyzing widget...').start();
  const results: ValidationResult = { valid: true, errors: [], warnings: [] };

  try {
    // Check widget structure
    validateStructure(widgetPath, results);

    // Check package.json
    validatePackageJson(widgetPath, results);

    // Check TypeScript configuration
    if (options.types !== false) {
      validateTypeScript(widgetPath, results);
    }

    // Check widget factory
    validateFactory(widgetPath, results);

    // Print results
    spinner.stop();
    printResults(results, options);

    if (!results.valid || (options.strict && results.warnings.length > 0)) {
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Validation failed');
    throw error;
  }
}

function validateStructure(widgetPath: string, results: ValidationResult): void {
  const requiredFiles = [
    'package.json',
    'src/index.ts',
    'src/widget.ts',
    'tsconfig.json',
  ];

  for (const file of requiredFiles) {
    if (!existsSync(join(widgetPath, file))) {
      results.valid = false;
      results.errors.push({
        rule: 'structure',
        message: `Missing required file: ${file}`,
        file,
      });
    }
  }

  // Check for recommended files
  const recommendedFiles = ['README.md', 'src/types.ts', 'src/styles.ts'];
  for (const file of recommendedFiles) {
    if (!existsSync(join(widgetPath, file))) {
      results.warnings.push({
        rule: 'structure',
        message: `Missing recommended file: ${file}`,
        file,
      });
    }
  }
}

function validatePackageJson(widgetPath: string, results: ValidationResult): void {
  try {
    const pkgPath = join(widgetPath, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Required fields
    const requiredFields = ['name', 'version', 'description', 'main', 'types'];
    for (const field of requiredFields) {
      if (!pkg[field]) {
        results.errors.push({
          rule: 'package',
          message: `Missing required field in package.json: ${field}`,
          file: 'package.json',
        });
        results.valid = false;
      }
    }

    // Check dependencies
    if (!pkg.dependencies?.['@mwp/core']) {
      results.errors.push({
        rule: 'package',
        message: 'Missing dependency: @mwp/core',
        file: 'package.json',
      });
      results.valid = false;
    }

    // Check for keywords
    if (!pkg.keywords || !pkg.keywords.includes('mcp-widget')) {
      results.warnings.push({
        rule: 'package',
        message: 'Missing keyword: mcp-widget',
        file: 'package.json',
      });
    }
  } catch (error) {
    results.errors.push({
      rule: 'package',
      message: 'Invalid or missing package.json',
      file: 'package.json',
    });
    results.valid = false;
  }
}

function validateTypeScript(widgetPath: string, results: ValidationResult): void {
  try {
    const tsconfigPath = join(widgetPath, 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    // Check strict mode
    if (!tsconfig.compilerOptions?.strict) {
      results.warnings.push({
        rule: 'typescript',
        message: 'TypeScript strict mode not enabled',
        file: 'tsconfig.json',
      });
    }

    // Check target
    const target = tsconfig.compilerOptions?.target;
    if (target && !['ES2022', 'ESNext'].includes(target)) {
      results.warnings.push({
        rule: 'typescript',
        message: `Consider upgrading target to ES2022 or ESNext (current: ${target})`,
        file: 'tsconfig.json',
      });
    }
  } catch (error) {
    results.errors.push({
      rule: 'typescript',
      message: 'Invalid or missing tsconfig.json',
      file: 'tsconfig.json',
    });
    results.valid = false;
  }
}

function validateFactory(widgetPath: string, results: ValidationResult): void {
  try {
    const indexPath = join(widgetPath, 'src/index.ts');
    const content = readFileSync(indexPath, 'utf-8');

    // Check for factory export
    if (!content.includes('WidgetFactoryFunction')) {
      results.errors.push({
        rule: 'factory',
        message: 'Missing WidgetFactoryFunction type',
        file: 'src/index.ts',
      });
      results.valid = false;
    }

    // Check for default export
    if (!content.includes('export default')) {
      results.errors.push({
        rule: 'factory',
        message: 'Missing default export',
        file: 'src/index.ts',
      });
      results.valid = false;
    }

    // Check for required API methods
    const requiredMethods = ['initialize', 'destroy', 'refresh', 'getStatus', 'getResourceUsage'];
    for (const method of requiredMethods) {
      if (!content.includes(method)) {
        results.warnings.push({
          rule: 'factory',
          message: `API method '${method}' may be missing`,
          file: 'src/index.ts',
        });
      }
    }
  } catch (error) {
    results.errors.push({
      rule: 'factory',
      message: 'Could not read src/index.ts',
      file: 'src/index.ts',
    });
    results.valid = false;
  }
}

function printResults(results: ValidationResult, options: any): void {
  console.log('');

  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log(chalk.green.bold('✓ All checks passed!'));
    return;
  }

  if (results.errors.length > 0) {
    console.log(chalk.red.bold('✗ Errors:'));
    for (const error of results.errors) {
      console.log(chalk.red(`  - [${error.rule}] ${error.message}`));
      if (error.file && options.verbose) {
        console.log(chalk.gray(`    ${error.file}${error.line ? `:${error.line}` : ''}`));
      }
    }
    console.log('');
  }

  if (results.warnings.length > 0 && !options.quiet) {
    console.log(chalk.yellow.bold('⚠ Warnings:'));
    for (const warning of results.warnings) {
      console.log(chalk.yellow(`  - [${warning.rule}] ${warning.message}`));
      if (warning.file && options.verbose) {
        console.log(chalk.gray(`    ${warning.file}`));
      }
    }
    console.log('');
  }

  const summary = [];
  if (results.errors.length > 0) {
    summary.push(chalk.red(`${results.errors.length} error${results.errors.length === 1 ? '' : 's'}`));
  }
  if (results.warnings.length > 0) {
    summary.push(chalk.yellow(`${results.warnings.length} warning${results.warnings.length === 1 ? '' : 's'}`));
  }
  console.log(summary.join(', '));
  console.log('');
}
