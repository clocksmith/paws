# Reploid Deployment Modes

This document explains all the different ways to run Reploid, from fully offline to cloud-based configurations.

## Overview

Reploid can run in multiple configurations depending on your needs, available resources, and privacy requirements.

---

## Mode 1: Full Local Stack (Recommended for Development)

**What runs:** Browser + Node.js Proxy Server + Ollama

**Requirements:**
- Node.js installed
- Ollama installed and running (`ollama serve`)
- At least one model pulled (e.g., `ollama pull gpt-oss:120b`)

**How to start:**
```bash
npm start
# Opens http://localhost:8000
```

**Configuration in `.env`:**
```env
PORT=8000
LOCAL_MODEL_ENDPOINT=http://localhost:11434
AUTO_START_OLLAMA=true  # Optional: auto-start Ollama
```

**What you get:**
- ✅ Full VFS persistence via proxy server
- ✅ Local model inference (no API costs)
- ✅ WebRTC signaling support
- ✅ No data sent to cloud providers
- ✅ Fast iteration with auto-reload

**Best for:** Development, privacy-conscious users, unlimited usage without API costs

---

## Mode 2: Cloud Provider via Proxy (Hybrid)

**What runs:** Browser + Node.js Proxy Server + Cloud API

**Requirements:**
- Node.js installed
- API key from Gemini, OpenAI, or Anthropic

**How to start:**
```bash
# Add your API key to .env
echo "GEMINI_API_KEY=your_key_here" >> .env
npm start
```

**Configuration in `.env`:**
```env
PORT=8000
GEMINI_API_KEY=AIza...
# or
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

**In Settings UI:**
1. Click ⚙ (Settings)
2. Select cloud model (e.g., "Gemini 2.0 Flash")
3. Enter API key
4. Save Configuration

**What you get:**
- ✅ VFS persistence via proxy server
- ✅ Cloud model capabilities (vision, large context)
- ✅ Faster inference than local models
- ❌ API costs apply
- ❌ Data sent to cloud provider

**Best for:** Production use, when you need advanced model capabilities

---

## Mode 3: Browser-Only (Static Deployment)

**What runs:** Browser only (no backend)

**Requirements:**
- Web server to serve static files (or file:// protocol)
- No Node.js needed

**How to start:**
```bash
# Using Python's built-in server
python3 -m http.server 8080

# Or any other static file server
# Then open http://localhost:8080
```

**Limitations:**
- ❌ No VFS persistence to disk
- ❌ No WebRTC signaling server
- ❌ Can't use Ollama directly (would need CORS-enabled Ollama)
- ✅ Can use cloud APIs (with browser CORS)
- ✅ Can use Web LLM (browser-based inference)

**What you get:**
- ✅ Simple deployment (just HTML/JS/CSS)
- ✅ Can deploy to GitHub Pages, Netlify, Vercel
- ✅ No server maintenance
- ⚠️ Limited functionality

**Best for:** Demos, public showcases, minimal deployments

---

## Mode 4: Fully Offline (No Internet)

**What runs:** Browser + Node.js Proxy + Ollama (airgapped)

**Requirements:**
- Node.js installed
- Ollama installed with models pre-pulled
- No internet connection

**How to start:**
```bash
# Pull models while online
ollama pull gpt-oss:120b
ollama pull qwen3:30b

