// UI management functions
import { state, elements } from './state.js';

export function showBootMessage(message, type = 'info') {
    console.log(`[Boot] ${type.toUpperCase()}: ${message}`);
}

export function switchModalTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.modal-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active from all tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const selectedContent = document.getElementById(`modal-${tabName}-tab`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }

    // Activate selected tab button
    const selectedTab = document.querySelector(`.modal-tab[data-modal-tab="${tabName}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

export function syncMultiModelControls(enabled) {
    console.log('[UI] Multi-model toggle:', enabled);
    localStorage.setItem('ENABLE_PAXOS', enabled ? 'true' : 'false');
}

export function openHelpPopover(content, anchorEl) {
    if (!elements.helpPopover) return;

    const helpBody = document.getElementById('help-popover-body');
    if (helpBody) {
        helpBody.innerHTML = content;
    }

    elements.helpPopover.classList.remove('hidden');
    elements.helpPopover.setAttribute('aria-hidden', 'false');

    // Position popover near the anchor element
    if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        elements.helpPopover.style.position = 'absolute';
        elements.helpPopover.style.top = `${rect.bottom + 10}px`;
        elements.helpPopover.style.left = `${rect.left}px`;
    }

    state.activePopover = { anchorEl };
}

export function closeHelpPopover() {
    if (!elements.helpPopover) return;

    elements.helpPopover.classList.add('hidden');
    elements.helpPopover.setAttribute('aria-hidden', 'true');
    state.activePopover = null;
}

export async function showModeRecommendation() {
    const recommendation = document.getElementById('mode-recommendation');
    const recommendationText = document.getElementById('recommendation-text');

    if (!recommendation || !recommendationText) return;

    let message = '';

    if (state.detectedEnv.hasServer && state.detectedEnv.hasOllama) {
        message = 'You have the proxy server and Ollama running. We recommend the <strong>Local (Ollama)</strong> or <strong>Hybrid</strong> mode for a free, privacy-focused setup.';
    } else if (state.detectedEnv.hasServer) {
        message = 'You have the proxy server running. We recommend <strong>Cloud Provider</strong> mode to use powerful AI models via API keys.';
    } else if (state.detectedEnv.hasWebGPU) {
        message = 'Your browser supports WebGPU. We recommend <strong>Web LLM</strong> mode for client-side AI inference.';
    } else {
        message = 'We recommend <strong>Cloud Provider</strong> mode with an API key, or install Ollama for free local models.';
    }

    recommendationText.innerHTML = message;
    recommendation.classList.remove('hidden');
}

export function closeConfigModal() {
    if (elements.configModal) {
        elements.configModal.classList.add('hidden');
    }
}
