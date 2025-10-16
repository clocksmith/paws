# Blueprint 0x000022: Write Tools Manifest

**Objective:** To explain the structure and purpose of the JSON artifact that defines the agent's write-capable toolset, enabling recursive self-improvement through code modification.

**Target Upgrade:** TLWR (tools-write.json)

**Prerequisites:** `0x000010` (Static Tool Manifest), `0x00000A` (Tool Runner Engine), `0x000005` (State Management)

**Affected Artifacts:** `/upgrades/tools-write.json`, `/upgrades/tool-runner.js`, `/upgrades/state-manager.js`

---

### 1. The Strategic Imperative

**Write tools are the cornerstone of Recursive Self-Improvement (RSI).**

Without the ability to modify its own source code, an agent is fundamentally limited - it can reason, analyze, and recommend changes, but it cannot actually evolve itself. The write tools manifest (`tools-write.json`) defines the **specific operations that enable self-modification**:

- ✏️ **modify_artifact** - Edit existing code files
- ➕ **create_artifact** - Add new modules/tools
- ❌ **delete_artifact** - Remove obsolete code
- 📋 **rename_artifact** - Refactor file structure
- 💾 **checkpoint** - Save state before risky changes
- ⏮️ **rollback** - Undo failed modifications

**Why separate from read tools?**
- **Security:** Write operations require extra validation and approval
- **Auditability:** Track all self-modifications in audit logs
- **Human-in-the-Loop:** Enable AWAITING_PROPOSAL_APPROVAL state in Sentinel Agent
- **Checkpoint Safety:** Every write operation should be checkpoint-wrapped

---

### 2. The Architectural Solution

The `/upgrades/tools-write.json` artifact is a JSON file containing an array of tool definitions **that can modify the VFS and the agent's own code**. Each tool follows the same schema as read tools but includes additional metadata for safety.

**Example Tool Definition:**

```json
{
  "name": "modify_artifact",
  "description": "Modifies an existing artifact with new content. Creates a checkpoint before modification for rollback capability.",
  "category": "write",
  "safety_level": "high",
  "requires_approval": true,
  "creates_checkpoint": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The full VFS path of the artifact to modify (e.g., '/vfs/upgrades/utils.js')"
      },
      "new_content": {
        "type": "string",
        "description": "The complete new content for the artifact"
      },
      "reason": {
        "type": "string",
        "description": "Human-readable explanation of why this modification is needed"
      }
    },
    "required": ["path", "new_content", "reason"]
  }
}
```

**Key Fields:**
- **category**: "write" (vs "read" for safe tools)
- **safety_level**: "low", "medium", "high", "critical"
- **requires_approval**: Boolean - triggers AWAITING_PROPOSAL_APPROVAL state
- **creates_checkpoint**: Boolean - auto-checkpoint before execution
- **inputSchema.reason**: Always require human-readable justification

---

### 3. The Implementation Pathway

#### Step 1: Create the Write Tools Manifest

Create `/upgrades/tools-write.json` with these core tools:

```json
[
  {
    "name": "modify_artifact",
    "description": "Modifies existing artifact with new content",
    "category": "write",
    "safety_level": "high",
    "requires_approval": true,
    "creates_checkpoint": true,
    "inputSchema": { /* ... */ }
  },
  {
    "name": "create_artifact",
    "description": "Creates a new artifact in the VFS",
    "category": "write",
    "safety_level": "high",
    "requires_approval": true,
    "creates_checkpoint": true,
    "inputSchema": { /* ... */ }
  },
  {
    "name": "delete_artifact",
    "description": "Deletes an artifact from the VFS",
    "category": "write",
    "safety_level": "critical",
    "requires_approval": true,
    "creates_checkpoint": true,
    "inputSchema": { /* ... */ }
  },
  {
    "name": "rename_artifact",
    "description": "Renames or moves an artifact to a new path",
    "category": "write",
    "safety_level": "medium",
    "requires_approval": true,
    "creates_checkpoint": true,
    "inputSchema": { /* ... */ }
  },
  {
    "name": "create_checkpoint",
    "description": "Manually create a named checkpoint of current VFS state",
    "category": "write",
    "safety_level": "low",
    "requires_approval": false,
    "creates_checkpoint": false,
    "inputSchema": { /* ... */ }
  },
  {
    "name": "rollback_to_checkpoint",
    "description": "Restore VFS to a previous checkpoint",
    "category": "write",
    "safety_level": "critical",
    "requires_approval": true,
    "creates_checkpoint": false,
    "inputSchema": { /* ... */ }
  }
]
```

#### Step 2: Modify ToolRunner to Load Write Tools

In `/upgrades/tool-runner.js`:

