// Simplified Model Configuration UI - Card-Based Model Selector
import { state, elements } from './state.js';

// State
let selectedModels = []; // Max 4 models
let availableProviders = {
    ollama: { online: false, models: [] },
    webgpu: { online: false, models: [] },
    proxy: { online: false }
};

const MAX_MODELS = 4;

// Provider model catalogs
const cloudProviders = {
    gemini: {
        name: 'Gemini',
        models: [
            { id: 'gemini-2.5-flash-lite', name: 'Flash Lite' },
            { id: 'gemini-2.5-flash', name: 'Flash' },
            { id: 'gemini-2.5-pro', name: 'Pro' }
        ],
        requiresKey: true,
        hostType: 'cloud-browser'
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-5-2025-08-07-mini', name: 'GPT-5 Mini' },
            { id: 'gpt-5-2025-08-07', name: 'GPT-5' },
            { id: 'o1-2025-12-17', name: 'O1' }
        ],
        requiresKey: true,
        hostType: 'cloud-browser'
    },
    anthropic: {
        name: 'Anthropic',
        models: [
            { id: 'claude-4-5-haiku', name: 'Haiku 4.5' },
            { id: 'claude-4-5-sonnet', name: 'Sonnet 4.5' },
            { id: 'claude-opus-4-5-20250514', name: 'Opus 4.5' }
        ],
        requiresKey: true,
        hostType: 'cloud-browser'
    }
};

// Initialize
export async function initModelConfig() {
    console.log('[ModelConfig] Initializing card-based model selector...');

    // Check what's available
    await checkAvailability();

    // Load saved models
    loadSavedModels();

    // Setup event listeners
    setupEventListeners();

    // Render initial state
    renderModelCards();
    updateStatusDots();
    updateGoalInputState();
}

// Check availability of local services
async function checkAvailability() {
    // Check Ollama
    try {
        const response = await fetch('http://localhost:8000/api/ollama/models', {
            signal: AbortSignal.timeout(3000)
        });
        if (response.ok) {
            const data = await response.json();
            availableProviders.ollama.online = true;
            availableProviders.ollama.models = (data.models || []).map(m => ({
                id: m.name || m.model,
                name: m.name || m.model
            }));
        }
    } catch (error) {
        console.log('[ModelConfig] Ollama not available:', error.message);
    }

    // Check WebGPU
    availableProviders.webgpu.online = !!navigator.gpu;
    if (availableProviders.webgpu.online) {
        availableProviders.webgpu.models = [
            { id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC', name: 'Phi-3 Mini' },
            { id: 'gemma-2b-it-q4f16_1-MLC', name: 'Gemma 2B' },
            { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B' }
        ];
    }

    // Check Proxy
    try {
        const response = await fetch('http://localhost:8000/api/health', {
            signal: AbortSignal.timeout(3000)
        });
        availableProviders.proxy.online = response.ok;
    } catch (error) {
        console.log('[ModelConfig] Proxy not available:', error.message);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Add Model card click
    const addModelCard = document.getElementById('add-model-card');
    if (addModelCard) {
        addModelCard.addEventListener('click', () => {
            if (selectedModels.length >= MAX_MODELS) {
                alert(`Maximum ${MAX_MODELS} models allowed`);
                return;
            }
            openInlineForm();
        });
    }

    // Inline form close
    const closeBtn = document.getElementById('close-model-form');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeInlineForm);
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancel-model-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeInlineForm);
    }

    // Save button
    const saveBtn = document.getElementById('save-model-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveModel);
    }

    // Provider select change
    const providerSelect = document.getElementById('provider-select');
    if (providerSelect) {
        providerSelect.addEventListener('change', onProviderChange);
    }

    // Model select change
    const modelSelect = document.getElementById('model-select-dropdown');
    if (modelSelect) {
        modelSelect.addEventListener('change', onModelChange);
    }

    // Consensus strategy
    const consensusSelect = document.getElementById('consensus-strategy');
    if (consensusSelect) {
        consensusSelect.addEventListener('change', () => {
            saveToStorage();
        });
    }
}

