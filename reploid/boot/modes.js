// Contains all logic for the deployment mode selection UI and configuration.
import { state, elements } from './state.js';
import { closeHelpPopover, openHelpPopover, showBootMessage, closeConfigModal } from './ui.js';
import { checkAPIStatus } from './api.js';

// Use the same origin as the current page, or fallback to localhost for local dev
const PROXY_BASE_URL = window.location.origin.includes('file://')
    ? 'http://localhost:8000'
    : window.location.origin;

// Cloud model configuration - loaded from config.json
let CLOUD_MODELS = {
    geminiModelFast: 'gemini-2.5-flash-lite',
    geminiModelBalanced: 'gemini-2.5-flash',
    openaiModelFast: 'gpt-5-2025-08-07-mini',
    openaiModelAdvanced: 'gpt-5-2025-08-07',
    anthropicModelFast: 'claude-4-5-haiku',
    anthropicModelBalanced: 'claude-4-5-sonnet'
};

// Load cloud models from config.json
(async () => {
    try {
        const response = await fetch('/config.json');
        if (response.ok) {
            const config = await response.json();
            if (config.providers) {
                CLOUD_MODELS = {
                    geminiModelFast: config.providers.geminiModelFast || CLOUD_MODELS.geminiModelFast,
                    geminiModelBalanced: config.providers.geminiModelBalanced || CLOUD_MODELS.geminiModelBalanced,
                    openaiModelFast: config.providers.openaiModelFast || CLOUD_MODELS.openaiModelFast,
                    openaiModelAdvanced: config.providers.openaiModelAdvanced || CLOUD_MODELS.openaiModelAdvanced,
                    anthropicModelFast: config.providers.anthropicModelFast || CLOUD_MODELS.anthropicModelFast,
                    anthropicModelBalanced: config.providers.anthropicModelBalanced || CLOUD_MODELS.anthropicModelBalanced
                };
            }
        }
    } catch (error) {
        console.warn('[boot/modes] Failed to load config.json, using defaults:', error);
    }
})();

export const MODE_INFO = {
    local: {
        title: '⌨️ Local (Ollama) Configuration',
        icon: '⌨️',
        help: {
            title: 'Local Mode (Ollama)',
            requirements: ['Ollama installed and running', 'At least one model pulled', 'Node.js proxy server (npm start)'],
            pros: ['Completely free (unlimited usage)', 'Maximum privacy (no data sent externally)', 'Fast inference with good hardware', 'Works offline'],
            cons: ['Requires powerful hardware (GPU recommended)', 'Limited to model capabilities', 'Takes disk space (models are large)'],
            bestFor: 'Development and testing, privacy-sensitive work, budget-conscious users'
        }
    },
    cloud: {
        title: '☁️ Cloud Provider Configuration',
        icon: '☁️',
        help: {
            title: 'Cloud Provider Mode',
            requirements: ['API key from provider', 'Internet connection', 'Node.js proxy server (optional)'],
            pros: ['Fast and powerful models', 'Advanced capabilities (vision, large context)', 'No local hardware requirements', 'Always up-to-date models'],
            cons: ['API costs apply (~$0.01-0.10 per 1K requests)', 'Data sent to third-party servers', 'Requires internet connection', 'Usage limits may apply'],
            bestFor: 'Production use, advanced model capabilities, when local hardware is limited'
        }
    },
    browser: {
        title: '♁ Browser-Only Configuration',
        icon: '♁',
        help: {
            title: 'Browser-Only Mode',
            requirements: ['Modern browser with WebGPU support', 'GPU with sufficient VRAM (4GB+)'],
            pros: ['No server needed', 'No API costs', 'Works anywhere', 'Privacy-preserving'],
            cons: ['Limited to smaller models (3B-7B)', 'Slower than native inference', 'Large initial download', 'Limited features (no VFS persistence)'],
            bestFor: 'Demos, educational use, when no backend is available'
        }
    },
    'web-llm': {
        title: '⚌️ Web LLM Configuration',
        icon: '⚌️',
        help: {
            title: 'Web LLM (WebGPU) Mode',
            requirements: ['Modern browser with WebGPU support', 'GPU with 4GB+ VRAM', 'Initial model download (3-4GB)'],
            pros: ['Runs entirely in browser', 'No API keys required', 'Keeps data on device'],
            cons: ['Large first-time download', 'Higher GPU usage', 'Limited to smaller models'],
            bestFor: 'When you have a capable browser GPU but no server or API access'
        }
    },
    hybrid: {
        title: '↻ Hybrid Mode Configuration',
        icon: '↻',
        help: {
            title: 'Hybrid (Auto-Switching) Mode',
            requirements: ['Ollama installed', 'At least one cloud API key', 'Node.js proxy server'],
            pros: ['Cost optimized', 'Automatic failover', 'Best of both worlds', 'Smart load balancing'],
            cons: ['More complex setup', 'Still incurs some API costs', 'Requires both local and cloud setup'],
            bestFor: 'Power users, production with budget constraints, high availability needs'
        }
    },
    multi: {
        title: '🏢 High Availability Configuration',
        icon: '🏢',
        help: {
            title: 'High Availability (Multi-Model) Mode',
            requirements: ['API keys for 2-3 different providers', 'Node.js proxy server', 'PAXA module enabled'],
            pros: ['Never fails (automatic failover)', 'Best quality (consensus voting)', 'Fault tolerant', 'Production ready'],
            cons: ['3x cost (multiple simultaneous calls)', 'More complex configuration', 'Slower responses'],
            bestFor: 'Production systems requiring high availability, quality-critical applications'
        }
    },
    custom: {
        title: '⚒ Custom Endpoint Configuration',
        icon: '⚒',
        help: {
            title: 'Custom Endpoint Mode',
            requirements: ['Your own API endpoint', 'Compatible API format'],
            pros: ['Use your own infrastructure', 'Custom models', 'Enterprise-ready (Azure, AWS, etc.)', 'Full control'],
            cons: ['Advanced setup required', 'Must implement compatible API', 'Self-managed'],
            bestFor: 'Enterprise deployments, custom infrastructure, self-hosted solutions'
        }
    },
    offline: {
        title: '🛡️ Fully Offline Configuration',
        icon: '🛡️',
        help: {
            title: 'Fully Offline Mode',
            requirements: ['Ollama installed with models pre-pulled', 'Node.js proxy server', 'No external network dependencies'],
            pros: ['Zero external network traffic', 'Maximum privacy & compliance', 'Unlimited usage'],
            cons: ['No cloud failover', 'Manual updates only', 'Requires ample local storage and hardware'],
            bestFor: 'Airgapped environments, security-sensitive workflows, travel without internet'
        }
    }
};

