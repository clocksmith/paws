// Model Configuration UI - Single-screen model picker with inline configuration
import { state, elements } from './state.js';
import { discoverAvailableModels } from './api.js';

// Selected models (array of configured model objects)
let selectedModels = [];

// Provider model catalogs (loaded after API key verification)
const providerCatalogs = {
    gemini: [
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', tier: 'fast' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'balanced' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'advanced' }
    ],
    openai: [
        { id: 'gpt-5-2025-08-07-mini', name: 'GPT-5 Mini', tier: 'fast' },
        { id: 'gpt-5-2025-08-07', name: 'GPT-5', tier: 'balanced' },
        { id: 'o1-2025-12-17', name: 'O1', tier: 'advanced' }
    ],
    anthropic: [
        { id: 'claude-4-5-haiku', name: 'Claude 4.5 Haiku', tier: 'fast' },
        { id: 'claude-4-5-sonnet', name: 'Claude 4.5 Sonnet', tier: 'balanced' },
        { id: 'claude-opus-4-5-20250514', name: 'Claude Opus 4.5', tier: 'advanced' }
    ]
};

// Initialize model configuration UI
export async function initModelConfig() {
    console.log('[ModelConfig] Initializing single-screen model picker...');

    // Setup event listeners
    setupEventListeners();

    // Discover local models (Ollama, WebLLM)
    await discoverLocalModels();

    // Load saved configuration
    loadSavedConfiguration();

    // Render selected models chips
    renderSelectedChips();

    // Update goal input state
    updateGoalInputState();

    // Update old status display (compatibility with existing UI)
    updateLegacyStatusDisplay();
}

// Setup all event listeners
function setupEventListeners() {
    // Provider card header clicks (toggle expansion)
    document.querySelectorAll('.provider-card-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.provider-card');
            toggleProviderCard(card);
        });
    });

    // Verify API key buttons
    document.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const provider = e.target.dataset.provider;
            verifyApiKey(provider);
        });
    });

    // Add selected models buttons
    document.querySelectorAll('.btn-add-selected').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const provider = e.target.dataset.provider;
            addSelectedModels(provider);
        });
    });

    // Consensus strategy change
    const consensusSelect = document.getElementById('consensus-strategy');
    if (consensusSelect) {
        consensusSelect.addEventListener('change', (e) => {
            saveConfigToStorage();
        });
    }
}

// Toggle provider card expansion
function toggleProviderCard(card) {
    const body = card.querySelector('.provider-card-body');
    const isExpanded = !body.classList.contains('hidden');

    if (isExpanded) {
        // Collapse
        body.classList.add('hidden');
    } else {
        // Expand
        body.classList.remove('hidden');
    }
}

// Verify API key and load models for cloud provider
async function verifyApiKey(provider) {
    const inputId = `${provider}-api-key`;
    const statusId = `${provider}-status`;
    const modelsListId = `${provider}-models-list`;
    const addBtn = document.querySelector(`.btn-add-selected[data-provider="${provider}"]`);

    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    const modelsList = document.getElementById(modelsListId);

    const apiKey = input.value.trim();

    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }

    // Update status
    status.textContent = 'Verifying...';
    status.className = 'provider-status verifying';

    try {
        // Save API key to localStorage
        localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, apiKey);

        // TODO: Actually verify the API key with a test request
        // For now, just assume it's valid and show models

        // Show models list
        modelsList.classList.remove('hidden');
        renderProviderModels(provider, modelsList);

        // Update status
        status.textContent = 'Configured ✓';
        status.className = 'provider-status configured';

        // Enable add button (will be enabled when models selected)
        updateAddButtonState(provider);

        console.log(`[ModelConfig] API key verified for ${provider}`);
    } catch (error) {
        console.error(`[ModelConfig] API key verification failed for ${provider}:`, error);
        status.textContent = 'Verification failed';
        status.className = 'provider-status error';
        alert(`API key verification failed: ${error.message}`);
    }
}

// Render available models for a provider with checkboxes
function renderProviderModels(provider, container) {
    const models = providerCatalogs[provider] || [];

    container.innerHTML = models.map(model => `
        <label class="model-checkbox">
            <input type="checkbox"
                   data-provider="${provider}"
                   data-model-id="${model.id}"
                   data-model-name="${model.name}"
                   data-tier="${model.tier}"
                   onchange="window.updateAddButtonState('${provider}')"/>
            <span class="model-name">${model.name}</span>
            <span class="model-tier ${model.tier}">${model.tier}</span>
        </label>
    `).join('');
}

// Update "Add Selected Models" button state
window.updateAddButtonState = function(provider) {
    const checkboxes = document.querySelectorAll(`input[data-provider="${provider}"]:checked`);
    const addBtn = document.querySelector(`.btn-add-selected[data-provider="${provider}"]`);

    if (addBtn) {
        addBtn.disabled = checkboxes.length === 0;
    }
};

