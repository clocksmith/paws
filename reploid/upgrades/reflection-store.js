// @blueprint 0x000035 - Documents the reflection store architecture.
// Reflection Store Module for REPLOID - RSI-2
// Persistent storage for agent reflections to enable learning over time

const ReflectionStore = {
  metadata: {
    id: 'ReflectionStore',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: true,
    type: 'learning'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    const DB_NAME = 'reploid_reflections';
    const DB_VERSION = 1;
    const STORE_NAME = 'reflections';

    let db = null;

    // Widget tracking
    let _additionCount = 0;
    let _lastAdditionTime = null;
    let _outcomeCounts = { success: 0, failure: 0, partial: 0 };

    // Initialize IndexedDB
    const init = async () => {
      logger.info('[ReflectionStore] Initializing reflection persistence');

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          logger.error('[ReflectionStore] Failed to open database:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          db = request.result;
          logger.info('[ReflectionStore] Database opened successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          logger.info('[ReflectionStore] Creating database schema');
          const database = event.target.result;

          // Create reflections object store
          const objectStore = database.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Create indexes for efficient querying
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('outcome', 'outcome', { unique: false });
          objectStore.createIndex('category', 'category', { unique: false });
          objectStore.createIndex('session', 'sessionId', { unique: false });
          objectStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });

          logger.info('[ReflectionStore] Database schema created');
        };
      });
    };

    // Add a new reflection
    const addReflection = async (reflection) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Validate reflection structure
      if (!reflection.outcome || !reflection.description) {
        throw new Error('Reflection must have outcome and description');
      }

      // Enrich reflection with metadata
      const enrichedReflection = {
        ...reflection,
        timestamp: reflection.timestamp || Date.now(),
        sessionId: reflection.sessionId || generateSessionId(),
        id: undefined // Let IndexedDB auto-generate
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.add(enrichedReflection);

        request.onsuccess = () => {
          const id = request.result;
          logger.info(`[ReflectionStore] Added reflection ${id}`);

          // Track addition
          _additionCount++;
          _lastAdditionTime = Date.now();
          const outcome = enrichedReflection.outcome || 'partial';
          _outcomeCounts[outcome] = (_outcomeCounts[outcome] || 0) + 1;

          EventBus.emit('reflection:added', { id, reflection: enrichedReflection });
          EventBus.emit('reflection:created'); // For search index update
          resolve(id);
        };

        request.onerror = () => {
          logger.error('[ReflectionStore] Failed to add reflection:', request.error);
          reject(request.error);
        };
      });
    };

    // Get reflections with optional filters
    const getReflections = async (filters = {}) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);

        let request;

        // Use index if filter specified
        if (filters.outcome) {
          const index = objectStore.index('outcome');
          request = index.getAll(filters.outcome);
        } else if (filters.category) {
          const index = objectStore.index('category');
          request = index.getAll(filters.category);
        } else if (filters.sessionId) {
          const index = objectStore.index('session');
          request = index.getAll(filters.sessionId);
        } else if (filters.tag) {
          const index = objectStore.index('tags');
          request = index.getAll(filters.tag);
        } else {
          request = objectStore.getAll();
        }

        request.onsuccess = () => {
          let results = request.result;

          // Apply additional filters
          if (filters.startTime) {
            results = results.filter(r => r.timestamp >= filters.startTime);
          }
          if (filters.endTime) {
            results = results.filter(r => r.timestamp <= filters.endTime);
          }
          if (filters.limit) {
            results = results.slice(0, filters.limit);
          }

          // Sort by timestamp descending (newest first)
          results.sort((a, b) => b.timestamp - a.timestamp);

          logger.info(`[ReflectionStore] Retrieved ${results.length} reflections`);
          resolve(results);
        };

        request.onerror = () => {
          logger.error('[ReflectionStore] Failed to get reflections:', request.error);
          reject(request.error);
        };
      });
    };

    // Get a single reflection by ID
    const getReflection = async (id) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.get(id);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          logger.error('[ReflectionStore] Failed to get reflection:', request.error);
          reject(request.error);
        };
      });
    };

    // Analyze success patterns
    const getSuccessPatterns = async () => {
      const successes = await getReflections({ outcome: 'success' });

      const patterns = {
        count: successes.length,
        categories: {},
        commonTags: {},
        insights: []
      };

      // Analyze categories
      successes.forEach(reflection => {
        const category = reflection.category || 'uncategorized';
        patterns.categories[category] = (patterns.categories[category] || 0) + 1;

        // Analyze tags
        if (reflection.tags) {
          reflection.tags.forEach(tag => {
            patterns.commonTags[tag] = (patterns.commonTags[tag] || 0) + 1;
          });
        }
      });

      // Generate insights
      const topCategory = Object.entries(patterns.categories)
        .sort((a, b) => b[1] - a[1])[0];
      if (topCategory) {
        patterns.insights.push(`Most successful category: ${topCategory[0]} (${topCategory[1]} successes)`);
      }

      const topTag = Object.entries(patterns.commonTags)
        .sort((a, b) => b[1] - a[1])[0];
      if (topTag) {
        patterns.insights.push(`Most common success tag: ${topTag[0]} (${topTag[1]} occurrences)`);
      }

      return patterns;
    };

    // Analyze failure patterns
    const getFailurePatterns = async () => {
      const failures = await getReflections({ outcome: 'failure' });

      const patterns = {
        count: failures.length,
        categories: {},
        commonTags: {},
        commonErrors: {},
        insights: []
      };

      // Analyze categories and errors
      failures.forEach(reflection => {
        const category = reflection.category || 'uncategorized';
        patterns.categories[category] = (patterns.categories[category] || 0) + 1;

        // Extract error types
        if (reflection.error) {
          const errorType = reflection.error.type || 'unknown';
          patterns.commonErrors[errorType] = (patterns.commonErrors[errorType] || 0) + 1;
        }

        // Analyze tags
        if (reflection.tags) {
          reflection.tags.forEach(tag => {
            patterns.commonTags[tag] = (patterns.commonTags[tag] || 0) + 1;
          });
        }
      });

      // Generate insights
      const topCategory = Object.entries(patterns.categories)
        .sort((a, b) => b[1] - a[1])[0];
      if (topCategory) {
        patterns.insights.push(`Most problematic category: ${topCategory[0]} (${topCategory[1]} failures)`);
      }

      const topError = Object.entries(patterns.commonErrors)
        .sort((a, b) => b[1] - a[1])[0];
      if (topError) {
        patterns.insights.push(`Most common error: ${topError[0]} (${topError[1]} occurrences)`);
      }

      return patterns;
    };

    // Get learning summary
    const getLearningSummary = async () => {
      const all = await getReflections();
      const successes = all.filter(r => r.outcome === 'success');
      const failures = all.filter(r => r.outcome === 'failure');
      const partials = all.filter(r => r.outcome === 'partial');

      const summary = {
        total: all.length,
        outcomes: {
          success: successes.length,
          failure: failures.length,
          partial: partials.length
        },
        successRate: all.length > 0 ? (successes.length / all.length) * 100 : 0,
        recentReflections: all.slice(0, 10),
        oldestReflection: all.length > 0 ? all[all.length - 1].timestamp : null,
        newestReflection: all.length > 0 ? all[0].timestamp : null
      };

      return summary;
    };

    // Delete old reflections (cleanup)
    const deleteOldReflections = async (olderThanDays = 90) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const allReflections = await getReflections();
      const toDelete = allReflections.filter(r => r.timestamp < cutoffTime);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        let deleted = 0;
        toDelete.forEach(reflection => {
          const request = objectStore.delete(reflection.id);
          request.onsuccess = () => deleted++;
        });

        transaction.oncomplete = () => {
          logger.info(`[ReflectionStore] Deleted ${deleted} old reflections`);
          resolve(deleted);
        };

        transaction.onerror = () => {
          logger.error('[ReflectionStore] Failed to delete reflections:', transaction.error);
          reject(transaction.error);
        };
      });
    };

    // Export reflections as JSON
    const exportReflections = async () => {
      const reflections = await getReflections();
      return {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        count: reflections.length,
        reflections
      };
    };

    // Import reflections from JSON
    const importReflections = async (data) => {
      if (!data.reflections || !Array.isArray(data.reflections)) {
        throw new Error('Invalid import data');
      }

      let imported = 0;
      for (const reflection of data.reflections) {
        try {
          await addReflection(reflection);
          imported++;
        } catch (err) {
          logger.warn(`[ReflectionStore] Failed to import reflection:`, err);
        }
      }

      logger.info(`[ReflectionStore] Imported ${imported}/${data.reflections.length} reflections`);
      return imported;
    };

    // Helper: Generate session ID
    const generateSessionId = () => {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Generate markdown report of reflections
    const generateReport = async (filters = {}) => {
      const reflections = await getReflections(filters);
      const summary = await getLearningSummary();
      const successPatterns = await getSuccessPatterns();
      const failurePatterns = await getFailurePatterns();

      let report = `# Agent Reflection Report\n\n`;
      report += `**Generated:** ${new Date().toISOString()}\n\n`;

      // Summary
      report += `## Summary\n\n`;
      report += `- **Total Reflections:** ${summary.total}\n`;
      report += `- **Successes:** ${summary.outcomes.success} (${summary.successRate.toFixed(1)}%)\n`;
      report += `- **Failures:** ${summary.outcomes.failure}\n`;
      report += `- **Partial:** ${summary.outcomes.partial}\n\n`;

      // Success Patterns
      if (successPatterns.insights.length > 0) {
        report += `## Success Patterns\n\n`;
        successPatterns.insights.forEach(insight => {
          report += `- ${insight}\n`;
        });
        report += `\n`;
      }

      // Failure Patterns
      if (failurePatterns.insights.length > 0) {
        report += `## Failure Patterns\n\n`;
        failurePatterns.insights.forEach(insight => {
          report += `- ${insight}\n`;
        });
        report += `\n`;
      }

      // Recent Reflections
      if (reflections.length > 0) {
        report += `## Recent Reflections\n\n`;
        reflections.slice(0, 20).forEach((reflection, i) => {
          const date = new Date(reflection.timestamp).toISOString();
          const emoji = reflection.outcome === 'success' ? '✓' : reflection.outcome === 'failure' ? '✗' : '⚠️';
          report += `### ${i + 1}. ${emoji} ${reflection.category || 'General'} - ${date}\n\n`;
          report += `**Outcome:** ${reflection.outcome}\n\n`;
          report += `${reflection.description}\n\n`;
          if (reflection.tags && reflection.tags.length > 0) {
            report += `**Tags:** ${reflection.tags.join(', ')}\n\n`;
          }
        });
      }

      report += `---\n\n*Generated by REPLOID Reflection Store*\n`;
      return report;
    };

    // Web Component Widget
    const widget = (() => {
      class ReflectionStoreWidget extends HTMLElement {
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
          const total = Object.values(_outcomeCounts).reduce((sum, count) => sum + count, 0);
          const successRate = total > 0 ? ((_outcomeCounts.success || 0) / total * 100).toFixed(0) : 0;

          return {
            state: _additionCount > 0 ? 'active' : 'idle',
            primaryMetric: `${total} reflections`,
            secondaryMetric: `${successRate}% success`,
            lastActivity: _lastAdditionTime,
            message: db ? 'Ready' : 'Not initialized'
          };
        }

        render() {
          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            const diff = Date.now() - timestamp;
            if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
            if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
            return `${Math.floor(diff/3600000)}h ago`;
          };

          const total = Object.values(_outcomeCounts).reduce((sum, count) => sum + count, 0);
          const successRate = total > 0 ? ((_outcomeCounts.success || 0) / total * 100).toFixed(1) : '0.0';

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
              }
              h3 {
                margin: 0 0 16px 0;
                font-size: 1.4em;
                color: #fff;
              }
              h4 {
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
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                margin-top: 12px;
              }
              .stat-card {
                padding: 12px;
                background: rgba(100,150,255,0.1);
                border-radius: 4px;
              }
              .stat-card.success-rate {
                background: rgba(0,200,100,0.1);
              }
              .stat-label {
                font-size: 0.85em;
                color: #888;
              }
              .stat-value {
                font-size: 1.3em;
                font-weight: bold;
              }
              .stat-value.success {
                color: #0c0;
              }
              .stat-value.db-ready {
                color: #0c0;
              }
              .stat-value.db-not-ready {
                color: #f00;
              }
              .outcome-breakdown {
                margin-top: 8px;
              }
              .outcome-item {
                padding: 8px;
                border-radius: 4px;
                margin-bottom: 6px;
                border-left: 3px solid;
              }
              .outcome-item.success {
                background: rgba(0,200,100,0.1);
                border-left-color: #0c0;
              }
              .outcome-item.failure {
                background: rgba(255,0,0,0.1);
                border-left-color: #ff6b6b;
              }
              .outcome-item.partial {
                background: rgba(255,150,0,0.1);
                border-left-color: #f90;
              }
              .outcome-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .outcome-label {
                font-weight: bold;
              }
              .outcome-label.success { color: #0c0; }
              .outcome-label.failure { color: #ff6b6b; }
              .outcome-label.partial { color: #f90; }
              .outcome-count {
                font-size: 1.2em;
                font-weight: bold;
              }
              .progress-bar {
                margin-top: 4px;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                overflow: hidden;
              }
              .progress-fill {
                height: 100%;
              }
              .progress-fill.success { background: #0c0; }
              .progress-fill.failure { background: #ff6b6b; }
              .progress-fill.partial { background: #f90; }
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
            </style>

            <div class="widget-panel">
              <h3>☁ Reflection Store</h3>

              <div class="controls">
                <button class="generate-report">⛿ Generate Report</button>
                <button class="export-data">⇑ Export Data</button>
                <button class="get-summary">☱ Get Summary</button>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Total</div>
                  <div class="stat-value">${total}</div>
                </div>
                <div class="stat-card success-rate">
                  <div class="stat-label">Success Rate</div>
                  <div class="stat-value success">${successRate}%</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Added</div>
                  <div class="stat-value">${_additionCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Database</div>
                  <div class="stat-value ${db ? 'db-ready' : 'db-not-ready'}">${db ? 'Ready' : 'N/A'}</div>
                </div>
              </div>

              <h4>☱ Outcome Breakdown</h4>
              <div class="outcome-breakdown">
                <div class="outcome-item success">
                  <div class="outcome-header">
                    <span class="outcome-label success">✓ Success</span>
                    <span class="outcome-count">${_outcomeCounts.success || 0}</span>
                  </div>
                  ${total > 0 ? `<div class="progress-bar">
                    <div class="progress-fill success" style="width: ${((_outcomeCounts.success || 0) / total * 100)}%;"></div>
                  </div>` : ''}
                </div>
                <div class="outcome-item failure">
                  <div class="outcome-header">
                    <span class="outcome-label failure">✗ Failure</span>
                    <span class="outcome-count">${_outcomeCounts.failure || 0}</span>
                  </div>
                  ${total > 0 ? `<div class="progress-bar">
                    <div class="progress-fill failure" style="width: ${((_outcomeCounts.failure || 0) / total * 100)}%;"></div>
                  </div>` : ''}
                </div>
                <div class="outcome-item partial">
                  <div class="outcome-header">
                    <span class="outcome-label partial">⚠ Partial</span>
                    <span class="outcome-count">${_outcomeCounts.partial || 0}</span>
                  </div>
                  ${total > 0 ? `<div class="progress-bar">
                    <div class="progress-fill partial" style="width: ${((_outcomeCounts.partial || 0) / total * 100)}%;"></div>
                  </div>` : ''}
                </div>
              </div>

              <div class="info-box">
                <strong>ℹ️ Learning Storage</strong>
                <div class="info-text">
                  Persistent IndexedDB storage for agent reflections.<br>
                  Last addition: ${formatTime(_lastAdditionTime)}
                </div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.generate-report')?.addEventListener('click', async () => {
            const report = await generateReport();
            console.log(report);
            logger.info('[ReflectionStore] Widget: Report generated (see console)');
          });

          this.shadowRoot.querySelector('.export-data')?.addEventListener('click', async () => {
            const data = await exportReflections();
            console.log('[ReflectionStore] Export data:', data);
            logger.info('[ReflectionStore] Widget: Data exported to console');
          });

          this.shadowRoot.querySelector('.get-summary')?.addEventListener('click', async () => {
            const summary = await getLearningSummary();
            console.log('[ReflectionStore] Summary:', summary);
            logger.info('[ReflectionStore] Widget: Summary logged to console');
          });
        }
      }

      if (!customElements.get('reflection-store-widget')) {
        customElements.define('reflection-store-widget', ReflectionStoreWidget);
      }

      return {
        element: 'reflection-store-widget',
        displayName: 'Reflection Store',
        icon: '☁',
        category: 'learning',
        updateInterval: 5000
      };
    })();

    return {
      init,
      api: {
        addReflection,
        getReflections,
        getReflection,
        getSuccessPatterns,
        getFailurePatterns,
        getLearningSummary,
        deleteOldReflections,
        exportReflections,
        importReflections,
        generateReport
      },
      widget
    };
  }
};

// Export standardized module
export default ReflectionStore;
