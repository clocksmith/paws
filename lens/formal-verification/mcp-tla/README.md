# MCP Protocol TLA+ Specification

**Status:** Reference specification based on protocol design as of Oct 2025. Not actively verified against current implementation. Useful for understanding protocol invariants and as starting point for future verification work.

---

This directory contains TLA+ specifications for verifying the Model Context Protocol (MCP).

## Files

- **`MCPLifecycle.tla`** - Complete MCP lifecycle state machine specification
- **`MCP.cfg`** - TLC model checker configuration
- **`examples/`** - Additional example specifications

## Running the Model Checker

```bash
# Install TLA+ tools
wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar

# Run model checker
java -jar tla2tools.jar MCPLifecycle.tla

# Run with configuration
tlc MCPLifecycle.tla -config MCP.cfg

# Run with multiple workers (faster)
tlc MCPLifecycle.tla -workers 4
```

## What This Verifies

### Safety Properties
- ✅ No tool invocation before initialization complete
- ✅ Request IDs are unique within a session
- ✅ Response IDs match request IDs
- ✅ Sessions transition through valid states only
- ✅ Capabilities only become available after initialization
- ✅ Outstanding requests per session remain within `MaxRequests`

### Liveness Properties
- ✅ Initialization eventually completes
- ✅ Every request eventually gets a response or cancellation
- ✅ Sessions can always progress to shutdown
- ✅ Fairness constraints ensure enabled actions eventually fire

## Understanding the Spec

The specification models:
1. **States**: `Uninitialized`, `Initializing`, `Initialized`, `Operating`, `Shutdown`
2. **Actions**: `SendInitialize`, `ReceiveInitializeResponse`, `SendToolCall`, etc.
3. **Invariants**: Properties that must always hold
4. **Temporal Properties**: Properties about sequences of states

## Verification Results

When you run TLC, you should see:

```
TLC2 Version 2.18
...
Finished computing initial states: 1 distinct state generated.
Model checking completed. No errors found.
  States found: 245
  Distinct states: 157
  State queue size: 0
```

This means all 157 reachable states were checked and no invariant violations were found!

## Next Steps

- Review `MCPLifecycle.tla` to understand the specification
- Modify constants in `MCP.cfg` to check larger state spaces
- Add your own invariants to verify additional properties
- Extend the spec to model HTTP transport, sampling, or other features
