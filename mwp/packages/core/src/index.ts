/**
 * @mcp-wp/core
 *
 * Core types, schemas, and utilities for MCP Widget Protocol.
 *
 * @packageDocumentation
 */

// Re-export types (as namespace to avoid conflicts)
export * as types from './types/index.js';

// Re-export schemas (as namespace to avoid conflicts)
export * as schemas from './schemas/index.js';

// Re-export utilities (as namespace to avoid conflicts)
export * as utils from './utils/index.js';

/**
 * Package version
 */
export const VERSION = '1.0.0';

/**
 * Protocol version
 */
export const PROTOCOL_VERSION = '1.0.0';