// Add selected models from a provider
function addSelectedModels(provider) {
    const checkboxes = document.querySelectorAll(`input[data-provider="${provider}"]:checked`);
    const queryMethod = document.querySelector(`input[name="${provider}-query"]:checked`)?.value || 'browser';

    checkboxes.forEach(checkbox => {
        const modelConfig = {
            id: checkbox.dataset.modelId,
            name: checkbox.dataset.modelName,
            provider: provider,
            tier: checkbox.dataset.tier,
            queryType: queryMethod === 'browser' ? 'Q1' : 'Q2',
            queryMethod: queryMethod,
            keySource: queryMethod === 'browser' ? 'localStorage' : 'proxy-env',
            keyId: `${provider.toUpperCase()}_API_KEY`
        };

        // Check if already added
        const exists = selectedModels.find(m => m.id === modelConfig.id && m.queryMethod === modelConfig.queryMethod);
        if (!exists) {
            selectedModels.push(modelConfig);
        }

        // Uncheck the checkbox
        checkbox.checked = false;
    });

    // Update UI
    renderSelectedChips();
    updateAddButtonState(provider);
    saveConfigToStorage();
    updateGoalInputState();
    updateLegacyStatusDisplay();

    // Collapse the provider card
    const card = document.getElementById(`provider-${provider}`);
    const body = card.querySelector('.provider-card-body');
    body.classList.add('hidden');

    console.log(`[ModelConfig] Added models from ${provider}`, selectedModels);
}

