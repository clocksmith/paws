// New boot script for persona-based onboarding
import { state, elements } from './boot/state.js';
import { loadStoredKeys } from './boot/config.js';
import { checkAPIStatus } from './boot/api.js';
import { closeHelpPopover } from './boot/ui.js';
import { initModelConfig, hasModelsConfigured } from './boot/model-config.js';

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
    // Legacy mode card handlers removed - now using inline model picker from model-config.js

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

    // Legacy proxy-based mode handlers removed - now using inline model picker
}

// Legacy updateCurrentModeDisplay function removed - status now managed by model-config.js

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

// Start the application
main();