export async function detectEnvironment() {
    const env = {
        hasServer: false,
        hasOllama: false,
        ollamaModels: [],
        hasGeminiKey: false,
        hasOpenAIKey: false,
        hasAnthropicKey: false,
        isOffline: typeof navigator !== 'undefined' ? navigator.onLine === false : false,
        hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator
    };

    try {
        const response = await fetch(`${PROXY_BASE_URL}/api/health`);
        env.hasServer = response.ok;
    } catch {}

    if (env.hasServer) {
        try {
            const response = await fetch(`${PROXY_BASE_URL}/api/ollama/models`);
            if (response.ok) {
                const data = await response.json();
                env.hasOllama = true;
                env.ollamaModels = data.models || [];
            }
        } catch {}
    }

    env.hasGeminiKey = !!localStorage.getItem('GEMINI_API_KEY');
    env.hasOpenAIKey = !!localStorage.getItem('OPENAI_API_KEY');
    env.hasAnthropicKey = !!localStorage.getItem('ANTHROPIC_API_KEY');

    if (!Array.isArray(env.ollamaModels)) {
        env.ollamaModels = [];
    }

    return env;
}

export function getRecommendedMode(env) {
    if (env.hasOllama && env.isOffline) {
        return {
            mode: 'offline',
            reason: 'Offline environment detected. You can run entirely locally with Ollama and no external dependencies.'
        };
    }

    if (env.hasOllama && env.ollamaModels.length > 0) {
        return {
            mode: 'local',
            reason: `We detected Ollama with ${env.ollamaModels.length} model(s). You have everything needed to run completely free and private.`
        };
    }

    if (env.hasGeminiKey || env.hasOpenAIKey || env.hasAnthropicKey) {
        const providers = [];
        if (env.hasGeminiKey) providers.push('Gemini');
        if (env.hasOpenAIKey) providers.push('OpenAI');
        if (env.hasAnthropicKey) providers.push('Anthropic');
        return {
            mode: 'cloud',
            reason: `We detected API keys for ${providers.join(', ')}. You can use cloud providers for fast and powerful inference.`
        };
    }

    if (!env.hasServer) {
        if (env.hasWebGPU) {
            return {
                mode: 'web-llm',
                reason: 'No server detected, but WebGPU is available. Web LLM lets you run models directly in the browser.'
            };
        }
        return {
            mode: 'browser',
            reason: 'No server detected. Browser-only mode is your best option for getting started quickly.'
        };
    }

    return {
        mode: 'local',
        reason: 'Local mode with Ollama is recommended for free, private usage. Install Ollama to get started.'
    };
}

export async function showModeRecommendation() {
    const env = await detectEnvironment();
    state.detectedEnv = env;
    const recommendation = getRecommendedMode(env);

    if (elements.recommendationText && elements.modeRecommendation) {
        elements.recommendationText.textContent = recommendation.reason;
        elements.modeRecommendation.classList.remove('hidden');
    }

    if (elements.useRecommendedBtn) {
        elements.useRecommendedBtn.onclick = () => selectMode(recommendation.mode, env);
    }

    return env;
}

export function getStoredDeploymentMode() {
    const storedMode = localStorage.getItem('DEPLOYMENT_MODE');
    if (storedMode) return storedMode;

    const provider = (localStorage.getItem('AI_PROVIDER') || '').toLowerCase();
    const providerModeMap = {
        'local': 'local',
        'ollama': 'local',
        'gemini': 'cloud',
        'openai': 'cloud',
        'anthropic': 'cloud',
        'web': 'web-llm',
        'browser': 'browser',
        'hybrid': 'hybrid',
        'arena': 'multi',
        'paxos': 'multi', // backward compatibility
        'distributed': 'multi',
        'custom': 'custom',
        'offline': 'offline'
    };

    return providerModeMap[provider] || null;
}

function setModeCardSelection(modeName) {
    const cards = document.querySelectorAll('.mode-card');
    if (!cards.length) return;

    cards.forEach(card => {
        card.classList.toggle('selected', modeName ? card.dataset.mode === modeName : false);
    });
}

export function highlightStoredMode() {
    const storedMode = getStoredDeploymentMode();
    setModeCardSelection(storedMode);

    if (storedMode === 'cloud') {
        const provider = localStorage.getItem('AI_PROVIDER');
        if (provider && ['gemini', 'openai', 'anthropic'].includes(provider)) {
            state.selectedProvider = provider;
        } else {
            state.selectedProvider = null;
        }
    } else if (storedMode === 'web-llm') {
        state.selectedProvider = 'web';
    } else if (storedMode === 'offline' || storedMode === 'local') {
        state.selectedProvider = 'local';
    } else {
        state.selectedProvider = null;
    }
}

