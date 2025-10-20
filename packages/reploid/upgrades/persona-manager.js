/**
 * @fileoverview Persona Manager Module for REPLOID
 * Implements Project Phoenix Feature 2.3: Elevate Personas to First-Class Objects
 *
 * This module manages persona lifecycle, switching, and configuration,
 * providing a centralized system for persona management and observability.
 *
 * @module PersonaManager
 * @version 1.0.0
 * @category core
 * @blueprint 0x00004B (Project Phoenix - Persona Management)
 */

const PersonaManager = {
  metadata: {
    id: 'PersonaManager',
    version: '1.0.0',
    dependencies: ['Utils', 'Config', 'EventBus'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, Config, EventBus } = deps;
    const { logger } = Utils;

    // State
    let _personas = new Map(); // id -> persona instance
    let _activePersonaId = null;
    let _personaSwitchCount = 0;
    let _lastSwitchTime = null;

    /**
     * Load a persona module dynamically
     * @param {string} personaName - Name of the persona file (e.g., 'code-refactorer-persona')
     * @returns {Promise<Object>} Loaded persona module
     */
    const loadPersonaModule = async (personaName) => {
      try {
        const module = await import(`/personas/${personaName}.js`);
        return module.default;
      } catch (error) {
        logger.error(`[PersonaManager] Failed to load persona: ${personaName}`, error);
        throw error;
      }
    };

    /**
     * Initialize a persona instance
     * @param {Object} personaModule - Persona module definition
     * @returns {Object} Persona instance
     */
    const initializePersona = (personaModule) => {
      if (!personaModule || !personaModule.factory) {
        throw new Error('Invalid persona module: missing factory');
      }

      const instance = personaModule.factory();
      logger.info('[PersonaManager] Initialized persona', {
        id: personaModule.metadata.id
      });

      return {
        metadata: personaModule.metadata,
        ...instance
      };
    };

    /**
     * Load all available personas from config
     * @returns {Promise<void>}
     */
    const loadPersonas = async () => {
      try {
        logger.info('[PersonaManager] Loading personas from config...');

        const personaConfigs = Config.get('personas', []);
        const loadedPersonas = [];

        // Load persona modules for configs that specify a persona property
        for (const config of personaConfigs) {
          if (config.persona) {
            try {
              const personaModule = await loadPersonaModule(config.persona);
              const instance = initializePersona(personaModule);

              _personas.set(personaModule.metadata.id, {
                instance,
                config
              });

              loadedPersonas.push(personaModule.metadata.id);
            } catch (error) {
              logger.warn(`[PersonaManager] Failed to load persona: ${config.persona}`, error);
            }
          }
        }

        // Set default active persona from structuredCycle config
        const defaultPersonaName = Config.get('structuredCycle.defaultPersona');
        if (defaultPersonaName && _personas.has(defaultPersonaName)) {
          _activePersonaId = defaultPersonaName;
          logger.info(`[PersonaManager] Set default persona: ${defaultPersonaName}`);
        } else if (loadedPersonas.length > 0) {
          _activePersonaId = loadedPersonas[0];
          logger.info(`[PersonaManager] Set first loaded persona as active: ${_activePersonaId}`);
        }

        logger.info('[PersonaManager] Loaded personas', {
          count: _personas.size,
          active: _activePersonaId,
          personas: loadedPersonas
        });

        EventBus.emit('persona:loaded', {
          personas: Array.from(_personas.keys()),
          active: _activePersonaId
        });
      } catch (error) {
        logger.error('[PersonaManager] Failed to load personas:', error);
        throw error;
      }
    };

    /**
     * Get active persona instance
     * @returns {Object|null} Active persona or null
     */
    const getActivePersona = () => {
      if (!_activePersonaId) return null;
      const entry = _personas.get(_activePersonaId);
      return entry ? entry.instance : null;
    };

    /**
     * Switch to a different persona
     * @param {string} personaId - ID of persona to activate
     */
    const switchPersona = (personaId) => {
      if (!_personas.has(personaId)) {
        throw new Error(`Persona not found: ${personaId}`);
      }

      const previousId = _activePersonaId;
      _activePersonaId = personaId;
      _personaSwitchCount++;
      _lastSwitchTime = Date.now();

      logger.info('[PersonaManager] Switched persona', {
        from: previousId,
        to: personaId
      });

      EventBus.emit('persona:switched', {
        previous: previousId,
        current: personaId,
        timestamp: _lastSwitchTime
      });
    };

    /**
     * Get all loaded personas
     * @returns {Array} Array of persona metadata
     */
    const getAllPersonas = () => {
      return Array.from(_personas.entries()).map(([id, entry]) => ({
        id,
        metadata: entry.instance.metadata,
        config: entry.config,
        isActive: id === _activePersonaId
      }));
    };

    /**
     * Get persona by ID
     * @param {string} personaId - Persona identifier
     * @returns {Object|null} Persona instance or null
     */
    const getPersona = (personaId) => {
      const entry = _personas.get(personaId);
      return entry ? entry.instance : null;
    };

    /**
     * Get manager statistics
     * @returns {Object} Manager stats
     */
    const getStats = () => {
      return {
        totalPersonas: _personas.size,
        activePersona: _activePersonaId,
        switchCount: _personaSwitchCount,
        lastSwitchTime: _lastSwitchTime
      };
    };

    return {
      init: loadPersonas,

      api: {
        getActivePersona,
        getAllPersonas,
        getPersona,
        switchPersona,
        getStats
      },

      // Widget interface for module dashboard
      widget: (() => {
        class PersonaManagerWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();

            // Subscribe to persona events
            this._switchedListener = () => this.render();
            this._loadedListener = () => this.render();

            EventBus.on('persona:switched', this._switchedListener, 'PersonaManagerWidget');
            EventBus.on('persona:loaded', this._loadedListener, 'PersonaManagerWidget');

            // Poll periodically for changes
            this._interval = setInterval(() => this.render(), 3000);
          }

          disconnectedCallback() {
            if (this._interval) {
              clearInterval(this._interval);
            }
            if (this._switchedListener) {
              EventBus.off('persona:switched', this._switchedListener);
            }
            if (this._loadedListener) {
              EventBus.off('persona:loaded', this._loadedListener);
            }
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const activePersona = getActivePersona();

            return {
              state: activePersona ? 'active' : 'warning',
              primaryMetric: activePersona ? activePersona.metadata.id : 'None',
              secondaryMetric: `${_personas.size} available`,
              lastActivity: _lastSwitchTime
            };
          }

          render() {
            const stats = getStats();
            const personas = getAllPersonas();
            const activePersona = getActivePersona();

            const formatTime = (timestamp) => {
              if (!timestamp) return 'Never';
              return new Date(timestamp).toLocaleString();
            };

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  font-family: monospace;
                  color: #e0e0e0;
                }
                .persona-manager-panel {
                  padding: 12px;
                  background: #1a1a1a;
                  border-radius: 4px;
                }
                h4 {
                  margin: 0 0 12px 0;
                  font-size: 14px;
                  color: #4fc3f7;
                }
                h5 {
                  margin: 12px 0 8px 0;
                  font-size: 13px;
                  color: #aaa;
                }
                .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 8px;
                  margin-bottom: 12px;
                }
                .stat-card {
                  padding: 8px;
                  background: #252525;
                  border-radius: 3px;
                  border: 1px solid #333;
                }
                .stat-label {
                  font-size: 11px;
                  color: #888;
                  margin-bottom: 4px;
                }
                .stat-value {
                  font-size: 16px;
                  font-weight: bold;
                  color: #4fc3f7;
                }
                .active-persona {
                  background: #252525;
                  border: 1px solid #333;
                  border-radius: 3px;
                  padding: 8px;
                  margin-bottom: 12px;
                }
                .persona-header {
                  display: flex;
                  align-items: center;
                }
                .persona-prompt {
                  margin-top: 8px;
                  padding: 8px;
                  background: rgba(255,255,255,0.05);
                  border-radius: 4px;
                  font-style: italic;
                  color: #aaa;
                  max-height: 100px;
                  overflow-y: auto;
                  font-size: 11px;
                }
                .active-mindsets {
                  margin-top: 8px;
                  font-size: 11px;
                }
                .mindset-tag {
                  padding: 3px 8px;
                  background: rgba(100,150,255,0.2);
                  border-radius: 3px;
                  font-size: 10px;
                  display: inline-block;
                  margin: 2px;
                }
                .personas-list {
                  max-height: 300px;
                  overflow-y: auto;
                }
                .persona-item {
                  padding: 10px;
                  background: rgba(255,255,255,0.03);
                  border-radius: 6px;
                  margin-bottom: 8px;
                  border-left: 3px solid transparent;
                }
                .persona-item.active {
                  background: rgba(255,255,255,0.08);
                  border-left-color: #4fc3f7;
                }
                .persona-item-content {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                }
                .persona-desc {
                  color: #888;
                  font-size: 11px;
                  margin-top: 4px;
                }
                .active-badge {
                  padding: 4px 10px;
                  background: rgba(79,195,247,0.2);
                  border-radius: 4px;
                  font-size: 10px;
                  color: #4fc3f7;
                }
                button {
                  padding: 4px 12px;
                  background: rgba(100,150,255,0.3);
                  border: none;
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                  font-size: 11px;
                  font-family: monospace;
                }
                button:hover {
                  background: rgba(100,150,255,0.5);
                }
                .info-box {
                  margin-top: 16px;
                  padding: 12px;
                  background: rgba(100,150,255,0.1);
                  border-left: 3px solid #6496ff;
                  border-radius: 4px;
                }
                .info-box strong {
                  color: #6496ff;
                }
                .info-box div {
                  margin-top: 6px;
                  color: #aaa;
                  font-size: 11px;
                }
                p {
                  margin: 8px 0;
                  font-size: 12px;
                }
              </style>
              <div class="persona-manager-panel">
                <h4>⬡ Persona Manager</h4>

                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Total Personas</div>
                    <div class="stat-value">${stats.totalPersonas}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Active</div>
                    <div class="stat-value" style="font-size: 14px;">${stats.activePersona || 'None'}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Switches</div>
                    <div class="stat-value">${stats.switchCount}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Last Switch</div>
                    <div class="stat-value" style="font-size: 13px;">${formatTime(stats.lastSwitchTime)}</div>
                  </div>
                </div>

                ${activePersona ? `
                  <h5>Active Persona</h5>
                  <div class="active-persona">
                    <div class="persona-header">
                      <strong style="color: #4fc3f7;">${activePersona.metadata.id}</strong>
                      <span style="color: #888; margin-left: 8px;">v${activePersona.metadata.version}</span>
                    </div>
                    ${activePersona.getSystemPromptFragment ? `
                      <div class="persona-prompt">
                        "${activePersona.getSystemPromptFragment().substring(0, 200)}..."
                      </div>
                    ` : ''}
                    ${activePersona.getActiveMindsets ? `
                      <div class="active-mindsets">
                        <strong>Active Mindsets:</strong>
                        <div style="margin-top: 4px;">
                          ${activePersona.getActiveMindsets().slice(0, 5).map(mind => `
                            <span class="mindset-tag">${mind}</span>
                          `).join('')}
                          ${activePersona.getActiveMindsets().length > 5 ? `<span style="color: #888; font-size: 10px;">+${activePersona.getActiveMindsets().length - 5} more</span>` : ''}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                ` : '<p style="color: #888; font-style: italic;">No active persona</p>'}

                <h5>Available Personas (${personas.length})</h5>
                <div class="personas-list">
                  ${personas.map(persona => `
                    <div class="persona-item ${persona.isActive ? 'active' : ''}" data-persona-id="${persona.id}">
                      <div class="persona-item-content">
                        <div>
                          <strong style="color: ${persona.isActive ? '#4fc3f7' : '#fff'};">
                            ${persona.isActive ? '● ' : '○ '}${persona.metadata.id}
                          </strong>
                          <div class="persona-desc">
                            ${persona.config.description || 'No description'}
                          </div>
                        </div>
                        ${persona.isActive ? `
                          <span class="active-badge">ACTIVE</span>
                        ` : `
                          <button class="switch-persona">Switch</button>
                        `}
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="info-box">
                  <strong>ⓘ Project Phoenix - First-Class Personas</strong>
                  <div>
                    Personas are powerful behavioral overlays that customize the agent's
                    system prompt, tool prioritization, and lifecycle hooks.
                    Each persona can have its own widget providing detailed observability.
                  </div>
                </div>
              </div>
            `;

            // Attach event listeners for persona switching
            personas.forEach(persona => {
              if (!persona.isActive) {
                const personaItem = this.shadowRoot.querySelector(`.persona-item[data-persona-id="${persona.id}"]`);
                const switchBtn = personaItem?.querySelector('.switch-persona');
                switchBtn?.addEventListener('click', () => {
                  try {
                    switchPersona(persona.id);
                    const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                    ToastNotifications?.show?.(`Switched to ${persona.metadata.id}`, 'success');
                  } catch (error) {
                    const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                    ToastNotifications?.show?.('Persona switch failed: ' + error.message, 'error');
                  }
                });
              }
            });
          }
        }

        if (!customElements.get('persona-manager-widget')) {
          customElements.define('persona-manager-widget', PersonaManagerWidget);
        }

        return {
          element: 'persona-manager-widget',
          displayName: 'Persona Manager',
          icon: '⬡',
          category: 'persona',
          order: 10
        };
      })()
    };
  }
};

// Register with module registry if available
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(PersonaManager);
}

export default PersonaManager;
