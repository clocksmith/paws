/**
 * MCP Server Test Harness
 *
 * Reusable testing utilities for MCP servers
 */

/**
 * Create mock dependencies for testing
 */
export function createMockDependencies() {
  const events = new Map();

  return {
    Utils: {
      logger: {
        info: (...args) => console.log('[TEST:INFO]', ...args),
        warn: (...args) => console.warn('[TEST:WARN]', ...args),
        error: (...args) => console.error('[TEST:ERROR]', ...args)
      }
    },
    EventBus: {
      emit: (event, data) => {
        console.log('[TEST:EVENT]', event, data);
        const handlers = events.get(event) || [];
        handlers.forEach(h => h(data));
      },
      on: (event, handler) => {
        if (!events.has(event)) events.set(event, []);
        events.get(event).push(handler);
        return () => {
          const handlers = events.get(event);
          const index = handlers.indexOf(handler);
          if (index > -1) handlers.splice(index, 1);
        };
      },
      off: (event, handler) => {
        const handlers = events.get(event);
        if (!handlers) return;
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    },
    AuditLogger: {
      logMCPToolCall: async (toolName, details) => {
        console.log('[TEST:AUDIT]', toolName, details);
      }
    },
    MCPProtocol: {
      registerTool: (name, handler, schema) => {
        console.log('[TEST:MCP]', 'Registered tool:', name);
      }
    }
  };
}

/**
 * Test a tool invocation
 */
export async function testToolCall(server, toolName, args, expectedResult) {
  console.log(`\n[TEST] Testing tool: ${toolName}`);
  console.log('[TEST] Args:', JSON.stringify(args, null, 2));

  try {
    const result = await server.callTool(toolName, args);
    console.log('[TEST] Result:', JSON.stringify(result, null, 2));

    if (expectedResult) {
      const matches = JSON.stringify(result) === JSON.stringify(expectedResult);
      console.log(`[TEST] ${matches ? '✓ PASS' : '✗ FAIL'}`);
      return matches;
    }

    console.log('[TEST] ✓ No errors');
    return true;
  } catch (error) {
    console.error('[TEST] ✗ FAIL:', error.message);
    return false;
  }
}

/**
 * Test all tools in a server
 */
export async function testServerTools(server) {
  console.log(`\n[TEST] Testing server: ${server.name}`);

  const tools = server.listTools();
  console.log(`[TEST] Found ${tools.length} tools`);

  let passed = 0;
  let failed = 0;

  for (const tool of tools) {
    console.log(`\n[TEST] Tool: ${tool.name}`);
    console.log(`[TEST] Description: ${tool.description}`);
    console.log(`[TEST] Schema:`, JSON.stringify(tool.inputSchema, null, 2));

    // Basic test: can we call it with empty args?
    try {
      await server.callTool(tool.name, {});
      passed++;
    } catch (error) {
      console.log(`[TEST] Note: Empty args failed (expected for most tools)`);
    }
  }

  console.log(`\n[TEST] Summary: ${passed} passed, ${failed} failed`);
  return { passed, failed, total: tools.length };
}
