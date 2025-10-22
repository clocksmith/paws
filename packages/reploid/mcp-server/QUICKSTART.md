# REPLOID MCP Server - Quick Start Guide

Get REPLOID's recursive self-improvement running in Claude Desktop in 5 minutes.

## Step 1: Build Server (2 minutes)

```bash
cd /Users/xyz/deco/paws/packages/reploid/mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify
ls build/server.js  # Should exist
```

If build succeeds, continue to Step 2.

## Step 2: Configure Claude Desktop (1 minute)

### Find Config File

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/
```

**Windows:**
```cmd
explorer %APPDATA%\Claude
```

Create or edit `claude_desktop_config.json`

### Add REPLOID Server

```json
{
  "mcpServers": {
    "reploid": {
      "command": "node",
      "args": [
        "/Users/xyz/deco/paws/packages/reploid/mcp-server/build/server.js"
      ]
    }
  }
}
```

⚠️ **Update the path!** Get your path:
```bash
cd /Users/xyz/deco/paws/packages/reploid/mcp-server
pwd
```

## Step 3: Restart Claude Desktop (30 seconds)

1. Fully quit Claude (Cmd+Q / Alt+F4)
2. Wait 5 seconds
3. Relaunch

## Step 4: Verify (30 seconds)

Look for the 🔨 tools icon.

You should see 6 REPLOID tools:
- ✅ propose_modification
- ✅ run_tests
- ✅ create_checkpoint
- ✅ rollback_to_checkpoint
- ✅ query_blueprints
- ✅ analyze_dependencies

## Step 5: Test It! (1 minute)

### Test 1: Explore Structure
```
Show me REPLOID's virtual filesystem structure
```

### Test 2: Find Blueprints
```
What architectural blueprints does REPLOID have about self-testing?
```

### Test 3: Read Code
```
Show me the content of REPLOID's agent-cycle.js module
```

### Test 4: Run Tests
```
Run REPLOID's self-test suite and show me the results
```

## Troubleshooting

### Tools not showing?

**Check build:**
```bash
cd mcp-server
npm run build
node build/server.js  # Should not error
```

**Check config:**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Verify valid JSON and correct path
```

**Check logs:**
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

### Import errors?

```bash
npm install
npm run build
```

### Path errors?

Use **absolute paths** in config, not relative!

## Next Steps

- Read [full README](README.md) for all features
- Try [usage examples](USAGE_EXAMPLES.md) - 30+ scenarios
- Start a self-improvement session with Claude
- Explore REPLOID's 70+ blueprints

## Success Checklist

- ✅ `npm run build` completed
- ✅ `build/server.js` exists
- ✅ Config has correct absolute path
- ✅ Claude Desktop fully restarted
- ✅ Tools icon appears
- ✅ 6 REPLOID tools listed
- ✅ Test command works

**All checked?** You're ready for recursive self-improvement! 🚀
