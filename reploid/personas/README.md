# Personas Directory

**Purpose**: Custom persona implementations that modify the agent's behavior and cognitive patterns.

## Current Personas

| File | Description |
|------|-------------|
| `base-persona.js` | **Base persona** - Platform capabilities that all personas inherit |
| `code-refactorer-persona.js` | Specialized persona for code refactoring tasks |
| `creative-writer-persona.js` | Creative and professional writing assistance |
| `multi-mind-synthesis-persona.js` | Multi-agent consensus and synthesis persona |
| `rfc-author-persona.js` | RFC authoring and change proposal documentation |
| `rsi-lab-sandbox-persona.js` | Safe learning environment for self-improvement |
| `website-builder-persona.js` | Landing page and website generation |
| `product-prototype-factory-persona.js` | Rapid UI prototype development |
| `multi-mind-architect-persona.js` | Advanced multi-perspective synthesis |

## Persona Architecture

All personas follow a standardized structure with composition over inheritance:

```javascript
import BasePersona from './base-persona.js';

const MyPersona = {
  metadata: {
    id: 'my-persona',                    // kebab-case
    version: '1.0.0',
    dependencies: ['base-persona'],       // Explicitly depend on base
    type: 'persona'
  },

  factory: () => {
    // Compose with BasePersona for platform capabilities
    const basePersona = BasePersona.factory();
    const basePlatformPrompt = basePersona.getSystemPromptFragment();

    // Define role-specific behavior
    const rolePrompt = "Your specific role instructions...";

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Customize tool prioritization
      return availableTools;
    };

    const onCycleStart = (cycleContext) => {
      // Hook into agent lifecycle
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart
    };
  }
};

export default MyPersona;
```

## BasePersona

The `base-persona.js` provides platform-level capabilities that apply to all agents:
- Tool creation and modification procedures
- VFS operations and file system knowledge
- Core platform architecture understanding

**All personas should compose with BasePersona** to ensure consistent platform knowledge.

## Creating New Personas

1. Create a new `.js` file in this directory using kebab-case (e.g., `my-new-persona.js`)
2. Import and compose with `BasePersona`
3. Define your role-specific `getSystemPromptFragment()` that extends the base prompt
4. Optionally implement `filterTools()` and lifecycle hooks (`onCycleStart`, etc.)
5. Export as default: `export default MyPersona;`
6. Add to `/config.json` under the `personas` array with the kebab-case filename
7. Reference in documentation: `/docs/PERSONAS.md`

## See Also

- `/docs/PERSONAS.md` - Persona system overview
- `/docs/PERSONAS_REFERENCE.md` - Detailed persona documentation
- `/upgrades/persona-manager.js` - Persona management module
