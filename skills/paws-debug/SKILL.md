---
name: paws-debug
description: Diagnose a named PAWS CATS, DOGS, arena, prompt, persona, bundle, or cross-CLI discrepancy; repair it only when requested.
---

# PAWS Debug

Diagnosis is read-only. Patch the identified owner only when the user's request includes implementation.

Trace one artifact from source through bundle serialization and application. Do not
change prompt meaning to hide a transport or schema defect.

## Prerequisites

Supply the failing artifact or bundle, expected prompt/persona semantics, affected CLI
surface, and the exact command or round-trip path that exposes the discrepancy.

## Procedure

1. Reproduce the named artifact through the affected CLI path.
2. Compare source, serialized bundle, decoder, application, and cross-CLI boundaries.
3. Report the first divergent field; only if repair is requested, patch its owner and
   run round-trip, cross-CLI, focused, and shared-core checks as applicable.

## Reproduce

Capture the exact command, versions, input files, stdout/stderr, exit status, bundle
artifact, and applied output. Minimize to one failing fixture without changing its
semantic trigger.

## Inspect Boundaries

1. Source prompt/persona or CATSCAN input.
2. Core parser and normalized representation in `packages/core/`.
3. CATS serialized bundle, identifiers, ordering, and hashes.
4. CLI transport and argument handling.
5. DOGS decode/application result.
6. Arena or downstream consumer behavior.

For cross-CLI drift, feed the same fixture to both implementations and compare the
first divergent normalized object. For persona drift, distinguish source text changes
from ordering, truncation, escaping, or application defects.

## Authorized Repair And Proof

When repair is requested, patch the boundary that first corrupts or rejects the artifact. Add a round-trip or
cross-CLI regression fixture, run the focused test and the relevant CLI suites, then
run the repository-wide test command when shared core behavior changed. Report the
exact divergent field and whether prompt/persona semantics changed intentionally.

## Validation

The same fixture round-trips through the affected CLI implementations without an
undeclared field, ordering, escaping, or persona-content difference.

## Stop Conditions

Stop if the input bundle or intended persona semantics are unknown. Do not alter
persona meaning to mask a bundler, decoder, or transport failure.

## Outputs

An artifact-bound diagnosis naming the divergent field and owner and, for an authorized
repair, round-trip and cross-CLI regression evidence.

## Side Effects

Diagnosis reads bundles and runs local CLIs. Authorized repair may edit PAWS and write
test artifacts; it does not authorize changes to prompt or persona intent.
