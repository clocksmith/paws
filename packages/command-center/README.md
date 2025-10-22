## PAWS Command Center

**Model Context Protocol (MCP) client/host for orchestrating GAMMA, REPLOID, and external MCP servers**

PAWS Command Center is a comprehensive MCP client implementation that enables multi-server coordination, LLM sampling with GAMMA, structured user input collection (elicitation), and filesystem boundary management (roots).

---

## Features

### 🎯 Core Capabilities

- **Multi-Server Orchestration** - Connect to and coordinate multiple MCP servers simultaneously
- **Sampling with GAMMA** - Use GAMMA's multi-model infrastructure for LLM completions
- **Elicitation** - Structured user input collection with schema validation
- **Roots Management** - Filesystem boundary coordination for server operations
- **Human-in-the-Loop** - Approval flows for destructive operations

### 🔌 Built-in Server Support

- **GAMMA** - LLM experimentation (model inference, comparison, benchmarking)
- **REPLOID** - Recursive self-improvement (code introspection and modification)
- **Filesystem** - Read/write files within allowed directories
- **GitHub** - Repository operations and API access
- **Puppeteer** - Web scraping and browser automation
- **PostgreSQL** - Database queries and operations
- **Brave Search** - Web search capabilities
- **SQLite** - SQLite database operations
- **Memory** - Knowledge graph storage

---

## Installation

```bash
cd /Users/xyz/deco/paws/packages/command-center

# Install dependencies
npm install

# Build TypeScript
npm run build
```

---

## Quick Start

### CLI Usage

```bash
# Show connection status
paws status

# List all connected servers and their capabilities
paws list

# Show filesystem roots
paws roots

# Execute a tool
paws tool gamma run_inference prompt="Hello world" model="auto"

# Read a resource
paws resource reploid "reploid://vfs/tree"
```

### Programmatic Usage

```typescript
import { PAWSCommandCenter, getDefaultServers } from "@paws/command-center";

// Initialize with default servers (GAMMA, REPLOID, filesystem)
const commandCenter = new PAWSCommandCenter({
  servers: getDefaultServers(),
  requireApproval: true,
});

await commandCenter.initialize();

// Call a tool
const result = await commandCenter.callTool("gamma", "run_inference", {
  prompt: "Explain quantum computing",
  model: "auto",
  max_tokens: 100,
});

// Read a resource
const vfs = await commandCenter.readResource("reploid", "reploid://vfs/tree");

// Use sampling (with GAMMA)
const analysis = await commandCenter.sample({
  messages: [{ role: "user", content: "Analyze this code..." }],
  modelPreferences: { hints: [{ name: "claude-3-5-sonnet" }] },
  maxTokens: 500,
});

// Request user input
const approval = await commandCenter.elicit("Approve this change?", {
  type: "object",
  properties: {
    approve: { type: "boolean" },
    comment: { type: "string" },
  },
  required: ["approve"],
});

await commandCenter.shutdown();
```

---

## Architecture

### Components

```
command-center/
├── src/
│   ├── client/
│   │   ├── mcp-client.ts           # Core MCP client wrapper
│   │   ├── sampling-handler.ts     # GAMMA-powered sampling
│   │   └── elicitation-handler.ts  # User input collection
│   ├── servers/
│   │   └── registry.ts             # Server configuration registry
│   ├── workflows/
│   │   └── roots-manager.ts        # Filesystem boundary manager
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── index.ts                    # Main PAWSCommandCenter class
│   └── cli.ts                      # CLI interface
└── examples/
    ├── model-experiments.ts        # GAMMA sampling examples
    ├── reploid-improvement.ts      # REPLOID workflow examples
    └── multi-server-workflow.ts    # Multi-server orchestration
```

### Data Flow

```
User Request
    ↓
PAWSCommandCenter
    ↓
┌─────────────┬────────────────┬──────────────────┐
│             │                │                  │
MCPClient     SamplingHandler  ElicitationHandler RootsManager
│             │                │                  │
↓             ↓                ↓                  ↓
Servers       GAMMA            User Input         Filesystem
```

