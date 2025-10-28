// @blueprint 0x00002D - Specifies module integrity signing and verification.
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

    // Track signing stats for widget
    let signatureStats = { totalSigned: 0, totalVerified: 0, verificationPassed: 0, verificationFailed: 0, lastSigned: null };

    // Wrap signModule to track stats
    const originalSignModule = signModule;
    const trackedSignModule = async (moduleId, code, version) => {
      const result = await originalSignModule(moduleId, code, version);
      signatureStats.totalSigned++;
      signatureStats.lastSigned = { moduleId, timestamp: Date.now() };
      return result;
    };

    // Wrap verifyModule to track stats
    const originalVerifyModule = verifyModule;
    const trackedVerifyModule = async (code, signature) => {
      const result = await originalVerifyModule(code, signature);
      signatureStats.totalVerified++;
      if (result.valid) {
        signatureStats.verificationPassed++;
      } else {
        signatureStats.verificationFailed++;
      }
      return result;
    };

    // Widget interface - Web Component
    const widget = (() => {
      class ModuleIntegrityWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this._api = null;
        }

        connectedCallback() {
          this.render();
        }

        disconnectedCallback() {
          // No cleanup needed for manual updates
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        async getStatus() {
          const status = await getStatus();

          return {
            state: status.enabled ? 'idle' : 'disabled',
            primaryMetric: `${status.signedModules} signed`,
            secondaryMetric: signatureStats.totalVerified > 0
              ? `${Math.round((signatureStats.verificationPassed / signatureStats.totalVerified) * 100)}% verified`
              : 'No verifications',
            lastActivity: signatureStats.lastSigned?.timestamp || status.lastUpdate,
            message: status.enabled ? null : 'No signatures found'
          };
        }

        async render() {
          const status = await getStatus();

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: system-ui, -apple-system, sans-serif;
              }
              .module-integrity-panel {
                padding: 15px;
                color: #e0e0e0;
              }
              .controls {
                margin-bottom: 15px;
                display: flex;
                gap: 10px;
              }
              button {
                padding: 8px 12px;
                border: 1px solid #555;
                background: rgba(255,255,255,0.05);
                color: #e0e0e0;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
              }
              button:hover {
                background: rgba(255,255,255,0.1);
                border-color: #0ff;
              }
              .integrity-stats {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
              }
              .stat-card {
                padding: 10px;
                border-radius: 5px;
              }
              .stat-card > div:first-child {
                color: #888;
                font-size: 12px;
              }
              .stat-card > div:last-child {
                font-size: 24px;
                font-weight: bold;
              }
              .signature-info, .last-signed, .security-notes {
                padding: 12px;
                border-radius: 5px;
                margin-bottom: 20px;
              }
              .signature-info {
                background: rgba(0,255,255,0.1);
                padding: 15px;
              }
              .last-signed {
                background: rgba(156,39,176,0.1);
              }
              .security-notes {
                background: rgba(255,193,7,0.1);
                border-left: 3px solid #ffc107;
              }
              h4 {
                color: #0ff;
                margin: 0 0 10px 0;
                font-size: 14px;
              }
            </style>
            <div class="module-integrity-panel">
              <div class="controls">
                <button class="sign-all">✍️ Sign All</button>
              </div>

              <div class="integrity-stats">
                <div class="stat-card" style="background: rgba(0,255,255,0.1);">
                  <div>Signed</div>
                  <div style="color: #0ff;">${signatureStats.totalSigned}</div>
                </div>
                <div class="stat-card" style="background: rgba(156,39,176,0.1);">
                  <div>Verified</div>
                  <div style="color: #9c27b0;">${signatureStats.totalVerified}</div>
                </div>
                <div class="stat-card" style="background: rgba(76,175,80,0.1);">
                  <div>Passed</div>
                  <div style="color: #4caf50;">${signatureStats.verificationPassed}</div>
                </div>
                <div class="stat-card" style="background: rgba(244,67,54,0.1);">
                  <div>Failed</div>
                  <div style="color: #f44336;">${signatureStats.verificationFailed}</div>
                </div>
              </div>

              <div class="signature-info">
                <h4>Signature System</h4>
                <div style="font-size: 13px; color: #ccc; line-height: 1.8;">
                  <div><strong>Algorithm:</strong> HMAC-SHA256</div>
                  <div><strong>Status:</strong> ${status.enabled ? '✓ Active' : '○ Inactive'}</div>
                  <div><strong>Signed Modules:</strong> ${status.signedModules}</div>
                  ${status.lastUpdate ? `
                    <div><strong>Last Update:</strong> ${new Date(status.lastUpdate).toLocaleString()}</div>
                  ` : ''}
                </div>
              </div>

              ${signatureStats.lastSigned ? `
                <div class="last-signed">
                  <div style="font-weight: bold; margin-bottom: 6px; color: #9c27b0;">Last Signed Module</div>
                  <div style="font-size: 14px; color: #ccc;">${signatureStats.lastSigned.moduleId}</div>
                  <div style="font-size: 11px; color: #666; margin-top: 4px;">
                    ${new Date(signatureStats.lastSigned.timestamp).toLocaleString()}
                  </div>
                </div>
              ` : ''}

              <div class="security-notes">
                <div style="font-weight: bold; margin-bottom: 6px; color: #ffc107;">⚠️ Security Notice</div>
                <div style="font-size: 12px; color: #ccc; line-height: 1.6;">
                  This system uses HMAC for lightweight module signing. In production environments, use asymmetric cryptography (RSA/ECDSA) with proper key management.
                </div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.sign-all')?.addEventListener('click', async () => {
            const result = await signAllModules();
            if (typeof EventBus !== 'undefined') {
              EventBus.emit('toast:success', { message: `Signed ${result.signed} modules` });
            }
            this.render();
          });
        }
      }

      if (!customElements.get('module-integrity-widget')) {
        customElements.define('module-integrity-widget', ModuleIntegrityWidget);
      }

      return {
        element: 'module-integrity-widget',
        displayName: 'Module Integrity',
        icon: '⚿',
        category: 'security',
        order: 50
      };
    })();

    return {
      calculateHash,
      signModule: trackedSignModule,
      verifyModule: trackedVerifyModule,
      signAllModules,
      verifyModuleById,
      getStatus,
      widget
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ModuleIntegrity);
}

export default ModuleIntegrity;
