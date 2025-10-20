// New boot script for persona-based onboarding
import { state, elements } from './boot/state.js';
import { loadStoredKeys } from './boot/config.js';
import { checkAPIStatus } from './boot/api.js';
import { closeHelpPopover } from './boot/ui.js';

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

    // Load stored mode or set default
    const storedMode = localStorage.getItem('DEPLOYMENT_MODE');
    if (storedMode) {
        updateCurrentModeDisplay(storedMode);
        state.selectedMode = storedMode;
    } else {
        // Default to cloud mode if we have a provider available
        if (state.detectedEnv.hasServer && state.detectedEnv.providers && state.detectedEnv.providers.length > 0) {
            const defaultMode = 'cloud';
            localStorage.setItem('DEPLOYMENT_MODE', defaultMode);
            updateCurrentModeDisplay(defaultMode);
            state.selectedMode = defaultMode;
        }
    }

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    elements.configBtn.addEventListener('click', openConfigModal);
    elements.closeModal.addEventListener('click', () => elements.configModal.classList.add('hidden'));

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
        // Initially disable the button
        elements.awakenBtn.disabled = true;

        // Enable/disable button based on goal input
        elements.goalInput.addEventListener('input', (e) => {
            const hasGoal = e.target.value.trim().length > 0;
            elements.awakenBtn.disabled = !hasGoal;
        });

        // Handle Awaken Agent button click
        elements.awakenBtn.addEventListener('click', awakenAgent);
    }

    // Global auto-approve toggle (in settings modal)
    const autoApproveToggle = document.getElementById('auto-approve-toggle');
    if (autoApproveToggle) {
        // Load saved state
        const globalAutoApprove = localStorage.getItem('GLOBAL_AUTO_APPROVE') === 'true';
        autoApproveToggle.checked = globalAutoApprove;

        // Show info if enabled
        const autoApproveInfo = document.getElementById('auto-approve-info');
        if (autoApproveInfo) {
            autoApproveInfo.classList.toggle('hidden', !globalAutoApprove);
        }

        // Handle toggle change
        autoApproveToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('GLOBAL_AUTO_APPROVE', enabled);

            // Update config.json in memory (will be persisted on next save)
            if (typeof globalThis.config !== 'undefined') {
                if (!globalThis.config.curatorMode) {
                    globalThis.config.curatorMode = {};
                }
                globalThis.config.curatorMode.enabled = enabled;
                globalThis.config.curatorMode.autoApproveContext = enabled;
            }

            // Show/hide info message
            if (autoApproveInfo) {
                autoApproveInfo.classList.toggle('hidden', !enabled);
            }

            console.log('[Boot] Global auto-approve:', enabled);
        });
    }

    // Session auto-approve toggle (in Sentinel card - will be set up by UI manager)
    const sessionAutoApproveToggle = document.getElementById('session-auto-approve-toggle');
    if (sessionAutoApproveToggle) {
        // Load saved state
        const sessionAutoApprove = localStorage.getItem('SESSION_AUTO_APPROVE') === 'true';
        sessionAutoApproveToggle.checked = sessionAutoApprove;

        // Handle toggle change
        sessionAutoApproveToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('SESSION_AUTO_APPROVE', enabled);
            console.log('[Boot] Session auto-approve:', enabled);
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
        return;
    }

    console.log('[Boot] Awakening agent with goal:', goal);

    // Check if we have a valid configuration
    if (!state.detectedEnv.hasServer && !state.detectedEnv.hasWebGPU) {
        alert('No AI provider available. Please configure Cloud Provider (with API key) or enable Web LLM mode.');
        return;
    }

    try {
        // Hide boot container and show app root
        const bootContainer = document.getElementById('boot-container');
        const appRoot = document.getElementById('app-root');

        if (bootContainer && appRoot) {
            bootContainer.style.display = 'none';
            appRoot.style.display = 'block';
        }

        // Show awakening message
        if (appRoot) {
            appRoot.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #e0e0e0;">
                    <h2>Agent Awakening</h2>
                    <p>Goal: ${goal}</p>
                    <p style="margin-top: 20px; color: #4ec9b0;">
                        Awakening agent system...
                    </p>
                </div>
            `;
        }

        // Create VFS that fetches files from the server
        const vfs = {
            read: async (path) => {
                console.log(`[VFS] Reading: ${path}`);
                try {
                    // Remove leading slash for fetch
                    const fetchPath = path.startsWith('/') ? path.substring(1) : path;
                    // Add cache-busting parameter
                    const cacheBust = `${fetchPath}?t=${Date.now()}`;
                    const response = await fetch(cacheBust);

                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
                    }

                    const content = await response.text();
                    console.log(`[VFS] Loaded: ${path} (${content.length} bytes)`);
                    return content;
                } catch (error) {
                    console.error(`[VFS] Error reading ${path}:`, error);
                    throw error;
                }
            }
        };

        // Load app-logic.js
        console.log('[Boot] Loading app-logic.js...');
        const appLogicCode = await vfs.read('/upgrades/app-logic.js');
        console.log('[Boot] app-logic.js loaded, size:', appLogicCode.length);

        // Execute app-logic.js to get the CoreLogicModule function
        console.log('[Boot] Executing app-logic.js...');
        const CoreLogicModule = new Function(appLogicCode + '\nreturn CoreLogicModule;')();
        console.log('[Boot] CoreLogicModule extracted:', typeof CoreLogicModule);

        // Get selected boot mode (module preset)
        const bootMode = localStorage.getItem('BOOT_MODE') || 'minimal';
        console.log('[Boot] Boot mode:', bootMode);

        // Prepare initial configuration
        const initialConfig = {
            goal: goal,
            mode: state.selectedMode || 'cloud',
            bootMode: bootMode,  // Pass boot mode to determine which modules to load
            persona: {
                id: 'code_refactorer'  // Default persona
            }
        };

        console.log('[Boot] Initializing agent system with config:', initialConfig);

        // Initialize the agent system
        console.log('[Boot] Calling CoreLogicModule...');
        await CoreLogicModule(initialConfig, vfs);

        console.log('[Boot] Agent system awakened successfully');

    } catch (error) {
        console.error('[Boot] Failed to awaken agent:', error);

        // Show error in UI
        const appRoot = document.getElementById('app-root');
        if (appRoot) {
            appRoot.style.display = 'block';
            appRoot.innerHTML = `
                <div style="padding: 40px; color: #ff6b6b;">
                    <h2>Agent Awakening Failed</h2>
                    <p style="margin-top: 20px;">Error: ${error.message}</p>
                    <pre style="margin-top: 20px; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 4px; text-align: left; overflow-x: auto;">${error.stack}</pre>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #4ec9b0; color: #1e1e1e; border: none; border-radius: 4px; cursor: pointer;">
                        Reload and Try Again
                    </button>
                </div>
            `;
        }
    }
}

async function openConfigModal() {
    closeHelpPopover();
    if (elements.configModal) {
        elements.configModal.classList.remove('hidden');
    }

    // Highlight currently selected mode
    const currentMode = localStorage.getItem('DEPLOYMENT_MODE');
    if (currentMode) {
        document.querySelectorAll('.mode-card').forEach(card => {
            if (card.dataset.mode === currentMode) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }
}

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

// Start the application
main();