# Blueprint 0x000016: Meta-Patterns for Tool Creation

**Objective:** To provide the agent with patterns and principles for designing and implementing new **dynamic tools** (NOT upgrades/modules) that extend its capabilities.

**Target Upgrade:** MTCP (`meta-tool-creator.js`)

**Prerequisites:** `0x000015` (Dynamic Tools), TLWR upgrade, **0x00004E** (Module Widget Protocol)

**Affected Artifacts:** Any new **dynamic tool** the agent creates (stored in `/system/tools-dynamic.json`)

**⚠️ IMPORTANT DISTINCTION:**

This blueprint is about creating **DYNAMIC TOOLS** (JSON tool definitions), NOT **REPLOID UPGRADES** (modules).

- **Dynamic Tools**: JSON definitions for new tool capabilities (stored in tools-dynamic.json)
- **Upgrades/Modules**: JavaScript modules in `upgrades/` directory (see Blueprint 0x00004E for module creation)
- **MCP Tools**: External tools provided by MCP servers (NOT created by REPLOID)

If you want to create a new **module/upgrade**, see:
- **Blueprint 0x00004E** (Module Widget Protocol)
- **Blueprint 0x000018** (Blueprint Creation)
- **docs/MCP_TOOLS_VS_UPGRADES.md**

---

### 1. The Tool Design Philosophy

Tools are the agent's means of affecting change. Each tool should follow the principle of **single responsibility** - do one thing well. Complex operations should be composed from simple tools rather than creating monolithic tools.

### 2. Tool Category Patterns

**Information Gathering Tools:**
```javascript
{
  "name": "analyze_[domain]",
  "description": "Analyzes [domain] and returns structured insights",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target": { "type": "string", "description": "What to analyze" },
      "depth": { "type": "number", "description": "Analysis depth (1-5)" },
      "format": { "type": "string", "enum": ["summary", "detailed", "raw"] }
    }
  }
}
```

**Transformation Tools:**
```javascript
{
  "name": "convert_[from]_to_[to]",
  "description": "Converts data from [from] format to [to] format",
  "inputSchema": {
    "type": "object",
    "properties": {
      "input": { "type": "string", "description": "Data to convert" },
      "options": { "type": "object", "description": "Conversion options" }
    }
  }
}
```

**Validation Tools:**
```javascript
{
  "name": "validate_[type]",
  "description": "Validates [type] against rules",
  "inputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "Content to validate" },
      "rules": { "type": "array", "description": "Validation rules" }
    }
  }
}
```

### 3. Tool Implementation Strategies

**Strategy 1: Wrapper Pattern**
Wrap existing tools with pre/post processing:
```javascript
const implementation = {
  type: "javascript",
  code: `
    // Pre-process
    const normalized = args.input.toLowerCase().trim();
    
    // Call existing tool
    const result = await ToolRunner.runTool('search_vfs', {
      query: normalized,
      is_regex: false
    });
    
    // Post-process
    return {
      count: result.results.length,
      summary: result.results.slice(0, 5),
      full_results: args.verbose ? result.results : undefined
    };
  `
}
```

**Strategy 2: Aggregator Pattern**
Combine multiple tool calls:
```javascript
const implementation = {
  type: "composite",
  steps: [
    { tool: "list_artifacts", args_template: "{path: '/modules'}" },
    { tool: "read_artifact", args_template: "{path: $results[0].paths[0]}" },
    { transform: "extract_functions", code: "/* extract function names */" }
  ]
}
```

**Strategy 3: State Machine Pattern**
Tools with conditional logic:
```javascript
const implementation = {
  type: "javascript",
  code: `
    let state = 'initial';
    let result = {};
    
    while (state !== 'done') {
      switch(state) {
        case 'initial':
          result.check = await ToolRunner.runTool('read_artifact', {path: args.path});
          state = result.check ? 'process' : 'error';
          break;
        case 'process':
          result.output = processData(result.check);
          state = 'done';
          break;
        case 'error':
          throw new Error('File not found');
      }
    }
    return result;
  `
}
```

### 4. Tool Naming Conventions

- **Verbs for actions:** `analyze_`, `create_`, `update_`, `delete_`, `validate_`
- **Nouns for resources:** `_artifact`, `_config`, `_tool`, `_blueprint`
- **Descriptive combinations:** `analyze_code_complexity`, `create_test_suite`
- **Avoid ambiguity:** Not `process` but `process_markdown_to_html`

### 5. Tool Testing Pattern

