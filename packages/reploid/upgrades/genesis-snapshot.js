/**
 * @fileoverview Genesis Snapshot System for REPLOID
 * Saves the initial boot state as the "genesis version" for RSI tracking
 *
 * @blueprint 0x000043 - Genesis snapshot system for RSI evolution tracking and self-awareness.
 * @module GenesisSnapshot
 * @version 1.0.0
 * @category rsi
 */

const GenesisSnapshot = {
  metadata: {
    id: 'GenesisSnapshot',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils', 'EventBus'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, Utils, EventBus } = deps;
    const { logger } = Utils;

    const GENESIS_PATH = '/genesis';
    let genesisMetadata = null;

    /**
     * Save genesis snapshot of initial boot state
     * @param {Object} bootData - Data from boot sequence
     * @returns {Promise<Object>} Genesis manifest
     */
    const saveGenesisSnapshot = async (bootData) => {
      logger.info('[Genesis] Saving genesis snapshot...');

      const {
        persona,
        upgrades,
        config,
        vfs,
        timestamp = new Date().toISOString()
      } = bootData;

      try {
        // Create genesis directory structure
        await StateManager.createArtifact(`${GENESIS_PATH}/.gitkeep`, 'text', '', 'Genesis directory marker');

        // Save each loaded upgrade module
        logger.info(`[Genesis] Saving ${upgrades.length} upgrade modules...`);
        for (const upgrade of upgrades) {
          const modulePath = `/upgrades/${upgrade.path}`;
          const content = await vfs.read(modulePath);

          if (content) {
            await StateManager.createArtifact(
              `${GENESIS_PATH}/upgrades/${upgrade.id}.js`,
              'text',
              content,
              `Genesis snapshot of ${upgrade.id}`
            );
          }
        }

        // Save persona
        if (persona) {
          logger.info(`[Genesis] Saving persona: ${persona.id}`);
          await StateManager.createArtifact(
            `${GENESIS_PATH}/persona.json`,
            'text',
            JSON.stringify(persona, null, 2),
            'Genesis persona'
          );
        }

        // Save config
        logger.info('[Genesis] Saving configuration...');
        await StateManager.createArtifact(
          `${GENESIS_PATH}/config.json`,
          'text',
          JSON.stringify(config, null, 2),
          'Genesis configuration'
        );

        // Create genesis manifest
        const manifest = {
          version: '1.0.0',
          timestamp,
          persona: persona ? {
            id: persona.id,
            name: persona.name,
            type: persona.type
          } : null,
          upgrades: upgrades.map(u => ({
            id: u.id,
            path: u.path,
            category: u.category
          })),
          stats: {
            total_upgrades: upgrades.length,
            total_lines: 0 // Could calculate if needed
          },
          description: 'Genesis snapshot - initial boot state of REPLOID'
        };

        await StateManager.createArtifact(
          `${GENESIS_PATH}/manifest.json`,
          'text',
          JSON.stringify(manifest, null, 2),
          'Genesis manifest'
        );

        genesisMetadata = manifest;
        logger.info('[Genesis] Genesis snapshot saved successfully');
        EventBus.emit('genesis:snapshot-created', manifest);

        return manifest;

      } catch (error) {
        logger.error('[Genesis] Failed to save genesis snapshot:', error);
        throw error;
      }
    };

    /**
     * Load genesis manifest
     * @returns {Promise<Object>} Genesis manifest or null
     */
    const loadGenesisManifest = async () => {
      if (genesisMetadata) {
        return genesisMetadata;
      }

      try {
        const content = await StateManager.getArtifactContent(`${GENESIS_PATH}/manifest.json`);
        if (content) {
          genesisMetadata = JSON.parse(content);
          return genesisMetadata;
        }
      } catch (error) {
        logger.warn('[Genesis] No genesis snapshot found');
      }

      return null;
    };

    /**
     * Get genesis version of a specific upgrade
     * @param {string} upgradeId - Upgrade ID (e.g., 'STMT')
     * @returns {Promise<string>} Original source code or null
     */
    const getGenesisUpgrade = async (upgradeId) => {
      try {
        const content = await StateManager.getArtifactContent(`${GENESIS_PATH}/upgrades/${upgradeId}.js`);
        return content;
      } catch (error) {
        logger.warn(`[Genesis] Genesis version of ${upgradeId} not found`);
        return null;
      }
    };

    /**
     * Compare current upgrade vs genesis version
     * @param {string} upgradeId - Upgrade ID
     * @returns {Promise<Object>} Comparison result
     */
    const compareToGenesis = async (upgradeId) => {
      const genesisContent = await getGenesisUpgrade(upgradeId);
      if (!genesisContent) {
        return {
          exists: false,
          message: 'No genesis version found'
        };
      }

      const currentContent = await StateManager.getArtifactContent(`/upgrades/${upgradeId}.js`);
      if (!currentContent) {
        return {
          exists: false,
          message: 'Current version not found'
        };
      }

      const unchanged = genesisContent === currentContent;

      return {
        exists: true,
        unchanged,
        genesis_length: genesisContent.length,
        current_length: currentContent.length,
        difference: currentContent.length - genesisContent.length,
        modified: !unchanged
      };
    };

    /**
     * Check if genesis snapshot exists
     * @returns {Promise<boolean>}
     */
    const hasGenesis = async () => {
      try {
        const manifest = await loadGenesisManifest();
        return manifest !== null;
      } catch (error) {
        return false;
      }
    };

    /**
     * Get evolution summary (what changed since genesis)
     * @returns {Promise<Object>} Evolution summary
     */
    const getEvolutionSummary = async () => {
      const manifest = await loadGenesisManifest();
      if (!manifest) {
        return {
          has_genesis: false,
          message: 'No genesis snapshot available'
        };
      }

      const modifications = [];
      for (const upgrade of manifest.upgrades) {
        const comparison = await compareToGenesis(upgrade.id);
        if (comparison.exists && comparison.modified) {
          modifications.push({
            upgrade_id: upgrade.id,
            ...comparison
          });
        }
      }

      return {
        has_genesis: true,
        genesis_timestamp: manifest.timestamp,
        genesis_persona: manifest.persona,
        total_upgrades: manifest.upgrades.length,
        modified_upgrades: modifications.length,
        modifications
      };
    };

    /**
     * Delete genesis snapshot
     * @returns {Promise<void>}
     */
    const deleteGenesis = async () => {
      logger.warn('[Genesis] Deleting genesis snapshot');
      try {
        // Delete all genesis artifacts
        const artifacts = await StateManager.getAllArtifactMetadata();
        for (const path in artifacts) {
          if (path.startsWith(GENESIS_PATH)) {
            await StateManager.deleteArtifact(path);
          }
        }
        genesisMetadata = null;
        EventBus.emit('genesis:snapshot-deleted');
        logger.info('[Genesis] Genesis snapshot deleted');
      } catch (error) {
        logger.error('[Genesis] Failed to delete genesis:', error);
        throw error;
      }
    };

    // Widget interface for ModuleWidgetProtocol
    const widget = (() => {
      class GenesisSnapshotWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this._genesisState = { exists: false, manifest: null };
        }

        connectedCallback() {
          this.updateGenesisState();
          this.render();
          // Auto-refresh to check for genesis updates
          this._interval = setInterval(() => {
            this.updateGenesisState();
            this.render();
          }, 5000);
        }

        disconnectedCallback() {
          if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
          }
        }

        async updateGenesisState() {
          // Update cached state asynchronously
          const exists = await hasGenesis();
          const manifest = exists ? await loadGenesisManifest() : null;
          this._genesisState = { exists, manifest };
        }

        getStatus() {
          // Synchronous status using cached state (closure access)
          const { exists, manifest } = this._genesisState;

          return {
            state: exists ? 'idle' : 'disabled',
            primaryMetric: exists ? `${manifest?.upgrades?.length || 0} modules` : 'No snapshot',
            secondaryMetric: exists ? new Date(manifest?.timestamp).toLocaleDateString() : 'Create genesis',
            lastActivity: exists ? new Date(manifest?.timestamp).getTime() : null,
            message: exists ? 'Genesis snapshot saved' : 'No genesis snapshot'
          };
        }

        getControls() {
          return [
            {
              id: 'save-genesis',
              label: 'Save Genesis',
              icon: '⛃',
              action: async () => {
                try {
                  const configContent = await StateManager.getArtifactContent('/config.json');
                  const config = JSON.parse(configContent);
                  const bootData = {
                    persona: config.persona,
                    upgrades: config.modules || [],
                    config: config,
                    vfs: StateManager,
                    timestamp: new Date().toISOString()
                  };
                  await saveGenesisSnapshot(bootData);
                  await this.updateGenesisState();
                  this.render();
                  return { success: true, message: 'Genesis snapshot saved!' };
                } catch (error) {
                  return { success: false, message: `Failed to save: ${error.message}` };
                }
              }
            },
            {
              id: 'compare-genesis',
              label: 'Compare',
              icon: '⚖',
              action: async () => {
                try {
                  const summary = await getEvolutionSummary();
                  const msg = `Added: ${summary.added || 0}, Modified: ${summary.modified_upgrades}, Deleted: ${summary.deleted || 0}`;
                  return { success: true, message: msg };
                } catch (error) {
                  return { success: false, message: 'No genesis to compare' };
                }
              }
            },
            {
              id: 'delete-genesis',
              label: 'Delete',
              icon: '⛶',
              action: async () => {
                await deleteGenesis();
                await this.updateGenesisState();
                this.render();
                return { success: true, message: 'Genesis snapshot deleted' };
              }
            }
          ];
        }

        async render() {
          const exists = await hasGenesis();

          if (!exists) {
            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  font-family: monospace;
                  color: #e0e0e0;
                }
                .genesis-snapshot-panel {
                  padding: 20px;
                  text-align: center;
                  background: #1a1a1a;
                  border-radius: 4px;
                }
                .large-icon {
                  font-size: 48px;
                  margin-bottom: 20px;
                }
                h3 {
                  color: #0ff;
                  margin-bottom: 10px;
                }
                p {
                  margin-bottom: 20px;
                }
                .controls {
                  margin-bottom: 20px;
                  display: flex;
                  gap: 8px;
                  justify-content: center;
                }
                button {
                  padding: 8px 16px;
                  background: #333;
                  color: #e0e0e0;
                  border: 1px solid #555;
                  border-radius: 3px;
                  cursor: pointer;
                  font-family: monospace;
                  font-size: 11px;
                }
                button:hover {
                  background: #444;
                }
              </style>
              <div class="genesis-snapshot-panel">
                <div class="large-icon">⚘</div>
                <h3>No Genesis Snapshot</h3>
                <p style="color: #888;">
                  Genesis snapshots save the initial boot state for evolution tracking.
                </p>
                <div class="controls">
                  <button class="save-genesis">⛃ Save Genesis</button>
                </div>
                <p style="color: #666; font-size: 13px;">
                  Click "Save Genesis" to create your first snapshot.
                </p>
              </div>
            `;

            this.shadowRoot.querySelector('.save-genesis')?.addEventListener('click', async () => {
              try {
                const configContent = await StateManager.getArtifactContent('/config.json');
                const config = JSON.parse(configContent);

                const bootData = {
                  persona: config.persona,
                  upgrades: config.modules || [],
                  config: config,
                  vfs: StateManager,
                  timestamp: new Date().toISOString()
                };

                await saveGenesisSnapshot(bootData);
                EventBus.emit('toast:success', { message: 'Genesis snapshot saved!' });
                this.render();
              } catch (error) {
                EventBus.emit('toast:error', { message: `Failed to save: ${error.message}` });
              }
            });
            return;
          }

          const manifest = await loadGenesisManifest();
          const summary = await getEvolutionSummary();
          const date = new Date(manifest.timestamp).toLocaleString();

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: monospace;
                color: #e0e0e0;
              }
              .genesis-snapshot-panel {
                padding: 12px;
                background: #1a1a1a;
                border-radius: 4px;
              }
              .controls {
                margin-bottom: 12px;
                display: flex;
                gap: 8px;
              }
              button {
                padding: 6px 12px;
                background: #333;
                color: #e0e0e0;
                border: 1px solid #555;
                border-radius: 3px;
                cursor: pointer;
                font-family: monospace;
                font-size: 11px;
              }
              button:hover {
                background: #444;
              }
              h4 {
                color: #0ff;
                margin: 0 0 10px 0;
                font-size: 14px;
              }
              .genesis-header {
                background: rgba(0,255,255,0.1);
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .evolution-summary {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
              }
              .stat-card {
                padding: 10px;
                border-radius: 5px;
              }
              .stat-card div:first-child {
                color: #888;
                font-size: 11px;
              }
              .stat-card div:last-child {
                font-size: 20px;
                font-weight: bold;
              }
              .module-list {
                max-height: 250px;
                overflow-y: auto;
              }
              .module-item {
                padding: 8px;
                background: rgba(255,255,255,0.03);
                margin-bottom: 6px;
                border-radius: 3px;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
              }
              .genesis-persona {
                background: rgba(156,39,176,0.1);
                padding: 12px;
                border-radius: 5px;
              }
            </style>
            <div class="genesis-snapshot-panel">
              <div class="controls">
                <button class="save-genesis">⛃ Save Genesis</button>
                <button class="compare-genesis">⚖ Compare</button>
                <button class="delete-genesis">⛶ Delete</button>
              </div>

              <div class="genesis-header">
                <div>
                  <div style="font-size: 12px; color: #888;">Genesis Snapshot</div>
                  <div style="font-size: 18px; font-weight: bold; color: #0ff;">${manifest.version}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 11px; color: #888;">Created</div>
                  <div style="font-size: 13px; color: #ccc;">${date}</div>
                </div>
              </div>

              <div class="evolution-summary">
                <div class="stat-card" style="background: rgba(76,175,80,0.1);">
                  <div>Added</div>
                  <div style="color: #4caf50;">${summary.added}</div>
                </div>
                <div class="stat-card" style="background: rgba(255,193,7,0.1);">
                  <div>Modified</div>
                  <div style="color: #ffc107;">${summary.modified}</div>
                </div>
                <div class="stat-card" style="background: rgba(244,67,54,0.1);">
                  <div>Deleted</div>
                  <div style="color: #f44336;">${summary.deleted}</div>
                </div>
              </div>

              <div class="genesis-modules">
                <h4>Genesis Modules (${manifest.upgrades.length})</h4>
                <div class="module-list">
                  ${manifest.upgrades.slice(0, 20).map(mod => `
                    <div class="module-item">
                      <span style="color: #ccc;">${mod.id}</span>
                      <span style="color: #666;">${mod.category || 'unknown'}</span>
                    </div>
                  `).join('')}
                  ${manifest.upgrades.length > 20 ? `
                    <div style="padding: 10px; text-align: center; color: #666; font-size: 11px;">
                      ... and ${manifest.upgrades.length - 20} more modules
                    </div>
                  ` : ''}
                </div>
              </div>

              ${manifest.persona ? `
                <div class="genesis-persona">
                  <div style="font-weight: bold; margin-bottom: 6px; color: #9c27b0;">Genesis Persona</div>
                  <div style="font-size: 12px; color: #ccc;">
                    ${manifest.persona.name || manifest.persona.id} (${manifest.persona.type || 'unknown'})
                  </div>
                </div>
              ` : ''}
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.save-genesis')?.addEventListener('click', async () => {
            try {
              const configContent = await StateManager.getArtifactContent('/config.json');
              const config = JSON.parse(configContent);

              const bootData = {
                persona: config.persona,
                upgrades: config.modules || [],
                config: config,
                vfs: StateManager,
                timestamp: new Date().toISOString()
              };

              await saveGenesisSnapshot(bootData);
              EventBus.emit('toast:success', { message: 'Genesis snapshot saved!' });
              this.render();
            } catch (error) {
              EventBus.emit('toast:error', { message: `Failed to save: ${error.message}` });
            }
          });

          this.shadowRoot.querySelector('.compare-genesis')?.addEventListener('click', async () => {
            try {
              const summary = await getEvolutionSummary();
              const msg = `Added: ${summary.added}, Modified: ${summary.modified}, Deleted: ${summary.deleted}`;
              EventBus.emit('toast:info', { message: msg });
            } catch (error) {
              EventBus.emit('toast:error', { message: 'No genesis to compare' });
            }
          });

          this.shadowRoot.querySelector('.delete-genesis')?.addEventListener('click', async () => {
            if (confirm('Delete genesis snapshot? This cannot be undone.')) {
              await deleteGenesis();
              EventBus.emit('toast:success', { message: 'Genesis snapshot deleted' });
              this.render();
            }
          });
        }
      }

      if (!customElements.get('genesis-snapshot-widget')) {
        customElements.define('genesis-snapshot-widget', GenesisSnapshotWidget);
      }

      return {
        element: 'genesis-snapshot-widget',
        displayName: 'Genesis Snapshot',
        icon: '⚘',
        category: 'rsi',
        order: 95
      };
    })();

    return {
      api: {
        saveGenesisSnapshot,
        loadGenesisManifest,
        getGenesisUpgrade,
        compareToGenesis,
        hasGenesis,
        getEvolutionSummary,
        deleteGenesis,

        // Constants
        GENESIS_PATH
      },
      widget
    };
  }
};

// Export
export default GenesisSnapshot;
