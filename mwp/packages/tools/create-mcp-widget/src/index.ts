/**
 * create-mcp-widget CLI
 *
 * Interactive tool for scaffolding new MCP-WP widgets.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import validatePackageName from 'validate-npm-package-name';

const execAsync = promisify(exec);

interface WidgetConfig {
  name: string;
  displayName: string;
  description: string;
  mcpServer: string;
  category: string;
  author: string;
  license: string;
  template: 'basic' | 'advanced' | 'data-viz';
}

interface CLIOptions {
  template?: string;
  directory?: string;
  install?: boolean;
  git?: boolean;
  yes?: boolean;
}

/**
 * Main CLI entry point
 */
export async function main(args: string[]): Promise<void> {
  const program = new Command();

  program
    .name('create-mcp-widget')
    .description('Create a new MCP-WP widget')
    .argument('[name]', 'Widget package name')
    .option('-t, --template <type>', 'Template to use (basic|advanced|data-viz)', 'basic')
    .option('-d, --directory <path>', 'Target directory')
    .option('--no-install', 'Skip dependency installation')
    .option('--no-git', 'Skip git initialization')
    .option('-y, --yes', 'Skip prompts, use defaults')
    .action(async (name: string | undefined, options: CLIOptions) => {
      try {
        await createWidget(name, options);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program.parse(args);
}

/**
 * Create a new widget
 */
async function createWidget(name: string | undefined, options: CLIOptions): Promise<void> {
  console.log(chalk.cyan.bold('\n🚀 Create MCP Widget\n'));

  // Get widget configuration
  const config = await getWidgetConfig(name, options);

  // Validate widget name
  validateWidgetName(config.name);

  // Determine target directory
  const targetDir = options.directory
    ? join(process.cwd(), options.directory, config.name)
    : join(process.cwd(), config.name);

  // Check if directory exists
  if (existsSync(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  // Create widget
  const spinner = ora('Creating widget...').start();

  try {
    // Create directory structure
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(targetDir, 'src'), { recursive: true });

    // Generate files
    generatePackageJson(targetDir, config);
    generateReadme(targetDir, config);
    generateTsConfig(targetDir, config);
    generateViteConfig(targetDir, config);
    generateIndexTs(targetDir, config);
    generateTypesTs(targetDir, config);
    generateWidgetTs(targetDir, config);
    generateStylesTs(targetDir, config);

    spinner.succeed('Widget created successfully!');

    // Install dependencies
    if (options.install !== false) {
      await installDependencies(targetDir);
    }

    // Initialize git
    if (options.git !== false) {
      await initializeGit(targetDir);
    }

    // Print success message
    printSuccessMessage(config.name, targetDir, options);
  } catch (error) {
    spinner.fail('Failed to create widget');
    throw error;
  }
}

/**
 * Get widget configuration from user
 */
async function getWidgetConfig(
  name: string | undefined,
  options: CLIOptions
): Promise<WidgetConfig> {
  if (options.yes && name) {
    return {
      name,
      displayName: formatDisplayName(name),
      description: 'A new MCP widget',
      mcpServer: 'example-server',
      category: 'general',
      author: 'Your Name',
      license: 'MIT',
      template: (options.template as any) || 'basic',
    };
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Widget package name:',
      default: name || 'my-widget',
      validate: (input: string) => {
        const result = validatePackageName(input);
        if (!result.validForNewPackages) {
          return result.errors?.[0] || 'Invalid package name';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name:',
      default: (answers: any) => formatDisplayName(answers.name),
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'A new MCP widget',
    },
    {
      type: 'input',
      name: 'mcpServer',
      message: 'MCP server name:',
      default: 'example-server',
    },
    {
      type: 'list',
      name: 'category',
      message: 'Widget category:',
      choices: [
        { name: 'Data Management', value: 'data-management' },
        { name: 'Development Tools', value: 'dev-tools' },
        { name: 'AI Tools', value: 'ai-tools' },
        { name: 'Web Tools', value: 'web-tools' },
        { name: 'Productivity', value: 'productivity' },
        { name: 'General', value: 'general' },
      ],
      default: 'general',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: 'Your Name',
    },
    {
      type: 'list',
      name: 'license',
      message: 'License:',
      choices: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC'],
      default: 'MIT',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Widget template:',
      choices: [
        { name: 'Basic - Simple widget structure', value: 'basic' },
        { name: 'Advanced - Feature-rich widget', value: 'advanced' },
        { name: 'Data Visualization - Charts and tables', value: 'data-viz' },
      ],
      default: options.template || 'basic',
    },
  ]);

  return answers;
}

/**
 * Validate widget name
 */
function validateWidgetName(name: string): void {
  const result = validatePackageName(name);
  if (!result.validForNewPackages) {
    throw new Error(`Invalid widget name: ${result.errors?.join(', ')}`);
  }
}

/**
 * Format display name from package name
 */
function formatDisplayName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate package.json
 */
function generatePackageJson(targetDir: string, config: WidgetConfig): void {
  const pkg = {
    name: `@mcp-wp/widget-${config.name}`,
    version: '1.0.0',
    description: config.description,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    },
    files: ['dist', 'README.md'],
    scripts: {
      build: 'tsc && vite build',
      dev: 'vite build --watch',
      typecheck: 'tsc --noEmit',
      clean: 'rm -rf dist',
    },
    dependencies: {
      '@mcp-wp/core': 'workspace:*',
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      typescript: '^5.3.3',
      vite: '^5.0.11',
    },
    keywords: ['mcp', 'mcp-widget', config.name, 'web-component'],
    author: config.author,
    license: config.license,
  };

  writeFileSync(join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2));
}

/**
 * Generate README.md
 */
function generateReadme(targetDir: string, config: WidgetConfig): void {
  const readme = `# @mcp-wp/widget-${config.name}

${config.description}

## Installation

\`\`\`bash
pnpm add @mcp-wp/widget-${config.name}
\`\`\`

## Usage

\`\`\`typescript
import { Dashboard } from '@mcp-wp/dashboard';
import create${formatClassName(config.name)}Widget from '@mcp-wp/widget-${config.name}';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add widget
await dashboard.addWidget({
  factory: create${formatClassName(config.name)}Widget,
  serverName: '${config.mcpServer}',
  config: {
    // MCP server configuration
  },
});
\`\`\`

## Features

- Feature 1
- Feature 2
- Feature 3

## License

${config.license}
`;

  writeFileSync(join(targetDir, 'README.md'), readme);
}

/**
 * Generate tsconfig.json
 */
function generateTsConfig(targetDir: string, config: WidgetConfig): void {
  const tsconfig = {
    compilerOptions: {
      module: 'ESNext',
      moduleResolution: 'bundler',
      target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      outDir: './dist',
      rootDir: './src',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      strictPropertyInitialization: true,
      noImplicitThis: true,
      alwaysStrict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      removeComments: false,
      importHelpers: false,
      downlevelIteration: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      isolatedModules: true,
      baseUrl: '.',
      paths: {
        [`@mcp-wp/widget-${config.name}`]: ['./src/index.ts'],
        [`@mcp-wp/widget-${config.name}/*`]: ['./src/*'],
      },
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'test'],
  };

  writeFileSync(join(targetDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
}

/**
 * Generate vite.config.ts
 */
function generateViteConfig(targetDir: string, config: WidgetConfig): void {
  const viteConfig = `import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '${formatClassName(config.name)}Widget',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@mcp-wp/core'],
      output: {
        globals: {
          '@mcp-wp/core': 'MCPCore',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@mcp-wp/widget-${config.name}': resolve(__dirname, 'src'),
    },
  },
});
`;

  writeFileSync(join(targetDir, 'vite.config.ts'), viteConfig);
}

/**
 * Generate src/index.ts
 */
function generateIndexTs(targetDir: string, config: WidgetConfig): void {
  const className = formatClassName(config.name);
  const index = `/**
 * ${config.displayName} Widget Factory
 */

import type {
  WidgetFactoryFunction,
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
} from '@mcp-wp/core';
import { ${className}Widget } from './widget.js';

const create${className}Widget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  if (!customElements.get('${config.name}-widget')) {
    customElements.define('${config.name}-widget', ${className}Widget);
  }

  const widget = document.createElement('${config.name}-widget') as ${className}Widget;
  widget.setDependencies(EventBus, MCPBridge, Configuration);
  widget.setServerInfo(mcpServerInfo);

  return {
    api: {
      async initialize(): Promise<void> {
        await widget.initialize();
      },

      async destroy(): Promise<void> {
        await widget.destroy();
      },

      async refresh(): Promise<void> {
        await widget.refresh();
      },

      getStatus() {
        return widget.getStatus();
      },

      getResourceUsage() {
        return widget.getResourceUsage();
      },
    },

    widget: {
      protocolVersion: '1.0.0',
      element: '${config.name}-widget',
      displayName: '${config.displayName}',
      description: '${config.description}',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      category: '${config.category}',
      tags: ['${config.name}'],
      version: '1.0.0',
      author: {
        name: '${config.author}',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: ['*'],
        },
      },
    },
  };
};

export default create${className}Widget;
`;

  writeFileSync(join(targetDir, 'src', 'index.ts'), index);
}

/**
 * Generate src/types.ts
 */
function generateTypesTs(targetDir: string, config: WidgetConfig): void {
  const types = `/**
 * ${config.displayName} Widget Types
 */

export interface ${formatClassName(config.name)}WidgetConfig {
  // Add your widget configuration options here
  exampleOption?: boolean;
}

// Add more types as needed
`;

  writeFileSync(join(targetDir, 'src', 'types.ts'), types);
}

/**
 * Generate src/widget.ts
 */
function generateWidgetTs(targetDir: string, config: WidgetConfig): void {
  const className = formatClassName(config.name);
  const widget = `/**
 * ${config.displayName} Widget Component
 */

import type {
  EventBus,
  MCPBridge,
  Configuration,
  MCPServerInfo,
  WidgetStatus,
  ResourceUsage,
  UnsubscribeFunction,
} from '@mcp-wp/core';
import { styles } from './styles.js';
import type { ${className}WidgetConfig } from './types.js';

interface WidgetState {
  loading: boolean;
  error: string | null;
  // Add your state properties here
}

export class ${className}Widget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: ${className}WidgetConfig;

  private state: WidgetState = {
    loading: false,
    error: null,
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private renderStartTime?: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.widgetConfig = {
      exampleOption: true,
    };
  }

  setDependencies(
    eventBus: EventBus,
    mcpBridge: MCPBridge,
    config: Configuration
  ): void {
    this.eventBus = eventBus;
    this.mcpBridge = mcpBridge;
    this.config = config;
  }

  setServerInfo(serverInfo: MCPServerInfo): void {
    this.serverInfo = serverInfo;
  }

  async initialize(): Promise<void> {
    const savedConfig = this.config.get('${config.name}Widget');
    if (savedConfig) {
      this.widgetConfig = { ...this.widgetConfig, ...savedConfig };
    }

    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || '${config.name}-widget',
      element: '${config.name}-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    this.setupEventListeners();
    this.render();
  }

  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || '${config.name}-widget',
      element: '${config.name}-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    // Implement refresh logic
    this.render();
  }

  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return { status: 'initializing', message: 'Loading...' };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: { code: 'WIDGET_ERROR', message: this.state.error },
      };
    }

    return {
      status: 'healthy',
      message: 'Ready',
      lastUpdate: new Date(),
    };
  }

  getResourceUsage(): ResourceUsage {
    const memory = this.estimateMemoryUsage();
    const domNodes = this.shadowRoot?.querySelectorAll('*').length || 0;

    return {
      memory,
      renderTime: this.renderStartTime ? Date.now() - this.renderStartTime : 0,
      domNodes,
    };
  }

  connectedCallback(): void {}
  disconnectedCallback(): void {}

  private setupEventListeners(): void {
    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:invoked', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleToolResult(data);
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:error', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleError(data.error);
        }
      })
    );
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = \`
      <style>\${styles}</style>
      <div class="${config.name}-widget">
        <header class="widget-header">
          <h2>${config.displayName}</h2>
        </header>
        \${this.renderContent()}
      </div>
    \`;

    this.attachEventHandlers();
  }

  private renderContent(): string {
    if (this.state.loading) {
      return '<div class="loading">Loading...</div>';
    }

    if (this.state.error) {
      return \`<div class="error">Error: \${this.state.error}</div>\`;
    }

    return '<div class="content">Widget content goes here</div>';
  }

  private attachEventHandlers(): void {
    if (!this.shadowRoot) return;
    // Add event handlers here
  }

  private setState(updates: Partial<WidgetState>): void {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  private handleToolResult(data: any): void {
    console.log('Tool result:', data);
  }

  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.setState({ error: message, loading: false });

    this.eventBus.emit('widget:error', {
      widgetId: this.id || '${config.name}-widget',
      element: '${config.name}-widget',
      serverName: this.serverInfo.serverName,
      error: { code: 'WIDGET_ERROR', message },
      timestamp: new Date(),
    });
  }

  private estimateMemoryUsage(): number {
    const stateSize = JSON.stringify(this.state).length * 2;
    const domSize = (this.shadowRoot?.innerHTML.length || 0) * 2;
    return stateSize + domSize;
  }
}
`;

  writeFileSync(join(targetDir, 'src', 'widget.ts'), widget);
}

/**
 * Generate src/styles.ts
 */
function generateStylesTs(targetDir: string, config: WidgetConfig): void {
  const styles = `/**
 * ${config.displayName} Widget Styles
 */

export const styles = \`
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px;
    color: var(--text-color, #24292f);
    background: var(--surface-color, #ffffff);
    border-radius: var(--border-radius, 6px);
    overflow: hidden;
  }

  .${config.name}-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 300px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #d0d7de);
    background: var(--header-bg, #f6f8fa);
  }

  .widget-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .loading,
  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
    color: var(--text-secondary, #57606a);
  }

  .error {
    color: var(--error-color, #cf222e);
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #c9d1d9;
      --text-secondary: #8b949e;
      --surface-color: #0d1117;
      --border-color: #30363d;
      --header-bg: #161b22;
      --error-color: #f85149;
    }
  }
\`;
`;

  writeFileSync(join(targetDir, 'src', 'styles.ts'), styles);
}

/**
 * Format class name from package name
 */
function formatClassName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Install dependencies
 */
async function installDependencies(targetDir: string): Promise<void> {
  const spinner = ora('Installing dependencies...').start();

  try {
    await execAsync('pnpm install', { cwd: targetDir });
    spinner.succeed('Dependencies installed');
  } catch (error) {
    spinner.warn('Failed to install dependencies. Run `pnpm install` manually.');
  }
}

/**
 * Initialize git repository
 */
async function initializeGit(targetDir: string): Promise<void> {
  const spinner = ora('Initializing git...').start();

  try {
    await execAsync('git init', { cwd: targetDir });
    await execAsync('git add .', { cwd: targetDir });
    await execAsync('git commit -m "Initial commit"', { cwd: targetDir });
    spinner.succeed('Git initialized');
  } catch (error) {
    spinner.warn('Failed to initialize git');
  }
}

/**
 * Print success message
 */
function printSuccessMessage(name: string, targetDir: string, options: CLIOptions): void {
  console.log(chalk.green.bold('\n✨ Widget created successfully!\n'));
  console.log(chalk.cyan('Next steps:\n'));
  console.log(chalk.white(`  cd ${name}`));

  if (options.install === false) {
    console.log(chalk.white('  pnpm install'));
  }

  console.log(chalk.white('  pnpm dev\n'));
  console.log(chalk.gray(`Widget location: ${targetDir}\n`));
}
