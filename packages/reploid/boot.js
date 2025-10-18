// New boot script for persona-based onboarding
import { state, elements } from './boot/state.js';
import { loadStoredKeys } from './boot/config.js';
import { checkAPIStatus } from './boot/api.js';
import { closeHelpPopover } from './boot/ui.js';

// This is the main entry point for the application.
async function main() {
    // Initial setup
    loadStoredKeys();
    await checkAPIStatus();

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

    // Goal input and Launch Agent button
    if (elements.goalInput && elements.awakenBtn) {
        // Initially disable the button
        elements.awakenBtn.disabled = true;

        // Enable/disable button based on goal input
        elements.goalInput.addEventListener('input', (e) => {
            const hasGoal = e.target.value.trim().length > 0;
            elements.awakenBtn.disabled = !hasGoal;
        });

        // Handle Launch Agent button click
        elements.awakenBtn.addEventListener('click', launchAgent);
    }
}

function updateCurrentModeDisplay(modeName) {
    const modeInfo = {
        cloud: { icon: '▲', title: 'Cloud Provider' },
        local: { icon: '■', title: 'Local (Ollama)' },
        'web-llm': { icon: '◆', title: 'Web LLM (WebGPU)' },
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

async function launchAgent() {
    const goal = elements.goalInput?.value?.trim();

    if (!goal) {
        console.warn('[Boot] No goal specified');
        return;
    }

    console.log('[Boot] Launching agent with goal:', goal);

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

        // Show loading message
        if (appRoot) {
            appRoot.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #e0e0e0;">
                    <h2>Agent Initialization</h2>
                    <p>Goal: ${goal}</p>
                    <p style="margin-top: 20px; color: #4ec9b0;">
                        Loading agent system...
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

        // Execute app-logic.js to get the CoreLogicModule function
        const CoreLogicModule = new Function(appLogicCode + '\nreturn CoreLogicModule;')();

        // Prepare initial configuration
        const initialConfig = {
            goal: goal,
            mode: state.selectedMode || 'cloud',
            persona: {
                id: 'code_refactorer'  // Default persona
            }
        };

        console.log('[Boot] Initializing agent system with config:', initialConfig);

        // Initialize the agent system
        await CoreLogicModule(initialConfig, vfs);

        console.log('[Boot] Agent system initialized successfully');

    } catch (error) {
        console.error('[Boot] Failed to launch agent:', error);

        // Show error in UI
        const appRoot = document.getElementById('app-root');
        if (appRoot) {
            appRoot.style.display = 'block';
            appRoot.innerHTML = `
                <div style="padding: 40px; color: #ff6b6b;">
                    <h2>Agent Launch Failed</h2>
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

// Start the application
main();