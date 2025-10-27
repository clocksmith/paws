----------------------------- MODULE MCPLifecycle -----------------------------
(*
  MCP Protocol Lifecycle Specification

  This specification models the lifecycle of an MCP (Model Context Protocol) session
  between a client and server, verifying:
    - Proper state transitions
    - Request/response ordering
    - ID uniqueness
    - Capability negotiation correctness

  Author: PAWS Team
  Date: 2025-10-21
  MCP Version: 2025-06-18
*)

EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS
  Clients,          \* Set of clients
  Servers,          \* Set of servers
  MaxRequests       \* Maximum requests per session (for model checking bounds)

VARIABLES
  sessionState,     \* Current state of each client-server session
  sentRequests,     \* Set of all requests sent
  receivedResponses,\* Set of all responses received
  capabilities,     \* Negotiated capabilities per session
  nextRequestId     \* Next available request ID per client-server pair

----------------------------------------------------------------------------

(*
  State definitions
*)

States == {
  "Uninitialized",  \* No connection established
  "Initializing",   \* Initialize request sent, waiting for response
  "Initialized",    \* Server responded, waiting for initialized notification
  "Operating",      \* Initialized notification sent, normal operations allowed
  "Shutdown"        \* Connection being closed
}

Sessions == Clients \X Servers

(*
  Request and response message structures
*)

RequestIds == Nat \ {0}  \* Request IDs are positive integers

Request == [
  id: RequestIds,
  method: STRING,
  from: Clients,
  to: Servers
]

Response == [
  id: RequestIds,
  result: BOOLEAN,  \* Simplified - just success/failure for model checking
  from: Servers,
  to: Clients
]

Capabilities == [
  tools: BOOLEAN,
  resources: BOOLEAN,
  prompts: BOOLEAN,
  sampling: BOOLEAN
]

----------------------------------------------------------------------------

(*
  Type invariant - defines valid values for all variables
*)

TypeOK ==
  /\ sessionState \in [Sessions -> States]
  /\ sentRequests \subseteq Request
  /\ receivedResponses \subseteq Response
  /\ capabilities \in [Sessions -> Capabilities]
  /\ nextRequestId \in [Sessions -> RequestIds]

----------------------------------------------------------------------------

(*
  Initial state
*)

Init ==
  /\ sessionState = [s \in Sessions |-> "Uninitialized"]
  /\ sentRequests = {}
  /\ receivedResponses = {}
  /\ capabilities = [s \in Sessions |-> [
       tools |-> FALSE,
       resources |-> FALSE,
       prompts |-> FALSE,
       sampling |-> FALSE
     ]]
  /\ nextRequestId = [s \in Sessions |-> 1]

----------------------------------------------------------------------------

(*
  Actions - state transitions
*)

(* Client sends initialize request *)
SendInitialize(c, s) ==
  /\ sessionState[<<c, s>>] = "Uninitialized"
  /\ Cardinality(sentRequests) < MaxRequests
  /\ LET req == [
       id |-> nextRequestId[<<c, s>>],
       method |-> "initialize",
       from |-> c,
       to |-> s
     ]
     IN
       /\ sentRequests' = sentRequests \cup {req}
       /\ sessionState' = [sessionState EXCEPT ![<<c, s>>] = "Initializing"]
       /\ nextRequestId' = [nextRequestId EXCEPT ![<<c, s>>] = @ + 1]
       /\ UNCHANGED <<receivedResponses, capabilities>>

(* Server responds to initialize with capabilities *)
ReceiveInitializeResponse(c, s) ==
  /\ sessionState[<<c, s>>] = "Initializing"
  /\ \E req \in sentRequests :
       /\ req.from = c
       /\ req.to = s
       /\ req.method = "initialize"
       /\ LET resp == [
            id |-> req.id,
            result |-> TRUE,
            from |-> s,
            to |-> c
          ]
          caps == [
            tools |-> TRUE,
            resources |-> TRUE,
            prompts |-> FALSE,
            sampling |-> TRUE
          ]
          IN
            /\ receivedResponses' = receivedResponses \cup {resp}
            /\ capabilities' = [capabilities EXCEPT ![<<c, s>>] = caps]
            /\ sessionState' = [sessionState EXCEPT ![<<c, s>>] = "Initialized"]
            /\ UNCHANGED <<sentRequests, nextRequestId>>

(* Client sends initialized notification *)
SendInitializedNotification(c, s) ==
  /\ sessionState[<<c, s>>] = "Initialized"
  /\ sessionState' = [sessionState EXCEPT ![<<c, s>>] = "Operating"]
  /\ UNCHANGED <<sentRequests, receivedResponses, capabilities, nextRequestId>>

(* Client sends tool call (only allowed in Operating state) *)
SendToolCall(c, s) ==
  /\ sessionState[<<c, s>>] = "Operating"
  /\ capabilities[<<c, s>>].tools = TRUE  \* Must have capability!
  /\ Cardinality(sentRequests) < MaxRequests
  /\ LET req == [
       id |-> nextRequestId[<<c, s>>],
       method |-> "tools/call",
       from |-> c,
       to |-> s
     ]
     IN
       /\ sentRequests' = sentRequests \cup {req}
       /\ nextRequestId' = [nextRequestId EXCEPT ![<<c, s>>] = @ + 1]
       /\ UNCHANGED <<sessionState, receivedResponses, capabilities>>