```javascript
// Load write tools if TLWR is enabled
let writeTools = [];
if (StateManager.hasUpgrade('TLWR')) {
  const writeToolsContent = await Storage.getArtifactContent('/upgrades/tools-write.json');
  if (writeToolsContent) {
    writeTools = JSON.parse(writeToolsContent);
    logger.info('[ToolRunner] Loaded write tools:', writeTools.map(t => t.name));
  }
}

// Merge read and write tools
const allTools = [...staticTools, ...writeTools];
```

#### Step 3: Implement Write Tool Handlers

```javascript
async function executeTool(toolName, args) {
  // Security check: validate write permissions
  const tool = allTools.find(t => t.name === toolName);

  if (tool?.category === 'write') {
    // Create checkpoint if required
    if (tool.creates_checkpoint) {
      await StateManager.createCheckpoint(`before_${toolName}_${Date.now()}`);
    }

    // Execute write operation
    switch (toolName) {
      case 'modify_artifact':
        return await handleModifyArtifact(args);

      case 'create_artifact':
        return await handleCreateArtifact(args);

      case 'delete_artifact':
        return await handleDeleteArtifact(args);

      // ... etc
    }
  }
}

async function handleModifyArtifact({ path, new_content, reason }) {
  logger.info(`[ToolRunner] Modifying ${path}: ${reason}`);

  // Audit log the modification attempt
  EventBus.emit('audit:log', {
    action: 'modify_artifact',
    path,
    reason,
    timestamp: Date.now()
  });

  // Perform the modification
  await StateManager.updateArtifact(path, new_content);

  return {
    success: true,
    message: `Successfully modified ${path}`,
    checkpoint_created: true
  };
}
```

#### Step 4: Integration with Sentinel Agent (Sentinel FSM)

The Sentinel Agent's FSM already handles write operations through the PAWS workflow:

1. **CURATING_CONTEXT** - Agent selects files to read
2. **PLANNING_WITH_CONTEXT** - Agent decides what changes to make
3. **GENERATING_PROPOSAL** - Agent creates `dogs.md` bundle using write tools
4. **AWAITING_PROPOSAL_APPROVAL** - Human reviews proposed changes
5. **APPLYING_CHANGESET** - Write tools execute approved changes

The write tools manifest enables the agent to **generate valid proposals** that the human can review before execution.

---

### 4. Self-Improvement Opportunities

With write tools, the agent can:

#### 4.1 Create New Tools

```javascript
// Agent uses create_artifact to add a new tool
{
  "name": "create_artifact",
  "args": {
    "path": "/vfs/upgrades/tools-dynamic/code_analyzer.json",
    "content": JSON.stringify({
      "name": "analyze_complexity",
      "description": "Analyzes code complexity metrics",
      "inputSchema": { /* ... */ }
    }),
    "reason": "Need to measure cyclomatic complexity for self-optimization"
  }
}
```

#### 4.2 Refactor Its Own Code

```javascript
// Agent uses modify_artifact to improve its own logic
{
  "name": "modify_artifact",
  "args": {
    "path": "/vfs/upgrades/agent-cycle.js",
    "new_content": "/* improved cognitive loop with memoization */",
    "reason": "Add memoization to reduce redundant API calls by 40%"
  }
}
```

#### 4.3 Fix Bugs in Itself

```javascript
// Agent uses modify_artifact to patch a bug it discovered
{
  "name": "modify_artifact",
  "args": {
    "path": "/vfs/upgrades/state-manager.js",
    "new_content": "/* patched null pointer bug */",
    "reason": "Self-tester detected null pointer exception in getArtifactContent() - applying fix"
  }
}
```

#### 4.4 Document Its Evolution

```javascript
// Agent uses create_artifact to write blueprints
{
  "name": "create_artifact",
  "args": {
    "path": "/vfs/blueprints/0x00003C-learned-optimization.md",
    "content": "# Blueprint 0x00003C: Learned Optimization Pattern\n\n...",
    "reason": "Documenting successful memoization pattern for future reference"
  }
}
```

---

### 5. Safety Mechanisms

Write tools are **inherently dangerous** because they enable self-modification. REPLOID implements multiple safety layers:

#### 5.1 Checkpoint/Rollback System

Every write operation auto-creates a checkpoint:

```javascript
before_modify_artifact_1728000000000
before_create_artifact_1728000000123
before_delete_artifact_1728000000456
```

If something breaks, the agent (or human) can rollback:

```javascript
{
  "name": "rollback_to_checkpoint",
  "args": {
    "checkpoint_id": "before_modify_artifact_1728000000000",
    "reason": "Modification caused test failures, reverting"
  }
}
```

#### 5.2 Human-in-the-Loop Approvals

