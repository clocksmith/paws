# REPLOID MCP Server

**[↑ Back to REPLOID](../README.md)** | **[↑ PAWS Main](../../../README.md)**

---

Model Context Protocol server that exposes [REPLOID](../README.md)'s recursive self-improvement framework through standardized MCP primitives, enabling LLM-driven introspection, modification, and evolution.

## Overview

The REPLOID MCP Server transforms REPLOID's browser-native self-improvement capabilities into an MCP-accessible service, allowing LLM applications like Claude Desktop to:

- **Introspect** REPLOID's source code through virtual filesystem access
- **Learn** from 70+ architectural blueprints for implementation patterns
- **Propose** modifications with rationale and visual diffs
- **Validate** changes through automated self-testing
- **Checkpoint** state before risky operations
- **Rollback** automatically on test failures
- **Reflect** on outcomes to improve future modifications

## Unique Value Proposition

Unlike typical MCP servers that expose read-only data or simple tools, REPLOID MCP enables **genuine recursive self-improvement**:

- 🧠 **Meta-Cognitive AI**: LLMs can modify their own tool infrastructure
- 🔒 **Human-Supervised Safety**: All destructive operations require approval
- 📚 **Blueprint-Guided Learning**: 70+ architectural guides inform improvements
- ✅ **Test-Driven Validation**: 80% pass threshold with auto-rollback
- 📜 **Complete Audit Trail**: Git checkpoints track all modifications
- 🔄 **Incremental Evolution**: Build on previous improvements over time

## Architecture

The server exposes three MCP primitive types optimized for self-modification:

### Resources (5 read-only endpoints)

- **`reploid://vfs/tree`** - Complete virtual filesystem structure
- **`reploid://vfs/file/{path}`** - Read specific source files
- **`reploid://blueprints/library`** - All 70+ architectural blueprints
- **`reploid://blueprints/{id}`** - Specific blueprint content
- **`reploid://checkpoints/history`** - Git checkpoint timeline
- **`reploid://tests/latest`** - Latest self-test execution results

### Tools (6 executable functions)

**Modification Tools (⚠️ Destructive - Require Approval):**
- **`propose_modification`** - Propose code changes with CREATE/MODIFY/DELETE operations
- **`rollback_to_checkpoint`** - Restore to previous stable state

**Safety & Analysis Tools (✅ Safe - Read-only):**
- **`run_tests`** - Execute self-test suite with detailed results
- **`create_checkpoint`** - Save current state before experiments
- **`query_blueprints`** - Search architectural patterns by keywords
- **`analyze_dependencies`** - Understand change impact scope

### Prompts (3 guided workflows)

- **`self_improvement_session`** - Complete RSI cycle from goal to reflection
- **`blueprint_application`** - Apply architectural pattern systematically
- **`safe_experimentation`** - Try risky changes with automatic rollback

## Installation

### Prerequisites

- Node.js 16+ with npm
- REPLOID installed and working (see [parent README](../README.md))
- TypeScript compiler (`npm install -g typescript`)

### Setup

From the `packages/reploid/mcp-server` directory:

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Verify build
ls build/server.js  # Should exist

# Test server startup
node build/server.js
```

The server should start without errors. Press Ctrl+C to stop.

## Claude Desktop Integration

### Configuration

Add the REPLOID MCP server to your Claude Desktop configuration:

**File location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**

```json
{
  "mcpServers": {
    "reploid": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/paws/packages/reploid/mcp-server/build/server.js"
      ]
    }
  }
}
```

**Important:** Replace `/ABSOLUTE/PATH/TO/paws` with your actual path:

```bash
cd /Users/xyz/deco/paws/packages/reploid/mcp-server
pwd  # Copy this path
```

### Restart Claude Desktop

Completely quit Claude Desktop (Cmd+Q / Alt+F4), wait 5 seconds, then relaunch.

### Verification

Look for the 🔨 tools icon in Claude Desktop. You should see 6 REPLOID tools:

- ✅ `propose_modification` ⚠️ (destructive)
- ✅ `run_tests`
- ✅ `create_checkpoint`
- ✅ `rollback_to_checkpoint` ⚠️ (destructive)
- ✅ `query_blueprints`
- ✅ `analyze_dependencies`

## Usage Examples

### Example 1: Explore REPLOID's Code Structure

```
Show me the structure of REPLOID's virtual filesystem
```

Claude will use `reploid://vfs/tree` to list all modules and files.

