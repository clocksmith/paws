# PAWS Command Center - Quick Start

Get up and running with multi-server MCP orchestration in 5 minutes.

---

## Step 1: Build Command Center (2 minutes)

```bash
cd /Users/xyz/deco/paws/packages/command-center

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify
ls build/index.js  # Should exist
```

---

## Step 2: Verify Server Availability (1 minute)

Command Center will auto-detect GAMMA and REPLOID servers:

```bash
# Check GAMMA server
ls ../../../gamma/mcp-server/server.py

# Check REPLOID server
ls ../reploid/mcp-server/build/server.js

# If REPLOID isn't built yet:
cd ../reploid/mcp-server && npm install && npm run build && cd ../../command-center
```

---

## Step 3: Test CLI (1 minute)

```bash
# Show connection status
node build/cli.js status

# List all servers and capabilities
node build/cli.js list

# Show filesystem roots
node build/cli.js roots
```

Expected output:
```
✓ gamma: connected
✓ reploid: connected
✓ filesystem: connected
```

---

## Step 4: Run Example Workflows (1 minute)

### Example 1: GAMMA Model Experiments

```bash
node build/examples/model-experiments.js
```

This will:
- Connect to GAMMA
- List available models
- Run inference with auto model selection
- Use sampling to compare models

### Example 2: REPLOID Self-Improvement

```bash
node build/examples/reploid-improvement.js
```

This will:
- Explore REPLOID's structure
- Query architectural blueprints
- Run self-tests
- Create checkpoints
- Analyze dependencies

### Example 3: Multi-Server Orchestration

```bash
node build/examples/multi-server-workflow.js
```

This will:
- Connect to GAMMA, REPLOID, and filesystem
- Show detected roots
- Demonstrate coordinated workflows
- Use sampling with REPLOID context

---

## Step 5: Programmatic Usage (optional)

Create `test.ts`:

```typescript
import { PAWSCommandCenter, getDefaultServers } from "./build/index.js";

const commandCenter = new PAWSCommandCenter({
  servers: getDefaultServers(),
});

await commandCenter.initialize();

// Use GAMMA
const result = await commandCenter.callTool("gamma", "run_inference", {
  prompt: "Hello, world!",
  model: "auto",
});

console.log(result);

await commandCenter.shutdown();
```

Run it:

```bash
node --loader ts-node/esm test.ts
```

---

## Quick Commands Reference

```bash
# Status
paws status

# List everything
paws list

# Filesystem roots
paws roots

# Run GAMMA inference
paws tool gamma run_inference prompt="Explain AI" model="auto"

# Read REPLOID structure
paws resource reploid "reploid://vfs/tree"

# Run REPLOID tests
paws tool reploid run_tests

# Query REPLOID blueprints
paws tool reploid query_blueprints query="testing"
```

---

## Troubleshooting

### "Server not found"

```bash
# Verify paths in registry
cat src/servers/registry.ts

# Check if servers exist
ls ../../../gamma/mcp-server/server.py
ls ../reploid/mcp-server/build/server.js
```

### "Connection failed"

```bash
# Test GAMMA manually
python3 ../../../gamma/mcp-server/server.py

# Test REPLOID manually
node ../reploid/mcp-server/build/server.js
```

### "Import errors"

```bash
# Rebuild
npm run clean
npm run build
```

---

## Next Steps

- Read [full README](./README.md) for comprehensive documentation
- Explore [examples/](./examples/) for more workflows
- Build custom workflows with the API
- Add more MCP servers from the registry

---

## Success Checklist

- ✅ `npm run build` completed
- ✅ `build/index.js` exists
- ✅ `paws status` shows connected servers
- ✅ Example workflows run successfully
- ✅ GAMMA and REPLOID servers accessible

**All checked?** You're ready to orchestrate! 🚀
