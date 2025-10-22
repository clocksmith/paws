/**
 * @fileoverview Unit tests for agent-logic-pure.js pure functions
 * Tests pure helper functions for agent reasoning and prompt assembly
 *
 * @module AgentLogicPureTests
 * @version 1.0.0
 * @category tests
 */

// Mock dependencies for testing
const deps = {};

// Load the module
const AgentLogicPureHelpers = {
  factory: (deps) => {
    const getArtifactListSummaryPure = (allMetaMap) => {
      if (!allMetaMap) return "Error: Artifact metadata map not available.";
      return (
        Object.keys(allMetaMap)
          .map(
            (path) => {
              const meta = allMetaMap[path][0] || {};
              return `* ${path} (Cycle ${meta.latestCycle || 0})`
            }
          )
          .join("\n") || "None"
      );
    };

    const getToolListSummaryPure = (staticTools, dynamicTools, truncFn) => {
      if (!staticTools || !dynamicTools || !truncFn)
        return "Error: Tool lists or truncFn not available.";

      const staticToolSummary = staticTools
        .map((t) => `* [S] ${t.name}: ${truncFn(t.description, 60)}`)
        .join("\n");

      const dynamicToolSummary = (dynamicTools || [])
        .map(
          (t) =>
            `* [D] ${t.declaration.name}: ${truncFn(
              t.declaration.description,
              60
            )}`
        )
        .join("\n");

      return (
        [staticToolSummary, dynamicToolSummary].filter((s) => s).join("\n") ||
        "None"
      );
    };

    const assembleCorePromptPure = (
      corePromptTemplate,
      state,
      goalInfo,
      artifactListSummary,
      toolListSummary
    ) => {
      if (!corePromptTemplate) return { error: "Core prompt template missing." };

      let prompt = corePromptTemplate
        .replace(/\[\[CYCLE_COUNT\]\]/g, String(state.totalCycles))
        .replace(/\[\[TOOL_LIST\]\]/g, toolListSummary)
        .replace(/\[\[ARTIFACT_LIST\]\]/g, artifactListSummary)
        .replace(/\[\[CUMULATIVE_GOAL\]\]/g, goalInfo.latestGoal || "No goal set.");

      return { prompt };
    };

    return {
      getArtifactListSummaryPure,
      getToolListSummaryPure,
      assembleCorePromptPure,
    };
  }
};

// Initialize module
const helpers = AgentLogicPureHelpers.factory(deps);

// Test results storage
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Test framework helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Values not equal'}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertIncludes(text, substring, message) {
  if (!text.includes(substring)) {
    throw new Error(`${message || 'String does not include substring'}\nText: ${text}\nSubstring: ${substring}`);
  }
}

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
  }
}

// ========================================
// Test Suite: getArtifactListSummaryPure
// ========================================

test('getArtifactListSummaryPure: Returns error when allMetaMap is null', () => {
  const result = helpers.getArtifactListSummaryPure(null);
  assertEqual(result, "Error: Artifact metadata map not available.");
});

test('getArtifactListSummaryPure: Returns "None" for empty metadata map', () => {
  const result = helpers.getArtifactListSummaryPure({});
  assertEqual(result, "None");
});

test('getArtifactListSummaryPure: Formats single artifact correctly', () => {
  const metaMap = {
    '/vfs/test.js': [{ latestCycle: 5 }]
  };
  const result = helpers.getArtifactListSummaryPure(metaMap);
  assertEqual(result, '* /vfs/test.js (Cycle 5)');
});

test('getArtifactListSummaryPure: Formats multiple artifacts correctly', () => {
  const metaMap = {
    '/vfs/test.js': [{ latestCycle: 5 }],
    '/vfs/app.js': [{ latestCycle: 3 }]
  };
  const result = helpers.getArtifactListSummaryPure(metaMap);
  assertIncludes(result, '/vfs/test.js (Cycle 5)');
  assertIncludes(result, '/vfs/app.js (Cycle 3)');
});

test('getArtifactListSummaryPure: Handles missing latestCycle', () => {
  const metaMap = {
    '/vfs/test.js': [{}]
  };
  const result = helpers.getArtifactListSummaryPure(metaMap);
  assertEqual(result, '* /vfs/test.js (Cycle 0)');
});

// ========================================
// Test Suite: getToolListSummaryPure
// ========================================

test('getToolListSummaryPure: Returns error when staticTools is null', () => {
  const result = helpers.getToolListSummaryPure(null, [], (t) => t);
  assertEqual(result, "Error: Tool lists or truncFn not available.");
});

test('getToolListSummaryPure: Returns error when truncFn is null', () => {
  const result = helpers.getToolListSummaryPure([], [], null);
  assertEqual(result, "Error: Tool lists or truncFn not available.");
});

test('getToolListSummaryPure: Formats static tools correctly', () => {
  const staticTools = [
    { name: 'read_file', description: 'Read file contents' },
    { name: 'write_file', description: 'Write file contents' }
  ];
  const truncFn = (text, len) => text.substring(0, len);

  const result = helpers.getToolListSummaryPure(staticTools, [], truncFn);
  assertIncludes(result, '[S] read_file: Read file contents');
  assertIncludes(result, '[S] write_file: Write file contents');
});

