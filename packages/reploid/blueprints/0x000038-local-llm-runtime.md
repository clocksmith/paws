# Blueprint 0x000038: Local LLM Runtime

**Objective:** Capture the design considerations for running quantized LLMs inside the browser via WebLLM and WebGPU.

**Target Upgrade:** LLMR (`local-llm.js`)

**Prerequisites:** 0x000027 (Multi-Provider API Gateway), 0x00002C (Performance Monitoring Stack), WebLLM CDN import

**Affected Artifacts:** `/upgrades/local-llm.js`, `/index.html` (WebLLM script tag), `/styles/dashboard.css`, `/upgrades/hybrid-llm-provider.js`

---

### 1. The Strategic Imperative
Local inference delivers:
- Privacy (no data leaves the device).
- Offline resilience.
- Predictable cost (one-time download).

But it introduces GPU constraints, model loading delays, and UX complexity. This blueprint keeps the runtime stable and user-friendly.

### 2. Architectural Overview
`LocalLLM` acts as a runtime service with the following API:

```javascript
const Local = await ModuleLoader.getModule('LocalLLM');
await Local.init();                 // loads default model
const reply = await Local.chat(messages, { stream: false });
await Local.unload();               // free GPU memory
```

Key responsibilities:
- **Environment Checks**
  - `checkWebGPU()` verifies adapter availability and surfaces descriptive errors.
  - Emits `local-llm:error` event if unsupported.
- **Model Loading**
  - `init(modelId)` loads quantized model via `window.webllm.CreateMLCEngine`.
  - Emits progress events (`local-llm:loading`, `local-llm:progress`, `local-llm:ready`) so UI can display spinners.
- **Generation**
  - `chat(messages, options)` supports streaming or batched completions, multi-modal inputs (images), and temperature/token controls.
  - Returns text, usage statistics, tokens/sec.
  - `complete(prompt)` convenience wrapper for single prompts.
- **Model Management**
  - `switchModel(modelId)` unloads current engine then re-initializes.
  - `getAvailableModels()` lists curated presets (Qwen, Phi, Llama, Gemma).
  - `unload()` frees engine, resets flags.
- **Status & Telemetry**
  - `getStatus()` returns readiness, progress, model, error.
  - `getRuntimeInfo()` reports GPU capabilities and library availability.

**Widget Interface (Web Component):**

The module exposes a `LocalLLMWidget` custom element for dashboard visualization:

```javascript
class LocalLLMWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.startUpdates(); // Dynamic interval: 500ms while loading, 5000ms when idle
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  startUpdates() {
    // Adaptive refresh rate based on loading state
    const interval = isLoading ? 500 : 5000;
    this._interval = setInterval(() => {
      this.render();
      // Re-adjust if loading state changed
      if ((isLoading && interval !== 500) || (!isLoading && interval !== 5000)) {
        this.startUpdates();
      }
    }, interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    let state = 'disabled';
    if (isLoading) state = 'loading';
    else if (isReady && isGenerating) state = 'active';
    else if (isReady) state = 'idle';
    else if (initError) state = 'error';

    return {
      state,
      primaryMetric: currentModel ? currentModel.split('-MLC')[0] : 'Not loaded',
      secondaryMetric: isReady ? `GPU: ${gpuMemPercent}%` : `${Math.round(loadProgress * 100)}% loaded`,
      lastActivity: inferenceStats.totalInferences > 0 ? Date.now() : null,
      message: initError ? `Error: ${initError}` : isLoading ? 'Loading model...' : null
    };
  }

  getControls() {
    const controls = [];

    if (!isReady && !isLoading) {
      controls.push({ id: 'load-model', label: '⚡ Load Model', action: async () => await init() });
    }

    if (isReady && !isGenerating) {
      controls.push({ id: 'unload-model', label: '⛶ Unload Model', action: async () => await unload() });
    }

    return controls;
  }

  render() {
    // Access closure state for model status
    const statusBadge = isReady ? '✓ Ready' : (isLoading ? '⏳ Loading' : '○ Not Loaded');
    const statusColor = isReady ? '#0f0' : (isLoading ? '#ff0' : '#888');
    const modelName = currentModel ? currentModel.split('-MLC')[0] : 'None';
    const progressPercent = Math.round(loadProgress * 100);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .llm-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .status-badge { color: ${statusColor}; font-weight: bold; }
        .progress-bar { width: 100%; height: 8px; background: #333; margin: 8px 0; }
        .progress-fill { height: 100%; background: #0f0; transition: width 0.3s; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
        .stat { padding: 6px; background: rgba(255, 255, 255, 0.08); }
        .model-btn { padding: 4px 8px; background: #0a0; color: #000; border: none; cursor: pointer; margin: 2px; }
        .error { color: #f00; padding: 8px; background: rgba(255, 0, 0, 0.1); }
      </style>
      <div class="llm-panel">
        <h4>⚡ Local LLM Runtime</h4>
        <div class="status-badge">${statusBadge}</div>
        <div>Model: ${modelName}</div>
        ${isLoading ? `
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div>${progressPercent}% loaded</div>
        ` : ''}
        ${isReady ? `
          <div style="margin: 8px 0;">GPU Memory: ${gpuMemPercent}%</div>
          <div class="stats-grid">
            <div class="stat">Inferences: ${inferenceStats.totalInferences}</div>
            <div class="stat">Tokens: ${inferenceStats.totalTokens}</div>
            <div class="stat">Avg Speed: ${inferenceStats.avgTokensPerSec.toFixed(1)} tok/s</div>
            <div class="stat">Avg Time: ${inferenceStats.avgTime.toFixed(0)}ms</div>
          </div>
        ` : ''}
        ${initError ? `<div class="error">Error: ${initError}</div>` : ''}
        <div style="margin-top: 8px;">
          <strong>Available Models:</strong>
          ${availableModels.map(m => `
            <button class="model-btn model-switch-btn" data-model-id="${m.id}">
              ${m.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Wire up model switch buttons
    this.shadowRoot.querySelectorAll('.model-switch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await switchModel(btn.dataset.modelId);
        this.render();
      });
    });
  }
}