export function selectMode(modeName, env) {
    const environment = env || state.detectedEnv || {};
    if (!Array.isArray(environment.ollamaModels)) {
        environment.ollamaModels = [];
    }

    closeHelpPopover();

    setModeCardSelection(modeName);

    if (elements.modeCards && elements.modeConfigSection) {
        elements.modeCards.style.display = 'none';
        if (elements.modeRecommendation) {
            elements.modeRecommendation.style.display = 'none';
        }
        elements.modeConfigSection.classList.remove('hidden');

        if (elements.modeConfigTitle && MODE_INFO[modeName]) {
            elements.modeConfigTitle.textContent = MODE_INFO[modeName].title;
        }

        if (elements.modeConfigContent) {
            elements.modeConfigContent.innerHTML = renderModeConfig(modeName, environment);
            setupModeConfigInteractions(modeName);
        }

        state.selectedMode = modeName;

        if (modeName !== 'cloud') {
            state.selectedProvider = null;
        }
    }
}

export function backToModes() {
    if (elements.modeConfigSection) {
        elements.modeConfigSection.classList.add('hidden');
    }
    if (elements.modeCards) {
        elements.modeCards.style.display = 'grid';
    }
    if (elements.modeRecommendation) {
        elements.modeRecommendation.style.display = 'block';
    }

    state.selectedMode = null;
    highlightStoredMode();
    closeHelpPopover();
}

function renderModeConfig(modeName, env) {
    switch (modeName) {
        case 'local':
            return renderLocalConfig(env);
        case 'cloud':
            return renderCloudConfig(env);
        case 'browser':
            return renderBrowserConfig(env);
        case 'web-llm':
            return renderWebLLMConfig(env);
        case 'hybrid':
            return renderHybridConfig(env);
        case 'multi':
            return renderMultiConfig(env);
        case 'custom':
            return renderCustomConfig(env);
        case 'offline':
            return renderOfflineConfig(env);
        default:
            return '<p>Configuration not available</p>';
    }
}

function setupModeConfigInteractions(modeName) {
    if (!elements.modeConfigContent) return;

    if (modeName === 'local') {
        const listItems = elements.modeConfigContent.querySelectorAll('.model-list-item');
        if (listItems.length) {
            const activateItem = (item) => {
                listItems.forEach(li => li.classList.toggle('selected', li === item));
                const radio = item.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
            };

            listItems.forEach(item => {
                item.addEventListener('click', (event) => {
                    if (event.target instanceof HTMLInputElement) return;
                    activateItem(item);
                });
                const radio = item.querySelector('input[type="radio"]');
                if (radio) {
                    radio.addEventListener('change', () => activateItem(item));
                }
            });
        }
    }

    if (modeName === 'cloud') {
        const cards = Array.from(elements.modeConfigContent.querySelectorAll('.provider-card'));
        if (cards.length) {
            const selectProvider = (provider) => {
                cards.forEach(card => {
                    card.classList.toggle('selected', card.dataset.provider === provider);
                });
                state.selectedProvider = provider;
            };

            let initialCard = cards.find(card => card.classList.contains('selected'));
            if (!initialCard) {
                const storedProvider = (localStorage.getItem('AI_PROVIDER') || '').toLowerCase();
                initialCard = cards.find(card => card.dataset.provider === storedProvider) ||
                    cards.find(card => card.classList.contains('configured')) ||
                    cards[0];
            }
            if (initialCard) {
                selectProvider(initialCard.dataset.provider);
            }

            cards.forEach(card => {
                card.addEventListener('click', () => {
                    selectProvider(card.dataset.provider);
                });
            });
        }

        const keyInputs = elements.modeConfigContent.querySelectorAll('.provider-api-key');
        keyInputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (input.value && input.value.startsWith('●')) {
                    input.value = '';
                }
            });
        });
    }
}

export function showModeHelp(modeName, anchorEl) {
    const modeInfo = MODE_INFO[modeName];
    if (!modeInfo || !modeInfo.help) return;

    const { help } = modeInfo;
    const sections = [];

    if (help.requirements && help.requirements.length) {
        sections.push(`
            <div class="help-section">
                <strong>Requirements</strong>
                <ul>${help.requirements.map(item => `<li>${item}</li>`).join('')}</ul>
            </div>
        `);
    }

    if (help.pros && help.pros.length) {
        sections.push(`
            <div class="help-section">
                <strong>Pros</strong>
                <ul>${help.pros.map(item => `<li>${item}</li>`).join('')}</ul>
            </div>
        `);
    }

    if (help.cons && help.cons.length) {
        sections.push(`
            <div class="help-section">
                <strong>Cons</strong>
                <ul>${help.cons.map(item => `<li>${item}</li>`).join('')}</ul>
            </div>
        `);
    }

    if (help.bestFor) {
        sections.push(`
            <div class="help-section">
                <strong>Best For</strong>
                <p>${help.bestFor}</p>
            </div>
        `);
    }

    const body = sections.join('');
    openHelpPopover(`mode-${modeName}`, anchorEl, {
        title: help.title || modeInfo.title || 'Mode Details',
        body
    });
}

