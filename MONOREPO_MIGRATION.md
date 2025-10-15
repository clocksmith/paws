# PAWS Monorepo Migration TODO

## About This Document

**Purpose:** This is a living TODO list for migrating PAWS from its current structure to a clean monorepo architecture where:
- **PAWS Core** (personas, sys prompts, configs) is its own package
- **PAWS CLI (JavaScript)** is its own package
- **PAWS CLI (Python)** is its own package
- **REPLOID** (browser interface) is its own package

**How to Use:**
1. Work through tasks continuously or periodically
2. Check off each `[ ]` box as you complete tasks: `[x]`
3. Commit progress after each phase
4. Test thoroughly after each phase before proceeding

**When to Delete This File:**
Delete this file when all 147 tasks are complete and the migration is successful.

---

## Progress Tracker

**Total Tasks:** 147
**Completed:** 0/147 (0%)

**Phase Status:**
- [ ] Phase 1: Workspace Infrastructure (3 tasks)
- [ ] Phase 2: Core Package (4 tasks)
- [ ] Phase 3: JavaScript CLI (24 tasks)
- [ ] Phase 4: Python CLI (24 tasks)
- [ ] Phase 5: REPLOID Package (6 tasks)
- [ ] Phase 6: Integrations (4 tasks)
- [ ] Phase 7: Root Configuration (10 tasks)
- [ ] Phase 8: CI/CD (3 tasks)
- [ ] Phase 9: Install & Verify (18 tasks)
- [ ] Phase 10: Package READMEs (4 tasks)
- [ ] Phase 11: Final Validation (29 tasks)
- [ ] Success Criteria (11 checks)
- [ ] Risk Mitigation (6 checks)
- [ ] Post-Migration Cleanup (10 tasks)

---

## Current Directory Structure

```
paws/
├── js/                  # JavaScript CLI (128KB)
├── py/                  # Python CLI (2.4MB)
├── reploid/             # Browser interface (4.8MB)
├── personas/            # Persona definitions (15 files)
├── sys/                 # System prompts (3 files)
├── demos/               # EMPTY - to be deleted
├── integrations/        # MCP + VSCode
├── scripts/             # check-reploid-sync.js
└── node_modules/        # Shared dependencies (214MB)
```

---

## Target Monorepo Structure

```
paws/
├── packages/
│   ├── core/                      # @paws/core
│   │   ├── personas/
│   │   ├── sys/
│   │   ├── configs/
│   │   └── package.json
│   │
│   ├── cli-js/                    # @paws/cli-js
│   │   ├── src/
│   │   ├── test/
│   │   ├── bin/
│   │   └── package.json
│   │
│   ├── cli-py/                    # @paws/cli-py
│   │   ├── paws/
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   │
│   └── reploid/                   # @paws/reploid
│       └── package.json (updated)
│
├── integrations/
├── docs/
├── scripts/
├── package.json (workspace root)
└── pnpm-workspace.yaml
```

---

# Migration Tasks

## PHASE 1: Setup Workspace Infrastructure (3 tasks)

### 1.1 Create Monorepo Configuration
- [ ] Create `pnpm-workspace.yaml` in root:
  ```yaml
  packages:
    - 'packages/*'
    - 'integrations/*'
  ```
- [ ] Update root `package.json`:
  - Remove `bin` entries (move to cli-js)
  - Remove direct dependencies (move to packages)
  - Add `"workspaces": ["packages/*", "integrations/*"]`
  - Keep devDependencies for root-level tooling
- [ ] Install pnpm globally if not installed: `npm install -g pnpm`

### 1.2 Create Directory Structure
- [ ] Create `packages/` directory
- [ ] Create `packages/core/` directory
- [ ] Create `packages/cli-js/` directory
- [ ] Create `packages/cli-py/` directory
- [ ] Create `docs/` directory

---

## PHASE 2: Migrate Core Package (@paws/core) (4 tasks)

### 2.1 Move Shared Resources
- [ ] Move `/personas/` → `/packages/core/personas/`
- [ ] Move `/sys/` → `/packages/core/sys/`
- [ ] Create `/packages/core/configs/` directory
- [ ] Copy `/paxos_config.json` → `/packages/core/configs/paxos_config.json`

