/**
 * Sampling Handler with GAMMA Integration
 *
 * Handles LLM sampling requests from MCP servers, using GAMMA's
 * multi-model infrastructure to fulfill requests with human-in-the-loop approval.
 */

import type { MCPClient } from "./mcp-client.js";
import type { SamplingRequest, SamplingResponse } from "../types/index.js";

export interface SamplingHandlerOptions {
  /** Whether to require approval for all sampling requests */
  requireApproval?: boolean;

  /** Auto-approve requests from trusted servers */
  autoApproveTrusted?: boolean;

  /** Trusted server names */
  trustedServers?: string[];

  /** Default model to use if not specified */
  defaultModel?: string;

  /** Maximum tokens if not specified */
  defaultMaxTokens?: number;
}

export class SamplingHandler {
  constructor(
    private mcpClient: MCPClient,
    private options: SamplingHandlerOptions = {}
  ) {
    this.options = {
      requireApproval: true,
      autoApproveTrusted: false,
      trustedServers: [],
      defaultModel: "auto",
      defaultMaxTokens: 1000,
      ...options,
    };
  }

  /**
   * Handle a sampling request from a server
   */
  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse | null> {
    console.error(`\n[Sampling] Request from ${request.serverId}`);
    console.error(`[Sampling] Messages: ${request.messages.length}`);
    console.error(
      `[Sampling] Model hint: ${request.modelPreferences?.hints?.[0]?.name || "auto"}`
    );

    // Check if approval is needed
    const needsApproval =
      this.options.requireApproval &&
      !(
        this.options.autoApproveTrusted &&
        this.options.trustedServers?.includes(request.serverId)
      );

    if (needsApproval) {
      const approved = await this.requestUserApproval(request);
      if (!approved) {
        console.error(`[Sampling] Request denied by user`);
        return null;
      }
    }

    // Use GAMMA to fulfill the sampling request
    try {
      const response = await this.executeSamplingWithGamma(request);

      // Optional: Request approval of the response before returning
      if (needsApproval && this.options.requireApproval) {
        const responseApproved = await this.requestResponseApproval(request, response);
        if (!responseApproved) {
          console.error(`[Sampling] Response rejected by user`);
          return null;
        }
      }

      return response;
    } catch (error) {
      console.error(`[Sampling] Error executing sampling:`, error);
      throw error;
    }
  }

  /**
   * Execute sampling using GAMMA's inference infrastructure
   */
  private async executeSamplingWithGamma(
    request: SamplingRequest
  ): Promise<SamplingResponse> {
    // Check if GAMMA server is connected
    if (!this.mcpClient.isConnected("gamma")) {
      throw new Error("GAMMA server not connected - cannot fulfill sampling request");
    }

    // Determine which model to use
    const modelHint = request.modelPreferences?.hints?.[0]?.name;
    const model = modelHint || this.options.defaultModel || "auto";

    // Build the prompt from messages
    const prompt = request.messages
      .map((msg) => {
        const prefix = msg.role === "user" ? "User:" : "Assistant:";
        return `${prefix} ${msg.content}`;
      })
      .join("\n\n");

    // Add system prompt if provided
    const fullPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${prompt}`
      : prompt;

    console.error(`[Sampling] Using GAMMA with model: ${model}`);

    try {
      // Call GAMMA's run_inference tool
      const result = await this.mcpClient.callTool("gamma", "run_inference", {
        prompt: fullPrompt,
        model,
        max_tokens: request.maxTokens || this.options.defaultMaxTokens,
        temperature: 0.7,
      });

      // Parse the response
      if (!result.content || result.content.length === 0) {
        throw new Error("Empty response from GAMMA");
      }

      const textContent = result.content.find((c) => c.type === "text");
      if (!textContent || !("text" in textContent)) {
        throw new Error("No text content in GAMMA response");
      }

      // Extract the generated text
      const text = textContent.text;

      // Parse out the actual generation (GAMMA returns formatted output)
      const generationMatch = text.match(/Generated:\s*(.+)/s);
      const generation = generationMatch ? generationMatch[1].trim() : text;

      return {
        content: generation,
        model,
        stopReason: "end_turn",
        metadata: {
          gammaResult: text,
          requestId: request.metadata?.requestId,
        },
      };
    } catch (error) {
      console.error(`[Sampling] GAMMA inference error:`, error);
      throw new Error(
        `Failed to execute sampling with GAMMA: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Request user approval for a sampling request
   */
  private async requestUserApproval(request: SamplingRequest): Promise<boolean> {
    console.error(`\n┌─── Sampling Request Approval ───`);
    console.error(`│ Server: ${request.serverId}`);
    console.error(`│ Model: ${request.modelPreferences?.hints?.[0]?.name || "auto"}`);
    console.error(`│ Max Tokens: ${request.maxTokens || this.options.defaultMaxTokens}`);
    console.error(`│`);
    console.error(`│ Messages:`);

    for (let i = 0; i < request.messages.length; i++) {
      const msg = request.messages[i];
      console.error(`│   ${i + 1}. [${msg.role}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`);
    }

    if (request.systemPrompt) {
      console.error(`│`);
      console.error(`│ System Prompt: ${request.systemPrompt.substring(0, 100)}...`);
    }

    console.error(`└─────────────────────────────────`);

    // For now, auto-approve (in real implementation, use inquirer or similar)
    // TODO: Integrate with UI layer for actual user input
    console.error(`[Sampling] Auto-approving (interactive approval not yet implemented)`);
    return true;
  }

  /**
   * Request user approval for the generated response
   */
  private async requestResponseApproval(
    request: SamplingRequest,
    response: SamplingResponse
  ): Promise<boolean> {
    console.error(`\n┌─── Sampling Response Approval ───`);
    console.error(`│ Server: ${request.serverId}`);
    console.error(`│ Model: ${response.model}`);
    console.error(`│ Stop Reason: ${response.stopReason}`);
    console.error(`│`);
    console.error(`│ Generated Content:`);
    console.error(
      `│   ${response.content.substring(0, 200)}${response.content.length > 200 ? "..." : ""}`
    );
    console.error(`└──────────────────────────────────`);

    // For now, auto-approve
    // TODO: Integrate with UI layer for actual user input
    console.error(`[Sampling] Auto-approving response (interactive approval not yet implemented)`);
    return true;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<SamplingHandlerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
