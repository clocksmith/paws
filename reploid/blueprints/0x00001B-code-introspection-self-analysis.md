# Blueprint 0x00001B: Code Introspection & Self-Analysis

**Objective:** To enable the agent to analyze its own source code, dependencies, architecture, and complexity metrics for intelligent self-improvement.

**Target Upgrade:** INTR (introspector.js)

**Prerequisites:** UTIL (utils.js), STMT (state-manager.js), TLRD (tools-read.json)

**Affected Artifacts:** `/upgrades/introspector.js`, `/upgrades/agent-cycle.js`

---

### 1. The Strategic Imperative

**An agent cannot improve what it doesn't understand.**

For true Recursive Self-Improvement (RSI), the agent must possess the ability to:

- 📊 **Analyze its own code complexity** - Identify functions that need refactoring
- 🔍 **Map its dependency graph** - Understand which modules depend on which
- 📈 **Measure performance metrics** - Find bottlenecks in its own execution
- 🧬 **Parse its own AST** - Understand code structure at a deep level
- 🗺️ **Visualize its architecture** - See the big picture of how it's built

Without introspection, the agent is **blind to its own design**. It can modify code, but it cannot make *intelligent* modifications because it lacks self-awareness.

**Introspection is the foundation of meta-cognition.**

---

### 2. The Architectural Solution

The `/upgrades/introspector.js` module provides a comprehensive self-analysis toolkit. It exposes methods that allow the agent to examine its own codebase as data:

```javascript
const Introspector = {
  metadata: {
    id: 'Introspector',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, Utils } = deps;

    return {
      // Analyze a single module
      analyzeModule: async (modulePath) => { /* ... */ },

      // Get full dependency graph
      getDependencyGraph: async () => { /* ... */ },

      // Calculate complexity metrics
      getComplexityMetrics: async (modulePath) => { /* ... */ },

      // Parse JavaScript AST
      parseAST: async (code) => { /* ... */ },

      // Find all modules matching criteria
      findModules: async (filter) => { /* ... */ },

      // Get module metadata
      getModuleMetadata: async (modulePath) => { /* ... */ }
    };
  }
};
```

**Key Capabilities:**

### 2.1 Module Analysis

Analyzes a single module file to extract:

```javascript
await Introspector.analyzeModule('/vfs/upgrades/state-manager.js');

// Returns:
{
  "path": "/vfs/upgrades/state-manager.js",
  "id": "STMT",
  "description": "State management and VFS logic",
  "category": "core",
  "lines_of_code": 450,
  "functions": [
    {
      "name": "getArtifactContent",
      "async": true,
      "parameters": ["path"],
      "complexity": 3
    },
    {
      "name": "updateArtifact",
      "async": true,
      "parameters": ["path", "content"],
      "complexity": 5
    }
  ],
  "dependencies": ["Storage", "Utils", "EventBus"],
  "exports": ["StateManager"],
  "complexity_score": 8.2,
  "test_coverage": 0.87,
  "last_modified": 1728000000000
}
```

### 2.2 Dependency Graph

Maps the entire module dependency tree:

```javascript
await Introspector.getDependencyGraph();

// Returns:
{
  "nodes": [
    { "id": "APPL", "label": "app-logic.js", "category": "core" },
    { "id": "STMT", "label": "state-manager.js", "category": "core" },
    { "id": "UTIL", "label": "utils.js", "category": "core" },
    { "id": "CYCL", "label": "agent-cycle.js", "category": "agent" }
  ],
  "edges": [
    { "from": "APPL", "to": "STMT" },
    { "from": "APPL", "to": "UTIL" },
    { "from": "STMT", "to": "UTIL" },
    { "from": "CYCL", "to": "STMT" },
    { "from": "CYCL", "to": "UTIL" }
  ],
  "circular_dependencies": [],
  "orphaned_modules": [],
  "depth_map": {
    "UTIL": 0,
    "STMT": 1,
    "APPL": 2,
    "CYCL": 2
  }
}
```

### 2.3 Complexity Metrics

Calculates cyclomatic complexity, cognitive complexity, and maintainability index:

```javascript
await Introspector.getComplexityMetrics('/vfs/upgrades/agent-cycle.js');

// Returns:
{
  "cyclomatic_complexity": 12,
  "cognitive_complexity": 18,
  "maintainability_index": 65,
  "halstead_metrics": {
    "volume": 2450,
    "difficulty": 28,
    "effort": 68600
  },
  "functions": [
    {
      "name": "executeCycle",
      "cyclomatic": 8,
      "cognitive": 12,
      "recommendation": "Consider breaking into smaller functions"
    }
  ]
}
```

