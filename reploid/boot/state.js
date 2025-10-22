// State management for boot process
export const state = {
    selectedMode: null,
    selectedProvider: null,
    detectedEnv: {
        hasServer: false,
        hasOllama: false,
        hasWebGPU: false,
        providers: []
    },
    activePopover: null,
    // New: Available models from ModelRegistry
    availableModels: {
        cloud: [],
        ollama: [],
        webllm: [],
        metadata: {}
    },
    // New: User-selected models configuration
    selectedModels: [],
    // New: Consensus strategy (if multiple models)
    consensusStrategy: 'arena',
    // New: Provider API keys tracking (for reuse)
    configuredKeys: {
        gemini: null,
        openai: null,
        anthropic: null
    }
};

export const elements = {
    configBtn: document.getElementById('config-btn'),
    configModal: document.getElementById('config-modal'),
    closeModal: document.getElementById('close-modal'),
    providerStatus: document.getElementById('provider-status'),
    providerStatusDetail: document.getElementById('provider-status-detail'),
    proxyChip: document.getElementById('agent-chip-proxy'),
    providerChip: document.getElementById('agent-chip-provider'),
    helpPopover: document.getElementById('help-popover'),
    helpPopoverClose: document.querySelector('.help-popover-close'),
    goalInput: document.getElementById('goal-input'),
    awakenBtn: document.getElementById('awaken-btn')
};