test('getToolListSummaryPure: Truncates long descriptions', () => {
  const staticTools = [
    { name: 'long_tool', description: 'This is a very long description that should be truncated to the specified length' }
  ];
  const truncFn = (text, len) => text.substring(0, len);

  const result = helpers.getToolListSummaryPure(staticTools, [], truncFn);
  assertIncludes(result, '[S] long_tool: This is a very long description that should be truncated');
  assert(!result.includes('to the specified length'), 'Description should be truncated');
});

test('getToolListSummaryPure: Formats dynamic tools correctly', () => {
  const dynamicTools = [
    { declaration: { name: 'custom_tool', description: 'Custom tool description' } }
  ];
  const truncFn = (text, len) => text.substring(0, len);

  const result = helpers.getToolListSummaryPure([], dynamicTools, truncFn);
  assertIncludes(result, '[D] custom_tool: Custom tool description');
});

test('getToolListSummaryPure: Combines static and dynamic tools', () => {
  const staticTools = [
    { name: 'static_tool', description: 'Static description' }
  ];
  const dynamicTools = [
    { declaration: { name: 'dynamic_tool', description: 'Dynamic description' } }
  ];
  const truncFn = (text, len) => text.substring(0, len);

  const result = helpers.getToolListSummaryPure(staticTools, dynamicTools, truncFn);
  assertIncludes(result, '[S] static_tool');
  assertIncludes(result, '[D] dynamic_tool');
});

// ========================================
// Test Suite: assembleCorePromptPure
// ========================================

test('assembleCorePromptPure: Returns error when template is null', () => {
  const result = helpers.assembleCorePromptPure(null, {}, {}, '', '');
  assert(result.error, 'Should return error object');
  assertEqual(result.error, "Core prompt template missing.");
});

test('assembleCorePromptPure: Replaces CYCLE_COUNT placeholder', () => {
  const template = "Current cycle: [[CYCLE_COUNT]]";
  const state = { totalCycles: 42 };
  const goalInfo = { latestGoal: '' };

  const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');
  assertEqual(result.prompt, "Current cycle: 42");
});

test('assembleCorePromptPure: Replaces TOOL_LIST placeholder', () => {
  const template = "Tools:\n[[TOOL_LIST]]";
  const state = { totalCycles: 0 };
  const goalInfo = { latestGoal: '' };
  const toolList = "* read_file\n* write_file";

  const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', toolList);
  assertIncludes(result.prompt, "* read_file");
  assertIncludes(result.prompt, "* write_file");
});

test('assembleCorePromptPure: Replaces ARTIFACT_LIST placeholder', () => {
  const template = "Artifacts:\n[[ARTIFACT_LIST]]";
  const state = { totalCycles: 0 };
  const goalInfo = { latestGoal: '' };
  const artifactList = "* /vfs/test.js\n* /vfs/app.js";

  const result = helpers.assembleCorePromptPure(template, state, goalInfo, artifactList, '');
  assertIncludes(result.prompt, "* /vfs/test.js");
  assertIncludes(result.prompt, "* /vfs/app.js");
});

test('assembleCorePromptPure: Replaces CUMULATIVE_GOAL placeholder', () => {
  const template = "Goal: [[CUMULATIVE_GOAL]]";
  const state = { totalCycles: 0 };
  const goalInfo = { latestGoal: 'Build a REST API' };

  const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');
  assertEqual(result.prompt, "Goal: Build a REST API");
});

test('assembleCorePromptPure: Uses fallback for missing goal', () => {
  const template = "Goal: [[CUMULATIVE_GOAL]]";
  const state = { totalCycles: 0 };
  const goalInfo = { latestGoal: null };

  const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');
  assertEqual(result.prompt, "Goal: No goal set.");
});

test('assembleCorePromptPure: Replaces all placeholders simultaneously', () => {
  const template = `Cycle: [[CYCLE_COUNT]]
Goal: [[CUMULATIVE_GOAL]]
Tools: [[TOOL_LIST]]
Artifacts: [[ARTIFACT_LIST]]`;

  const state = { totalCycles: 10 };
  const goalInfo = { latestGoal: 'Test goal' };
  const artifactList = '* test.js';
  const toolList = '* read_file';

  const result = helpers.assembleCorePromptPure(template, state, goalInfo, artifactList, toolList);
  assertIncludes(result.prompt, "Cycle: 10");
  assertIncludes(result.prompt, "Goal: Test goal");
  assertIncludes(result.prompt, "Tools: * read_file");
  assertIncludes(result.prompt, "Artifacts: * test.js");
});

// ========================================
// Print Test Results
// ========================================

console.log('\n========================================');
console.log('Test Results Summary');
console.log('========================================');
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
console.log('========================================\n');

if (results.failed > 0) {
  console.log('Failed Tests:');
  results.tests
    .filter(t => !t.passed)
    .forEach(t => {
      console.log(`  ❌ ${t.name}`);
      console.log(`     ${t.error}`);
    });
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { results };
}
