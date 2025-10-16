// New boot script for persona-based onboarding

(async () => {
    const state = {
        config: null,
        strings: null,
        selectedPersonaId: null,
        isAdvancedMode: false,
        bootMode: 'minimal', // New: 'minimal', 'all-blueprints', 'all-upgrades', 'persona'
        savedApiKeys: {}, // Store API keys for different providers
        infoContext: 'modules',
        directoryCategory: 'modules',
        directoryFilter: 'all',
        activePopover: null,
        selectedMode: null,
        detectedEnv: null,
        selectedProvider: null,
    };

    const elements = {
        personaContainer: document.getElementById('persona-selection-container'),
        goalInput: document.getElementById('goal-input'),
        awakenBtn: document.getElementById('awaken-btn'),
        advancedContainer: document.getElementById('advanced-options'),
        providerStatus: document.getElementById('provider-status'),
        providerStatusDetail: document.getElementById('provider-status-detail'),
        serverChip: document.getElementById('agent-chip-server'),
        ollamaChip: document.getElementById('agent-chip-ollama'),
        configBtn: document.getElementById('config-btn'),
        configModal: document.getElementById('config-modal'),
        closeModal: document.getElementById('close-modal'),
        saveKeysBtn: document.getElementById('save-keys-btn'),
        apiErrorMessage: document.getElementById('api-error-message'),
        modelSelect: document.getElementById('model-select'),
        modelDescription: document.getElementById('model-description'),
        apiKeySection: document.getElementById('api-key-section'),
        apiKeyInput: document.getElementById('api-key-input'),
        apiKeyLabel: document.getElementById('api-key-label'),
        apiKeyHelp: document.getElementById('api-key-help'),
        localConfigSection: document.getElementById('local-config-section'),
        localEndpointInput: document.getElementById('local-endpoint'),
        localModelInput: document.getElementById('local-model'),
        customModelNameContainer: document.getElementById('custom-model-name-container'),
        customProxySection: document.getElementById('custom-proxy-section'),
        customProxyUrlInput: document.getElementById('custom-proxy-url'),
        customApiKeyInput: document.getElementById('custom-api-key'),
        paxosNotice: document.getElementById('paxos-notice'),
        enableWebRTCCheckbox: document.getElementById('enable-webrtc-modal'),
        infoOverlay: document.getElementById('info-overlay'),
        infoCardTitle: document.getElementById('info-card-title'),
        infoCardBody: document.getElementById('info-card-body'),
        infoCardBrowse: document.getElementById('info-card-browse'),
        directoryModal: document.getElementById('directory-modal'),
        directoryTabs: document.querySelectorAll('.directory-tab'),
        directoryContent: document.getElementById('directory-content'),
        directorySearch: document.getElementById('directory-search'),
        directoryFilters: document.querySelectorAll('.directory-filter'),
        helpPopover: document.getElementById('help-popover'),
        helpPopoverTitle: document.getElementById('help-popover-title'),
        helpPopoverBody: document.getElementById('help-popover-body'),
        helpPopoverClose: document.querySelector('.help-popover-close'),
        multiModelToggle: document.getElementById('multi-model-toggle'),
        multiModelConfigure: document.getElementById('multi-model-configure'),
        multiModelModal: document.getElementById('multi-model-modal'),
        closeMultiModel: document.getElementById('close-multi-model'),
        cancelMultiModel: document.getElementById('cancel-multi-model'),
        saveMultiModel: document.getElementById('save-multi-model'),
        paxosPrimary: document.getElementById('paxos-primary'),
        paxosFallback: document.getElementById('paxos-fallback'),
        paxosConsensus: document.getElementById('paxos-consensus'),
        paxosStrategy: document.getElementById('paxos-strategy'),
        modeCards: document.querySelector('.mode-cards'),
        modeRecommendation: document.getElementById('mode-recommendation'),
        recommendationText: document.getElementById('recommendation-text'),
        useRecommendedBtn: document.getElementById('use-recommended'),
        modeConfigSection: document.getElementById('mode-config-section'),
        modeConfigTitle: document.getElementById('mode-config-title'),
        modeConfigContent: document.getElementById('mode-config-content'),
        backToModesBtn: document.getElementById('back-to-modes'),
    };

    const POPOVER_COPY = {
        modules: {
            title: 'Modules',
            body: `
                <p>Modules are live capabilities the agent boots with—planning loops, tool runners, renderers, and more.</p>
                <ul>
                    <li><strong>CYCL</strong> keeps the think → act loop running</li>
                    <li><strong>TLWR</strong> safely writes and edits files</li>
                    <li><strong>LLMR</strong> hosts local LLM reasoning</li>
                    <li><strong>STYL</strong> refreshes and previews UI styling</li>
                </ul>
            `,
            browse: 'modules'
        },
        blueprints: {
            title: 'Blueprints',
            body: `
                <p>Blueprints are knowledge docs that guide behaviour—prompts, safety rails, and best practices the agent reads on launch.</p>
                <ul>
                    <li><strong>0x000001</strong> defines the system prompt</li>
                    <li><strong>0x000008</strong> documents the cognitive cycle</li>
                    <li><strong>0x000016</strong> covers tool creation patterns</li>
                    <li><strong>0x000024</strong> explains Paxos analytics</li>
                </ul>
            `,
            browse: 'blueprints'
        }
    };

    function getString(key, fallback) {
        return (state.strings && state.strings[key]) || fallback;
    }

    function setStatusChip(chipEl, status, label, stateText, tooltip = '') {
        if (!chipEl) return;
        const statuses = ['status-chip--checking', 'status-chip--inactive', 'status-chip--success', 'status-chip--error', 'status-chip--warning'];
        statuses.forEach(cls => chipEl.classList.remove(cls));
        if (status) {
            chipEl.classList.add(`status-chip--${status}`);
            chipEl.dataset.status = status;
        }

        const textParts = [];
        if (label) textParts.push(label);
        if (stateText) textParts.push(stateText);
        chipEl.textContent = textParts.join(' · ');

        const ariaLabel = stateText ? `${label} status: ${stateText}` : `${label} status`;
        chipEl.setAttribute('aria-label', tooltip ? `${ariaLabel}. ${tooltip}` : ariaLabel);

        if (tooltip) {
            chipEl.setAttribute('title', tooltip);
        } else {
            chipEl.removeAttribute('title');
        }
    }

    function usesOllamaModel(data = {}) {
        const models = [];
        const pushModel = (value) => {
            if (!value || value === 'null' || value === 'undefined') return;
            models.push(String(value));
        };

        if (Array.isArray(data.models)) {
            data.models.forEach(pushModel);
        }
        pushModel(data.model);
        pushModel(data.primaryModel);

        const storedModel = localStorage.getItem('SELECTED_MODEL');
        pushModel(storedModel);

        const provider = String(data.primaryProvider || data.provider || '').toLowerCase();
        if (provider === 'local' || provider === 'ollama') {
            return true;
        }

        // Filter out any null/undefined that might have slipped through
        return models.filter(m => m).some(modelId => modelId.startsWith('ollama-'));
    }

    function getOllamaRuntimeStatus(data = {}) {
        const status = String(
            data.ollamaStatus ||
            (data.ollama && (data.ollama.status || data.ollama.state)) ||
            ''
        ).toLowerCase();
        return status;
    }

    async function populateOllamaModels() {
        if (!elements.modelSelect) return;

        try {
            const response = await fetch('http://localhost:8000/api/ollama/models');
            if (!response.ok) {
                console.warn('Failed to fetch Ollama models:', response.status);
                return;
            }

            const data = await response.json();
            const models = data.models || [];

            // Find the "Local Models" optgroup
            const localOptgroup = Array.from(elements.modelSelect.querySelectorAll('optgroup'))
                .find(og => og.label === 'Local Models (No API Key)');

            if (!localOptgroup || models.length === 0) return;

            // Clear existing local model options (except web-llm and paxos)
            Array.from(localOptgroup.querySelectorAll('option')).forEach(opt => {
                if (opt.value.startsWith('ollama-')) {
                    opt.remove();
                }
            });

            // Add actual Ollama models from the system
            models.forEach((model, index) => {
                const option = document.createElement('option');
                option.value = `ollama-${model.name}`;
                option.setAttribute('data-provider', 'local');
                option.setAttribute('data-model-name', model.name);
                option.textContent = `${model.name} (Local)`;

                // Insert before web-llm option
                const webLlmOption = localOptgroup.querySelector('option[value="web-llm"]');
                if (webLlmOption) {
                    localOptgroup.insertBefore(option, webLlmOption);
                } else {
                    localOptgroup.appendChild(option);
                }
            });

            console.log(`Loaded ${models.length} Ollama models`);
        } catch (error) {
            console.warn('Could not fetch Ollama models:', error.message);
        }
    }

    async function checkAPIStatus() {
        const serverLabel = getString('status_chip_server', 'Server');
        const ollamaLabel = getString('status_chip_ollama', 'Ollama');
        const onlineText = getString('status_chip_online', 'Online');
        const offlineText = getString('status_chip_offline', 'Offline');
        const disabledText = getString('status_chip_disabled', 'Disabled');

        try {
            // Try to determine the correct API URL based on current origin
            let apiUrl = 'http://localhost:8000/api/health';
            let serverAddress = 'localhost:8000';

            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                try {
                    const localResponse = await fetch('http://localhost:8000/api/health', {
                        mode: 'cors',
                        credentials: 'omit'
                    });
                    if (localResponse.ok) {
                        apiUrl = 'http://localhost:8000/api/health';
                        serverAddress = 'localhost:8000 (local)';
                    }
                } catch {
                    apiUrl = `${window.location.origin}/api/health`;
                    serverAddress = window.location.host;
                }
            }

            const response = await fetch(apiUrl, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error('API not responding');
            }

            const data = await response.json();

            setStatusChip(
                elements.serverChip,
                'success',
                serverLabel,
                onlineText,
                `Connected to ${serverAddress}`
            );

            const modelInfo = getModelDisplayInfo(data);
            elements.providerStatus.textContent = modelInfo.name;
            elements.providerStatusDetail.textContent = modelInfo.detail;

            if (usesOllamaModel(data)) {
                const runtimeStatus = getOllamaRuntimeStatus(data);
                if (['ready', 'running', 'online'].includes(runtimeStatus)) {
                    setStatusChip(
                        elements.ollamaChip,
                        'success',
                        ollamaLabel,
                        getString('status_chip_online', 'Online'),
                        'Local runtime responding'
                    );
                } else if (['starting', 'loading', 'initializing'].includes(runtimeStatus)) {
                    setStatusChip(
                        elements.ollamaChip,
                        'warning',
                        ollamaLabel,
                        'Starting',
                        'Ollama detected — still warming up'
                    );
                } else {
                    setStatusChip(
                        elements.ollamaChip,
                        'warning',
                        ollamaLabel,
                        'Check runtime',
                        'Enable Ollama with `ollama serve`'
                    );
                }
            } else {
                setStatusChip(
                    elements.ollamaChip,
                    'inactive',
                    ollamaLabel,
                    disabledText,
                    'Current model uses a cloud provider'
                );
            }

            elements.apiErrorMessage.classList.add('hidden');
        } catch (error) {
            const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

            setStatusChip(
                elements.serverChip,
                isDeployed ? 'warning' : 'error',
                serverLabel,
                isDeployed ? getString('status_chip_browser_only', 'Browser Only') : offlineText,
                isDeployed ? 'No local server detected' : 'Server unreachable'
            );

            const savedModel = localStorage.getItem('SELECTED_MODEL');
            if (savedModel) {
                const modelInfo = getModelDisplayInfo({ model: savedModel });
                elements.providerStatus.textContent = modelInfo.name;
                elements.providerStatusDetail.textContent = modelInfo.detail || 'Configured locally';
            } else {
                elements.providerStatus.textContent = isDeployed ? 'Not Configured' : 'None';
                elements.providerStatusDetail.textContent = '';
            }

            if (usesOllamaModel({ model: savedModel })) {
                setStatusChip(
                    elements.ollamaChip,
                    isDeployed ? 'inactive' : 'warning',
                    ollamaLabel,
                    isDeployed ? disabledText : 'Unknown',
                    'Start Ollama locally with `ollama serve`'
                );
            } else {
                setStatusChip(
                    elements.ollamaChip,
                    'inactive',
                    ollamaLabel,
                    disabledText,
                    'Ollama not required for current model'
                );
            }

            if (!isDeployed) {
                elements.apiErrorMessage.classList.remove('hidden');
            } else {
                elements.apiErrorMessage.classList.add('hidden');
            }

            console.warn('API health check failed:', error.message);
        }
    }

    function getModelDisplayInfo(data) {
        const model = data.model || data.primaryModel || localStorage.getItem('SELECTED_MODEL');
        const provider = data.primaryProvider || data.provider;
        const actualModelName = data.actualModel || data.modelName;
        const models = data.models;

        if (!model && !provider) {
            return { name: 'Not Configured', detail: '', provider: '' };
        }

        if (models && Array.isArray(models) && models.length > 1) {
            return {
                name: 'Multi-Model',
                detail: models.join(', '),
                provider: 'Distributed'
            };
        }

        const modelInfo = {
            'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'Google' },
            'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', provider: 'Google' },
            'gpt-4o': { name: 'GPT-4o', provider: 'OpenAI' },
            'gpt-4-turbo': { name: 'GPT-4 Turbo', provider: 'OpenAI' },
            'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
            'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
            'claude-3-opus': { name: 'Claude 3 Opus', provider: 'Anthropic' },
            'paxos': { name: 'Paxos', provider: 'Distributed' },
            'web-llm': { name: 'Web LLM', provider: 'Browser-based' },
        };

        if (modelInfo[model]) {
            const info = modelInfo[model];
            const detailParts = [];
            if (info.provider) detailParts.push(info.provider);
            if (actualModelName && actualModelName !== model) {
                detailParts.push(actualModelName);
            }
            return {
                name: info.name,
                detail: detailParts.join(' • '),
                provider: info.provider
            };
        }

        if ((model && model.startsWith('ollama-')) || provider === 'local') {
            const localModelName = actualModelName || localStorage.getItem('LOCAL_MODEL');
            if (model === 'ollama-custom' || !model || !model.startsWith('ollama-')) {
                return {
                    name: localModelName || 'Ollama',
                    detail: 'Local via Ollama',
                    provider: 'Ollama'
                };
            }

            const modelName = model.replace('ollama-', '');
            const prettyName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
            return {
                name: prettyName,
                detail: 'Local via Ollama',
                provider: 'Ollama'
            };
        }

        const providerNames = {
            'gemini': 'Google Gemini',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'paxos': 'Paxos',
        };

        const providerLabel = providerNames[provider] || provider || '';
        const detailParts = [];
        if (providerLabel) detailParts.push(providerLabel);
        if (actualModelName && actualModelName !== model) {
            detailParts.push(actualModelName);
        }

        return {
            name: actualModelName || model || providerLabel || 'Unknown',
            detail: detailParts.join(' • '),
            provider: providerLabel
        };
    }

    // Keep old function for backward compatibility where needed
    function getModelDisplayName(data) {
        const info = getModelDisplayInfo(data);
        return info.detail ? `${info.name} (${info.detail})` : info.name;
    }

    function loadStoredKeys() {
        // Load selected model
        const selectedModel = localStorage.getItem('SELECTED_MODEL') || 'gemini-2.0-flash';

        // Load all saved values
        const localEndpoint = localStorage.getItem('LOCAL_ENDPOINT') || 'http://localhost:11434';
        const localModel = localStorage.getItem('LOCAL_MODEL') || '';
        const customProxyUrl = localStorage.getItem('CUSTOM_PROXY_URL') || '';
        const customApiKey = localStorage.getItem('CUSTOM_API_KEY') || '';

        // Set model dropdown
        if (elements.modelSelect) {
            elements.modelSelect.value = selectedModel;
        }

        // Load endpoint/model values
        if (elements.localEndpointInput) elements.localEndpointInput.value = localEndpoint;
        if (elements.localModelInput) elements.localModelInput.value = localModel;
        if (elements.customProxyUrlInput) elements.customProxyUrlInput.value = customProxyUrl;
        if (elements.customApiKeyInput) elements.customApiKeyInput.value = customApiKey;

        // Load stored API keys (will be shown based on selected model)
        const geminiKey = localStorage.getItem('GEMINI_API_KEY') || '';
        const openaiKey = localStorage.getItem('OPENAI_API_KEY') || '';
        const anthropicKey = localStorage.getItem('ANTHROPIC_API_KEY') || '';

        // Store keys for later use
        state.savedApiKeys = {
            gemini: geminiKey,
            openai: openaiKey,
            anthropic: anthropicKey,
        };

        // Load WebRTC preference (disabled by default for security)
        const webrtcEnabled = localStorage.getItem('ENABLE_WEBRTC') === 'true';
        if (elements.enableWebRTCCheckbox) {
            elements.enableWebRTCCheckbox.checked = webrtcEnabled;
        }

        const paxosEnabled = localStorage.getItem('ENABLE_PAXOS') === 'true';
        if (elements.multiModelToggle) {
            elements.multiModelToggle.checked = paxosEnabled;
            syncMultiModelControls(paxosEnabled);
        }
        if (elements.paxosPrimary) {
            elements.paxosPrimary.value = localStorage.getItem('PAXOS_PRIMARY') || '';
        }
        if (elements.paxosFallback) {
            elements.paxosFallback.value = localStorage.getItem('PAXOS_FALLBACK') || '';
        }
        if (elements.paxosConsensus) {
            elements.paxosConsensus.value = localStorage.getItem('PAXOS_CONSENSUS') || '';
        }
        if (elements.paxosStrategy) {
            elements.paxosStrategy.value = localStorage.getItem('PAXOS_STRATEGY') || 'fastest';
        }

        // Show correct model config UI
        updateModelUI(selectedModel);
    }

    function saveWebRTCPreference() {
        if (!elements.enableWebRTCCheckbox) return;
        const enabled = elements.enableWebRTCCheckbox.checked;
        localStorage.setItem('ENABLE_WEBRTC', enabled.toString());
        console.log(`WebRTC Swarm: ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    function savePaxosSettings() {
        if (!elements.multiModelToggle) return;
        const enabled = elements.multiModelToggle.checked;
        localStorage.setItem('ENABLE_PAXOS', enabled ? 'true' : 'false');
        syncMultiModelControls(enabled);

        if (enabled) {
            if (elements.paxosPrimary) {
                localStorage.setItem('PAXOS_PRIMARY', elements.paxosPrimary.value.trim());
            }
            if (elements.paxosFallback) {
                localStorage.setItem('PAXOS_FALLBACK', elements.paxosFallback.value.trim());
            }
            if (elements.paxosConsensus) {
                localStorage.setItem('PAXOS_CONSENSUS', elements.paxosConsensus.value.trim());
            }
            if (elements.paxosStrategy) {
                localStorage.setItem('PAXOS_STRATEGY', elements.paxosStrategy.value);
            }
        } else {
            ['PAXOS_PRIMARY', 'PAXOS_FALLBACK', 'PAXOS_CONSENSUS', 'PAXOS_STRATEGY'].forEach(key => {
                localStorage.removeItem(key);
            });
        }
    }

    function updateModelUI(modelValue) {
        if (!elements.modelSelect) return;

        // Get the selected option
        const selectedOption = elements.modelSelect.querySelector(`option[value="${modelValue}"]`);
        if (!selectedOption) return;

        const provider = selectedOption.getAttribute('data-provider');

        // Hide all sections first
        elements.apiKeySection.classList.add('hidden');
        elements.localConfigSection.classList.add('hidden');
        elements.customProxySection.classList.add('hidden');
        elements.paxosNotice.classList.add('hidden');

        // Update model description
        const descriptions = {
            'gemini-2.0-flash': 'Fast and efficient model from Google, great for quick responses',
            'gemini-1.5-pro': 'Advanced reasoning capabilities with large context window',
            'gpt-4o': 'OpenAI\'s multimodal model with vision capabilities',
            'gpt-4-turbo': 'Advanced GPT-4 model with improved performance',
            'gpt-3.5-turbo': 'Fast and cost-effective model for general tasks',
            'claude-3-5-sonnet': 'Anthropic\'s top-performing model with excellent coding ability',
            'claude-3-opus': 'Most capable Claude model for complex tasks',
            'web-llm': 'Run LLM directly in your browser (experimental)',
            'paxos': 'Distributed consensus-based model (requires PAXS upgrade)',
            'custom-proxy': 'Connect to your own API endpoint or proxy',
        };

        // For dynamic Ollama models, show a generic description
        let description = descriptions[modelValue];
        if (!description && modelValue.startsWith('ollama-')) {
            const modelName = selectedOption.getAttribute('data-model-name') || modelValue.replace('ollama-', '');
            description = `${modelName} running locally via Ollama (no API key required)`;
        }

        elements.modelDescription.textContent = description || 'Select a model to see its description';

        // Show appropriate configuration section
        if (provider === 'gemini' || provider === 'openai' || provider === 'anthropic') {
            // Cloud model - show API key section
            elements.apiKeySection.classList.remove('hidden');

            // Update labels and help text
            const providerInfo = {
                'gemini': {
                    label: 'Google Gemini API Key',
                    help: 'Get your key from Google AI Studio',
                    link: 'https://aistudio.google.com/app/apikey',
                    placeholder: 'AIza...'
                },
                'openai': {
                    label: 'OpenAI API Key',
                    help: 'Get your key from OpenAI Platform',
                    link: 'https://platform.openai.com/api-keys',
                    placeholder: 'sk-...'
                },
                'anthropic': {
                    label: 'Anthropic API Key',
                    help: 'Get your key from Anthropic Console',
                    link: 'https://console.anthropic.com/',
                    placeholder: 'sk-ant-...'
                }
            };

            const info = providerInfo[provider];
            elements.apiKeyLabel.textContent = info.label;
            elements.apiKeyInput.placeholder = info.placeholder;
            elements.apiKeyHelp.innerHTML = `${info.help}: <a href="${info.link}" target="_blank">Get API Key</a>`;

            // Load saved key for this provider
            if (state.savedApiKeys && state.savedApiKeys[provider]) {
                elements.apiKeyInput.value = state.savedApiKeys[provider];
            } else {
                elements.apiKeyInput.value = '';
            }

        } else if (provider === 'local') {
            // Ollama - show local config section
            elements.localConfigSection.classList.remove('hidden');

            // For dynamically loaded models, hide the custom model name input and pre-fill
            const modelName = selectedOption.getAttribute('data-model-name');
            if (modelName && elements.localModelInput) {
                elements.customModelNameContainer.style.display = 'none';
                elements.localModelInput.value = modelName;
            } else {
                // Show input for manual entry if no model name available
                elements.customModelNameContainer.style.display = 'block';
            }

        } else if (provider === 'paxos') {
            // Paxos - show notice
            elements.paxosNotice.classList.remove('hidden');

        } else if (provider === 'custom') {
            // Custom proxy - show custom section
            elements.customProxySection.classList.remove('hidden');

        } else if (provider === 'web') {
            // Web LLM - no configuration needed
            elements.modelDescription.textContent = 'Web LLM runs entirely in your browser. No setup required!';
        }
    }

    function saveAPIKeys() {
        const selectedModel = elements.modelSelect.value;
        const selectedOption = elements.modelSelect.querySelector(`option[value="${selectedModel}"]`);
        const provider = selectedOption ? selectedOption.getAttribute('data-provider') : null;

        if (!provider) {
            showBootMessage('Please select a valid model', 'warning');
            return;
        }

        // Save selected model
        localStorage.setItem('SELECTED_MODEL', selectedModel);

        // Save API key if this is a cloud provider
        if (provider === 'gemini' || provider === 'openai' || provider === 'anthropic') {
            const apiKey = elements.apiKeyInput.value.trim();

            if (!apiKey) {
                showBootMessage('Please enter an API key for this model', 'warning');
                return;
            }

            // Save to the appropriate key
            const keyMap = {
                'gemini': 'GEMINI_API_KEY',
                'openai': 'OPENAI_API_KEY',
                'anthropic': 'ANTHROPIC_API_KEY',
            };

            localStorage.setItem(keyMap[provider], apiKey);

            // Also save as primary provider for backward compatibility
            localStorage.setItem('AI_PROVIDER', provider);
        }

        // Save local Ollama configuration
        if (provider === 'local') {
            const localEndpoint = elements.localEndpointInput.value.trim() || 'http://localhost:11434';
            const localModel = elements.localModelInput.value.trim();

            localStorage.setItem('LOCAL_ENDPOINT', localEndpoint);

            if (localModel) {
                localStorage.setItem('LOCAL_MODEL', localModel);
            } else {
                // Extract model name from data-model-name attribute (for dynamically loaded models)
                const modelName = selectedOption.getAttribute('data-model-name');
                if (modelName) {
                    localStorage.setItem('LOCAL_MODEL', modelName);
                } else if (selectedModel.startsWith('ollama-')) {
                    // Fallback: extract from value by removing ollama- prefix
                    const extractedName = selectedModel.replace('ollama-', '');
                    localStorage.setItem('LOCAL_MODEL', extractedName);
                }
            }

            localStorage.setItem('AI_PROVIDER', 'local');
        }

        // Save custom proxy configuration
        if (provider === 'custom') {
            const customProxyUrl = elements.customProxyUrlInput.value.trim();

            if (!customProxyUrl) {
                showBootMessage('Please enter a proxy URL', 'warning');
                return;
            }

            localStorage.setItem('CUSTOM_PROXY_URL', customProxyUrl);

            const customApiKey = elements.customApiKeyInput.value.trim();
            if (customApiKey) {
                localStorage.setItem('CUSTOM_API_KEY', customApiKey);
            }

            localStorage.setItem('AI_PROVIDER', 'custom');
        }

        // For paxos and web-llm, just save the selection
        if (provider === 'paxos') {
            localStorage.setItem('AI_PROVIDER', 'paxos');
        } else if (provider === 'web') {
            localStorage.setItem('AI_PROVIDER', 'web');
        }

        // Save Advanced settings (from Advanced tab)
        saveWebRTCPreference();
        savePaxosSettings();

        elements.configModal.classList.add('hidden');

        // Update status display
        const modelInfo = getModelDisplayInfo({ model: selectedModel });
        showBootMessage(`Configuration saved: ${modelInfo.name}`, 'info');

        // Update provider status in the UI
        elements.providerStatus.textContent = modelInfo.name;
        elements.providerStatusDetail.textContent = modelInfo.detail || 'Configured locally';

        // Refresh API status
        checkAPIStatus();

        // Reset modal to first tab for next time
        switchModalTab('model');
    }

    async function openConfigModal() {
        loadStoredKeys();
        await populateOllamaModels(); // Refresh available models when opening settings
        closeHelpPopover();
        if (elements.configModal) {
            elements.configModal.classList.remove('hidden');
        }
        await showModeRecommendation();
        state.selectedMode = null;
        state.selectedProvider = null;
        highlightStoredMode();
    }

    function closeConfigModal() {
        if (elements.configModal) {
            elements.configModal.classList.add('hidden');
        }
        backToModes();
    }

    function switchModalTab(tabName) {
        // Update modal tab buttons
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.modalTab === tabName);
        });

        // Update modal tab content
        document.querySelectorAll('.modal-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetTab = document.getElementById(`modal-${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    }

    // ============================================
    // MODE SELECTOR - New mode-first UI logic
    // ============================================

    const MODE_INFO = {
        local: {
            title: '🖥️ Local (Ollama) Configuration',
            icon: '🖥️',
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
            title: '🌐 Browser-Only Configuration',
            icon: '🌐',
            help: {
                title: 'Browser-Only Mode',
                requirements: ['Modern browser with WebGPU support', 'GPU with sufficient VRAM (4GB+)'],
                pros: ['No server needed', 'No API costs', 'Works anywhere', 'Privacy-preserving'],
                cons: ['Limited to smaller models (3B-7B)', 'Slower than native inference', 'Large initial download', 'Limited features (no VFS persistence)'],
                bestFor: 'Demos, educational use, when no backend is available'
            }
        },
        'web-llm': {
            title: '🕸️ Web LLM Configuration',
            icon: '🕸️',
            help: {
                title: 'Web LLM (WebGPU) Mode',
                requirements: ['Modern browser with WebGPU support', 'GPU with 4GB+ VRAM', 'Initial model download (3-4GB)'],
                pros: ['Runs entirely in browser', 'No API keys required', 'Keeps data on device'],
                cons: ['Large first-time download', 'Higher GPU usage', 'Limited to smaller models'],
                bestFor: 'When you have a capable browser GPU but no server or API access'
            }
        },
        hybrid: {
            title: '🔄 Hybrid Mode Configuration',
            icon: '🔄',
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
            title: '🔧 Custom Endpoint Configuration',
            icon: '🔧',
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

    async function detectEnvironment() {
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

        // Check server
        try {
            const response = await fetch('http://localhost:8000/api/health');
            env.hasServer = response.ok;
        } catch {}

        // Check Ollama
        if (env.hasServer) {
            try {
                const response = await fetch('http://localhost:8000/api/ollama/models');
                if (response.ok) {
                    const data = await response.json();
                    env.hasOllama = true;
                    env.ollamaModels = data.models || [];
                }
            } catch {}
        }

        // Check API keys
        env.hasGeminiKey = !!localStorage.getItem('GEMINI_API_KEY');
        env.hasOpenAIKey = !!localStorage.getItem('OPENAI_API_KEY');
        env.hasAnthropicKey = !!localStorage.getItem('ANTHROPIC_API_KEY');

        if (!Array.isArray(env.ollamaModels)) {
            env.ollamaModels = [];
        }

        return env;
    }

    function getRecommendedMode(env) {
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

    async function showModeRecommendation() {
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

    function getStoredDeploymentMode() {
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
            'paxos': 'multi',
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

    function highlightStoredMode() {
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

    function selectMode(modeName, env) {
        const environment = env || state.detectedEnv || {};
        if (!Array.isArray(environment.ollamaModels)) {
            environment.ollamaModels = [];
        }

        closeHelpPopover();

        // Update mode card UI
        setModeCardSelection(modeName);

        // Show mode configuration section
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

            // Store selected mode temporarily
            state.selectedMode = modeName;

            if (modeName !== 'cloud') {
                state.selectedProvider = null;
            }
        }
    }

    function backToModes() {
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

    function showModeHelp(modeName, anchorEl) {
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

        // Status
        if (env.hasOllama && models.length > 0) {
            html += `
                <div class="mode-status">
                    <span class="mode-status-icon">✅</span>
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

        // Model list
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

        // Endpoint config
        const endpoint = localStorage.getItem('LOCAL_ENDPOINT') || 'http://localhost:11434';
        html += `
            <div style="margin-top: 16px;">
                <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Ollama Endpoint:</label>
                <input type="text" id="mode-local-endpoint" value="${endpoint}" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
            </div>
        `;

        // Info
        html += `
            <div class="mode-info">
                <span class="mode-info-text">💡 Local mode is completely free and private. Your code never leaves your machine.</span>
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
                    <span class="mode-status-icon">✅</span>
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
                    <span class="mode-status-icon">✅</span>
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
                <p class="setting-description">Ensures <code>ollama serve</code> runs whenever you launch Reploid locally.</p>
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

        // Gemini
        const geminiKey = localStorage.getItem('GEMINI_API_KEY') || '';
        const geminiConfigured = !!geminiKey;
        const geminiStoredModel = localStorage.getItem('GEMINI_SELECTED_MODEL') ||
            (selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.0-flash');
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
                    <option value="gemini-2.0-flash" ${geminiStoredModel === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash (~$0.01/1K)</option>
                    <option value="gemini-1.5-pro" ${geminiStoredModel === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro (~$0.05/1K)</option>
                </select>
                <input type="password" class="provider-api-key ${geminiConfigured ? 'configured' : ''}" data-provider="gemini" placeholder="AIza..." value="${geminiKey ? '●●●●●●●●' + geminiKey.slice(-4) : ''}" />
            </div>
        `;

        // OpenAI
        const openaiKey = localStorage.getItem('OPENAI_API_KEY') || '';
        const openaiConfigured = !!openaiKey;
        const openaiStoredModel = localStorage.getItem('OPENAI_SELECTED_MODEL') ||
            (selectedModel.startsWith('gpt-') ? selectedModel : 'gpt-4o');
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
                    <option value="gpt-4o" ${openaiStoredModel === 'gpt-4o' ? 'selected' : ''}>GPT-4o (~$0.10/1K)</option>
                    <option value="gpt-4-turbo" ${openaiStoredModel === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo (~$0.08/1K)</option>
                    <option value="gpt-3.5-turbo" ${openaiStoredModel === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo (~$0.02/1K)</option>
                </select>
                <input type="password" class="provider-api-key ${openaiConfigured ? 'configured' : ''}" data-provider="openai" placeholder="sk-..." value="${openaiKey ? '●●●●●●●●' + openaiKey.slice(-4) : ''}" />
            </div>
        `;

        // Anthropic
        const anthropicKey = localStorage.getItem('ANTHROPIC_API_KEY') || '';
        const anthropicConfigured = !!anthropicKey;
        const anthropicStoredModel = localStorage.getItem('ANTHROPIC_SELECTED_MODEL') ||
            (selectedModel.startsWith('claude-') ? selectedModel : 'claude-3-5-sonnet');
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
                    <option value="claude-3-5-sonnet" ${anthropicStoredModel === 'claude-3-5-sonnet' ? 'selected' : ''}>Claude 3.5 Sonnet (~$0.06/1K)</option>
                    <option value="claude-3-opus" ${anthropicStoredModel === 'claude-3-opus' ? 'selected' : ''}>Claude 3 Opus (~$0.12/1K)</option>
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
                <span class="mode-info-text">🌐 Browser-only mode serves Reploid as static files—perfect for GitHub Pages, Netlify, or quick demos without a backend.</span>
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
                <span class="mode-info-text">🕸️ Web LLM streams the model into your browser and executes it with WebGPU. Ideal when you have a strong GPU but no backend.</span>
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
                    <span class="mode-status-icon">✅</span>
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
                <span class="mode-info-text">🔄 Hybrid mode automatically switches between local and cloud based on availability, cost, and complexity.</span>
            </div>
            <p style="color: #b9bad6; font-size: 14px; margin: 16px 0;">
                Configure both local (Ollama) and cloud providers. The system will intelligently choose the best option for each request.
            </p>
            <p style="color: #8e8ea6; font-size: 13px;">
                💡 Tip: Use local models for simple tasks and cloud models for complex reasoning to optimize costs.
            </p>
        `;

        return html;
    }

    function renderMultiConfig(env) {
        const paxosEnabled = localStorage.getItem('ENABLE_PAXOS') === 'true';
        const paxosPrimary = localStorage.getItem('PAXOS_PRIMARY') || '';
        const paxosFallback = localStorage.getItem('PAXOS_FALLBACK') || '';
        const paxosConsensus = localStorage.getItem('PAXOS_CONSENSUS') || '';

        let html = `
            <div class="mode-warning">
                <span class="mode-warning-icon">⚠️</span>
                <span class="mode-warning-text">Multi-model mode will make multiple API calls simultaneously. This provides fault tolerance but increases costs ~3x.</span>
            </div>
        `;

        html += `
            <div style="margin: 16px 0;">
                <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Primary Model (Fast, cheap):</label>
                <input type="text" id="mode-paxos-primary" value="${paxosPrimary}" placeholder="e.g., gemini-2.0-flash" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
            </div>
            <div style="margin: 16px 0;">
                <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Fallback Model (Reliable backup):</label>
                <input type="text" id="mode-paxos-fallback" value="${paxosFallback}" placeholder="e.g., gpt-4o" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
            </div>
            <div style="margin: 16px 0;">
                <label style="display: block; margin-bottom: 6px; color: #b9bad6; font-size: 13px;">Consensus Model (Quality tiebreaker):</label>
                <input type="text" id="mode-paxos-consensus" value="${paxosConsensus}" placeholder="e.g., claude-3-5-sonnet" style="width: 100%; padding: 8px; background: #0d0d14; border: 1px solid #252532; border-radius: 6px; color: #f4f4ff;" />
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
                <span class="mode-info-text">🔧 Custom mode allows you to connect to your own API endpoint (Azure, AWS, vLLM, etc.).</span>
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

    function saveModeConfiguration() {
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

        // Close modal and update status
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
                ? 'gemini-2.0-flash'
                : primaryProvider === 'openai'
                    ? 'gpt-4o'
                    : 'claude-3-5-sonnet';
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
        localStorage.removeItem('ENABLE_PAXOS');
        localStorage.removeItem('OFFLINE_MODE');
        if (elements.multiModelToggle) {
            elements.multiModelToggle.checked = false;
            syncMultiModelControls(false);
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

        // Web LLM runs entirely in-browser
        localStorage.setItem('AI_PROVIDER', 'web');
        localStorage.setItem('SELECTED_MODEL', 'web-llm');
        localStorage.setItem('DEPLOYMENT_MODE', 'web-llm');
        localStorage.removeItem('OFFLINE_MODE');

        // Multi-model doesn’t apply here
        localStorage.removeItem('ENABLE_PAXOS');
        if (elements.multiModelToggle) {
            elements.multiModelToggle.checked = false;
            syncMultiModelControls(false);
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
            syncMultiModelControls(false);
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

        // Hybrid mode uses HYBR module
        // Configuration will be handled by the hybrid module at runtime
        return true;
    }

    function saveMultiMode() {
        const primary = document.getElementById('mode-paxos-primary')?.value.trim();
        const fallback = document.getElementById('mode-paxos-fallback')?.value.trim();
        const consensus = document.getElementById('mode-paxos-consensus')?.value.trim();

        if (primary) localStorage.setItem('PAXOS_PRIMARY', primary);
        if (fallback) localStorage.setItem('PAXOS_FALLBACK', fallback);
        if (consensus) localStorage.setItem('PAXOS_CONSENSUS', consensus);

        localStorage.setItem('ENABLE_PAXOS', 'true');
        localStorage.setItem('AI_PROVIDER', 'paxos');
        localStorage.setItem('SELECTED_MODEL', 'paxos');
        localStorage.setItem('DEPLOYMENT_MODE', 'multi');
        localStorage.removeItem('OFFLINE_MODE');
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

    async function fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        return response.json();
    }

    function showBootMessage(message, type = 'info') {
        // Create inline message instead of alert()
        const existingMsg = document.querySelector('.boot-message');
        if (existingMsg) existingMsg.remove();

        const msg = document.createElement('div');
        msg.className = `boot-message boot-message-${type}`;
        msg.textContent = message;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideDown 0.3s ease-out;
            ${type === 'warning' ? 'background: rgba(255, 215, 0, 0.9); color: #000;' :
              type === 'error' ? 'background: rgba(244, 135, 113, 0.9); color: white;' :
              'background: rgba(79, 195, 247, 0.9); color: white;'}
        `;

        document.body.appendChild(msg);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            msg.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => msg.remove(), 300);
        }, 3000);
    }

    function syncMultiModelControls(enabled = !!(elements.multiModelToggle && elements.multiModelToggle.checked)) {
        if (elements.multiModelConfigure) {
            elements.multiModelConfigure.disabled = !enabled;
            elements.multiModelConfigure.setAttribute('aria-disabled', (!enabled).toString());
        }
    }

    function openHelpPopover(type, anchorEl, overrideCopy = null) {
        const copy = overrideCopy || POPOVER_COPY[type];
        if (!copy || !elements.helpPopover || !anchorEl) return;

        state.activePopover = { type, anchorEl };
        elements.helpPopoverTitle.textContent = copy.title;
        elements.helpPopoverBody.innerHTML = copy.body;
        elements.helpPopover.classList.remove('hidden');
        elements.helpPopover.style.visibility = 'hidden';
        elements.helpPopover.setAttribute('aria-hidden', 'false');

        requestAnimationFrame(() => {
            const popRect = elements.helpPopover.getBoundingClientRect();
            const anchorRect = anchorEl.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            let top = anchorRect.bottom + 12 + scrollY;
            let left = anchorRect.left + (anchorRect.width / 2) - (popRect.width / 2) + scrollX;

            const maxLeft = scrollX + window.innerWidth - popRect.width - 12;
            left = Math.max(scrollX + 12, Math.min(left, maxLeft));

            elements.helpPopover.style.top = `${top}px`;
            elements.helpPopover.style.left = `${left}px`;
            elements.helpPopover.style.visibility = 'visible';
        });
    }

    function closeHelpPopover() {
        if (!elements.helpPopover) return;
        elements.helpPopover.classList.add('hidden');
        elements.helpPopover.style.visibility = '';
        elements.helpPopover.setAttribute('aria-hidden', 'true');
        state.activePopover = null;
    }

    function openMultiModelModal() {
        if (!elements.multiModelModal) return;
        closeHelpPopover();
        elements.multiModelModal.classList.remove('hidden');
        elements.multiModelModal.setAttribute('aria-hidden', 'false');
        if (elements.paxosPrimary) {
            setTimeout(() => elements.paxosPrimary.focus(), 50);
        }
    }

    function closeMultiModelModal() {
        if (!elements.multiModelModal) return;
        elements.multiModelModal.classList.add('hidden');
        elements.multiModelModal.setAttribute('aria-hidden', 'true');
    }

    function showInfoCard(type) {
        const copy = POPOVER_COPY[type];
        if (!copy || !elements.infoOverlay) return;

        state.infoContext = type;
        elements.infoCardTitle.textContent = copy.title;
        elements.infoCardBody.innerHTML = copy.body;
        if (elements.infoCardBrowse) {
            elements.infoCardBrowse.onclick = () => {
                closeInfoCard();
                openDirectoryBrowser(copy.browse);
            };
        }
        elements.infoOverlay.classList.remove('hidden');
    }

    function closeInfoCard() {
        if (elements.infoOverlay) {
            elements.infoOverlay.classList.add('hidden');
        }
    }

    function setDirectoryCategory(category) {
        state.directoryCategory = category;
        if (elements.directoryTabs) {
            elements.directoryTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.category === category);
            });
        }
        if (elements.directorySearch) {
            elements.directorySearch.value = '';
        }
        state.directoryFilter = 'all';
        if (elements.directoryFilters) {
            elements.directoryFilters.forEach(filterBtn => {
                filterBtn.classList.toggle('active', filterBtn.dataset.filter === 'all');
            });
        }
        renderDirectory();
    }

    function openDirectoryBrowser(category = 'modules') {
        if (!elements.directoryModal) return;
        closeHelpPopover();
        setDirectoryCategory(category);
        elements.directoryModal.classList.remove('hidden');
        renderDirectory();
    }

    function closeDirectoryModal() {
        if (elements.directoryModal) {
            elements.directoryModal.classList.add('hidden');
        }
    }

    function renderDirectory() {
        if (!state.config || !elements.directoryContent) return;

        const searchTerm = (elements.directorySearch?.value || '').trim().toLowerCase();
        const filter = state.directoryFilter || 'all';
        const upgrades = state.config.upgrades || [];
        const blueprints = state.config.blueprints || [];
        const minimalSet = new Set(state.config.minimalRSICore || []);
        const blueprintSet = new Set(blueprints.map(bp => bp.id));

        let markup = '';
        if (state.directoryCategory === 'modules') {
            const results = upgrades
                .filter(upgrade => {
                    const haystack = `${upgrade.id} ${upgrade.description || ''} ${upgrade.category || ''}`.toLowerCase();
                    return haystack.includes(searchTerm);
                })
                .filter(upgrade => {
                    if (filter === 'all') return true;
                    // Both 'minimal' and 'knowledge' boot modes use minimalRSICore for modules
                    if (filter === 'minimal' || filter === 'knowledge') {
                        return minimalSet.has(upgrade.id);
                    }
                    // 'full' (all-upgrades) includes all modules except those requiring explicit enable
                    if (filter === 'full') {
                        return !upgrade.requiresExplicitEnable;
                    }
                    return true;
                });
            markup = results.map(upgrade => createModuleCard(upgrade, minimalSet)).join('');
        } else {
            const results = blueprints
                .filter(bp => {
                    const haystack = `${bp.id} ${bp.path || ''} ${bp.description || ''}`.toLowerCase();
                    return haystack.includes(searchTerm);
                })
                .filter(bp => {
                    if (filter === 'all' || filter === 'full') return true;
                    if (filter === 'knowledge') return blueprintSet.has(bp.id);
                    if (filter === 'minimal') return false;
                    return true;
                });
            markup = results.map(bp => createBlueprintCard(bp)).join('');
        }

        elements.directoryContent.innerHTML = markup || `
            <div class="directory-item">
                <div class="directory-item-description">No results found. Try a different search term or filter.</div>
            </div>
        `;
    }

    function createModuleCard(upgrade, minimalSet) {
        const tags = new Set();
        if (upgrade.category) {
            tags.add(upgrade.category);
        }
        if (minimalSet.has(upgrade.id)) {
            tags.add('Minimal core');
        } else {
            tags.add('Optional');
        }

        const description = upgrade.description || 'Capability module';
        const filePath = upgrade.path ? `/upgrades/${upgrade.path}` : '';

        // Determine preset inclusion based on actual boot mode behavior
        const inMinimal = minimalSet.has(upgrade.id);
        const inKnowledge = minimalSet.has(upgrade.id); // all-blueprints mode uses minimalRSICore
        const inFull = !upgrade.requiresExplicitEnable; // Full Arsenal excludes modules requiring explicit enable

        const presetRows = [
            { label: 'Minimal Core', included: inMinimal },
            { label: 'Core + Knowledge', included: inKnowledge },
            { label: 'Full Arsenal', included: inFull }
        ];

        return `
            <div class="directory-item">
                <div class="directory-item-header">
                    <div>
                        <div class="directory-item-title" title="Module ID">${upgrade.id}</div>
                        <div class="directory-item-status">${description}</div>
                    </div>
                </div>
                ${filePath ? `<div class="directory-item-description">File: ${filePath}</div>` : ''}
                <div class="directory-item-presets">
                    ${presetRows.map(row => `
                        <span>
                            <span class="directory-item-toggle">${row.included ? '✓' : '–'}</span>
                            ${row.label}
                        </span>
                    `).join('')}
                </div>
                <div class="directory-item-tags">
                    ${Array.from(tags).map(tag => `<span class="directory-tag">${String(tag).toUpperCase()}</span>`).join('')}
                </div>
            </div>
        `;
    }

    function createBlueprintCard(blueprint) {
        const filePath = blueprint.path ? `/blueprints/${blueprint.path}` : '';
        const description = blueprint.description || 'Knowledge document';
        const presetRows = [
            { label: 'Minimal Core', included: false },
            { label: 'Core + Knowledge', included: true },
            { label: 'Full Arsenal', included: true }
        ];
        const tags = ['Knowledge Base', 'All Blueprints'];

        return `
            <div class="directory-item">
                <div class="directory-item-header">
                    <div>
                        <div class="directory-item-title" title="Blueprint ID">${blueprint.id}</div>
                        <div class="directory-item-status">${description}</div>
                    </div>
                </div>
                ${filePath ? `<div class="directory-item-description">File: ${filePath}</div>` : ''}
                <div class="directory-item-presets">
                    ${presetRows.map(row => `
                        <span>
                            <span class="directory-item-toggle">${row.included ? '✓' : '–'}</span>
                            ${row.label}
                        </span>
                    `).join('')}
                </div>
                <div class="directory-item-tags">
                    ${tags.map(tag => `<span class="directory-tag">${tag.toUpperCase()}</span>`).join('')}
                </div>
            </div>
        `;
    }

    function renderPersonas() {
        elements.personaContainer.innerHTML = '';
        state.config.personas.forEach(persona => {
            const card = document.createElement('div');
            card.className = 'persona-card';
            card.dataset.id = persona.id;

            // Add type badge for Lab or Factory with tooltip
            let typeBadge = '';
            if (persona.type === 'lab') {
                typeBadge = `<span class="persona-type-badge lab" title="Experimental: Guided learning & research">LAB</span>`;
            } else if (persona.type === 'factory') {
                typeBadge = `<span class="persona-type-badge factory" title="Production: Build & deploy">FACTORY</span>`;
            }

            // Add lessons dropdown if it's a lab persona with lessons
            let lessonsHTML = '';
            if (persona.type === 'lab' && persona.lessons && persona.lessons.length > 0) {
                lessonsHTML = `
                    <div class="lessons-section">
                        <label class="lessons-label">Guided Lessons:</label>
                        <select class="lessons-dropdown" onclick="event.stopPropagation()">
                            <option value="">Choose a lesson...</option>
                            ${persona.lessons.map((lesson, idx) =>
                                `<option value="${idx}">${lesson.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;
            }

            card.innerHTML = `
                ${typeBadge}
                <h3>${persona.name}</h3>
                <p>${persona.description}</p>
                ${lessonsHTML}
            `;

            card.addEventListener('click', () => selectPersona(persona.id));

            // Add lesson dropdown handler
            const dropdown = card.querySelector('.lessons-dropdown');
            if (dropdown) {
                dropdown.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const lessonIdx = parseInt(e.target.value);
                    if (!isNaN(lessonIdx)) {
                        const lesson = persona.lessons[lessonIdx];
                        elements.goalInput.value = lesson.goal;
                        selectPersona(persona.id);
                        elements.goalInput.focus();
                    }
                });
            }

            elements.personaContainer.appendChild(card);
        });
    }

    function selectPersona(personaId) {
        state.selectedPersonaId = personaId;
        state.bootMode = 'persona'; // When persona selected, use persona mode

        // Update UI
        document.querySelectorAll('.persona-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.id === personaId);
        });

        // Clear boot mode button selection
        document.querySelectorAll('.boot-mode-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Optionally pre-fill goal based on persona (if not already filled by lesson)
        if (!elements.goalInput.value.trim()) {
            const suggestions = {
                'website_builder': 'Create a landing page for my SaaS product',
                'product_prototype_factory': 'Build an interactive prototype for a mobile app',
                'code_refactorer': 'Analyze and improve my codebase',
                'rfc_author': 'Draft an RFC for a new feature',
                'creative_writer': 'Help me write a blog post',
                'rsi_lab_sandbox': 'Study blueprint 0x000016 and create a new tool'
            };
            if (suggestions[personaId]) {
                elements.goalInput.placeholder = suggestions[personaId];
            }
        }

        elements.goalInput.focus();
    }

    function selectBootMode(mode) {
        state.bootMode = mode;
        state.selectedPersonaId = null; // Clear persona selection when using boot modes

        // Update UI to show selected mode
        document.querySelectorAll('.boot-mode-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.mode === mode);
        });

        // Clear persona selection visual
        document.querySelectorAll('.persona-card').forEach(card => {
            card.classList.remove('selected');
        });

        console.log('[Boot] Mode selected:', mode);
    }

    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Track whether we are in advanced mode
        state.isAdvancedMode = (tabName === 'hunter');

        // Render hunter mode content if switching to it
        if (tabName === 'hunter' && elements.advancedContainer.children.length === 0) {
            renderAdvancedMode();
        }
    }

    function renderAdvancedMode() {
        const upgrades = state.config.upgrades || [];
        const blueprints = state.config.blueprints || [];

        // Group upgrades by category
        const categories = {};
        upgrades.forEach(upgrade => {
            const cat = upgrade.category || 'other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(upgrade);
        });

        let html = '<div class="advanced-mode-content">';
        html += '<h3>Select Modules</h3>';
        html += '<div class="module-categories">';

        Object.entries(categories).forEach(([category, mods]) => {
            html += `<div class="module-category">`;
            html += `<h4>${category.toUpperCase()}</h4>`;
            html += '<div class="module-grid">';
            mods.forEach(mod => {
                html += `
                    <label class="module-item">
                        <span class="custom-checkbox">
                            <input type="checkbox" name="upgrade" value="${mod.id}" />
                            <span class="custom-checkbox-box"></span>
                        </span>
                        <span class="module-label">
                            <strong>${mod.id}</strong>
                            <small>${mod.description}</small>
                        </span>
                    </label>
                `;
            });
            html += '</div></div>';
        });

        html += '</div>';
        html += '<h3>Select Blueprints</h3>';
        html += '<div class="blueprint-grid">';

        blueprints.forEach(bp => {
            html += `
                <label class="blueprint-item">
                    <span class="custom-checkbox">
                        <input type="checkbox" name="blueprint" value="${bp.id}" />
                        <span class="custom-checkbox-box"></span>
                    </span>
                    <span class="blueprint-label">
                        <strong>${bp.id}</strong>
                        <small>${bp.description}</small>
                    </span>
                </label>
            `;
        });

        html += '</div></div>';
        elements.advancedContainer.innerHTML = html;
    }

    function sanitizeGoal(goal) {
        // Security: Sanitize goal input
        // 1. Trim whitespace
        // 2. Strip HTML tags
        // 3. Limit length (enforced by HTML maxlength, but double-check)
        const trimmed = goal.trim();
        const noHtml = trimmed.replace(/<[^>]*>/g, '');
        const limited = noHtml.slice(0, 500);
        return limited;
    }

    async function awakenAgent() {
        const rawGoal = elements.goalInput.value;
        if (!rawGoal) {
            showBootMessage('Please enter a goal to get started.', 'warning');
            return;
        }

        // Sanitize goal input for security
        const goal = sanitizeGoal(rawGoal);

        console.log('Awakening agent with:');
        let bootConfig;

        if (state.isAdvancedMode) {
            console.log('Mode: Advanced (Hunter Protocol)');
            // Logic to get selected upgrades/blueprints from advanced UI
            bootConfig = {
                mode: 'advanced',
                goal: goal,
                // Additional config from advanced UI would go here
            };
        } else if (state.selectedPersonaId) {
            // Using a selected persona
            const persona = state.config.personas.find(p => p.id === state.selectedPersonaId);
            console.log('Persona:', persona.name);
            console.log('Persona Type:', persona.type);
            console.log('Goal:', goal);
            console.log('Upgrades:', persona.upgrades);
            console.log('Blueprints:', persona.blueprints);

            bootConfig = {
                mode: 'persona',
                persona: persona,
                goal: goal,
                previewTarget: persona.previewTarget || null,
            };
        } else {
            // Use boot mode selection (minimal, all-blueprints, all-upgrades)
            console.log('Boot Mode:', state.bootMode);
            console.log('Goal:', goal);

            let upgrades, blueprints;

            if (state.bootMode === 'minimal') {
                console.log('Using minimalRSICore (8 essential modules)');
                upgrades = state.config.minimalRSICore || [];
                blueprints = [];
            } else if (state.bootMode === 'all-blueprints') {
                console.log('Using minimalRSICore + all blueprints');
                upgrades = state.config.minimalRSICore || [];
                blueprints = state.config.blueprints.map(bp => bp.id) || [];
            } else if (state.bootMode === 'all-upgrades') {
                console.log('Using all upgrades + all blueprints');
                const upgradeSet = new Set((state.config.upgrades || []).map(u => u.id));
                if (upgradeSet.has('IDXB') && upgradeSet.has('LSTR')) {
                    upgradeSet.delete('LSTR');
                }
                upgrades = Array.from(upgradeSet);
                blueprints = state.config.blueprints.map(bp => bp.id) || [];
            } else {
                // Fallback to defaultCore for backwards compatibility
                console.log('Fallback to defaultCore');
                upgrades = state.config.defaultCore || [];
                blueprints = [];
            }

            bootConfig = {
                mode: 'default',
                goal: goal,
                upgrades: upgrades,
                blueprints: blueprints,
            };
        }

        // Filter out WebRTC (WRTC) if disabled by user
        const webrtcEnabled = localStorage.getItem('ENABLE_WEBRTC') === 'true';
        if (!webrtcEnabled && bootConfig.upgrades) {
            bootConfig.upgrades = bootConfig.upgrades.filter(id => id !== 'WRTC');
            console.log('WebRTC Swarm disabled - WRTC module excluded from boot');
        } else if (!webrtcEnabled && bootConfig.persona && bootConfig.persona.upgrades) {
            bootConfig.persona.upgrades = bootConfig.persona.upgrades.filter(id => id !== 'WRTC');
            console.log('WebRTC Swarm disabled - WRTC module excluded from persona');
        }

        // Apply Paxos multi-model settings if enabled
        const paxosEnabled = localStorage.getItem('ENABLE_PAXOS') === 'true';
        if (paxosEnabled) {
            const paxosPrimary = localStorage.getItem('PAXOS_PRIMARY');
            const paxosFallback = localStorage.getItem('PAXOS_FALLBACK');
            const paxosConsensus = localStorage.getItem('PAXOS_CONSENSUS');
            const paxosStrategy = localStorage.getItem('PAXOS_STRATEGY') || 'fastest';

            bootConfig.paxos = {
                enabled: true,
                primary: paxosPrimary,
                fallback: paxosFallback,
                consensus: paxosConsensus,
                strategy: paxosStrategy
            };

            // Ensure APMC (multi-provider API client) is loaded instead of APIC
            if (bootConfig.upgrades && bootConfig.upgrades.includes('APIC')) {
                bootConfig.upgrades = bootConfig.upgrades.map(id => id === 'APIC' ? 'APMC' : id);
                console.log('Paxos enabled - using APMC multi-provider client');
            } else if (bootConfig.persona && bootConfig.persona.upgrades && bootConfig.persona.upgrades.includes('APIC')) {
                bootConfig.persona.upgrades = bootConfig.persona.upgrades.map(id => id === 'APIC' ? 'APMC' : id);
                console.log('Paxos enabled - using APMC multi-provider client for persona');
            }

            console.log('Paxos multi-model configuration:', bootConfig.paxos);
        }

        // Store boot config for the main app to access
        window.REPLOID_BOOT_CONFIG = bootConfig;

        // Hide boot container and show app
        document.getElementById('boot-container').style.display = 'none';
        document.getElementById('app-root').style.display = 'block';

        // Initialize the VFS and start the main application
        await initializeReploidApplication(bootConfig);
    }

    async function initialize() {
        try {
            [state.config, state.strings] = await Promise.all([
                fetchJSON('config.json'),
                fetchJSON('data/strings.json')
            ]);

            // Populate UI with localized strings
            elements.goalInput.placeholder = getString('goal_input_placeholder', 'Describe your goal...');
            elements.awakenBtn.textContent = getString('awaken_button', 'Launch Agent');

            const taglineEl = document.querySelector('.goal-context-tagline');
            if (taglineEl) {
                taglineEl.textContent = getString('goal_tagline', taglineEl.textContent);
            }
            const examplesEl = document.querySelector('.goal-context-examples');
            if (examplesEl) {
                examplesEl.textContent = getString('goal_examples', examplesEl.textContent);
            }

            if (elements.multiModelModal) {
                const modalTitle = elements.multiModelModal.querySelector('.modal-header h3');
                if (modalTitle) {
                    modalTitle.textContent = getString('multi_model_title', modalTitle.textContent);
                }
                const modalDescription = elements.multiModelModal.querySelector('.settings-description');
                if (modalDescription) {
                    modalDescription.textContent = getString('multi_model_description', modalDescription.textContent);
                }
            }
            if (elements.saveMultiModel) {
                elements.saveMultiModel.textContent = getString('multi_model_save', elements.saveMultiModel.textContent);
            }

            setStatusChip(
                elements.serverChip,
                'checking',
                getString('status_chip_server', 'Server'),
                getString('status_chip_checking', 'Checking…')
            );
            setStatusChip(
                elements.ollamaChip,
                'inactive',
                getString('status_chip_ollama', 'Ollama'),
                getString('status_chip_detecting', 'Detecting…')
            );

            renderPersonas();
            populateOllamaModels();
            highlightStoredMode();
            checkAPIStatus();

            // Poll server status every 5 seconds when offline
            setInterval(() => {
                checkAPIStatus();
            }, 5000);

            // Setup event listeners
            elements.awakenBtn.addEventListener('click', awakenAgent);
            elements.goalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') awakenAgent();
            });

            // Tab switching
            document.querySelectorAll('.config-tab').forEach(tab => {
                tab.addEventListener('click', () => switchTab(tab.dataset.tab));
            });

            // Boot mode buttons (in simple tab)
            document.querySelectorAll('.boot-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => selectBootMode(btn.dataset.mode));
            });

            // Config modal listeners
            if (elements.configBtn) {
                elements.configBtn.addEventListener('click', openConfigModal);
            }
            if (elements.closeModal) {
                elements.closeModal.addEventListener('click', closeConfigModal);
            }
            if (elements.saveKeysBtn) {
                elements.saveKeysBtn.addEventListener('click', () => {
                    if (state.selectedMode) {
                        saveModeConfiguration();
                    } else {
                        saveAPIKeys();
                    }
                });
            }

            document.querySelectorAll('.btn-select-mode').forEach(btn => {
                btn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (btn.dataset.mode) {
                        selectMode(btn.dataset.mode);
                    }
                });
            });

            document.querySelectorAll('.mode-card').forEach(card => {
                card.addEventListener('click', () => {
                    if (card.dataset.mode) {
                        selectMode(card.dataset.mode);
                    }
                });
            });

            document.querySelectorAll('.mode-help-btn').forEach(btn => {
                btn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (btn.dataset.helpMode) {
                        showModeHelp(btn.dataset.helpMode, btn);
                    }
                });
            });

            if (elements.backToModesBtn) {
                elements.backToModesBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    backToModes();
                });
            }

            // Model dropdown change
            if (elements.modelSelect) {
                elements.modelSelect.addEventListener('change', (e) => {
                    updateModelUI(e.target.value);
                });
            }

            // Modal tab switching
            document.querySelectorAll('.modal-tab').forEach(tab => {
                tab.addEventListener('click', () => switchModalTab(tab.dataset.modalTab));
            });

            // WebRTC toggle
            if (elements.enableWebRTCCheckbox) {
                elements.enableWebRTCCheckbox.addEventListener('change', saveWebRTCPreference);
            }

            if (elements.multiModelToggle) {
                elements.multiModelToggle.addEventListener('change', (event) => {
                    const enabled = event.target.checked;
                    syncMultiModelControls(enabled);
                    savePaxosSettings();
                    if (enabled) {
                        openMultiModelModal();
                    }
                });
            }

            if (elements.multiModelConfigure) {
                elements.multiModelConfigure.addEventListener('click', () => {
                    if (elements.multiModelConfigure.disabled) return;
                    openMultiModelModal();
                });
            }

            [elements.closeMultiModel, elements.cancelMultiModel].forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', () => {
                        closeMultiModelModal();
                        if (btn === elements.cancelMultiModel && elements.multiModelToggle && !elements.multiModelToggle.checked) {
                            syncMultiModelControls(false);
                        }
                    });
                }
            });

            if (elements.saveMultiModel) {
                elements.saveMultiModel.addEventListener('click', () => {
                    savePaxosSettings();
                    closeMultiModelModal();
                    showBootMessage('Multi-model plan saved', 'info');
                });
            }

            if (elements.directoryTabs && elements.directoryTabs.length) {
                elements.directoryTabs.forEach(tab => {
                    tab.addEventListener('click', () => setDirectoryCategory(tab.dataset.category));
                });
            }

            if (elements.directorySearch) {
                elements.directorySearch.addEventListener('input', renderDirectory);
            }

            if (elements.directoryFilters && elements.directoryFilters.length) {
                elements.directoryFilters.forEach(filterBtn => {
                    filterBtn.addEventListener('click', () => {
                        state.directoryFilter = filterBtn.dataset.filter || 'all';
                        elements.directoryFilters.forEach(btn => btn.classList.toggle('active', btn === filterBtn));
                        renderDirectory();
                    });
                });
            }

            document.querySelectorAll('[data-popover]').forEach(btn => {
                btn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const type = btn.dataset.popover;
                    if (!type) return;
                    if (state.activePopover && state.activePopover.anchorEl === btn) {
                        closeHelpPopover();
                        return;
                    }
                    closeHelpPopover();
                    openHelpPopover(type, btn);
                });
            });

            if (elements.helpPopoverClose) {
                elements.helpPopoverClose.addEventListener('click', closeHelpPopover);
            }

            // Close modal on background click
            elements.configModal.addEventListener('click', (e) => {
                if (e.target === elements.configModal) closeConfigModal();
            });

            if (elements.infoOverlay) {
                elements.infoOverlay.addEventListener('click', (e) => {
                    if (e.target === elements.infoOverlay) closeInfoCard();
                });
            }

            if (elements.directoryModal) {
                elements.directoryModal.addEventListener('click', (e) => {
                    if (e.target === elements.directoryModal) closeDirectoryModal();
                });
            }
            if (elements.multiModelModal) {
                elements.multiModelModal.addEventListener('click', (e) => {
                    if (e.target === elements.multiModelModal) closeMultiModelModal();
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeInfoCard();
                    closeDirectoryModal();
                    closeHelpPopover();
                    closeMultiModelModal();
                }
            });

            document.addEventListener('click', (event) => {
                if (!state.activePopover || !elements.helpPopover) return;
                const anchor = state.activePopover.anchorEl;
                if (elements.helpPopover.contains(event.target)) return;
                if (anchor && anchor.contains(event.target)) return;
                closeHelpPopover();
            });

            window.addEventListener('resize', () => {
                if (state.activePopover && state.activePopover.anchorEl) {
                    openHelpPopover(state.activePopover.type, state.activePopover.anchorEl);
                }
            });

            syncMultiModelControls(!!(elements.multiModelToggle && elements.multiModelToggle.checked));

            // Initialize simple tab as default
            switchTab('simple');

        } catch (error) {
            document.body.innerHTML = `<p style="color:red;">Fatal Error during boot: ${error.message}. Please check the console.</p>`;
            console.error(error);
        }
    }

    // Expose functions globally for onclick handlers
    window.selectBootMode = selectBootMode;
    window.showModuleInfo = () => {
        const btn = document.querySelector('[data-popover="modules"]');
        if (btn) {
            openHelpPopover('modules', btn);
        } else {
            showInfoCard('modules');
        }
    };
    window.showBlueprintInfo = () => {
        const btn = document.querySelector('[data-popover="blueprints"]');
        if (btn) {
            openHelpPopover('blueprints', btn);
        } else {
            showInfoCard('blueprints');
        }
    };
    window.closeInfoCard = closeInfoCard;
    window.openDirectoryBrowser = openDirectoryBrowser;
    window.closeDirectoryModal = closeDirectoryModal;

    // Initialize the Virtual File System and load modules
    async function initializeReploidApplication(bootConfig) {
        try {
            // Load DiffGenerator utility first (if not already loaded)
            if (!window.DiffGenerator) {
                const diffGenScript = document.createElement('script');
                diffGenScript.src = 'utils/diff-generator.js';
                document.head.appendChild(diffGenScript);
                await new Promise((resolve) => {
                    diffGenScript.onload = resolve;
                    diffGenScript.onerror = () => {
                        console.warn('Failed to load diff-generator.js');
                        // Create a stub so UI doesn't break
                        window.DiffGenerator = {
                            createDiff: (oldContent, newContent) => []
                        };
                        resolve();
                    };
                });
            }
            
            // Create a simple VFS interface
            const vfs = {
                read: async (path) => {
                    // Remove leading /modules/ from path for fetching
                    const cleanPath = path.replace(/^\/modules\//, 'upgrades/');
                    try {
                        const response = await fetch(cleanPath);
                        if (!response.ok) return null;
                        return await response.text();
                    } catch (e) {
                        console.warn(`Failed to read ${path}:`, e);
                        return null;
                    }
                },
                exists: async (path) => {
                    const content = await vfs.read(path);
                    return content !== null;
                }
            };

            // Store boot config for the app to access
            window.REPLOID_VFS = vfs;
            window.REPLOID_CONFIG = state.config;
            
            // Load and execute the main application logic
            const appLogicPath = '/modules/app-logic.js';
            const appLogicContent = await vfs.read(appLogicPath);
            
            if (!appLogicContent) {
                throw new Error('Failed to load app-logic.js');
            }
            
            // Execute the CoreLogicModule
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            await (new AsyncFunction(
                'initialConfig',
                'vfs',
                appLogicContent + '\nawait CoreLogicModule(initialConfig, vfs);'
            ))(state.config, vfs);
            
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            document.getElementById('app-root').innerHTML = 
                `<div style="padding: 20px; color: red;">
                    <h2>Initialization Error</h2>
                    <p>${error.message}</p>
                    <p>Please check the console for more details.</p>
                </div>`;
        }
    }
    
    initialize();
})();