### 2.2 Create Core Package Config
- [ ] Create `/packages/core/package.json`:
  ```json
  {
    "name": "@paws/core",
    "version": "1.0.0",
    "description": "Shared resources for PAWS - personas, system prompts, and configs",
    "main": "index.js",
    "exports": {
      "./personas/*": "./personas/*",
      "./sys/*": "./sys/*",
      "./configs/*": "./configs/*",
      "./package.json": "./package.json"
    },
    "files": ["personas", "sys", "configs", "index.js"],
    "license": "MIT"
  }
  ```
- [ ] Create `/packages/core/index.js`:
  ```js
  const path = require('path');
  module.exports = {
    getPersonasPath: () => path.join(__dirname, 'personas'),
    getSysPath: () => path.join(__dirname, 'sys'),
    getConfigsPath: () => path.join(__dirname, 'configs')
  };
  ```

---

## PHASE 3: Migrate JavaScript CLI (@paws/cli-js) (24 tasks)

### 3.1 Move Source Files
- [ ] Create `/packages/cli-js/src/` directory
- [ ] Move `/js/cats.js` → `/packages/cli-js/src/cats.js`
- [ ] Move `/js/dogs.js` → `/packages/cli-js/src/dogs.js`
- [ ] Move `/js/paws-session.js` → `/packages/cli-js/src/session.js`
- [ ] Move `/js/progress-bus.js` → `/packages/cli-js/src/progress-bus.js`

### 3.2 Update Import Paths in cats.js
- [ ] Change `require('./progress-bus.js')` → `require('./progress-bus')`
- [ ] Add core path resolution helper:
  ```js
  const { getSysPath, getPersonasPath } = require('@paws/core');
  const DEFAULT_SYS_PROMPT = path.join(getSysPath(), 'sys_a.md');
  ```
- [ ] Update CLI option default:
  - From: `.option('-s, --sys-prompt-file <file>', ..., 'sys/sys_a.md')`
  - To: `.option('-s, --sys-prompt-file <file>', ..., DEFAULT_SYS_PROMPT)`

### 3.3 Update Import Paths in dogs.js
- [ ] Change any relative imports to use package name
- [ ] Add core path resolution if needed

### 3.4 Create CLI Entry Points
- [ ] Create `/packages/cli-js/bin/` directory
- [ ] Create `/packages/cli-js/bin/cats.js`:
  ```js
  #!/usr/bin/env node
  const { main } = require('../src/cats');
  main().then(code => process.exit(code));
  ```
- [ ] Create `/packages/cli-js/bin/dogs.js`:
  ```js
  #!/usr/bin/env node
  const { main } = require('../src/dogs');
  main().then(code => process.exit(code));
  ```
- [ ] Create `/packages/cli-js/bin/paws-session.js`:
  ```js
  #!/usr/bin/env node
  require('../src/session');
  ```
- [ ] Make all bin files executable: `chmod +x packages/cli-js/bin/*.js`

### 3.5 Move Tests
- [ ] Move `/js/test/` → `/packages/cli-js/test/`
- [ ] Update test imports to use `../src/` paths
- [ ] Update test helper paths if any

### 3.6 Create Package Config
- [ ] Create `/packages/cli-js/package.json` with:
  - name: "@paws/cli-js"
  - version: "3.0.0"
  - dependencies including "@paws/core": "workspace:*"
  - bin entries for cats, dogs, paws-session
  - test script
  - all required dependencies from root

---

## PHASE 4: Migrate Python CLI (@paws/cli-py) (24 tasks)

### 4.1 Create Package Structure
- [ ] Create `/packages/cli-py/paws/` directory
- [ ] Create `/packages/cli-py/paws/__init__.py`:
  ```python
  """PAWS Python CLI - Context bundler and change applier"""
  __version__ = "3.0.0"

  import os
  import sys
  from pathlib import Path

  # Resolve core resources path
  _CORE_PKG = Path(__file__).parent.parent.parent / 'core'
  PERSONAS_PATH = _CORE_PKG / 'personas'
  SYS_PATH = _CORE_PKG / 'sys'
  CONFIGS_PATH = _CORE_PKG / 'configs'
  ```

