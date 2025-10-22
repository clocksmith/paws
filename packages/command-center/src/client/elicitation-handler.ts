/**
 * Elicitation Handler
 *
 * Handles structured user input requests from MCP servers,
 * providing a human-in-the-loop mechanism for gathering information.
 */

import type { ElicitationRequest, ElicitationResponse } from "../types/index.js";

export interface ElicitationHandlerOptions {
  /** Default timeout for user responses (ms) */
  timeout?: number;

  /** Whether to validate responses against schema */
  validateSchema?: boolean;
}

export class ElicitationHandler {
  constructor(private options: ElicitationHandlerOptions = {}) {
    this.options = {
      timeout: 300000, // 5 minutes default
      validateSchema: true,
      ...options,
    };
  }

  /**
   * Handle an elicitation request from a server
   */
  async handleElicitationRequest(
    request: ElicitationRequest
  ): Promise<ElicitationResponse> {
    console.error(`\n[Elicitation] Request from ${request.serverId}`);
    console.error(`[Elicitation] Message: ${request.message}`);

    // Display the request to the user
    this.displayElicitationRequest(request);

    // Get user input
    const data = await this.getUserInput(request);

    if (data === null) {
      return {
        data: {},
        approved: false,
        cancellationReason: "User cancelled",
      };
    }

    // Validate against schema if enabled
    if (this.options.validateSchema) {
      const validation = this.validateAgainstSchema(data, request.schema);
      if (!validation.valid) {
        console.error(`[Elicitation] Validation failed:`, validation.errors);
        throw new Error(`Invalid input: ${validation.errors?.join(", ")}`);
      }
    }

    return {
      data,
      approved: true,
    };
  }

  /**
   * Display elicitation request to user
   */
  private displayElicitationRequest(request: ElicitationRequest): void {
    console.error(`\n┌─── User Input Required ───`);
    console.error(`│ Server: ${request.serverId}`);
    console.error(`│`);
    console.error(`│ ${request.message}`);
    console.error(`│`);
    console.error(`│ Required fields:`);

    // Show schema properties
    for (const [key, prop] of Object.entries(request.schema.properties)) {
      const required = request.schema.required?.includes(key) ? " (required)" : "";
      const desc = prop.description ? ` - ${prop.description}` : "";
      const enumValues = prop.enum ? ` [${prop.enum.join(", ")}]` : "";
      const defaultValue = prop.default !== undefined ? ` (default: ${prop.default})` : "";

      console.error(`│   • ${key}: ${prop.type}${enumValues}${defaultValue}${desc}${required}`);
    }

    console.error(`└───────────────────────────`);
  }

  /**
   * Get user input (stub - to be implemented with inquirer or similar)
   */
  private async getUserInput(
    request: ElicitationRequest
  ): Promise<Record<string, unknown> | null> {
    // For now, return auto-generated defaults based on schema
    // TODO: Integrate with UI layer (inquirer) for actual user input

    console.error(
      `\n[Elicitation] Auto-generating response (interactive input not yet implemented)`
    );

    const data: Record<string, unknown> = {};

    for (const [key, prop] of Object.entries(request.schema.properties)) {
      // Use default if available
      if (prop.default !== undefined) {
        data[key] = prop.default;
        continue;
      }

      // Auto-generate based on type
      switch (prop.type) {
        case "boolean":
          data[key] = request.schema.required?.includes(key) ? true : false;
          break;

        case "string":
          if (prop.enum) {
            data[key] = prop.enum[0]; // Pick first enum value
          } else {
            data[key] = `auto-generated-${key}`;
          }
          break;

        case "number":
          data[key] = 0;
          break;

        case "integer":
          data[key] = 0;
          break;

        default:
          if (request.schema.required?.includes(key)) {
            data[key] = null;
          }
      }
    }

    console.error(`[Elicitation] Generated response:`, JSON.stringify(data, null, 2));

    return data;
  }

  /**
   * Validate data against JSON schema
   */
  private validateAgainstSchema(
    data: Record<string, unknown>,
    schema: ElicitationRequest["schema"]
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data) || data[field] === null || data[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check types and enum values
    for (const [key, value] of Object.entries(data)) {
      const prop = schema.properties[key];
      if (!prop) {
        continue; // Allow extra fields
      }

      // Type checking
      const actualType = typeof value;
      const expectedType = prop.type;

      if (expectedType === "integer" || expectedType === "number") {
        if (actualType !== "number") {
          errors.push(`Field ${key} must be a number, got ${actualType}`);
        }
      } else if (expectedType === "boolean") {
        if (actualType !== "boolean") {
          errors.push(`Field ${key} must be a boolean, got ${actualType}`);
        }
      } else if (expectedType === "string") {
        if (actualType !== "string") {
          errors.push(`Field ${key} must be a string, got ${actualType}`);
        }

        // Enum validation
        if (prop.enum && !prop.enum.includes(value as string)) {
          errors.push(
            `Field ${key} must be one of [${prop.enum.join(", ")}], got ${value}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<ElicitationHandlerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
