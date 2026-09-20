# paws goals

## Mission & Thesis

PAWS preserves tools and research for preparing code context, applying proposed changes, and comparing model-assisted workflows. Its repository is archived; this governance work records its purpose without restarting development or implying an active product commitment. The lasting technical question is whether a frozen context and a proposed change can be exchanged, inspected, and reproduced faithfully.

## Intended Beneficiaries

Users of CATS and DOGS need to know exactly what went into a bundle and what an application step would change. Researchers need comparable runs with identified prompts, personas, models, and inputs. Maintainers of existing artifacts need compatibility and clear instructions rather than silent changes to the meaning of archived experiments.

## Desired Outcomes

1. Preserve deterministic bundle identifiers, file ordering, and round-trip behavior for supported workflows.
2. Keep the bundler's input selection separate from the applier's authority to change files.
3. Make a proposed application inspectable and prevent writes outside its authorized destination.
4. Retain prompt and persona identity when comparing arena results.
5. Explain the archived implementation and its limits without claiming renewed maintenance or contemporary model qualification.

## Operating Loops

Select and freeze the intended context, record the bundle configuration, produce the artifact, and inspect its contents. Apply only through the declared change boundary and compare the result with the expected files. For a shared JavaScript/Python behavior, use the same fixture and compare outputs. For arena research, hold the relevant inputs constant and retain outcomes alongside failures and unsupported cases.

## Strategic Constraints

Preserve existing prompt and persona intent unless the user explicitly requests a semantic change. Do not overwrite unrelated user work or accept paths that escape the permitted application root. Bundle completeness is a property to check, not a consequence of file size. A clean application does not prove that generated code is correct. Archived examples, benchmark records, and model integrations must retain their original evidence scope rather than acquire new claims through editorial updates.

## Explicit Exclusions

PAWS is not an autonomous repository owner, a guarantee of model answer quality, or a mandate to modernize every archived dependency. This rollout does not authorize publishing a new release, changing system prompts, moving historical experiments, or promoting research tooling into another project's production path.

Related: [INTENT.md](INTENT.md), [CATSCAN.md](CATSCAN.md).
