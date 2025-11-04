/**
 * Unit tests for configuration management
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, validateConfig, defaultConfig } from '../../src/core/config';

describe('Configuration Management', () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-config-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ConfigManager', () => {
    it('should create default config', () => {
      const manager = new ConfigManager(defaultConfig);
      const config = manager.get();

      expect(config.version).to.equal('1.0.0');
      expect(config.providers).to.exist;
      expect(config.pricing).to.exist;
    });

    it('should get nested values', () => {
      const manager = new ConfigManager({
        providers: {
          anthropic: {
            apiKey: 'test-key',
          },
        },
      });

      const apiKey = manager.getValue('providers.anthropic.apiKey');
      expect(apiKey).to.equal('test-key');
    });

    it('should set nested values', () => {
      const manager = new ConfigManager({});

      manager.setValue('providers.anthropic.apiKey', 'new-key');

      const config = manager.get();
      expect(config.providers?.anthropic?.apiKey).to.equal('new-key');
    });

    it('should save config to file', async () => {
      const configPath = path.join(testDir, '.pawsrc.json');
      const manager = new ConfigManager(
        { logging: { level: 'DEBUG' } },
        configPath
      );

      await manager.save();

      expect(fs.existsSync(configPath)).to.be.true;

      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.logging.level).to.equal('DEBUG');
    });

    it('should load config from file', async () => {
      const configPath = path.join(testDir, '.pawsrc.json');

      // Write config file
      const configData = {
        version: '1.0.0',
        logging: {
          level: 'INFO',
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

      // Load config
      const manager = await ConfigManager.load(testDir, {
        searchUp: false,
        mergeDefaults: false,
      });

      const config = manager.get();
      expect(config.logging?.level).to.equal('INFO');
    });

    it('should merge configs from multiple levels', async () => {
      // Create config files at different levels
      const userDir = path.join(testDir, 'user');
      const projectDir = path.join(testDir, 'user', 'project');
      fs.mkdirSync(userDir, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });

      // User level config
      fs.writeFileSync(
        path.join(userDir, '.pawsrc.json'),
        JSON.stringify({
          logging: { level: 'INFO' },
          providers: { anthropic: { timeout: 30000 } },
        })
      );

      // Project level config (overrides)
      fs.writeFileSync(
        path.join(projectDir, '.pawsrc.json'),
        JSON.stringify({
          logging: { level: 'DEBUG' },
        })
      );

      // Load from project directory
      const manager = await ConfigManager.load(projectDir, {
        searchUp: true,
        mergeDefaults: false,
      });

      const config = manager.get();

      // Project level should override
      expect(config.logging?.level).to.equal('DEBUG');

      // User level should still be present
      expect(config.providers?.anthropic?.timeout).to.equal(30000);
    });

    it('should support environment variable expansion', async () => {
      process.env.TEST_API_KEY = 'secret-key';

      const configPath = path.join(testDir, '.pawsrc.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          providers: {
            test: {
              apiKey: '${TEST_API_KEY}',
            },
          },
        })
      );

      const manager = await ConfigManager.load(testDir, {
        searchUp: false,
        expandEnv: true,
        mergeDefaults: false,
      });

      const apiKey = manager.getValue('providers.test.apiKey');
      expect(apiKey).to.equal('secret-key');

      delete process.env.TEST_API_KEY;
    });

    it('should support profiles', async () => {
      const configPath = path.join(testDir, '.pawsrc.json');

      fs.writeFileSync(
        configPath,
        JSON.stringify({
          defaultProfile: 'dev',
          profiles: {
            dev: {
              logging: { level: 'DEBUG' },
            },
            prod: {
              logging: { level: 'ERROR' },
            },
          },
        })
      );

      // Load dev profile
      const devManager = await ConfigManager.load(testDir, {
        searchUp: false,
        profile: 'dev',
        mergeDefaults: false,
      });

      expect(devManager.getValue('logging.level')).to.equal('DEBUG');

      // Load prod profile
      const prodManager = await ConfigManager.load(testDir, {
        searchUp: false,
        profile: 'prod',
        mergeDefaults: false,
      });

      expect(prodManager.getValue('logging.level')).to.equal('ERROR');
    });
  });

  describe('Config Validation', () => {
    it('should validate valid config', () => {
      const result = validateConfig(defaultConfig);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should detect invalid log level', () => {
      const result = validateConfig({
        logging: {
          level: 'INVALID' as any,
        },
      });

      expect(result.valid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
    });

    it('should detect invalid pricing', () => {
      const result = validateConfig({
        pricing: {
          'test-model': {
            inputCostPer1kTokens: -1,
            outputCostPer1kTokens: 0.01,
          },
        },
      });

      expect(result.valid).to.be.false;
      expect(result.errors.some((e) => e.includes('test-model'))).to.be.true;
    });
  });
});