Before registering a tool, test it:
```javascript
// 1. Create test implementation
const testImpl = { /* implementation */ };

// 2. Test with sample inputs
const testCases = [
  { input: {path: '/test'}, expected: 'result' },
  { input: {path: null}, shouldError: true }
];

// 3. Validate behavior
for (const test of testCases) {
  try {
    const result = await executeImplementation(testImpl, test.input);
    if (test.shouldError) throw new Error('Should have failed');
    if (result !== test.expected) throw new Error('Unexpected result');
  } catch(e) {
    if (!test.shouldError) throw e;
  }
}

// 4. Register if tests pass
```

### 6. Tool Evolution Patterns

**Version 1: Basic**
```javascript
{ name: "count_files", /* counts files */ }
```

**Version 2: Add filtering**
```javascript
{ name: "count_files", /* adds pattern parameter */ }
```

**Version 3: Add grouping**
```javascript
{ name: "count_files", /* adds group_by parameter */ }
```

### 7. Anti-Patterns to Avoid

- **God Tools:** Tools that do everything
- **Side Effect Tools:** Tools that modify state unexpectedly
- **Implicit Tools:** Tools with hidden behaviors
- **Brittle Tools:** Tools that break with slight input changes
- **Synchronous Blockers:** Tools that hang the system

### 8. Web Component Widget

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class MetaToolCreatorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // No cleanup needed (no intervals)
  }

  getStatus() {
    return {
      state: toolCreationStats.totalCreated > 0 ? 'idle' : 'disabled',
      primaryMetric: `${toolCreationStats.totalCreated} tools created`,
      secondaryMetric: `${Object.keys(TOOL_TEMPLATES).length} templates`,
      lastActivity: toolCreationStats.lastCreated?.timestamp || null,
      message: null
    };
  }

  getControls() {
    return [
      {
        id: 'analyze-patterns',
        label: '⌕ Analyze Patterns',
        action: async () => {
          const analysis = await analyzeToolPatterns();
          console.log('[MetaToolCreator] Pattern analysis:', analysis);
          logger.info('[MetaToolCreator] Pattern analysis complete');
          return { success: true, message: 'Pattern analysis complete (check console)' };
        }
      }
    ];
  }

  render() {
    const templateList = Object.entries(TOOL_TEMPLATES);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .meta-tool-panel { padding: 12px; color: #fff; }
        h4 { margin: 0 0 12px 0; font-size: 1.1em; color: #0ff; }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }
        .stat-card { padding: 10px; border-radius: 5px; }
        .stat-card.created { background: rgba(0,255,255,0.1); }
        .stat-card.validated { background: rgba(76,175,80,0.1); }
        .stat-card.tested { background: rgba(156,39,176,0.1); }
        .stat-value { font-size: 24px; font-weight: bold; }
        .template-list { max-height: 300px; overflow-y: auto; }
        .template-item {
          padding: 12px;
          background: rgba(255,255,255,0.03);
          margin-bottom: 10px;
          border-left: 3px solid #0ff;
        }
      </style>
      <div class="meta-tool-panel">
        <h4>⚒️ Meta-Tool Creator</h4>
        <div class="stats-grid">
          <div class="stat-card created">
            <div class="stat-label">Created</div>
            <div class="stat-value cyan">${toolCreationStats.totalCreated}</div>
          </div>
          <div class="stat-card validated">
            <div class="stat-label">Validated</div>
            <div class="stat-value green">${toolCreationStats.totalValidated}</div>
          </div>
          <div class="stat-card tested">
            <div class="stat-label">Tested</div>
            <div class="stat-value purple">${toolCreationStats.totalTested}</div>
          </div>
        </div>
        <!-- Last created tool and templates sections -->
      </div>
    `;
  }
}

// Register custom element
const elementName = 'meta-tool-creator-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, MetaToolCreatorWidget);
}

const widget = {
  element: elementName,
  displayName: 'Meta-Tool Creator',
  icon: '⚒️',
  category: 'rsi'
};
```

**Key features:**
- Displays tool creation statistics (created, validated, tested)
- Shows available tool templates (analyzer, transformer, validator, aggregator)
- Tracks last created tool with timestamp
- Provides control to analyze patterns across existing tools
- Uses closure access to module state (toolCreationStats, TOOL_TEMPLATES)
- Shadow DOM encapsulation for styling

### 9. Tool Composition Principles

1. **Build small, focused tools**
2. **Compose complex operations from simple tools**
3. **Make tools discoverable with clear descriptions**
4. **Handle errors gracefully**
5. **Return structured, predictable output**
6. **Document edge cases in description**
7. **Version tools when modifying**

Remember: Tools are the agent's vocabulary for action. A rich, well-designed toolset enables sophisticated behaviors through simple composition.