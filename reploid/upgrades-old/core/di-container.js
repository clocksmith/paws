// @blueprint 0x000049 - Dependency Injection Container architecture
// DI Container for REPLOID - Project Phoenix

const DIContainer = {
  metadata: {
    id: 'DIContainer',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: false,
    type: 'service'
  },
  factory: (deps) => {
    const { Utils } = deps;
    const { logger } = Utils;

    const _services = new Map();
    const _singletons = new Map();

    // Widget tracking state
    const _moduleMetadata = new Map(); // moduleId -> { registeredAt, resolvedAt, loadTime, failed, error }
    const _failedModules = new Map(); // moduleId -> error message
    const _loadOrder = []; // Array of { moduleId, timestamp }
    let _lastActivity = null;

    const register = (module) => {
      if (!module || !module.metadata || !module.metadata.id) {
        logger.error(
          '[DIContainer] Invalid module registration attempt.\n' +
          'Modules must have structure: { metadata: { id: "ModuleName", ... }, factory: (deps) => {...} }\n' +
          `Received: ${JSON.stringify(module?.metadata || 'undefined')}`
        );
        return;
      }
      // Reduced logging - registration is tracked internally
      _services.set(module.metadata.id, module);

      // Track registration
      _moduleMetadata.set(module.metadata.id, {
        metadata: module.metadata,
        registeredAt: Date.now(),
        resolvedAt: null,
        loadTime: null,
        failed: false,
        error: null
      });
      _lastActivity = Date.now();
    };

    const resolve = async (id) => {
      if (_singletons.has(id)) {
        return _singletons.get(id);
      }

      const startTime = Date.now();
      const module = _services.get(id);

      if (!module) {
        const available = Array.from(_services.keys()).join(', ');
        const error = new Error(
          `[DIContainer] Service not found: ${id}\n` +
          `Available services: ${available || 'none'}\n` +
          `Tip: Check module ID spelling and ensure the module is registered in config.json`
        );

        // Track failure
        _failedModules.set(id, error.message);
        if (_moduleMetadata.has(id)) {
          const meta = _moduleMetadata.get(id);
          meta.failed = true;
          meta.error = error.message;
        }

        throw error;
      }

      const dependencies = {};
      if (module.metadata.dependencies) {
        for (const depId of module.metadata.dependencies) {
          // Check if dependency is optional (ends with '?')
          const isOptional = depId.endsWith('?');
          const actualDepId = isOptional ? depId.slice(0, -1) : depId;

          try {
            dependencies[actualDepId] = await resolve(actualDepId);
          } catch (err) {
            if (isOptional) {
              // Optional dependency not found - set to null
              logger.debug(`[DIContainer] Optional dependency '${actualDepId}' not available for module '${id}'`);
              dependencies[actualDepId] = null;
            } else {
              // Required dependency not found - track failure
              _failedModules.set(id, `Dependency resolution failed: ${depId}`);
              if (_moduleMetadata.has(id)) {
                const meta = _moduleMetadata.get(id);
                meta.failed = true;
                meta.error = `Dependency resolution failed: ${depId}`;
              }

              // Required dependency not found - throw error
              throw new Error(
                `[DIContainer] Failed to resolve dependency '${depId}' for module '${id}'.\n` +
                `Dependency chain: ${id} → ${depId}\n` +
                `Original error: ${err.message}\n` +
                `Check for circular dependencies or missing module registrations.`
              );
            }
          }
        }
      }

      logger.debug(`[DIContainer] Creating instance of: ${id}`);
      const instance = module.factory(dependencies);

      // Handle async initialization if required
      if (module.metadata.async && typeof instance.init === 'function') {
        try {
          await instance.init();
        } catch (initError) {
          // Log init failure but don't throw - allow graceful degradation
          logger.warn(`[DIContainer] Module '${id}' init() failed:`, initError.message);
          // Store error state in instance if it has an error property
          if (instance.api && typeof instance.api === 'object') {
            instance.api._initError = initError.message;
          }

          // Track init failure
          _failedModules.set(id, `Init failed: ${initError.message}`);
          if (_moduleMetadata.has(id)) {
            const meta = _moduleMetadata.get(id);
            meta.failed = true;
            meta.error = `Init failed: ${initError.message}`;
          }
        }
      }

      // The public API is under the 'api' property for services/ui modules
      const publicApi = (module.metadata.type === 'pure') ? instance : instance.api;

      _singletons.set(id, publicApi);

      // Track successful resolution
      const loadTime = Date.now() - startTime;
      _loadOrder.push({ moduleId: id, timestamp: Date.now() });
      if (_moduleMetadata.has(id)) {
        const meta = _moduleMetadata.get(id);
        meta.resolvedAt = Date.now();
        meta.loadTime = loadTime;
      }
      _lastActivity = Date.now();

      return publicApi;
    };

    // Web Component widget - defined inside factory to access closure variables
    class DIContainerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
      }

      disconnectedCallback() {
        // No cleanup needed
      }

      getStatus() {
        const totalModules = _services.size;
        const loadedModules = _singletons.size;
        const failedCount = _failedModules.size;
        const isActive = _lastActivity && (Date.now() - _lastActivity < 5000);

        return {
          state: failedCount > 0 ? 'warning' : (isActive ? 'active' : 'idle'),
          primaryMetric: `${loadedModules} loaded`,
          secondaryMetric: failedCount > 0 ? `${failedCount} failed` : `${totalModules} total`,
          lastActivity: _lastActivity,
          message: failedCount > 0 ? 'Some modules failed to load' : 'All modules OK'
        };
      }

      getControls() {
        return [];
      }

      render() {
        const modules = [];
        _moduleMetadata.forEach((meta, moduleId) => {
          modules.push({
            id: moduleId,
            ...meta,
            isLoaded: _singletons.has(moduleId)
          });
        });

        // Sort by load order
        modules.sort((a, b) => (a.resolvedAt || 0) - (b.resolvedAt || 0));

        const typeColors = {
          pure: 'rgba(100,150,255,0.1)',
          service: 'rgba(0,200,100,0.1)',
          ui: 'rgba(255,165,0,0.1)'
        };

        const typeIcons = {
          pure: '◊',
          service: '⚙',
          ui: '▣'
        };

        const failedModulesArray = Array.from(_failedModules.entries());

        // Build failed modules HTML
        let failedHTML = '';
        if (failedModulesArray.length > 0) {
          failedHTML = failedModulesArray.map(([id, error]) => `
            <div class="failed-item">
              <strong class="failed-id">${id}</strong>
              <div class="failed-error">${error.substring(0, 150)}${error.length > 150 ? '...' : ''}</div>
            </div>
          `).join('');
        }

        // Build modules list HTML
        const modulesHTML = modules.map((mod, index) => {
          const deps = mod.metadata?.dependencies || [];
          const type = mod.metadata?.type || 'unknown';
          const version = mod.metadata?.version || '?';

          return `
            <div class="module-item ${mod.failed ? 'failed' : ''} ${mod.isLoaded ? 'loaded' : 'pending'} module-type-${type}">
              <div class="module-content">
                <div class="module-main">
                  <div class="module-header">
                    <span class="module-index">#${index + 1}</span>
                    <span class="module-icon">${typeIcons[type] || '⛿'}</span>
                    <strong class="module-name ${mod.failed ? 'error' : ''}">${mod.id}</strong>
                    <span class="module-version">v${version}</span>
                    <span class="module-type-badge type-${type}">${type}</span>
                  </div>
                  ${deps.length > 0 ? `
                    <div class="module-deps">
                      Depends on: ${deps.join(', ')}
                    </div>
                  ` : ''}
                  ${mod.failed ? `
                    <div class="module-error">
                      ✕ ${mod.error}
                    </div>
                  ` : ''}
                </div>
                <div class="module-status">
                  ${mod.isLoaded ? `
                    <div class="status-loaded">✓ LOADED</div>
                    ${mod.loadTime !== null ? `<div class="status-time">${mod.loadTime}ms</div>` : ''}
                  ` : (mod.failed ? `
                    <div class="status-failed">✗ FAILED</div>
                  ` : `
                    <div class="status-registered">Registered</div>
                  `)}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Calculate stats
        const pureCount = modules.filter(m => m.metadata?.type === 'pure').length;
        const serviceCount = modules.filter(m => m.metadata?.type === 'service').length;
        const uiCount = modules.filter(m => m.metadata?.type === 'ui').length;

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }

            .widget-panel {
              padding: 12px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-top: 12px;
            }

            .stat-box {
              padding: 12px;
              border-radius: 4px;
            }

            .stat-box.registered {
              background: rgba(100,150,255,0.1);
            }

            .stat-box.loaded {
              background: rgba(0,200,100,0.1);
            }

            .stat-box.failed {
              background: rgba(255,0,0,0.1);
            }

            .stat-box.failed.empty {
              background: rgba(255,255,255,0.05);
            }

            .stat-label {
              font-size: 0.85em;
              color: #888;
            }

            .stat-value {
              font-size: 1.3em;
              font-weight: bold;
              margin-top: 4px;
            }

            .stat-value.error {
              color: #ff6b6b;
            }

            .failed-section {
              margin-top: 20px;
            }

            .failed-list {
              margin-top: 12px;
            }

            .failed-item {
              padding: 8px;
              background: rgba(255,0,0,0.1);
              border-left: 3px solid #ff6b6b;
              border-radius: 4px;
              margin-bottom: 8px;
            }

            .failed-id {
              color: #ff6b6b;
            }

            .failed-error {
              color: #aaa;
              font-size: 0.85em;
              margin-top: 4px;
            }

            .load-order-section {
              margin-top: 20px;
            }

            .modules-list {
              margin-top: 12px;
              max-height: 400px;
              overflow-y: auto;
            }

            .module-item {
              padding: 10px;
              border-radius: 4px;
              margin-bottom: 8px;
              background: rgba(255,255,255,0.03);
            }

            .module-item.failed {
              background: rgba(255,0,0,0.1);
            }

            .module-item.loaded.module-type-pure {
              background: rgba(100,150,255,0.1);
            }

            .module-item.loaded.module-type-service {
              background: rgba(0,200,100,0.1);
            }

            .module-item.loaded.module-type-ui {
              background: rgba(255,165,0,0.1);
            }

            .module-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .module-main {
              flex: 1;
            }

            .module-header {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .module-index {
              font-size: 0.85em;
              color: #666;
              min-width: 30px;
            }

            .module-icon {
              color: #aaa;
            }

            .module-name {
              color: #fff;
            }

            .module-name.error {
              color: #ff6b6b;
            }

            .module-version {
              color: #666;
              font-size: 0.85em;
            }

            .module-type-badge {
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 0.75em;
            }

            .module-type-badge.type-pure {
              background: rgba(100,150,255,0.1);
            }

            .module-type-badge.type-service {
              background: rgba(0,200,100,0.1);
            }

            .module-type-badge.type-ui {
              background: rgba(255,165,0,0.1);
            }

            .module-deps {
              margin-top: 6px;
              padding-left: 38px;
              color: #888;
              font-size: 0.85em;
            }

            .module-error {
              margin-top: 6px;
              padding-left: 38px;
              color: #ff6b6b;
              font-size: 0.85em;
            }

            .module-status {
              text-align: right;
              padding-left: 12px;
            }

            .status-loaded {
              color: #0c0;
              font-weight: bold;
              font-size: 0.85em;
            }

            .status-failed {
              color: #ff6b6b;
              font-weight: bold;
              font-size: 0.85em;
            }

            .status-registered {
              color: #888;
              font-size: 0.85em;
            }

            .status-time {
              color: #666;
              font-size: 0.75em;
              margin-top: 2px;
            }

            .stats-box {
              margin-top: 16px;
              padding: 12px;
              background: rgba(100,150,255,0.1);
              border-left: 3px solid #6496ff;
              border-radius: 4px;
            }

            .stats-box strong {
              color: #fff;
            }

            .stats-content {
              margin-top: 6px;
              color: #aaa;
              font-size: 0.9em;
            }
          </style>

          <div class="widget-panel">
            <h3>◫ Module Registry</h3>
            <div class="stats-grid">
              <div class="stat-box registered">
                <div class="stat-label">Registered</div>
                <div class="stat-value">${_services.size}</div>
              </div>
              <div class="stat-box loaded">
                <div class="stat-label">Loaded</div>
                <div class="stat-value">${_singletons.size}</div>
              </div>
              <div class="stat-box failed ${_failedModules.size === 0 ? 'empty' : ''}">
                <div class="stat-label">Failed</div>
                <div class="stat-value ${_failedModules.size > 0 ? 'error' : ''}">${_failedModules.size}</div>
              </div>
            </div>

            ${failedModulesArray.length > 0 ? `
              <div class="failed-section">
                <h3>△ Failed Modules</h3>
                <div class="failed-list">
                  ${failedHTML}
                </div>
              </div>
            ` : ''}

            <div class="load-order-section">
              <h3>↻ Load Order</h3>
              <div class="modules-list">
                ${modulesHTML}
              </div>
            </div>

            <div class="stats-box">
              <strong>▤ Module Statistics</strong>
              <div class="stats-content">
                Total modules: ${_services.size} •
                Loaded: ${_singletons.size} •
                Pure: ${pureCount} •
                Services: ${serviceCount} •
                UI: ${uiCount}
              </div>
            </div>
          </div>
        `;
      }
    }

    // Define custom element
    const elementName = 'di-container-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, DIContainerWidget);
    }

    // Widget interface
    const widget = {
      element: elementName,
      displayName: 'DI Container',
      icon: '◫',
      category: 'core',
      updateInterval: null
    };

    return {
        api: {
          register,
          resolve,
        },
        widget
    };
  }
};

export default DIContainer;