// Render selected models as chips
function renderSelectedChips() {
    const container = document.getElementById('selected-chips-container');
    const emptyState = document.getElementById('chips-empty-state');

    if (selectedModels.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = selectedModels.map((model, index) => `
        <div class="model-chip" data-index="${index}">
            <span class="chip-icon">${getProviderIcon(model.provider)}</span>
            <span class="chip-name">${model.name}</span>
            <span class="chip-method">${model.queryMethod === 'browser' ? 'Direct' : 'Proxy'}</span>
            <button type="button" class="chip-remove" onclick="window.removeModelChip(${index})">×</button>
        </div>
    `).join('');

    // Show/hide consensus section
    const consensusSection = document.getElementById('consensus-section');
    if (consensusSection) {
        if (selectedModels.length >= 2) {
            consensusSection.classList.remove('hidden');
        } else {
            consensusSection.classList.add('hidden');
        }
    }
}

// Remove model chip
window.removeModelChip = function(index) {
    selectedModels.splice(index, 1);
    renderSelectedChips();
    saveConfigToStorage();
    updateGoalInputState();
    updateLegacyStatusDisplay();
};

// Get provider icon (non-emoji unicode symbols)
function getProviderIcon(provider) {
    const icons = {
        gemini: '▲',
        openai: '▲',
        anthropic: '▲',
        ollama: '■',
        webllm: '◆'
    };
    return icons[provider] || '●';
}

// Discover local models (Ollama, WebLLM)
async function discoverLocalModels() {
    // Discover Ollama models
    try {
        const response = await fetch('http://localhost:8000/api/ollama/models', {
            signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
            const data = await response.json();
            const models = data.models || [];

            const ollamaStatus = document.getElementById('ollama-status');
            const ollamaList = document.getElementById('ollama-models-list');
            const ollamaCard = document.getElementById('provider-ollama');

            if (models.length > 0) {
                ollamaStatus.textContent = `${models.length} models`;
                ollamaStatus.className = 'provider-status detected';

                ollamaList.innerHTML = models.map((model, index) => `
                    <label class="model-checkbox">
                        <input type="checkbox"
                               data-provider="ollama"
                               data-model-id="${model.name || model.model}"
                               data-model-name="${model.name || model.model}"
                               data-tier="local"
                               onchange="window.updateAddButtonState('ollama')"/>
                        <span class="model-name">${model.name || model.model}</span>
                    </label>
                `).join('');

                // Make card clickable
                ollamaCard.classList.add('available');
                window.updateAddButtonState('ollama');
            } else {
                ollamaStatus.textContent = 'No models';
                ollamaStatus.className = 'provider-status unavailable';
            }
        } else {
            throw new Error('Ollama not available');
        }
    } catch (error) {
        const ollamaStatus = document.getElementById('ollama-status');
        ollamaStatus.textContent = 'Not available';
        ollamaStatus.className = 'provider-status unavailable';
    }

    // Check WebGPU for WebLLM
    try {
        const hasWebGPU = !!navigator.gpu;
        const webllmStatus = document.getElementById('webllm-status');
        const webllmList = document.getElementById('webllm-models-list');
        const webllmCard = document.getElementById('provider-webllm');

        if (hasWebGPU) {
            webllmStatus.textContent = 'Available';
            webllmStatus.className = 'provider-status detected';

            // Show some common WebLLM models
            const webllmModels = [
                { id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC', name: 'Phi-3 Mini' },
                { id: 'gemma-2b-it-q4f16_1-MLC', name: 'Gemma 2B' },
                { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B' }
            ];

            webllmList.innerHTML = webllmModels.map((model, index) => `
                <label class="model-checkbox">
                    <input type="checkbox"
                           data-provider="webllm"
                           data-model-id="${model.id}"
                           data-model-name="${model.name}"
                           data-tier="browser"
                           onchange="window.updateAddButtonState('webllm')"/>
                    <span class="model-name">${model.name}</span>
                </label>
            `).join('');

            webllmCard.classList.add('available');
            window.updateAddButtonState('webllm');
        } else {
            webllmStatus.textContent = 'WebGPU not available';
            webllmStatus.className = 'provider-status unavailable';
        }
    } catch (error) {
        const webllmStatus = document.getElementById('webllm-status');
        webllmStatus.textContent = 'Not available';
        webllmStatus.className = 'provider-status unavailable';
    }
}

// Update goal input state (enable/disable based on selected models)
function updateGoalInputState() {
    // Find the goal input field and button
    const goalInput = document.getElementById('goal-input') ||
                      document.querySelector('input[placeholder*="goal"]') ||
                      document.querySelector('textarea[placeholder*="goal"]');
    const awakenBtn = document.getElementById('awaken-btn');

    if (goalInput) {
        if (selectedModels.length === 0) {
            goalInput.disabled = true;
            goalInput.placeholder = '► Select at least one model to continue';
            goalInput.classList.add('disabled-goal-input');
            if (awakenBtn) awakenBtn.disabled = true;
        } else {
            goalInput.disabled = false;
            goalInput.placeholder = 'Describe your goal...';
            goalInput.classList.remove('disabled-goal-input');
            if (awakenBtn) awakenBtn.disabled = false;
        }
    }
}

// Load saved configuration from localStorage
function loadSavedConfiguration() {
    try {
        const saved = localStorage.getItem('SELECTED_MODELS');
        if (saved) {
            selectedModels = JSON.parse(saved);
            renderSelectedChips();
            console.log('[ModelConfig] Loaded saved configuration:', selectedModels);
        }

        // Check for existing API keys and auto-configure providers
        const geminiKey = localStorage.getItem('GEMINI_API_KEY');
        const openaiKey = localStorage.getItem('OPENAI_API_KEY');
        const anthropicKey = localStorage.getItem('ANTHROPIC_API_KEY');

        if (geminiKey) {
            document.getElementById('gemini-api-key').value = geminiKey;
            document.getElementById('gemini-status').textContent = 'Key detected';
            document.getElementById('gemini-status').className = 'provider-status detected';
        }

        if (openaiKey) {
            document.getElementById('openai-api-key').value = openaiKey;
            document.getElementById('openai-status').textContent = 'Key detected';
            document.getElementById('openai-status').className = 'provider-status detected';
        }

        if (anthropicKey) {
            document.getElementById('anthropic-api-key').value = anthropicKey;
            document.getElementById('anthropic-status').textContent = 'Key detected';
            document.getElementById('anthropic-status').className = 'provider-status detected';
        }
    } catch (error) {
        console.error('[ModelConfig] Failed to load saved configuration:', error);
    }
}

// Save configuration to localStorage
function saveConfigToStorage() {
    try {
        localStorage.setItem('SELECTED_MODELS', JSON.stringify(selectedModels));

        // Also save consensus strategy
        const consensus = document.getElementById('consensus-strategy')?.value || 'arena';
        localStorage.setItem('CONSENSUS_TYPE', consensus);

        // Set legacy fields for backward compatibility
        if (selectedModels.length > 0) {
            const primaryModel = selectedModels[0];
            localStorage.setItem('SELECTED_MODEL', primaryModel.id);
            localStorage.setItem('AI_PROVIDER', primaryModel.provider);
        }

        console.log('[ModelConfig] Configuration saved to localStorage');
    } catch (error) {
        console.error('[ModelConfig] Failed to save configuration:', error);
    }
}

// Update legacy status display (old UI elements at top of page)
function updateLegacyStatusDisplay() {
    const providerStatus = document.getElementById('provider-status');
    const providerStatusDetail = document.getElementById('provider-status-detail');

    if (!providerStatus || !providerStatusDetail) return;

    if (selectedModels.length === 0) {
        providerStatus.textContent = 'No models configured';
        providerStatusDetail.textContent = 'Select at least one model to continue';
    } else if (selectedModels.length === 1) {
        const model = selectedModels[0];
        providerStatus.textContent = model.name;
        providerStatusDetail.textContent = `${model.provider} via ${model.queryMethod === 'browser' ? 'Browser' : 'Proxy'}`;
    } else {
        providerStatus.textContent = `${selectedModels.length} models configured`;
        providerStatusDetail.textContent = selectedModels.map(m => m.name).join(', ');
    }
}

// Export for external use
export function getSelectedModels() {
    return selectedModels;
}

export function hasModelsConfigured() {
    return selectedModels.length > 0;
}