// Open inline form for adding/editing
function openInlineForm(editingIndex = null) {
    const form = document.getElementById('model-form-inline');
    const formTitle = document.getElementById('model-form-title');
    const saveBtn = document.getElementById('save-model-btn');

    // Show form
    form.classList.remove('hidden');
    formTitle.textContent = editingIndex !== null ? 'Edit Model' : 'Add Model';
    saveBtn.textContent = editingIndex !== null ? 'Save Changes' : 'Add Model';
    saveBtn.dataset.editingIndex = editingIndex !== null ? editingIndex : '';

    // Populate provider dropdown
    populateProviderSelect();

    // Reset form
    resetInlineForm();

    // If editing, populate with existing data
    if (editingIndex !== null) {
        const model = selectedModels[editingIndex];
        populateEditForm(model);
    }
}

// Populate provider select dropdown
function populateProviderSelect() {
    const providerSelect = document.getElementById('provider-select');
    const options = ['<option value="">Select provider...</option>'];

    // Add Ollama if available
    if (availableProviders.ollama.online && availableProviders.ollama.models.length > 0) {
        options.push('<option value="ollama">Ollama (Local)</option>');
    }

    // Add WebGPU if available
    if (availableProviders.webgpu.online) {
        options.push('<option value="webllm">WebLLM (Browser)</option>');
    }

    // Add cloud providers (always available)
    options.push('<option value="gemini">Gemini (Google)</option>');
    options.push('<option value="openai">OpenAI</option>');
    options.push('<option value="anthropic">Anthropic</option>');

    providerSelect.innerHTML = options.join('');
}

// Handle provider selection change
function onProviderChange(e) {
    const provider = e.target.value;
    const modelSelectGroup = document.getElementById('model-select-group');
    const modelSelect = document.getElementById('model-select-dropdown');
    const apiKeyGroup = document.getElementById('api-key-group');
    const hostTypeGroup = document.getElementById('host-type-group');
    const hostTypeDisplay = document.getElementById('host-type-display');
    const saveBtn = document.getElementById('save-model-btn');

    // Reset
    modelSelectGroup.classList.add('hidden');
    apiKeyGroup.classList.add('hidden');
    hostTypeGroup.classList.add('hidden');
    saveBtn.disabled = true;

    if (!provider) return;

    // Populate models based on provider
    const models = [];
    let hostType = '';
    let requiresKey = false;

    if (provider === 'ollama') {
        models.push(...availableProviders.ollama.models);
        hostType = 'Ollama Proxy';
        requiresKey = false;
    } else if (provider === 'webllm') {
        models.push(...availableProviders.webgpu.models);
        hostType = 'WebGPU (Browser)';
        requiresKey = false;
    } else if (cloudProviders[provider]) {
        models.push(...cloudProviders[provider].models);
        hostType = 'Cloud (Browser)';
        requiresKey = true;
    }

    // Show model select
    modelSelectGroup.classList.remove('hidden');
    modelSelect.innerHTML = '<option value="">Select model...</option>' +
        models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    // Show API key field if required
    if (requiresKey) {
        apiKeyGroup.classList.remove('hidden');
        // Pre-fill API key if exists
        const savedKey = localStorage.getItem(`${provider.toUpperCase()}_API_KEY`);
        if (savedKey) {
            document.getElementById('model-api-key').value = savedKey;
        }
    }

    // Show host type
    hostTypeGroup.classList.remove('hidden');
    hostTypeDisplay.textContent = hostType;
}

// Handle model selection change
function onModelChange(e) {
    const saveBtn = document.getElementById('save-model-btn');
    const provider = document.getElementById('provider-select').value;
    const modelId = e.target.value;

    if (!provider || !modelId) {
        saveBtn.disabled = true;
        return;
    }

    // Check if API key is required
    const providerConfig = cloudProviders[provider];
    if (providerConfig && providerConfig.requiresKey) {
        const apiKey = document.getElementById('model-api-key').value.trim();
        saveBtn.disabled = !apiKey;
    } else {
        saveBtn.disabled = false;
    }
}

