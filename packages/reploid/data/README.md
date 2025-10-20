# Data Directory

**Purpose**: Static data files and string resources for the REPLOID agent.

## Contents

| File | Purpose |
|------|---------|
| `strings.json` | Localized strings, error messages, and UI text |

## Usage

Data files in this directory are loaded at runtime to provide:
- Error messages and logging strings
- UI labels and descriptions
- Default configuration values
- Lookup tables and reference data

## Adding New Data Files

Store static JSON data files here that are referenced by multiple modules. Individual module-specific data should be co-located with the module in `/upgrades/`.