Sentinel Agent FSM ensures humans review changes:

```
IDLE → CURATING_CONTEXT → AWAITING_CONTEXT_APPROVAL
  ↓
  (human approves context)
  ↓
PLANNING → GENERATING_PROPOSAL → AWAITING_PROPOSAL_APPROVAL
  ↓
  (human reviews diff, approves/rejects specific files)
  ↓
APPLYING_CHANGESET → REFLECTING
```

#### 5.3 Audit Logging

Every write operation is logged:

```json
{
  "timestamp": 1728000000000,
  "action": "modify_artifact",
  "path": "/vfs/upgrades/agent-cycle.js",
  "user_approved": true,
  "checkpoint_created": "before_modify_artifact_1728000000000",
  "success": true,
  "reason": "Add memoization for performance"
}
```

#### 5.4 Self-Testing Before Apply

Integration with `self-tester.js` (TEST upgrade):

```javascript
// Before applying changes, run tests
const testResults = await SelfTester.runTests();

if (testResults.passRate < 0.80) {
  logger.error('[ToolRunner] Tests failed, aborting write operation');
  await StateManager.rollbackToCheckpoint(lastCheckpoint);
  return { success: false, error: 'Test suite failed' };
}
```

---

### 6. Integration with Other Upgrades

Write tools interact with multiple other modules:

| Upgrade | Interaction | Purpose |
|---------|-------------|---------|
| **STMT** | `StateManager.updateArtifact()` | Persist changes to VFS |
| **IDXB** | IndexedDB writes | Save to browser storage |
| **GMOD** | Goal modification | Enable goal evolution |
| **BLPR** | Blueprint creation | Self-documentation |
| **MTCP** | Meta-tool creation | Create new tools |
| **TEST** | Self-testing | Validate changes before apply |
| **AUDT** | Audit logging | Track all modifications |
| **REFL** | Reflection storage | Learn from successes/failures |
| **INTR** | Introspection | Analyze impact of changes |

---

### 7. Testing & Validation

#### 7.1 Manual Testing

```javascript
// Test modify_artifact
const result = await ToolRunner.execute('modify_artifact', {
  path: '/vfs/test/sample.js',
  new_content: 'console.log("modified");',
  reason: 'Testing write tool'
});

// Verify change was applied
const content = await StateManager.getArtifactContent('/vfs/test/sample.js');
assert(content === 'console.log("modified");');

// Verify checkpoint was created
const checkpoints = await StateManager.listCheckpoints();
assert(checkpoints.some(c => c.id.startsWith('before_modify_artifact')));
```

#### 7.2 Integration Testing

Test the full Sentinel Agent flow:

1. Set goal: "Add a comment to utils.js"
2. Agent curates context (reads utils.js)
3. Agent generates proposal (uses modify_artifact)
4. Human approves proposal
5. Agent applies changes
6. Agent reflects on success

---

### 8. Future Enhancements

#### 8.1 Advanced Write Operations

- **batch_modify** - Apply multiple changes atomically
- **merge_artifacts** - Combine multiple files
- **refactor_module** - Automated refactoring operations
- **optimize_code** - Apply performance optimizations

#### 8.2 Version Control Integration

- **git_commit** - Create Git commits for changes
- **git_branch** - Create experimental branches
- **git_merge** - Merge successful experiments

#### 8.3 Collaborative RSI

- **publish_blueprint** - Share learned patterns
- **import_blueprint** - Learn from other agents
- **fork_upgrade** - Create variant modules

---

### 9. Conclusion

**Write tools are the KEY to true RSI.** Without them, the agent is read-only and cannot evolve. With them, the agent becomes:

- 🔄 **Self-modifying** - Can improve its own code
- 📚 **Self-documenting** - Creates blueprints of learned patterns
- 🧪 **Self-experimenting** - Tests modifications safely
- 🎯 **Self-optimizing** - Measures and improves performance

The write tools manifest (`tools-write.json`) defines the **contract for self-evolution**, while the Sentinel Agent workflow (Project Sentinel) provides the **safety rails** to ensure humans maintain control.

**The agent doesn't just USE tools - it can CREATE, MODIFY, and DELETE them. That's true recursion.**

---

**Related Blueprints:**
- 0x000010 (Static Tool Manifest) - Read-only tools
- 0x000015 (Dynamic Tool Creation) - Runtime tool generation
- 0x000016 (Meta-Tool Creation Patterns) - Design principles
- 0x00001D (Self-Testing Framework) - Validation before apply
- 0x00001B (Code Introspection) - Analyze own architecture

**Related RFCs:**
- Project Sentinel (Sentinel Agent with human approvals)
- PAWS CLI Integration (cats.md/dogs.md workflow)