// Save model (add or edit)
function saveModel() {
    const provider = document.getElementById('provider-select').value;
    const modelId = document.getElementById('model-select-dropdown').value;
    const modelName = document.getElementById('model-select-dropdown').selectedOptions[0]?.text;
    const apiKey = document.getElementById('model-api-key').value.trim();
    const editingIndex = document.getElementById('save-model-btn').dataset.editingIndex;

    if (!provider || !modelId) {
        alert('Please select a provider and model');
        return;
    }

    // Determine host type
    let hostType = 'cloud-browser';
    let queryMethod = 'browser';
    if (provider === 'ollama') {
        hostType = 'ollama-proxy';
        queryMethod = 'proxy';
    } else if (provider === 'webllm') {
        hostType = 'webgpu-browser';
        queryMethod = 'browser';
    }

    // Save API key if provided
    if (apiKey) {
        localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, apiKey);
    }

    // Create model config
    const modelConfig = {
        id: modelId,
        name: modelName,
        provider: provider,
        hostType: hostType,
        queryMethod: queryMethod,
        keySource: apiKey ? 'localStorage' : 'none',
        keyId: apiKey ? `${provider.toUpperCase()}_API_KEY` : null
    };

    // Add or update
    if (editingIndex !== '') {
        selectedModels[parseInt(editingIndex)] = modelConfig;
    } else {
        if (selectedModels.length >= MAX_MODELS) {
            alert(`Maximum ${MAX_MODELS} models allowed`);
            return;
        }
        selectedModels.push(modelConfig);
    }

    // Update UI
    renderModelCards();
    saveToStorage();
    updateGoalInputState();
    closeInlineForm();

    console.log('[ModelConfig] Model saved:', modelConfig);
}

// Close inline form
function closeInlineForm() {
    const form = document.getElementById('model-form-inline');
    form.classList.add('hidden');
    resetInlineForm();
}

// Reset inline form
function resetInlineForm() {
    document.getElementById('provider-select').value = '';
    document.getElementById('model-select-dropdown').innerHTML = '<option value="">Select model...</option>';
    document.getElementById('model-api-key').value = '';
    document.getElementById('model-select-group').classList.add('hidden');
    document.getElementById('api-key-group').classList.add('hidden');
    document.getElementById('host-type-group').classList.add('hidden');
    document.getElementById('save-model-btn').disabled = true;
}

// Populate edit form
function populateEditForm(model) {
    document.getElementById('provider-select').value = model.provider;
    onProviderChange({ target: { value: model.provider } });

    setTimeout(() => {
        document.getElementById('model-select-dropdown').value = model.id;
        onModelChange({ target: { value: model.id } });
    }, 100);
}

// Render model cards
function renderModelCards() {
    const container = document.getElementById('model-cards-list');
    const addCard = document.getElementById('add-model-card');
    const consensusSection = document.getElementById('consensus-section');

    // Clear existing cards (except add card)
    container.innerHTML = '';

    // Render model cards
    selectedModels.forEach((model, index) => {
        const card = createModelCard(model, index);
        container.appendChild(card);
    });

    // Re-add the Add Model card
    container.appendChild(addCard);

    // Show/hide consensus section
    if (consensusSection) {
        if (selectedModels.length >= 2) {
            consensusSection.classList.remove('hidden');
        } else {
            consensusSection.classList.add('hidden');
        }
    }
}

// Create model card element
function createModelCard(model, index) {
    const card = document.createElement('div');
    card.className = 'model-card';
    card.innerHTML = `
        <div class="model-card-provider">${model.provider}</div>
        <div class="model-card-name">${model.name}</div>
        <div class="model-card-connection">${getHostTypeLabel(model.hostType)}</div>
        <div class="model-card-actions">
            <button class="model-card-btn edit" data-index="${index}">Edit</button>
            <button class="model-card-btn remove" data-index="${index}">Remove</button>
        </div>
    `;

    // Edit button
    card.querySelector('.edit').addEventListener('click', () => {
        openInlineForm(index);
    });

    // Remove button
    card.querySelector('.remove').addEventListener('click', () => {
        removeModel(index);
    });

    return card;
}

