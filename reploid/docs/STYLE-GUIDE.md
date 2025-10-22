# REPLOID Style Guide

**Last Updated:** 2025-09-30

This guide documents the unified style system introduced in PX-2, providing design tokens and reusable component patterns for consistent UI development.

---

## 📐 Design Tokens

### Spacing Scale
Use these variables for consistent spacing throughout the application:

```css
--space-xs: 4px;   /* Tight spacing (stat items, small gaps) */
--space-sm: 8px;   /* Small spacing (buttons, inner padding) */
--space-md: 12px;  /* Medium spacing (panels, sections) */
--space-lg: 16px;  /* Large spacing (layout gaps, outer padding) */
--space-xl: 24px;  /* Extra large spacing (major sections) */
--space-2xl: 32px; /* Maximum spacing (page-level) */
```

**Usage Example:**
```css
.my-component {
    padding: var(--space-md);
    gap: var(--space-sm);
}
```

---

### Typography Scale
Use these variables for consistent font sizing:

```css
--font-xs: 10px;   /* Tiny text (timestamps, meta info) */
--font-sm: 11px;   /* Small text (details, captions) */
--font-base: 13px; /* Base text (body, UI elements) */
--font-md: 14px;   /* Medium text (headings, emphasis) */
--font-lg: 16px;   /* Large text (titles, CTAs) */
--font-xl: 18px;   /* Extra large text (main headings) */
--font-2xl: 24px;  /* Huge text (page titles) */
```

**Usage Example:**
```css
.heading {
    font-size: var(--font-lg);
}

.body-text {
    font-size: var(--font-base);
}
```

---

### Border Radius Scale
Use these variables for consistent corner rounding:

```css
--radius-sm: 3px;  /* Subtle rounding (badges, small items) */
--radius-md: 4px;  /* Standard rounding (buttons, panels) */
--radius-lg: 6px;  /* Pronounced rounding (cards, charts) */
--radius-xl: 8px;  /* Maximum rounding (large containers) */
```

**Usage Example:**
```css
.button {
    border-radius: var(--radius-md);
}

.card {
    border-radius: var(--radius-lg);
}
```

---

### Transition Timing
Use these variables for consistent animation speed:

```css
--transition-fast: 0.15s;   /* Quick interactions (hover states) */
--transition-normal: 0.2s;  /* Standard transitions (buttons, links) */
--transition-slow: 0.3s;    /* Smooth animations (progress, slides) */
```

**Usage Example:**
```css
.button {
    transition: all var(--transition-normal);
}

.panel {
    transition: opacity var(--transition-slow);
}
```

---

## 🎨 Color System

### Theme Variables
REPLOID uses CSS custom properties for theming. All colors adapt to light/dark mode automatically.

**Dark Theme (Default):**
```css
--bg-primary: #0a0a14;        /* Main background */
--bg-secondary: #1a1a2e;      /* Secondary background */
--bg-panel: rgba(26, 26, 46, 0.8); /* Panel background */
--text-primary: #e0e0e0;      /* Main text */
--text-secondary: #aaa;       /* Secondary text */
--accent-cyan: #00ffff;       /* Primary accent */
```

**Light Theme:**
Colors automatically adapt when `[data-theme="light"]` is applied to the root element.

---

## 🧩 Component Classes

### Button Variants

#### Primary Button
Used for primary actions (save, submit, confirm):

```html
<button class="btn-primary">Save Changes</button>
```

```css
.btn-primary {
    padding: var(--space-sm) var(--space-lg);
    background: var(--accent-cyan-dim);
    border: 1px solid var(--border-primary);
    color: var(--accent-cyan);
}
```

#### Secondary Button
Used for secondary actions (cancel, view, export):

```html
<button class="btn-secondary">View Details</button>
```

#### Ghost Button
Used for tertiary actions (minimal emphasis):

```html
<button class="btn-ghost">Skip</button>
```

---

### Card Components

#### Basic Card
Standard container for grouped content:

