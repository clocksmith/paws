# REPLOID

**Browser-Native AI Agent Environment**

REPLOID is a tool for running AI agents entirely in your browser, with a focus on **meta-tool creation** (tools that create tools) and **multi-model mixing**.

---

## Quick Start

1. Open `index.html` in your browser
2. Select a boot mode (see below)
3. Start experimenting with browser-native AI agents

---

## Boot Modes

REPLOID offers 4 progressive tiers to match your use case:

### ★ Essential Core (8 modules, ~500ms)
**Perfect for learning REPLOID basics**

The bare minimum to run an agent:
- Agent cognitive loop
- Virtual file system (VFS)
- Tool execution
- Basic UI
- Single LLM provider

**Best for:** First-time users, tutorials, understanding core concepts

---

### ☥ Meta-RSI Core (15 modules, ~1s) **← RECOMMENDED**
**YOUR ORIGINAL VISION: Tools that create tools**

Everything in Essential Core, plus:
- **Meta-tool creator** - Tools that create other tools
- **Multi-model mixing** - Mix Gemini, GPT, Claude, and local models
- **Code introspection** - Agent can examine its own code
- **Streaming responses** - Real-time UI updates
- **Context management** - Smart token pruning

**Best for:**
- Experimenting with meta-tool creation
- Multi-model agent workflows
- Self-improving agents
- Original REPLOID vision

---

### ☇ Full-Featured (28 modules, ~2s)
**Production-ready with monitoring and testing**

Everything in Meta-RSI Core, plus:
- Performance monitoring and metrics
- Browser API integration (File System, Notifications, etc.)
- Reflection storage for learning over time
- Self-testing framework
- Rate limiting and verification
- Enhanced UI with styling

**Best for:**
- Production projects
- Real-world applications
- Performance-critical workflows
- Projects requiring testing/validation

---

### ⛉ Experimental Suite (All 76 modules, ~5s)
**Every feature for research and power users**

Everything in Full-Featured, plus:
- **Visualization suite** - Agent FSM, AST trees, module graphs, canvas
- **Analytics & monitoring** - Metrics, costs, tool usage tracking
- **Python runtime** - Execute Python via Pyodide + WebAssembly
- **Local LLM** - WebGPU-accelerated local inference
- **WebRTC swarm** - P2P browser-to-browser coordination
- **Meta-cognitive layer** - Autonomous self-improvement
- **Documentation tools** - RFC authoring, blueprint generation
- **Security** - Module integrity, audit logging
- And 48+ more specialized modules...

**Best for:**
- Research and experimentation
- Power users who want everything
- Multi-agent systems
- Bleeding-edge features

---

## Project Philosophy

REPLOID was created to explore:

1. **Meta-Tool Creation** - Agents that can create new tools for themselves
2. **Multi-Model Mixing** - Combining different LLMs for hybrid intelligence
3. **Browser-Native Agents** - No backend required, runs 100% in the browser
4. **Recursive Self-Improvement (RSI)** - Agents that can improve their own code

The **Meta-RSI Core** tier focuses on this original vision without overwhelming complexity.

---

## Architecture

```
Essential (8)     →  Basic agent runtime
    ↓
Meta (15)         →  YOUR VISION: Meta-tools + multi-model
    ↓
Full (28)         →  Production features + testing
    ↓
Experimental (76) →  Everything + research features
```

Each tier builds on the previous one. Start simple, upgrade as needed.

---

## Key Features by Tier

| Feature | Essential | Meta | Full | Experimental |
|---------|-----------|------|------|--------------|
| Agent cognitive loop | ✓ | ✓ | ✓ | ✓ |
| Virtual file system | ✓ | ✓ | ✓ | ✓ |
| Tool execution | ✓ | ✓ | ✓ | ✓ |
| Basic UI | ✓ | ✓ | ✓ | ✓ |
| Single LLM provider | ✓ | ✓ | ✓ | ✓ |
| **Meta-tool creator** | | ✓ | ✓ | ✓ |
| **Multi-model mixing** | | ✓ | ✓ | ✓ |
| **Code introspection** | | ✓ | ✓ | ✓ |
| **Streaming responses** | | ✓ | ✓ | ✓ |
| Performance monitoring | | | ✓ | ✓ |
| Browser APIs | | | ✓ | ✓ |
| Self-testing | | | ✓ | ✓ |
| Visualization suite | | | | ✓ |
| Python runtime | | | | ✓ |
| Local LLM | | | | ✓ |
| WebRTC swarm | | | | ✓ |

---

## File Structure

```
/reploid
  ├── index.html              # Boot UI and entry point
  ├── config.json             # Module config with 4-tier system
  ├── /upgrades               # All 76 modules (tagged by tier)
  ├── /blueprints             # Design docs for each module
  ├── /tests                  # Test suite
  └── /docs                   # Additional documentation
```

---

## Configuration

Edit `config.json` to:
- Configure boot modes
- Adjust module loading
- Set LLM providers (Gemini, OpenAI, Anthropic, Local)
- Configure WebRTC settings
- Customize permissions

---

## Example: Meta-Tool Creation

```javascript
// With Meta-RSI Core, agents can create new tools:
const newTool = {
  name: "analyze_performance",
  description: "Analyze code performance bottlenecks",
  input_schema: {
    type: "object",
    properties: {
      code: { type: "string" }
    }
  },
  handler: (input) => {
    // Tool implementation
    return analyzeCode(input.code);
  }
};

// Agent can register this tool and use it immediately
await MTCP.createTool(newTool);
```

---

## Example: Multi-Model Mixing

```javascript
// Mix different models in one workflow:
const geminiResponse = await HYBR.query({
  provider: "gemini",
  model: "gemini-2.5-flash",
  prompt: "Design a UI component"
});

const claudeReview = await HYBR.query({
  provider: "anthropic",
  model: "claude-4-5-sonnet",
  prompt: `Review this design: ${geminiResponse}`
});

// Combine strengths of different models
```

---

## FAQ

**Q: Which tier should I start with?**
A: Start with **Meta-RSI Core** (recommended). It has the original vision features without complexity.

**Q: Can I switch tiers later?**
A: Yes! Just reload with a different boot mode. Your VFS data persists in IndexedDB.

**Q: What's the difference between Essential and Meta?**
A: Essential is bare minimum (8 modules). Meta adds the core vision: meta-tool creation, multi-model mixing, and introspection (15 modules total).

**Q: Do I need all 76 modules?**
A: No! Most users need 15-28 modules. The Experimental tier (76) is for research and power users.

**Q: Is this actually running in the browser?**
A: Yes! 100% browser-native. No backend server required. LLM calls go directly to provider APIs.

**Q: Can agents modify their own code?**
A: Yes, with RSI (Recursive Self-Improvement) modules. Enable with Meta tier or higher.

---

## Advanced Documentation

For the comprehensive documentation (architecture, RSI workflows, blueprints, etc.), see:
- **[Full Documentation](./docs/INDEX.md)** - Complete guide to all features
- **[Blueprints](./blueprints/README.md)** - Design docs for 76 modules
- **[API Reference](./docs/API.md)** - Module documentation
- **[Testing Guide](./tests/README.md)** - Test suite documentation

---

## Contributing

REPLOID follows the **1:1:1:1 pattern**:
- 1 Module
- 1 Blueprint
- 1 Test
- 1 Widget (in same file)

See `docs/MCP_TOOLS_VS_UPGRADES.md` and `blueprints/0x00004E-module-widget-protocol.md` before creating new modules.

---

## License

See LICENSE file.

---

**Built with the vision of tools that create tools.**
