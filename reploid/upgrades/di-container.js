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

    const register = (module) => {
      if (!module || !module.metadata || !module.metadata.id) {
        logger.error(
          '[DIContainer] Invalid module registration attempt.\n' +
          'Modules must have structure: { metadata: { id: "ModuleName", ... }, factory: (deps) => {...} }\n' +
          `Received: ${JSON.stringify(module?.metadata || 'undefined')}`
        );
        return;
      }
      logger.info(`[DIContainer] Registered module: ${module.metadata.id}`);
      _services.set(module.metadata.id, module);
    };

    const resolve = async (id) => {
      if (_singletons.has(id)) {
        return _singletons.get(id);
      }

      const module = _services.get(id);
      if (!module) {
        const available = Array.from(_services.keys()).join(', ');
        throw new Error(
          `[DIContainer] Service not found: ${id}\n` +
          `Available services: ${available || 'none'}\n` +
          `Tip: Check module ID spelling and ensure the module is registered in config.json`
        );
      }

      const dependencies = {};
      if (module.metadata.dependencies) {
        for (const depId of module.metadata.dependencies) {
          try {
            dependencies[depId] = await resolve(depId);
          } catch (err) {
            throw new Error(
              `[DIContainer] Failed to resolve dependency '${depId}' for module '${id}'.\n` +
              `Dependency chain: ${id} → ${depId}\n` +
              `Original error: ${err.message}\n` +
              `Check for circular dependencies or missing module registrations.`
            );
          }
        }
      }

      logger.debug(`[DIContainer] Creating instance of: ${id}`);
      const instance = module.factory(dependencies);
      
      // Handle async initialization if required
      if (module.metadata.async && typeof instance.init === 'function') {
        await instance.init();
      }

      // The public API is under the 'api' property for services/ui modules
      const publicApi = (module.metadata.type === 'pure') ? instance : instance.api;

      _singletons.set(id, publicApi);
      return publicApi;
    };

    return {
        register,
        resolve,
    };
  }
};

DIContainer;