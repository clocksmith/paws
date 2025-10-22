# REPLOID Configuration Guide

## Overview

REPLOID uses a **single-file configuration system** with optional user overrides for simplicity and flexibility.

### Configuration Files

| File | Purpose | Edit? | Size |
|------|---------|-------|------|
| **`config.json`** | Full defaults + system catalog | ❌ NO* | ~1600 lines |
| **`.reploidrc.json`** | User overrides ONLY | ✅ YES | ~10-50 lines |
| **`.env`** | Secrets (API keys) | ✅ YES | ~10 lines |

*You CAN edit config.json, but it's better to use `.reploidrc.json` for your changes.

---

## How It Works

### Loading Order:
```
1. Load config.json (full defaults)
2. If .reploidrc.json exists → deep merge on top
3. Result = final configuration
```

### Example:

**config.json** (defaults):
```json
{
  "ui": {
    "theme": "cyberpunk",
    "showAdvancedLogs": false,
    "statusUpdateInterval": 1000
  },
  "providers": {
    "default": "local"
  }
}
```

**`.reploidrc.json`** (your overrides):
```json
{
  "ui": {
    "theme": "neon",
    "showAdvancedLogs": true
  }
}
```

**Result** (merged):
```json
{
  "ui": {
    "theme": "neon",              // ← overridden
    "showAdvancedLogs": true,     // ← overridden
    "statusUpdateInterval": 1000  // ← default kept
  },
  "providers": {
    "default": "local"             // ← default kept
  }
}
```

---

## Quick Start

### Option 1: Minimal Override (Recommended)
Copy the minimal example:
```bash
cp .reploidrc.json.minimal .reploidrc.json
nano .reploidrc.json
```

Edit to your preferences:
```json
{
  "providers": {
    "default": "gemini"
  },
  "ui": {
    "theme": "neon"
  }
}
```

### Option 2: Full Example
Copy the comprehensive example:
```bash
cp .reploidrc.json.example .reploidrc.json
nano .reploidrc.json
```

Remove the sections you don't want to override.

### Option 3: No Overrides
If you're happy with defaults, you don't need `.reploidrc.json` at all!

---

## Configuration Sections

### `providers` - Model Selection
```json
{
  "providers": {
    "default": "local",              // "local", "gemini", "openai", "anthropic"
    "geminiModelFast": "gemini-2.5-flash-lite",
    "geminiModelBalanced": "gemini-2.5-flash",
    "openaiModelFast": "gpt-5-2025-08-07-mini",
    "anthropicModelFast": "claude-4-5-haiku"
  }
}
```

### `server` - Proxy Server Settings
```json
{
  "server": {
    "port": 8000,
    "host": "localhost",
    "corsOrigins": ["http://localhost:8080"],
    "sessionTimeout": 3600000,
    "maxSessions": 100
  }
}
```

### `api` - API Client Settings
```json
{
  "api": {
    "provider": "local",               // "local", "gemini", "openai", etc.
    "localEndpoint": "http://localhost:11434",
    "timeout": 180000,
    "maxRetries": 3
  }
}
```