```html
<div class="card">
    <div class="card-header">Card Title</div>
    <div class="card-body">
        Card content goes here...
    </div>
    <div class="card-footer">
        <button class="btn-secondary">Cancel</button>
        <button class="btn-primary">Save</button>
    </div>
</div>
```

**Features:**
- Hover effect with border glow
- Theme-aware backgrounds
- Consistent padding and spacing
- Optional header, body, footer sections

---

### Badge Components

#### Status Badges
Used for displaying status, tags, or labels:

```html
<span class="badge badge-success">Passed</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-error">Failed</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-neutral">Draft</span>
```

**Usage:**
- `badge-success` - Green (tests passed, success states)
- `badge-warning` - Yellow (warnings, pending states)
- `badge-error` - Red (errors, failed states)
- `badge-info` - Blue (informational tags)
- `badge-neutral` - Gray (default, neutral states)

---

## ✨ Animation Utilities

### Fade In Animation
```html
<div class="animate-fade-in">This content fades in</div>
```

### Slide In Animation
```html
<div class="animate-slide-in">This content slides up</div>
```

### Slide In From Right
```html
<div class="animate-slide-in-right">This content slides from the right</div>
```

### Transition Classes
Apply to elements that need custom transition speeds:

```html
<button class="transition-fast">Quick hover</button>
<div class="transition-slow">Smooth animation</div>
```

---

## 🎯 Best Practices

### 1. Always Use Variables
❌ **Bad:**
```css
.my-element {
    padding: 12px;
    font-size: 14px;
    border-radius: 4px;
}
```

✅ **Good:**
```css
.my-element {
    padding: var(--space-md);
    font-size: var(--font-md);
    border-radius: var(--radius-md);
}
```

### 2. Reuse Component Classes
❌ **Bad:**
```css
.my-custom-button {
    padding: 8px 16px;
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    /* ... 10 more lines of duplicate styles */
}
```

✅ **Good:**
```html
<button class="btn-primary">My Button</button>
```

### 3. Compose Classes
Combine utility classes for custom styling:

```html
<div class="card animate-slide-in transition-slow">
    <div class="card-header">Animated Card</div>
    <div class="card-body">Content</div>
</div>
```

### 4. Theme-Aware Colors
Always use CSS variables for colors to support light/dark themes:

❌ **Bad:**
```css
.my-element {
    color: #e0e0e0;
    background: #1a1a2e;
}
```

✅ **Good:**
```css
.my-element {
    color: var(--text-primary);
    background: var(--bg-secondary);
}
```

---

## 📦 Adding New Components

When creating new reusable components:

1. **Use existing variables** for spacing, typography, and colors
2. **Follow naming conventions** (`.component-name`, `.component-name-part`)
3. **Add hover/active states** for interactive elements
4. **Support theming** using CSS variables
5. **Document in this guide** with examples

---

## 🔧 Customization

### Creating Custom Themes
Override CSS variables in your own stylesheet:

```css
:root {
    --accent-cyan: #ff00ff;     /* Change primary accent to magenta */
    --space-lg: 20px;           /* Increase large spacing */
    --transition-normal: 0.3s;  /* Slower transitions */
}
```

### Adding Custom Spacing
For special cases, extend the spacing scale:

```css
:root {
    --space-3xl: 48px;
    --space-4xl: 64px;
}
```

---

## 📚 Related Documentation

- [README.md](../README.md) - Project overview
- [QUICK-START.md](./QUICK-START.md) - Getting started guide
- [API.md](./API.md) - API documentation
- [ROADMAP.md](./ROADMAP.md) - Development roadmap

---

## 🎨 Design Philosophy

REPLOID's style system follows these principles:

1. **Consistency** - Unified spacing, typography, and colors throughout
2. **Maintainability** - Centralized values, easy to update
3. **Flexibility** - Composable utilities, customizable tokens
4. **Accessibility** - High contrast, clear focus states
5. **Performance** - CSS variables for fast theme switching
6. **DRY** - Reusable components, no duplicate styles

---

**Questions or suggestions?** Open an issue or submit a PR to improve this guide.
