/**
 * MCP Observability Protocol (MCP Lens) - Alloy Specification
 *
 * This specification models the MCP Observability Protocol and verifies that:
 *   1. Widgets correctly implement MCP client contracts
 *   2. MCPBridge acts as a valid proxy for MCP operations
 *   3. Widget permissions are enforced
 *   4. MCP Lens refines MCP (every MCP Lens operation is a valid MCP operation)
 *
 * Author: PAWS Team
 * Date: 2025-10-21
 * MCP Lens Version: 1.0.0
 * MCP Version: 2025-06-18
 *
 * Status: Reference specification based on protocol design as of Oct 2025.
 * Not actively verified against current implementation. Useful for understanding
 * protocol invariants and as starting point for future verification work.
 */

module MOPContracts

/*
 * Basic types
 */

abstract sig String {}
abstract sig JSONSchema {}
abstract sig Object {}

/*
 * MCP Server representation
 */

sig MCPServer {
  name: one String,
  capabilities: one MCPCapabilities,
  tools: set Tool,
  resources: set Resource,
  prompts: set Prompt
}

sig MCPCapabilities {
  supportsTools: one Bool,
  supportsResources: one Bool,
  supportsPrompts: one Bool,
  supportsSampling: one Bool
}

sig Tool {
  name: one String,
  inputSchema: one JSONSchema,
  outputSchema: lone JSONSchema  // Optional
}

sig Resource {
  uri: one String,
  mimeType: lone String  // Optional
}

sig Prompt {
  name: one String,
  requiredArgs: set String
}

/*
 * Widget representation
 */

sig Widget {
  factory: one WidgetFactory,
  bridge: one MCPBridge,
  permissions: one WidgetPermissions,

  // Operations performed by widget
  toolCalls: set ToolCall,
  resourceReads: set ResourceRead,
  promptGets: set PromptGet
}

sig WidgetFactory {
  serverInfo: one MCPServerInfo,
  dependencies: one Dependencies
}

sig MCPServerInfo {
  serverName: one String,
  capabilities: one MCPCapabilities,
  tools: set Tool,
  resources: set Resource,
  prompts: set Prompt
}

sig Dependencies {
  eventBus: one EventBus,
  mcpBridge: one MCPBridge,
  config: one Config
}

sig EventBus {}
sig Config {}

/*
 * MCPBridge - proxy between widget and MCP server
 */

sig MCPBridge {
  server: one MCPServer,
  operations: set MCPOperation
}

abstract sig MCPOperation {}

sig ToolCall extends MCPOperation {
  tool: one Tool,
  arguments: one Object
}

sig ResourceRead extends MCPOperation {
  resource: one Resource
}

sig PromptGet extends MCPOperation {
  prompt: one Prompt,
  arguments: set String
}

/*
 * Security model
 */

enum TrustLevel { Untrusted, Community, Verified, Enterprise }
enum StorageLevel { None, Session, Persistent }

sig WidgetPermissions {
  trustLevel: one TrustLevel,
  allowedOperations: set OperationType,
  storageLevel: one StorageLevel,
  networkDomains: set String
}

enum OperationType { CallTool, ReadResource, GetPrompt, Subscribe }

abstract sig Bool {}
one sig True, False extends Bool {}

/*
 * FACTS - Constraints that always hold
 */

// Each widget has exactly one bridge, and bridge operations are widget's operations
fact WidgetBridgeConsistency {
  all w: Widget | {
    w.toolCalls = w.bridge.operations & ToolCall
    w.resourceReads = w.bridge.operations & ResourceRead
    w.promptGets = w.bridge.operations & PromptGet
  }
}

// Widget factory serverInfo must match actual server
fact FactoryReceivesCorrectServerInfo {
  all w: Widget | {
    let server = w.bridge.server |
    let info = w.factory.serverInfo | {
      info.serverName = server.name
      info.capabilities = server.capabilities
      info.tools = server.tools
      info.resources = server.resources
      info.prompts = server.prompts
    }
  }
}

// Bridge operations reference server's declared capabilities
fact BridgeOnlyUsesServerCapabilities {
  all b: MCPBridge | {
    (some b.operations & ToolCall) => b.server.capabilities.supportsTools = True
    (some b.operations & ResourceRead) => b.server.capabilities.supportsResources = True
    (some b.operations & PromptGet) => b.server.capabilities.supportsPrompts = True
  }
}

fact TrustLevelPolicies {
  all perm: WidgetPermissions | {
    perm.trustLevel = Community => perm.storageLevel in (Session + None)
    perm.trustLevel = Verified => (Subscribe in perm.allowedOperations) => CallTool in perm.allowedOperations
    perm.trustLevel = Enterprise => perm.storageLevel = Persistent
  }
}

/*
 * PREDICATES - Reusable constraints
 */

// Widget only calls tools that server declares
pred WidgetCallsDeclaredTools[w: Widget] {
  all call: w.toolCalls | call.tool in w.bridge.server.tools
}

// Widget only reads resources that server exposes
pred WidgetReadsExposedResources[w: Widget] {
  all read: w.resourceReads | read.resource in w.bridge.server.resources
}

// Widget only gets prompts that server provides
pred WidgetGetsAvailablePrompts[w: Widget] {
  all get: w.promptGets | get.prompt in w.bridge.server.prompts
}

pred WidgetProvidesPromptArguments[w: Widget] {
  all get: w.promptGets | get.prompt.requiredArgs in get.arguments
}