---

## MCP Client Features

### 1. Sampling

Sampling allows servers to request LLM completions through the client. PAWS Command Center uses GAMMA's multi-model infrastructure to fulfill these requests.

**How it works:**

1. Server requests sampling (or you call directly)
2. Request routed to GAMMA's inference engine
3. User approval (optional, based on configuration)
4. LLM generates response
5. Response approval (optional)
6. Result returned to server

**Example:**

```typescript
const response = await commandCenter.sample({
  messages: [
    { role: "user", content: "Review this code and suggest improvements" },
  ],
  modelPreferences: {
    hints: [{ name: "claude-3-5-sonnet" }],
    intelligencePriority: 0.9,
  },
  systemPrompt: "You are an expert code reviewer",
  maxTokens: 1000,
});

console.log(response.content);
console.log(response.model); // Model used
console.log(response.stopReason); // Why generation stopped
```

### 2. Elicitation

Elicitation enables structured user input collection with JSON schema validation.

**Example:**

```typescript
const result = await commandCenter.elicit(
  "REPLOID proposes modifying agent-cycle.js. Approve?",
  {
    type: "object",
    properties: {
      approve: {
        type: "boolean",
        description: "Approve the modification",
      },
      runTests: {
        type: "boolean",
        default: true,
        description: "Run tests after applying",
      },
      createBackup: {
        type: "boolean",
        default: true,
        description: "Create checkpoint before changes",
      },
    },
    required: ["approve"],
  }
);

if (result.approved && result.data.approve) {
  // Apply changes
}
```

### 3. Roots

Roots define filesystem boundaries for server operations.

**Example:**

```typescript
// Add a root
await commandCenter.addRoot("file:///Users/xyz/projects/app", "App Project");

// Get all roots
const roots = commandCenter.getRoots();

// Servers are notified automatically and should respect these boundaries
```

**Auto-detected roots:**

- Current working directory
- PAWS workspace (if detected)
- GAMMA package (if found)
- REPLOID package (if found)

---

## Server Configuration

### Pre-configured Servers

```typescript
import {
  getGammaServerConfig,
  getReploidServerConfig,
  getFilesystemServerConfig,
  getGithubServerConfig,
  getPuppeteerServerConfig,
  getDefaultServers,
} from "@paws/command-center";

// Use default servers
const commandCenter = new PAWSCommandCenter({
  servers: getDefaultServers(), // GAMMA, REPLOID, filesystem
});

// Or configure individually
const commandCenter = new PAWSCommandCenter({
  servers: [
    getGammaServerConfig(),
    getReploidServerConfig(),
    getFilesystemServerConfig(["/path/to/project"]),
    getGithubServerConfig("github_token_here"),
  ],
});
```

### Custom Server Configuration

```typescript
import { createCustomServer } from "@paws/command-center";

const customServer = createCustomServer(
  "my-server",
  "python3",
  ["/path/to/server.py"],
  {
    env: { CUSTOM_VAR: "value" },
    trusted: false,
    description: "My custom MCP server",
  }
);

const commandCenter = new PAWSCommandCenter({
  servers: [customServer],
});
```

---

## Example Workflows

### Workflow 1: Model Experimentation

Use GAMMA to compare multiple models:

```typescript
// Get available models
const models = await commandCenter.readResource("gamma", "gamma://models/available");

// Run inference
const result = await commandCenter.callTool("gamma", "run_inference", {
  prompt: "Explain recursion",
  model: "auto",
  max_tokens: 150,
});

// Use sampling for model comparison
const comparison = await commandCenter.sample({
  messages: [
    {
      role: "user",
      content: "Compare Claude vs GPT-4 for code generation",
    },
  ],
  modelPreferences: { intelligencePriority: 0.9 },
});
```

See [examples/model-experiments.ts](./examples/model-experiments.ts) for full example.

### Workflow 2: REPLOID Self-Improvement

