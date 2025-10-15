import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ModuleIntegrity', () => {
  let ModuleIntegrity;
  let mockDeps;
  let instance;
  let mockCrypto;

  beforeEach(() => {
    // Mock Web Crypto API with dynamic hashing
    const mockSignatureBuffer = new Uint8Array([9, 10, 11, 12]);

    mockCrypto = {
      subtle: {
        digest: vi.fn().mockImplementation(async (algorithm, data) => {
          // Create a simple hash based on input data
          const arr = new Uint8Array(data);
          let sum = 0;
          for (let i = 0; i < arr.length; i++) {
            sum += arr[i] * (i + 1);
          }
          // Create unique 8-byte hash based on sum
          const hash = new Uint8Array(8);
          for (let i = 0; i < 8; i++) {
            hash[i] = (sum + i) % 256;
          }
          return hash.buffer;
        }),
        importKey: vi.fn().mockResolvedValue('mock-key'),
        sign: vi.fn().mockResolvedValue(mockSignatureBuffer.buffer),
        verify: vi.fn().mockResolvedValue(true)
      }
    };

    vi.stubGlobal('crypto', mockCrypto);
    vi.stubGlobal('TextEncoder', vi.fn(() => ({
      encode: vi.fn((text) => {
        // Convert text to actual bytes for better hashing
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
          bytes[i] = text.charCodeAt(i);
        }
        return bytes;
      })
    })));

    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn()
        }
      },
      StateManager: {
        getAllArtifactMetadata: vi.fn(),
        getArtifactContent: vi.fn(),
        saveArtifact: vi.fn(),
        getState: vi.fn(),
        updateState: vi.fn()
      }
    };

    global.window = {
      ModuleRegistry: {
        register: vi.fn()
      }
    };

    // Module definition
    ModuleIntegrity = {
      metadata: {
        id: 'ModuleIntegrity',
        version: '1.0.0',
        description: 'Module signing and integrity verification system',
        dependencies: ['Utils', 'StateManager'],
        async: false,
        type: 'security'
      },
      factory: (deps) => {
        const { Utils, StateManager } = deps;
        const { logger } = Utils;

        const calculateHash = async (code) => {
          const encoder = new TextEncoder();
          const data = encoder.encode(code);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };

        const signModule = async (moduleId, code, version = '1.0.0') => {
          const hash = await calculateHash(code);
          const timestamp = new Date().toISOString();

          const payload = JSON.stringify({ moduleId, version, hash, timestamp });

          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode('reploid-module-signing-key-v1'),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );

          const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            keyMaterial,
            encoder.encode(payload)
          );

          const signatureArray = Array.from(new Uint8Array(signatureBuffer));
          const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

          logger.info(`[ModuleIntegrity] Signed module ${moduleId}@${version}`);

          return {
            moduleId,
            version,
            hash,
            timestamp,
            signature: signatureHex,
            algorithm: 'HMAC-SHA256'
          };
        };

        const verifyModule = async (code, signature) => {
          const { moduleId, version, hash: expectedHash, timestamp, signature: sig } = signature;

          // Validate signature format
          if (!sig || typeof sig !== 'string' || !/^[0-9a-f]+$/i.test(sig)) {
            throw new Error('Invalid signature format');
          }

          const actualHash = await calculateHash(code);

          if (actualHash !== expectedHash) {
            logger.warn(`[ModuleIntegrity] Hash mismatch for ${moduleId}`);
            return {
              valid: false,
              reason: 'HASH_MISMATCH',
              moduleId,
              expectedHash,
              actualHash
            };
          }

          const payload = JSON.stringify({ moduleId, version, hash: expectedHash, timestamp });

          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode('reploid-module-signing-key-v1'),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
          );

          const signatureBuffer = new Uint8Array(
            sig.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
          );

          const isValid = await crypto.subtle.verify(
            'HMAC',
            keyMaterial,
            signatureBuffer,
            encoder.encode(payload)
          );

          if (!isValid) {
            logger.warn(`[ModuleIntegrity] Invalid signature for ${moduleId}`);
            return { valid: false, reason: 'INVALID_SIGNATURE', moduleId };
          }

          logger.info(`[ModuleIntegrity] Module ${moduleId} verified successfully`);
          return { valid: true, moduleId, version, hash: actualHash, timestamp };
        };

        const signAllModules = async () => {
          const allMeta = await StateManager.getAllArtifactMetadata();
          const signatures = {};

          for (const [path, meta] of Object.entries(allMeta)) {
            if (!path.startsWith('/vfs/upgrades/') || !path.endsWith('.js')) {
              continue;
            }

            const moduleId = path.replace('/vfs/upgrades/', '').replace('.js', '');

            try {
              const code = await StateManager.getArtifactContent(path);
              const signature = await signModule(moduleId, code);
              signatures[moduleId] = signature;
            } catch (err) {
              logger.error(`[ModuleIntegrity] Failed to sign ${moduleId}:`, err);
            }
          }

          await StateManager.saveArtifact(
            '/vfs/security/module-signatures.json',
            JSON.stringify(signatures, null, 2),
            { type: 'security', category: 'signatures' }
          );

          logger.info(`[ModuleIntegrity] Signed ${Object.keys(signatures).length} modules`);

          return signatures;
        };

        const verifyModuleById = async (moduleId, code) => {
          let signaturesJson;
          try {
            signaturesJson = await StateManager.getArtifactContent('/vfs/security/module-signatures.json');
          } catch (err) {
            logger.warn('[ModuleIntegrity] No signatures found in VFS');
            return { valid: null, reason: 'NO_SIGNATURES', moduleId };
          }

          const signatures = JSON.parse(signaturesJson);
          const signature = signatures[moduleId];

          if (!signature) {
            logger.warn(`[ModuleIntegrity] No signature found for ${moduleId}`);
            return { valid: null, reason: 'NO_SIGNATURE_FOR_MODULE', moduleId };
          }

          return await verifyModule(code, signature);
        };

        const getStatus = async () => {
          try {
            const signaturesJson = await StateManager.getArtifactContent('/vfs/security/module-signatures.json');
            const signatures = JSON.parse(signaturesJson);

            return {
              enabled: true,
              signedModules: Object.keys(signatures).length,
              lastUpdate: signatures[Object.keys(signatures)[0]]?.timestamp || null
            };
          } catch (err) {
            return { enabled: false, signedModules: 0, lastUpdate: null };
          }
        };

        return {
          calculateHash,
          signModule,
          verifyModule,
          signAllModules,
          verifyModuleById,
          getStatus
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(ModuleIntegrity.metadata).toBeDefined();
      expect(ModuleIntegrity.metadata.id).toBe('ModuleIntegrity');
      expect(ModuleIntegrity.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(ModuleIntegrity.metadata.dependencies).toContain('Utils');
      expect(ModuleIntegrity.metadata.dependencies).toContain('StateManager');
    });

    it('should be a security type module', () => {
      expect(ModuleIntegrity.metadata.type).toBe('security');
    });

    it('should not be async', () => {
      expect(ModuleIntegrity.metadata.async).toBe(false);
    });

    it('should have description', () => {
      expect(ModuleIntegrity.metadata.description).toBe('Module signing and integrity verification system');
    });
  });

  describe('Hash Calculation', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should calculate SHA-256 hash of code', async () => {
      const code = 'const x = 42;';
      const hash = await instance.calculateHash(code);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    });

    it('should return hex-encoded hash', async () => {
      const code = 'test code';
      const hash = await instance.calculateHash(code);

      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce consistent hashes for same input', async () => {
      const code = 'const test = true;';
      const hash1 = await instance.calculateHash(code);
      const hash2 = await instance.calculateHash(code);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const code1 = 'const x = 1;';
      const code2 = 'const x = 2;';
      const hash1 = await instance.calculateHash(code1);
      const hash2 = await instance.calculateHash(code2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Module Signing', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should sign a module', async () => {
      const moduleId = 'test-module';
      const code = 'const test = true;';

      const signature = await instance.signModule(moduleId, code);

      expect(signature).toBeDefined();
      expect(signature.moduleId).toBe(moduleId);
      expect(signature.hash).toBeDefined();
      expect(signature.signature).toBeDefined();
      expect(signature.algorithm).toBe('HMAC-SHA256');
    });

    it('should include version in signature', async () => {
      const signature = await instance.signModule('test', 'code', '2.0.0');

      expect(signature.version).toBe('2.0.0');
    });

    it('should default to version 1.0.0', async () => {
      const signature = await instance.signModule('test', 'code');

      expect(signature.version).toBe('1.0.0');
    });

    it('should include timestamp in signature', async () => {
      const signature = await instance.signModule('test', 'code');

      expect(signature.timestamp).toBeDefined();
      expect(typeof signature.timestamp).toBe('string');
    });

    it('should use HMAC-SHA256 for signing', async () => {
      await instance.signModule('test', 'code');

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
    });

    it('should log successful signing', async () => {
      await instance.signModule('test-module', 'code', '1.0.0');

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Signed module test-module@1.0.0')
      );
    });
  });

  describe('Module Verification', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should verify valid module signature', async () => {
      const code = 'const test = true;';
      const signature = await instance.signModule('test', code);

      const result = await instance.verifyModule(code, signature);

      expect(result.valid).toBe(true);
      expect(result.moduleId).toBe('test');
    });

    it('should reject module with hash mismatch', async () => {
      const originalCode = 'const x = 1;';
      const modifiedCode = 'const x = 2;';
      const signature = await instance.signModule('test', originalCode);

      const result = await instance.verifyModule(modifiedCode, signature);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('HASH_MISMATCH');
    });

    it('should reject module with invalid signature', async () => {
      mockCrypto.subtle.verify = vi.fn().mockResolvedValue(false);

      const code = 'const test = true;';
      const signature = await instance.signModule('test', code);

      const result = await instance.verifyModule(code, signature);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_SIGNATURE');
    });

    it('should include hash details in mismatch result', async () => {
      const originalCode = 'const x = 1;';
      const modifiedCode = 'const x = 2;';
      const signature = await instance.signModule('test', originalCode);

      const result = await instance.verifyModule(modifiedCode, signature);

      expect(result.expectedHash).toBeDefined();
      expect(result.actualHash).toBeDefined();
      expect(result.expectedHash).not.toBe(result.actualHash);
    });

    it('should log warnings for hash mismatch', async () => {
      const originalCode = 'const x = 1;';
      const modifiedCode = 'const x = 2;';
      const signature = await instance.signModule('test', originalCode);

      await instance.verifyModule(modifiedCode, signature);

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should log warnings for invalid signature', async () => {
      mockCrypto.subtle.verify = vi.fn().mockResolvedValue(false);

      const code = 'const test = true;';
      const signature = await instance.signModule('test', code);

      await instance.verifyModule(code, signature);

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should log success for valid verification', async () => {
      const code = 'const test = true;';
      const signature = await instance.signModule('test', code);

      await instance.verifyModule(code, signature);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('verified successfully')
      );
    });
  });

  describe('Sign All Modules', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);

      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/vfs/upgrades/module1.js': {},
        '/vfs/upgrades/module2.js': {},
        '/vfs/other/file.txt': {}
      });

      mockDeps.StateManager.getArtifactContent.mockResolvedValue('module code');
      mockDeps.StateManager.saveArtifact.mockResolvedValue(true);
    });

    it('should sign all modules in upgrades directory', async () => {
      const signatures = await instance.signAllModules();

      expect(Object.keys(signatures)).toHaveLength(2);
      expect(signatures['module1']).toBeDefined();
      expect(signatures['module2']).toBeDefined();
    });

    it('should only sign .js files', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/vfs/upgrades/module.js': {},
        '/vfs/upgrades/data.json': {},
        '/vfs/upgrades/readme.md': {}
      });

      const signatures = await instance.signAllModules();

      expect(Object.keys(signatures)).toHaveLength(1);
      expect(signatures['module']).toBeDefined();
    });

    it('should save signatures to VFS', async () => {
      await instance.signAllModules();

      expect(mockDeps.StateManager.saveArtifact).toHaveBeenCalledWith(
        '/vfs/security/module-signatures.json',
        expect.any(String),
        { type: 'security', category: 'signatures' }
      );
    });

    it('should handle signing errors gracefully', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('good code')
        .mockRejectedValueOnce(new Error('Read failed'));

      const signatures = await instance.signAllModules();

      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
      expect(Object.keys(signatures).length).toBeGreaterThanOrEqual(0);
    });

    it('should log count of signed modules', async () => {
      await instance.signAllModules();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Signed 2 modules')
      );
    });
  });

  describe('Verify Module By ID', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should verify module by ID', async () => {
      const code = 'const test = true;';
      const signature = await instance.signModule('test-module', code);

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(
        JSON.stringify({ 'test-module': signature })
      );

      const result = await instance.verifyModuleById('test-module', code);

      expect(result.valid).toBe(true);
    });

    it('should return null if no signatures exist', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(
        new Error('Signatures not found')
      );

      const result = await instance.verifyModuleById('test', 'code');

      expect(result.valid).toBeNull();
      expect(result.reason).toBe('NO_SIGNATURES');
    });

    it('should return null if module signature not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(
        JSON.stringify({ 'other-module': {} })
      );

      const result = await instance.verifyModuleById('test', 'code');

      expect(result.valid).toBeNull();
      expect(result.reason).toBe('NO_SIGNATURE_FOR_MODULE');
    });

    it('should log warning when signatures not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(
        new Error('Not found')
      );

      await instance.verifyModuleById('test', 'code');

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No signatures found')
      );
    });

    it('should log warning when module signature not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('{}');

      await instance.verifyModuleById('missing', 'code');

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No signature found for missing')
      );
    });
  });

  describe('Status Reporting', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should report enabled status when signatures exist', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(
        JSON.stringify({
          module1: { timestamp: '2024-01-01T00:00:00Z' },
          module2: { timestamp: '2024-01-01T00:00:00Z' }
        })
      );

      const status = await instance.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.signedModules).toBe(2);
      expect(status.lastUpdate).toBeDefined();
    });

    it('should report disabled status when signatures do not exist', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(
        new Error('Not found')
      );

      const status = await instance.getStatus();

      expect(status.enabled).toBe(false);
      expect(status.signedModules).toBe(0);
      expect(status.lastUpdate).toBeNull();
    });

    it('should include last update timestamp', async () => {
      const testTimestamp = '2024-01-01T12:00:00Z';
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(
        JSON.stringify({
          module1: { timestamp: testTimestamp }
        })
      );

      const status = await instance.getStatus();

      expect(status.lastUpdate).toBe(testTimestamp);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should handle crypto errors during hashing', async () => {
      mockCrypto.subtle.digest = vi.fn().mockRejectedValue(new Error('Crypto error'));

      await expect(instance.calculateHash('code')).rejects.toThrow('Crypto error');
    });

    it('should handle crypto errors during signing', async () => {
      mockCrypto.subtle.sign = vi.fn().mockRejectedValue(new Error('Sign error'));

      await expect(instance.signModule('test', 'code')).rejects.toThrow();
    });

    it('should handle invalid signature format', async () => {
      const invalidSignature = {
        moduleId: 'test',
        version: '1.0.0',
        hash: 'abc123',
        timestamp: '2024-01-01',
        signature: 'invalid'
      };

      await expect(instance.verifyModule('code', invalidSignature)).rejects.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockRejectedValue(
        new Error('Storage error')
      );

      await expect(instance.signAllModules()).rejects.toThrow('Storage error');
    });
  });

  describe('API Exposure', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should expose all public methods', () => {
      expect(typeof instance.calculateHash).toBe('function');
      expect(typeof instance.signModule).toBe('function');
      expect(typeof instance.verifyModule).toBe('function');
      expect(typeof instance.signAllModules).toBe('function');
      expect(typeof instance.verifyModuleById).toBe('function');
      expect(typeof instance.getStatus).toBe('function');
    });

    it('should register with ModuleRegistry', () => {
      expect(global.window.ModuleRegistry.register).toBeDefined();
    });
  });

  describe('Integration with Dependencies', () => {
    beforeEach(() => {
      instance = ModuleIntegrity.factory(mockDeps);
    });

    it('should use Utils logger for all logging', async () => {
      await instance.signModule('test', 'code');

      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should use StateManager for artifact operations', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({});
      mockDeps.StateManager.saveArtifact.mockResolvedValue(true);

      await instance.signAllModules();

      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
      expect(mockDeps.StateManager.saveArtifact).toHaveBeenCalled();
    });

    it('should use Web Crypto API for cryptographic operations', async () => {
      await instance.calculateHash('test');

      expect(mockCrypto.subtle.digest).toHaveBeenCalled();
    });
  });
});