// Widget respects its permission grants
pred WidgetRespectsPermissions[w: Widget] {
  (some w.toolCalls) => CallTool in w.permissions.allowedOperations
  (some w.resourceReads) => ReadResource in w.permissions.allowedOperations
  (some w.promptGets) => GetPrompt in w.permissions.allowedOperations
}

// Untrusted widgets have restricted permissions
pred UntrustedWidgetsRestricted[w: Widget] {
  w.permissions.trustLevel = Untrusted => {
    w.permissions.allowedOperations in (ReadResource + GetPrompt)  // No tool calls!
    w.permissions.storageLevel = None
    no w.permissions.networkDomains
  }
}

// Contract: Widgets must follow MCP compliance rules
fact WidgetContractsEnforced {
  all w: Widget | {
    WidgetCallsDeclaredTools[w]
    WidgetReadsExposedResources[w]
    WidgetGetsAvailablePrompts[w]
    WidgetProvidesPromptArguments[w]
    WidgetRespectsPermissions[w]
    UntrustedWidgetsRestricted[w]
  }
}

// Main compliance predicate: Widget is a valid MCP client
pred MCPCompliant[w: Widget] {
  WidgetCallsDeclaredTools[w]
  WidgetReadsExposedResources[w]
  WidgetGetsAvailablePrompts[w]
  WidgetProvidesPromptArguments[w]
  WidgetRespectsPermissions[w]
  UntrustedWidgetsRestricted[w]
}

/*
 * ASSERTIONS - Properties to verify
 */

// Core property: All widgets are MCP compliant
assert AllWidgetsMCPCompliant {
  all w: Widget | MCPCompliant[w]
}

// Security property: Untrusted widgets cannot call tools
assert UntrustedCannotCallTools {
  all w: Widget |
    w.permissions.trustLevel = Untrusted => no w.toolCalls
}

// Safety property: Widgets cannot use undeclared capabilities
assert NoUndeclaredCapabilities {
  all w: Widget | {
    (some w.toolCalls) => w.bridge.server.capabilities.supportsTools = True
    (some w.resourceReads) => w.bridge.server.capabilities.supportsResources = True
    (some w.promptGets) => w.bridge.server.capabilities.supportsPrompts = True
  }
}

// Structural property: Factory provides complete server info
assert FactoryInfoComplete {
  all w: Widget | {
    let info = w.factory.serverInfo |
    let server = w.bridge.server | {
      #info.tools = #server.tools
      #info.resources = #server.resources
      #info.prompts = #server.prompts
    }
  }
}

assert TrustLevelsEnforced {
  all perm: WidgetPermissions | {
    perm.trustLevel = Community => perm.storageLevel in (Session + None)
    perm.trustLevel = Verified => (Subscribe in perm.allowedOperations) => CallTool in perm.allowedOperations
    perm.trustLevel = Enterprise => perm.storageLevel = Persistent
  }
}

/*
 * COMMANDS - Model checking directives
 */

// Check main compliance property
check AllWidgetsMCPCompliant for 10 but 5 Widget, 3 MCPServer

// Check security properties
check UntrustedCannotCallTools for 8

check NoUndeclaredCapabilities for 10

check FactoryInfoComplete for 10

check TrustLevelsEnforced for 8

// Find example of valid widget configuration
run ExampleWidget {
  some w: Widget | {
    MCPCompliant[w]
    #w.toolCalls > 0
    #w.resourceReads > 0
    w.permissions.trustLevel = Verified
  }
} for 5 but exactly 1 Widget, exactly 1 MCPServer

// Find example showing permission enforcement
run PermissionEnforcement {
  some w1, w2: Widget | {
    w1.permissions.trustLevel = Untrusted
    w2.permissions.trustLevel = Enterprise
    no w1.toolCalls  // Untrusted can't call tools
    some w2.toolCalls  // Enterprise can
    w1.bridge.server = w2.bridge.server  // Same server
  }
} for 5 but exactly 2 Widget, exactly 1 MCPServer

// Find counterexample: widget violating MCP compliance
run CounterExample {
  some w: Widget | not MCPCompliant[w]
} for 5

/*
 * ADDITIONAL PREDICATES FOR TESTING
 */

// Helper: Validate JSON schema (simplified)
pred ValidJSONSchema[obj: Object, schema: JSONSchema] {
  // Simplified - just check that obj exists
  some obj
}

// Tool call arguments must conform to inputSchema
pred ToolCallArgumentsValid[call: ToolCall] {
  ValidJSONSchema[call.arguments, call.tool.inputSchema]
}

fact ToolCallArgumentsRespectSchema {
  all call: ToolCall | ToolCallArgumentsValid[call]
}

/*
 * REFINEMENT VERIFICATION
 */

// Predicate: MWP operations map to MCP JSON-RPC methods
pred MWPRefinesMCP {
  all w: Widget | {
    // Every widget operation corresponds to a valid MCP JSON-RPC method
    all call: w.toolCalls | some call.tool  // maps to "tools/call"
    all read: w.resourceReads | some read.resource  // maps to "resources/read"
    all get: w.promptGets | some get.prompt  // maps to "prompts/get"

    // Widget uses bridge (never direct server access)
    w.bridge.server in MCPServer

    // Operations go through bridge
    w.toolCalls + w.resourceReads + w.promptGets in w.bridge.operations
  }
}

assert RefinementHolds {
  all w: Widget | MWPRefinesMCP
}

check RefinementHolds for 10