### 2.4 AST Parsing

Parses JavaScript into Abstract Syntax Tree for deep analysis:

```javascript
const code = await StateManager.getArtifactContent('/vfs/upgrades/utils.js');
const ast = await Introspector.parseAST(code);

// Returns Acorn AST:
{
  "type": "Program",
  "body": [
    {
      "type": "VariableDeclaration",
      "declarations": [...]
    },
    {
      "type": "FunctionDeclaration",
      "id": { "name": "logger" },
      "params": [],
      "body": { ... }
    }
  ]
}
```

---

### 3. The Implementation Pathway

#### Step 1: Create the Introspector Module

Create `/upgrades/introspector.js` with basic structure:

```javascript
const Introspector = {
  metadata: {
    id: 'Introspector',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, Utils } = deps;
    const { logger } = Utils;

    // Helper: Parse module metadata from code
    const extractMetadata = (code) => {
      // Look for metadata object
      const metadataMatch = code.match(/metadata:\s*{([^}]+)}/);
      if (!metadataMatch) return null;

      // Parse ID, dependencies, etc.
      const idMatch = code.match(/id:\s*['"]([^'"]+)['"]/);
      const depsMatch = code.match(/dependencies:\s*\[([^\]]+)\]/);

      return {
        id: idMatch ? idMatch[1] : null,
        dependencies: depsMatch
          ? depsMatch[1].split(',').map(d => d.trim().replace(/['"]/g, ''))
          : []
      };
    };

    // Helper: Count lines of code (excluding comments/blanks)
    const countLOC = (code) => {
      return code
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('//');
        })
        .length;
    };

    // Helper: Calculate cyclomatic complexity
    const calculateComplexity = (code) => {
      // Simple heuristic: count decision points
      const ifCount = (code.match(/\bif\s*\(/g) || []).length;
      const forCount = (code.match(/\bfor\s*\(/g) || []).length;
      const whileCount = (code.match(/\bwhile\s*\(/g) || []).length;
      const caseCount = (code.match(/\bcase\s+/g) || []).length;
      const ternaryCount = (code.match(/\?/g) || []).length;

      return 1 + ifCount + forCount + whileCount + caseCount + ternaryCount;
    };

    return {
      // Analyze a single module
      analyzeModule: async (modulePath) => {
        logger.info(`[Introspector] Analyzing ${modulePath}`);

        const code = await StateManager.getArtifactContent(modulePath);
        if (!code) {
          throw new Error(`Module not found: ${modulePath}`);
        }

        const metadata = extractMetadata(code);
        const loc = countLOC(code);
        const complexity = calculateComplexity(code);

        return {
          path: modulePath,
          id: metadata?.id || 'unknown',
          dependencies: metadata?.dependencies || [],
          lines_of_code: loc,
          complexity_score: complexity,
          analyzed_at: Date.now()
        };
      },

      // Get full dependency graph
      getDependencyGraph: async () => {
        logger.info('[Introspector] Building dependency graph');

        const allModules = await StateManager.listArtifacts('/vfs/upgrades');
        const nodes = [];
        const edges = [];

        for (const modulePath of allModules) {
          if (!modulePath.endsWith('.js')) continue;

          const analysis = await analyzeModule(modulePath);
          nodes.push({
            id: analysis.id,
            label: modulePath.split('/').pop(),
            path: modulePath
          });

          for (const dep of analysis.dependencies) {
            edges.push({
              from: analysis.id,
              to: dep
            });
          }
        }

        return { nodes, edges };
      },

      // Calculate complexity metrics
      getComplexityMetrics: async (modulePath) => {
        const analysis = await analyzeModule(modulePath);
        return {
          cyclomatic_complexity: analysis.complexity_score,
          maintainability_index: Math.max(0, 100 - analysis.complexity_score * 2),
          recommendation:
            analysis.complexity_score > 20
              ? 'High complexity - consider refactoring'
              : analysis.complexity_score > 10
              ? 'Moderate complexity - monitor for growth'
              : 'Low complexity - well-structured'
        };
      },

      // Parse AST using Acorn (if available)
      parseAST: async (code) => {
        if (typeof acorn === 'undefined') {
          logger.warn('[Introspector] Acorn not loaded, cannot parse AST');
          return null;
        }

        try {
          return acorn.parse(code, {
            ecmaVersion: 2020,
            sourceType: 'module'
          });
        } catch (error) {
          logger.error('[Introspector] Failed to parse AST:', error);
          return null;
        }
      }
    };
  }
};
```

