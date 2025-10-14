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
          EventBus.emit('reflection:added', { id, reflection: enrichedReflection });
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
          const emoji = reflection.outcome === 'success' ? '✅' : reflection.outcome === 'failure' ? '❌' : '⚠️';
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
      }
    };
  }
};

// Export standardized module
ReflectionStore;
