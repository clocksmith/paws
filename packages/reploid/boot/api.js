// API status checking and model population
import { state, elements } from './state.js';

const PROXY_BASE_URL = 'http://localhost:8000';

export async function checkAPIStatus() {
    console.log('[API] Checking server status...');

    // Check if proxy server is available
    try {
        const response = await fetch(`${PROXY_BASE_URL}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[API] Server online:', data);

            state.detectedEnv.hasServer = true;
            state.detectedEnv.providers = data.providers || [];

            // Update proxy chip - always show as online if we got here
            if (elements.proxyChip) {
                elements.proxyChip.className = 'status-chip status-chip--active';
                elements.proxyChip.textContent = 'Proxy Online';
            }

            // Update provider chip based on what's available
            if (elements.providerChip) {
                const providers = data.providers || [];
                if (providers.length > 0) {
                    // Show the primary provider
                    const primaryProvider = data.primaryProvider || providers[0];
                    const providerName = primaryProvider.charAt(0).toUpperCase() + primaryProvider.slice(1);

                    elements.providerChip.className = 'status-chip status-chip--active';

                    if (providers.length === 1) {
                        elements.providerChip.textContent = `${providerName} Ready`;
                    } else {
                        elements.providerChip.textContent = `${providerName} +${providers.length - 1}`;
                    }
                } else {
                    elements.providerChip.className = 'status-chip status-chip--warning';
                    elements.providerChip.textContent = 'No API Keys';
                }
            }

            // Store Ollama status for mode selection
            if (data.ollamaStatus === 'running') {
                state.detectedEnv.hasOllama = true;
            }

            // Update provider status display
            if (data.primaryProvider && elements.providerStatus) {
                const savedModel = localStorage.getItem('SELECTED_MODEL');
                if (!savedModel) {
                    const providerName = data.primaryProvider.charAt(0).toUpperCase() + data.primaryProvider.slice(1);
                    elements.providerStatus.textContent = `${providerName} via Proxy`;

                    // Update features list
                    const providerDetail = document.getElementById('provider-status-detail');
                    if (providerDetail) {
                        providerDetail.textContent = `Using ${providerName} API`;
                    }

                    const feature2 = document.getElementById('feature-2-text');
                    if (feature2) {
                        feature2.textContent = `${data.providers.length} provider${data.providers.length > 1 ? 's' : ''} available`;
                    }
                }
            }
        }
    } catch (error) {
        console.warn('[API] Server offline:', error.message);
        state.detectedEnv.hasServer = false;

        if (elements.proxyChip) {
            elements.proxyChip.className = 'status-chip status-chip--inactive';
            elements.proxyChip.textContent = 'Proxy Offline';
        }

        if (elements.providerChip) {
            elements.providerChip.className = 'status-chip status-chip--inactive';
            elements.providerChip.textContent = 'Web LLM Only';
        }

        if (elements.providerStatus) {
            elements.providerStatus.textContent = 'Proxy Offline';
            elements.providerStatusDetail.textContent = 'Run: npm start';
        }
    }

    // Check WebGPU availability
    if (navigator.gpu) {
        state.detectedEnv.hasWebGPU = true;
        console.log('[API] WebGPU available');
    }

    // Update mode card availability
    updateModeAvailability();
}

export function updateModeAvailability() {
    const env = state.detectedEnv;

    // Disable modes based on availability
    const modeCards = {
        cloud: document.querySelector('.mode-card[data-mode="cloud"]'),
        local: document.querySelector('.mode-card[data-mode="local"]'),
        'web-llm': document.querySelector('.mode-card[data-mode="web-llm"]'),
        hybrid: document.querySelector('.mode-card[data-mode="hybrid"]'),
        multi: document.querySelector('.mode-card[data-mode="multi"]'),
        custom: document.querySelector('.mode-card[data-mode="custom"]')
    };

    // Cloud mode - requires proxy server with at least one provider
    if (modeCards.cloud) {
        if (!env.hasServer || !env.providers || env.providers.length === 0) {
            modeCards.cloud.classList.add('disabled');
        } else {
            modeCards.cloud.classList.remove('disabled');
        }
    }

    // Local mode - requires proxy server and Ollama
    if (modeCards.local) {
        if (!env.hasServer || !env.hasOllama) {
            modeCards.local.classList.add('disabled');
        } else {
            modeCards.local.classList.remove('disabled');
        }
    }

    // Web LLM - requires WebGPU
    if (modeCards['web-llm']) {
        if (!env.hasWebGPU) {
            modeCards['web-llm'].classList.add('disabled');
        } else {
            modeCards['web-llm'].classList.remove('disabled');
        }
    }

    // Hybrid - requires proxy, Ollama, and at least one cloud provider
    if (modeCards.hybrid) {
        if (!env.hasServer || !env.hasOllama || !env.providers || env.providers.length === 0) {
            modeCards.hybrid.classList.add('disabled');
        } else {
            modeCards.hybrid.classList.remove('disabled');
        }
    }

    // Multi - requires proxy and multiple providers
    if (modeCards.multi) {
        if (!env.hasServer || !env.providers || env.providers.length < 2) {
            modeCards.multi.classList.add('disabled');
        } else {
            modeCards.multi.classList.remove('disabled');
        }
    }

    // Custom - always available (user provides endpoint)
    if (modeCards.custom) {
        modeCards.custom.classList.remove('disabled');
    }
}

export async function populateOllamaModels() {
    if (!state.detectedEnv.hasServer || !state.detectedEnv.hasOllama) {
        console.log('[API] Skipping Ollama model population (server or Ollama not available)');
        return;
    }

    try {
        const response = await fetch(`${PROXY_BASE_URL}/api/ollama/models`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[API] Ollama models:', data.models);

            // Add Ollama models to the dropdown
            const modelSelect = document.getElementById('model-select');
            if (modelSelect && data.models && data.models.length > 0) {
                const localOptgroup = modelSelect.querySelector('optgroup[label*="Local"]');
                if (localOptgroup) {
                    // Clear existing Ollama options
                    const existingOptions = Array.from(localOptgroup.querySelectorAll('option[data-provider="local"]'));
                    existingOptions.forEach(opt => opt.remove());

                    // Add new Ollama models
                    data.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.name;
                        option.textContent = `${model.name} (Ollama)`;
                        option.dataset.provider = 'local';
                        localOptgroup.insertBefore(option, localOptgroup.firstChild);
                    });
                }
            }
        }
    } catch (error) {
        console.warn('[API] Failed to fetch Ollama models:', error.message);
    }
}
