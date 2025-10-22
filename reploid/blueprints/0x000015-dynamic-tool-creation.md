# Blueprint 0x000015: Dynamic Tool Creation System

**Objective:** To enable the agent to create, register, and execute custom tools at runtime, extending its capabilities beyond static tools.

**Target Upgrade:** STLD (system-tools-dynamic.json)

**Prerequisites:** `0x00000A` (Tool Runner), `0x00000B` (Tool Helpers)

**Affected Artifacts:** `/system/tools-dynamic.json`, `/modules/tool-runner.js`

---

### 1. The Strategic Imperative

Static tools are limited to what was anticipated at design time. Dynamic tool creation allows the agent to craft specialized tools for unique situations, automate repetitive tasks, and build domain-specific capabilities. This is a cornerstone of true adaptability - the ability to create new affordances when needed.

### 2. The Architectural Solution

A dynamic tool registry at `/system/tools-dynamic.json` that stores agent-created tools:

**Dynamic Tool Structure:**
```json
[
  {
    "id": "analyze_code_pattern",
    "created_cycle": 42,
    "created_reason": "Need to repeatedly analyze similar code patterns",
    "declaration": {
      "name": "analyze_code_pattern",
      "description": "Analyzes code for specific patterns and returns statistics",
      "inputSchema": {
        "type": "object",
        "properties": {
          "pattern": { "type": "string", "description": "Regex pattern to search" },
          "path": { "type": "string", "description": "Directory to search" }
        },
        "required": ["pattern", "path"]
      }
    },
    "implementation": {
      "type": "composite",
      "steps": [
        { "tool": "search_vfs", "args_template": "{pattern: $pattern}" },
        { "tool": "read_artifact", "args_template": "{path: $results[0]}" },
        { "transform": "count_matches", "code": "results.length" }
      ]
    }
  }
]
```

### 3. The Implementation Pathway

1. **Initialize Dynamic Tools Registry:**
   ```javascript
   // On first run or if missing
   const dynamicToolsPath = "/system/tools-dynamic.json";
   if (!await StateManager.getArtifactMetadata(dynamicToolsPath)) {
     await StateManager.createArtifact(
       dynamicToolsPath,
       "json",
       "[]",
       "Registry of agent-created dynamic tools"
     );
   }
   ```

2. **Create New Dynamic Tool:**
   ```javascript
   // Agent decides to create a new tool
   const newTool = {
     id: "my_custom_tool",
     created_cycle: currentCycle,
     created_reason: "Automate repetitive task X",
     declaration: {
       name: "my_custom_tool",
       description: "Does something specific",
       inputSchema: { /* schema */ }
     },
     implementation: {
       type: "javascript",
       code: `
         const result = await ToolRunner.runTool('read_artifact', {path: args.input});
         return result.content.toUpperCase();
       `
     }
   };
   
   // Add to registry
   const tools = JSON.parse(await Storage.getArtifactContent(dynamicToolsPath));
   tools.push(newTool);
   await StateManager.updateArtifact(dynamicToolsPath, JSON.stringify(tools, null, 2));
   ```

3. **Execute Dynamic Tools in ToolRunner:**
   ```javascript
   // In tool-runner.js
   const runTool = async (toolName, toolArgs, staticTools, dynamicTools) => {
     // Check static tools first
     const staticTool = staticTools.find(t => t.name === toolName);
     if (staticTool) { /* handle static */ }
     
     // Check dynamic tools
     const dynamicTool = dynamicTools.find(t => t.declaration.name === toolName);
     if (dynamicTool) {
       return await executeDynamicTool(dynamicTool, toolArgs);
     }
   };
   
   const executeDynamicTool = async (tool, args) => {
     if (tool.implementation.type === "javascript") {
       // Execute JavaScript implementation
       const func = new Function('args', 'ToolRunner', 'Storage', tool.implementation.code);
       return await func(args, ToolRunner, Storage);
     } else if (tool.implementation.type === "composite") {
       // Execute step-by-step
       let results = [];
       for (const step of tool.implementation.steps) {
         const stepArgs = JSON.parse(step.args_template.replace(/\$(\w+)/g, 
           (match, key) => JSON.stringify(args[key])));
         const result = await ToolRunner.runTool(step.tool, stepArgs);
         results.push(result);
       }
       return results;
     }
   };
   ```

### 4. Dynamic Tool Patterns

**Composite Tools:** Combine existing tools
```json
{
  "type": "composite",
  "steps": [
    { "tool": "list_artifacts", "args_template": "{}" },
    { "tool": "read_artifact", "args_template": "{path: $results[0].paths[0]}" }
  ]
}
```

**Transformer Tools:** Process data
```json
{
  "type": "javascript",
  "code": "return args.text.split('\\n').filter(line => line.includes(args.keyword));"
}
```

**Workflow Tools:** Multi-step operations
```json
{
  "type": "workflow",
  "steps": [
    { "action": "validate", "condition": "args.path !== null" },
    { "action": "transform", "operation": "normalize_path" },
    { "action": "execute", "tool": "read_artifact" }
  ]
}
```

### 5. Safety Considerations

1. **Sandboxing:** Execute dynamic JavaScript in restricted context
2. **Validation:** Verify tool declarations before registration
3. **Limits:** Cap number of dynamic tools and execution time
4. **Auditing:** Log all dynamic tool creation and execution
5. **Rollback:** Ability to disable problematic tools

### 6. Evolution Path

Dynamic tools enable the agent to:
- Build domain-specific toolsets
- Create higher-level abstractions
- Share tools with other agents
- Learn from tool usage patterns
- Optimize frequently-used combinations

This is meta-programming at runtime - the agent becomes its own tool developer.