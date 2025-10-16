# REPLOID Persona Development Guide

**[Back to Main README](../README.md)**

---

## Overview

Personas are the user-facing abstraction layer in REPLOID that bundles technical capabilities (upgrades) and knowledge (blueprints) into purpose-built agent configurations. Instead of requiring users to understand the underlying architecture, they simply choose a persona that matches their task.

## Persona Architecture

### Structure

Each persona is defined in `config.json` with the following structure:

```json
{
  "id": "unique_identifier",
  "name": "Display Name",
  "type": "lab" | "factory",
  "description": "User-friendly description",
  "upgrades": ["APPL", "CYCL", ...],
  "blueprints": ["0x000001", "0x000002", ...],
  
  // Type-specific fields
  "lessons": [...],        // For lab personas
  "previewTarget": "..."   // For factory personas
}
```

### Persona Types

#### Lab Personas 🧪
Designed for learning, experimentation, and analysis. Features:
- **Guided lessons**: Pre-defined goals and exercises
- **Safety instrumentation**: Detailed event logging
- **Educational focus**: Emphasizes understanding over production

Lab personas include:
- `rsi_lab_sandbox`: Learn recursive self-improvement
- `code_refactorer`: Analyze and improve code
- `rfc_author`: Draft formal change proposals

#### Factory Personas 🏭
Designed for rapid production and real work. Features:
- **Live preview**: Real-time visual feedback
- **Export capabilities**: Download or share results
- **Production focus**: Emphasizes output over process

Factory personas include:
- `website_builder`: Create landing pages
- `product_prototype_factory`: Build UI prototypes
- `creative_writer`: Generate documents

## Creating a New Persona

### Step 1: Define the Purpose
Determine:
- What problem does this persona solve?
- Who is the target user?
- Is it for learning (lab) or production (factory)?

### Step 2: Select Capabilities
Choose upgrades based on required functionality:

**Essential Core** (usually included):
- `APPL`: Application logic
- `CYCL`: Agent cycle
- `STMT`: State management
- `TRUN`: Tool runner

**Domain-Specific**:
- `TLWR`: Write capabilities for creation
- `EVAL`: Self-evaluation for analysis
- `GMOD`: Goal modification for experimentation
- `BLPR`: Blueprint creation for meta-work

### Step 3: Add to config.json

```json
{
  "id": "my_new_persona",
  "name": "My New Persona",
  "type": "lab",
  "description": "Does amazing things",
  "upgrades": ["APPL", "CYCL", "STMT", "TRUN", ...],
  "blueprints": ["0x000001", ...],
  "lessons": [
    {
      "name": "First Lesson",
      "goal": "Learn to do X by creating Y"
    }
  ]
}
```

### Step 4: Test the Persona

1. Open the application in browser
2. Select your new persona
3. Try the lessons or goals
4. Verify all capabilities work

## Persona Configuration Examples

### Minimal Lab Persona
```json
{
  "id": "minimal_lab",
  "name": "Minimal Lab",
  "type": "lab",
  "description": "Bare minimum for experimentation",
  "upgrades": ["APPL", "CYCL", "STMT", "TRUN", "TLRD"],
  "blueprints": ["0x000001"],
  "lessons": []
}
```

### Full-Featured Factory Persona
```json
{
  "id": "full_factory",
  "name": "Full Factory",
  "type": "factory",
  "description": "All capabilities enabled",
  "upgrades": ["APPL", "CYCL", "STMT", "TRUN", "TLRD", "TLWR", 
               "EVAL", "GMOD", "BLPR", "MTCP"],
  "blueprints": ["0x000001", "0x000016", "0x000017", "0x000018"],
  "previewTarget": "/vfs/preview/index.html"
}
```

## UI Integration

### Boot Phase
The `boot.js` script:
1. Loads personas from `config.json`
2. Renders persona cards with type badges
3. Shows lessons for lab personas
4. Stores configuration in `window.REPLOID_BOOT_CONFIG`

### Runtime Phase
The `ui-manager.js`:
1. Reads boot configuration
2. Enables factory mode preview if applicable
3. Shows RFC button for RFC Author persona
4. Logs structured events for lab personas

### Visual Indicators
- **Lab Badge**: Blue badge on persona card
- **Factory Badge**: Orange badge on persona card
- **Lesson Buttons**: Quick-start options for lab personas
- **Preview Panel**: Live iframe for factory personas

## Advanced Features

### Dynamic Persona Loading
Personas can be loaded from external sources:
```javascript
// In boot.js
const externalPersonas = await fetch('/api/personas').then(r => r.json());
config.personas.push(...externalPersonas);
```

### Conditional Upgrades
Personas can adapt based on context:
```javascript
if (userLevel === 'advanced') {
  persona.upgrades.push('MTCP', 'GMOD');
}
```

### Custom Lesson Generation
Lab personas can generate lessons dynamically:
```javascript
persona.lessons = generateLessonsForTopic(userTopic);
```

## Best Practices

### Naming Conventions
- **ID**: `snake_case`, descriptive (e.g., `data_analyst`)
- **Name**: Title Case, user-friendly (e.g., "Data Analyst")
- **Description**: Start with action verb (e.g., "Analyzes datasets...")

### Upgrade Selection
- **Minimal**: Include only essential upgrades
- **Coherent**: Upgrades should work well together
- **Documented**: Explain why each upgrade is included

### Lesson Design (Lab)
- **Progressive**: Build on previous lessons
- **Concrete**: Specific, achievable goals
- **Observable**: Clear success criteria

### Preview Setup (Factory)
- **Valid Path**: Ensure previewTarget exists
- **Safe Content**: Sandbox iframe appropriately
- **Responsive**: Update preview on relevant changes

## Troubleshooting

### Common Issues

**Persona doesn't appear**:
- Check `config.json` syntax
- Verify unique persona ID
- Ensure valid type ("lab" or "factory")

**Lessons don't show**:
- Confirm persona type is "lab"
- Check lessons array structure
- Verify goal strings are defined

**Preview doesn't work**:
- Confirm persona type is "factory"
- Check previewTarget path
- Ensure file exists in VFS

**Tools not available**:
- Verify required upgrades included
- Check tool definitions in tools-*.json
- Ensure dependencies loaded

## Future Enhancements

### Planned Features
- **Persona Templates**: Quickly create variations
- **User Profiles**: Remember preferred personas
- **Sharing**: Export/import persona configurations
- **Analytics**: Track persona usage and success
- **Marketplace**: Community-created personas

### Experimental Ideas
- **Adaptive Personas**: Learn from user behavior
- **Composite Personas**: Combine multiple personas
- **Persona Evolution**: Personas that upgrade themselves
- **Cross-Persona Communication**: Agents working together

## Contributing

To contribute a new persona:

1. Fork the repository
2. Create your persona in `config.json`
3. Add any required blueprints to `blueprints/`
4. Document usage in this file
5. Submit a pull request with:
   - Clear description of use case
   - Example goals/lessons
   - Test results

For questions or suggestions, open an issue on GitHub.

---

*Personas make REPLOID accessible to everyone, from curious learners to professional developers.*