/**
 * Tool Executor
 *
 * Handles MCP tool invocation with validation and error handling.
 */

import type { EventBus, ToolResult } from '@mcp-wp/core';
import type { ClientManager } from './client-manager.js';
import { ToolExecutionError, TimeoutError } from './errors.js';

/**
 * Tool Executor
 *
 * Executes MCP tools with event emission and error handling.
 */
export class ToolExecutor {
  constructor(
    private readonly eventBus: EventBus,
    private readonly clientManager: ClientManager
  ) {}

  /**
   * Call MCP tool
   *
   * @param serverName - Server identifier
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool result
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const requestId = this.generateRequestId();

    // Emit request event
    this.eventBus.emit('mcp:tool:invoke-requested', {
      serverName,
      toolName,
      args,
      requestId,
    });

    const startTime = Date.now();

    try {
      // Get client
      const client = this.clientManager.getClient(serverName);

      // Call tool via MCP
      const result = await client.request(
        { method: 'tools/call' },
        {
          name: toolName,
          arguments: args,
        }
      );

      const toolResult: ToolResult = {
        content: result.content || [],
        isError: result.isError || false,
      };

      const duration = Date.now() - startTime;

      // Emit success event
      this.eventBus.emit('mcp:tool:invoked', {
        serverName,
        toolName,
        args,
        result: toolResult,
        requestId,
        duration,
      });

      return toolResult;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('mcp:tool:error', {
        serverName,
        toolName,
        args,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Tool execution failed',
          details: error,
        },
        requestId,
      });

      throw new ToolExecutionError(
        `Tool ${toolName} on ${serverName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        serverName,
        toolName,
        error
      );
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
