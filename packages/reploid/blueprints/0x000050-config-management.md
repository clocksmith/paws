# Blueprint 0x000050: Centralized Configuration Management

**Objective:** Provide a centralized, type-guarded configuration system that serves as the single source of truth for all agent configuration.

**Target Upgrade:** CFG (`config.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling)

**Affected Artifacts:** `/upgrades/config.json`, `/upgrades/config.js`

---

### 1. The Strategic Imperative

A self-modifying agent system requires strict configuration governance to prevent:

- **Configuration Drift**: Multiple modules reading config.json with inconsistent parsing
- **Type Errors**: Runtime crashes from unexpected config value types
- **Invalid States**: Malformed persona or upgrade definitions
- **Audit Trail Loss**: Changes to configuration without validation or tracking

The Config module centralizes all configuration access through a validated, read-only API with schema enforcement.

### 2. The Architectural Solution

The `/upgrades/config.js` implements a **schema-validated configuration loader** with read-only access patterns.

#### Module Structure

```javascript
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

    // Private configuration state
    let _config = null;
    let _loadTime = null;

    /**
     * Configuration schema definition
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
     * Validate configuration against schema
     */
    const validateConfig = (config) => {
      if (!config || typeof config !== 'object') {
        throw new ConfigError('Configuration must be an object');
      }

      const errors = [];

      // Check required fields and types
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

      // Validate nested structures (personas, upgrades, providers)
      // ... detailed validation logic

      if (errors.length > 0) {
        throw new ConfigError(`Configuration validation failed:\n${errors.join('\n')}`);
      }
    };

    /**
     * Initialize configuration
     */
    const init = async () => {
      try {
        // Load config.json from VFS or fetch
        const configContent = await loadConfigFile();
        const config = JSON.parse(configContent);

        // Validate against schema
        validateConfig(config);

        // Store validated configuration
        _config = Object.freeze(config);
        _loadTime = Date.now();

        logger.info('[Config] Configuration loaded and validated successfully');
      } catch (error) {
        logger.error('[Config] Failed to load configuration:', error);
        throw error;
      }
    };

    /**
     * Public API - Read-only access to configuration
     */
    const api = {
      get: (path, defaultValue) => {
        if (!_config) {
          throw new ConfigError('Configuration not loaded. Call init() first.');
        }

        // Support dot-notation path (e.g., 'providers.default')
        const keys = path.split('.');
        let value = _config;

        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
          } else {
            return defaultValue;
          }
        }

        return value;
      },

      getAll: () => {
        if (!_config) {
          throw new ConfigError('Configuration not loaded. Call init() first.');
        }
        return _config; // Already frozen, safe to return
      },

      isLoaded: () => _config !== null,

      getLoadTime: () => _loadTime,

      // Persona helpers
      getPersona: (personaId) => {
        const personas = api.get('personas', []);
        return personas.find(p => p.id === personaId);
      },

      getActivePersona: () => {
        return api.get('activePersona', 'default');
      },

      // Upgrade helpers
      getUpgrade: (upgradeId) => {
        const upgrades = api.get('upgrades', []);
        return upgrades.find(u => u.id === upgradeId);
      },

      getUpgradesByCategory: (category) => {
        const upgrades = api.get('upgrades', []);
        return upgrades.filter(u => u.category === category);
      },

      // Provider helpers
      getProvider: (name) => {
        return api.get(`providers.${name}`);
      },

      getDefaultProvider: () => {
        return api.get('providers.default');
      }
    };

    return { init, api };
  }
};
```

#### Core Responsibilities

1. **Schema Validation**: Enforce required fields and type constraints on config.json
2. **Read-Only Access**: Freeze configuration object to prevent accidental mutations
3. **Dot-Notation Paths**: Support `get('providers.default')` for nested values
4. **Type Safety**: Validate personas, upgrades, providers structure
5. **Error Reporting**: Detailed validation errors with field-level diagnostics
6. **Helper Methods**: Convenience accessors for common configuration lookups

### 3. The Implementation Pathway

#### Step 1: Define Configuration Schema

Create schema with required fields and expected types:

```javascript
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
```

#### Step 2: Implement Schema Validation

Validate configuration object against schema:

```javascript
const validateConfig = (config) => {
  const errors = [];

  // 1. Type checking for required fields
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

  // 2. Validate nested structures
  validatePersonas(config.personas, errors);
  validateUpgrades(config.upgrades, errors);
  validateProviders(config.providers, errors);

  if (errors.length > 0) {
    throw new ConfigError(`Validation failed:\n${errors.join('\n')}`);
  }
};
```

#### Step 3: Implement Configuration Loader

Load and validate config.json:

```javascript
const init = async () => {
  try {
    // Load from VFS or fetch
    const configContent = await fetch('/config.json').then(r => r.text());
    const config = JSON.parse(configContent);

    // Validate
    validateConfig(config);

    // Freeze and store
    _config = Object.freeze(config);
    _loadTime = Date.now();

    logger.info('[Config] Configuration loaded successfully');
  } catch (error) {
    logger.error('[Config] Load failed:', error);
    throw error;
  }
};
```

#### Step 4: Implement Read-Only Accessor

Support dot-notation path access:

```javascript
const get = (path, defaultValue) => {
  if (!_config) {
    throw new ConfigError('Configuration not loaded');
  }

  const keys = path.split('.');
  let value = _config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value;
};
```

#### Step 5: Add Helper Methods

Create convenience accessors for common patterns:

```javascript
const getPersona = (personaId) => {
  const personas = get('personas', []);
  return personas.find(p => p.id === personaId);
};

const getUpgradesByCategory = (category) => {
  const upgrades = get('upgrades', []);
  return upgrades.filter(u => u.category === category);
};
```

#### Step 6: Return Public API

```javascript
return {
  init,
  api: {
    get,
    getAll,
    isLoaded,
    getLoadTime,
    getPersona,
    getActivePersona,
    getUpgrade,
    getUpgradesByCategory,
    getProvider,
    getDefaultProvider
  }
};
```

### 4. Operational Safeguards & Quality Gates

- **Immutability**: Use `Object.freeze()` to prevent configuration mutations
- **Init Check**: All API methods check `_config !== null` before access
- **Validation First**: Never store unvalidated configuration
- **Error Messages**: Include field names and actual/expected types in validation errors
- **Default Values**: Support default values in `get()` for optional fields

### 5. Extension Points

- **Hot Reload**: Implement `reload()` method to update configuration at runtime
- **Change Notifications**: Emit events when configuration changes
- **Configuration Diff**: Track changes between old and new configuration
- **Partial Validation**: Validate individual sections independently
- **Type Definitions**: Generate TypeScript definitions from schema

Use this blueprint whenever modifying configuration structure, adding validation rules, or implementing configuration-driven features.