// Get host type label
function getHostTypeLabel(hostType) {
    const labels = {
        'cloud-browser': 'Cloud',
        'ollama-proxy': 'Ollama',
        'webgpu-browser': 'WebGPU',
        'proxy': 'Proxy'
    };
    return labels[hostType] || hostType;
}

// Remove model
function removeModel(index) {
    if (confirm('Remove this model?')) {
        selectedModels.splice(index, 1);
        renderModelCards();
        saveToStorage();
        updateGoalInputState();
    }
}

// Update status indicators (both dots and status bar)
function updateStatusDots() {
    // Ollama status
    const ollamaIcon = document.getElementById('ollama-status-icon');
    const ollamaText = document.getElementById('ollama-status-text');

    if (ollamaIcon && ollamaText) {
        if (availableProviders.ollama.online) {
            ollamaIcon.className = 'provider-status-icon online';
            ollamaText.className = 'provider-status-value online';
            ollamaText.textContent = `Online (${availableProviders.ollama.models.length} models)`;
        } else {
            ollamaIcon.className = 'provider-status-icon offline';
            ollamaText.className = 'provider-status-value offline';
            ollamaText.textContent = 'Offline';
        }
    }

    // WebGPU status
    const webgpuIcon = document.getElementById('webgpu-status-icon');
    const webgpuText = document.getElementById('webgpu-status-text');

    if (webgpuIcon && webgpuText) {
        if (availableProviders.webgpu.online) {
            webgpuIcon.className = 'provider-status-icon online';
            webgpuText.className = 'provider-status-value online';
            webgpuText.textContent = 'Available';
        } else {
            webgpuIcon.className = 'provider-status-icon offline';
            webgpuText.className = 'provider-status-value offline';
            webgpuText.textContent = 'Not Available';
        }
    }

    // Proxy status
    const proxyIcon = document.getElementById('proxy-status-icon');
    const proxyText = document.getElementById('proxy-status-text');

    if (proxyIcon && proxyText) {
        if (availableProviders.proxy.online) {
            proxyIcon.className = 'provider-status-icon online';
            proxyText.className = 'provider-status-value online';
            proxyText.textContent = 'Online';
        } else {
            proxyIcon.className = 'provider-status-icon offline';
            proxyText.className = 'provider-status-value offline';
            proxyText.textContent = 'Offline';
        }
    }
}

// Update goal input state
function updateGoalInputState() {
    const goalInput = document.getElementById('goal-input');
    const awakenBtn = document.getElementById('awaken-btn');

    if (goalInput) {
        if (selectedModels.length === 0) {
            goalInput.disabled = true;
            goalInput.placeholder = '► Select at least one model to continue';
            if (awakenBtn) awakenBtn.disabled = true;
        } else {
            goalInput.disabled = false;
            goalInput.placeholder = 'Describe your goal...';
            if (awakenBtn) awakenBtn.disabled = false;
        }
    }
}

// Save to storage
function saveToStorage() {
    try {
        localStorage.setItem('SELECTED_MODELS', JSON.stringify(selectedModels));

        // Save consensus strategy
        const consensus = document.getElementById('consensus-strategy')?.value || 'arena';
        localStorage.setItem('CONSENSUS_TYPE', consensus);

        // Legacy compatibility
        if (selectedModels.length > 0) {
            const primaryModel = selectedModels[0];
            localStorage.setItem('SELECTED_MODEL', primaryModel.id);
            localStorage.setItem('AI_PROVIDER', primaryModel.provider);
        }

        console.log('[ModelConfig] Configuration saved');
    } catch (error) {
        console.error('[ModelConfig] Failed to save:', error);
    }
}

// Load saved models
function loadSavedModels() {
    try {
        const saved = localStorage.getItem('SELECTED_MODELS');
        if (saved) {
            selectedModels = JSON.parse(saved);
            console.log('[ModelConfig] Loaded saved models:', selectedModels);
        }
    } catch (error) {
        console.error('[ModelConfig] Failed to load saved models:', error);
    }
}

// Export functions
export function getSelectedModels() {
    return selectedModels;
}

export function hasModelsConfigured() {
    return selectedModels.length > 0;
}
