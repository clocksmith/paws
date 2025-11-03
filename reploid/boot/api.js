// API status checking and model population
import { state, elements } from './state.js';

// Use the same origin as the current page, or fallback to localhost for local dev
const PROXY_BASE_URL = window.location.origin.includes('file://')
    ? 'http://localhost:8000'
    : window.location.origin;

// ModelRegistry integration - discovery of available models
export async function discoverAvailableModels() {
    console.log('[API] Discovering available models via ModelRegistry...');

    // Wait for ModelRegistry to be loaded
    let retries = 0;
    while (!window.ModelRegistry && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }

    if (!window.ModelRegistry) {
        console.warn('[API] ModelRegistry not available, falling back to basic detection');
        return await fallbackModelDiscovery();
    }

    try {
        const registry = await window.ModelRegistry.api.discoverModels(true); // force refresh
        console.log('[API] ModelRegistry discovered:', registry);

        state.availableModels = {
            cloud: [
                ...(registry.gemini || []),
                ...(registry.openai || []),
                ...(registry.anthropic || [])
            ],
            ollama: registry.ollama || [],
            webllm: registry.webllm || [],
            metadata: registry.metadata || {}
        };

        return state.availableModels;
    } catch (error) {
        console.warn('[API] ModelRegistry discovery failed:', error);
        return await fallbackModelDiscovery();
    }
}

// Fallback model discovery if ModelRegistry not available
async function fallbackModelDiscovery() {
    const models = {
        cloud: [],
        ollama: [],
        webllm: [],
        metadata: { providers: [], timestamp: Date.now() }
    };

    // Check cloud models via proxy status
    try {
        const response = await fetch(`${PROXY_BASE_URL}/api/proxy-status`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
            const data = await response.json();
            const providers = data.providers || {};

            // Add cloud models based on available providers
            if (providers.gemini) {
                models.cloud.push(
                    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'gemini', tier: 'fast', available: true },
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', tier: 'balanced', available: true }
                );
                models.metadata.providers.push('gemini');
            }
            if (providers.openai) {
                models.cloud.push(
                    { id: 'gpt-5-2025-08-07-mini', name: 'GPT-5 Mini', provider: 'openai', tier: 'fast', available: true },
                    { id: 'gpt-5-2025-08-07', name: 'GPT-5', provider: 'openai', tier: 'advanced', available: true }
                );
                models.metadata.providers.push('openai');
            }
            if (providers.anthropic) {
                models.cloud.push(
                    { id: 'claude-4-5-haiku', name: 'Claude 4.5 Haiku', provider: 'anthropic', tier: 'fast', available: true },
                    { id: 'claude-4-5-sonnet', name: 'Claude 4.5 Sonnet', provider: 'anthropic', tier: 'balanced', available: true }
                );
                models.metadata.providers.push('anthropic');
            }
        }
    } catch (error) {
        console.warn('[API] Proxy status check failed:', error);

        // Check localStorage for browser-direct keys
        const localStorageKeys = {
            gemini: !!localStorage.getItem('GEMINI_API_KEY'),
            openai: !!localStorage.getItem('OPENAI_API_KEY'),
            anthropic: !!localStorage.getItem('ANTHROPIC_API_KEY')
        };

        if (localStorageKeys.gemini) {
            models.cloud.push(
                { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'gemini', tier: 'fast', available: true },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', tier: 'balanced', available: true }
            );
            models.metadata.providers.push('gemini');
        }
        if (localStorageKeys.openai) {
            models.cloud.push(
                { id: 'gpt-5-2025-08-07-mini', name: 'GPT-5 Mini', provider: 'openai', tier: 'fast', available: true },
                { id: 'gpt-5-2025-08-07', name: 'GPT-5', provider: 'openai', tier: 'advanced', available: true }
            );
            models.metadata.providers.push('openai');
        }
        if (localStorageKeys.anthropic) {
            models.cloud.push(
                { id: 'claude-4-5-haiku', name: 'Claude 4.5 Haiku', provider: 'anthropic', tier: 'fast', available: true },
                { id: 'claude-4-5-sonnet', name: 'Claude 4.5 Sonnet', provider: 'anthropic', tier: 'balanced', available: true }
            );
            models.metadata.providers.push('anthropic');
        }
    }

    // Check Ollama models
    if (state.detectedEnv.hasServer) {
        try {
            const response = await fetch(`${PROXY_BASE_URL}/api/ollama/models`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                models.ollama = (data.models || []).map(model => ({
                    id: model.name,
                    name: model.name,
                    provider: 'ollama',
                    tier: 'local',
                    size: model.size,
                    modified: model.modified,
                    available: true
                }));
            }
        } catch (error) {
            console.warn('[API] Ollama check failed:', error);
        }
    }

    // Check WebLLM/WebGPU
    if (navigator.gpu) {
        models.webllm = [
            { id: 'Qwen2.5-1.5B-Instruct', name: 'Qwen2.5-1.5B-Instruct', provider: 'webllm', tier: 'browser', size: '1.5GB', available: true },
            { id: 'Phi-3.5-mini-instruct', name: 'Phi-3.5-mini-instruct', provider: 'webllm', tier: 'browser', size: '2.3GB', available: true },
            { id: 'Llama-3.2-1B-Instruct', name: 'Llama-3.2-1B-Instruct', provider: 'webllm', tier: 'browser', size: '1.2GB', available: true }
        ];
    }

    state.availableModels = models;
    return models;
}

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
