# Running REPLOID with Local Models

This guide explains how to run REPLOID with local language models using Ollama, LM Studio, or other compatible local model servers.

## Quick Start

### 1. Install a Local Model Server

Choose one of the following:

#### Option A: Ollama (Recommended)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (e.g., Llama 2)
ollama pull llama2

# Start Ollama server (runs on port 11434 by default)
ollama serve
```

#### Option B: LM Studio
1. Download LM Studio from [https://lmstudio.ai/](https://lmstudio.ai/)
2. Install and launch LM Studio
3. Download a model from the UI
4. Start the local server (runs on port 1234 by default)

### 2. Configure REPLOID

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` to configure your providers:
```env
# Optional: Add API keys for cloud providers
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Configure local model endpoint
# For Ollama (default):
LOCAL_MODEL_ENDPOINT=http://localhost:11434

# For LM Studio:
# LOCAL_MODEL_ENDPOINT=http://localhost:1234
```

### 3. Start the REPLOID Proxy Server

```bash
npm install
npm start
```

The proxy server will automatically detect available providers and display them on startup:

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   REPLOID Multi-Provider Proxy Server                 ║
║                                                        ║
║   URL: http://localhost:8000                          ║
║   Providers: Gemini, OpenAI, Local                    ║
║   Local endpoint: http://localhost:11434              ║
║                                                        ║
║   Press Ctrl+C to stop                                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

### 4. Access REPLOID

Open your browser and navigate to: `http://localhost:8000`

## Supported Local Model Formats

The proxy server supports any Ollama-compatible API, including:

- **Ollama**: Native support for all Ollama models
- **LM Studio**: Compatible with the OpenAI-style API
- **LocalAI**: Drop-in replacement for OpenAI API
- **Text Generation WebUI**: With API extension enabled

## Provider Selection

REPLOID now supports multiple providers. The system will:

1. **Auto-detect** available providers based on configured API keys
2. **Auto-select** the best available provider in this order:
   - Gemini (if API key configured)
   - OpenAI (if API key configured)  
   - Anthropic (if API key configured)
   - Local (always available)

## Switching Providers at Runtime

To switch providers programmatically, the agent can use:

```javascript
// In the browser console or agent code
ApiClient.setProvider('local');  // Switch to local model
ApiClient.setProvider('gemini'); // Switch to Gemini
ApiClient.setProvider('openai'); // Switch to OpenAI
```

## Configuring Models

Edit `config.json` to set default models for each provider:

```json
"providers": {
  "default": "local",
  "fallbackProviders": ["gemini", "openai"],
  "localEndpoint": "http://localhost:11434",
  "localModel": "llama2",
  "geminiModel": "gemini-1.5-flash-latest",
  "openaiModel": "gpt-4-turbo-preview",
  "anthropicModel": "claude-3-opus-20240229"
}
```

## Testing Your Setup

### Test Ollama Connection
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Hello, world!"
}'
```

### Test REPLOID Proxy
```bash
# Check proxy status
curl http://localhost:8000/api/proxy-status

# Test local model through proxy
curl http://localhost:8000/api/local/api/generate -H "Content-Type: application/json" -d '{
  "model": "llama2",
  "prompt": "Hello from REPLOID!"
}'
```

## Troubleshooting

### Local Model Not Responding

1. **Check if the model server is running:**
   ```bash
   # For Ollama
   ps aux | grep ollama
   
   # Check if port is listening
   lsof -i :11434
   ```

2. **Verify the model is installed:**
   ```bash
   ollama list
   ```

3. **Check proxy server logs** for connection errors

### Performance Issues

- **Model Size**: Smaller models (7B parameters) work better for real-time interaction
- **Quantization**: Use quantized models (e.g., Q4_0) for better performance
- **Context Length**: Limit context length for faster responses

### Recommended Local Models

For best performance with REPLOID:

1. **Llama 2 7B** - Good balance of capability and speed
   ```bash
   ollama pull llama2
   ```

2. **Mistral 7B** - Fast and capable
   ```bash
   ollama pull mistral
   ```

3. **Phi-2** - Very fast, smaller model
   ```bash
   ollama pull phi
   ```

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│ Node Proxy   │────▶│ Local Model │
│  (REPLOID)  │     │   (Port 8000)│     │  (Ollama)   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Cloud APIs   │
                    │ (Gemini, etc)│
                    └──────────────┘
```

The proxy server acts as a unified interface, routing requests to either local models or cloud APIs based on configuration and availability.

## Security Notes

- The proxy server only accepts connections from localhost by default
- API keys are stored server-side and never exposed to the browser
- Local models run entirely on your machine with no external data transmission
- All VFS operations remain sandboxed in the browser

## Advanced Configuration

### Custom Model Endpoints

You can configure custom endpoints for other model servers:

```env
# For a custom model server
LOCAL_MODEL_ENDPOINT=http://192.168.1.100:5000

# For Text Generation WebUI
LOCAL_MODEL_ENDPOINT=http://localhost:5000
```

### Model-Specific Settings

Different models may require different prompt formats. Configure these in the agent's system prompt or via runtime configuration.

## Contributing

To add support for additional local model formats:

1. Extend the `LocalProvider` class in `upgrades/multi-provider-api.js`
2. Add endpoint handling in `server/proxy.js`
3. Update this documentation

## FAQ

**Q: Can I run completely offline?**
A: Yes! With a local model configured, REPLOID can operate entirely offline.

**Q: Which provider is fastest?**
A: Local models have lowest latency but may have lower capability. Cloud APIs offer better quality but add network latency.

**Q: Can I use multiple providers simultaneously?**
A: Yes, the system supports automatic fallback to alternate providers if the primary fails.

**Q: How much RAM/VRAM do I need?**
A: Depends on model size. 7B models typically need 4-8GB, 13B models need 8-16GB.