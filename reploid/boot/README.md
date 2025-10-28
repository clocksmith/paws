# Boot Directory

**Purpose**: Core bootstrap modules that initialize the REPLOID agent before the main application loads.

## Contents

| File | Purpose |
|------|---------|
| `api.js` | API client initialization and configuration |
| `config.js` | Configuration loading and validation |
| `lazy-loader.js` | Lazy module loading utilities |
| `model-config.js` | Model provider configuration and selection |
| `modes.js` | Operational mode setup (autonomous, curator, etc.) |
| `state.js` | Initial state management setup |
| `style.css` | Bootstrap styling (loaded before main UI) |
| `ui.js` | UI initialization and DOM setup |

## Boot Sequence

1. **config.js** - Load and validate configuration
2. **state.js** - Initialize state management
3. **api.js** - Set up API client
4. **modes.js** - Configure operational mode
5. **ui.js** - Initialize UI manager
6. **style.css** - Apply bootstrap styles

## Usage

These files are loaded by `boot.js` in the root directory during the agent's initialization phase, before any upgrade modules are loaded.

See: `/boot.js` for the complete boot orchestration.