### Example 2: Learn from Blueprints

```
What architectural blueprints does REPLOID have for self-testing?
```

Claude will use `query_blueprints(query="self-testing")` to find relevant patterns.

### Example 3: Introspect Specific Modules

```
Read the content of REPLOID's state-manager.js module
```

Claude will use `reploid://vfs/file/upgrades/state-manager.js` to retrieve source code.

### Example 4: Validate System Health

```
Run REPLOID's self-tests to check system integrity
```

Claude will use `run_tests` tool and report pass/fail status with 80% threshold.

### Example 5: Propose a Modification

```
Propose adding a new performance monitoring feature to REPLOID's
agent cycle. Create a new module called 'performance-tracker.js'
in the upgrades/ directory.
```

Claude will:
1. Use `query_blueprints` to find relevant patterns
2. Use `reploid://vfs/file/upgrades/agent-cycle.js` to understand current implementation
3. Use `propose_modification` to suggest new module with rationale
4. Wait for your approval before any changes

### Example 6: Guided Self-Improvement

```
Start a REPLOID self-improvement session to add better error handling
```

Claude will:
1. Activate `self_improvement_session` prompt
2. Guide you through 8-step process
3. Query blueprints for error handling patterns
4. Analyze affected modules
5. Propose specific changes
6. Create checkpoint before applying
7. Run validation tests
8. Help you reflect on outcomes

### Example 7: Safe Experimentation

```
I want to experiment with a new agent cognitive architecture but
need the ability to rollback if it breaks anything
```

Claude will:
1. Use `safe_experimentation` prompt
2. Create checkpoint with `create_checkpoint`
3. Propose modifications with rationale
4. Show baseline test results
5. After changes, run tests again
6. Auto-suggest rollback if <80% pass rate

## How It Works

### Recursive Self-Improvement Flow

```
User Request
    ↓
Claude analyzes goal using REPLOID context
    ↓
Query blueprints for relevant patterns
    ↓
Read current implementation from VFS
    ↓
Analyze dependencies and impact
    ↓
Propose modifications with rationale
    ↓
USER APPROVAL GATE ← Human reviews proposal
    ↓
Create Git checkpoint (automatic)
    ↓
Apply modifications (if approved)
    ↓
Run self-tests (80% threshold)
    ↓
Auto-rollback if tests fail
    ↓
Commit if tests pass
    ↓
Reflection and learning
```

### Security Model

**Every destructive operation requires explicit approval:**

1. **Proposal Phase** - Claude shows you exactly what will change
2. **Review Phase** - You inspect diffs, rationale, and impact
3. **Approval** - You explicitly confirm via Claude Desktop UI
4. **Execution** - Changes applied with automatic checkpoint
5. **Validation** - Self-tests run to verify integrity
6. **Rollback** - Automatic if tests fail (<80% pass rate)

**You are always in control.**

## Advanced Features

### Blueprint-Guided Evolution

REPLOID's 70+ architectural blueprints provide implementation knowledge:

```
Find blueprints about implementing reflection and learning systems
```

Claude will search blueprints and guide implementation based on proven patterns.

### Dependency Impact Analysis

```
If I modify state-manager.js, what other modules will be affected?
```

Claude uses `analyze_dependencies` to show the dependency graph and assess risk.

### Test-Driven Validation

```
Run full test suite before and after my proposed changes
```

Claude can benchmark system health at each stage and recommend rollback if degradation detected.

### Checkpoint Time Travel

```
Show me the checkpoint history and explain what changed at each point
```

Claude reads `reploid://checkpoints/history` and can help you rollback to any previous state.

## Workflow Examples

### Workflow 1: Adding a New Capability

```
User: "Add a performance profiler to REPLOID's agent cycle"

Claude:
1. Queries blueprints → finds "Performance Monitoring" pattern
2. Reads current agent-cycle.js implementation
3. Analyzes dependencies → shows 5 affected modules
4. Proposes creating upgrades/performance-profiler.js
5. Shows modification to agent-cycle.js to integrate profiler
6. Waits for approval
7. Creates checkpoint: "Before adding performance profiler"
8. (After approval) Applies changes
9. Runs tests → 100% pass rate
10. Commits changes with audit log

Result: New capability added safely with full traceability
```

### Workflow 2: Refactoring for Better Architecture

