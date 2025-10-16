// New boot script for persona-based onboarding
import { state, elements } from './boot/state.js';
import { loadStoredKeys, saveAPIKeys, updateModelUI } from './boot/config.js';
import { checkAPIStatus, populateOllamaModels } from './boot/api.js';
import { closeHelpPopover, openHelpPopover, showBootMessage, switchModalTab, syncMultiModelControls } from './boot/ui.js';
import { backToModes, highlightStoredMode, selectMode, showModeHelp, showModeRecommendation, saveModeConfiguration } from './boot/modes.js';

// This is the main entry point for the application.
async function main() {
    // Initial setup
    loadStoredKeys();
    await checkAPIStatus();
    highlightStoredMode();

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    elements.configBtn.addEventListener('click', openConfigModal);
    elements.closeModal.addEventListener('click', () => elements.configModal.classList.add('hidden'));
    elements.saveKeysBtn.addEventListener('click', saveAPIKeys);
    elements.modelSelect.addEventListener('change', (e) => updateModelUI(e.target.value));

    elements.multiModelToggle.addEventListener('change', (e) => syncMultiModelControls(e.target.checked));

    // New mode-based UI listeners
    elements.backToModesBtn.addEventListener('click', backToModes);

    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => switchModalTab(tab.dataset.modalTab));
    });

    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('help-icon')) {
                showModeHelp(card.dataset.mode, e.target);
            } else {
                selectMode(card.dataset.mode, state.detectedEnv);
            }
        });
    });
    
    const saveButton = document.getElementById('save-mode-btn');
    if(saveButton) {
        saveButton.addEventListener('click', saveModeConfiguration);
    }

    if (elements.helpPopoverClose) {
        elements.helpPopoverClose.addEventListener('click', closeHelpPopover);
    }

    document.addEventListener('click', (e) => {
        if (state.activePopover && !elements.helpPopover.contains(e.target) && !state.activePopover.anchorEl.contains(e.target)) {
            closeHelpPopover();
        }
    });
}

async function openConfigModal() {
    loadStoredKeys();
    await populateOllamaModels();
    closeHelpPopover();
    if (elements.configModal) {
        elements.configModal.classList.remove('hidden');
    }
    await showModeRecommendation();
    state.selectedMode = null;
    state.selectedProvider = null;
    highlightStoredMode();
}

// Start the application
main();