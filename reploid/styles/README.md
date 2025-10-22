# Styles Directory

**Purpose**: CSS stylesheets for specific components and features.

## Contents

| File | Purpose |
|------|---------|
| `dashboard.css` | Module dashboard grid and layout styles |
| `vfs-explorer.css` | VFS explorer component styles |

## Style Organization

- **Global styles**: `/boot/style.css` - Bootstrap and base styles
- **Component styles**: This directory - Component-specific styles
- **Widget styles**: Shadow DOM `<style>` tags in Web Components

## Adding New Stylesheets

Component-specific styles should be:
1. Placed in this directory if used globally across multiple modules
2. Embedded in Shadow DOM if specific to a single Web Component
3. Referenced in `index.html` or loaded dynamically

## See Also

- `/boot/style.css` - Bootstrap styles
- `/upgrades/ui-style.css` - Main UI stylesheet (legacy)
- `/blueprints/0x00000E-ui-styling-css.md` - UI styling architecture
