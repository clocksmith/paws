// @blueprint 0x000077 - Approval Permission Manager for REPLOID
/**
 * ApprovalPermissionManager
 *
 * Centralized permission management for approval workflows and bypass_confirmation.
 * Provides validation, policy enforcement, and auditing for approval permissions.
 *
 * Key Features:
 * - Permission validation (schema compliance)
 * - Pattern matching for bypass_confirmation
 * - Security policy enforcement
 * - Permission auditing and logging
 * - Runtime permission checks
 * - Policy updates and revocations
 *
 * Security Model:
 * 1. Only approval workflow widgets can request bypass_confirmation
 * 2. Bypass patterns must follow naming conventions (approve_*, reject_*, confirm_*)
 * 3. All permission grants are audited
 * 4. Permissions can be revoked at runtime
 *
 * Usage:
 *   const granted = await PermissionManager.grantPermission(widgetId, permissions);
 *   const allowed = PermissionManager.checkPermission(widgetId, 'approve_context');
 */

const ApprovalPermissionManager = {
  metadata: {
    id: 'ApprovalPermissionManager',
    version: '1.0.0',
    description: 'Permission manager for approval workflows',
    dependencies: ['Utils', 'EventBus?', 'AuditLogger?'],
    async: false,
    type: 'manager'
  },

  factory: (deps) => {
    const { Utils, EventBus, AuditLogger } = deps;
    const { logger } = Utils;

    logger.info('[ApprovalPermissionManager] Initializing...');

    // Permission storage: widgetId -> { permissions, capabilities, grantedAt, policies }
    const permissionStore = new Map();

    // Security policies
    const securityPolicies = {
      // Allowed bypass patterns (must match one of these prefixes)
      allowedBypassPrefixes: ['approve_', 'reject_', 'confirm_', 'accept_', 'deny_'],

      // Dangerous patterns that should never be bypassed
      dangerousPatterns: ['delete_*', 'destroy_*', 'remove_*', 'drop_*', 'truncate_*'],

      // Maximum bypass patterns per widget
      maxBypassPatterns: 20,

      // Require approval_workflows capability for bypass
      requireApprovalWorkflowsCapability: true,

      // Audit all permission grants
      auditAllGrants: true,

      // Strict mode (enforce all policies)
      strictMode: true
    };

    // Statistics
    const stats = {
      permissionsGranted: 0,
      permissionsRevoked: 0,
      permissionChecks: 0,
      policyViolations: 0,
      lastUpdate: null
    };

    /**
     * Validate bypass_confirmation patterns
     * @param {Array<string>} patterns - Bypass patterns to validate
     * @returns {Object} Validation result
     */
    const validateBypassPatterns = (patterns) => {
      const errors = [];
      const warnings = [];

      if (!Array.isArray(patterns)) {
        errors.push('bypass_confirmation must be an array');
        return { valid: false, errors, warnings };
      }

      if (patterns.length === 0) {
        warnings.push('bypass_confirmation is empty (no effect)');
      }

      if (patterns.length > securityPolicies.maxBypassPatterns) {
        errors.push(`Too many bypass patterns (${patterns.length} > ${securityPolicies.maxBypassPatterns})`);
      }

      for (const pattern of patterns) {
        if (typeof pattern !== 'string') {
          errors.push(`Invalid pattern type: ${typeof pattern} (expected string)`);
          continue;
        }

        // Check if pattern matches dangerous patterns
        const isDangerous = securityPolicies.dangerousPatterns.some(dangerous => {
          const regex = new RegExp('^' + dangerous.replace(/\*/g, '.*') + '$');
          return regex.test(pattern);
        });

        if (isDangerous) {
          errors.push(`Dangerous pattern not allowed: ${pattern}`);
          stats.policyViolations++;
          continue;
        }

        // Check if pattern follows naming convention
        const hasValidPrefix = securityPolicies.allowedBypassPrefixes.some(prefix =>
          pattern.startsWith(prefix)
        );

        if (!hasValidPrefix) {
          warnings.push(
            `Pattern '${pattern}' does not follow naming convention ` +
            `(expected: ${securityPolicies.allowedBypassPrefixes.join(', ')})`
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    };

    /**
     * Validate widget permissions
     * @param {Object} permissions - Widget permissions
     * @param {Object} capabilities - Widget capabilities
     * @returns {Object} Validation result
     */
    const validatePermissions = (permissions, capabilities) => {
      const errors = [];
      const warnings = [];

      // If bypass_confirmation is requested, must have approval_workflows capability
      if (permissions.bypass_confirmation) {
        if (securityPolicies.requireApprovalWorkflowsCapability && !capabilities.approval_workflows) {
          errors.push('bypass_confirmation requires approval_workflows capability');
          stats.policyViolations++;
        }

        // Validate bypass patterns
        const patternValidation = validateBypassPatterns(permissions.bypass_confirmation);
        errors.push(...patternValidation.errors);
        warnings.push(...patternValidation.warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    };

    /**
     * Grant permissions to a widget
     * @param {string} widgetId - Widget identifier
     * @param {Object} permissions - Requested permissions
     * @param {Object} capabilities - Widget capabilities
     * @returns {Promise<Object>} Grant result
     */
    const grantPermission = async (widgetId, permissions, capabilities) => {
      logger.info(`[PermissionManager] Permission request from widget: ${widgetId}`, {
        hasBypass: !!permissions.bypass_confirmation
      });

      // Validate permissions
      const validation = validatePermissions(permissions, capabilities);

      if (!validation.valid) {
        logger.error(`[PermissionManager] Permission validation failed for ${widgetId}`, {
          errors: validation.errors
        });

        if (securityPolicies.strictMode) {
          throw new Error(`Permission denied: ${validation.errors.join(', ')}`);
        }
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        logger.warn(`[PermissionManager] Permission warnings for ${widgetId}`, {
          warnings: validation.warnings
        });
      }

      // Store permissions
      permissionStore.set(widgetId, {
        permissions,
        capabilities,
        grantedAt: Date.now(),
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings
        }
      });

      stats.permissionsGranted++;
      stats.lastUpdate = Date.now();

      // Emit event
      if (EventBus) {
        EventBus.emit('mcp:permissions:granted', {
          widgetId,
          permissions,
          capabilities,
          timestamp: new Date().toISOString()
        });
      }

      // Audit log
      if (AuditLogger && securityPolicies.auditAllGrants) {
        await AuditLogger.logPermissionGrant({
          widgetId,
          permissions,
          capabilities,
          validation,
          timestamp: new Date().toISOString()
        });
      }

      return {
        granted: validation.valid,
        widgetId,
        permissions,
        validation
      };
    };

    /**
     * Check if widget has permission to bypass confirmation for a tool
     * @param {string} widgetId - Widget identifier
     * @param {string} toolName - Tool name to check
     * @returns {boolean} True if permission granted
     */
    const checkPermission = (widgetId, toolName) => {
      stats.permissionChecks++;

      const widget = permissionStore.get(widgetId);
      if (!widget) {
        logger.warn(`[PermissionManager] Unknown widget: ${widgetId}`);
        return false;
      }

      // Must have approval_workflows capability
      if (!widget.capabilities?.approval_workflows) {
        return false;
      }

      // Check bypass_confirmation patterns
      const bypassPatterns = widget.permissions?.bypass_confirmation;
      if (!bypassPatterns || bypassPatterns.length === 0) {
        return false;
      }

      // Match tool against patterns
      const matched = bypassPatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(toolName);
      });

      if (matched) {
        logger.info(`[PermissionManager] Permission check ALLOWED: ${widgetId} -> ${toolName}`);
      }

      return matched;
    };

    /**
     * Revoke permissions from a widget
     * @param {string} widgetId - Widget identifier
     * @returns {boolean} True if revoked
     */
    const revokePermission = (widgetId) => {
      const removed = permissionStore.delete(widgetId);

      if (removed) {
        stats.permissionsRevoked++;
        stats.lastUpdate = Date.now();

        logger.info(`[PermissionManager] Revoked permissions for widget: ${widgetId}`);

        if (EventBus) {
          EventBus.emit('mcp:permissions:revoked', {
            widgetId,
            timestamp: new Date().toISOString()
          });
        }
      }

      return removed;
    };

    /**
     * Get widget permissions
     * @param {string} widgetId - Widget identifier
     * @returns {Object|null} Widget permissions or null
     */
    const getPermissions = (widgetId) => {
      const widget = permissionStore.get(widgetId);
      return widget ? { ...widget } : null;
    };

    /**
     * List all granted permissions
     * @returns {Array} List of widgets with permissions
     */
    const listPermissions = () => {
      const list = [];
      for (const [widgetId, widget] of permissionStore.entries()) {
        list.push({
          widgetId,
          ...widget
        });
      }
      return list;
    };

    /**
     * Update security policies
     * @param {Object} newPolicies - New policy settings
     */
    const updatePolicies = (newPolicies) => {
      Object.assign(securityPolicies, newPolicies);

      logger.info('[PermissionManager] Updated security policies', newPolicies);

      if (EventBus) {
        EventBus.emit('mcp:permissions:policies-updated', {
          policies: { ...securityPolicies },
          timestamp: new Date().toISOString()
        });
      }
    };

    /**
     * Get security policies
     * @returns {Object} Current policies
     */
    const getPolicies = () => {
      return { ...securityPolicies };
    };

    /**
     * Get statistics
     * @returns {Object} Permission statistics
     */
    const getStats = () => {
      return {
        ...stats,
        activePermissions: permissionStore.size
      };
    };

    /**
     * Audit all current permissions
     * @returns {Array} Audit results
     */
    const auditPermissions = () => {
      const auditResults = [];

      for (const [widgetId, widget] of permissionStore.entries()) {
        const validation = validatePermissions(widget.permissions, widget.capabilities);

        auditResults.push({
          widgetId,
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          grantedAt: widget.grantedAt,
          age: Date.now() - widget.grantedAt
        });

        if (!validation.valid) {
          logger.warn(`[PermissionManager] Audit found invalid permissions: ${widgetId}`, {
            errors: validation.errors
          });
        }
      }

      logger.info(`[PermissionManager] Audit completed`, {
        total: auditResults.length,
        invalid: auditResults.filter(r => !r.valid).length
      });

      return auditResults;
    };

    /**
     * Initialize permission manager
     */
    const init = async () => {
      logger.info('[PermissionManager] Initialized with policies', {
        strictMode: securityPolicies.strictMode,
        maxBypassPatterns: securityPolicies.maxBypassPatterns
      });

      return true;
    };

    /**
     * Cleanup permission manager
     */
    const cleanup = () => {
      permissionStore.clear();
      logger.info('[PermissionManager] Cleaned up');
    };

    // Public API
    return {
      init,
      api: {
        // Permission management
        grantPermission,
        revokePermission,
        checkPermission,
        getPermissions,
        listPermissions,

        // Validation
        validatePermissions,
        validateBypassPatterns,

        // Policy management
        updatePolicies,
        getPolicies,

        // Auditing
        auditPermissions,
        getStats,

        // Lifecycle
        cleanup
      }
    };
  }
};

export default ApprovalPermissionManager;