### `ollama` - Local Model Settings
```json
{
  "ollama": {
    "autoStart": false,
    "defaultModel": "gpt-oss:120b",
    "fallbackModel": "gpt-oss:20b",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

### `ui` - User Interface
```json
{
  "ui": {
    "theme": "cyberpunk",              // "cyberpunk", "neon", "minimal"
    "showAdvancedLogs": false,
    "statusUpdateInterval": 1000,
    "confirmDestructive": true
  }
}
```

### `permissions` - Tool Security
```json
{
  "permissions": {
    "policies": [
      {
        "tool": "read",
        "rule": "allow"                // "allow", "ask", "deny"
      },
      {
        "tool": "write",
        "rule": "ask",
        "description": "Requires confirmation for file writes"
      },
      {
        "tool": "bash",
        "rule": "deny"
      }
    ]
  }
}
```

**Permission Rules:**
- `allow` - Tool can be used without confirmation
- `ask` - User confirmation required before use
- `deny` - Tool is completely disabled

### `curatorMode` - Automated Review
```json
{
  "curatorMode": {
    "enabled": false,
    "autoApproveContext": true,
    "maxProposalsPerGoal": 7,
    "iterationDelayMs": 5000
  }
}
```

### `structuredCycle` - Iteration Control
```json
{
  "structuredCycle": {
    "enabled": true,
    "confidenceThresholds": {
      "autoApply": 0.85,
      "showWarning": 0.5,
      "requireApproval": 0.3
    }
  }
}
```

---

## Common Use Cases

### Use Case 1: Cloud-Only (Gemini)
```json
{
  "providers": {
    "default": "gemini"
  },
  "api": {
    "provider": "gemini"
  }
}
```

Then add to `.env`:
```bash
GEMINI_API_KEY=your_key_here
```

### Use Case 2: Local-Only (Ollama)
```json
{
  "providers": {
    "default": "local"
  },
  "api": {
    "provider": "local"
  },
  "ollama": {
    "defaultModel": "llama3.1:latest"
  }
}
```

### Use Case 3: Development Mode (Permissive)
```json
{
  "permissions": {
    "policies": [
      {"tool": "read", "rule": "allow"},
      {"tool": "write", "rule": "allow"},
      {"tool": "bash", "rule": "ask"},
      {"tool": "delete", "rule": "ask"}
    ]
  },
  "ui": {
    "showAdvancedLogs": true
  }
}
```

### Use Case 4: Production Mode (Locked Down)
```json
{
  "permissions": {
    "policies": [
      {"tool": "read", "rule": "allow"},
      {"tool": "write", "rule": "ask"},
      {"tool": "bash", "rule": "deny"},
      {"tool": "delete", "rule": "deny"}
    ]
  },
  "curatorMode": {
    "enabled": true,
    "autoApproveContext": false
  }
}
```

---

## Migration from Old Config

### Before (3 files):
- `.env` - API keys
- `.reploidrc.json` - Everything else
- `permissions.json` - Tool permissions

### After (2 files):
- `.env` - API keys (unchanged)
- `.reploidrc.json` - ONLY your overrides

All defaults now live in `config.json`, which you rarely need to touch.

---

## Validation

REPLOID validates your configuration at startup:
- Browser: Check browser console for `[Config]` messages
- Server: Check terminal for `[Config]` messages

**Example successful load:**
```
[Config] Loading configuration from config.json...
[Config] Loaded base config from: /path/to/config.json
[Config] Found .reploidrc.json, applying overrides...
[Config] Applied overrides from: /path/to/.reploidrc.json
[Config] Configuration loaded successfully
```

**Example with no overrides:**
```
[Config] Loading configuration from config.json...
[Config] No .reploidrc.json overrides found, using base config.json
[Config] Configuration loaded successfully
```

---

## Troubleshooting

### Override not working?
1. Check JSON syntax: `cat .reploidrc.json | jq .`
2. Check browser console for `[Config]` errors
3. Ensure property path matches config.json structure

### Want to reset to defaults?
```bash
rm .reploidrc.json
# Or rename it:
mv .reploidrc.json .reploidrc.json.backup
```

### Want to see final merged config?
Open browser console and run:
```javascript
window.DIContainer.resolve('Config').api.getAll()
```

---

## Advanced: Environment Variable Substitution

Use `${VAR_NAME}` in `.reploidrc.json` to reference `.env` variables:

**`.env`:**
```bash
MY_OLLAMA_MODEL=qwen3.3:latest
```

**`.reploidrc.json`:**
```json
{
  "ollama": {
    "defaultModel": "${MY_OLLAMA_MODEL}"
  }
}
```

---

## API Access (for Modules)

### Browser (upgrades/modules):
```javascript
const Config = window.DIContainer.resolve('Config');

// Get any value
const theme = Config.api.get('ui.theme', 'cyberpunk');

// Get specific sections
const uiConfig = Config.api.getUi();
const serverConfig = Config.api.getServer();

// Check permissions
const canWrite = Config.api.isToolAllowed('write');
const needsConfirm = Config.api.isToolAsk('bash');
const isDenied = Config.api.isToolDenied('delete');
```

### Server (Node.js):
```javascript
const { load } = require('./utils/config-loader');

const config = await load();
const port = config.get('server.port', 8000);
```

---

## Summary

✅ **One user file**: `.reploidrc.json` (10-50 lines)
✅ **Override only what you need**: Everything else uses defaults
✅ **Deep merge**: Override specific nested properties
✅ **Backward compatible**: Existing code continues to work
✅ **Validated**: Errors caught at startup

**Bottom line:** Edit `.reploidrc.json` (or create it from examples), leave `config.json` alone.
