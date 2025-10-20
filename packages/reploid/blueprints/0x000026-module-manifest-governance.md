# Blueprint 0x000026: Module Manifest & Dependency Governance

**Objective:** Define the structure, lifecycle, and review process for `/upgrades/module-manifest.json`, the authoritative catalog for REPLOID modules.

**Target Upgrade:** MMNF (`module-manifest.json`)


**Target Artifact:** MMNF (`module-manifest.json`)

**Prerequisites:** 0x000002 (Application Orchestration), 0x000013 (System Configuration Structure), 0x000025 (Universal Module Loader)

**Affected Artifacts:** `/upgrades/module-manifest.json`, `/upgrades/boot-module-loader.js`, `/upgrades/state-manager.js`

---

### 1. The Strategic Imperative
The manifest is the single source of truth that tells the loader **what** to load, **when**, and **under which capability flag**. Without a curated manifest:
- Module ordering becomes implicit and brittle.
- Optional upgrades can slip into minimal personas.
- The UI cannot present accurate capability toggles.
- Dependency cycles slip past reviewers.

This blueprint keeps the manifest auditable, diffable, and aligned with runtime expectations.

### 2. Structural Overview
`module-manifest.json` is divided into four primary sections:

1. **`loadGroups`** – Ordered batches of modules that represent boot stages. Each entry includes:
   ```json
   {
     "level": 0,
     "description": "Pure utilities (no dependencies)",
     "modules": [{ "id": "Utils", "path": "/modules/utils.js", "description": "Core utilities" }]
   }
   ```
   - Level 0 = dependency roots, higher levels rely on earlier ones.
   - Each module is referenced by VFS path (relative to `/modules` namespace).

2. **`optionalModules`** – Upgrades that require explicit flags (e.g., `requiredUpgrade`) before loading. These map to persona switches or hunter selections.

3. **`dataFiles`** – Non-JS artifacts (prompts, tool manifests, configs) that the App logic should hydrate into the VFS before boot.

4. **`templates`** – HTML/CSS skeletons that pair with UI modules.

### 3. Implementation Pathway
1. **Onboarding a New Module**
   - Assign a unique `id` (matching `metadata.id` inside the JS module).
   - Decide its boot level:
     - Pure helpers → `level: 0`
     - Storage/state → `level: 1`
     - Application services → `level: 2`
     - UI/runtime shells → `level: 3+`
   - Add entry to the appropriate `loadGroup.modules` array with description.
   - If capability-gated, echo the entry in `optionalModules` with `requiredUpgrade`.

2. **Marking Optional/Experimental Modules**
   - Flag experimental modules here **and** in config (`state.config.upgrades`).
   - Include risk notes in description so hunter mode surfaces warnings.

3. **Maintaining Data & Templates**
   - Ensure every item listed exists under `/modules/…` in the build output.
   - When schema changes (e.g., new tool manifest fields), bump manifest `version`.

4. **Validation Hooks**
   - Add CI lint that ensures every `modules[*].id` matches an upgrade entry.
   - Detect duplicates across `loadGroups` and `optionalModules`.

### 4. Operational Practices
- **Review diff context**: a manifest change should accompany a blueprint update (0x000026) and upgrade patch.
- **Keep descriptions actionable**: highlight runtime role, not just name.
- **Synced with Personas**: hunter UI renders module grid using this manifest; missing descriptions lead to empty tooltips.
- **Disaster Recovery**: since manifest drives boot order, include it in backup snapshots so audits can reconstruct past runs.

### 5. Example Checklist for Reviewers
- [ ] Module ID exists and matches upgrade metadata.
- [ ] Path resolves to build artifact.
- [ ] Dependencies align with preceding levels.
- [ ] Optional entries include `requiredUpgrade`.
- [ ] Data/templates still referenced by boot logic.

Maintain this blueprint as the canonical policy for editing the manifest. Treat manifest edits with the same scrutiny as code changes—they decide which capabilities ship.