#### Step 2: Integrate with Agent Cycle

The agent can now introspect before making changes:

```javascript
// In agent-cycle.js, before proposing modifications:

async function planSelfImprovement() {
  // Analyze current architecture
  const graph = await Introspector.getDependencyGraph();

  // Find high-complexity modules
  const complexModules = [];
  for (const node of graph.nodes) {
    const metrics = await Introspector.getComplexityMetrics(node.path);
    if (metrics.cyclomatic_complexity > 15) {
      complexModules.push({ path: node.path, complexity: metrics });
    }
  }

  // Propose refactoring if complexity is high
  if (complexModules.length > 0) {
    logger.info('[Agent] Found complex modules:', complexModules);
    // Generate proposal to refactor...
  }
}
```

---

### 4. Self-Improvement Opportunities

With introspection, the agent can:

#### 4.1 Auto-Refactoring

```javascript
// Agent analyzes its own code and proposes refactoring
const analysis = await Introspector.analyzeModule('/vfs/upgrades/agent-cycle.js');

if (analysis.complexity_score > 20) {
  // Generate proposal to split into smaller functions
  await ToolRunner.execute('modify_artifact', {
    path: '/vfs/upgrades/agent-cycle.js',
    new_content: refactoredCode,
    reason: `Reducing complexity from ${analysis.complexity_score} to ~10`
  });
}
```

#### 4.2 Dependency Optimization

```javascript
// Find circular dependencies
const graph = await Introspector.getDependencyGraph();

for (const edge of graph.edges) {
  const reverseExists = graph.edges.some(
    e => e.from === edge.to && e.to === edge.from
  );
  if (reverseExists) {
    logger.warn(`[Introspector] Circular dependency: ${edge.from} ↔ ${edge.to}`);
    // Propose architectural change to break cycle
  }
}
```

#### 4.3 Performance Profiling

```javascript
// Find slow functions and optimize them
const metrics = await Introspector.getComplexityMetrics('/vfs/upgrades/state-manager.js');

// Halstead effort is high → function is computationally expensive
if (metrics.halstead_metrics.effort > 100000) {
  // Suggest memoization or caching
  logger.info('[Introspector] Suggest adding memoization to reduce effort');
}
```

#### 4.4 Self-Documentation

```javascript
// Generate module documentation from introspection
const analysis = await Introspector.analyzeModule('/vfs/upgrades/introspector.js');

const docContent = `
# Introspector Module

**Lines of Code:** ${analysis.lines_of_code}
**Complexity:** ${analysis.complexity_score}
**Dependencies:** ${analysis.dependencies.join(', ')}

This module enables self-analysis of the REPLOID codebase.
`;

await ToolRunner.execute('create_artifact', {
  path: '/vfs/docs/modules/introspector.md',
  content: docContent,
  reason: 'Auto-generated documentation from introspection'
});
```

---

### 5. Integration with Other RSI Modules

| Module | Integration | Purpose |
|--------|-------------|---------|
| **REFL** | Save analysis results | Learn from complexity trends over time |
| **TEST** | Identify untested code | Suggest test cases for high-complexity functions |
| **PMON** | Correlate metrics | Link complexity to performance bottlenecks |
| **MGRV** | Visualize graph | Display dependency graph in UI |
| **TLWR** | Apply refactorings | Modify code based on introspection insights |
| **BLPR** | Document patterns | Create blueprints for successful refactorings |

---

### 6. Testing & Validation

```javascript
// Test introspection on known module
const analysis = await Introspector.analyzeModule('/vfs/upgrades/utils.js');

assert(analysis.id === 'UTIL');
assert(analysis.dependencies.length === 0); // utils has no dependencies
assert(analysis.complexity_score > 0);
assert(analysis.lines_of_code > 50);
```

---

### 7. Conclusion

**Introspection is the mirror the agent holds up to itself.**

Without it, RSI is blind trial-and-error. With it, RSI becomes intelligent, targeted self-improvement.

The agent can:
- 🔍 **See its own structure**
- 📊 **Measure its own quality**
- 🎯 **Identify improvement opportunities**
- 📚 **Document its own evolution**

**An agent that knows itself can improve itself.**

---

**Related Blueprints:**
- 0x000022 (Write Tools) - Apply modifications based on introspection
- 0x00001C (Reflection Storage) - Persist learnings from introspection
- 0x00001D (Self-Testing) - Validate introspection-driven changes
- 0x000021 (Performance Monitoring) - Runtime metrics complement static analysis
