// Substrate Loader - Dynamically load and execute evolved code as live components
// This enables TRUE RSI by allowing the agent to modify the running system

const SubstrateLoader = {
  metadata: {
    name: 'SubstrateLoader',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { vfs } = deps;

    // Registry of loaded substrate modules
    const loadedModules = new Map();
    const activeWidgets = new Map();

    // Load a module from VFS and execute it in the substrate
    const loadModule = async (path, options = {}) => {
      console.log(`[SubstrateLoader] Loading module: ${path}`);

      try {
        // Read module code from VFS
        const code = await vfs.read(path);

        // Create blob URL for dynamic import
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        try {
          // Dynamic import the module
          const module = await import(/* webpackIgnore: true */ url);

          // Store in registry
          loadedModules.set(path, {
            module,
            code,
            loadedAt: Date.now(),
            options
          });

          console.log(`[SubstrateLoader] Module loaded: ${path}`);

          // If module has an init function, call it
          if (module.default && typeof module.default.init === 'function') {
            const result = await module.default.init(deps);
            console.log(`[SubstrateLoader] Module initialized: ${path}`);
            return { module: module.default, result };
          }

          // If module is a factory, call it
          if (module.default && typeof module.default.factory === 'function') {
            const instance = module.default.factory(deps);
            console.log(`[SubstrateLoader] Module factory executed: ${path}`);
            return { module: module.default, result: instance };
          }

          return { module: module.default, result: module.default };

        } finally {
          URL.revokeObjectURL(url);
        }

      } catch (error) {
        console.error(`[SubstrateLoader] Failed to load module ${path}:`, error);
        throw new Error(`Failed to load module ${path}: ${error.message}`);
      }
    };

    // Load and mount a widget into the dashboard
    const loadWidget = async (path, containerId, options = {}) => {
      console.log(`[SubstrateLoader] Loading widget: ${path} into ${containerId}`);

      const { module, result } = await loadModule(path, options);

      // Get or create container
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = options.containerStyle || '';

        // Append to dashboard
        const dashboard = document.getElementById('chat-container');
        if (dashboard) {
          dashboard.appendChild(container);
        } else {
          document.body.appendChild(container);
        }
      }

      // Store widget reference
      activeWidgets.set(path, {
        module,
        result,
        containerId,
        loadedAt: Date.now()
      });

      console.log(`[SubstrateLoader] Widget loaded: ${path}`);

      return { module, result, container };
    };

    // Load code as an iframe sandbox
    const loadIframe = async (path, containerId, options = {}) => {
      console.log(`[SubstrateLoader] Loading iframe: ${path} into ${containerId}`);

      const code = await vfs.read(path);

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.id = `iframe-${path.replace(/\//g, '-')}`;
      iframe.style.cssText = options.iframeStyle || 'width: 100%; height: 100%; border: none;';
      iframe.sandbox = 'allow-scripts allow-same-origin';

      // Get or create container
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = options.containerStyle || '';
        document.getElementById('chat-container').appendChild(container);
      }

      container.appendChild(iframe);

      // Write code to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(code);
      iframeDoc.close();

      activeWidgets.set(path, {
        type: 'iframe',
        iframe,
        containerId,
        loadedAt: Date.now()
      });

      console.log(`[SubstrateLoader] Iframe loaded: ${path}`);

      return { iframe, container };
    };

    // Unload a module or widget
    const unload = (path) => {
      console.log(`[SubstrateLoader] Unloading: ${path}`);

      // Remove from active widgets
      const widget = activeWidgets.get(path);
      if (widget) {
        if (widget.type === 'iframe' && widget.iframe) {
          widget.iframe.remove();
        }
        activeWidgets.delete(path);
      }

      // Remove from loaded modules
      loadedModules.delete(path);

      console.log(`[SubstrateLoader] Unloaded: ${path}`);
    };

    // Reload a module (hot reload)
    const reload = async (path) => {
      console.log(`[SubstrateLoader] Reloading: ${path}`);

      const existing = activeWidgets.get(path);
      if (existing) {
        unload(path);

        // Reload based on type
        if (existing.type === 'iframe') {
          return await loadIframe(path, existing.containerId, existing.options);
        } else {
          return await loadWidget(path, existing.containerId, existing.options);
        }
      } else {
        return await loadModule(path);
      }
    };

    // List all loaded modules
    const listLoaded = () => {
      return {
        modules: Array.from(loadedModules.entries()).map(([path, info]) => ({
          path,
          loadedAt: info.loadedAt,
          hasOptions: !!info.options
        })),
        widgets: Array.from(activeWidgets.entries()).map(([path, info]) => ({
          path,
          containerId: info.containerId,
          type: info.type || 'module',
          loadedAt: info.loadedAt
        }))
      };
    };

    // Execute arbitrary code in the substrate (DANGEROUS - for agent use only)
    const executeCode = async (code, options = {}) => {
      console.log('[SubstrateLoader] Executing code in substrate');

      try {
        // Create a temporary blob URL
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        try {
          const module = await import(/* webpackIgnore: true */ url);

          // If module exports a default function, execute it
          if (typeof module.default === 'function') {
            const result = await module.default(deps);
            return result;
          }

          return module.default;

        } finally {
          URL.revokeObjectURL(url);
        }

      } catch (error) {
        console.error('[SubstrateLoader] Execution failed:', error);
        throw new Error(`Code execution failed: ${error.message}`);
      }
    };

    // Inject a new tool directly into the running system
    const injectTool = async (name, code) => {
      console.log(`[SubstrateLoader] Injecting tool: ${name}`);

      // Write to VFS
      await vfs.write(`/tools/${name}.js`, code);

      // Load and register with toolRunner
      const { result } = await loadModule(`/tools/${name}.js`);

      if (deps.toolRunner) {
        deps.toolRunner.register(name, result);
        console.log(`[SubstrateLoader] Tool registered: ${name}`);
      }

      return { name, registered: !!deps.toolRunner };
    };

    // Create a dashboard widget dynamically
    const createWidget = async (name, html, css, js) => {
      console.log(`[SubstrateLoader] Creating widget: ${name}`);

      // Generate full widget code
      const widgetCode = `
// Auto-generated widget: ${name}
export default {
  init: (deps) => {
    const container = document.createElement('div');
    container.id = 'widget-${name}';

    // Apply styles
    const style = document.createElement('style');
    style.textContent = \`${css}\`;
    document.head.appendChild(style);

    // Set HTML
    container.innerHTML = \`${html}\`;

    // Execute JavaScript
    ${js}

    return container;
  }
};
`;

      // Save to VFS
      await vfs.write(`/widgets/${name}.js`, widgetCode);

      // Load as widget
      return await loadWidget(`/widgets/${name}.js`, `widget-container-${name}`, {
        containerStyle: 'position: relative;'
      });
    };

    return {
      loadModule,
      loadWidget,
      loadIframe,
      unload,
      reload,
      listLoaded,
      executeCode,
      injectTool,
      createWidget
    };
  }
};

export default SubstrateLoader;