function renderLocalConfig(env) {
    let html = '';
    const models = Array.isArray(env?.ollamaModels) ? env.ollamaModels : [];

    if (env.hasOllama && models.length > 0) {
        html += `
            <div class="mode-status">
                <span class="mode-status-icon">✓</span>
                <div class="mode-status-text">
                    <div class="mode-status-label">Status</div>
                    <div class="mode-status-value">Ollama detected with ${models.length} model(s)</div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">Ollama not detected. Install Ollama and run <code>ollama serve</code> to use local models.</span>
            </div>
        `;
    }

    if (models.length > 0) {
        html += '<h5 style="margin: 16px 0 8px 0; color: #f4f4ff;">Available Models:</h5>';
        html += '<ul class="model-list">';

        const selectedModel = localStorage.getItem('LOCAL_MODEL');
        models.forEach((model, idx) => {
            const sizeGB = Math.round(model.size / 1024 / 1024 / 1024);
            const isSelected = selectedModel === model.name;
            html += `
                <li class="model-list-item ${isSelected ? 'selected' : ''}" data-model="${model.name}">
                    <div class="model-info">
                        <div class="model-name">${model.name}</div>
                        <div class="model-size">${sizeGB}GB</div>
                    </div>
                    <input type="radio" name="local-model-select" value="${model.name}" ${isSelected ? 'checked' : ''} class="model-select-radio" />
                </li>
            `;
        });
        html += '</ul>';
    }

    const endpoint = localStorage.getItem('LOCAL_ENDPOINT') || 'http://localhost:11434';
    html += `
        <div style="margin-top: 16px;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Ollama Endpoint:</label>
            <input type="text" id="mode-local-endpoint" value="${endpoint}" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
        </div>
    `;

    html += `
        <div class="mode-info">
            <span class="mode-info-text">◯ Local mode is completely free and private. Your code never leaves your machine.</span>
        </div>
    `;

    return html;
}

