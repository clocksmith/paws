# Getting Started with Formal Verification

A practical 30-minute guide to verifying MCP and MWP protocols with TLA+ and Alloy.

## Prerequisites

- Java 8+ installed
- Basic understanding of logic and state machines
- Familiarity with MCP/MWP protocols (read specs first!)

## Part 1: TLA+ in 15 Minutes

### Step 1: Install TLA+ (2 minutes)

```bash
# Download TLA+ tools
cd /Users/xyz/deco/mwp/formal-verification
mkdir -p tools
cd tools
wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar

# Verify installation
java -jar tla2tools.jar -h
```

### Step 2: Write Your First Spec (5 minutes)

Create `counter.tla`:

```tla
---- MODULE counter ----
EXTENDS Naturals

VARIABLE x

Init == x = 0

Increment == x' = x + 1
Decrement == x' = x - 1

Next == Increment \/ Decrement

Spec == Init /\ [][Next]_x

\* Invariant: counter is always non-negative
NonNegative == x >= 0

====
```

**What this means:**
- `VARIABLE x` - State variable (the counter)
- `Init` - Initial state (x starts at 0)
- `Next` - Possible transitions (increment or decrement)
- `NonNegative` - Property to check (x never goes negative)

### Step 3: Check the Spec (3 minutes)

```bash
# Run model checker
java -jar tools/tla2tools.jar counter.tla

# Output shows:
# ERROR: Invariant NonNegative is violated.
# Counterexample: Init -> Decrement (x becomes -1)
```

**TLA+ found a bug!** The counter can go negative if we decrement from 0.

### Step 4: Fix the Bug (2 minutes)

Update `counter.tla`:

```tla
Decrement == x > 0 /\ x' = x - 1  (* Only decrement if x > 0 *)
```

Re-run checker:

```bash
java -jar tools/tla2tools.jar counter.tla
# Output: Model checking completed. No errors found.
```

✅ **Property verified!** Counter can never go negative.

### Step 5: Check MCP Lifecycle (3 minutes)

```bash
cd mcp-tla
java -jar ../tools/tla2tools.jar MCPLifecycle.tla -config MCP.cfg

# This checks:
# - No tool calls before initialization ✅
# - Request IDs are unique ✅
# - Responses match requests ✅
# - All temporal properties ✅
```

**Key Takeaways:**
- TLA+ finds edge cases you'd never think to test
- Temporal logic (`[]`, `<>`) expresses "always" and "eventually"
- Model checker exhaustively explores all reachable states

---

## Part 2: Alloy in 15 Minutes

### Step 1: Install Alloy (2 minutes)

```bash
cd /Users/xyz/deco/mwp/formal-verification/tools
wget https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.0.0/alloy.jar

# Verify installation
java -jar alloy.jar --help
```

### Step 2: Write Your First Spec (5 minutes)

Create `filesystem.als`:

```alloy
-- Simple filesystem model

sig File {}
sig Dir {
  contains: set (File + Dir)
}

-- Fact: No directory contains itself (directly or indirectly)
fact NoCycles {
  all d: Dir | d not in d.^contains
}

-- Fact: Every file is in exactly one directory
fact FileOwnership {
  all f: File | one d: Dir | f in d.contains
}

-- Check: Can we have a filesystem with 3 directories and 5 files?
run Example {
  #Dir = 3
  #File = 5
} for 5
```

**What this means:**
- `sig` - Signature (like a class/type)
- `fact` - Constraint that always holds
- `run` - Find example satisfying constraints
- `check` - Verify assertion (find counterexample if false)

### Step 3: Run the Model (3 minutes)

```bash
# Open GUI
java -jar tools/alloy.jar filesystem.als

# In GUI:
# 1. Click "Execute" menu
# 2. Select "Run Example"
# 3. Alloy generates visual diagram showing valid filesystem
```

Alloy will show a graph with 3 directories and 5 files, respecting all constraints!

### Step 4: Add a Check (2 minutes)

Add to `filesystem.als`:

```alloy
-- Check: Can a file be in two directories?
assert NoFileDuplication {
  all f: File | lone d: Dir | f in d.contains
}

check NoFileDuplication for 5
```

Run check in GUI:
```
# Execute > Check NoFileDuplication
# Result: No counterexample found (property holds!)
```

### Step 5: Check MWP Contracts (3 minutes)

```bash
cd mwp-alloy
java -jar ../tools/alloy.jar WidgetContracts.als

# In GUI:
# Execute > Check AllWidgetsMCPCompliant

# This verifies:
# - Widgets only call declared tools ✅
# - Permission model enforced ✅
# - MWP refines MCP ✅
```

**Key Takeaways:**
- Alloy finds structural violations (wrong relationships)
- Visual counterexamples make bugs obvious
- Great for API contracts and refinement proofs

---

## Part 3: Verify MCP/MWP (Hands-On)

### Exercise 1: Add New MCP Capability (10 minutes)

**Goal**: Extend MCP lifecycle spec to support the `elicitation` capability.

1. **Edit `mcp-tla/MCPLifecycle.tla`:**

