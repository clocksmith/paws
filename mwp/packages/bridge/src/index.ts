/**
 * @mcp-wp/bridge
 *
 * MCPBridge implementation for MCP Widget Protocol.
 *
 * @packageDocumentation
 */

// Main exports
export { MCPBridge } from './bridge.js';
export type { BridgeConfiguration } from './bridge.js';

// Error exports
export {
  MCPBridgeError,
  ConnectionError,
  ToolExecutionError,
  ResourceReadError,
  PromptGetError,
  TimeoutError,
  ValidationError,
} from './errors.js';

// Internal exports (for advanced usage)
export { ClientManager } from './client-manager.js';
export { ToolExecutor } from './tool-executor.js';
export { ResourceReader } from './resource-reader.js';
export { PromptGetter } from './prompt-getter.js';

/**
 * Package version
 */
export const VERSION = '1.0.0';
