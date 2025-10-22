/**
 * @mcp-wp/testing
 *
 * Testing utilities for MCP-WP widget development
 */

// Re-export everything from submodules
export * from './mocks.js';
export * from './fixtures.js';
export * from './helpers.js';
export * from './assertions.js';

// Main entry point for convenience
export {
  createMockDependencies,
  type MockDependencies,
} from './mocks.js';

export {
  mountWidget,
  waitForRender,
  waitForEvent,
  type MountedWidget,
  type MountOptions,
} from './helpers.js';

export {
  expectWidgetToRender,
  expectEventEmitted,
  expectToolCalled,
} from './assertions.js';
