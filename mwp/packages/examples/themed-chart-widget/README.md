# Themed Chart Widget Example

This example widget demonstrates all **four enhanced theming features** introduced in MWP v1.1:

## Features Demonstrated

### 1. **Extended Color Tokens**

Uses additional color palettes for rich data visualization:

- **Accent Colors** (5 colors) - For tags and badges
  ```css
  .tag:nth-child(1) { background: var(--mcp-accent-1, #6366f1); }
  ```

- **Data Colors** (10 colors) - For charts and graphs
  ```css
  .chart-bar:nth-child(1) { background: var(--mcp-data-1, #3b82f6); }
  ```

- **Semantic Gradients** (light/medium/dark variants) - For status indicators
  ```css
  .status-success {
    background: var(--mcp-success-light, #d1fae5);
    border-left: 3px solid var(--mcp-success-dark, #065f46);
  }
  ```

### 2. **Theme Context API**

Programmatically queries theme and adapts colors:

- **`getContrastRatio(color1, color2)`** - WCAG contrast checking
  ```typescript
  const ratio = theme.getContrastRatio(brandColor, backgroundColor);
  if (ratio < 4.5) console.warn('Insufficient contrast for WCAG AA');
  ```

- **`adaptColor(color, options)`** - Auto-adapt custom colors to theme mode
  ```typescript
  const adaptedBrand = theme.adaptColor('#ff6b35', {
    respectMode: true,
    targetContrast: 4.5  // WCAG AA
  });
  ```

- **`getColorScheme()`** - Query current color scheme
  ```typescript
  const scheme = theme.getColorScheme(); // 'vibrant' | 'muted' | 'accessible'
  ```

### 3. **Scoped Theming**

Separates widget chrome (uses host theme) from content (preserves brand colors):

```css
/* Widget chrome: Uses host theme tokens */
.widget-header {
  background: var(--mcp-surface);
  color: var(--mcp-text-primary);
}

/* Content: Preserves custom brand identity */
.brand-logo {
  color: #ff6b35; /* Custom brand color (adapted to mode) */
}
```

### 4. **Color Adaptation Helpers**

Automatically adjusts custom colors for dark mode:

```typescript
// Brand color automatically adapts to dark mode
const mode = theme.mode === 'dark' ? 'dark' : 'light';
const adaptedBrand = theme.adaptColor(customBrandColor, {
  respectMode: true,        // Adjust for light/dark mode
  targetContrast: 4.5,      // WCAG AA compliance
  preserveHue: true         // Keep original hue
});
```

## Running the Example

```bash
# Install dependencies
pnpm install

# Build the widget
pnpm build

# Run in dashboard
pnpm demo
```

## Visual Features

The widget displays:

1. **Performance chart** - Uses data colors (--mcp-data-1 through --mcp-data-5)
2. **Status indicators** - Uses semantic gradients (success/warning/error/info)
3. **Tags** - Uses accent colors (--mcp-accent-1 through --mcp-accent-5)
4. **Brand logo** - Custom color adapted to theme mode with contrast checking

## Theme Compatibility

- ✅ Works with basic theme (18 tokens)
- ✅ Enhanced with extended theme (60 tokens)
- ✅ Gracefully degrades if Theme dependency unavailable
- ✅ Supports light/dark/auto modes
- ✅ Respects high-contrast mode
- ✅ WCAG AA compliant (checks 4.5:1 contrast ratio)

## File Structure

```
themed-chart-widget/
├── src/
│   └── index.ts          # Widget implementation
├── README.md             # This file
└── package.json          # Package configuration
```

## Key Takeaways

1. **Base tokens** (18) provide structural consistency
2. **Extended tokens** (42) enable rich data visualization
3. **Scoped theming** preserves brand identity while maintaining UX harmony
4. **Adaptation helpers** automatically adjust custom colors for accessibility
5. **All features are optional** - widget works without extended theming
