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

  renderPanel() {
    // Returns HTML for:
    // - Model status badge (✓ Ready / ⏳ Loading / ○ Not Loaded)
    // - Current model name display
    // - Loading progress bar (when loading)
    // - GPU memory usage bar chart with percentage
    // - Inference statistics grid (total inferences, tokens, avg tokens/sec, avg time)
    // - Available models list (10 models) with "Load" buttons
    // - Error message display (if error occurred)
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-panel-content">${this.renderPanel()}</div>
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
1. **Script Inclusion**
   - Add `<script type="module" src="https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm"></script>` in HTML (deferred until persona needs).
2. **Initialization UX**
   - Provide UI panel to select model; persist choice via `StateManager`.
   - Show progress bar while `initProgressCallback` reports download/unpack status.
3. **Streaming Integration**
   - When `options.stream === true`, return async iterator that yields incremental tokens with usage summary on completion.
   - UI should consume stream and update chat in real time.
4. **Error Recovery**
   - Catch initialization failures, set `initError`, emit error events, show toast with remediation (e.g., “Enable chrome://flags/#enable-unsafe-webgpu”).
   - Allow reattempt via `init`.
5. **Resource Management**
   - Call `unload()` on persona switch or when running in limited memory contexts.
   - Monitor GPU memory (if available) and warn when near limits via `PerformanceMonitor`.

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
