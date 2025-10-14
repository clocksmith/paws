// Module Integrity Verification System
// Provides module signing and verification for secure self-modification

const ModuleIntegrity = {
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

    /**
     * Calculate SHA-256 hash of module code
     * @param {string} code - Module source code
     * @returns {Promise<string>} Hex-encoded hash
     */
    const calculateHash = async (code) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    };

    /**
     * Generate signature for a module
     * In production, this would use asymmetric crypto (private key signing)
     * For now, we use HMAC as a lightweight alternative
     *
     * @param {string} moduleId - Module ID
     * @param {string} code - Module source code
     * @param {string} version - Module version
     * @returns {Promise<Object>} Signature object
     */
    const signModule = async (moduleId, code, version = '1.0.0') => {
      const hash = await calculateHash(code);
      const timestamp = new Date().toISOString();

      // Create signature payload
      const payload = JSON.stringify({
        moduleId,
        version,
        hash,
        timestamp
      });

      // In production, sign with private key
      // For now, create HMAC with a system key
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('reploid-module-signing-key-v1'), // In prod, use secure key
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

      logger.info(`[ModuleIntegrity] Signed module ${moduleId}@${version}`, { hash });

      return {
        moduleId,
        version,
        hash,
        timestamp,
        signature: signatureHex,
        algorithm: 'HMAC-SHA256'
      };
    };

    /**
     * Verify module signature
     * @param {string} code - Module source code
     * @param {Object} signature - Signature object from signModule()
     * @returns {Promise<Object>} Verification result
     */
    const verifyModule = async (code, signature) => {
      const { moduleId, version, hash: expectedHash, timestamp, signature: sig, algorithm } = signature;

      // Calculate current hash
      const actualHash = await calculateHash(code);

      // Check hash match
      if (actualHash !== expectedHash) {
        logger.warn(`[ModuleIntegrity] Hash mismatch for ${moduleId}`, {
          expected: expectedHash,
          actual: actualHash
        });

        return {
          valid: false,
          reason: 'HASH_MISMATCH',
          moduleId,
          expectedHash,
          actualHash
        };
      }

      // Verify signature
      const payload = JSON.stringify({
        moduleId,
        version,
        hash: expectedHash,
        timestamp
      });

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

        return {
          valid: false,
          reason: 'INVALID_SIGNATURE',
          moduleId
        };
      }

      logger.info(`[ModuleIntegrity] Module ${moduleId}@${version} verified successfully`);

      return {
        valid: true,
        moduleId,
        version,
        hash: actualHash,
        timestamp
      };
    };

    /**
     * Sign all modules in VFS and store signatures
     * @returns {Promise<Object>} Map of moduleId -> signature
     */
    const signAllModules = async () => {
      const allMeta = await StateManager.getAllArtifactMetadata();
      const signatures = {};

      for (const [path, meta] of Object.entries(allMeta)) {
        // Only sign .js modules in upgrades/
        if (!path.startsWith('/vfs/upgrades/') || !path.endsWith('.js')) {
          continue;
        }

        const code = await StateManager.getArtifactContent(path);
        const moduleId = path.replace('/vfs/upgrades/', '').replace('.js', '');

        try {
          const signature = await signModule(moduleId, code);
          signatures[moduleId] = signature;
        } catch (err) {
          logger.error(`[ModuleIntegrity] Failed to sign ${moduleId}:`, err);
        }
      }

      // Store signatures in VFS
      await StateManager.saveArtifact(
        '/vfs/security/module-signatures.json',
        JSON.stringify(signatures, null, 2),
        { type: 'security', category: 'signatures' }
      );

      logger.info(`[ModuleIntegrity] Signed ${Object.keys(signatures).length} modules`);

      return signatures;
    };

    /**
     * Verify a module against stored signature
     * @param {string} moduleId - Module ID (without .js extension)
     * @param {string} code - Module source code
     * @returns {Promise<Object>} Verification result
     */
    const verifyModuleById = async (moduleId, code) => {
      // Load signatures
      let signaturesJson;
      try {
        signaturesJson = await StateManager.getArtifactContent('/vfs/security/module-signatures.json');
      } catch (err) {
        logger.warn('[ModuleIntegrity] No signatures found, module verification disabled');
        return {
          valid: null,
          reason: 'NO_SIGNATURES',
          moduleId
        };
      }

      const signatures = JSON.parse(signaturesJson);
      const signature = signatures[moduleId];

      if (!signature) {
        logger.warn(`[ModuleIntegrity] No signature found for ${moduleId}`);
        return {
          valid: null,
          reason: 'NO_SIGNATURE_FOR_MODULE',
          moduleId
        };
      }

      return await verifyModule(code, signature);
    };

    /**
     * Get module integrity status
     * @returns {Promise<Object>} Status object
     */
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
        return {
          enabled: false,
          signedModules: 0,
          lastUpdate: null
        };
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

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ModuleIntegrity);
}

export default ModuleIntegrity;