# Then disconnect from internet
npm start
```

**Configuration:**
- Use local Ollama models only
- Disable all cloud providers
- Optionally enable Web LLM for browser-based inference

**What you get:**
- ✅ Complete privacy (no network traffic)
- ✅ Works in secure/airgapped environments
- ✅ Unlimited usage
- ✅ VFS persistence
- ❌ Limited to local model capabilities

**Best for:** Security-sensitive environments, privacy-focused users

---

## Mode 5: Web LLM (Browser Inference)

**What runs:** Browser only with WebGPU

**Requirements:**
- Modern browser with WebGPU support (Chrome/Edge 113+)
- GPU with sufficient VRAM (4GB+ recommended)
- No server needed

**How to configure:**
1. Open Settings ⚙
2. Select "Web LLM (Browser-based)"
3. Save Configuration
4. Browser will download model on first use

**What you get:**
- ✅ Runs entirely in browser
- ✅ No API costs
- ✅ No server needed
- ✅ Privacy-preserving
- ❌ Limited to smaller models (3B-7B)
- ❌ Slower than native inference
- ❌ Large initial download

**Best for:** Demos, educational use, when no backend is available

---

## Mode 6: Paxos Multi-Model (Distributed)

**What runs:** Browser + Node.js Proxy + Multiple Providers

**Requirements:**
- API keys for 2-3 different providers
- Node.js proxy server

**How to configure:**
1. Open Settings ⚙
2. Enable "Advanced: Multi-Model Setup"
3. Click "Configure strategy"
4. Set Primary, Fallback, and Consensus models
5. Choose strategy: Fastest First, Consensus Vote, or Fallback Chain

**Example configuration:**
```
Primary: gemini-2.0-flash (fast, cheap)
Fallback: gpt-4o (backup)
Consensus: claude-3-opus (tie-breaker)
Strategy: Fastest First
```

**What you get:**
- ✅ Fault tolerance (automatic failover)
- ✅ Best-of-N sampling for quality
- ✅ Load balancing across providers
- ❌ Higher API costs (multiple calls)
- ⚠️ Requires PAXA module to be loaded

**Best for:** Production systems requiring high availability

---

## Mode 7: Custom Proxy/Endpoint

**What runs:** Browser → Your Custom API

**Requirements:**
- Your own API endpoint that accepts LLM requests
- Could be: Azure OpenAI, AWS Bedrock, self-hosted vLLM, etc.

**How to configure:**
1. Open Settings ⚙
2. Select "Custom Proxy/Endpoint"
3. Enter your API URL
4. (Optional) Enter API key if required

**What you get:**
- ✅ Use your own infrastructure
- ✅ Custom models not supported by default
- ✅ Enterprise setups (Azure, AWS, etc.)
- ⚠️ Must implement compatible API format

**Best for:** Enterprise deployments, custom infrastructure

---

## Mode 8: Hybrid Local/Cloud Switching

**What runs:** Browser + Node.js Proxy + Ollama + Cloud APIs

**Requirements:**
- Ollama installed
- At least one cloud API key
- HYBR (hybrid-llm-provider.js) module enabled

**How it works:**
- Automatically switches between local and cloud based on:
  - Model availability
  - Request complexity
  - Rate limits
  - Cost constraints

**Configuration in code:**
```javascript
// The HYBR module handles this automatically
// Falls back to cloud if Ollama is down
// Falls back to local if API quota exceeded
```

**What you get:**
- ✅ Best of both worlds
- ✅ Cost optimization
- ✅ Automatic failover
- ✅ Load balancing

**Best for:** Power users, production with budget constraints

---

## Deployment Matrix

| Mode | Server | Ollama | Cloud API | Internet | VFS Persist | Cost |
|------|--------|--------|-----------|----------|-------------|------|
| **Full Local** | ✅ | ✅ | ❌ | ❌ | ✅ | Free |
| **Cloud via Proxy** | ✅ | ❌ | ✅ | ✅ | ✅ | $$ |
| **Browser-Only** | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | Free/$ |
| **Fully Offline** | ✅ | ✅ | ❌ | ❌ | ✅ | Free |
| **Web LLM** | ❌ | ❌ | ❌ | ⚠️* | ❌ | Free |
| **Paxos Multi** | ✅ | ⚠️ | ✅ | ✅ | ✅ | $$$ |
| **Custom Proxy** | ❌ | ❌ | ✅ | ✅ | ❌ | Varies |
| **Hybrid Switch** | ✅ | ✅ | ✅ | ⚠️ | ✅ | $ |

*Only for initial model download

---

## Configuration Files Reference

### `.env` (Server configuration)
```env
# Server
PORT=8000

# Ollama
LOCAL_MODEL_ENDPOINT=http://localhost:11434
AUTO_START_OLLAMA=true

# Cloud APIs (optional)
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# CORS (for browser-only mode)
# CORS_ORIGINS=http://localhost:8080,https://yourdomain.com
```

### `config.json` (Application configuration)
```json
{
  "providers": {
    "default": "local",
    "fallbackProviders": ["openai", "anthropic", "gemini"],
    "localEndpoint": "http://localhost:11434",
    "localModel": "gpt-oss:120b"
  },
  "ollama": {
    "autoStart": true
  }
}
```

### Browser localStorage (User preferences)
- `SELECTED_MODEL`: Currently selected model
- `AI_PROVIDER`: Selected provider (local, gemini, openai, anthropic)
- `LOCAL_MODEL`: Ollama model name
- `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: API keys
- `ENABLE_WEBRTC`: WebRTC swarm enabled/disabled
- `ENABLE_PAXOS`: Multi-model mode enabled/disabled

---

## Quick Start Recipes

