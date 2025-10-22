# Model Registry

The `ModelRegistry` module provides runtime discovery and enumeration of available LLM models across all providers.

## Features

- **Runtime Model Discovery** - Automatically detects which models are available
- **Multi-Provider Support** - Gemini, OpenAI, Anthropic, Ollama, WebLLM
- **Smart Caching** - 1-minute TTL to avoid excessive API calls
- **Intelligent Recommendations** - Suggests best models for specific tasks (e.g., judges)

---

## API

### `discoverModels(forceRefresh?): Promise<Object>`

Discovers all available models across all providers.

```javascript
const registry = await ModelRegistry.api.discoverModels();

// Returns:
{
  gemini: [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      tier: 'balanced',
      contextWindow: 1000000,
      available: true
    },
    ...
  ],
  openai: [...],
  anthropic: [...],
  ollama: [...],
  webllm: [...],
  metadata: {
    timestamp: 1698765432000,
    providers: ['gemini', 'openai', 'anthropic']
  }
}
```

---

### `getAllModels(options?): Promise<Array>`

Get all available models as a flat list.

```javascript
// All models
const models = await ModelRegistry.api.getAllModels();

// Filter by provider
const geminiModels = await ModelRegistry.api.getAllModels({
  provider: 'gemini'
});

// Filter by tier
const fastModels = await ModelRegistry.api.getAllModels({
  tier: 'fast'
});

// Force refresh cache
const models = await ModelRegistry.api.getAllModels({
  forceRefresh: true
});
```

---

### `getModelIds(options?): Promise<Array<string>>`

Get just the model IDs (useful for dropdowns).

```javascript
const ids = await ModelRegistry.api.getModelIds();
// Returns: ['gemini-2.5-flash', 'gpt-5-2025-08-07', 'claude-4-5-sonnet', ...]

const geminiIds = await ModelRegistry.api.getModelIds({
  provider: 'gemini'
});
// Returns: ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
```

---

### `getModel(modelId): Promise<Object|null>`

Get details for a specific model.

```javascript
const model = await ModelRegistry.api.getModel('claude-4-5-sonnet');
// Returns:
{
  id: 'claude-4-5-sonnet',
  name: 'Claude 4.5 Sonnet',
  provider: 'anthropic',
  tier: 'balanced',
  contextWindow: 200000,
  available: true
}
```

---

### `getRecommendedJudge(): Promise<string>`

Get the best available model for judging/evaluation tasks.

**Priority:**
1. `claude-4-5-sonnet` (Anthropic Claude)
2. `gpt-5-2025-08-07` (OpenAI GPT-5)
3. `gemini-2.5-flash` (Google Gemini)
4. `claude-4-5-haiku` (Fast Claude)
5. `gpt-5-2025-08-07-mini` (Fast GPT)
6. First available model

```javascript
const judge = await ModelRegistry.api.getRecommendedJudge();
// Returns: 'claude-4-5-sonnet' (if available)
```

---

### `clearCache()`

Force cache invalidation.

```javascript
ModelRegistry.api.clearCache();
```

---

## How It Works

### 1. Provider Detection

**Proxy Mode:**
- Checks `/api/proxy-status` endpoint
- Server returns which API keys are configured

**Browser-Only Mode:**
- Checks localStorage for API keys (`GEMINI_API_KEY`, etc.)

### 2. Model Enumeration

**Cloud Models (Gemini, OpenAI, Anthropic):**
- Static list from `config.json`
- Loaded at runtime
- Filtered by provider availability

**Ollama Models:**
- Queries `/api/ollama/models` endpoint
- Lists all installed local models
- Returns model name, size, modified date

**WebLLM Models:**
- Checks for WebGPU browser support
- Returns pre-configured browser models
- Requires modern browser with GPU

### 3. Caching

- Cache TTL: 60 seconds
- Automatic invalidation on expiry
- Manual refresh with `forceRefresh: true`
- Cleared on module reload

---

## Events

### `model-registry:updated`

Emitted when model registry is refreshed.

```javascript
EventBus.on('model-registry:updated', (data) => {
  console.log('Providers:', data.providers);
  console.log('Total models:', data.totalModels);
});
```

**Payload:**
```javascript
{
  providers: ['gemini', 'openai', 'anthropic'],
  totalModels: 6,
  timestamp: 1698765432000
}
```

---

## Usage in Consensus Mechanisms

### Model Arena

```javascript
const result = await ModelArena.api.runCompetition(objective, {
  models: await ModelRegistry.api.getModelIds({ provider: 'gemini' }),
  judgeModel: await ModelRegistry.api.getRecommendedJudge()
});
```

### Peer Review Consensus

```javascript
const models = await ModelRegistry.api.getModelIds({ tier: 'balanced' });

const result = await PeerReviewConsensus.api.runConsensus(prompt, {
  models: models.slice(0, 3),  // Take first 3 balanced models
  tiebreakerMethod: 'paxos'
});
```

### Paxos Consensus

```javascript
// Paxos uses 3 hardcoded models, but could use registry:
const models = await ModelRegistry.api.getAllModels({ tier: 'balanced' });
// Filter to exactly 3 for Paxos quorum...
```

---

## Model Tiers

Models are classified by tier:

| Tier | Description | Examples |
|------|-------------|----------|
| `fast` | Fast, cheap, lower quality | gemini-2.5-flash-lite, gpt-5-mini, claude-4-5-haiku |
| `balanced` | Good balance of speed/quality | gemini-2.5-flash, gpt-5, claude-4-5-sonnet |
| `advanced` | Highest quality, slower | gpt-5-2025-08-07 (full) |
| `local` | Self-hosted Ollama | llama2, mistral, etc. |
| `browser` | WebGPU browser models | Qwen, Phi, Llama-3.2 |

---

## Dependencies

- **Utils** - Logging
- **EventBus** - Event emission
- **Config** - Model configuration

**Optional:**
- Proxy server (for Ollama discovery)
- localStorage (for browser-only API keys)

---

## File Location

`/Users/xyz/deco/paws/packages/reploid/upgrades/model-registry.js`

---

## Integration

The ModelRegistry is automatically used by:
- **ModelArena** - For judge selection
- **PeerReviewConsensus** - For available model discovery
- Boot UI - For populating model dropdowns (future)

---

*Last Updated: 2025-10-21*