### 4.2 Move Source Files
- [ ] Move `/py/cats.py` → `/packages/cli-py/paws/cats.py`
- [ ] Move `/py/dogs.py` → `/packages/cli-py/paws/dogs.py`
- [ ] Move `/py/paws_session.py` → `/packages/cli-py/paws/session.py`
- [ ] Move `/py/paws_paxos.py` → `/packages/cli-py/paws/paxos.py`
- [ ] Move `/py/paws_swarm.py` → `/packages/cli-py/paws/swarm.py`
- [ ] Move `/py/paws_benchmark.py` → `/packages/cli-py/paws/benchmark.py`
- [ ] Move `/py/paws_context_optimizer.py` → `/packages/cli-py/paws/context_optimizer.py`

### 4.3 Update Import Paths in cats.py
- [ ] Change `DEFAULT_SYS_PROMPT_FILENAME` from `"sys/sys_a.md"` to:
  ```python
  from . import SYS_PATH
  DEFAULT_SYS_PROMPT_FILENAME = str(SYS_PATH / "sys_a.md")
  ```
- [ ] Update persona file loading to use `PERSONAS_PATH`
- [ ] Update any relative imports to absolute package imports

### 4.4 Update Import Paths in Other Python Files
- [ ] Update `paxos.py`: Change `from paws_session import` → `from .session import`
- [ ] Update `dogs.py`: Update any relative imports
- [ ] Update all files: Change imports from `paws_*` to relative imports

### 4.5 Move Tests
- [ ] Move `/py/tests/` → `/packages/cli-py/tests/`
- [ ] Update test imports: `from paws.cats import` instead of `import cats`
- [ ] Update test imports: `from paws.dogs import` instead of `import dogs`
- [ ] Update test file discovery paths if needed

### 4.6 Create Package Config
- [ ] Create `/packages/cli-py/pyproject.toml` with build-system, project metadata, scripts
- [ ] Copy `/requirements.txt` → `/packages/cli-py/requirements.txt`
- [ ] Create `/packages/cli-py/setup.py` (backwards compatibility)

---

## PHASE 5: Update REPLOID Package (@paws/reploid) (6 tasks)

### 5.1 Move REPLOID
- [ ] Move `/reploid/` → `/packages/reploid/` (entire directory)

### 5.2 Update reploid/bin/cats Wrapper
- [ ] Edit `/packages/reploid/bin/cats`:
  - Change: `require('../../js/cats.js')`
  - To: `require('@paws/cli-js/src/cats')`
- [ ] Update checksum comment to reflect new import

### 5.3 Update reploid/bin/dogs Wrapper
- [ ] Edit `/packages/reploid/bin/dogs`:
  - Change: `require('../../js/dogs.js')`
  - To: `require('@paws/cli-js/src/dogs')`
- [ ] Update checksum comment to reflect new import

### 5.4 Update reploid/hermes/paxos_orchestrator.js
- [ ] Change: `require('../../js/dogs.js')`
- [ ] To: `require('@paws/cli-js/src/dogs')`

### 5.5 Update reploid/hermes/package.json
- [ ] Add dependencies: "@paws/cli-js": "workspace:*"

### 5.6 Update reploid/package.json
- [ ] Add dependencies: "@paws/cli-js": "workspace:*", "@paws/core": "workspace:*"

---

## PHASE 6: Update Integrations (4 tasks)

### 6.1 Update MCP Integration
- [ ] Keep `/integrations/mcp/` in place
- [ ] Update `/integrations/mcp/package.json` to include "@paws/cli-js": "workspace:*"
- [ ] Update imports in `/integrations/mcp/src/server.js` if needed

### 6.2 Update VSCode Integration
- [ ] Keep `/integrations/vscode/` in place
- [ ] Update `/integrations/vscode/package.json` to include "@paws/cli-js": "workspace:*"
- [ ] Update imports in VSCode extension code if needed

---

## PHASE 7: Update Root Configuration (10 tasks)