```
User: "Refactor state management to use immutable patterns"

Claude:
1. Searches blueprints for "immutable state" patterns
2. Reads state-manager.js and all dependents
3. Assesses impact: 12 modules affected
4. Creates checkpoint: "Before immutable state refactor"
5. Proposes systematic changes across all modules
6. Shows diffs for each file
7. (After approval) Applies in order
8. Runs tests → 85% pass rate (meets threshold)
9. Commits with note: "Immutable state pattern applied"

Result: Major refactor completed safely, tests validate correctness
```

### Workflow 3: Experimental Feature with Rollback

```
User: "Try implementing speculative execution but rollback if it slows things down"

Claude:
1. Activates safe_experimentation prompt
2. Creates checkpoint: "Before speculative execution experiment"
3. Runs baseline tests → records current performance
4. Proposes speculative execution implementation
5. (After approval) Applies changes
6. Runs tests → 70% pass rate (below 80% threshold!)
7. Suggests rollback due to performance degradation
8. (After rollback approval) Restores checkpoint
9. Runs tests again → 100% pass rate
10. Documents learning: "Speculative execution adds too much overhead"

Result: Failed experiment safely handled, no lasting damage, insights captured
```

## Security Considerations

### Built-In Safety Mechanisms

1. **Approval Gates** - All modifications require explicit user confirmation
2. **Git Checkpoints** - Automatic before every change
3. **Test Validation** - 80% pass threshold enforced
4. **Auto-Rollback** - If tests fail post-modification
5. **Path Validation** - Only allowed directories (upgrades/, blueprints/, boot/, styles/)
6. **Audit Logging** - Complete history in Git
7. **Dependency Analysis** - Understand change scope before applying

### What CAN'T Be Modified

- Core system files outside allowed directories
- MCP server code itself (no infinite recursion!)
- Configuration requiring admin privileges
- External dependencies (package.json, etc.)

### Best Practices

1. **Always review proposals** - Read the diffs carefully
2. **Check dependencies** - Use `analyze_dependencies` before big changes
3. **Create checkpoints** - Especially before experimental features
4. **Run tests frequently** - Baseline before and after changes
5. **Read blueprints** - Follow proven architectural patterns
6. **Document learnings** - Reflect on outcomes (success or failure)

## Troubleshooting

### Server Not Appearing in Claude Desktop

**Check the build:**
```bash
cd /Users/xyz/deco/paws/packages/reploid/mcp-server
npm run build
ls build/server.js  # Must exist
```

**Check the config:**
```bash
# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Verify:
# - Valid JSON (use jsonlint.com)
# - Correct absolute path
# - Correct build/server.js location
```

**Check the logs:**
```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp*.log
```

### "File path outside allowed directories" Error

Only these directories can be modified:
- `upgrades/` - JavaScript modules
- `blueprints/` - Architectural guides
- `boot/` - Bootstrap code
- `styles/` - CSS files

This prevents accidental system corruption.

### Tests Failing After Modification

**Auto-rollback should trigger** if <80% pass rate.

If you want to investigate failures:
```
Run the test suite and show me detailed failure messages
```

Claude will use `run_tests` and show which specific tests failed.

### Import Errors in TypeScript

Make sure you've built the project:
```bash
npm run build
```

Check for TypeScript errors:
```bash
npx tsc --noEmit
```

## Performance

### Typical Latency

- **Resource reads** - 100-500ms (file I/O)
- **Blueprint search** - 200-800ms (depends on query complexity)
- **Test execution** - 1-3 seconds (runs full suite)
- **Dependency analysis** - 300-600ms (parses imports)
- **Proposal generation** - Instant (just formatting)

### Optimization Tips

1. **Cache blueprints** - First query is slow, subsequent are fast
2. **Limit VFS depth** - Don't recurse into deep directories
3. **Focused tests** - Run subset for quick validation
4. **Batch modifications** - Group related changes together

## Technical Details

### Protocol Version

- **MCP Version**: 2025-03-26
- **SDK**: `@modelcontextprotocol/sdk` 1.0.0
- **Transport**: stdio (JSON-RPC 2.0)
- **Language**: TypeScript 5.3+ compiled to Node.js 16+

### Dependencies

**Required:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Runtime type validation

**Dev:**
- `typescript` - Compiler
- `@types/node` - Node.js type definitions

### File Structure

