// New boot script for persona-based onboarding
import { state, elements } from './boot/state.js';
import { loadStoredKeys } from './boot/config.js';
import { checkAPIStatus } from './boot/api.js';
import { closeHelpPopover } from './boot/ui.js';
import { initModelConfig, hasModelsConfigured, getSelectedModels } from './boot/model-config.js';

// Detect if proxy server is available
async function detectProxyServer() {
    try {
        const response = await fetch('http://localhost:8000/api/health', {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (error) {
        console.log('[Boot] Proxy server not detected:', error.message);
        return false;
    }
}

// This is the main entry point for the application.
async function main() {
    // Initial setup
    loadStoredKeys();
    await checkAPIStatus();

    // Check proxy server availability
    const proxyAvailable = await detectProxyServer();
    state.proxyAvailable = proxyAvailable;
    console.log('[Boot] Proxy server available:', proxyAvailable);

    // Show/hide proxy warning banner
    const proxyWarning = document.getElementById('proxy-warning');
    if (proxyWarning) {
        if (!proxyAvailable) {
            proxyWarning.classList.remove('hidden');
        } else {
            proxyWarning.classList.add('hidden');
        }
    }

    // Initialize new model configuration UI
    console.log('[Boot] Initializing model configuration UI...');
    await initModelConfig();

    // Load stored mode or set default (kept for backwards compatibility)
    const storedMode = localStorage.getItem('DEPLOYMENT_MODE');
    if (storedMode) {
        state.selectedMode = storedMode;
    } else {
        // Default to cloud mode if we have a provider available
        if (state.detectedEnv.hasServer && state.detectedEnv.providers && state.detectedEnv.providers.length > 0) {
            const defaultMode = 'cloud';
            localStorage.setItem('DEPLOYMENT_MODE', defaultMode);
            state.selectedMode = defaultMode;
        }
    }

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Config button and modal (if using legacy modal UI)
    if (elements.configBtn && elements.configModal) {
        elements.configBtn.addEventListener('click', () => {
            elements.configModal.classList.toggle('hidden');
        });
    }
    if (elements.closeModal && elements.configModal) {
        elements.closeModal.addEventListener('click', () => elements.configModal.classList.add('hidden'));
    }

    // Mode card selection - click to select and close
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if disabled
            if (card.classList.contains('disabled')) {
                return;
            }

            const modeName = card.dataset.mode;
            console.log('[Boot] Mode selected:', modeName);

            // Special handling for proxy-based mode - show sub-options
            if (modeName === 'proxy-based') {
                // Hide mode cards section
                const modeCardsContainer = document.querySelector('.mode-cards');
                if (modeCardsContainer) {
                    modeCardsContainer.style.display = 'none';
                }

                // Show proxy-based options
                const proxyOptions = document.getElementById('proxy-based-options');
                if (proxyOptions) {
                    proxyOptions.classList.remove('hidden');
                }

                // Update UI to show selected state
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                return; // Don't close modal or save mode yet
            }

            // Special handling for hybrid mode - show configuration
            if (modeName === 'hybrid') {
                // Hide mode cards section
                const modeCardsContainer = document.querySelector('.mode-cards');
                if (modeCardsContainer) {
                    modeCardsContainer.style.display = 'none';
                }

                // Show hybrid mode options
                const hybridOptions = document.getElementById('hybrid-mode-options');
                if (hybridOptions) {
                    hybridOptions.classList.remove('hidden');
                }

                // Update UI to show selected state
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                return; // Don't close modal or save mode yet
            }

            // Save the selected mode
            localStorage.setItem('DEPLOYMENT_MODE', modeName);
            state.selectedMode = modeName;

            // Update the current configuration display
            updateCurrentModeDisplay(modeName);

            // Close the modal
            if (elements.configModal) {
                elements.configModal.classList.add('hidden');
            }

            // Update UI to show selected state
            document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    if (elements.helpPopoverClose) {
        elements.helpPopoverClose.addEventListener('click', closeHelpPopover);
    }

    document.addEventListener('click', (e) => {
        if (state.activePopover && !elements.helpPopover.contains(e.target) && !state.activePopover.anchorEl.contains(e.target)) {
            closeHelpPopover();
        }
    });

    // Goal input and Awaken Agent button
    if (elements.goalInput && elements.awakenBtn) {
        // Enable/disable button based on goal input AND model configuration
        elements.goalInput.addEventListener('input', (e) => {
            const hasGoal = e.target.value.trim().length > 0;
            const hasModels = hasModelsConfigured();
            elements.awakenBtn.disabled = !(hasGoal && hasModels);
        });

        // Handle Awaken Agent button click
        elements.awakenBtn.addEventListener('click', awakenAgent);
    }

    // Global auto-approve toggle card (clickable card instead of separate toggle)
    const autoApproveCard = document.getElementById('auto-approve-card');
    const autoApproveToggle = document.getElementById('auto-approve-toggle');
    if (autoApproveCard && autoApproveToggle) {
        // Load saved state
        const globalAutoApprove = localStorage.getItem('GLOBAL_AUTO_APPROVE') === 'true';
        autoApproveToggle.checked = globalAutoApprove;
        autoApproveCard.setAttribute('data-enabled', globalAutoApprove);

        // Show info if enabled
        const autoApproveInfo = document.getElementById('auto-approve-info');
        if (autoApproveInfo) {
            autoApproveInfo.classList.toggle('hidden', !globalAutoApprove);
        }

        // Handle card click (toggle on/off)
        autoApproveCard.addEventListener('click', (e) => {
            const currentState = autoApproveToggle.checked;
            const newState = !currentState;

            autoApproveToggle.checked = newState;
            autoApproveCard.setAttribute('data-enabled', newState);
            localStorage.setItem('GLOBAL_AUTO_APPROVE', newState);

            // Update config.json in memory (will be persisted on next save)
            if (typeof globalThis.config !== 'undefined') {
                if (!globalThis.config.curatorMode) {
                    globalThis.config.curatorMode = {};
                }
                globalThis.config.curatorMode.enabled = newState;
                globalThis.config.curatorMode.autoApproveContext = newState;
            }

            // Show/hide info message with animation
            if (autoApproveInfo) {
                autoApproveInfo.classList.toggle('hidden', !newState);
            }

            console.log('[Boot] Global auto-approve:', newState);
        });
    }

    // Proxy-based mode checkbox handlers (multi-select support)
    const proxyOllamaCheckbox = document.getElementById('proxy-ollama');
    const proxyHuggingFaceCheckbox = document.getElementById('proxy-huggingface');
    const proxyCloudCheckbox = document.getElementById('proxy-cloud');

    // Helper function to update save button visibility
    function updateProxySaveButton() {
        const saveSection = document.getElementById('proxy-save-section');
        const anyChecked = proxyOllamaCheckbox?.checked ||
                          proxyHuggingFaceCheckbox?.checked ||
                          proxyCloudCheckbox?.checked;

        if (saveSection) {
            if (anyChecked) {
                saveSection.classList.remove('hidden');
            } else {
                saveSection.classList.add('hidden');
            }
        }
    }

    if (proxyOllamaCheckbox) {
        proxyOllamaCheckbox.addEventListener('change', (e) => {
            const ollamaConfig = document.getElementById('ollama-config');

            if (e.target.checked) {
                if (ollamaConfig) ollamaConfig.classList.remove('hidden');
                console.log('[Boot] Ollama enabled');
            } else {
                if (ollamaConfig) ollamaConfig.classList.add('hidden');
                console.log('[Boot] Ollama disabled');
            }

            updateProxySaveButton();
        });
    }

    if (proxyHuggingFaceCheckbox) {
        proxyHuggingFaceCheckbox.addEventListener('change', (e) => {
            const huggingfaceConfig = document.getElementById('huggingface-config');

            if (e.target.checked) {
                if (huggingfaceConfig) huggingfaceConfig.classList.remove('hidden');
                console.log('[Boot] HuggingFace enabled');
            } else {
                if (huggingfaceConfig) huggingfaceConfig.classList.add('hidden');
                console.log('[Boot] HuggingFace disabled');
            }

            updateProxySaveButton();
        });
    }

    if (proxyCloudCheckbox) {
        proxyCloudCheckbox.addEventListener('change', (e) => {
            const cloudConfig = document.getElementById('cloud-proxy-config');

            if (e.target.checked) {
                if (cloudConfig) cloudConfig.classList.remove('hidden');
                console.log('[Boot] Cloud via proxy enabled');
            } else {
                if (cloudConfig) cloudConfig.classList.add('hidden');
                console.log('[Boot] Cloud via proxy disabled');
            }

            updateProxySaveButton();
        });
    }

    // Save proxy configuration button
    const saveProxyConfigBtn = document.getElementById('save-proxy-config');
    if (saveProxyConfigBtn) {
        saveProxyConfigBtn.addEventListener('click', () => {
            const multiModelConfig = {
                models: []
            };

            // Collect Ollama configuration if selected
            if (proxyOllamaCheckbox?.checked) {
                const ollamaEndpoint = document.getElementById('ollama-endpoint')?.value || 'http://localhost:11434';
                const ollamaModel = document.getElementById('ollama-model')?.value;

                multiModelConfig.models.push({
                    type: 'ollama',
                    endpoint: ollamaEndpoint,
                    model: ollamaModel,
                    enabled: true
                });
            }

            // Collect HuggingFace configuration if selected
            if (proxyHuggingFaceCheckbox?.checked) {
                const hfModel = document.getElementById('huggingface-model')?.value;
                const hfKey = document.getElementById('huggingface-key')?.value;

                multiModelConfig.models.push({
                    type: 'huggingface',
                    model: hfModel,
                    apiKey: hfKey,
                    enabled: true
                });
            }

            // Collect Cloud configuration if selected
            if (proxyCloudCheckbox?.checked) {
                const cloudProvider = document.getElementById('cloud-proxy-provider')?.value;
                const cloudKey = document.getElementById('cloud-proxy-key')?.value;

                multiModelConfig.models.push({
                    type: 'cloud-proxy',
                    provider: cloudProvider,
                    apiKey: cloudKey,
                    enabled: true
                });
            }

            // Save multi-model configuration to localStorage
            localStorage.setItem('MULTI_MODEL_CONFIG', JSON.stringify(multiModelConfig));
            localStorage.setItem('DEPLOYMENT_MODE', 'proxy-based');
            state.selectedMode = 'proxy-based';

            console.log('[Boot] Multi-model configuration saved:', multiModelConfig);

            // Update display
            updateCurrentModeDisplay('proxy-based');

            // Close modal
            if (elements.configModal) {
                elements.configModal.classList.add('hidden');
            }
        });
    }

    // Back to modes button (if it exists in proxy-based options)
    const backToModesBtn = document.getElementById('back-to-modes');
    if (backToModesBtn) {
        backToModesBtn.addEventListener('click', () => {
            // Hide proxy-based options
            const proxyOptions = document.getElementById('proxy-based-options');
            if (proxyOptions) {
                proxyOptions.classList.add('hidden');
            }

            // Show mode cards again
            const modeCardsContainer = document.querySelector('.mode-cards');
            if (modeCardsContainer) {
                modeCardsContainer.style.display = '';
            }
        });
    }

    // Save hybrid configuration button
    const saveHybridConfigBtn = document.getElementById('save-hybrid-config');
    if (saveHybridConfigBtn) {
        saveHybridConfigBtn.addEventListener('click', () => {
            const hybridConfig = {
                local: {
                    endpoint: document.getElementById('hybrid-ollama-endpoint')?.value || 'http://localhost:11434',
                    model: document.getElementById('hybrid-ollama-model')?.value || 'llama3:latest'
                },
                cloud: {
                    provider: document.getElementById('hybrid-cloud-provider')?.value || 'gemini',
                    apiKey: document.getElementById('hybrid-cloud-key')?.value || ''
                }
            };

            // Validate that cloud API key is provided
            if (!hybridConfig.cloud.apiKey) {
                alert('Please enter a Cloud API key for complex tasks.');
                return;
            }

            // Save hybrid configuration to localStorage
            localStorage.setItem('HYBRID_CONFIG', JSON.stringify(hybridConfig));
            localStorage.setItem('DEPLOYMENT_MODE', 'hybrid');
            state.selectedMode = 'hybrid';

            console.log('[Boot] Hybrid configuration saved:', hybridConfig);

            // Update display
            updateCurrentModeDisplay('hybrid');

            // Close modal
            if (elements.configModal) {
                elements.configModal.classList.add('hidden');
            }
        });
    }

    // Back to modes button (hybrid)
    const backToModesHybridBtn = document.getElementById('back-to-modes-hybrid');
    if (backToModesHybridBtn) {
        backToModesHybridBtn.addEventListener('click', () => {
            // Hide hybrid mode options
            const hybridOptions = document.getElementById('hybrid-mode-options');
            if (hybridOptions) {
                hybridOptions.classList.add('hidden');
            }

            // Show mode cards again
            const modeCardsContainer = document.querySelector('.mode-cards');
            if (modeCardsContainer) {
                modeCardsContainer.style.display = '';
            }
        });
    }
}

function updateCurrentModeDisplay(modeName) {
    const modeInfo = {
        'cloud-direct': { icon: '▲', title: 'Cloud Models (Browser)' },
        cloud: { icon: '▲', title: 'Cloud Provider' },
        'proxy-based': { icon: '■', title: 'Local & Private (Proxy)' },
        local: { icon: '■', title: 'Local (Ollama)' },
        'web-llm': { icon: '◆', title: 'Browser-Only (WebLLM)' },
        hybrid: { icon: '◐', title: 'Hybrid (Auto)' },
        multi: { icon: '◈', title: 'High Availability' },
        custom: { icon: '⬢', title: 'Custom Endpoint' }
    };

    const info = modeInfo[modeName];
    if (info) {
        const iconElement = document.getElementById('current-mode-icon');
        const statusElement = elements.providerStatus;

        if (iconElement) iconElement.textContent = info.icon;
        if (statusElement) statusElement.textContent = info.title;
    }
}

async function awakenAgent() {
    console.log('[Boot] awakenAgent() called');
    const goal = elements.goalInput?.value?.trim();
    console.log('[Boot] Goal from input:', goal);

    if (!goal) {
        console.warn('[Boot] No goal specified');
        // Show visible user message
        const bootContainer = document.getElementById('boot-container');
        if (bootContainer) {
            // Create or get existing message container
            let messageContainer = document.getElementById('boot-warning-message');
            if (!messageContainer) {
                messageContainer = document.createElement('div');
                messageContainer.id = 'boot-warning-message';
                messageContainer.className = 'error-message';
                messageContainer.style.cssText = 'margin: 20px auto; max-width: 600px; text-align: center;';

                // Insert at the top of boot container
                const firstChild = bootContainer.firstElementChild;
                if (firstChild) {
                    bootContainer.insertBefore(messageContainer, firstChild);
                } else {
                    bootContainer.appendChild(messageContainer);
                }
            }

            messageContainer.innerHTML = `
                <strong>⚠️ Goal Required</strong>
                <p>Please enter a goal for your agent before awakening. The goal defines what your agent will work on.</p>
            `;
            messageContainer.classList.remove('hidden');

            // Auto-hide after 5 seconds
            setTimeout(() => {
                messageContainer.classList.add('hidden');
            }, 5000);
        }
        return;
    }

    console.log('[Boot] Awakening agent with goal:', goal);

    // Check if we have a valid configuration
    if (!state.detectedEnv.hasServer && !state.detectedEnv.hasWebGPU) {
        alert('No AI provider available. Please configure Cloud Provider (with API key) or enable Web LLM mode.');
        return;
    }

    // First, immediately handle UI transition before any async work
    const bootContainer = document.getElementById('boot-container');
    const appRoot = document.getElementById('app-root');

    if (!bootContainer || !appRoot) {
        console.error('[Boot] Missing boot-container or app-root elements');
        return;
    }

    // Immediately hide boot container
    bootContainer.style.display = 'none';

    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'boot-transition-overlay';
    loadingOverlay.innerHTML = `
                <style>
                    #boot-transition-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        z-index: 10000;
                        animation: fadeIn 0.3s ease-in;
                    }
                    #boot-transition-overlay .loading-content {
                        text-align: center;
                    }
                    #boot-transition-overlay h2 {
                        color: #00ffff;
                        text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                        font-size: 2em;
                        margin: 0 0 20px 0;
                        animation: shimmer 2s linear infinite;
                        background: linear-gradient(90deg, #00ffff, #ffd700, #00ffff);
                        background-size: 200% auto;
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    #boot-transition-overlay .goal-text {
                        color: #e0e0e0;
                        font-size: 1.1em;
                        margin-bottom: 30px;
                        max-width: 600px;
                    }
                    #boot-transition-overlay .spinner {
                        width: 60px;
                        height: 60px;
                        border: 4px solid rgba(0, 255, 255, 0.1);
                        border-top: 4px solid #00ffff;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes shimmer {
                        0% { background-position: 0% center; }
                        100% { background-position: 200% center; }
                    }
                    .fade-out {
                        animation: fadeOut 0.5s ease-out forwards;
                    }
                    @keyframes fadeOut {
                        from { opacity: 1; }
                        to { opacity: 0; }
                    }
                </style>
                <div class="loading-content">
                    <h2>REPLOID Awakening</h2>
                    <div class="goal-text">${goal}</div>
                    <div class="spinner"></div>
                </div>
            `;
    document.body.appendChild(loadingOverlay);

    // Show app root immediately
    appRoot.style.display = 'block';
    appRoot.style.opacity = '0';

    // CRITICAL: Use requestAnimationFrame to ensure DOM updates before async work
    // This forces the browser to render the boot screen removal
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Now remove the boot container from DOM after browser has painted
    bootContainer.remove();

    try {
        // Collect and save boot state to VFS for genesis cycle
        const bootMode = localStorage.getItem('BOOT_MODE') || 'meta';
        const consensusType = localStorage.getItem('CONSENSUS_TYPE') || 'arena';
        const selectedModels = getSelectedModels();

        const genesisBootState = {
            timestamp: new Date().toISOString(),
            goal: goal,
            bootMode: bootMode,
            consensusType: consensusType,
            selectedModels: selectedModels,
            deploymentMode: state.selectedMode || 'cloud',
            environment: {
                hasProxy: state.proxyAvailable,
                hasWebGPU: state.detectedEnv.hasWebGPU,
                hasServer: state.detectedEnv.hasServer
            }
        };

        console.log('[Boot] Saving genesis boot state to VFS:', genesisBootState);

        // Save to VFS via proxy endpoint
        if (state.proxyAvailable) {
            try {
                const vfsResponse = await fetch('http://localhost:8000/api/vfs/backup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        '/system/genesis-boot-config.json': JSON.stringify(genesisBootState, null, 2)
                    })
                });

                if (vfsResponse.ok) {
                    console.log('[Boot] Genesis boot state saved to VFS successfully');
                } else {
                    console.warn('[Boot] Failed to save genesis boot state to VFS:', await vfsResponse.text());
                }
            } catch (vfsError) {
                console.warn('[Boot] Could not save to VFS (proxy unavailable):', vfsError.message);
            }
        } else {
            console.warn('[Boot] Proxy unavailable, boot state not persisted to VFS');
        }

        // ============================================================
        // BOOT LOADER: Load all modules into VFS based on boot mode
        // ============================================================

        console.log('[BootLoader] Initializing VFS and loading modules...');

        // First, fetch module manifest to know what to load
        console.log('[BootLoader] Fetching module manifest...');
        const manifestResponse = await fetch('/module-manifest.json?t=' + Date.now());
        const manifest = await manifestResponse.json();
        console.log('[BootLoader] Manifest loaded:', manifest.version, 'with', Object.keys(manifest.loadGroups).length, 'load groups');

        // Determine which modules to load based on boot mode
        let modulesToLoad = [];
        let presetName = bootMode;

        // Map old boot mode names to new preset names for backwards compatibility
        const modeMapping = {
            'minimal': 'minimal-rsi',
            'essential': 'minimal-rsi',
            'meta': 'rsi-core',
            'rsi': 'rsi-core',
            'full': 'experimental',
            'experimental': 'experimental'
        };

        presetName = modeMapping[bootMode] || bootMode;

        // Try to load the preset
        if (manifest.presets?.[presetName]) {
            modulesToLoad = manifest.presets[presetName];
        } else {
            // Fallback to RSI core as default
            console.warn(`[BootLoader] Unknown boot mode '${bootMode}', falling back to RSI Core`);
            modulesToLoad = manifest.presets?.['rsi-core'] || [];
            presetName = 'rsi-core';
        }

        console.log('[BootLoader] Boot mode:', bootMode, '- Loading', modulesToLoad.length, 'modules');

        // Fetch config.json (needed for agent)
        console.log('[BootLoader] Fetching config.json...');
        const configResponse = await fetch('/config.json?t=' + Date.now());
        const configContent = await configResponse.text();

        // ALWAYS fetch app-logic.js (bootstrap script, not a module)
        console.log('[BootLoader] Fetching app-logic.js (bootstrap)...');
        const appLogicResponse = await fetch('/upgrades/app-logic.js?t=' + Date.now());
        const appLogicContent = await appLogicResponse.text();

        // Fetch all module files from server IN PARALLEL
        console.log('[BootLoader] Fetching', modulesToLoad.length, 'module files from server...');
        const modulePromises = modulesToLoad.map(async (modulePath) => {
            try {
                const response = await fetch(modulePath + '?t=' + Date.now());
                if (!response.ok) {
                    console.warn(`[BootLoader] Failed to fetch ${modulePath}:`, response.statusText);
                    return null;
                }
                const content = await response.text();
                return { path: modulePath, content };
            } catch (error) {
                console.error(`[BootLoader] Error fetching ${modulePath}:`, error);
                return null;
            }
        });

        const moduleResults = await Promise.all(modulePromises);
        const loadedModules = moduleResults.filter(m => m !== null);
        console.log('[BootLoader] Successfully fetched', loadedModules.length, 'modules');

        // Initialize GitVFS (IndexedDB-backed Git filesystem)
        console.log('[BootLoader] Initializing GitVFS...');
        const LightningFS = window.LightningFS;
        const fs = new LightningFS('reploid-vfs');
        const git = window.git;

        // Helper to write file to VFS
        const writeToVFS = async (filepath, content) => {
            const dir = filepath.substring(0, filepath.lastIndexOf('/'));
            if (dir) {
                await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
            }
            await fs.promises.writeFile(filepath, content, 'utf8');
        };

        // Initialize git repo if needed
        try {
            await git.init({ fs, dir: '/' });
        } catch (error) {
            // Repo might already exist
        }

        // Write all modules to VFS
        console.log('[BootLoader] Writing', loadedModules.length, 'modules to VFS...');
        await writeToVFS('/config.json', configContent);
        await writeToVFS('/module-manifest.json', JSON.stringify(manifest, null, 2));
        await writeToVFS('/upgrades/app-logic.js', appLogicContent);

        for (const module of loadedModules) {
            await writeToVFS(module.path, module.content);
        }

        console.log('[BootLoader] All modules + app-logic written to VFS');

        // Commit to git
        try {
            await git.add({ fs, dir: '/', filepath: '.' });
            await git.commit({
                fs,
                dir: '/',
                message: `Boot Loader: Loaded ${loadedModules.length} modules (${presetName} preset)`,
                author: {
                    name: 'REPLOID Boot Loader',
                    email: 'boot@reploid.local'
                }
            });
            console.log('[BootLoader] Committed modules to Git');
        } catch (error) {
            console.warn('[BootLoader] Git commit failed (non-fatal):', error);
        }

        // ============================================================
        // GENESIS CYCLE: Initialize StateManager with module metadata
        // ============================================================
        console.log('[BootLoader] Initializing StateManager genesis state...');

        const artifactMetadata = {};

        // Register config.json
        artifactMetadata['/config.json'] = {
            id: '/config.json',
            type: 'json',
            description: 'REPLOID configuration'
        };

        // Register module manifest
        artifactMetadata['/module-manifest.json'] = {
            id: '/module-manifest.json',
            type: 'json',
            description: 'Module manifest with load groups and presets'
        };

        // Register app-logic.js
        artifactMetadata['/upgrades/app-logic.js'] = {
            id: '/upgrades/app-logic.js',
            type: 'code',
            description: 'Core agent logic bootstrap module'
        };

        // Register all loaded modules
        for (const module of loadedModules) {
            const moduleId = module.path.replace('/upgrades/', '').replace('.js', '');
            artifactMetadata[module.path] = {
                id: module.path,
                type: 'code',
                description: `REPLOID module: ${moduleId}`
            };
        }

        // Create initial state for StateManager
        const genesisState = {
            totalCycles: 0,
            artifactMetadata: artifactMetadata,
            currentGoal: {
                seed: goal,
                cumulative: goal,
                stack: [],
                latestType: "Boot"
            },
            apiKey: ""
        };

        // Save genesis state to VFS at /.state (where StateManager reads it)
        await fs.promises.writeFile('/.state', JSON.stringify(genesisState, null, 2), 'utf8');
        console.log(`[BootLoader] Genesis state saved with ${Object.keys(artifactMetadata).length} artifacts`);

        // Create VFS interface for agent
        const vfs = {
            read: async (path) => {
                console.log(`[VFS] Reading from IndexedDB: ${path}`);
                try {
                    const content = await fs.promises.readFile(path, 'utf8');
                    console.log(`[VFS] Loaded: ${path} (${content.length} bytes)`);
                    return content;
                } catch (error) {
                    console.error(`[VFS] Error reading ${path}:`, error);
                    throw error;
                }
            },
            write: async (path, content) => {
                await writeToVFS(path, content);
            },
            fs, // Expose filesystem for advanced operations
            git // Expose git for version control
        };

        console.log('[BootLoader] VFS ready - all modules available in IndexedDB');

        // Load app-logic.js from VFS
        console.log('[Boot] Loading app-logic.js from VFS...');
        const appLogicCode = await vfs.read('/upgrades/app-logic.js');
        console.log('[Boot] app-logic.js loaded, size:', appLogicCode.length);

        // Execute app-logic.js to get the CoreLogicModule function
        console.log('[Boot] Executing app-logic.js...');
        const CoreLogicModule = new Function(appLogicCode + '\nreturn CoreLogicModule;')();
        console.log('[Boot] CoreLogicModule extracted:', typeof CoreLogicModule);

        // bootMode already declared above at line 492
        console.log('[Boot] Boot mode:', bootMode);

        // Prepare initial configuration
        const initialConfig = {
            goal: goal,
            mode: state.selectedMode || 'cloud',
            bootMode: presetName,  // Pass mapped preset name (e.g., 'minimal-rsi' not 'minimal')
            persona: {
                id: 'code_refactorer'  // Default persona
            }
        };

        console.log('[Boot] Initializing agent system with config:', initialConfig);

        // Initialize the agent system
        console.log('[Boot] Calling CoreLogicModule...');
        const agentSystem = await CoreLogicModule(initialConfig, vfs);

        console.log('[Boot] Agent system awakened successfully');

        // Genesis bootstrap runs synchronously inside CoreLogicModule,
        // so it's already complete at this point. Transition to main app.
        console.log('[Boot] Genesis bootstrap complete - removing boot overlay...');
        appRoot.style.transition = 'opacity 0.5s ease-in';
        appRoot.style.opacity = '1';

        // Fade out and remove loading overlay - WAIT for it to complete
        await new Promise((resolve) => {
            if (loadingOverlay && loadingOverlay.parentNode) {
                loadingOverlay.classList.add('fade-out');
                setTimeout(() => {
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.remove();
                        console.log('[Boot] Boot overlay removed');
                    }
                    resolve();
                }, 500);
            } else {
                console.warn('[Boot] Loading overlay not found or already removed');
                resolve();
            }
        });

        // Hide the boot container now that loading is complete
        if (bootContainer && bootContainer.parentNode) {
            bootContainer.style.display = 'none';
            console.log('[Boot] Boot container hidden');
        }

        console.log('[Boot] Boot overlay removal complete - starting user cycle');

        // NOW start the user cycle after boot screen is fully removed
        if (agentSystem && agentSystem.goal && agentSystem.container) {
            console.log('[Boot] Starting user cycle with goal:', agentSystem.goal);
            try {
                const SentinelFSM = await agentSystem.container.resolve('SentinelFSM');
                if (SentinelFSM && SentinelFSM.startCycle) {
                    await SentinelFSM.startCycle(agentSystem.goal);
                    console.log('[Boot] User cycle started successfully');
                } else {
                    console.error('[Boot] SentinelFSM.startCycle not available');
                }
            } catch (cycleError) {
                console.error('[Boot] Failed to start user cycle:', cycleError);
            }
        } else {
            console.log('[Boot] No goal provided, agent remains in IDLE state');
        }

    } catch (error) {
        console.error('[Boot] Failed to awaken agent:', error);

        // Hide loading overlay and show error screen
        const loadingOverlay = document.getElementById('boot-transition-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }

        const appRoot = document.getElementById('app-root');
        if (appRoot) {
            appRoot.style.display = 'flex';
            appRoot.style.alignItems = 'center';
            appRoot.style.justifyContent = 'center';
            appRoot.style.minHeight = '100vh';
            appRoot.style.padding = '20px';
            appRoot.innerHTML = `
                <div style="max-width: 800px; width: 100%; padding: 40px; background: rgba(255, 107, 107, 0.1); border: 2px solid #ff6b6b; border-radius: 12px; box-shadow: 0 8px 32px rgba(255, 107, 107, 0.2);">
                    <div style="text-align: center;">
                        <h1 style="color: #ff6b6b; margin: 0 0 10px 0; font-size: 2.5em;">⚠️ Boot Failed</h1>
                        <p style="color: #d0d0d0; font-size: 1.2em; margin: 0 0 30px 0;">Agent initialization encountered an error</p>
                    </div>

                    <div style="background: rgba(0,0,0,0.4); padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff6b6b;">
                        <h3 style="color: #ff6b6b; margin: 0 0 10px 0; font-size: 1.1em;">Error Message:</h3>
                        <p style="color: #fff; margin: 0; font-family: 'Monaco', 'Courier New', monospace;">${error.message}</p>
                    </div>

                    <details style="margin-bottom: 30px;">
                        <summary style="color: #4ec9b0; cursor: pointer; padding: 10px; background: rgba(78, 201, 176, 0.1); border-radius: 4px; user-select: none;">
                            📋 View Stack Trace
                        </summary>
                        <pre style="margin-top: 10px; padding: 20px; background: rgba(0,0,0,0.6); border-radius: 4px; color: #d0d0d0; overflow-x: auto; font-size: 0.85em; border: 1px solid #333;">${error.stack || 'No stack trace available'}</pre>
                    </details>

                    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="location.reload()" style="padding: 12px 24px; background: linear-gradient(135deg, #4ec9b0, #2ea78c); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 1em; font-weight: 600; box-shadow: 0 4px 12px rgba(78, 201, 176, 0.3); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            🔄 Reload and Retry
                        </button>
                        <button onclick="localStorage.clear(); location.reload()" style="padding: 12px 24px; background: linear-gradient(135deg, #ff6b6b, #ee5555); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 1em; font-weight: 600; box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            🗑️ Clear Cache & Reset
                        </button>
                    </div>

                    <div style="margin-top: 30px; padding: 15px; background: rgba(78, 201, 176, 0.05); border-radius: 6px; border-left: 3px solid #4ec9b0;">
                        <p style="color: #4ec9b0; margin: 0; font-size: 0.9em;">
                            💡 <strong>Tip:</strong> Check the browser console (F12) for detailed logs. If the problem persists, try clearing your browser cache or using a different boot mode.
                        </p>
                    </div>
                </div>
            `;
        }
    }
}