customElements.define('local-llm-widget', LocalLLMWidget);
```

**Key Widget Features:**
- **Adaptive Refresh Rate**: Updates every 500ms during model loading, slows to 5000ms when idle for performance
- **Model Status Indicator**: Visual badges showing Ready/Loading/Not Loaded states with color coding
- **Loading Progress Bar**: Real-time progress visualization during model download (0-100%)
- **GPU Memory Monitor**: Bar chart showing GPU memory usage percentage for active models
- **Inference Statistics Dashboard**: Displays total inferences, tokens generated, avg tokens/sec, and avg response time
- **Model Switcher**: List of available models (Qwen, Phi, Llama, Gemma) with one-click load buttons
- **Interactive Controls**: Load/Unload buttons exposed via `getControls()` for dashboard integration
- **Error Handling**: Displays initialization errors with descriptive messages (e.g., WebGPU not supported)

The widget provides complete runtime visibility and control for local LLM operations, essential for monitoring GPU resource usage and model performance.

### 3. Implementation Pathway

**Step 1: Define Web Component Class**
- Create `LocalLLMWidget` class extending `HTMLElement` inside the factory function
- Gives widget closure access to all module state (isLoading, isReady, currentModel, etc.)
- Attach Shadow DOM in constructor: `this.attachShadow({ mode: 'open' })`

**Step 2: Implement Lifecycle Methods**
- `connectedCallback()`: Initial render + start adaptive auto-refresh
  - Use 500ms interval while loading (for progress updates)
  - Use 5000ms interval when idle (for GPU memory monitoring)
- `disconnectedCallback()`: Clean up intervals to prevent memory leaks
  - Clear `this._interval` if exists

**Step 3: Implement Status Protocol**
- `getStatus()` as class method with ALL 5 required fields:
  - `state`: 'disabled' | 'loading' | 'active' | 'idle' | 'error'
  - `primaryMetric`: Current model name or 'Not loaded'
  - `secondaryMetric`: GPU memory % or loading progress
  - `lastActivity`: Timestamp of last inference (or null)
  - `message`: Error message or loading status (or null)
- Access module state directly via closure (no injection needed)

**Step 4: Implement Interactive Controls**
- `getControls()` as class method returning action buttons:
  - "⚡ Load Model" button when not ready and not loading
  - "⛶ Unload Model" button when ready and not generating
- Each control executes module API methods via closure access

**Step 5: Implement Render Method**
- Single `render()` method sets `this.shadowRoot.innerHTML`
- Include `<style>` tag with `:host` selector for scoped styles
- Render: model status badge, progress bar, GPU memory chart, statistics, available models list
- Wire up model switch buttons with event listeners after render
- Call `switchModel()` directly via closure when buttons clicked

**Step 6: Register Custom Element**
- Use kebab-case naming: `'local-llm-widget'`
- Add duplicate check: `if (!customElements.get(elementName))`
- Call `customElements.define(elementName, LocalLLMWidget)`

**Step 7: Return New Widget Format**
- Return widget object: `{ element, displayName, icon, category }`
- Remove old properties: renderPanel, getStatus, getControls, updateInterval
- Element name is now the custom element tag

**Step 8: Script Inclusion**
- Add `<script type="module" src="https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm"></script>` in HTML (deferred until persona needs)

**Step 9: Initialization UX**
- Provide UI panel to select model; persist choice via `StateManager`
- Show progress bar while `initProgressCallback` reports download/unpack status
- Widget automatically displays progress via adaptive refresh rate

**Step 10: Streaming Integration**
- When `options.stream === true`, return async iterator that yields incremental tokens
- UI consumes stream and updates chat in real time
- Final message includes usage summary

**Step 11: Error Recovery**
- Catch initialization failures, set `initError`, emit error events
- Widget displays error message via `getStatus().message`
- Show toast with remediation (e.g., "Enable chrome://flags/#enable-unsafe-webgpu")
- Allow reattempt via `init` button in widget controls

**Step 12: Resource Management**
- Call `unload()` on persona switch or in limited memory contexts
- Monitor GPU memory via widget's real-time display
- Warn when near limits via `PerformanceMonitor`

### 4. Verification Checklist
- [ ] Initialization gracefully fails when WebGPU unavailable.
- [ ] Progress events fire during model download (>0 to 1.0).
- [ ] Streaming responses yield tokens in order and final usage summary.
- [ ] Switching models unloads previous engine (no double GPU allocation).
- [ ] Status object used by UI stays in sync with actual runtime state.

### 5. Extension Opportunities
- Add CPU fallback (WASM) for devices without WebGPU.
- Support model caching in IndexedDB to avoid re-downloads.
- Integrate with `HybridLLMProvider` to auto-fallback to cloud if local fails.
- Provide quantization stats (token rate, memory footprint) for analytics.

Keep this blueprint updated as model catalog, initialization flow, or WebLLM APIs evolve.
