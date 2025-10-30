/**
 * MCP Lens - Approval Workflows Extension
 *
 * Extends the core MCP Lens protocol with approval workflow capabilities
 * for human-in-the-loop agent systems like Reploid.
 *
 * Version: 1.0.0
 * Extends: MCP Lens 1.0.0
 */

// Re-export base types for convenience
export * from '../schema';

import type {
  WidgetCapabilities as BaseWidgetCapabilities,
  WidgetPermissions as BaseWidgetPermissions,
  ToolResult,
  JSONSchema,
  EventHandler,
  UnsubscribeFunction
} from '../schema';

// ============================================================================
// EXTENDED CAPABILITIES
// ============================================================================

/**
 * Widget Capabilities with Approval Workflows
 *
 * Extends base capabilities with approval_workflows support.
 */
export interface WidgetCapabilities extends BaseWidgetCapabilities {
  /**
   * Indicates widget provides approval UI for agent workflows
   *
   * When true, the widget:
   * - Presents approval/rejection buttons for pending agent actions
   * - Calls MCP tools like 'approve_context', 'reject_context'
   * - MAY request bypass_confirmation permission
   *
   * @example
   * capabilities: {
   *   tools: true,
   *   resources: false,
   *   prompts: false,
   *   approval_workflows: true  // This widget handles approvals
   * }
   */
  approval_workflows?: boolean;
}

// ============================================================================
// EXTENDED PERMISSIONS
// ============================================================================

/**
 * Widget Permissions with Bypass Confirmation
 *
 * Extends base permissions with bypass_confirmation support.
 */
export interface WidgetPermissions extends BaseWidgetPermissions {
  /**
   * Bypass host-level confirmation for specific tool patterns
   *
   * SECURITY CONSTRAINTS:
   * 1. ONLY approval workflow widgets should request this permission
   * 2. ONLY for approval-related tools (approve_*, reject_*, confirm_*)
   * 3. Host MUST validate widget has approval_workflows capability
   * 4. Widget button click IS the user approval
   *
   * @example
   * permissions: {
   *   tools: ['approve_context', 'reject_context'],
   *   bypass_confirmation: ['approve_*', 'reject_*']
   * }
   *
   * Rationale:
   * - User clicking "Approve" button = explicit approval
   * - No need for secondary "Are you sure?" dialog
   * - Tool call is the approval mechanism itself
   */
  bypass_confirmation?: string[];
}

// ============================================================================
// APPROVAL WORKFLOW TYPES
// ============================================================================

/**
 * Approval Request
 *
 * Represents a pending agent action requiring user approval.
 */
export interface ApprovalRequest {
  /** Unique identifier for this approval request */
  id: string;

  /** Type of approval being requested */
  type: ApprovalType;

  /** Human-readable title/summary */
  title: string;

  /** Detailed description of what will happen */
  description: string;

  /** Agent state or context being approved */
  context: {
    /** Current agent state (e.g., 'AWAITING_CONTEXT_APPROVAL') */
    state: string;
    /** Proposal diff, file changes, or other relevant data */
    data: unknown;
    /** Metadata about the request */
    metadata?: Record<string, unknown>;
  };

  /** Tools that will be called on approval/rejection */
  actions: {
    /** Tool to call when user approves */
    approve: {
      serverName: string;
      toolName: string;
      args: Record<string, unknown>;
    };
    /** Tool to call when user rejects */
    reject: {
      serverName: string;
      toolName: string;
      args: Record<string, unknown>;
    };
  };

  /** Timestamp when approval was requested */
  requested_at: string;

  /** Optional timeout for approval (ISO duration) */
  timeout?: string;

  /** Severity level for UI presentation */
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Approval Types
 */
export type ApprovalType =
  | 'context_proposal'      // Agent proposing context changes
  | 'file_modification'     // File write/delete operations
  | 'tool_execution'        // Potentially dangerous tool calls
  | 'state_transition'      // Agent FSM state changes
  | 'workflow_step'         // Multi-step workflow approval
  | 'custom';               // Custom approval type

/**
 * Approval Decision
 *
 * Result of user approval/rejection.
 */
export interface ApprovalDecision {
  /** ID of the approval request */
  requestId: string;

  /** User's decision */
  decision: 'approved' | 'rejected';

