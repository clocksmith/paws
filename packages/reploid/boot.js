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
            if (!value) return;
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

        return models.some(modelId => modelId.startsWith('ollama-'));
    }

    function getOllamaRuntimeStatus(data = {}) {
        const status = String(
            data.ollamaStatus ||
            (data.ollama && (data.ollama.status || data.ollama.state)) ||
            ''
        ).toLowerCase();
        return status;
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
            if (model === 'ollama-custom' || !model.startsWith('ollama-')) {
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
            'ollama-llama3': 'Meta\'s Llama 3 running locally via Ollama',
            'ollama-mistral': 'Mistral AI\'s model running locally',
            'ollama-codellama': 'Specialized code generation model running locally',
            'ollama-custom': 'Use any custom Ollama model installed on your system',
            'web-llm': 'Run LLM directly in your browser (experimental)',
            'paxos': 'Distributed consensus-based model (requires PAXS upgrade)',
            'custom-proxy': 'Connect to your own API endpoint or proxy',
        };

        elements.modelDescription.textContent = descriptions[modelValue] || 'Select a model to see its description';

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

            // Show/hide custom model name based on model selection
            if (modelValue === 'ollama-custom') {
                elements.customModelNameContainer.style.display = 'block';
            } else {
                elements.customModelNameContainer.style.display = 'none';
                // Pre-fill model name for known models
                const modelNames = {
                    'ollama-llama3': 'llama3',
                    'ollama-mistral': 'mistral',
                    'ollama-codellama': 'codellama',
                };
                if (elements.localModelInput && modelNames[modelValue]) {
                    elements.localModelInput.value = modelNames[modelValue];
                }
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
            } else if (selectedModel !== 'ollama-custom') {
                // For pre-defined models, extract the model name
                const modelNames = {
                    'ollama-llama3': 'llama3',
                    'ollama-mistral': 'mistral',
                    'ollama-codellama': 'codellama',
                };
                if (modelNames[selectedModel]) {
                    localStorage.setItem('LOCAL_MODEL', modelNames[selectedModel]);
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

    function openConfigModal() {
        loadStoredKeys();
        closeHelpPopover();
        elements.configModal.classList.remove('hidden');
    }

    function closeConfigModal() {
        elements.configModal.classList.add('hidden');
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

    function openHelpPopover(type, anchorEl) {
        const copy = POPOVER_COPY[type];
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
            elements.configBtn.addEventListener('click', openConfigModal);
            elements.closeModal.addEventListener('click', closeConfigModal);
            elements.saveKeysBtn.addEventListener('click', saveAPIKeys);

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
