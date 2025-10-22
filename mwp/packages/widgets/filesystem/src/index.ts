/**
 * Filesystem Widget Factory
 *
 * Creates Filesystem MCP widget for file operations.
 */

import type {
  WidgetFactoryFunction,
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
} from '@mcp-wp/core';
import { FilesystemWidget } from './widget.js';

/**
 * Create Filesystem Widget
 *
 * Factory function that creates a Filesystem widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - Filesystem MCP server information
 * @returns Widget factory with API and metadata
 */
const createFilesystemWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('filesystem-mcp-widget')) {
    customElements.define('filesystem-mcp-widget', FilesystemWidget);
  }

  // Create widget element
  const widget = document.createElement(
    'filesystem-mcp-widget'
  ) as FilesystemWidget;

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
      element: 'filesystem-mcp-widget',
      displayName: 'Filesystem',
      description: 'Browse and manage files and directories',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      category: 'file-management',
      tags: ['filesystem', 'files', 'directories', 'editor', 'browser'],
      version: '1.0.0',
      author: {
        name: 'MCP-WP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: [
            'read_file',
            'read_multiple_files',
            'write_file',
            'edit_file',
            'list_directory',
            'create_directory',
            'move_file',
            'get_file_info',
            'list_allowed_directories',
            'search_files',
            'filesystem_*',
          ],
        },
      },
    },
  };
};

export default createFilesystemWidget;
export type { FilesystemWidgetConfig, FileEntry, DirectoryEntry } from './types.js';
