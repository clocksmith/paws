# New Boot Screen Implementation Plan

## Overview
Replace the complex 8-mode deployment system with a streamlined, dynamic model selection interface based on ModelRegistry runtime discovery.

## Implementation Status: ✅ COMPLETE

### ✅ All Tasks Completed

1. **ModelRegistry Integration** - Added `discoverAvailableModels()` to `boot/api.js`
   - ✅ Integrates with `window.ModelRegistry.api.discoverModels()`
   - ✅ Fallback discovery if ModelRegistry unavailable
   - ✅ Discovers cloud models (Gemini, OpenAI, Anthropic)
   - ✅ Discovers Ollama models via `/api/ollama/models`
   - ✅ Discovers WebLLM models if WebGPU available

2. **State Management** - Updated `boot/state.js`
   - ✅ Added `availableModels` object
   - ✅ Added `selectedModels` array
   - ✅ Added `consensusStrategy` field
   - ✅ Added `configuredKeys` tracking

3. **New UI HTML Structure** - Added to `index.html`
   - ✅ Auto-detection banner
   - ✅ Selected models section with cards
   - ✅ Add Model button
   - ✅ Consensus strategy dropdown
   - ✅ Save configuration button
   - ✅ Add Model Modal with 3-step wizard

4. **JavaScript Implementation** - Created `boot/model-config.js`
   - ✅ initModelConfig() function
   - ✅ Auto-detection status updates
   - ✅ 3-step wizard flow
   - ✅ Model selection from registry (Step 1)
   - ✅ Query type auto-detection (Step 2)
   - ✅ API key management with reuse (Step 3)
   - ✅ Model card rendering
   - ✅ Add/Edit/Remove model functionality
   - ✅ Save/Load configuration
   - ✅ localStorage persistence

5. **CSS Styles** - Added to `boot/style.css`
   - ✅ Auto-detection banner styles
   - ✅ Model card styles
   - ✅ Add Model button styles
   - ✅ Wizard step indicator styles
   - ✅ Model option list styles
   - ✅ Query type option styles
   - ✅ API key configuration styles
   - ✅ Modal and form styles

6. **Integration** - Wired up in `boot.js`
   - ✅ Import initModelConfig
   - ✅ Call in main() function
   - ✅ Proper initialization order

---

## New HTML Structure to Add

### Location
Replace the mode cards section (lines 100-200 in index.html) with new structure:

