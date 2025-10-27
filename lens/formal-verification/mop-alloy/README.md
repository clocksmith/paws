# MCP Lens Protocol Alloy Specification

**Status:** Reference specification based on protocol design as of Oct 2025. Not actively verified against current implementation. Useful for understanding protocol invariants and as starting point for future verification work.

---

This directory contains Alloy specifications for verifying the MCP Observability Protocol (MCP Lens).

## Files

- **`MOPContracts.als`** - Complete MCP Lens widget contract and refinement specification
- **`examples/`** - Example widget models

## Running the Alloy Analyzer

```bash
# Install Alloy Analyzer (v6+ recommended)
wget https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.0.0/alloy.jar

# Launch GUI with the spec
java -jar alloy.jar MOPContracts.als

# In the GUI:
# 1. Execute → Check AllWidgetsMCPCompliant (and the other assertions)
# 2. "No counterexample" means the property holds within the chosen scope
# 3. Execute → Run ExampleWidget to visualise a compliant instance

# Command-line example (requires alloy-cli)
alloy check MOPContracts.als AllWidgetsMCPCompliant --scope 10
```


## What This Verifies

### Structural Properties
- ✅ Widgets only call tools declared by server
- ✅ Widget factory receives complete MCPServerInfo
- ✅ Tool arguments conform to JSON Schema
- ✅ MCPBridge acts as proxy, not passthrough
- ✅ Prompt invocations include all required arguments

### Refinement Properties
- ✅ MCP Lens widget operations are valid MCP operations
- ✅ Capability negotiation is respected
- ✅ Dependency injection provides correct interfaces

### Security Properties
- ✅ Permission model enforces access control
- ✅ Widgets cannot escalate permissions
- ✅ Untrusted widgets have minimal capabilities
- ✅ Trust-level storage/network rules are upheld

## Understanding the Spec

The specification models:
1. **Signatures**: `Widget`, `MCPServer`, `MCPBridge`, `ToolCall`, etc.
2. **Facts**: Constraints that always hold
3. **Predicates**: Reusable constraints (like functions)
4. **Assertions**: Properties to verify
5. **Commands**: Run model checker (check/run)

## Verification Results

When you run a check, Alloy either:
- **No counterexample found** ✅ Property holds for all instances up to scope
- **Counterexample found** ❌ Alloy generates visual diagram showing violation

## Maintenance Status

This specification was developed as a reference model for the MCP Lens protocol. It has not been continuously updated to match implementation changes. Use it as:
- Documentation of intended protocol invariants
- Starting point for formal verification work
- Educational resource for understanding widget contracts

To bring this up to date with current MCP Lens implementation, see parent directory README for migration guidance.

## Next Steps

- Review `MOPContracts.als` to understand the specification
- Modify scope in commands to check larger instances
- Add your own predicates to verify additional properties
- Extend the spec to model inter-widget communication, event bus, etc.
