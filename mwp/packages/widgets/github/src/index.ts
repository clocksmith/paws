/**
 * GitHub Widget Factory
 *
 * Creates GitHub MCP widget for interacting with GitHub repositories.
 */

import type { types } from '@mwp/core';

type WidgetFactoryFunction = types.WidgetFactoryFunction;
type WidgetFactory = types.WidgetFactory;
type Dependencies = types.Dependencies;
type MCPServerInfo = types.MCPServerInfo;

import { GitHubWidget } from './widget.js';

/**
 * Create GitHub Widget
 *
 * Factory function that creates a GitHub widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - GitHub MCP server information
 * @returns Widget factory with API and metadata
 */
const createGitHubWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('github-mcp-widget')) {
    customElements.define('github-mcp-widget', GitHubWidget);
  }

  // Create widget element
  const widget = document.createElement('github-mcp-widget') as GitHubWidget;

  // Inject dependencies
  widget.setDependencies(EventBus, MCPBridge, Configuration);
  widget.setServerInfo(mcpServerInfo);

  // Return widget factory
  return {
    api: {
      /**
       * Initialize the widget
       */
      async initialize(): Promise<void> {
        await widget.initialize();
      },

      /**
       * Destroy the widget
       */
      async destroy(): Promise<void> {
        await widget.destroy();
      },

      /**
       * Refresh the widget
       */
      async refresh(): Promise<void> {
        await widget.refresh();
      },

      /**
       * Get widget status
       */
      getStatus() {
        return widget.getStatus();
      },

      /**
       * Get resource usage
       */
      getResourceUsage() {
        return widget.getResourceUsage();
      },
    },

    widget: {
      protocolVersion: '1.0.0',
      element: 'github-mcp-widget',
      displayName: 'GitHub',
      description: 'Interact with GitHub repositories',
      capabilities: {
        tools: true,
        resources: true,
        prompts: false,
      },
      tags: ['github', 'git', 'version-control', 'issues', 'pull-requests'],
      version: '1.0.0',
      author: {
        name: 'MWP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: [
            'create_issue',
            'create_pull_request',
            'search_code',
            'get_file_contents',
            'create_branch',
            'list_commits',
            'create_repository',
            'get_repository',
            'update_issue',
            'list_issues',
            'search_issues',
          ],
        },
        resources: {
          scope: 'allowlist',
          patterns: ['github://*'],
        },
      },
    },
  };
};

export default createGitHubWidget;