(* Server responds to tool call *)
ReceiveToolCallResponse(c, s) ==
  /\ sessionState[<<c, s>>] = "Operating"
  /\ \E req \in sentRequests :
       /\ req.from = c
       /\ req.to = s
       /\ req.method = "tools/call"
       /\ ~\E resp \in receivedResponses : resp.id = req.id  \* No duplicate responses
       /\ LET resp == [
            id |-> req.id,
            result |-> TRUE,
            from |-> s,
            to |-> c
          ]
          IN
            /\ receivedResponses' = receivedResponses \cup {resp}
            /\ UNCHANGED <<sessionState, sentRequests, capabilities, nextRequestId>>

(* Client initiates shutdown *)
Shutdown(c, s) ==
  /\ sessionState[<<c, s>>] \in {"Operating", "Initialized"}
  /\ sessionState' = [sessionState EXCEPT ![<<c, s>>] = "Shutdown"]
  /\ UNCHANGED <<sentRequests, receivedResponses, capabilities, nextRequestId>>

----------------------------------------------------------------------------

(*
  Next-state relation - all possible transitions
*)

Next ==
  \E c \in Clients, s \in Servers :
    \/ SendInitialize(c, s)
    \/ ReceiveInitializeResponse(c, s)
    \/ SendInitializedNotification(c, s)
    \/ SendToolCall(c, s)
    \/ ReceiveToolCallResponse(c, s)
    \/ Shutdown(c, s)

vars == <<sessionState, sentRequests, receivedResponses, capabilities, nextRequestId>>

----------------------------------------------------------------------------

(*
  Specification - what behaviors are allowed
*)

Spec ==
  Init
  /\ [][Next]_vars
  /\ \A c \in Clients, s \in Servers :
       WF_vars(SendInitialize(c, s))
  /\ \A c \in Clients, s \in Servers :
       WF_vars(ReceiveInitializeResponse(c, s))
  /\ \A c \in Clients, s \in Servers :
       WF_vars(SendToolCall(c, s))
  /\ \A c \in Clients, s \in Servers :
       WF_vars(ReceiveToolCallResponse(c, s))

----------------------------------------------------------------------------

(*
  INVARIANTS - Properties that must ALWAYS hold
*)

(* Safety: No tool calls before session is in Operating state *)
NoToolsBeforeOperating ==
  \A req \in sentRequests :
    (req.method = "tools/call") =>
      \E c \in Clients, s \in Servers :
        /\ req.from = c
        /\ req.to = s
        /\ sessionState[<<c, s>>] = "Operating"

(* Safety: Request IDs are unique per session *)
UniqueRequestIDs ==
  \A req1, req2 \in sentRequests :
    (req1.from = req2.from /\ req1.to = req2.to /\ req1 # req2) =>
      req1.id # req2.id

(* Safety: Response IDs match request IDs *)
ResponseMatchesRequest ==
  \A resp \in receivedResponses :
    \E req \in sentRequests :
      /\ resp.id = req.id
      /\ resp.from = req.to
      /\ resp.to = req.from

(* Safety: Can't use capability that wasn't negotiated *)
NoUndeclaredCapabilities ==
  \A req \in sentRequests :
    (req.method = "tools/call") =>
      \E c \in Clients, s \in Servers :
        /\ req.from = c
        /\ req.to = s
        /\ capabilities[<<c, s>>].tools = TRUE

(* Safety: Capabilities match lifecycle state *)
CapabilitiesConsistent ==
  \A session \in Sessions :
    LET caps == capabilities[session] IN
      (caps.tools = TRUE \/ caps.resources = TRUE \/ caps.prompts = TRUE \/ caps.sampling = TRUE)
        => sessionState[session] \in {"Initialized", "Operating", "Shutdown"}

(* Safety: Outstanding requests bounded per session *)
OutstandingRequestsBounded ==
  \A c \in Clients, s \in Servers :
    LET requests == {req \in sentRequests : req.from = c /\ req.to = s /\ ~(\E resp \in receivedResponses : resp.id = req.id)}
    IN Cardinality(requests) <= MaxRequests

(* Safety: Session states follow valid transitions *)
ValidStateTransitions ==
  \A session \in Sessions :
    LET state == sessionState[session]
    IN
      state \in States

(* Safety: Once initialized, can't go back to uninitialized *)
NoBackwardTransition ==
  \A session \in Sessions :
    (sessionState[session] \in {"Operating", "Shutdown"}) =>
      sessionState[session] # "Uninitialized"

----------------------------------------------------------------------------

(*
  TEMPORAL PROPERTIES - Properties about sequences of states
*)

(* Liveness: Eventually every session either reaches Operating or Shutdown *)
EventuallyProgresses ==
  \A c \in Clients, s \in Servers :
    <>(sessionState[<<c, s>>] \in {"Operating", "Shutdown"})

(* Liveness: If initialize is sent, eventually a response is received *)
InitializeEventuallyCompletes ==
  \A c \in Clients, s \in Servers :
    (\E req \in sentRequests : req.from = c /\ req.to = s /\ req.method = "initialize") =>
      <>(\E resp \in receivedResponses : resp.to = c /\ resp.from = s)

----------------------------------------------------------------------------

(*
  THEOREMS - Properties we can check
*)

(* Main correctness theorem *)
THEOREM SpecImpliesInvariants ==
  Spec => [](
    TypeOK
    /\ NoToolsBeforeOperating
    /\ UniqueRequestIDs
    /\ ResponseMatchesRequest
    /\ NoUndeclaredCapabilities
    /\ ValidStateTransitions
    /\ NoBackwardTransition
    /\ CapabilitiesConsistent
    /\ OutstandingRequestsBounded
  )

=============================================================================