### 7.1 Clean Up Root Directory
- [ ] Delete `/js/` directory (after confirming migration)
- [ ] Delete `/py/` directory (after confirming migration)
- [ ] Delete `/personas/` directory (moved to core)
- [ ] Delete `/sys/` directory (moved to core)
- [ ] Delete `/demos/` directory (empty)
- [ ] Delete `/paxos_config.json` (moved to core)
- [ ] Keep `/scripts/` (update check-reploid-sync.js)
- [ ] Keep `/.github/` (update workflows)

### 7.2 Update scripts/check-reploid-sync.js
- [ ] Update paths: `../js/cats.js` → `../packages/cli-js/src/cats.js`
- [ ] Update paths: `../js/dogs.js` → `../packages/cli-js/src/dogs.js`
- [ ] Update paths: `reploid/bin/cats` → `packages/reploid/bin/cats`

### 7.3 Move Documentation
- [ ] Move `/COGNITIVE_ARCHITECTURE.md` → `/docs/COGNITIVE_ARCHITECTURE.md`
- [ ] Move `/EXAMPLES.md` → `/docs/EXAMPLES.md`
- [ ] Update `/README.md` to reference new structure
- [ ] Create `/docs/README.md` (documentation index)
- [ ] Create `/docs/MIGRATION.md` (migration guide for users)

### 7.4 Update Root README.md
- [ ] Update architecture section to show monorepo structure
- [ ] Update installation instructions
- [ ] Add links to package-specific READMEs
- [ ] Add migration guide link

---

## PHASE 8: Update CI/CD (3 tasks)

### 8.1 Update GitHub Actions - JavaScript Tests
- [ ] Create `.github/workflows/test-cli-js.yml` with pnpm and @paws/cli-js test

### 8.2 Update GitHub Actions - Python Tests
- [ ] Create `.github/workflows/test-cli-py.yml` with pytest for packages/cli-py

### 8.3 Update GitHub Actions - REPLOID Tests
- [ ] Create `.github/workflows/test-reploid.yml` with vitest and playwright

---

## PHASE 9: Install & Verify (18 tasks)

### 9.1 Install Dependencies
- [ ] Run `pnpm install` from root
- [ ] Verify all packages can resolve dependencies
- [ ] Check `node_modules/` structure

### 9.2 Verify JavaScript CLI
- [ ] Run `pnpm --filter @paws/cli-js test`
- [ ] Run `node packages/cli-js/bin/cats.js --help`
- [ ] Run `node packages/cli-js/bin/dogs.js --help`
- [ ] Test cats with actual files: `node packages/cli-js/bin/cats.js packages/core/sys/sys_a.md`
- [ ] Verify personas/sys files are loaded correctly

### 9.3 Verify Python CLI
- [ ] Run `cd packages/cli-py && pip install -e .`
- [ ] Run `python -m paws.cats --help`
- [ ] Run `python -m paws.dogs --help`
- [ ] Run pytest: `cd packages/cli-py && pytest`
- [ ] Test cats with actual files
- [ ] Verify personas/sys files are loaded correctly

### 9.4 Verify REPLOID
- [ ] Run `pnpm --filter @paws/reploid test`
- [ ] Run `pnpm --filter @paws/reploid test:e2e` (Playwright tests)
- [ ] Start server: `cd packages/reploid && node server/proxy.js`
- [ ] Verify reploid bin wrappers work: `node packages/reploid/bin/cats --help`
- [ ] Verify hermes can import dogs: `cd packages/reploid/hermes && node -e "require('@paws/cli-js/src/dogs')"`

### 9.5 Verify Integrations
- [ ] Test MCP integration can import @paws/cli-js
- [ ] Test VSCode integration builds successfully

### 9.6 Verify Checksum Script
- [ ] Run `node scripts/check-reploid-sync.js`
- [ ] Ensure checksums are validated
- [ ] Update checksums if needed

---

## PHASE 10: Create Package READMEs (4 tasks)

### 10.1 Create packages/core/README.md
- [ ] Document purpose: Shared resources
- [ ] Document exports: personas/, sys/, configs/
- [ ] Document how to use in other packages

### 10.2 Create packages/cli-js/README.md
- [ ] Document installation: `npm install -g @paws/cli-js`
- [ ] Document CLI usage
- [ ] Document API if used as library
- [ ] Link to main docs

### 10.3 Create packages/cli-py/README.md
- [ ] Document installation: `pip install paws-cli`
- [ ] Document CLI usage
- [ ] Document Python API
- [ ] Link to main docs

