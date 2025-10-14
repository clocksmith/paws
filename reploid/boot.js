// New boot script for persona-based onboarding

(async () => {
    const state = {
        config: null,
        strings: null,
        selectedPersonaId: null,
        isAdvancedMode: false,
        bootMode: 'minimal', // New: 'minimal', 'all-blueprints', 'all-upgrades', 'persona'
    };

    const elements = {
        personaContainer: document.getElementById('persona-selection-container'),
        goalInput: document.getElementById('goal-input'),
        awakenBtn: document.getElementById('awaken-btn'),
        advancedContainer: document.getElementById('advanced-options'),
        apiStatus: document.getElementById('api-status'),
        providerStatus: document.getElementById('provider-status'),
        configBtn: document.getElementById('config-btn'),
        configModal: document.getElementById('config-modal'),
        closeModal: document.getElementById('close-modal'),
        saveKeysBtn: document.getElementById('save-keys-btn'),
        apiErrorMessage: document.getElementById('api-error-message'),
        providerSelect: document.getElementById('provider-select'),
        geminiKeyInput: document.getElementById('gemini-key'),
        openaiKeyInput: document.getElementById('openai-key'),
        anthropicKeyInput: document.getElementById('anthropic-key'),
        localEndpointInput: document.getElementById('local-endpoint'),
        localModelInput: document.getElementById('local-model'),
        customProxyUrlInput: document.getElementById('custom-proxy-url'),
        customApiKeyInput: document.getElementById('custom-api-key'),
        tabDescriptionText: document.getElementById('tab-description-text'),
    };

    async function checkAPIStatus() {
        try {
            const response = await fetch('http://localhost:8000/api/health');
            if (response.ok) {
                const data = await response.json();
                elements.apiStatus.textContent = '♯ Connected';
                elements.apiStatus.classList.remove('error');
                elements.apiStatus.classList.add('success');

                // Display primary provider
                const providerNames = {
                    'gemini': 'Google Gemini',
                    'openai': 'OpenAI',
                    'anthropic': 'Anthropic',
                    'local': 'Local (Ollama)'
                };
                elements.providerStatus.textContent = providerNames[data.primaryProvider] || data.primaryProvider;
                elements.apiErrorMessage.classList.add('hidden');
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            elements.apiStatus.textContent = '☡ Offline';
            elements.apiStatus.classList.remove('success');
            elements.apiStatus.classList.add('error');
            elements.providerStatus.textContent = 'None';
            elements.apiErrorMessage.classList.remove('hidden');
            console.warn('API health check failed:', error);
        }
    }

    function loadStoredKeys() {
        const provider = localStorage.getItem('AI_PROVIDER') || 'gemini';
        const geminiKey = localStorage.getItem('GEMINI_API_KEY');
        const openaiKey = localStorage.getItem('OPENAI_API_KEY');
        const anthropicKey = localStorage.getItem('ANTHROPIC_API_KEY');
        const localEndpoint = localStorage.getItem('LOCAL_ENDPOINT') || 'http://localhost:11434';
        const localModel = localStorage.getItem('LOCAL_MODEL') || 'llama2';
        const customProxyUrl = localStorage.getItem('CUSTOM_PROXY_URL');
        const customApiKey = localStorage.getItem('CUSTOM_API_KEY');

        // Set provider dropdown
        elements.providerSelect.value = provider;

        // Load all saved values
        if (geminiKey) elements.geminiKeyInput.value = geminiKey;
        if (openaiKey) elements.openaiKeyInput.value = openaiKey;
        if (anthropicKey) elements.anthropicKeyInput.value = anthropicKey;
        if (elements.localEndpointInput) elements.localEndpointInput.value = localEndpoint;
        if (elements.localModelInput) elements.localModelInput.value = localModel;
        if (customProxyUrl && elements.customProxyUrlInput) elements.customProxyUrlInput.value = customProxyUrl;
        if (customApiKey && elements.customApiKeyInput) elements.customApiKeyInput.value = customApiKey;

        // Show correct provider config
        updateProviderUI(provider);
    }

    function updateProviderUI(provider) {
        // Hide all provider configs
        document.querySelectorAll('.provider-config').forEach(el => {
            el.classList.add('hidden');
        });

        // Show selected provider config
        const selectedConfig = document.querySelector(`.provider-config[data-provider="${provider}"]`);
        if (selectedConfig) {
            selectedConfig.classList.remove('hidden');
        }
    }

    function saveAPIKeys() {
        const provider = elements.providerSelect.value;

        // Save provider selection
        localStorage.setItem('AI_PROVIDER', provider);

        // Save all configs (even if not currently selected - for later use)
        const geminiKey = elements.geminiKeyInput.value.trim();
        const openaiKey = elements.openaiKeyInput.value.trim();
        const anthropicKey = elements.anthropicKeyInput.value.trim();

        if (geminiKey) localStorage.setItem('GEMINI_API_KEY', geminiKey);
        if (openaiKey) localStorage.setItem('OPENAI_API_KEY', openaiKey);
        if (anthropicKey) localStorage.setItem('ANTHROPIC_API_KEY', anthropicKey);

        if (elements.localEndpointInput) {
            const localEndpoint = elements.localEndpointInput.value.trim() || 'http://localhost:11434';
            const localModel = elements.localModelInput.value.trim() || 'llama2';
            localStorage.setItem('LOCAL_ENDPOINT', localEndpoint);
            localStorage.setItem('LOCAL_MODEL', localModel);
        }

        if (elements.customProxyUrlInput) {
            const customProxyUrl = elements.customProxyUrlInput.value.trim();
            const customApiKey = elements.customApiKeyInput.value.trim();
            if (customProxyUrl) localStorage.setItem('CUSTOM_PROXY_URL', customProxyUrl);
            if (customApiKey) localStorage.setItem('CUSTOM_API_KEY', customApiKey);
        }

        elements.configModal.classList.add('hidden');

        // Update status message based on provider
        const providerNames = {
            'gemini': 'Google Gemini',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'local': `Local Ollama (${localStorage.getItem('LOCAL_MODEL') || 'llama2'})`,
            'custom': 'Custom Proxy'
        };

        showBootMessage(`Configuration saved: ${providerNames[provider]}`, 'info');

        // Update provider status
        elements.providerStatus.textContent = providerNames[provider];
    }

    function openConfigModal() {
        loadStoredKeys();
        elements.configModal.classList.remove('hidden');
    }

    function closeConfigModal() {
        elements.configModal.classList.add('hidden');
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
            'simple': 'Start with the minimal RSI core - fastest way to self-evolving agent',
            'templates': 'Choose from pre-configured module sets optimized for specific tasks',
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
                        <input type="checkbox" name="upgrade" value="${mod.id}" />
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
                    <input type="checkbox" name="blueprint" value="${bp.id}" />
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
                upgrades = state.config.upgrades.map(u => u.id) || [];
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

            // Provider dropdown change
            if (elements.providerSelect) {
                elements.providerSelect.addEventListener('change', (e) => {
                    updateProviderUI(e.target.value);
                });
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