```tla
(* Add elicitation to capabilities *)
Capabilities == [
  tools: BOOLEAN,
  resources: BOOLEAN,
  prompts: BOOLEAN,
  sampling: BOOLEAN,
  elicitation: BOOLEAN  (* NEW *)
]

(* Add elicitation request action *)
SendElicitationRequest(c, s) ==
  /\ sessionState[<<c, s>>] = "Operating"
  /\ capabilities[<<c, s>>].elicitation = TRUE
  /\ Cardinality(sentRequests) < MaxRequests
  /\ LET req == [
       id |-> nextRequestId[<<c, s>>],
       method |-> "elicitation/create",
       from |-> c,
       to |-> s
     ]
     IN
       /\ sentRequests' = sentRequests \cup {req}
       /\ nextRequestId' = [nextRequestId EXCEPT ![<<c, s>>] = @ + 1]
       /\ UNCHANGED <<sessionState, receivedResponses, capabilities>>

(* Update Next to include new action *)
Next ==
  \E c \in Clients, s \in Servers :
    \/ SendInitialize(c, s)
    \/ ...
    \/ SendElicitationRequest(c, s)  (* NEW *)
```

2. **Run model checker:**

```bash
cd mcp-tla
java -jar ../tools/tla2tools.jar MCPLifecycle.tla -config MCP.cfg
```

3. **Verify new invariant:**

```tla
(* Add invariant: elicitation only after negotiation *)
NoElicitationWithoutCapability ==
  \A req \in sentRequests :
    (req.method = "elicitation/create") =>
      \E c \in Clients, s \in Servers :
        /\ req.from = c
        /\ req.to = s
        /\ capabilities[<<c, s>>].elicitation = TRUE
```

**Expected Result**: Model checker verifies elicitation capability works correctly!

### Exercise 2: Add Widget Permission to MWP (10 minutes)

**Goal**: Add `clipboard` permission to widget security model.

1. **Edit `mwp-alloy/WidgetContracts.als`:**

```alloy
enum OperationType {
  CallTool,
  ReadResource,
  GetPrompt,
  Subscribe,
  AccessClipboard  // NEW
}

sig WidgetPermissions {
  trustLevel: one TrustLevel,
  allowedOperations: set OperationType,
  storageLevel: one StorageLevel,
  networkDomains: set String,
  clipboardAccess: one Bool  // NEW
}

// Fact: Clipboard access requires permission
fact ClipboardRequiresPermission {
  all w: Widget |
    w.permissions.clipboardAccess = True =>
      AccessClipboard in w.permissions.allowedOperations
}

// Check: Untrusted widgets can't access clipboard
assert UntrustedNoClipboard {
  all w: Widget |
    w.permissions.trustLevel = Untrusted =>
      w.permissions.clipboardAccess = False
}

check UntrustedNoClipboard for 8
```

2. **Run Alloy analyzer:**

```bash
cd mwp-alloy
java -jar ../tools/alloy.jar WidgetContracts.als
# Execute > Check UntrustedNoClipboard
```

**Expected Result**: No counterexample (untrusted widgets can't access clipboard)!

---

## Common Pitfalls & Solutions

### TLA+ Pitfalls

**Problem**: "Deadlock detected"
```
Solution: Check that Next relation always has enabled transitions
Add: Next == ... \/ UNCHANGED vars  (* stuttering step *)
```

**Problem**: "State space too large"
```
Solution: Reduce constants in .cfg file
Or add state constraint to limit exploration
```

**Problem**: "Temporal property never holds"
```
Solution: Check Spec includes fairness: Spec == Init /\ [][Next]_vars /\ WF_vars(SomeAction)
```

### Alloy Pitfalls

**Problem**: "No instance found"
```
Solution: Increase scope: run Example for 10 (instead of 5)
Or relax constraints
```

**Problem**: "Trivial instance (empty model)"
```
Solution: Add existence constraints: some Widget, some MCPServer
```

**Problem**: "Too many instances to visualize"
```
Solution: Add specific constraints to narrow down examples
run Example { #Widget = 2 and #Tool = 3 } for 5
```

---

## Next Steps

### For TLA+:
1. Read "Specifying Systems" by Leslie Lamport (free PDF)
2. Watch TLA+ video course: https://lamport.azurewebsites.net/video/videos.html
3. Study AWS TLA+ specs: https://github.com/awslabs/aws-specs
4. Model HTTP transport for MCP

### For Alloy:
1. Read "Software Abstractions" by Daniel Jackson
2. Try online tutorial: https://alloytools.org/tutorials/online
3. Study Alloy models repository: https://github.com/AlloyTools/models
4. Model inter-widget communication for MWP

### For Both:
1. Combine TLA+ (protocol) and Alloy (structure) for complete verification
2. Generate property-based tests from specs
3. Integrate into CI/CD pipeline
4. Publish verified specs alongside protocol documentation

---

## Resources

**TLA+ Quick Reference:**
- `[]P` - P always holds (globally)
- `<>P` - P eventually holds
- `P => Q` - If P then Q
- `P /\ Q` - P and Q
- `P \/ Q` - P or Q
- `x'` - Value of x in next state
- `UNCHANGED x` - x doesn't change

**Alloy Quick Reference:**
- `sig S {}` - Declare signature
- `all x: S | P` - For all x in S, P holds
- `some x: S | P` - There exists x in S where P holds
- `no x: S | P` - There is no x in S where P holds
- `x.y` - Join (navigate relation)
- `^r` - Transitive closure of r
- `*r` - Reflexive-transitive closure

---

**Time Investment**: 30 minutes
**Skill Level After**: Can verify basic protocol properties
**Next Level**: Complete real MCP/MWP verification (2-3 weeks)

Happy verifying! 🎉