function renderOfflineConfig(env) {
    const hasKeys = env.hasGeminiKey || env.hasOpenAIKey || env.hasAnthropicKey;
    const autoStart = localStorage.getItem('AUTO_START_OLLAMA') === 'true';
    const webrtcEnabled = localStorage.getItem('ENABLE_WEBRTC') === 'true';

    let html = `
        <div class="mode-info">
            <span class="mode-info-text">🛡️ Fully offline mode keeps all prompts, code, and models on this device. Perfect for secure or airgapped environments.</span>
        </div>
    `;

    if (!env.hasServer) {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">Local proxy server not detected. Run <code>npm start</code> to enable VFS persistence while offline.</span>
            </div>
        `;
    }

    if (!env.hasOllama) {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">Ollama runtime not detected. Install and run <code>ollama serve</code> before going offline.</span>
            </div>
        `;
    } else if (Array.isArray(env.ollamaModels) && env.ollamaModels.length > 0) {
        html += `
            <div class="mode-status">
                <span class="mode-status-icon">✓</span>
                <div class="mode-status-text">
                    <div class="mode-status-label">Local Models</div>
                    <div class="mode-status-value">${env.ollamaModels.length} available</div>
                </div>
            </div>
        `;
    }

    if (hasKeys) {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">Cloud API keys detected. They can be removed automatically when you save this configuration.</span>
            </div>
        `;
    } else {
        html += `
            <div class="mode-status">
                <span class="mode-status-icon">✓</span>
                <div class="mode-status-text">
                    <div class="mode-status-label">Cloud Keys</div>
                    <div class="mode-status-value">None detected</div>
                </div>
            </div>
        `;
    }

    html += `
        <div class="setting-item">
            <label class="setting-checkbox-label">
                <span class="custom-checkbox">
                    <input type="checkbox" id="mode-offline-auto-start" ${autoStart ? 'checked' : ''} />
                    <span class="custom-checkbox-box"></span>
                </span>
                <span class="setting-checkbox-text">Auto-start Ollama with the proxy server</span>
            </label>
            <p class="setting-description">Ensures <code>ollama serve</code> runs whenever you awaken Reploid locally.</p>
        </div>

        <div class="setting-item">
            <label class="setting-checkbox-label">
                <span class="custom-checkbox">
                    <input type="checkbox" id="mode-offline-disable-webrtc" ${!webrtcEnabled ? 'checked' : ''} />
                    <span class="custom-checkbox-box"></span>
                </span>
                <span class="setting-checkbox-text">Disable WebRTC Swarm (recommended offline)</span>
            </label>
            <p class="setting-description">Prevents peer-to-peer networking attempts while you are disconnected.</p>
        </div>
    `;

    html += `
        <div class="setting-item">
            <label class="setting-checkbox-label">
                <span class="custom-checkbox">
                    <input type="checkbox" id="mode-offline-clear-keys" ${hasKeys ? 'checked' : ''} ${hasKeys ? '' : 'disabled'} />
                    <span class="custom-checkbox-box"></span>
                </span>
                <span class="setting-checkbox-text">Remove saved cloud API keys on save</span>
            </label>
            <p class="setting-description">Clears Gemini/OpenAI/Anthropic keys so nothing leaves your machine. (${hasKeys ? 'Recommended' : 'No keys stored'})</p>
        </div>

        <div class="mode-info" style="margin-top: 16px;">
            <span class="mode-info-text">Tip: Pre-pull models with <code>ollama pull &lt;model&gt;</code> while online, then disconnect to run fully offline.</span>
        </div>
    `;

    return html;
}

function renderCloudConfig(env) {
    let html = `
        <div class="mode-warning">
            <span class="mode-warning-icon">⚠️</span>
            <span class="mode-warning-text">Using cloud providers will send your code and prompts to third-party servers. API costs apply.</span>
        </div>
    `;

    html += '<div class="provider-list">';

    const selectedModel = localStorage.getItem('SELECTED_MODEL') || '';
    const storedProviderRaw = (localStorage.getItem('AI_PROVIDER') || '').toLowerCase();
    const defaultProvider = ['gemini', 'openai', 'anthropic'].includes(state.selectedProvider) ? state.selectedProvider
        : (['gemini', 'openai', 'anthropic'].includes(storedProviderRaw) ? storedProviderRaw : '');

    if (!state.selectedProvider && defaultProvider) {
        state.selectedProvider = defaultProvider;
    }

    const geminiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    const geminiConfigured = !!geminiKey;
    const geminiStoredModel = localStorage.getItem('GEMINI_SELECTED_MODEL') ||
        (selectedModel.startsWith('gemini-') ? selectedModel : CLOUD_MODELS.geminiModelBalanced);
    html += `
        <div class="provider-card ${geminiConfigured ? 'configured' : ''} ${state.selectedProvider === 'gemini' ? 'selected' : ''}" data-provider="gemini">
            <div class="provider-header">
                <span class="provider-name">Google Gemini</span>
                <span class="provider-status-badge ${geminiConfigured ? 'configured' : 'not-configured'}">
                    ${geminiConfigured ? 'Configured' : 'Not Configured'}
                </span>
            </div>
            <p class="provider-description">Fast and cost-effective • 1,500 free requests/day • Best for rapid iteration</p>
            <select class="provider-model-select" data-provider="gemini">
                <option value="${CLOUD_MODELS.geminiModelFast}" ${geminiStoredModel === CLOUD_MODELS.geminiModelFast ? 'selected' : ''}>Gemini 2.5 Flash Lite (Fast)</option>
                <option value="${CLOUD_MODELS.geminiModelBalanced}" ${geminiStoredModel === CLOUD_MODELS.geminiModelBalanced ? 'selected' : ''}>Gemini 2.5 Flash (Balanced)</option>
            </select>
            <input type="password" class="provider-api-key ${geminiConfigured ? 'configured' : ''}" data-provider="gemini" placeholder="AIza..." value="${geminiKey ? '●●●●●●●●' + geminiKey.slice(-4) : ''}" />
        </div>
    `;

    const openaiKey = localStorage.getItem('OPENAI_API_KEY') || '';
    const openaiConfigured = !!openaiKey;
    const openaiStoredModel = localStorage.getItem('OPENAI_SELECTED_MODEL') ||
        (selectedModel.startsWith('gpt-') ? selectedModel : CLOUD_MODELS.openaiModelAdvanced);
    html += `
        <div class="provider-card ${openaiConfigured ? 'configured' : ''} ${state.selectedProvider === 'openai' ? 'selected' : ''}" data-provider="openai">
            <div class="provider-header">
                <span class="provider-name">OpenAI</span>
                <span class="provider-status-badge ${openaiConfigured ? 'configured' : 'not-configured'}">
                    ${openaiConfigured ? 'Configured' : 'Not Configured'}
                </span>
            </div>
            <p class="provider-description">Most popular • Vision and multimodal support • Best for production</p>
            <select class="provider-model-select" data-provider="openai">
                <option value="${CLOUD_MODELS.openaiModelFast}" ${openaiStoredModel === CLOUD_MODELS.openaiModelFast ? 'selected' : ''}>GPT-5 Mini (Fast)</option>
                <option value="${CLOUD_MODELS.openaiModelAdvanced}" ${openaiStoredModel === CLOUD_MODELS.openaiModelAdvanced ? 'selected' : ''}>GPT-5 (Advanced)</option>
            </select>
            <input type="password" class="provider-api-key ${openaiConfigured ? 'configured' : ''}" data-provider="openai" placeholder="sk-..." value="${openaiKey ? '●●●●●●●●' + openaiKey.slice(-4) : ''}" />
        </div>
    `;

    const anthropicKey = localStorage.getItem('ANTHROPIC_API_KEY') || '';
    const anthropicConfigured = !!anthropicKey;
    const anthropicStoredModel = localStorage.getItem('ANTHROPIC_SELECTED_MODEL') ||
        (selectedModel.startsWith('claude-') ? selectedModel : CLOUD_MODELS.anthropicModelBalanced);
    html += `
        <div class="provider-card ${anthropicConfigured ? 'configured' : ''} ${state.selectedProvider === 'anthropic' ? 'selected' : ''}" data-provider="anthropic">
            <div class="provider-header">
                <span class="provider-name">Anthropic Claude</span>
                <span class="provider-status-badge ${anthropicConfigured ? 'configured' : 'not-configured'}">
                    ${anthropicConfigured ? 'Configured' : 'Not Configured'}
                </span>
            </div>
            <p class="provider-description">Excellent for coding • Best safety features • Best for complex reasoning</p>
            <select class="provider-model-select" data-provider="anthropic">
                <option value="${CLOUD_MODELS.anthropicModelFast}" ${anthropicStoredModel === CLOUD_MODELS.anthropicModelFast ? 'selected' : ''}>Claude 4.5 Haiku (Fast)</option>
                <option value="${CLOUD_MODELS.anthropicModelBalanced}" ${anthropicStoredModel === CLOUD_MODELS.anthropicModelBalanced ? 'selected' : ''}>Claude 4.5 Sonnet (Balanced)</option>
            </select>
            <input type="password" class="provider-api-key ${anthropicConfigured ? 'configured' : ''}" data-provider="anthropic" placeholder="sk-ant-..." value="${anthropicKey ? '●●●●●●●●' + anthropicKey.slice(-4) : ''}" />
        </div>
    `;

    html += '</div>';

    return html;
}

function renderBrowserConfig(env) {
    return `
        <div class="mode-info">
            <span class="mode-info-text">♁ Browser-only mode serves Reploid as static files—perfect for GitHub Pages, Netlify, or quick demos without a backend.</span>
        </div>
        <div class="mode-warning">
            <span class="mode-warning-icon">⚠️</span>
            <span class="mode-warning-text">No proxy means no VFS persistence, Ollama discovery, or WebRTC signaling. Cloud APIs must allow browser CORS.</span>
        </div>
        <p style="color: #b9bad6; font-size: 14px; margin: 16px 0;">
            Pair this mode with Web LLM or bring-your-own API keys to keep things lightweight while still running real models.
        </p>
    `;
}

function renderWebLLMConfig(env) {
    const hasWebGPU = env.hasWebGPU;
    const profile = localStorage.getItem('WEB_LLM_PROFILE') || 'balanced';
    const cacheEnabled = localStorage.getItem('WEB_LLM_CACHE') !== 'false';

    let html = `
        <div class="mode-info">
            <span class="mode-info-text">⚌️ Web LLM streams the model into your browser and executes it with WebGPU. Ideal when you have a strong GPU but no backend.</span>
        </div>
    `;

    if (!hasWebGPU) {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">WebGPU not detected. Enable it in your browser (Chrome/Edge 113+) or switch to Browser-Only mode.</span>
            </div>
        `;
    } else {
        html += `
            <div class="mode-status">
                <span class="mode-status-icon">✓</span>
                <div class="mode-status-text">
                    <div class="mode-status-label">WebGPU</div>
                    <div class="mode-status-value">Ready for Web LLM</div>
                </div>
            </div>
        `;
    }

    html += `
        <div class="setting-item">
            <label for="mode-web-llm-profile" class="model-select-label">Performance profile</label>
            <select id="mode-web-llm-profile" class="model-select-dropdown">
                <option value="balanced" ${profile === 'balanced' ? 'selected' : ''}>Balanced (3-4B models)</option>
                <option value="light" ${profile === 'light' ? 'selected' : ''}>Lightweight (ideal for 4GB GPUs)</option>
                <option value="quality" ${profile === 'quality' ? 'selected' : ''}>Quality (bigger WebGPU models)</option>
            </select>
            <small class="setting-description" style="display:block; margin-top:6px;">Choose the model size Web LLM should prioritise. Smaller profiles use less VRAM and download faster.</small>
        </div>

        <div class="setting-item">
            <label class="setting-checkbox-label">
                <span class="custom-checkbox">
                    <input type="checkbox" id="mode-web-llm-cache" ${cacheEnabled ? 'checked' : ''} />
                    <span class="custom-checkbox-box"></span>
                </span>
                <span class="setting-checkbox-text">Cache Web LLM models for offline reuse</span>
            </label>
            <p class="setting-description">Keeps model shards in IndexedDB so you can reopen Reploid without re-downloading.</p>
        </div>

        <div class="mode-info" style="margin-top: 16px;">
            <span class="mode-info-text">Reminder: Close other GPU-intensive apps (games, 3D tools) for best performance.</span>
        </div>
    `;

    return html;
}

