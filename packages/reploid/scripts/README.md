# Scripts Directory

**Purpose**: Utility scripts for development, deployment, and configuration management.

## Contents

| File | Purpose |
|------|---------|
| `add-structured-cycle-config.js` | Adds structured cognitive cycle configuration to config.json |

## Running Scripts

Most scripts are Node.js files that can be run directly:

```bash
node scripts/add-structured-cycle-config.js
```

## Script Guidelines

- Scripts should be idempotent when possible
- Include usage documentation in script comments
- Log operations clearly
- Handle errors gracefully
- Create backups before modifying files

## Common Script Types

- **Configuration**: Modify or validate `config.json`
- **Migration**: Update file structures or data formats
- **Analysis**: Generate reports or statistics
- **Build**: Pre-build or post-build automation

## See Also

- `/upgrades/scan-migrations.js` - Migration scanner utility
- `/upgrades/sync-tracker.js` - Tracker synchronization utility