Use REPLOID to propose and validate code changes:

```typescript
// Query blueprints for patterns
const blueprints = await commandCenter.callTool("reploid", "query_blueprints", {
  query: "error handling",
});

// Analyze dependencies
const deps = await commandCenter.callTool("reploid", "analyze_dependencies", {
  file_path: "upgrades/agent-cycle.js",
});

// Create checkpoint
await commandCenter.callTool("reploid", "create_checkpoint", {
  message: "Before error handling improvements",
});

// Propose modification (requires approval)
const proposal = await commandCenter.callTool("reploid", "propose_modification", {
  operation: "MODIFY",
  file_path: "upgrades/app-logic.js",
  new_content: "// Improved code...",
  rationale: "Adding try-catch blocks per blueprint 0x000015",
});

// Run tests
const tests = await commandCenter.callTool("reploid", "run_tests");
```

See [examples/reploid-improvement.ts](./examples/reploid-improvement.ts) for full example.

### Workflow 3: Multi-Server Orchestration

Combine GAMMA, REPLOID, and filesystem servers:

```typescript
// Read code structure from REPLOID
const vfs = await commandCenter.readResource("reploid", "reploid://vfs/tree");

// Use GAMMA to analyze architecture
const analysis = await commandCenter.sample({
  messages: [{ role: "user", content: `Analyze this structure: ${vfs}` }],
});

// Query REPLOID blueprints for implementation
const patterns = await commandCenter.callTool("reploid", "query_blueprints", {
  query: analysis.content,
});

// Validate with tests
const tests = await commandCenter.callTool("reploid", "run_tests");
```

See [examples/multi-server-workflow.ts](./examples/multi-server-workflow.ts) for full example.

---

## API Reference

### PAWSCommandCenter

Main class for orchestrating MCP servers.

#### Constructor

```typescript
new PAWSCommandCenter(config: CommandCenterConfig)
```

**Config options:**

- `servers: ServerConfig[]` - List of servers to connect to
- `roots?: Root[]` - Initial filesystem roots
- `requireApproval?: boolean` - Require approval for all operations (default: true)
- `trustedServers?: string[]` - Servers that can skip some approvals

#### Methods

**Initialization:**

- `initialize(): Promise<void>` - Connect to all servers and setup roots
- `shutdown(): Promise<void>` - Disconnect from all servers

**Server Management:**

- `connectServer(config: ServerConfig): Promise<void>` - Connect to a server
- `disconnectServer(name: string): Promise<void>` - Disconnect from a server
- `getStatus(): Record<string, 'connected' | 'disconnected' | 'error'>` - Get connection status
- `isServerConnected(name: string): boolean` - Check if server is connected
- `getConnectedServers(): string[]` - Get list of connected server names

**Resources:**

- `listResources(serverName: string): Promise<Array<{uri: string, name: string}>>` - List resources
- `readResource(serverName: string, uri: string): Promise<ReadResourceResult>` - Read a resource

**Tools:**

- `listTools(serverName: string): Promise<Array<{name: string, description?: string}>>` - List tools
- `callTool(serverName: string, toolName: string, args?: Record<string, unknown>): Promise<CallToolResult>` - Call a tool

**Prompts:**

- `listPrompts(serverName: string): Promise<Array<{name: string, description?: string}>>` - List prompts
- `getPrompt(serverName: string, promptName: string, args?: Record<string, string>): Promise<GetPromptResult>` - Get a prompt

**Sampling:**

- `sample(request: Omit<SamplingRequest, 'serverId'>): Promise<SamplingResponse | null>` - Request LLM sampling

**Elicitation:**

- `elicit(message: string, schema: ElicitationRequest['schema']): Promise<ElicitationResponse>` - Request user input

**Roots:**

- `getRoots(): Root[]` - Get current roots
- `setRoots(roots: Root[]): Promise<void>` - Set roots (replaces existing)
- `addRoot(uri: string, name: string): Promise<void>` - Add a root
- `removeRoot(uri: string): Promise<void>` - Remove a root

