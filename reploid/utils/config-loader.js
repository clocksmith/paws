// Unified Configuration Loader for REPLOID
// Supports .reploidrc.json with environment variable expansion

const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigLoader {
  constructor() {
    this.config = null;
    this.configPath = null;
    this.searchPaths = [
      '.reploidrc.json',
      '.reploidrc',
      path.join(process.cwd(), '.reploidrc.json'),
      path.join(os.homedir(), '.reploidrc.json'),
      path.join(os.homedir(), '.config', 'reploid', 'config.json'),
      '/etc/reploid/config.json'
    ];
  }

  async load() {
    // Try each search path
    for (const searchPath of this.searchPaths) {
      const absPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(searchPath);

      if (this.fileExists(absPath)) {
        try {
          const raw = fs.readFileSync(absPath, 'utf8');
          this.config = this.parseConfig(raw);
          this.configPath = absPath;
          console.log(`[Config] Loaded from: ${absPath}`);
          return this.config;
        } catch (err) {
          console.error(`[Config] Failed to load ${absPath}:`, err.message);
        }
      }
    }

    // No config found, use defaults
    console.log('[Config] No config file found, using defaults');
    this.config = this.getDefaults();
    return this.config;
  }

  fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  parseConfig(raw) {
    let config;

    try {
      config = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in config file: ${err.message}`);
    }

    // Expand environment variables
    this.expandEnvVars(config);

    // Merge with defaults
    config = this.mergeWithDefaults(config);

    // Validate config
    this.validateConfig(config);

    return config;
  }

  expandEnvVars(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Replace ${VAR_NAME} with environment variable value
        obj[key] = obj[key].replace(/\$\{(\w+)\}/g, (_, varName) => {
          const value = process.env[varName];
          if (value === undefined) {
            console.warn(`[Config] Environment variable ${varName} not set, using empty string`);
            return '';
          }
          return value;
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.expandEnvVars(obj[key]);
      }
    }
  }

  getDefaults() {
    return {
      version: '1.0',
      api: {
        provider: 'gemini',
        geminiKey: process.env.GEMINI_API_KEY || '',
        openaiKey: process.env.OPENAI_API_KEY || '',
        anthropicKey: process.env.ANTHROPIC_API_KEY || '',
        localEndpoint: 'http://localhost:11434',
        timeout: 120000,
        maxRetries: 3
      },
      server: {
        port: 8000,
        host: 'localhost',
        corsOrigins: ['http://localhost:8080'],
        sessionTimeout: 3600000,
        maxSessions: 100
      },
      cli: {
        maxFileSize: 102400,
        verbose: false,
        defaultOutput: './output',
        excludeDirs: ['node_modules', '.git', 'dist', 'build', '.cache']
      },
      sentinel: {
        requireApproval: true,
        autoBackup: true,
        verificationTimeout: 30000,
        maxCycles: 100,
        pauseOnError: true
      },
      workspace: {
        root: './sessions',
        maxSessions: 10,
        gitEnabled: true,
        autoCommit: true,
        checkpointInterval: 300000
      },
      vfs: {
        root: '/vfs',
        maxFileSize: 10485760,
        allowedExtensions: ['js', 'json', 'md', 'txt', 'css', 'html', 'yml', 'yaml'],
        gitIntegration: true
      },
      ui: {
        theme: 'cyberpunk',
        showAdvancedLogs: false,
        statusUpdateInterval: 1000,
        confirmDestructive: true
      }
    };
  }

  mergeWithDefaults(config) {
    const defaults = this.getDefaults();

    // Deep merge
    const merge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          merge(target[key], source[key]);
        } else if (target[key] === undefined) {
          target[key] = source[key];
        }
      }
      return target;
    };

    return merge(config, defaults);
  }

  validateConfig(config) {
    // Validate required fields
    if (!config.version) {
      throw new Error('Config missing "version" field');
    }

    // Validate API config
    if (config.api && config.api.timeout && config.api.timeout < 1000) {
      throw new Error('API timeout must be at least 1000ms');
    }

    // Validate server config
    if (config.server && config.server.port) {
      const port = parseInt(config.server.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Server port must be between 1 and 65535');
      }
    }

    // Validate workspace config
    if (config.workspace && config.workspace.maxSessions) {
      const max = parseInt(config.workspace.maxSessions);
      if (isNaN(max) || max < 1) {
        throw new Error('Max sessions must be at least 1');
      }
    }

    return true;
  }

  get(keyPath, defaultValue = undefined) {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }

    // Support dot notation: config.get('api.provider')
    const keys = keyPath.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(keyPath, value) {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }

    const keys = keyPath.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  async save() {
    if (!this.configPath) {
      throw new Error('No config file path set. Cannot save.');
    }

    try {
      const json = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, json, 'utf8');
      console.log(`[Config] Saved to: ${this.configPath}`);
      return true;
    } catch (err) {
      console.error(`[Config] Failed to save:`, err.message);
      throw err;
    }
  }

  async createDefault(filePath = '.reploidrc.json') {
    const defaults = this.getDefaults();
    const json = JSON.stringify(defaults, null, 2);

    try {
      fs.writeFileSync(filePath, json, 'utf8');
      console.log(`[Config] Created default config at: ${filePath}`);
      return filePath;
    } catch (err) {
      console.error(`[Config] Failed to create default config:`, err.message);
      throw err;
    }
  }

  getAll() {
    return this.config;
  }

  getConfigPath() {
    return this.configPath;
  }
}

// Singleton instance
let instance = null;

function getConfig() {
  if (!instance) {
    instance = new ConfigLoader();
  }
  return instance;
}

module.exports = {
  ConfigLoader,
  getConfig,
  // Export a loaded instance for convenience
  load: async () => {
    const config = getConfig();
    await config.load();
    return config;
  }
};