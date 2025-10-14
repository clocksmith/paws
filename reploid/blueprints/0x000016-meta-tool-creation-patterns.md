# Blueprint 0x000016: Meta-Patterns for Tool Creation

**Objective:** To provide the agent with patterns and principles for designing and implementing new tools that extend its capabilities.

**Target Upgrade:** Meta-knowledge (no specific upgrade - this is knowledge for RSI)

**Prerequisites:** `0x000015` (Dynamic Tools), TLWR upgrade

**Affected Artifacts:** Any new tool the agent creates

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

### 8. Tool Composition Principles

1. **Build small, focused tools**
2. **Compose complex operations from simple tools**
3. **Make tools discoverable with clear descriptions**
4. **Handle errors gracefully**
5. **Return structured, predictable output**
6. **Document edge cases in description**
7. **Version tools when modifying**

Remember: Tools are the agent's vocabulary for action. A rich, well-designed toolset enables sophisticated behaviors through simple composition.