function renderHybridConfig(env) {
    let html = '';

    if (!env.hasOllama) {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">Ollama not detected. Hybrid mode requires Ollama for local inference.</span>
            </div>
        `;
    }

    if (!env.hasGeminiKey && !env.hasOpenAIKey && !env.hasAnthropicKey) {
        html += `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">No cloud API keys detected. Hybrid mode requires at least one cloud provider API key.</span>
            </div>
        `;
    }

    html += `
        <div class="mode-info">
            <span class="mode-info-text">↻ Hybrid mode automatically switches between local and cloud based on availability, cost, and complexity.</span>
        </div>
        <p style="color: #b9bad6; font-size: 14px; margin: 16px 0;">
            Configure both local (Ollama) and cloud providers. The system will intelligently choose the best option for each request.
        </p>
        <p style="color: #8e8ea6; font-size: 13px;">
            ◯ Tip: Use local models for simple tasks and cloud models for complex reasoning to optimize costs.
        </p>
    `;

    return html;
}

function renderMultiConfig(env) {
    const consensusType = localStorage.getItem('CONSENSUS_TYPE') || 'arena';
    const model1 = localStorage.getItem('MULTI_MODEL_1') || '';
    const model2 = localStorage.getItem('MULTI_MODEL_2') || '';
    const model3 = localStorage.getItem('MULTI_MODEL_3') || '';

    let html = `
        <div class="mode-warning">
            <span class="mode-warning-icon">⚠️</span>
            <span class="mode-warning-text">Multi-model mode will make multiple API calls simultaneously. This provides fault tolerance but increases costs ~3x.</span>
        </div>
    `;

    html += `
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px; font-weight: bold;">Consensus Strategy:</label>
            <select id="mode-consensus-type" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;">
                <option value="arena" ${consensusType === 'arena' ? 'selected' : ''}>Model Arena (Competition + Scoring)</option>
            </select>
            <small style="color: #8e8ea6; display: block; margin-top: 4px;">
                <strong>Arena:</strong> All models compete, best solution wins based on tests + performance + LLM judge quality
            </small>
        </div>
    `;

    html += `
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Model 1 (Primary):</label>
            <input type="text" id="mode-multi-model-1" value="${model1}" placeholder="e.g., ${CLOUD_MODELS.geminiModelBalanced}" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
        </div>
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Model 2 (Secondary):</label>
            <input type="text" id="mode-multi-model-2" value="${model2}" placeholder="e.g., ${CLOUD_MODELS.openaiModelAdvanced}" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
        </div>
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Model 3 (Tiebreaker):</label>
            <input type="text" id="mode-multi-model-3" value="${model3}" placeholder="e.g., ${CLOUD_MODELS.anthropicModelBalanced}" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
        </div>
    `;

    html += `
        <div class="cost-estimate">
            <div class="cost-estimate-label">Estimated Cost</div>
            <div class="cost-estimate-value">~$0.08 per 1000 requests</div>
            <div class="cost-estimate-detail">Compared to $0.02 for single provider</div>
        </div>
    `;

    return html;
}

function renderCustomConfig(env) {
    const customUrl = localStorage.getItem('CUSTOM_PROXY_URL') || '';
    const customKey = localStorage.getItem('CUSTOM_API_KEY') || '';

    return `
        <div class="mode-info">
            <span class="mode-info-text">⚒ Custom mode allows you to connect to your own API endpoint (Azure, AWS, vLLM, etc.).</span>
        </div>
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Custom Endpoint URL:</label>
            <input type="text" id="mode-custom-url" value="${customUrl}" placeholder="http://localhost:8000/api" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
        </div>
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">API Key (Optional):</label>
            <input type="password" id="mode-custom-key" value="${customKey}" placeholder="If your endpoint requires authentication" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
        </div>
    `;
}

export function saveModeConfiguration() {
    const modeName = state.selectedMode;
    if (!modeName) return;

    let saveResult;
    switch (modeName) {
        case 'local':
            saveResult = saveLocalMode();
            break;
        case 'cloud':
            saveResult = saveCloudMode();
            break;
        case 'browser':
            saveResult = saveBrowserMode();
            break;
        case 'web-llm':
            saveResult = saveWebLLMMode();
            break;
        case 'hybrid':
            saveResult = saveHybridMode();
            break;
        case 'multi':
            saveResult = saveMultiMode();
            break;
        case 'custom':
            saveResult = saveCustomMode();
            break;
        case 'offline':
            saveResult = saveOfflineMode();
            break;
    }

    if (saveResult === false) {
        return;
    }

    closeConfigModal();
    showBootMessage('Configuration saved successfully', 'info');
    checkAPIStatus();
}

function saveLocalMode() {
    const selectedRadio = document.querySelector('input[name="local-model-select"]:checked');
    const endpoint = document.getElementById('mode-local-endpoint')?.value || 'http://localhost:11434';

    if (selectedRadio) {
        const modelName = selectedRadio.value;
        localStorage.setItem('LOCAL_MODEL', modelName);
        localStorage.setItem('SELECTED_MODEL', `ollama-${modelName}`);
    }

    localStorage.setItem('LOCAL_ENDPOINT', endpoint);
    localStorage.setItem('AI_PROVIDER', 'local');
    localStorage.setItem('DEPLOYMENT_MODE', 'local');
    return true;
}

function saveCloudMode() {
    const keyMap = {
        'gemini': 'GEMINI_API_KEY',
        'openai': 'OPENAI_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY'
    };
    const modelKeyMap = {
        'gemini': 'GEMINI_SELECTED_MODEL',
        'openai': 'OPENAI_SELECTED_MODEL',
        'anthropic': 'ANTHROPIC_SELECTED_MODEL'
    };
    const container = elements.modeConfigContent || document;
    const providerCards = Array.from(container.querySelectorAll('.provider-card'));

    if (!providerCards.length) {
        showBootMessage('Cloud configuration UI is unavailable.', 'error');
        return false;
    }

    providerCards.forEach(card => {
        const provider = card.dataset.provider;
        if (!provider || !keyMap[provider]) return;

        const keyInput = card.querySelector('.provider-api-key');
        if (keyInput) {
            const value = keyInput.value.trim();
            if (!value && !keyInput.value.startsWith('●')) {
                localStorage.removeItem(keyMap[provider]);
            } else if (value && !value.startsWith('●')) {
                localStorage.setItem(keyMap[provider], value);
            }
        }

        const modelSelect = card.querySelector('.provider-model-select');
        if (modelSelect && modelKeyMap[provider]) {
            localStorage.setItem(modelKeyMap[provider], modelSelect.value);
        }
    });

    const storedKeys = {
        gemini: localStorage.getItem('GEMINI_API_KEY'),
        openai: localStorage.getItem('OPENAI_API_KEY'),
        anthropic: localStorage.getItem('ANTHROPIC_API_KEY')
    };

    let primaryProvider = state.selectedProvider;
    if (!primaryProvider || !storedKeys[primaryProvider]) {
        const selectedCard = providerCards.find(card => {
            const provider = card.dataset.provider;
            return card.classList.contains('selected') && storedKeys[provider];
        });
        primaryProvider = selectedCard ? selectedCard.dataset.provider : null;
    }
    if (!primaryProvider) {
        primaryProvider = ['gemini', 'openai', 'anthropic'].find(provider => storedKeys[provider]);
    }

    if (!primaryProvider) {
        showBootMessage('Configure at least one cloud provider with an API key before saving.', 'warning');
        return false;
    }

    const primaryModelKey = modelKeyMap[primaryProvider];
    const primaryCard = providerCards.find(card => card.dataset.provider === primaryProvider);
    const modelSelect = primaryCard?.querySelector('.provider-model-select');
    let selectedModel = modelSelect?.value || localStorage.getItem(primaryModelKey);

    if (!selectedModel) {
        selectedModel = primaryProvider === 'gemini'
            ? CLOUD_MODELS.geminiModelBalanced
            : primaryProvider === 'openai'
                ? CLOUD_MODELS.openaiModelAdvanced
                : CLOUD_MODELS.anthropicModelBalanced;
        localStorage.setItem(primaryModelKey, selectedModel);
    }

    state.selectedProvider = primaryProvider;
    localStorage.setItem('AI_PROVIDER', primaryProvider);
    localStorage.setItem('SELECTED_MODEL', selectedModel);
    localStorage.setItem('DEPLOYMENT_MODE', 'cloud');
    localStorage.removeItem('OFFLINE_MODE');
    return true;
}

function saveBrowserMode() {
    localStorage.setItem('AI_PROVIDER', 'web');
    localStorage.setItem('SELECTED_MODEL', 'web-llm');
    localStorage.setItem('DEPLOYMENT_MODE', 'browser');
    // Clean up old paxos keys
    localStorage.removeItem('ENABLE_PAXOS');
    localStorage.removeItem('PAXOS_PRIMARY');
    localStorage.removeItem('PAXOS_FALLBACK');
    localStorage.removeItem('PAXOS_CONSENSUS');
    localStorage.removeItem('PAXOS_STRATEGY');
    localStorage.removeItem('OFFLINE_MODE');
    if (elements.multiModelToggle) {
        elements.multiModelToggle.checked = false;
    }
    return true;
}

function saveWebLLMMode() {
    const profileSelect = document.getElementById('mode-web-llm-profile');
    const cacheCheckbox = document.getElementById('mode-web-llm-cache');

    if (profileSelect) {
        localStorage.setItem('WEB_LLM_PROFILE', profileSelect.value);
    }
    if (cacheCheckbox) {
        localStorage.setItem('WEB_LLM_CACHE', cacheCheckbox.checked ? 'true' : 'false');
    }

    localStorage.setItem('AI_PROVIDER', 'web');
    localStorage.setItem('SELECTED_MODEL', 'web-llm');
    localStorage.setItem('DEPLOYMENT_MODE', 'web-llm');
    localStorage.removeItem('OFFLINE_MODE');

    // Clean up old paxos keys
    localStorage.removeItem('ENABLE_PAXOS');
    localStorage.removeItem('PAXOS_PRIMARY');
    localStorage.removeItem('PAXOS_FALLBACK');
    localStorage.removeItem('PAXOS_CONSENSUS');
    localStorage.removeItem('PAXOS_STRATEGY');
    if (elements.multiModelToggle) {
        elements.multiModelToggle.checked = false;
    }
    state.selectedProvider = 'web';
    return true;
}

function saveOfflineMode() {
    const autoStartCheckbox = document.getElementById('mode-offline-auto-start');
    const disableWebRTCCheckbox = document.getElementById('mode-offline-disable-webrtc');
    const clearKeysCheckbox = document.getElementById('mode-offline-clear-keys');

    if (autoStartCheckbox) {
        localStorage.setItem('AUTO_START_OLLAMA', autoStartCheckbox.checked ? 'true' : 'false');
    }

    if (disableWebRTCCheckbox) {
        const disable = disableWebRTCCheckbox.checked;
        localStorage.setItem('ENABLE_WEBRTC', disable ? 'false' : 'true');
        if (elements.enableWebRTCCheckbox) {
            elements.enableWebRTCCheckbox.checked = !disable;
        }
    }

    if (!clearKeysCheckbox || clearKeysCheckbox.checked) {
        ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].forEach(key => localStorage.removeItem(key));
        state.savedApiKeys = {
            gemini: '',
            openai: '',
            anthropic: ''
        };
    }

    ['ENABLE_PAXOS', 'PAXOS_PRIMARY', 'PAXOS_FALLBACK', 'PAXOS_CONSENSUS', 'PAXOS_STRATEGY'].forEach(key => {
        localStorage.removeItem(key);
    });
    if (elements.multiModelToggle) {
        elements.multiModelToggle.checked = false;
    }

    const localModel = localStorage.getItem('LOCAL_MODEL');
    if (localModel) {
        localStorage.setItem('SELECTED_MODEL', `ollama-${localModel}`);
    }

    localStorage.setItem('OFFLINE_MODE', 'true');
    localStorage.setItem('AI_PROVIDER', 'local');
    localStorage.setItem('DEPLOYMENT_MODE', 'offline');
    state.selectedProvider = 'local';
    return true;
}

function saveHybridMode() {
    localStorage.setItem('AI_PROVIDER', 'hybrid');
    localStorage.setItem('DEPLOYMENT_MODE', 'hybrid');
    localStorage.removeItem('OFFLINE_MODE');
    return true;
}

function saveMultiMode() {
    const consensusType = document.getElementById('mode-consensus-type')?.value || 'arena';
    const model1 = document.getElementById('mode-multi-model-1')?.value.trim();
    const model2 = document.getElementById('mode-multi-model-2')?.value.trim();
    const model3 = document.getElementById('mode-multi-model-3')?.value.trim();

    if (model1) localStorage.setItem('MULTI_MODEL_1', model1);
    if (model2) localStorage.setItem('MULTI_MODEL_2', model2);
    if (model3) localStorage.setItem('MULTI_MODEL_3', model3);

    localStorage.setItem('CONSENSUS_TYPE', consensusType);
    localStorage.setItem('AI_PROVIDER', 'multi');
    localStorage.setItem('SELECTED_MODEL', 'multi');
    localStorage.setItem('DEPLOYMENT_MODE', 'multi');
    localStorage.removeItem('OFFLINE_MODE');

    // Clean up old paxos keys
    localStorage.removeItem('ENABLE_PAXOS');
    localStorage.removeItem('PAXOS_PRIMARY');
    localStorage.removeItem('PAXOS_FALLBACK');
    localStorage.removeItem('PAXOS_CONSENSUS');

    return true;
}

function saveCustomMode() {
    const url = document.getElementById('mode-custom-url')?.value.trim();
    const key = document.getElementById('mode-custom-key')?.value.trim();

    if (!url) {
        showBootMessage('Please enter a custom endpoint URL before saving.', 'warning');
        return false;
    }

    if (url) localStorage.setItem('CUSTOM_PROXY_URL', url);
    if (key) localStorage.setItem('CUSTOM_API_KEY', key);

    localStorage.setItem('AI_PROVIDER', 'custom');
    localStorage.setItem('SELECTED_MODEL', 'custom-proxy');
    localStorage.setItem('DEPLOYMENT_MODE', 'custom');
    localStorage.removeItem('OFFLINE_MODE');
    return true;
}