  /** Timestamp of decision */
  decided_at: string;

  /** Optional user comment/reason */
  comment?: string;

  /** User who made the decision (if available) */
  user?: string;
}

/**
 * Approval Result
 *
 * Result from executing approval/rejection tool.
 */
export interface ApprovalResult extends ToolResult {
  /** Approval-specific metadata */
  approval?: {
    requestId: string;
    decision: 'approved' | 'rejected';
    newState?: string;
    appliedChanges?: unknown;
  };
}

// ============================================================================
// APPROVAL EVENTS
// ============================================================================

/**
 * Approval Event Names
 */
export type ApprovalEvent =
  // Request lifecycle
  | 'mcp:approval:requested'        // New approval request created
  | 'mcp:approval:pending'          // Request waiting for user
  | 'mcp:approval:approved'         // User approved request
  | 'mcp:approval:rejected'         // User rejected request
  | 'mcp:approval:timeout'          // Request timed out
  | 'mcp:approval:cancelled'        // Request cancelled by agent
  // Batch operations
  | 'mcp:approval:batch-requested'  // Multiple approvals requested
  | 'mcp:approval:batch-completed'  // Batch approval finished
  // Workflow events
  | 'mcp:workflow:state-changed'    // Agent FSM state transition
  | 'mcp:workflow:step-completed'   // Workflow step finished
  | 'mcp:workflow:completed'        // Entire workflow finished
  | 'mcp:workflow:failed';          // Workflow failed

/**
 * Event Payloads
 */
export interface ApprovalRequestedPayload {
  request: ApprovalRequest;
  serverName: string;
}

export interface ApprovalApprovedPayload {
  requestId: string;
  decision: ApprovalDecision;
  result: ApprovalResult;
  serverName: string;
}

export interface ApprovalRejectedPayload {
  requestId: string;
  decision: ApprovalDecision;
  result: ApprovalResult;
  serverName: string;
}

export interface ApprovalTimeoutPayload {
  requestId: string;
  serverName: string;
  requested_at: string;
  timeout: string;
}

export interface WorkflowStateChangedPayload {
  serverName: string;
  workflowId: string;
  oldState: string;
  newState: string;
  timestamp: string;
  triggeredBy?: 'approval' | 'rejection' | 'timeout' | 'system';
}

// ============================================================================
// APPROVAL WORKFLOW TOOLS
// ============================================================================

/**
 * Standard Approval Tool Schemas
 *
 * These are common tool patterns for approval workflows.
 * MCP servers implementing approval workflows SHOULD follow these schemas.
 */

/**
 * approve_context Tool Schema
 */
export const APPROVE_CONTEXT_SCHEMA: JSONSchema = {
  type: 'object',
  description: 'Approve pending context proposal',
  properties: {
    requestId: {
      type: 'string',
      description: 'ID of the approval request'
    },
    comment: {
      type: 'string',
      description: 'Optional approval comment'
    }
  },
  required: ['requestId']
};

/**
 * reject_context Tool Schema
 */
export const REJECT_CONTEXT_SCHEMA: JSONSchema = {
  type: 'object',
  description: 'Reject pending context proposal',
  properties: {
    requestId: {
      type: 'string',
      description: 'ID of the approval request'
    },
    reason: {
      type: 'string',
      description: 'Reason for rejection'
    }
  },
  required: ['requestId']
};

/**
 * get_pending_approvals Tool Schema
 */
export const GET_PENDING_APPROVALS_SCHEMA: JSONSchema = {
  type: 'object',
  description: 'List all pending approval requests',
  properties: {
    filter: {
      type: 'object',
      description: 'Optional filter criteria',
      properties: {
        type: {
          type: 'string',
          enum: ['context_proposal', 'file_modification', 'tool_execution', 'state_transition', 'workflow_step', 'custom']
        },
        severity: {
          type: 'string',
          enum: ['info', 'warning', 'critical']
        }
      }
    }
  }
};

// ============================================================================
// APPROVAL WIDGET INTERFACE
// ============================================================================

/**
 * Approval Widget API
 *
 * Approval widgets SHOULD implement these additional methods.
 */
export interface ApprovalWidgetAPI {
  /**
   * Get current pending approval requests
   */
  getPendingApprovals(): Promise<ApprovalRequest[]>;

