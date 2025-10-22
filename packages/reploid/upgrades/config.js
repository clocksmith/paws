/**
 * @fileoverview Centralized Configuration Module for REPLOID
 * Implements Project Phoenix Feature 1.3: Centralize and Type-Guard Configuration
 *
 * This module serves as the single source of truth for all agent configuration,
 * loading and validating config.json at initialization and providing read-only
 * access to configuration values through the DI container.
 *
 * @module Config
 * @version 1.0.0
 * @category core
 * @blueprint 0x00004A (Project Phoenix - Centralized Config)
 */

const Config = {
  metadata: {
    id: 'Config',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils } = deps;
    const { logger, ConfigError } = Utils;

    // Loaded configuration object
    let _config = null;
    let _loadTime = null;

    /**
     * Configuration schema definition
     * Defines required fields and types for validation
     */
    const SCHEMA = {
      personas: 'array',
      minimalRSICore: 'array',
      defaultCore: 'array',
      upgrades: 'array',
      blueprints: 'array',
      providers: 'object',
      curatorMode: 'object',
      webrtc: 'object',
      structuredCycle: 'object'
    };

    /**
     * Validate configuration object against schema
     * @param {Object} config - Configuration to validate
     * @throws {ConfigError} If validation fails
     */
    const validateConfig = (config) => {
      if (!config || typeof config !== 'object') {
        throw new ConfigError('Configuration must be an object');
      }

      const errors = [];

      // Check required fields
      for (const [field, expectedType] of Object.entries(SCHEMA)) {
        if (!(field in config)) {
          errors.push(`Missing required field: ${field}`);
          continue;
        }

        const actualType = Array.isArray(config[field]) ? 'array' : typeof config[field];
        if (actualType !== expectedType) {
          errors.push(`Field ${field} has type ${actualType}, expected ${expectedType}`);
        }
      }

      // Validate personas structure
      if (Array.isArray(config.personas)) {
        config.personas.forEach((persona, idx) => {
          if (!persona.id) errors.push(`Persona at index ${idx} missing required field: id`);
          if (!persona.name) errors.push(`Persona at index ${idx} missing required field: name`);
          if (!persona.type) errors.push(`Persona at index ${idx} missing required field: type`);
          if (!Array.isArray(persona.upgrades)) {
            errors.push(`Persona ${persona.id || idx} upgrades must be an array`);
          }
        });
      }

      // Validate upgrades structure
      if (Array.isArray(config.upgrades)) {
        config.upgrades.forEach((upgrade, idx) => {
          if (!upgrade.id) errors.push(`Upgrade at index ${idx} missing required field: id`);
          if (!upgrade.path) errors.push(`Upgrade at index ${idx} missing required field: path`);
          if (!upgrade.category) errors.push(`Upgrade at index ${idx} missing required field: category`);
        });
      }

      // Validate providers structure
      if (config.providers) {
        if (!config.providers.default) {
          errors.push('providers.default is required');
        }
      }

      if (errors.length > 0) {
        throw new ConfigError('Configuration validation failed', { errors });
      }

      logger.info('[Config] Configuration validated successfully', {
        personas: config.personas?.length || 0,
        upgrades: config.upgrades?.length || 0,
        blueprints: config.blueprints?.length || 0
      });
    };

    /**
     * Deep merge two objects (for override support)
     * @param {Object} target - Base object
     * @param {Object} source - Override object
     * @returns {Object} Merged object
     */
    const deepMerge = (target, source) => {
      const result = { ...target };

      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }

      return result;
    };

    /**
     * Load configuration from config.json file with optional .reploidrc.json overrides
     * @returns {Promise<Object>} Loaded and validated configuration
     */
    const loadConfig = async () => {
      try {
        logger.info('[Config] Loading configuration from config.json...');

        // Fetch config.json (base configuration with defaults)
        const response = await fetch('/config.json');
        if (!response.ok) {
          throw new ConfigError('Failed to fetch config.json', {
            status: response.status,
            statusText: response.statusText
          });
        }

        let config = await response.json();

        // Attempt to load .reploidrc.json for user overrides
        try {
          logger.info('[Config] Checking for .reploidrc.json overrides...');
          const overrideResponse = await fetch('/.reploidrc.json');

          if (overrideResponse.ok) {
            const overrides = await overrideResponse.json();
            logger.info('[Config] Found .reploidrc.json, applying overrides...');
            config = deepMerge(config, overrides);
            logger.info('[Config] Overrides applied successfully');
          } else {
            logger.info('[Config] No .reploidrc.json found, using defaults from config.json');
          }
        } catch (overrideError) {
          // .reploidrc.json is optional, so this is not a fatal error
          logger.info('[Config] No user overrides found (this is normal)');
        }

        // Validate against schema
        validateConfig(config);

        _config = Object.freeze(config); // Make read-only
        _loadTime = Date.now();

        logger.info('[Config] Configuration loaded successfully', {
          timestamp: new Date(_loadTime).toISOString(),
          hasOverrides: config._hasOverrides || false
        });

        return _config;
      } catch (error) {
        logger.error('[Config] Failed to load configuration:', error);
        throw new ConfigError('Configuration load failed', {
          originalError: error.message,
          stack: error.stack
        });
      }
    };

    /**
     * Get a configuration value by path
     * @param {string} path - Dot-separated path (e.g., 'providers.default')
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value
     */
    const get = (path, defaultValue = undefined) => {
      if (!_config) {
        logger.warn('[Config] Attempted to access config before initialization');
        return defaultValue;
      }

      const parts = path.split('.');
      let current = _config;

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return defaultValue;
        }
      }

      return current;
    };

    /**
     * Get entire configuration object (read-only)
     * @returns {Object} Frozen configuration object
     */
    const getAll = () => {
      if (!_config) {
        logger.warn('[Config] Attempted to access config before initialization');
        return null;
      }
      return _config;
    };

    /**
     * Get persona configuration by ID
     * @param {string} personaId - Persona identifier
     * @returns {Object|null} Persona configuration or null
     */
    const getPersona = (personaId) => {
      const personas = get('personas', []);
      return personas.find(p => p.id === personaId) || null;
    };

    /**
     * Get upgrade configuration by ID
     * @param {string} upgradeId - Upgrade identifier (e.g., 'APPL', 'UTIL')
     * @returns {Object|null} Upgrade configuration or null
     */
    const getUpgrade = (upgradeId) => {
      const upgrades = get('upgrades', []);
      return upgrades.find(u => u.id === upgradeId) || null;
    };

    /**
     * Get blueprint configuration by ID
     * @param {string} blueprintId - Blueprint identifier (e.g., '0x000001')
     * @returns {Object|null} Blueprint configuration or null
     */
    const getBlueprint = (blueprintId) => {
      const blueprints = get('blueprints', []);
      return blueprints.find(b => b.id === blueprintId) || null;
    };

    /**
     * Check if configuration is loaded
     * @returns {boolean} True if loaded
     */
    const isLoaded = () => {
      return _config !== null;
    };

    /**
     * Get configuration metadata
     * @returns {Object} Metadata about loaded config
     */
    const getMetadata = () => {
      return {
        loaded: _config !== null,
        loadTime: _loadTime,
        personaCount: get('personas', []).length,
        upgradeCount: get('upgrades', []).length,
        blueprintCount: get('blueprints', []).length,
        defaultProvider: get('providers.default'),
        curatorModeEnabled: get('curatorMode.enabled', false),
        structuredCycleEnabled: get('structuredCycle.enabled', false)
      };
    };

    /**
     * Get permission rule for a specific tool
     * @param {string} toolName - Name of the tool (e.g., 'read', 'write', 'bash')
     * @returns {Object|null} Permission policy object or null if not found
     */
    const getPermission = (toolName) => {
      const policies = get('permissions.policies', []);
      return policies.find(p => p.tool === toolName) || null;
    };

    /**
     * Check if a tool is allowed (does not require user confirmation)
     * @param {string} toolName - Name of the tool
     * @returns {boolean} True if tool is allowed without confirmation
     */
    const isToolAllowed = (toolName) => {
      const permission = getPermission(toolName);
      return permission && permission.rule === 'allow';
    };

    /**
     * Check if a tool requires user confirmation
     * @param {string} toolName - Name of the tool
     * @returns {boolean} True if tool requires confirmation
     */
    const isToolAsk = (toolName) => {
      const permission = getPermission(toolName);
      return permission && permission.rule === 'ask';
    };

    /**
     * Check if a tool is denied
     * @param {string} toolName - Name of the tool
     * @returns {boolean} True if tool is denied
     */
    const isToolDenied = (toolName) => {
      const permission = getPermission(toolName);
      return permission && permission.rule === 'deny';
    };

    /**
     * Get server configuration
     * @returns {Object} Server config object
     */
    const getServer = () => {
      return get('server', {
        port: 8000,
        host: 'localhost',
        corsOrigins: ['http://localhost:8080']
      });
    };

    /**
     * Get API configuration
     * @returns {Object} API config object
     */
    const getApi = () => {
      return get('api', {
        provider: 'local',
        timeout: 180000,
        maxRetries: 3
      });
    };

    /**
     * Get Ollama configuration
     * @returns {Object} Ollama config object
     */
    const getOllama = () => {
      return get('ollama', {
        autoStart: false,
        defaultModel: 'gpt-oss:120b',
        temperature: 0.7
      });
    };

    /**
     * Get UI configuration
     * @returns {Object} UI config object
     */
    const getUi = () => {
      return get('ui', {
        theme: 'cyberpunk',
        showAdvancedLogs: false,
        statusUpdateInterval: 1000
      });
    };

    return {
      init: loadConfig,

      api: {
        get,
        getAll,
        getPersona,
        getUpgrade,
        getBlueprint,
        isLoaded,
        getMetadata,
        // New: Permission checking
        getPermission,
        isToolAllowed,
        isToolAsk,
        isToolDenied,
        // New: Section getters
        getServer,
        getApi,
        getOllama,
        getUi
      },

      // Web Component Widget
      widget: (() => {
        class ConfigWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
            this._interval = setInterval(() => this.render(), 5000);
          }

          disconnectedCallback() {
            if (this._interval) clearInterval(this._interval);
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const metadata = getMetadata();

            return {
              state: metadata.loaded ? 'active' : 'warning',
              primaryMetric: metadata.loaded ? 'Loaded' : 'Not loaded',
              secondaryMetric: metadata.loaded ? `${metadata.upgradeCount} upgrades` : 'Initializing',
              lastActivity: _loadTime
            };
          }

          render() {
            const metadata = getMetadata();
            const formatTime = (timestamp) => {
              if (!timestamp) return 'Never';
              return new Date(timestamp).toLocaleString();
            };

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  background: rgba(255,255,255,0.05);
                  border-radius: 8px;
                  padding: 16px;
                }
                h4 {
                  margin: 0 0 16px 0;
                  font-size: 1.4em;
                  color: #fff;
                }
                h5 {
                  margin: 16px 0 8px 0;
                  font-size: 1.1em;
                  color: #aaa;
                }
                .controls {
                  display: flex;
                  gap: 8px;
                  margin-bottom: 16px;
                }
                button {
                  padding: 6px 12px;
                  background: rgba(100,150,255,0.2);
                  border: 1px solid rgba(100,150,255,0.4);
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                  font-size: 0.9em;
                }
                button:hover {
                  background: rgba(100,150,255,0.3);
                }
                .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 8px;
                  margin-bottom: 16px;
                }
                .stat-card {
                  padding: 12px;
                  background: rgba(255,255,255,0.05);
                  border-radius: 4px;
                }
                .stat-label {
                  font-size: 0.85em;
                  color: #888;
                  margin-bottom: 4px;
                }
                .stat-value {
                  font-size: 1.3em;
                  font-weight: bold;
                }
                .stat-value.loaded { color: #0c0; }
                .stat-value.not-loaded { color: #f66; }
                .config-details {
                  background: rgba(0,0,0,0.2);
                  border-radius: 6px;
                  padding: 12px;
                  margin-bottom: 16px;
                }
                .config-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 6px 0;
                  border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .config-row:last-child {
                  border-bottom: none;
                }
                .config-label {
                  color: #888;
                }
                .config-value {
                  color: #0ff;
                  font-weight: bold;
                }
                .core-sets {
                  background: rgba(0,0,0,0.2);
                  border-radius: 6px;
                  padding: 12px;
                  margin-bottom: 16px;
                }
                .core-set {
                  padding: 6px;
                  color: #ddd;
                }
                .core-set strong {
                  color: #0ff;
                }
                .info-box {
                  margin-top: 16px;
                  padding: 12px;
                  background: rgba(100,150,255,0.1);
                  border-left: 3px solid #6496ff;
                  border-radius: 4px;
                }
                .info-text {
                  margin-top: 6px;
                  color: #aaa;
                  font-size: 0.9em;
                }
                .not-loaded-message {
                  color: #888;
                  font-style: italic;
                  padding: 20px;
                  text-align: center;
                }
              </style>

              <div class="config-panel">
                <h4>⚙ Configuration</h4>

                <div class="controls">
                  <button class="reload-config">↻ Reload</button>
                </div>

                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Status</div>
                    <div class="stat-value ${metadata.loaded ? 'loaded' : 'not-loaded'}">
                      ${metadata.loaded ? 'Loaded' : 'Not Loaded'}
                    </div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Personas</div>
                    <div class="stat-value">${metadata.personaCount}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Upgrades</div>
                    <div class="stat-value">${metadata.upgradeCount}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Blueprints</div>
                    <div class="stat-value">${metadata.blueprintCount}</div>
                  </div>
                </div>

                ${metadata.loaded ? `
                  <h5>Configuration Details</h5>
                  <div class="config-details">
                    <div class="config-row">
                      <span class="config-label">Loaded At:</span>
                      <span class="config-value">${formatTime(metadata.loadTime)}</span>
                    </div>
                    <div class="config-row">
                      <span class="config-label">Default Provider:</span>
                      <span class="config-value">${metadata.defaultProvider}</span>
                    </div>
                    <div class="config-row">
                      <span class="config-label">Curator Mode:</span>
                      <span class="config-value">${metadata.curatorModeEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div class="config-row">
                      <span class="config-label">Structured Cycle:</span>
                      <span class="config-value">${metadata.structuredCycleEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>

                  <h5>Core Module Sets</h5>
                  <div class="core-sets">
                    <div class="core-set">
                      <strong>Minimal RSI:</strong> ${get('minimalRSICore', []).length} modules
                    </div>
                    <div class="core-set">
                      <strong>Default Core:</strong> ${get('defaultCore', []).length} modules
                    </div>
                    <div class="core-set">
                      <strong>Visual RSI:</strong> ${get('visualRSICore', []).length} modules
                    </div>
                    <div class="core-set">
                      <strong>Multi-Provider:</strong> ${get('multiProviderCore', []).length} modules
                    </div>
                  </div>
                ` : `
                  <p class="not-loaded-message">Configuration not yet loaded</p>
                `}

                <div class="info-box">
                  <strong>ⓘ Project Phoenix - Centralized Config</strong>
                  <div class="info-text">
                    This module provides centralized, validated configuration management.
                    Config is loaded from config.json and exposed as read-only via DI.
                    To modify config, the agent must use write_artifact and restart.
                  </div>
                </div>
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.reload-config')?.addEventListener('click', async () => {
              try {
                await loadConfig();
                const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                ToastNotifications?.show?.('Configuration reloaded', 'success');
                this.render();
              } catch (error) {
                const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                ToastNotifications?.show?.('Config reload failed: ' + error.message, 'error');
              }
            });
          }
        }

        if (!customElements.get('config-widget')) {
          customElements.define('config-widget', ConfigWidget);
        }

        return {
          element: 'config-widget',
          displayName: 'Configuration',
          icon: '⚙',
          category: 'core',
          updateInterval: 5000
        };
      })()
    };
  }
};

// Register with module registry if available
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(Config);
}

export default Config;