// Legacy openConfigModal function removed - now using inline model picker

// Expose selectBootMode globally for inline onclick handlers
window.selectBootMode = function(mode) {
    console.log('[Boot] Boot mode selected:', mode);
    localStorage.setItem('BOOT_MODE', mode);

    // Update visual selection
    document.querySelectorAll('.boot-mode-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('selected');
};

// Expose module directory functions globally
window.showModuleDirectory = async function() {
    const modal = document.getElementById('directory-modal');
    const content = document.getElementById('directory-content');

    if (!modal || !content) return;

    // Show loading state
    content.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">Loading blueprints...</div>';
    modal.classList.remove('hidden');

    try {
        // Fetch blueprints list from the server
        const response = await fetch('/blueprints/', {
            headers: { 'Accept': 'text/html' }
        });

        if (!response.ok) {
            throw new Error('Failed to load blueprints');
        }

        const html = await response.text();

        // Parse the directory listing to extract blueprint names
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a')).filter(a => a.href.includes('.md'));

        if (links.length === 0) {
            content.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">No blueprints found</div>';
            return;
        }

        // Create blueprint list
        let modulesHTML = '<div class="module-list">';

        links.forEach((link, index) => {
            const filename = link.textContent.trim();
            const name = filename.replace(/^0x[0-9A-F]+-/, '').replace(/\.md$/, '').replace(/-/g, ' ');
            const capitalizedName = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            modulesHTML += `
                <div class="module-item">
                    <div class="module-number">${String(index + 1).padStart(3, '0')}</div>
                    <div class="module-info">
                        <div class="module-name">${capitalizedName}</div>
                        <div class="module-file">${filename}</div>
                    </div>
                </div>
            `;
        });

        modulesHTML += '</div>';
        content.innerHTML = modulesHTML;

    } catch (error) {
        console.error('[Boot] Error loading blueprints:', error);
        content.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <div style="color: #e74856; margin-bottom: 10px;">Failed to load blueprints</div>
                <div style="color: #888; font-size: 12px;">${error.message}</div>
            </div>
        `;
    }
};

window.closeDirectoryModal = function() {
    const modal = document.getElementById('directory-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.closeInfoCard = function() {
    const overlay = document.getElementById('info-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
};

// Start the application
main();