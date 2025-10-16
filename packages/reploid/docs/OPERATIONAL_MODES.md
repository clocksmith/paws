# REPLOID Operational Modes

This document describes the different ways to run and configure REPLOID.

---

## Mode Overview

| Mode | Setup Time | Privacy | Cost | Best For |
|------|------------|---------|------|----------|
| **Client-Only (Browser)** | < 1 min | High (API key in browser) | API fees | Quick start, demos |
| **Client + API Keys** | < 2 min | High (keys in browser) | API fees | Multiple LLM providers |
| **Node.js Server** | 5 min | Highest (keys on server) | API fees | Team collaboration |
| **Local WebGPU** | 10 min (initial download) | Maximum (100% local) | $0 | Privacy, offline, cost-free |

---

## Mode 1: Client-Only (Browser)

**How it works:** REPLOID runs entirely in your browser. You paste an API key directly into the UI.

### Setup

1. Serve the directory:
```bash
python -m http.server 8000
# or
npx serve
```

2. Open `http://localhost:8000`

3. Click the ⛭ config button in the top-right

4. Select your provider and paste API key:
   - **Gemini**: Get key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **OpenAI**: Get key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Anthropic**: Get key from [Anthropic Console](https://console.anthropic.com/)

5. Click "Save Configuration"

### Pros
- Zero installation
- Works anywhere
- No server needed

### Cons
- API key visible in browser memory
- No multi-user support
- Can't use server-side features (git worktrees, Hermes)

---

## Mode 2: Client + Multiple API Keys

**How it works:** Same as Mode 1, but you configure multiple providers with fallback.

### Setup

1. Follow Mode 1 setup

2. In config modal, add keys for multiple providers:
   - Primary: Gemini (fast, cheap)
   - Fallback 1: OpenAI (reliable)
   - Fallback 2: Anthropic (high quality)

3. REPLOID will automatically fallback if primary fails

### Pros
- High availability
- Cost optimization (use cheapest first)
- Provider diversity

### Cons
- Requires API keys from multiple providers
- Higher complexity

---

## Mode 3: Node.js Server

**How it works:** Node.js backend handles API calls. Browser communicates via proxy.

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
# Required: At least one API key
GEMINI_API_KEY=your_key_here

# Optional: Additional providers
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Optional: Local Ollama
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama2
```

3. Start server:
```bash
npm start
```

4. Open `http://localhost:8000`

### Pros
- API keys hidden from browser
- WebSocket streaming support
- Git worktree isolation
- Hermes multi-agent orchestration
- Team collaboration
- Session persistence

### Cons
- Requires Node.js installation
- Server must stay running
- More complex deployment

### Features Available

- ✅ All client-side features
- ✅ PAWS CLI integration (`cats.js`, `dogs.js`, `paws-session.js`)
- ✅ Hermes multi-agent Paxos orchestration
- ✅ Git worktree session management
- ✅ WebSocket real-time streaming
- ✅ Shared sessions across team members

---

## Mode 4: Local WebGPU (Browser-Native LLM)

**How it works:** Download and run LLM models directly in your browser using WebGPU acceleration.

### Requirements

- **Browser**: Chrome/Edge 113+ with WebGPU enabled
- **GPU**: Discrete GPU recommended (Intel/AMD/NVIDIA)
- **RAM**: 4-8GB available
- **Storage**: 1-4GB per model

### Setup

1. Open REPLOID in browser (Mode 1 or 3)

2. Click "Local LLM" tab in dashboard

3. Check WebGPU status (should show "Available")

4. Select a model:
   - **Qwen2.5-Coder-1.5B** (~900MB) - Best for coding
   - **Phi-3.5 Mini** (~2.1GB) - Balanced
   - **Llama 3.2 1B** (~900MB) - Fast inference
   - **Gemma 2 2B** (~1.2GB) - High quality

5. Click "☇ Load Model"

6. Wait for download (one-time, cached in browser)

7. Toggle "Use Local LLM" in settings

### Pros
- **$0 cost** - No API fees ever
- **100% private** - Data never leaves your machine
- **Offline** - Works without internet
- **Fast** - GPU-accelerated inference

### Cons
- **Initial download** - 900MB-4GB per model
- **GPU required** - WebGPU not available on all devices
- **Limited capabilities** - Smaller models less capable than GPT-4/Claude
- **Memory intensive** - Requires 4-8GB RAM

### Performance

| Model | Size | Tokens/sec | Quality | Use Case |
|-------|------|------------|---------|----------|
| Qwen2.5-Coder-1.5B | 900MB | 50-150 | Good | Coding tasks |
| Phi-3.5 Mini | 2.1GB | 30-80 | Better | General purpose |
| Llama 3.2 1B | 900MB | 80-200 | Good | Fast responses |
| Gemma 2 2B | 1.2GB | 40-100 | Better | Balanced |

### Vision Models

Some models support image inputs:
- **Phi-3.5 Vision** (~4.2GB) - Image understanding
- **LLaVA 1.5 7B** (~4.5GB) - Advanced vision

Upload images in the "Test Inference" section.

---

## Hybrid Mode: Local + Cloud Fallback

**How it works:** Use local WebGPU by default, fallback to cloud if needed.

### Setup

1. Configure Mode 4 (Local WebGPU)
2. Also configure Mode 1 or 3 (Cloud API)
3. Enable "Auto-fallback" in settings

### Behavior

- **Default**: Uses local WebGPU LLM
- **Fallback**: If local fails or times out, uses cloud API
- **Smart routing**: Complex queries → cloud, simple queries → local

### Pros
- Best of both worlds
- Cost optimization
- High availability

---

## Comparing Modes

### Privacy

**Maximum → Minimum:**
1. Local WebGPU (100% local)
2. Node.js Server (keys on your server)
3. Client + API Keys (keys in browser memory)
4. Client-Only (keys in browser memory)

### Cost

**Free → Most Expensive:**
1. Local WebGPU ($0)
2. Node.js Server (Gemini Flash ~$0.02/goal)
3. Client + API Keys (depends on provider)
4. Client-Only (depends on provider)

### Features

**Most → Least:**
1. Node.js Server (all features)
2. Client + API Keys (no server features)
3. Client-Only (no server features)
4. Local WebGPU (no API-dependent features)

### Complexity

**Simplest → Most Complex:**
1. Client-Only (< 1 min)
2. Client + API Keys (< 2 min)
3. Local WebGPU (10 min first time)
4. Node.js Server (5 min setup)

---

## Switching Between Modes

You can change modes anytime:

### From Client-Only to Server

1. Create `.env` file with API keys
2. Run `npm start`
3. Refresh browser

### From Cloud to Local

1. Load WebGPU model
2. Toggle "Use Local LLM" in settings
3. Keep cloud API as fallback

### From Local to Cloud

1. Toggle "Use Local LLM" off
2. Configure cloud API key
3. Click "Save Configuration"

---

## Troubleshooting

### Client-Only: "API key invalid"
- Check key is correct
- Try pasting again (no extra spaces)
- Check API provider status

### Server: "Connection refused"
- Make sure server is running (`npm start`)
- Check port 8000 is available
- Verify `.env` file exists

### Local WebGPU: "WebGPU not available"
- Use Chrome/Edge 113+
- Enable chrome://flags/#enable-unsafe-webgpu
- Check GPU drivers are up to date
- Try Firefox Nightly with WebGPU flag

### Local WebGPU: "Model loading failed"
- Check available disk space (need 1-4GB)
- Check available RAM (need 4-8GB)
- Try smaller model (Qwen 1.5B or Llama 1B)
- Clear browser cache and retry

---

## Recommended Workflows

### For Learning / Experimenting
→ **Client-Only** with Gemini (fastest setup)

### For Privacy-Conscious Development
→ **Local WebGPU** with no cloud fallback

### For Team Collaboration
→ **Node.js Server** with git worktrees

### For Cost Optimization
→ **Hybrid** (Local WebGPU + Cloud fallback)

### For Maximum Quality
→ **Client + API Keys** with Claude 3.5 Sonnet

---

## Next Steps

- **Client-Only**: See [Quick Start Guide](QUICK-START.md)
- **Node.js Server**: See [Installation](#) and [Hermes README](../hermes/README.md)
- **Local WebGPU**: See [Local Models Guide](LOCAL_MODELS.md)
- **API Reference**: See [API Documentation](API.md)
