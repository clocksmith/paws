import { describe, it, expect, beforeEach } from 'vitest';

// Mock the module structure
const AgentLogicPureHelpers = {
  metadata: {
    id: 'AgentLogicPureHelpers',
    version: '1.0.0',
    dependencies: [],
    async: false,
    type: 'pure'
  },

  factory: (deps = {}) => {
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

describe('AgentLogicPureHelpers Module', () => {
  let helpers;

  beforeEach(() => {
    helpers = AgentLogicPureHelpers.factory({});
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(AgentLogicPureHelpers.metadata.id).toBe('AgentLogicPureHelpers');
      expect(AgentLogicPureHelpers.metadata.version).toBe('1.0.0');
      expect(AgentLogicPureHelpers.metadata.type).toBe('pure');
    });

    it('should have no dependencies', () => {
      expect(AgentLogicPureHelpers.metadata.dependencies).toEqual([]);
    });

    it('should be synchronous', () => {
      expect(AgentLogicPureHelpers.metadata.async).toBe(false);
    });
  });

  describe('getArtifactListSummaryPure', () => {
    it('should generate summary for artifacts', () => {
      const allMetaMap = {
        '/file1.txt': [{ latestCycle: 5 }],
        '/file2.js': [{ latestCycle: 10 }],
        '/dir/file3.md': [{ latestCycle: 3 }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('* /file1.txt (Cycle 5)');
      expect(summary).toContain('* /file2.js (Cycle 10)');
      expect(summary).toContain('* /dir/file3.md (Cycle 3)');
    });

    it('should handle artifacts with no cycle info', () => {
      const allMetaMap = {
        '/file1.txt': [{}],
        '/file2.js': [{ latestCycle: undefined }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('* /file1.txt (Cycle 0)');
      expect(summary).toContain('* /file2.js (Cycle 0)');
    });

    it('should handle empty artifact map', () => {
      const allMetaMap = {};

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toBe('None');
    });

    it('should handle null/undefined input', () => {
      const summary1 = helpers.getArtifactListSummaryPure(null);
      const summary2 = helpers.getArtifactListSummaryPure(undefined);

      expect(summary1).toBe('Error: Artifact metadata map not available.');
      expect(summary2).toBe('Error: Artifact metadata map not available.');
    });

    it('should handle artifacts with empty metadata array', () => {
      const allMetaMap = {
        '/file1.txt': []
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('* /file1.txt (Cycle 0)');
    });

    it('should preserve artifact path order', () => {
      const allMetaMap = {
        '/a.txt': [{ latestCycle: 1 }],
        '/b.txt': [{ latestCycle: 2 }],
        '/c.txt': [{ latestCycle: 3 }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);
      const lines = summary.split('\n');

      expect(lines).toHaveLength(3);
    });
  });

  describe('getToolListSummaryPure', () => {
    const mockTruncFn = (str, len) => str.length > len ? str.substring(0, len) + '...' : str;

    it('should generate summary for static tools', () => {
      const staticTools = [
        { name: 'tool1', description: 'First tool description' },
        { name: 'tool2', description: 'Second tool description' }
      ];
      const dynamicTools = [];

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);

      expect(summary).toContain('* [S] tool1: First tool description');
      expect(summary).toContain('* [S] tool2: Second tool description');
    });

    it('should generate summary for dynamic tools', () => {
      const staticTools = [];
      const dynamicTools = [
        {
          declaration: {
            name: 'dyn1',
            description: 'Dynamic tool 1'
          }
        }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);

      expect(summary).toContain('* [D] dyn1: Dynamic tool 1');
    });

    it('should truncate long descriptions', () => {
      const staticTools = [
        { name: 'tool1', description: 'A'.repeat(100) }
      ];
      const dynamicTools = [];

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);

      expect(summary).toContain('...');
      expect(summary).not.toContain('A'.repeat(100));
    });

    it('should combine static and dynamic tools', () => {
      const staticTools = [
        { name: 'static1', description: 'Static tool' }
      ];
      const dynamicTools = [
        {
          declaration: {
            name: 'dynamic1',
            description: 'Dynamic tool'
          }
        }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);

      expect(summary).toContain('[S] static1');
      expect(summary).toContain('[D] dynamic1');
    });

    it('should handle empty tool lists', () => {
      const staticTools = [];
      const dynamicTools = [];

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);

      expect(summary).toBe('None');
    });

    it('should handle missing parameters', () => {
      const summary1 = helpers.getToolListSummaryPure(null, [], mockTruncFn);
      const summary2 = helpers.getToolListSummaryPure([], null, mockTruncFn);
      const summary3 = helpers.getToolListSummaryPure([], [], null);

      expect(summary1).toBe('Error: Tool lists or truncFn not available.');
      expect(summary2).toBe('Error: Tool lists or truncFn not available.');
      expect(summary3).toBe('Error: Tool lists or truncFn not available.');
    });

    it('should handle null dynamic tools array', () => {
      const staticTools = [
        { name: 'tool1', description: 'Test tool' }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, null, mockTruncFn);

      // Should handle null gracefully but still require the parameter
      expect(summary).toBe('Error: Tool lists or truncFn not available.');
    });

    it('should format each tool on separate line', () => {
      const staticTools = [
        { name: 'tool1', description: 'First' },
        { name: 'tool2', description: 'Second' }
      ];
      const dynamicTools = [];

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);
      const lines = summary.split('\n');

      expect(lines).toHaveLength(2);
    });
  });

  describe('assembleCorePromptPure', () => {
    it('should assemble complete prompt', () => {
      const template = `
Cycle: [[CYCLE_COUNT]]
Goal: [[CUMULATIVE_GOAL]]
Tools: [[TOOL_LIST]]
Artifacts: [[ARTIFACT_LIST]]
`;
      const state = { totalCycles: 42 };
      const goalInfo = { latestGoal: 'Build something' };
      const artifactListSummary = '* file1.txt\n* file2.js';
      const toolListSummary = '* tool1\n* tool2';

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        artifactListSummary,
        toolListSummary
      );

      expect(result.prompt).toContain('Cycle: 42');
      expect(result.prompt).toContain('Goal: Build something');
      expect(result.prompt).toContain('Tools: * tool1\n* tool2');
      expect(result.prompt).toContain('Artifacts: * file1.txt\n* file2.js');
    });

    it('should replace all occurrences of placeholders', () => {
      const template = '[[CYCLE_COUNT]] - [[CYCLE_COUNT]] - [[CYCLE_COUNT]]';
      const state = { totalCycles: 5 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        'artifacts',
        'tools'
      );

      expect(result.prompt).toBe('5 - 5 - 5');
    });

    it('should handle missing goal', () => {
      const template = 'Goal: [[CUMULATIVE_GOAL]]';
      const state = { totalCycles: 1 };
      const goalInfo = {};

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        '',
        ''
      );

      expect(result.prompt).toContain('Goal: No goal set.');
    });

    it('should handle missing template', () => {
      const result = helpers.assembleCorePromptPure(
        null,
        { totalCycles: 1 },
        { latestGoal: 'Test' },
        '',
        ''
      );

      expect(result).toEqual({ error: 'Core prompt template missing.' });
    });

    it('should handle empty template', () => {
      const result = helpers.assembleCorePromptPure(
        '',
        { totalCycles: 1 },
        { latestGoal: 'Test' },
        'artifacts',
        'tools'
      );

      expect(result).toEqual({ error: 'Core prompt template missing.' });
    });

    it('should convert cycle count to string', () => {
      const template = 'Cycle: [[CYCLE_COUNT]]';
      const state = { totalCycles: 0 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        '',
        ''
      );

      expect(result.prompt).toBe('Cycle: 0');
    });

    it('should preserve template structure', () => {
      const template = `Line 1: [[CYCLE_COUNT]]
Line 2: [[CUMULATIVE_GOAL]]
Line 3: Text`;
      const state = { totalCycles: 10 };
      const goalInfo = { latestGoal: 'Goal text' };

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        '',
        ''
      );

      const lines = result.prompt.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1: 10');
      expect(lines[1]).toBe('Line 2: Goal text');
      expect(lines[2]).toBe('Line 3: Text');
    });

    it('should handle template with no placeholders', () => {
      const template = 'Static text with no placeholders';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        'artifacts',
        'tools'
      );

      expect(result.prompt).toBe('Static text with no placeholders');
    });

    it('should handle multiline summaries', () => {
      const template = 'Artifacts:\n[[ARTIFACT_LIST]]';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Test' };
      const artifactSummary = '* file1.txt\n* file2.js\n* file3.md';

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        artifactSummary,
        ''
      );

      expect(result.prompt).toContain('* file1.txt\n* file2.js\n* file3.md');
    });
  });

  describe('Pure Function Properties', () => {
    it('should not mutate input objects', () => {
      const allMetaMap = {
        '/file.txt': [{ latestCycle: 5 }]
      };
      const originalKeys = Object.keys(allMetaMap);

      helpers.getArtifactListSummaryPure(allMetaMap);

      expect(Object.keys(allMetaMap)).toEqual(originalKeys);
      expect(allMetaMap['/file.txt'][0].latestCycle).toBe(5);
    });

    it('should return same result for same inputs', () => {
      const allMetaMap = {
        '/file.txt': [{ latestCycle: 5 }]
      };

      const result1 = helpers.getArtifactListSummaryPure(allMetaMap);
      const result2 = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(result1).toBe(result2);
    });

    it('should be side-effect free', () => {
      const template = '[[CYCLE_COUNT]]';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Test' };

      helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      // State should not be modified
      expect(state.totalCycles).toBe(1);
      expect(goalInfo.latestGoal).toBe('Test');
    });
  });

  describe('Boundary Conditions - getArtifactListSummaryPure', () => {
    it('should handle very large artifact maps', () => {
      const allMetaMap = {};
      for (let i = 0; i < 1000; i++) {
        allMetaMap[`/file${i}.txt`] = [{ latestCycle: i }];
      }

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('file0.txt');
      expect(summary).toContain('file999.txt');
    });

    it('should handle artifacts with special characters in paths', () => {
      const allMetaMap = {
        '/path with spaces/file.txt': [{ latestCycle: 1 }],
        '/path/with/unicode/文件.txt': [{ latestCycle: 2 }],
        '/path/with-dashes-and_underscores.txt': [{ latestCycle: 3 }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('path with spaces');
      expect(summary).toContain('文件.txt');
      expect(summary).toContain('dashes-and_underscores');
    });

    it('should handle negative cycle numbers', () => {
      const allMetaMap = {
        '/file.txt': [{ latestCycle: -1 }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('Cycle -1');
    });

    it('should handle zero cycle number', () => {
      const allMetaMap = {
        '/file.txt': [{ latestCycle: 0 }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('Cycle 0');
    });

    it('should handle very large cycle numbers', () => {
      const allMetaMap = {
        '/file.txt': [{ latestCycle: 999999 }]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('Cycle 999999');
    });

    it('should handle artifacts with null metadata', () => {
      const allMetaMap = {
        '/file.txt': [null]
      };

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      expect(summary).toContain('Cycle 0');
    });
  });

  describe('Boundary Conditions - getToolListSummaryPure', () => {
    const mockTruncFn = (str, len) => str.length > len ? str.substring(0, len) + '...' : str;

    it('should handle very long tool names', () => {
      const staticTools = [
        { name: 'A'.repeat(200), description: 'Test' }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);

      expect(summary).toBeDefined();
    });

    it('should handle tools with empty descriptions', () => {
      const staticTools = [
        { name: 'tool1', description: '' }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);

      expect(summary).toContain('tool1:');
    });

    it('should handle tools with special characters in names', () => {
      const staticTools = [
        { name: 'tool-with-dashes', description: 'Test' },
        { name: 'tool_with_underscores', description: 'Test' },
        { name: 'tool.with.dots', description: 'Test' }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);

      expect(summary).toContain('tool-with-dashes');
      expect(summary).toContain('tool_with_underscores');
      expect(summary).toContain('tool.with.dots');
    });

    it('should handle very large tool lists', () => {
      const staticTools = [];
      for (let i = 0; i < 500; i++) {
        staticTools.push({ name: `tool${i}`, description: `Description ${i}` });
      }

      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);

      expect(summary).toContain('tool0');
      expect(summary).toContain('tool499');
    });

    it('should handle mixed static and dynamic tool lists', () => {
      const staticTools = Array.from({ length: 50 }, (_, i) => ({
        name: `static${i}`,
        description: `Static tool ${i}`
      }));

      const dynamicTools = Array.from({ length: 50 }, (_, i) => ({
        declaration: {
          name: `dynamic${i}`,
          description: `Dynamic tool ${i}`
        }
      }));

      const summary = helpers.getToolListSummaryPure(staticTools, dynamicTools, mockTruncFn);

      expect(summary).toContain('[S] static0');
      expect(summary).toContain('[D] dynamic0');
    });

    it('should handle tools with multiline descriptions', () => {
      const staticTools = [
        { name: 'tool1', description: 'Line 1\nLine 2\nLine 3' }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);

      expect(summary).toContain('tool1');
    });

    it('should handle tools with unicode in descriptions', () => {
      const staticTools = [
        { name: 'tool1', description: 'Tool with emoji 🎉 and unicode ñ' }
      ];

      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);

      expect(summary).toContain('tool1');
    });
  });

  describe('Boundary Conditions - assembleCorePromptPure', () => {
    it('should handle very large templates', () => {
      const template = 'A'.repeat(10000) + '[[CYCLE_COUNT]]' + 'B'.repeat(10000);
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toContain('1');
    });

    it('should handle templates with multiple same placeholders', () => {
      const template = '[[CYCLE_COUNT]] [[CYCLE_COUNT]] [[CYCLE_COUNT]]';
      const state = { totalCycles: 42 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toBe('42 42 42');
    });

    it('should handle cycle count of zero', () => {
      const template = '[[CYCLE_COUNT]]';
      const state = { totalCycles: 0 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toBe('0');
    });

    it('should handle negative cycle count', () => {
      const template = '[[CYCLE_COUNT]]';
      const state = { totalCycles: -5 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toBe('-5');
    });

    it('should handle very long goals', () => {
      const template = '[[CUMULATIVE_GOAL]]';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'A'.repeat(10000) };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toHaveLength(10000);
    });

    it('should handle goals with special characters', () => {
      const template = '[[CUMULATIVE_GOAL]]';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Goal with "quotes" and \'apostrophes\' and \n newlines' };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toBe('Goal with "quotes" and \'apostrophes\' and \n newlines');
    });

    it('should handle empty artifact and tool lists', () => {
      const template = 'Tools: [[TOOL_LIST]]\nArtifacts: [[ARTIFACT_LIST]]';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Test' };

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toBe('Tools: \nArtifacts: ');
    });

    it('should handle very large artifact and tool lists', () => {
      const template = '[[ARTIFACT_LIST]] [[TOOL_LIST]]';
      const state = { totalCycles: 1 };
      const goalInfo = { latestGoal: 'Test' };
      const largeArtifactList = 'A'.repeat(50000);
      const largeToolList = 'B'.repeat(50000);

      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        largeArtifactList,
        largeToolList
      );

      expect(result.prompt.length).toBeGreaterThan(100000);
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle getArtifactListSummaryPure with array instead of object', () => {
      const allMetaMap = ['not', 'an', 'object'];

      const summary = helpers.getArtifactListSummaryPure(allMetaMap);

      // Array has numeric keys, should still work
      expect(typeof summary).toBe('string');
    });

    it('should handle getToolListSummaryPure with undefined truncFn', () => {
      const staticTools = [{ name: 'tool1', description: 'Test' }];

      const summary = helpers.getToolListSummaryPure(staticTools, [], undefined);

      expect(summary).toBe('Error: Tool lists or truncFn not available.');
    });

    it('should handle assembleCorePromptPure with missing state fields', () => {
      const template = '[[CYCLE_COUNT]]';
      const state = {};
      const goalInfo = {};

      const result = helpers.assembleCorePromptPure(template, state, goalInfo, '', '');

      expect(result.prompt).toContain('undefined');
    });

    it('should handle assembleCorePromptPure with null state', () => {
      const template = '[[CYCLE_COUNT]]';
      const state = null;
      const goalInfo = { latestGoal: 'Test' };

      expect(() => {
        helpers.assembleCorePromptPure(template, state, goalInfo, '', '');
      }).toThrow();
    });
  });

  describe('Consistency and Idempotency', () => {
    it('should produce consistent output for same artifact map', () => {
      const allMetaMap = {
        '/file1.txt': [{ latestCycle: 1 }],
        '/file2.txt': [{ latestCycle: 2 }]
      };

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(helpers.getArtifactListSummaryPure(allMetaMap));
      }

      expect(new Set(results).size).toBe(1);
    });

    it('should produce consistent output for same tool lists', () => {
      const mockTruncFn = (str, len) => str.substring(0, len);
      const staticTools = [
        { name: 'tool1', description: 'First tool' },
        { name: 'tool2', description: 'Second tool' }
      ];

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(helpers.getToolListSummaryPure(staticTools, [], mockTruncFn));
      }

      expect(new Set(results).size).toBe(1);
    });

    it('should produce consistent output for same prompt assembly', () => {
      const template = '[[CYCLE_COUNT]] [[CUMULATIVE_GOAL]]';
      const state = { totalCycles: 5 };
      const goalInfo = { latestGoal: 'Test goal' };

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(helpers.assembleCorePromptPure(template, state, goalInfo, '', '').prompt);
      }

      expect(new Set(results).size).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large artifact maps efficiently', () => {
      const allMetaMap = {};
      for (let i = 0; i < 10000; i++) {
        allMetaMap[`/file${i}.txt`] = [{ latestCycle: i }];
      }

      const start = Date.now();
      const summary = helpers.getArtifactListSummaryPure(allMetaMap);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(summary).toBeDefined();
    });

    it('should handle large tool lists efficiently', () => {
      const mockTruncFn = (str, len) => str.substring(0, len);
      const staticTools = Array.from({ length: 5000 }, (_, i) => ({
        name: `tool${i}`,
        description: `Description for tool ${i}`
      }));

      const start = Date.now();
      const summary = helpers.getToolListSummaryPure(staticTools, [], mockTruncFn);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(summary).toBeDefined();
    });

    it('should handle large prompt assembly efficiently', () => {
      const template = '[[CYCLE_COUNT]]\n[[CUMULATIVE_GOAL]]\n[[ARTIFACT_LIST]]\n[[TOOL_LIST]]';
      const state = { totalCycles: 999 };
      const goalInfo = { latestGoal: 'A'.repeat(1000) };
      const artifactList = 'B'.repeat(10000);
      const toolList = 'C'.repeat(10000);

      const start = Date.now();
      const result = helpers.assembleCorePromptPure(
        template,
        state,
        goalInfo,
        artifactList,
        toolList
      );
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.prompt).toBeDefined();
    });
  });
});
