# Blueprint 0x000033: Module Integrity Verification

**Objective:** Define the signing, hashing, and verification processes that guard REPLOID against tampered upgrades.

**Target Upgrade:** MINT (`module-integrity.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000005 (State Management Architecture), 0x000025 (Universal Module Loader)

**Affected Artifacts:** `/upgrades/module-integrity.js`, `/vfs/security/module-signatures.json`, `/upgrades/boot-module-loader.js`

---

### 1. The Strategic Imperative
Self-modifying software must prove that the code it loads is authorized. Integrity checks prevent:
- Malicious modules hijacking the upgrade pipeline.
- Accidental corruption during hot reloads.
- Inconsistent replicas across personas.

### 2. Architectural Overview
`ModuleIntegrity` ships with HMAC-based signing that can be swapped for asymmetric crypto.

```javascript
const Integrity = await ModuleLoader.getModule('ModuleIntegrity');
const signature = await Integrity.signModule('tool-runner', code);
const status = await Integrity.verifyModule(code, signature);
```

Core components:
- **Hashing**: `calculateHash(code)` uses Web Crypto `SHA-256` to generate digest.
- **Signing**: `signModule(moduleId, code, version)` returns `{ hash, timestamp, signature, algorithm }` using HMAC-SHA256 (placeholder for production keys).
- **Verification**: `verifyModule(code, signature)` recomputes hash and validates HMAC via `crypto.subtle.verify`.
- **Bulk Operations**:
  - `signAllModules()` iterates `/vfs/upgrades/*.js`, signs each, and stores results in `/vfs/security/module-signatures.json`.
  - `verifyModuleById(moduleId, code)` loads stored signatures and verifies specific module.
- **Status API**: `getStatus()` reports signature availability and last update timestamp.

### 3. Implementation Pathway
1. **Initial Setup**
   - Generate signing key securely (replace placeholder string) and store in privileged environment.
   - Include `module-signatures.json` in release artifacts.
2. **CI / CD Integration**
   - During build, run `signAllModules()` to produce signatures.
   - Ship signatures alongside module bundle; loader verifies at boot.
3. **Runtime Verification**
   - `ModuleLoader.loadModule` should call `ModuleIntegrity.verifyModuleById` before executing module code; log and abort on failure.
   - Provide “quarantine mode” that disables suspect modules but keeps UI operational.
4. **Rotation & Revocation**
   - Version signatures; include `version` field in payload.
   - On key rotation, regenerate signatures and update blueprint metadata.
- **Incident Response**
   - For mismatches, emit toast + audit log entry detailing expected vs actual hash.
   - Auto-capture tampered code to `/vfs/security/quarantine/<module>.js` for analysis.

### 4. Verification Checklist
- [ ] Hash mismatch detection triggers warning and prevents module execution.
- [ ] `signAllModules` skips non-JS artifacts gracefully.
- [ ] Signatures file stored with metadata (type: security, category: signatures).
- [ ] Unit tests cover valid signature, hash mismatch, missing signature cases.
- [ ] Browser compatibility confirmed (Web Crypto availability).

### 5. Extension Opportunities
- Move to asymmetric signatures (Ed25519) with offline private key.
- Record signature metadata (author, changelog hash).
- Integrate with audit logs to track verification events.
- Provide UI surface to re-sign modules after deliberate edits (with human confirmation).

Update this blueprint whenever the signing algorithm, storage path, or loader integration strategy changes.
