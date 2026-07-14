---
name: paws-debug
description: Diagnose PAWS CATS, DOGS, arena, prompt, persona, and CLI failures. Use when bundles differ, application loses content, JavaScript and Python disagree, commands fail, or persona behavior drifts.
---

# PAWS Debug

Trace one artifact from source through bundle serialization and application. Do not
change prompt meaning to hide a transport or schema defect.

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

## Fix And Prove

Patch the boundary that first corrupts or rejects the artifact. Add a round-trip or
cross-CLI regression fixture, run the focused test and the relevant CLI suites, then
run the repository-wide test command when shared core behavior changed. Report the
exact divergent field and whether prompt/persona semantics changed intentionally.