### Recipe 1: "I just want to try it with my Ollama model"
```bash
cd packages/reploid
npm start
# Click ⚙ → Select your model → Save → Enter a goal
```

### Recipe 2: "I want to use GPT-4 but save costs"
```bash
# Add to .env
echo "OPENAI_API_KEY=sk-..." >> .env
npm start
# Settings → Select "GPT-3.5 Turbo (Fast)" → Save
```

### Recipe 3: "I need high availability for production"
```bash
# Add multiple API keys to .env
echo "GEMINI_API_KEY=..." >> .env
echo "OPENAI_API_KEY=..." >> .env
echo "ANTHROPIC_API_KEY=..." >> .env
npm start
# Settings → Enable "Multi-Model Setup" → Configure Paxos
```

### Recipe 4: "I want to deploy publicly without a server"
```bash
# Deploy to Vercel/Netlify/GitHub Pages
# Users must provide their own API keys
# Or use Web LLM for free inference
```

### Recipe 5: "Maximum privacy, no cloud"
```bash
ollama pull llama3:70b
echo "AUTO_START_OLLAMA=true" >> .env
npm start
# Use local models only
```

---

## Security Considerations

### API Keys
- Stored in browser localStorage (client-side only)
- Never sent to Reploid servers
- Can be cleared anytime
- Proxy server never logs keys

### VFS Persistence
- With proxy: Saved to `vfs_backup.json` on server
- Browser-only: Saved to IndexedDB (local only)
- Can be encrypted if needed

### WebRTC (P2P)
- **Disabled by default** for security
- Enable only in trusted environments
- Uses STUN servers (Google) for NAT traversal
- Can configure custom TURN servers

### Network Traffic
- **Local mode**: No external traffic (fully private)
- **Cloud mode**: Only to selected API provider
- **Web LLM**: Initial model download, then offline
- **Paxos**: Multiple provider calls (reduced privacy)

---

## Troubleshooting

### "Ollama · Check runtime" warning
- Ollama not running → Run `ollama serve`
- Wrong endpoint → Check `LOCAL_MODEL_ENDPOINT` in `.env`
- No models → Run `ollama pull <model>`

### "Server Offline" error
- Proxy not running → Run `npm start`
- Wrong port → Check `PORT` in `.env`
- Firewall blocking → Allow port 8000

### API key not working
- Invalid key → Regenerate from provider
- Key not saved → Click "Save Configuration"
- Wrong provider → Check model selection

### Models not appearing in dropdown
- Ollama not running → Start with `ollama serve`
- Proxy not running → Need Node.js server for detection
- Clear browser cache → Hard refresh (Ctrl+Shift+R)

---

## Performance Tips

### For Local Models
- Use quantized models (Q4, Q5) for speed
- Increase Ollama GPU layers: `OLLAMA_NUM_GPU=999`
- Use smaller models for iteration, larger for production

### For Cloud Models
- Use fast models for planning (gemini-flash, gpt-3.5)
- Use advanced models only for final execution
- Enable Paxos with fast primary, smart fallback

### For Web LLM
- Use smallest model that works (Phi-3-mini, Llama-3-8B)
- Ensure GPU is enabled in browser settings
- Close other GPU-intensive apps

---

## Migration Paths

### From Browser-Only → Full Stack
1. Install Node.js
2. Run `npm start`
3. Keep existing localStorage config

### From Cloud → Local
1. Install Ollama
2. Pull models: `ollama pull llama3`
3. Change model in Settings → Save

### From Single → Multi-Model
1. Add multiple API keys to `.env`
2. Enable "Multi-Model Setup" in Settings
3. Configure Paxos strategy

---

## Cost Optimization

### Free Tier
- Use Ollama with local models (completely free)
- Use Web LLM (free, but slower)
- Use Gemini Flash free tier (1500 RPD)

### Budget Mode
- Primary: `ollama-llama3` (free)
- Fallback: `gemini-2.0-flash` (cheap)
- Use cloud only when local fails

### Production Mode
- Primary: `gemini-2.0-flash` (fast, cheap)
- Fallback: `gpt-4o-mini` (reliable)
- Consensus: `claude-3-5-sonnet` (quality)

---

## Next Steps

1. Choose your deployment mode from above
2. Follow the configuration steps
3. Test with a simple goal: "Create a hello world function"
4. Adjust settings based on performance/cost
5. Scale up as needed

For more details, see:
- [Setup Guide](./README.md)
- [Configuration Reference](./config.json)
- [API Documentation](./docs/API.md)
