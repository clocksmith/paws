/**
 * Prompt Getter
 *
 * Handles MCP prompt retrieval.
 */

import type { EventBus, PromptMessages } from '@mcp-wp/core';
import type { ClientManager } from './client-manager.js';
import { PromptGetError } from './errors.js';

/**
 * Prompt Getter
 *
 * Retrieves MCP prompts.
 */
export class PromptGetter {
  constructor(
    private readonly eventBus: EventBus,
    private readonly clientManager: ClientManager
  ) {}

  /**
   * Get MCP prompt
   *
   * @param serverName - Server identifier
   * @param promptName - Prompt name
   * @param args - Prompt arguments
   * @returns Prompt messages
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<PromptMessages> {
    const requestId = this.generateRequestId();

    // Emit request event
    this.eventBus.emit('mcp:prompt:get-requested', {
      serverName,
      promptName,
      args,
      requestId,
    });

    try {
      // Get client
      const client = this.clientManager.getClient(serverName);

      // Get prompt via MCP
      const result = await client.request(
        { method: 'prompts/get' },
        {
          name: promptName,
          arguments: args,
        }
      );

      const messages: PromptMessages = {
        description: result.description,
        messages: result.messages || [],
      };

      // Emit success event
      this.eventBus.emit('mcp:prompt:got', {
        serverName,
        promptName,
        args,
        messages,
        requestId,
      });

      return messages;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('mcp:prompt:error', {
        serverName,
        promptName,
        args,
        error: {
          code: 'PROMPT_GET_ERROR',
          message: error instanceof Error ? error.message : 'Prompt retrieval failed',
          details: error,
        },
        requestId,
      });

      throw new PromptGetError(
        `Failed to get prompt ${promptName} from ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        serverName,
        promptName,
        error
      );
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