```html
<!-- New Model Configuration Section -->
<div id="model-config-section" class="model-config-section">
    <!-- Auto-detection Banner -->
    <div class="auto-detect-banner">
        <h4>🔍 Auto-Detected</h4>
        <div id="auto-detect-status" class="auto-detect-status">
            <span class="detect-item"><span id="detect-webgpu">⏳</span> WebGPU</span>
            <span class="detect-item"><span id="detect-proxy">⏳</span> Proxy Server</span>
            <span class="detect-item"><span id="detect-ollama">⏳</span> Ollama</span>
            <span class="detect-item"><span id="detect-keys">⏳</span> API Keys</span>
        </div>
    </div>

    <!-- Selected Models Display -->
    <div class="selected-models-section">
        <h4>Selected Models</h4>
        <div id="selected-models-list" class="selected-models-list">
            <!-- Model cards will be rendered here dynamically -->
            <div class="empty-state" id="models-empty-state">
                <p>No models selected yet</p>
                <p class="empty-state-hint">Click "+ Add Model" to get started</p>
            </div>
        </div>
        <button type="button" id="add-model-btn" class="add-model-btn">
            + Add Model
        </button>
    </div>

    <!-- Consensus Strategy (shown when 2+ models) -->
    <div id="consensus-section" class="consensus-section hidden">
        <label for="consensus-strategy">Consensus Strategy</label>
        <select id="consensus-strategy" class="consensus-select">
            <option value="arena">Model Arena (Competition + LLM Judge)</option>
            <option value="peer-review">Peer Review (Mutual Evaluation)</option>
        </select>
        <small class="consensus-hint">How should multiple models reach agreement?</small>
    </div>

    <!-- Save Button -->
    <div class="config-actions">
        <button type="button" id="save-model-config" class="btn-primary" disabled>
            Save Configuration
        </button>
    </div>
</div>

<!-- Add Model Modal (3-Step Wizard) -->
<div id="add-model-modal" class="modal hidden" role="dialog">
    <div class="modal-content add-model-modal-content">
        <div class="modal-header">
            <h3 id="add-model-title">Add Model</h3>
            <button type="button" class="close-btn" id="close-add-model">×</button>
        </div>
        <div class="modal-body">
            <!-- Step Indicator -->
            <div class="wizard-steps">
                <div class="wizard-step active" data-step="1">
                    <span class="step-number">1</span>
                    <span class="step-label">Select Model</span>
                </div>
                <div class="wizard-step" data-step="2">
                    <span class="step-number">2</span>
                    <span class="step-label">Query Method</span>
                </div>
                <div class="wizard-step" data-step="3">
                    <span class="step-number">3</span>
                    <span class="step-label">Configure</span>
                </div>
            </div>

            <!-- Step 1: Model Selection -->
            <div id="wizard-step-1" class="wizard-content active">
                <div class="model-search">
                    <input type="text" id="model-search-input" placeholder="Search models..." />
                </div>
                <div id="model-list-loading" class="loading-state">
                    <p>🔍 Discovering available models...</p>
                </div>
                <div id="model-list-container" class="model-list-container hidden">
                    <!-- Cloud Models -->
                    <div class="model-group" id="cloud-models-group">
                        <h5 class="group-title">Cloud Models (via API keys)</h5>
                        <div id="cloud-models-list" class="model-options-list">
                            <!-- Dynamically populated -->
                        </div>
                    </div>

                    <!-- WebLLM Models -->
                    <div class="model-group" id="webllm-models-group">
                        <h5 class="group-title">Browser Models (WebLLM)</h5>
                        <div id="webllm-models-list" class="model-options-list">
                            <!-- Dynamically populated -->
                        </div>
                    </div>

                    <!-- Ollama Models -->
                    <div class="model-group" id="ollama-models-group">
                        <h5 class="group-title">Local Models (Ollama)</h5>
                        <div id="ollama-models-list" class="model-options-list">
                            <!-- Dynamically populated -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 2: Query Type Selection -->
            <div id="wizard-step-2" class="wizard-content hidden">
                <h4 id="step2-model-name"></h4>
                <p class="step-description">How should we access this model?</p>
                <div id="query-type-options" class="query-type-options">
                    <!-- Dynamically populated based on model type -->
                </div>
            </div>

            <!-- Step 3: API Key Configuration -->
            <div id="wizard-step-3" class="wizard-content hidden">
                <h4 id="step3-model-name"></h4>
                <div id="api-key-config" class="api-key-config">
                    <!-- Dynamically shown based on query type -->
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" id="wizard-back-btn" class="btn-secondary hidden">
                ← Back
            </button>
            <button type="button" id="wizard-next-btn" class="btn-primary" disabled>
                Next Step →
            </button>
            <button type="button" id="wizard-add-btn" class="btn-primary hidden" disabled>
                Add Model ✓
            </button>
        </div>
    </div>
</div>
```

---

## JavaScript Implementation

### File: `boot/model-config.js` (NEW FILE)

