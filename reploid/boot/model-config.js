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
        hostType: 'browser-cloud'
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-5-2025-08-07-mini', name: 'GPT-5 Mini' },
            { id: 'gpt-5-2025-08-07', name: 'GPT-5' },
            { id: 'o1-2025-12-17', name: 'O1' }
        ],
        requiresKey: true,
        hostType: 'browser-cloud'
    },
    anthropic: {
        name: 'Anthropic',
        models: [
            { id: 'claude-4-5-haiku', name: 'Haiku 4.5' },
            { id: 'claude-4-5-sonnet', name: 'Sonnet 4.5' },
            { id: 'claude-opus-4-5-20250514', name: 'Opus 4.5' }
        ],
        requiresKey: true,
        hostType: 'browser-cloud'
    }
};

// Initialize
export async function initModelConfig() {
    console.log('[ModelConfig] Initializing card-based model selector...');

    // Check what's available
    await checkAvailability();

    // Load saved models
    loadSavedModels();

    // Auto-populate default models if none configured
    autoPopulateDefaultModels();

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

    // Connection type change
    const connectionTypeSelect = document.getElementById('connection-type-select');
    if (connectionTypeSelect) {
        connectionTypeSelect.addEventListener('change', onConnectionTypeChange);
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

    // Add cloud providers via proxy (if proxy is online)
    if (availableProviders.proxy.online) {
        options.push('<option value="gemini">Gemini (Proxy/Cloud)</option>');
        options.push('<option value="openai">OpenAI (Proxy/Cloud)</option>');
        options.push('<option value="anthropic">Anthropic (Proxy/Cloud)</option>');
    }

    providerSelect.innerHTML = options.join('');
}

// Handle provider selection change
function onProviderChange(e) {
    const provider = e.target.value;
    const modelSelectGroup = document.getElementById('model-select-group');
    const modelSelect = document.getElementById('model-select-dropdown');
    const apiKeyGroup = document.getElementById('api-key-group');
    const connectionTypeGroup = document.getElementById('connection-type-group');
    const connectionTypeSelect = document.getElementById('connection-type-select');
    const saveBtn = document.getElementById('save-model-btn');

    // Reset
    modelSelectGroup.classList.add('hidden');
    apiKeyGroup.classList.add('hidden');
    connectionTypeGroup.classList.add('hidden');
    saveBtn.disabled = true;

    if (!provider) return;

    // Populate models based on provider
    const models = [];
    const connectionOptions = [];

    if (provider === 'ollama') {
        models.push(...availableProviders.ollama.models);
        // Ollama only supports proxy-local
        connectionOptions.push({ value: 'proxy-local', label: 'Proxy → Local (Ollama)' });
    } else if (provider === 'webllm') {
        models.push(...availableProviders.webgpu.models);
        // WebLLM only supports browser-local
        connectionOptions.push({ value: 'browser-local', label: 'Browser → Local (WebGPU)' });
    } else if (cloudProviders[provider]) {
        models.push(...cloudProviders[provider].models);
        // Cloud providers can use proxy-cloud (if proxy online) OR browser-cloud (with API key)
        if (availableProviders.proxy.online) {
            connectionOptions.push({ value: 'proxy-cloud', label: 'Proxy → Cloud (uses .env key)' });
        }
        connectionOptions.push({ value: 'browser-cloud', label: 'Browser → Cloud (enter API key)' });
    }

    // Show model select
    modelSelectGroup.classList.remove('hidden');
    modelSelect.innerHTML = '<option value="">Select model...</option>' +
        models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    // Show connection type selector
    connectionTypeGroup.classList.remove('hidden');
    connectionTypeSelect.innerHTML = '<option value="">Select connection type...</option>' +
        connectionOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
}

// Handle connection type change
function onConnectionTypeChange(e) {
    const connectionType = e.target.value;
    const provider = document.getElementById('provider-select').value;
    const apiKeyGroup = document.getElementById('api-key-group');

    // Show/hide API key based on connection type
    if (connectionType === 'browser-cloud') {
        // Browser-cloud requires API key
        apiKeyGroup.classList.remove('hidden');
        // Pre-fill API key if exists
        const savedKey = localStorage.getItem(`${provider.toUpperCase()}_API_KEY`);
        if (savedKey) {
            document.getElementById('model-api-key').value = savedKey;
        }
    } else {
        // proxy-cloud, proxy-local, browser-local don't need API key entry
        apiKeyGroup.classList.add('hidden');
        document.getElementById('model-api-key').value = '';
    }

    // Validate form
    validateForm();
}

// Handle model selection change
function onModelChange(e) {
    validateForm();
}

// Validate the form and enable/disable save button
function validateForm() {
    const saveBtn = document.getElementById('save-model-btn');
    const provider = document.getElementById('provider-select').value;
    const modelId = document.getElementById('model-select-dropdown').value;
    const connectionType = document.getElementById('connection-type-select').value;

    // All fields required
    if (!provider || !modelId || !connectionType) {
        saveBtn.disabled = true;
        return;
    }

    // If browser-cloud, API key is required
    if (connectionType === 'browser-cloud') {
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
    const connectionType = document.getElementById('connection-type-select').value;
    const apiKey = document.getElementById('model-api-key').value.trim();
    const editingIndex = document.getElementById('save-model-btn').dataset.editingIndex;

    if (!provider || !modelId || !connectionType) {
        alert('Please select a provider, model, and connection type');
        return;
    }

    // Determine query method based on connection type
    const queryMethod = connectionType.startsWith('proxy-') ? 'proxy' : 'browser';

    // Save API key if provided (browser-cloud only)
    if (apiKey && connectionType === 'browser-cloud') {
        localStorage.setItem(`${provider.toUpperCase()}_API_KEY`, apiKey);
    }

    // Determine key source
    let keySource = 'none';
    let keyId = null;
    if (connectionType === 'browser-cloud') {
        keySource = 'localStorage';
        keyId = `${provider.toUpperCase()}_API_KEY`;
    } else if (connectionType === 'proxy-cloud') {
        keySource = 'proxy-env';
    }

    // Create model config
    const modelConfig = {
        id: modelId,
        name: modelName,
        provider: provider,
        hostType: connectionType,
        queryMethod: queryMethod,
        keySource: keySource,
        keyId: keyId
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
    document.getElementById('connection-type-select').innerHTML = '<option value="">Select connection type...</option>';
    document.getElementById('model-api-key').value = '';
    document.getElementById('model-select-group').classList.add('hidden');
    document.getElementById('connection-type-group').classList.add('hidden');
    document.getElementById('api-key-group').classList.add('hidden');
    document.getElementById('save-model-btn').disabled = true;
}

// Populate edit form
function populateEditForm(model) {
    document.getElementById('provider-select').value = model.provider;
    onProviderChange({ target: { value: model.provider } });

    setTimeout(() => {
        document.getElementById('model-select-dropdown').value = model.id;
        document.getElementById('connection-type-select').value = model.hostType;
        onConnectionTypeChange({ target: { value: model.hostType } });
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
        'browser-cloud': 'Browser → Cloud',
        'proxy-cloud': 'Proxy → Cloud',
        'browser-local': 'Browser → Local',
        'proxy-local': 'Proxy → Local',
        // Legacy mappings
        'cloud-browser': 'Browser → Cloud',
        'ollama-proxy': 'Proxy → Local',
        'webgpu-browser': 'Browser → Local',
        'proxy': 'Proxy → Cloud'
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
    // Browser → Cloud (always ready)
    const browserCloudIcon = document.getElementById('browser-cloud-icon');
    const browserCloudText = document.getElementById('browser-cloud-text');

    if (browserCloudIcon && browserCloudText) {
        browserCloudIcon.className = 'provider-status-icon online';
        browserCloudText.className = 'provider-status-value online';
        browserCloudText.textContent = 'Ready';
    }

    // Proxy → Cloud (check if proxy server is online)
    const proxyCloudIcon = document.getElementById('proxy-cloud-icon');
    const proxyCloudText = document.getElementById('proxy-cloud-text');

    if (proxyCloudIcon && proxyCloudText) {
        if (availableProviders.proxy.online) {
            proxyCloudIcon.className = 'provider-status-icon online';
            proxyCloudText.className = 'provider-status-value online';
            proxyCloudText.textContent = 'Available';
        } else {
            proxyCloudIcon.className = 'provider-status-icon offline';
            proxyCloudText.className = 'provider-status-value offline';
            proxyCloudText.textContent = 'Unavailable';
        }
    }

    // Browser → Local (WebGPU)
    const browserLocalIcon = document.getElementById('browser-local-icon');
    const browserLocalText = document.getElementById('browser-local-text');

    if (browserLocalIcon && browserLocalText) {
        if (availableProviders.webgpu.online) {
            browserLocalIcon.className = 'provider-status-icon online';
            browserLocalText.className = 'provider-status-value online';
            browserLocalText.textContent = 'WebGPU Available';
        } else {
            browserLocalIcon.className = 'provider-status-icon offline';
            browserLocalText.className = 'provider-status-value offline';
            browserLocalText.textContent = 'WebGPU Unavailable';
        }
    }

    // Proxy → Local (Ollama)
    const proxyLocalIcon = document.getElementById('proxy-local-icon');
    const proxyLocalText = document.getElementById('proxy-local-text');

    if (proxyLocalIcon && proxyLocalText) {
        if (availableProviders.ollama.online) {
            proxyLocalIcon.className = 'provider-status-icon online';
            proxyLocalText.className = 'provider-status-value online';
            proxyLocalText.textContent = `Ollama (${availableProviders.ollama.models.length} models)`;
        } else {
            proxyLocalIcon.className = 'provider-status-icon offline';
            proxyLocalText.className = 'provider-status-value offline';
            proxyLocalText.textContent = 'Ollama Offline';
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

// Auto-populate default models on boot if none configured
function autoPopulateDefaultModels() {
    // Only auto-populate if no models are currently selected
    if (selectedModels.length > 0) {
        console.log('[ModelConfig] Models already configured, skipping auto-population');
        return;
    }

    console.log('[ModelConfig] No models configured, checking for defaults...');

    // Priority 1: Ollama with powerful models (gpt-oss:120b, etc.)
    if (availableProviders.ollama.online && availableProviders.ollama.models.length > 0) {
        // Look for powerful models first (120b, 70b, etc.)
        const powerfulModel = availableProviders.ollama.models.find(m =>
            m.id.includes('120b') || m.id.includes('70b') || m.id.includes('gpt-oss')
        );

        if (powerfulModel) {
            const defaultModel = {
                id: powerfulModel.id,
                name: powerfulModel.name,
                provider: 'ollama',
                hostType: 'proxy-local',
                queryMethod: 'proxy',
                keySource: 'none'
            };
            selectedModels.push(defaultModel);
            saveToStorage();
            console.log('[ModelConfig] Auto-added Ollama default model:', defaultModel);
            return;
        }

        // If no powerful model, use first available Ollama model
        const firstModel = availableProviders.ollama.models[0];
        const defaultModel = {
            id: firstModel.id,
            name: firstModel.name,
            provider: 'ollama',
            hostType: 'proxy-local',
            queryMethod: 'proxy',
            keySource: 'none'
        };
        selectedModels.push(defaultModel);
        saveToStorage();
        console.log('[ModelConfig] Auto-added Ollama default model:', defaultModel);
        return;
    }

    // Priority 2: Cloud proxy (if proxy is online with API keys)
    // Note: We assume proxy has keys if it's online, but ideally we'd check /api/health for key status
    if (availableProviders.proxy.online) {
        const defaultModel = {
            id: 'gemini-2.5-flash',
            name: 'Flash',
            provider: 'gemini',
            hostType: 'proxy-cloud',
            queryMethod: 'proxy',
            keySource: 'proxy-env'
        };
        selectedModels.push(defaultModel);
        saveToStorage();
        console.log('[ModelConfig] Auto-added cloud proxy default model:', defaultModel);
        return;
    }

    console.log('[ModelConfig] No default models available (Ollama offline, proxy offline)');
}

// Export functions
export function getSelectedModels() {
    return selectedModels;
}

export function hasModelsConfigured() {
    return selectedModels.length > 0;
}