  /**
   * Approve a request
   * @param requestId - ID of the approval request
   * @param comment - Optional approval comment
   */
  approve(requestId: string, comment?: string): Promise<ApprovalResult>;

  /**
   * Reject a request
   * @param requestId - ID of the approval request
   * @param reason - Reason for rejection
   */
  reject(requestId: string, reason: string): Promise<ApprovalResult>;

  /**
   * Subscribe to approval events
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  onApprovalRequest(handler: (request: ApprovalRequest) => void): UnsubscribeFunction;
}

// ============================================================================
// SECURITY GUIDELINES
// ============================================================================

/**
 * SECURITY GUIDELINES FOR APPROVAL WORKFLOWS
 *
 * 1. BYPASS_CONFIRMATION USAGE
 * ────────────────────────────
 * ✅ ALLOWED:
 *    - Approval workflow widgets (approval_workflows: true)
 *    - Only for approval tools (approve_*, reject_*, confirm_*)
 *    - Widget button click = explicit user approval
 *
 * ❌ NOT ALLOWED:
 *    - General-purpose widgets
 *    - Destructive tools (delete_*, destroy_*)
 *    - Arbitrary tool execution without approval UI
 *
 * 2. HOST VALIDATION
 * ──────────────────
 * Hosts MUST validate:
 *    - Widget has approval_workflows capability
 *    - Requested bypass tools match declared tool permissions
 *    - Tool names follow approval patterns (approve_*, reject_*)
 *    - Widget is from trusted source
 *
 * 3. AUDIT LOGGING
 * ────────────────
 * All approval decisions MUST be logged with:
 *    - Request ID
 *    - User decision (approved/rejected)
 *    - Timestamp
 *    - User identifier (if available)
 *    - Tool execution result
 *
 * 4. TIMEOUT HANDLING
 * ───────────────────
 * - Approval requests SHOULD have timeouts
 * - Expired requests SHOULD auto-reject
 * - Widgets SHOULD show countdown timers
 *
 * 5. USER FEEDBACK
 * ────────────────
 * Approval widgets MUST show:
 *    - Clear description of what will happen
 *    - Diff/preview of changes
 *    - Severity level (info/warning/critical)
 *    - Approval and rejection buttons (equal prominence)
 *
 * @example
 * // ✅ CORRECT: Approval widget with bypass
 * {
 *   capabilities: { tools: true, approval_workflows: true },
 *   permissions: {
 *     tools: ['approve_context', 'reject_context'],
 *     bypass_confirmation: ['approve_context', 'reject_context']
 *   }
 * }
 *
 * @example
 * // ❌ WRONG: General widget trying to bypass
 * {
 *   capabilities: { tools: true, approval_workflows: false },
 *   permissions: {
 *     tools: ['delete_file'],
 *     bypass_confirmation: ['delete_file']  // NOT ALLOWED
 *   }
 * }
 */

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Helper: Check if widget can bypass confirmation
 */
export function canBypassConfirmation(
  capabilities: WidgetCapabilities,
  permissions: WidgetPermissions,
  toolName: string
): boolean {
  // Must have approval_workflows capability
  if (!capabilities.approval_workflows) {
    return false;
  }

  // Must have bypass_confirmation permission
  if (!permissions.bypass_confirmation || permissions.bypass_confirmation.length === 0) {
    return false;
  }

  // Check if tool matches any bypass patterns
  return permissions.bypass_confirmation.some(pattern => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return regex.test(toolName);
  });
}

/**
 * Helper: Validate approval widget permissions
 */
export function validateApprovalPermissions(
  capabilities: WidgetCapabilities,
  permissions: WidgetPermissions
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // If bypass_confirmation is requested, must have approval_workflows
  if (permissions.bypass_confirmation && !capabilities.approval_workflows) {
    errors.push('bypass_confirmation requires approval_workflows capability');
  }

  // Bypass patterns should only match approval tools
  if (permissions.bypass_confirmation) {
    for (const pattern of permissions.bypass_confirmation) {
      // Check pattern follows approval conventions
      if (!pattern.match(/^(approve_|reject_|confirm_)/)) {
        errors.push(`bypass_confirmation pattern '${pattern}' should start with approve_, reject_, or confirm_`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
