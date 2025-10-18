// Configuration management for API keys and model selection
import { state, elements } from './state.js';

export function loadStoredKeys() {
    const selectedModel = localStorage.getItem('SELECTED_MODEL');
    const aiProvider = localStorage.getItem('AI_PROVIDER');
    const selectedMode = localStorage.getItem('DEPLOYMENT_MODE');

    if (selectedModel && elements.modelSelect) {
        elements.modelSelect.value = selectedModel;
    }

    if (selectedMode) {
        state.selectedMode = selectedMode;
    }

    if (aiProvider) {
        state.selectedProvider = aiProvider;
    }

    console.log('[Config] Loaded settings:', { selectedModel, aiProvider, selectedMode });
}

export function saveAPIKeys() {
    const modelSelect = document.getElementById('model-select');
    const selectedModel = modelSelect?.value;

    if (selectedModel) {
        localStorage.setItem('SELECTED_MODEL', selectedModel);
        const option = modelSelect.selectedOptions[0];
        const provider = option?.dataset.provider;

        if (provider) {
            localStorage.setItem('AI_PROVIDER', provider);
        }
    }

    // Save deployment mode if selected
    if (state.selectedMode) {
        localStorage.setItem('DEPLOYMENT_MODE', state.selectedMode);
    }

    console.log('[Config] Configuration saved');

    // Close modal
    if (elements.configModal) {
        elements.configModal.classList.add('hidden');
    }

    // Update UI
    updateModelUI(selectedModel);
}

export function updateModelUI(modelName) {
    if (!modelName) return;

    // Update provider status display
    if (elements.providerStatus) {
        elements.providerStatus.textContent = modelName;
    }

    const provider = localStorage.getItem('AI_PROVIDER');
    if (elements.providerStatusDetail && provider) {
        elements.providerStatusDetail.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
    }
}
