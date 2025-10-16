# Security Notes - REPLOID

This document tracks security considerations and mitigations for the REPLOID project.

## ✅ Addressed Security Issues

### 1. Iframe Sandbox - FIXED
**Location:** `ui-dashboard.html:42`
**Issue:** Using `sandbox="allow-scripts allow-same-origin"` together defeats the sandbox
**Fix:** Removed `allow-same-origin`, added CSP attribute
**Status:** ✅ COMPLETED

### 2. Shell Injection in cats CLI - MITIGATED
**Location:** `bin/cats:110-125`
**Issue:** User input patterns directly interpolated into shell commands
**Mitigation:** Added validation to reject patterns with shell metacharacters
**Status:** ✅ COMPLETED (partial - see recommendations below)

## ⚠️ Known Security Concerns

### 3. Dynamic Module Loading with Function Constructor
**Location:**
- `boot.js:238-242`
- `upgrades/boot-module-loader.js:32-42`

**Issue:**
The system uses `new Function()` to dynamically load and execute modules from VFS. This is necessary for the architecture but poses security risks:

```javascript
// boot.js
await (new Function(
    'initialConfig',
    'vfs',
    appLogicContent + '\nawait CoreLogicModule(initialConfig, vfs);'
))(state.config, vfs);

// boot-module-loader.js
const moduleDefinition = new Function(`
    ${code}
    if (typeof ${moduleId} !== 'undefined') {
      return ${moduleId};
    }
    ...
`)();
```

**Why it exists:**
- Enables dynamic module loading from VFS
- Supports hot-reloading and self-modification
- Core to REPLOID's self-improving architecture

**Risks:**
- Code injection if VFS is compromised
- Bypasses Content Security Policy
- Can execute arbitrary JavaScript

**Mitigations in place:**
- VFS access is sandboxed in browser
- Modules loaded only from trusted VFS paths
- No direct user input executed

**Recommendations:**
1. Add module signing/verification
2. Implement module whitelist
3. Consider Web Worker isolation for module execution
4. Add integrity checks (hash validation)

**Decision:** ACCEPTED RISK - Core architectural requirement

---

### 4. No Input Sanitization in Goal Setting - MITIGATED ✅
**Location:**
- `index.html:47` - goal-input
- `boot.js:147-156` - sanitizeGoal()

**Issue:** User-provided goals are not sanitized before being processed by AI or stored

**Mitigations Applied:**
1. ✅ Added maxlength="500" to input field
2. ✅ Created sanitizeGoal() function that strips HTML tags
3. ✅ Trim whitespace and enforce 500 char limit
4. ⚠️ Display escaping handled by Utils.escapeHtml() where used

**Remaining Recommendations:**
- Add rate limiting (future enhancement)
- Add prompt injection detection patterns (future enhancement)

**Status:** ✅ MITIGATED (2025-09-30)

---

### 5. Predictable Session IDs - FIXED ✅
**Location:** `upgrades/state-manager.js:103-107`

**Original Issue:** Timestamp-based IDs were predictable and could collide

**Fix Applied:**
```javascript
// Now uses crypto.getRandomValues() for better uniqueness
const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
const sessionId = `session_${Date.now()}_${randomBytes}`;
```

**Status:** ✅ FIXED (Already implemented, documented 2025-09-30)

---

### 6. No API Rate Limiting - FIXED ✅
**Location:** `upgrades/api-client.js`, `upgrades/rate-limiter.js`

**Original Issue:** No rate limiting on API calls to external services

**Fix Applied:**
- Created `RateLimiter` module with two algorithms:
  - Token Bucket: Allows bursts, smooth rate over time
  - Sliding Window: Strict request counting in time window
- Integrated into `ApiClient` (v1.0.0 → v2.0.0)
- Default: 10 calls/min with burst capacity of 5 tokens
- Async `waitForToken()` function for graceful waiting
- Graceful degradation if RateLimiter unavailable

**Implementation:**
```javascript
// Rate limiter checks before each API call
if (rateLimiter) {
  const allowed = await RateLimiter.waitForToken(rateLimiter, 5000);
  if (!allowed) {
    throw new ApiError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
  }
}
```

**Status:** ✅ FIXED (2025-09-30)

---

### 7. Inline Event Handlers (Partial)
**Location:** Various UI components

**Issue:** Some onclick handlers still use inline HTML strings

**Status:** Mostly fixed in diff-viewer-ui.js, but may exist elsewhere

**Recommendation:** Audit all UI components and convert to event delegation

**Priority:** LOW

---

## 🔒 Security Best Practices

### For VFS Operations ✅ ENHANCED
1. Always validate paths are within session workspace
2. Never load code from user-uploaded files without verification
3. ✅ File size limits implemented (SEC-3)
4. Add virus/malware scanning for uploaded content (future)

**New Security Features:**
- File size limits enforced in StateManager
- Limits per file type: code (1 MB), documents (5 MB), data (10 MB), images (5 MB)
- Validation in createArtifact() and updateArtifact()
- Throws ArtifactError with details if limit exceeded

### For Module Loading ✅ ENHANCED
1. ✅ Comprehensive audit trail (AuditLogger module - SEC-4)
2. ✅ Cryptographic signatures implemented (ModuleIntegrity module - SEC-2)
3. Module version pinning (TODO - future enhancement)
4. Rollback mechanism (TODO - future enhancement)

**Security Features - Module Integrity (SEC-2):**
- `ModuleIntegrity` module provides SHA-256 hashing
- HMAC-SHA256 signatures for all modules
- `signAllModules()` - Generate signatures for VFS modules
- `verifyModuleById()` - Verify before loading
- Signatures stored in `/vfs/security/module-signatures.json`

**Security Features - Audit Logging (SEC-4):**
- `AuditLogger` module tracks all security-sensitive operations
- Module loads/verifications logged with timing and size
- VFS operations (create/update/delete) tracked
- API calls and rate limiting events logged
- Daily log files in JSONL format at `/.audit/YYYY-MM-DD.jsonl`
- Query interface for filtering and analysis
- Recent logs buffer (last 100 events) for quick access
- Export functionality for compliance reporting

### For AI Interactions
1. Implement prompt injection detection
2. Add output sanitization
3. Rate limit API calls
4. Monitor for unusual patterns

### For CLI Tools
1. Never use user input directly in shell commands
2. Prefer libraries over shell execution (e.g., fast-glob vs find)
3. Validate all file paths
4. Add --dry-run modes for destructive operations

---

## 📋 Security Checklist for New Features

Before merging new features, verify:

- [ ] No `eval()` or `Function()` with user input
- [ ] All user input is validated and sanitized
- [ ] No shell command injection vectors
- [ ] Sensitive data is not logged
- [ ] Error messages don't leak sensitive info
- [ ] File operations are restricted to workspace
- [ ] API keys are not exposed in client code
- [ ] XSS vulnerabilities are prevented
- [ ] CSRF tokens are used where needed
- [ ] Rate limiting is implemented

---

## 🚨 Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email security@reploid-project.com (if available)
3. Or use GitHub's private vulnerability reporting
4. Include: description, steps to reproduce, impact assessment

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Sandboxing iframes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last Updated:** 2025-09-30
**Next Review:** 2025-10-30