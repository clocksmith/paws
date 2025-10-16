// New boot script for persona-based onboarding

(async () => {
    const state = {
        config: null,
        strings: null,
        selectedPersonaId: null,
        isAdvancedMode: false,
        bootMode: 'minimal', // New: 'minimal', 'all-blueprints', 'all-upgrades', 'persona'
        savedApiKeys: {}, // Store API keys for different providers
    };

    const elements = {
        personaContainer: document.getElementById('persona-selection-container'),
        goalInput: document.getElementById('goal-input'),
        awakenBtn: document.getElementById('awaken-btn'),
        advancedContainer: document.getElementById('advanced-options'),
        apiStatus: document.getElementById('api-status'),
        apiStatusDetail: document.getElementById('api-status-detail'),
        providerStatus: document.getElementById('provider-status'),
        providerStatusDetail: document.getElementById('provider-status-detail'),
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
        tabDescriptionText: document.getElementById('tab-description-text'),
        enableWebRTCCheckbox: document.getElementById('enable-webrtc-modal'),
    };

    async function checkAPIStatus() {
        try {
            // Try to determine the correct API URL based on current origin
            let apiUrl = 'http://localhost:8000/api/health';
            let serverAddress = 'localhost:8000';

            // If we're on a deployed domain, try localhost first, then same origin as fallback
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                // First try localhost (user might have local server running)
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
                    // If localhost fails, try same origin
                    apiUrl = `${window.location.origin}/api/health`;
                    serverAddress = window.location.host;
                }
            }

            const response = await fetch(apiUrl, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                const data = await response.json();
                elements.apiStatus.textContent = '✓ Online';
                elements.apiStatus.classList.remove('error', 'warning');
                elements.apiStatus.classList.add('success');

                // Show server address as detail
                elements.apiStatusDetail.textContent = serverAddress;

                // Display model information with more detail
                const modelInfo = getModelDisplayInfo(data);
                elements.providerStatus.textContent = modelInfo.name;
                elements.providerStatusDetail.textContent = modelInfo.detail;

                elements.apiErrorMessage.classList.add('hidden');
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            // Don't show error if we're on a deployed version (server might not be needed)
            const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

            elements.apiStatus.textContent = isDeployed ? '○ Browser Only' : '✗ Offline';
            elements.apiStatus.classList.remove('success');
            elements.apiStatus.classList.add(isDeployed ? 'warning' : 'error');
            elements.apiStatusDetail.textContent = '';

            // Show configured model from localStorage
            const savedModel = localStorage.getItem('SELECTED_MODEL');
            if (savedModel) {
                const modelInfo = getModelDisplayInfo({ model: savedModel });
                elements.providerStatus.textContent = modelInfo.name;
                elements.providerStatusDetail.textContent = modelInfo.detail || 'Configured locally';
            } else {
                elements.providerStatus.textContent = isDeployed ? 'Not Configured' : 'None';
                elements.providerStatusDetail.textContent = '';
            }

            if (!isDeployed) {
                elements.apiErrorMessage.classList.remove('hidden');
            }

            console.warn('API health check failed:', error.message);
        }
    }

    function getModelDisplayInfo(data) {
        // Extract model info from server response or localStorage
        const model = data.model || data.primaryModel || localStorage.getItem('SELECTED_MODEL');
        const provider = data.primaryProvider || data.provider;
        const actualModelName = data.actualModel || data.modelName;
        const models = data.models; // Array of models for multi-model configs

        if (!model && !provider) {
            return { name: 'Not Configured', detail: '' };
        }

        // Handle multi-model configurations (Paxos, etc.)
        if (models && Array.isArray(models) && models.length > 1) {
            return {
                name: 'Multi-Model',
                detail: models.join(', ')
            };
        }

        // Map model IDs to display names and providers
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

        // Check if it's a known model
        if (modelInfo[model]) {
            return {
                name: modelInfo[model].name,
                detail: modelInfo[model].provider
            };
        }

        // Handle Ollama models - show actual model name
        if (model && model.startsWith('ollama-') || provider === 'local') {
            const localModelName = actualModelName || localStorage.getItem('LOCAL_MODEL');

            if (model === 'ollama-custom' || !model.startsWith('ollama-')) {
                // Custom Ollama model
                return {
                    name: localModelName || 'Ollama',
                    detail: 'Local via Ollama'
                };
            } else {
                // Pre-defined Ollama model
                const modelName = model.replace('ollama-', '');
                return {
                    name: modelName.charAt(0).toUpperCase() + modelName.slice(1),
                    detail: 'Local via Ollama'
                };
            }
        }

        // Fallback to provider name
        const providerNames = {
            'gemini': 'Google Gemini',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'paxos': 'Paxos',
        };

        const displayName = providerNames[provider] || actualModelName || model || provider || 'Unknown';
        return {
            name: displayName,
            detail: provider ? `via ${provider}` : ''
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

        // Show correct model config UI
        updateModelUI(selectedModel);
    }

    function saveWebRTCPreference() {
        const enabled = elements.enableWebRTCCheckbox.checked;
        localStorage.setItem('ENABLE_WEBRTC', enabled.toString());
        console.log(`WebRTC Swarm: ${enabled ? 'Enabled' : 'Disabled'}`);
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

        // Update description and state
        const descriptions = {
            'simple': 'Choose your starting configuration - from minimal core to full power',
            'templates': 'Pre-configured personas optimized for specific tasks and workflows',
            'hunter': 'Manually select individual modules and blueprints for complete control'
        };
        elements.tabDescriptionText.textContent = descriptions[tabName];

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

            // Populate UI with strings
            elements.goalInput.placeholder = state.strings.goal_input_placeholder;
            elements.awakenBtn.textContent = state.strings.awaken_button;

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

            // Close modal on background click
            elements.configModal.addEventListener('click', (e) => {
                if (e.target === elements.configModal) closeConfigModal();
            });

            // Initialize simple tab as default
            switchTab('simple');

        } catch (error) {
            document.body.innerHTML = `<p style="color:red;">Fatal Error during boot: ${error.message}. Please check the console.</p>`;
            console.error(error);
        }
    }

    // Expose functions globally for onclick handlers
    window.selectBootMode = selectBootMode;

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
