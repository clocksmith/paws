/**
 * Configuration manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PawsConfig, ConfigFile, ConfigLoadOptions, ConfigLevel } from './types';
import { ErrorCatalog } from '../errors';
import { defaultConfig } from './defaults';

export class ConfigManager {
  private config: PawsConfig;
  private configPath?: string;
  private profile?: string;

  constructor(config: PawsConfig = {}, configPath?: string, profile?: string) {
    this.config = config;
    this.configPath = configPath;
    this.profile = profile;
  }

  /**
   * Get the current configuration
   */
  get(): PawsConfig {
    return { ...this.config };
  }

  /**
   * Get a specific config value by path (e.g., "providers.claude.apiKey")
   */
  getValue<T = any>(path: string): T | undefined {
    return getNestedValue(this.config, path);
  }

  /**
   * Set a specific config value by path
   */
  setValue(path: string, value: any): void {
    setNestedValue(this.config, path, value);
  }

  /**
   * Get config file path
   */
  getConfigPath(): string | undefined {
    return this.configPath;
  }

  /**
   * Get active profile name
   */
  getProfile(): string | undefined {
    return this.profile;
  }

  /**
   * Save configuration to file
   */
  async save(targetPath?: string): Promise<void> {
    const savePath = targetPath || this.configPath;

    if (!savePath) {
      throw ErrorCatalog.config.fileNotFound('(no config file path set)');
    }

    // Ensure directory exists
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing file to preserve profiles
    let fileData: ConfigFile = {};
    if (fs.existsSync(savePath)) {
      try {
        const content = fs.readFileSync(savePath, 'utf8');
        fileData = JSON.parse(content);
      } catch (error) {
        throw ErrorCatalog.config.invalidJson(savePath, error as Error);
      }
    }

    // Update profile or root config
    if (this.profile) {
      if (!fileData.profiles) {
        fileData.profiles = {};
      }
      fileData.profiles[this.profile] = this.config;
    } else {
      // Merge root-level config
      Object.assign(fileData, this.config);
    }

    // Write file
    const json = JSON.stringify(fileData, null, 2);
    fs.writeFileSync(savePath, json, 'utf8');
  }

  /**
   * Merge another config into this one
   */
  merge(other: PawsConfig): void {
    this.config = mergeConfigs(this.config, other);
  }

  /**
   * Load configuration from multiple sources and merge
   */
  static async load(
    cwd: string = process.cwd(),
    options: ConfigLoadOptions = {}
  ): Promise<ConfigManager> {
    const {
      searchUp = true,
      profile,
      allowMissing = true,
      mergeDefaults = true,
      expandEnv = true,
    } = options;

    // Start with default config
    let mergedConfig: PawsConfig = mergeDefaults ? { ...defaultConfig } : {};

    // Find and load config files from all levels
    const configFiles = await this.findConfigFiles(cwd, searchUp);

    let loadedPath: string | undefined;
    let loadedProfile: string | undefined;

    for (const filePath of configFiles) {
      try {
        const fileConfig = await this.loadConfigFile(filePath, profile);

        if (fileConfig) {
          mergedConfig = mergeConfigs(mergedConfig, fileConfig.config);

          // Use the most specific config path
          if (!loadedPath) {
            loadedPath = filePath;
            loadedProfile = fileConfig.profile;
          }
        }
      } catch (error) {
        if (!allowMissing) {
          throw error;
        }
        // Skip missing files if allowMissing is true
      }
    }

    // Apply environment variable overrides
    if (expandEnv) {
      mergedConfig = this.applyEnvOverrides(mergedConfig);
    }

    // Expand environment variables in string values
    if (expandEnv) {
      mergedConfig = expandEnvVars(mergedConfig);
    }

    return new ConfigManager(mergedConfig, loadedPath, loadedProfile || profile);
  }

  /**
   * Find all config files in order of precedence (system -> user -> project -> local)
   */
  private static async findConfigFiles(
    cwd: string,
    searchUp: boolean
  ): Promise<string[]> {
    const files: string[] = [];

    // System config
    if (process.platform !== 'win32') {
      files.push('/etc/pawsrc.json');
    }

    // User config
    files.push(path.join(os.homedir(), '.pawsrc.json'));

    // Project configs (search up from cwd)
    if (searchUp) {
      let currentDir = cwd;
      const root = path.parse(currentDir).root;

      while (true) {
        const configPath = path.join(currentDir, '.pawsrc.json');
        if (fs.existsSync(configPath)) {
          files.push(configPath);
          break; // Stop at first found (project root)
        }

        if (currentDir === root) break;
        currentDir = path.dirname(currentDir);
      }
    } else {
      // Just check cwd
      const configPath = path.join(cwd, '.pawsrc.json');
      if (fs.existsSync(configPath)) {
        files.push(configPath);
      }
    }

    // Filter to only existing files
    return files.filter((f) => fs.existsSync(f));
  }

  /**
   * Load and parse a config file
   */
  private static async loadConfigFile(
    filePath: string,
    profileName?: string
  ): Promise<{ config: PawsConfig; profile?: string } | null> {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw ErrorCatalog.fs.fileNotFound(filePath, 'read');
    }

    let fileData: ConfigFile;
    try {
      fileData = JSON.parse(content);
    } catch (error) {
      throw ErrorCatalog.config.invalidJson(filePath, error as Error);
    }

    // Determine which profile to use
    let selectedProfile = profileName || fileData.defaultProfile;
    let config: PawsConfig;

    if (selectedProfile && fileData.profiles?.[selectedProfile]) {
      config = fileData.profiles[selectedProfile];
    } else if (fileData.profiles && !selectedProfile) {
      // No profile specified, use root config
      const { profiles, defaultProfile, ...rootConfig } = fileData;
      config = rootConfig;
    } else if (selectedProfile && !fileData.profiles?.[selectedProfile]) {
      throw ErrorCatalog.config.profileNotFound(selectedProfile);
    } else {
      // Use entire file as config
      config = fileData;
    }

    return { config, profile: selectedProfile };
  }

  /**
   * Apply environment variable overrides
   */
  private static applyEnvOverrides(config: PawsConfig): PawsConfig {
    const overridden = { ...config };

    // Provider API keys from environment
    if (process.env.ANTHROPIC_API_KEY) {
      if (!overridden.providers) overridden.providers = {};
      if (!overridden.providers.anthropic) overridden.providers.anthropic = {};
      overridden.providers.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
    }

    if (process.env.OPENAI_API_KEY) {
      if (!overridden.providers) overridden.providers = {};
      if (!overridden.providers.openai) overridden.providers.openai = {};
      overridden.providers.openai.apiKey = process.env.OPENAI_API_KEY;
    }

    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      if (!overridden.providers) overridden.providers = {};
      if (!overridden.providers.gemini) overridden.providers.gemini = {};
      overridden.providers.gemini.apiKey =
        process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }

    // Log level from environment
    if (process.env.PAWS_LOG_LEVEL) {
      if (!overridden.logging) overridden.logging = {};
      overridden.logging.level = process.env.PAWS_LOG_LEVEL.toUpperCase() as any;
    }

    // Debug mode
    if (process.env.PAWS_DEBUG === 'true') {
      if (!overridden.logging) overridden.logging = {};
      overridden.logging.level = 'DEBUG';
    }

    return overridden;
  }

  /**
   * Create a new config file with default values
   */
  static async init(targetPath: string, profile?: string): Promise<ConfigManager> {
    const config = { ...defaultConfig };

    // Create config file structure
    const fileData: ConfigFile = profile
      ? {
          defaultProfile: profile,
          profiles: {
            [profile]: config,
          },
        }
      : config;

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    const json = JSON.stringify(fileData, null, 2);
    fs.writeFileSync(targetPath, json, 'utf8');

    return new ConfigManager(config, targetPath, profile);
  }
}

/**
 * Merge two configs (deep merge)
 */
function mergeConfigs(base: PawsConfig, override: PawsConfig): PawsConfig {
  const merged = { ...base };

  for (const key in override) {
    const value = override[key as keyof PawsConfig];

    if (value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // Deep merge objects
      merged[key as keyof PawsConfig] = mergeConfigs(
        (merged[key as keyof PawsConfig] as any) || {},
        value as any
      ) as any;
    } else {
      // Shallow copy primitives and arrays
      merged[key as keyof PawsConfig] = value as any;
    }
  }

  return merged;
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Set nested value in object by path
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;

  let current = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

/**
 * Expand environment variables in config values
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 */
function expandEnvVars(config: any): any {
  if (typeof config === 'string') {
    return config.replace(/\$\{([^}:]+)(?::?-([^}]*))?\}/g, (_, varName, defaultValue) => {
      return process.env[varName] || defaultValue || '';
    });
  }

  if (Array.isArray(config)) {
    return config.map(expandEnvVars);
  }

  if (typeof config === 'object' && config !== null) {
    const expanded: any = {};
    for (const key in config) {
      expanded[key] = expandEnvVars(config[key]);
    }
    return expanded;
  }

  return config;
}