```
mcp-server/
├── src/
│   └── server.ts           # Main MCP server (800+ lines)
├── build/                  # Compiled JavaScript (generated)
├── package.json            # Node.js project config
├── tsconfig.json           # TypeScript compiler config
├── README.md               # This file
├── QUICKSTART.md           # 5-minute setup guide
├── USAGE_EXAMPLES.md       # 30+ practical examples
└── IMPLEMENTATION_SUMMARY.md  # Technical details
```

### Logging

All logs to **stderr** (not stdout) to comply with stdio transport:

```typescript
console.error("REPLOID MCP Server initializing...");
```

Never use `console.log()` - it corrupts JSON-RPC messages.

## Potential Visual Interface

While the REPLOID MCP Server currently operates via text-based MCP protocol (e.g., through Claude Desktop), there's potential to create a visual dashboard using the [MCP Widget Protocol](../../../mwp/README.md):

**Possible MWP Widget Features:**
- **Visual VFS Browser**: Interactive tree view of REPLOID's virtual filesystem with syntax highlighting
- **Blueprint Gallery**: Visual cards for 70+ architectural blueprints with search and filtering
- **Visual Diff Viewer**: Side-by-side code comparisons for proposed modifications
- **Test Results Dashboard**: Charts and visual indicators for test pass/fail status
- **Checkpoint Timeline**: Interactive git history with rollback controls
- **Visual Approval UI**: Enhanced confirmation dialogs with syntax-highlighted diffs

This would transform the current text-based experience into an interactive visual dashboard while maintaining the same MCP server backend.

See [MWP documentation](../../../mwp/README.md) for the widget protocol specification.

### What About Other REPLOID Modules?

**Note:** REPLOID's internal modules (75+ upgrades in `config.json` like ToolRunner, StateManager, EventBus) use a different **Module Widget Protocol** for internal visualization - this is separate from MCP Widget Protocol.

**Good Candidates for MCP Server Conversion:**
Some REPLOID modules could become standalone MCP servers (reusable outside REPLOID):
- **StateManager** (STMT) - VFS operations, could expose as MCP resources/tools
- **Introspector** (INTR) - Code analysis, useful for external tools
- **Blueprint Creator** (BLPR) - Blueprint access and generation
- **Self-Tester** (TEST) - Test execution for external test runners

**Should Stay Internal:**
Other modules are tightly coupled to REPLOID and should not be converted:
- **AgentCycle** (CYCL) - Core cognition loop
- **ApiClient** (APIC) - LLM communication
- **UIManager** (UIMN) - Dashboard rendering

**Trade-offs:**
- **Benefit:** Reusability, standardization, isolation
- **Cost:** ~8x latency (25ms vs 3ms), JSON-RPC overhead, process spawn

See `../docs/MWP_INTEGRATION_GUIDE.md` for complete guide on converting modules to MCP servers and creating MWP widgets.

## Related Documentation

- [REPLOID Main README](../README.md) - Core framework docs
- [PAWS Main README](../../../README.md) - Parent project
- [MCP Widget Protocol](../../../mwp/README.md) - Visual dashboard protocol
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Protocol details
- [Claude Desktop Guide](https://claude.ai/desktop) - Client setup

## Contributing

Improvements welcome! Areas for contribution:

- **Enhanced blueprint search** - Semantic similarity instead of keywords
- **Real Git integration** - Actually execute git commands
- **Visual diff generation** - Render side-by-side comparisons
- **Reflection storage** - Persist learnings across sessions
- **Multi-model proposals** - Paxos-style competitive modifications
- **Performance profiling** - Track execution metrics

## Philosophy

REPLOID MCP Server embodies several key principles:

**1. Transparency Enables Trust**
- All proposals shown before execution
- Complete diffs visible
- Rationale explained
- Audit trail maintained

**2. Safety Through Validation**
- Tests before and after changes
- Automatic rollback on failure
- Checkpoints for time travel
- Dependency analysis for risk assessment

**3. Learning Through Blueprints**
- 70+ proven architectural patterns
- Implementation guidance embedded
- Knowledge base grows over time
- Best practices enforced

**4. Human-in-the-Loop is Essential**
- Humans provide value judgments
- AI proposes, humans approve
- Collaboration beats pure automation
- Alignment through oversight

**5. Incremental Evolution Works**
- Small changes compound
- Each modification builds on previous
- Reflection creates learning
- System improves over time

## License

MIT License - Same as PAWS/REPLOID

---

**Made with 🤖 by the PAWS/REPLOID team**

Enabling LLMs to improve themselves through systematic self-modification.