```javascript
import { state, elements } from './state.js';
import { discoverAvailableModels } from './api.js';

// Current wizard state
let wizardState = {
    currentStep: 1,
    selectedModel: null,
    selectedQueryType: null,
    apiKeyConfig: null
};

// Initialize model configuration UI
export async function initModelConfig() {
    console.log('[ModelConfig] Initializing...');

    // Discover available models
    await discoverAvailableModels();

    // Update auto-detection status
    updateAutoDetectStatus();

    // Load saved configuration
    loadSavedConfiguration();

    // Setup event listeners
    setupEventListeners();

    // Render selected models
    renderSelectedModels();
}

// Update auto-detection status indicators
function updateAutoDetectStatus() {
    const env = state.detectedEnv;
    const models = state.availableModels;

    document.getElementById('detect-webgpu').textContent = env.hasWebGPU ? '✓' : '✗';
    document.getElementById('detect-proxy').textContent = env.hasServer ? '✓' : '✗';
    document.getElementById('detect-ollama').textContent = (models.ollama.length > 0) ? '✓' : '✗';

    const hasKeys = models.cloud.length > 0;
    document.getElementById('detect-keys').textContent = hasKeys ? '✓' : '✗';
}

// Setup event listeners
function setupEventListeners() {
    // Add Model button
    document.getElementById('add-model-btn').addEventListener('click', openAddModelModal);

    // Modal close
    document.getElementById('close-add-model').addEventListener('click', closeAddModelModal);

    // Wizard navigation
    document.getElementById('wizard-back-btn').addEventListener('click', wizardGoBack);
    document.getElementById('wizard-next-btn').addEventListener('click', wizardGoNext);
    document.getElementById('wizard-add-btn').addEventListener('click', wizardAddModel);

    // Consensus strategy change
    document.getElementById('consensus-strategy').addEventListener('change', updateConsensusStrategy);

    // Save configuration
    document.getElementById('save-model-config').addEventListener('click', saveConfiguration);
}

// Open Add Model Modal
async function openAddModelModal() {
    const modal = document.getElementById('add-model-modal');
    modal.classList.remove('hidden');

    // Reset wizard state
    wizardState = {
        currentStep: 1,
        selectedModel: null,
        selectedQueryType: null,
        apiKeyConfig: null
    };

    // Show loading
    document.getElementById('model-list-loading').classList.remove('hidden');
    document.getElementById('model-list-container').classList.add('hidden');

    // Populate model list
    await populateModelList();

    // Hide loading
    document.getElementById('model-list-loading').classList.add('hidden');
    document.getElementById('model-list-container').classList.remove('hidden');
}

// Populate model list from availableModels
async function populateModelList() {
    const models = state.availableModels;

    // Cloud models
    const cloudList = document.getElementById('cloud-models-list');
    cloudList.innerHTML = '';
    if (models.cloud.length > 0) {
        models.cloud.forEach(model => {
            const option = createModelOption(model);
            cloudList.appendChild(option);
        });
    } else {
        cloudList.innerHTML = '<p class="no-models">⚠ No cloud API keys detected</p>';
    }

    // WebLLM models
    const webllmList = document.getElementById('webllm-models-list');
    webllmList.innerHTML = '';
    if (models.webllm.length > 0) {
        models.webllm.forEach(model => {
            const option = createModelOption(model);
            webllmList.appendChild(option);
        });
        document.getElementById('webllm-models-group').classList.remove('hidden');
    } else {
        webllmList.innerHTML = '<p class="no-models">⚠ WebGPU not available</p>';
    }

    // Ollama models
    const ollamaList = document.getElementById('ollama-models-list');
    ollamaList.innerHTML = '';
    if (models.ollama.length > 0) {
        models.ollama.forEach(model => {
            const option = createModelOption(model);
            ollamaList.appendChild(option);
        });
        document.getElementById('ollama-models-group').classList.remove('hidden');
    } else {
        ollamaList.innerHTML = '<p class="no-models">⚠ Ollama not detected. Install and run: <code>ollama serve</code></p>';
    }
}

// Create model option element
function createModelOption(model) {
    const option = document.createElement('div');
    option.className = 'model-option';
    option.dataset.modelId = model.id;

    const alreadySelected = state.selectedModels.find(m => m.id === model.id);
    if (alreadySelected) {
        option.classList.add('already-selected');
        option.innerHTML = `
            <div class="model-option-main">
                <input type="radio" name="model-select" value="${model.id}" disabled />
                <div class="model-info">
                    <span class="model-name">${model.name || model.id}</span>
                    <span class="model-provider">${model.provider}</span>
                </div>
            </div>
            <span class="already-selected-badge">Already Selected</span>
        `;
    } else {
        option.innerHTML = `
            <div class="model-option-main">
                <input type="radio" name="model-select" value="${model.id}" />
                <div class="model-info">
                    <span class="model-name">${model.name || model.id}</span>
                    <span class="model-provider">${model.provider}</span>
                    ${model.size ? `<span class="model-size">${formatSize(model.size)}</span>` : ''}
                </div>
            </div>
        `;

        option.addEventListener('click', () => selectModel(model));
    }

    return option;
}

// Select model (Step 1)
function selectModel(model) {
    wizardState.selectedModel = model;
    document.querySelector('input[name="model-select"][value="' + model.id + '"]').checked = true;
    document.getElementById('wizard-next-btn').disabled = false;
}

// Format size in bytes to GB
function formatSize(bytes) {
    if (!bytes) return '';
    const gb = (bytes / (1024 ** 3)).toFixed(1);
    return `${gb}GB`;
}

// ... Continue with Step 2 and Step 3 implementation
// (See full implementation in separate PR)

```

---

## Next Steps

1. Complete JavaScript implementation in `boot/model-config.js`
2. Add CSS styles for new UI components
3. Update `index.html` with new HTML structure
4. Test model discovery flow
5. Test 3-step wizard flow
6. Test model card rendering
7. Test save/load configuration
8. Update runtime modules to read new localStorage schema

---

## Testing Checklist

- [ ] ModelRegistry discovery works
- [ ] Auto-detection shows correct status
- [ ] Add Model modal opens
- [ ] Step 1: Can select cloud model
- [ ] Step 1: Can select WebLLM model
- [ ] Step 1: Can select Ollama model
- [ ] Step 2: Query types auto-filtered
- [ ] Step 2: Q1/Q2 choice for cloud models
- [ ] Step 3: API key input for Q1
- [ ] Step 3: Proxy status check for Q2
- [ ] Step 3: Key reuse option works
- [ ] Model card renders correctly
- [ ] Can remove model
- [ ] Can edit model (re-open wizard)
- [ ] Consensus strategy appears with 2+ models
- [ ] Save configuration persists to localStorage
- [ ] Configuration loads on page refresh
- [ ] Runtime modules can read new schema

---

*Last Updated: 2025-10-21*