---

## Configuration

### Server Trust Levels

Servers can be marked as trusted to skip certain approval steps:

```typescript
const commandCenter = new PAWSCommandCenter({
  servers: [
    { ...gammaConfig, trusted: true }, // Auto-approve sampling
    { ...reploidConfig, trusted: false }, // Always require approval
  ],
  trustedServers: ["gamma", "filesystem"],
});
```

### Approval Requirements

Configure approval behavior globally:

```typescript
const commandCenter = new PAWSCommandCenter({
  servers: getDefaultServers(),
  requireApproval: false, // Disable all approval prompts (use with caution!)
});
```

### Logging

Logging goes to stderr by default (MCP stdio convention):

```typescript
// All logs appear on stderr
console.error("[CommandCenter] Initializing...");
```

---

## Troubleshooting

### Servers Not Connecting

**GAMMA server:**

```bash
# Check if server exists
ls -l /Users/xyz/deco/gamma/mcp-server/server.py

# Test manually
python3 /Users/xyz/deco/gamma/mcp-server/server.py
```

**REPLOID server:**

```bash
# Check if built
ls -l /Users/xyz/deco/paws/packages/reploid/mcp-server/build/server.js

# Test manually
node /Users/xyz/deco/paws/packages/reploid/mcp-server/build/server.js
```

### Import Errors

```bash
# Rebuild
npm run clean
npm run build
```

### Path Issues

Ensure absolute paths in server configurations:

```typescript
// Good
command: "node",
args: ["/absolute/path/to/server.js"]

// Bad
command: "node",
args: ["../relative/path/server.js"]
```

---

## Development

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Running Examples

```bash
# Build first
npm run build

# Run examples
node build/examples/model-experiments.js
node build/examples/reploid-improvement.js
node build/examples/multi-server-workflow.js
```

---

## Philosophy

PAWS Command Center embodies several key principles:

**1. Orchestration Over Integration**

Coordinate multiple specialized servers rather than building monolithic systems.

**2. Human-in-the-Loop by Default**

All potentially destructive operations require approval unless explicitly configured otherwise.

**3. Sampling as a Service**

GAMMA's multi-model infrastructure provides LLM sampling for any server that needs it.

**4. Boundary Awareness**

Roots communicate intended filesystem boundaries, helping servers stay in scope.

**5. Composable Workflows**

Combine servers dynamically to create powerful multi-step agentic pipelines.

---

## Comparison to Claude Desktop

| Aspect | Claude Desktop | PAWS Command Center |
|--------|---------------|---------------------|
| **Purpose** | End-user AI chat interface | Developer MCP orchestration platform |
| **Server Support** | Via config file | Programmatic + CLI |
| **Sampling** | Built-in Claude models | GAMMA multi-model infrastructure |
| **Coordination** | Single-server focus | Multi-server workflows |
| **Extensibility** | Plugin-based | API-first |
| **Use Case** | Consumer AI assistant | Developer AI toolkit |

---

## Future Enhancements

**Planned Features:**

1. **Interactive REPL** - Full interactive shell with auto-complete
2. **Web UI** - Browser-based interface for server management
3. **Workflow DSL** - Declarative syntax for complex multi-server pipelines
4. **Persistent Sessions** - Save and restore command center state
5. **Server Marketplace** - Discover and install public MCP servers
6. **Performance Monitoring** - Track server performance and bottlenecks
7. **Advanced Approval UI** - Rich terminal UI with syntax highlighting

---

## Related Projects

- **[GAMMA](../gamma/mcp-server/README.md)** - LLM experimentation MCP server
- **[REPLOID](../reploid/mcp-server/README.md)** - Recursive self-improvement MCP server
- **[PAWS](../../README.md)** - Progressive AI Workspace System

---

## License

MIT License - Same as PAWS

---

**Made with 🤖 by the PAWS team**

Enabling seamless orchestration of AI capabilities through the Model Context Protocol.
