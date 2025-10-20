# Personas Directory

**Purpose**: Custom persona implementations that modify the agent's behavior and cognitive patterns.

## Current Personas

| File | Description |
|------|-------------|
| `CodeRefactorerPersona.js` | Specialized persona for code refactoring tasks |
| `MultiMindSynthesisPersona.js` | Multi-agent consensus and synthesis persona |

## Persona Structure

Each persona file exports a persona configuration object:

```javascript
{
  id: 'persona-id',
  name: 'Persona Name',
  description: 'What this persona does',
  systemPrompt: 'Custom system prompt...',
  config: {
    // Persona-specific configuration
  }
}
```

## Creating New Personas

1. Create a new `.js` file in this directory
2. Export a persona configuration object
3. Add the persona to `/config.json` under the `personas` array
4. Reference in documentation: `/docs/PERSONAS.md`

## See Also

- `/docs/PERSONAS.md` - Persona system overview
- `/docs/PERSONAS_REFERENCE.md` - Detailed persona documentation
- `/upgrades/persona-manager.js` - Persona management module
