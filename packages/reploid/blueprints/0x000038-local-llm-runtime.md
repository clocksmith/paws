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