### 10.4 Update packages/reploid/README.md
- [ ] Update installation instructions for monorepo
- [ ] Document workspace dependencies
- [ ] Update development setup

---

## PHASE 11: Final Validation (29 tasks)

### 11.1 Test All CLIs
- [ ] JavaScript CLI: `cats` resolves sys/personas from @paws/core
- [ ] JavaScript CLI: `dogs` processes bundles correctly
- [ ] JavaScript CLI: `paws-session` works
- [ ] JavaScript CLI: All tests pass
- [ ] Python CLI: `cats` resolves sys/personas from core package
- [ ] Python CLI: `dogs` processes bundles correctly
- [ ] Python CLI: `paws-session` works
- [ ] Python CLI: All pytest tests pass
- [ ] Python CLI: Paxos orchestrator works

### 11.2 Test REPLOID
- [ ] REPLOID imports @paws/cli-js successfully
- [ ] Bin wrappers (cats/dogs) delegate correctly
- [ ] Hermes imports dogs.js correctly
- [ ] WebRTC signaling server starts
- [ ] All vitest tests pass
- [ ] All playwright e2e tests pass

### 11.3 Test Cross-Package Integration
- [ ] cli-js can read core/personas/
- [ ] cli-js can read core/sys/
- [ ] cli-py can read core/personas/
- [ ] cli-py can read core/sys/
- [ ] reploid can import cli-js
- [ ] integrations can import cli-js

### 11.4 Test Import Resolution
- [ ] No `Cannot find module` errors
- [ ] No `MODULE_NOT_FOUND` errors
- [ ] No broken relative paths
- [ ] All `require('@paws/core')` resolve
- [ ] All `require('@paws/cli-js')` resolve
- [ ] All `workspace:*` dependencies resolve

### 11.5 Test File Path Resolution
- [ ] `sys/sys_a.md` resolves to core package
- [ ] `personas/*.md` resolve to core package
- [ ] `configs/paxos_config.json` resolves
- [ ] No hardcoded paths remain

### 11.6 Test Build & Publish Readiness
- [ ] All package.json files have correct versions
- [ ] All package.json files have correct dependencies
- [ ] All packages can be built independently
- [ ] No circular dependencies
- [ ] `pnpm -r exec -- npm pack` succeeds for all packages

---

## Success Criteria Checklist (11 checks)

- [ ] ✅ All tests pass (JS, Python, REPLOID)
- [ ] ✅ No import errors across all packages
- [ ] ✅ `cats` and `dogs` CLI work from any package
- [ ] ✅ personas/ and sys/ files resolve correctly
- [ ] ✅ REPLOID can import @paws/cli-js
- [ ] ✅ Hermes orchestrator works with new imports
- [ ] ✅ Checksum sync script validates wrappers
- [ ] ✅ CI/CD runs per-package tests
- [ ] ✅ All documentation updated
- [ ] ✅ No `require('../../js/')` paths remain
- [ ] ✅ No hardcoded CWD-relative paths remain

---

## Risk Mitigation Checklist (6 checks)

- [ ] ✅ Backup entire `/paws` directory before starting
- [ ] ✅ Create git branch: `git checkout -b monorepo-refactor`
- [ ] ✅ Commit after each phase: `git commit -m "Phase X complete"`
- [ ] ✅ Test after each phase before proceeding
- [ ] ✅ Keep old structure until validation complete
- [ ] ✅ Document all path changes in MIGRATION.md

---

## Post-Migration Cleanup (10 tasks)

- [ ] Delete `/js/` directory
- [ ] Delete `/py/` directory
- [ ] Delete `/personas/` directory
- [ ] Delete `/sys/` directory
- [ ] Delete `/demos/` directory
- [ ] Update npm published packages
- [ ] Update PyPI published packages
- [ ] Tag release: `v4.0.0` (major version bump)
- [ ] Publish migration guide
- [ ] Update GitHub README badge/shields

---

## 🎯 DELETE THIS FILE WHEN ALL 147 TASKS ARE COMPLETE

Once you've checked all boxes above and verified the migration is successful, delete `MONOREPO_MIGRATION.md`.
