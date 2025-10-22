## 5. Web Component Contract (Normative)

### 5.1 Component Registration

**MWP-5.1.1:** The widget MUST register a custom element with tag name matching widget.element.

**MWP-5.1.2:** The tag name MUST start with `mcp-` prefix to indicate MCP widget.

**MWP-5.1.3:** Registration MUST be idempotent using `customElements.get()` check.

### 5.2 getStatus() Method

**MWP-5.2.1:** The custom element MUST implement `getStatus()` returning:

```typescript
interface MCPWidgetStatus {
  state: 'active' | 'idle' | 'error' | 'loading' | 'disabled';
  primaryMetric: string;           // e.g., "12 tools available"
  secondaryMetric: string;         // e.g., "stdio transport"
  lastActivity: number | null;     // Last tool call timestamp
  message: string | null;          // Error details if state === 'error'
}
```

**MWP-5.2.2:** State semantics for MCP widgets:

| State    | Meaning                                     | Visual        |
| -------- | ------------------------------------------- | ------------- |
| active   | Server connected, recent tool calls         | Green         |
| idle     | Server connected, no recent activity        | Gray          |
| error    | Server disconnected or JSON-RPC error       | Red           |
| loading  | Server initializing or performing handshake | Yellow        |
| disabled | Server disabled in configuration            | Gray (dotted) |

**MWP-5.2.3:** primaryMetric SHOULD display the count of available primitives (e.g., "5 tools, 3 resources").

**MWP-5.2.4:** secondaryMetric SHOULD display connection info (e.g., "stdio" or "http://localhost:3000").

**MWP-5.2.5:** lastActivity SHOULD reflect the timestamp of the last tool call, resource read, or prompt invocation.

### 5.3 getMCPInfo() Method (NEW)

**MWP-5.3.1:** The custom element SHOULD implement a public method `getMCPInfo()` returning:

```typescript
interface MCPInfo {
  serverName: string;
  availableTools: number;
  availableResources: number;
  availablePrompts: number;
  connectionState: 'connected' | 'disconnected' | 'error';
  lastError: string | null;
}
```

This allows the host to query MCP-specific details without parsing status strings.

### 5.4 Rendering Requirements

**MWP-5.4.1:** Widgets MUST use safe rendering patterns (`textContent` or manual DOM construction).

**MWP-5.4.2:** When rendering tool names, resource URIs, or prompt arguments received from MCP servers, widgets MUST treat them as untrusted data and apply XSS prevention (see Section 11.1).

**MWP-5.4.3:** Widgets SHOULD provide visual distinction between different MCP primitive types (tools, resources, prompts).

### 5.5 Theme Contract

**MWP-5.5.1:** Hosts SHOULD provide a `Theme` dependency for design system integration.

**MWP-5.5.2:** Widgets SHOULD use CSS custom properties (design tokens) for styling:

```typescript
interface Theme {
  // CSS custom properties as design tokens
  tokens: Record<string, string>;

  // Apply tokens to widget element
  applyToElement(element: HTMLElement): void;

  // Listen for theme changes
  onThemeChange(callback: ThemeChangeCallback): UnsubscribeFunction;

  // Get current theme mode
  getMode(): 'light' | 'dark' | 'high-contrast' | 'custom';

  // Get current color scheme (optional)
  getColorScheme?(): 'vibrant' | 'muted' | 'accessible';

  // Calculate contrast ratio between colors (optional)
  getContrastRatio?(color1: string, color2: string): number;

  // Adapt custom color to theme mode (optional)
  adaptColor?(color: string, options?: ColorAdaptationOptions): string;

  // Generate color scale from base color (optional)
  generateColorScale?(baseColor: string, steps?: number): string[];
}

type ThemeChangeCallback = (newTokens: Record<string, string>, mode: string) => void;

interface ColorAdaptationOptions {
  respectMode?: boolean;        // Adjust for light/dark mode
  preserveHue?: boolean;         // Keep original hue
  targetContrast?: number;       // Target WCAG contrast ratio
  intensity?: number;            // Brightness adjustment (-1 to 1)
}
```

**MWP-5.5.3:** Standard design tokens (18 base + 42 extended = 60 total):

#### Base Tokens (Required)

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-primary-color` | Primary brand color | `#0066cc`, `#ff6b35` |
| `--mcp-secondary-color` | Secondary brand color | `#6c757d` |
| `--mcp-background` | Widget background | `#ffffff`, `#1e1e1e` |
| `--mcp-surface` | Panel/card background | `#f8f9fa`, `#2d2d2d` |
| `--mcp-text-primary` | Main text color | `#212529`, `#e0e0e0` |
| `--mcp-text-secondary` | Secondary text color | `#6c757d`, `#9e9e9e` |
| `--mcp-border` | Border color | `#dee2e6`, `#404040` |
| `--mcp-spacing-sm` | Small spacing | `4px` |
| `--mcp-spacing-md` | Medium spacing | `8px` |
| `--mcp-spacing-lg` | Large spacing | `16px` |
| `--mcp-spacing-xl` | Extra large spacing | `24px` |
| `--mcp-font-family` | Typography | `system-ui, -apple-system` |
| `--mcp-font-size-sm` | Small text | `12px` |
| `--mcp-font-size-md` | Medium text | `14px` |
| `--mcp-font-size-lg` | Large text | `16px` |
| `--mcp-radius-sm` | Small border radius | `2px` |
| `--mcp-radius-md` | Medium border radius | `4px` |
| `--mcp-radius-lg` | Large border radius | `8px` |

#### Extended Tokens (Optional - for complex widgets)

**Accent Colors** (for multi-color visualizations):

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-accent-1` | First accent color | `#6366f1` (Indigo) |
| `--mcp-accent-2` | Second accent color | `#8b5cf6` (Purple) |
| `--mcp-accent-3` | Third accent color | `#ec4899` (Pink) |
| `--mcp-accent-4` | Fourth accent color | `#f59e0b` (Amber) |
| `--mcp-accent-5` | Fifth accent color | `#10b981` (Emerald) |

**Data Visualization Colors** (for charts and graphs):

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-data-1` through `--mcp-data-10` | Chart/graph colors | `#3b82f6`, `#ef4444`, etc. |

**Semantic Color Gradients** (light/medium/dark variants):

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-success-light` | Success state (light) | `#d1fae5` |
| `--mcp-success-medium` | Success state (medium) | `#10b981` |
| `--mcp-success-dark` | Success state (dark) | `#065f46` |
| `--mcp-warning-light` | Warning state (light) | `#fef3c7` |
| `--mcp-warning-medium` | Warning state (medium) | `#f59e0b` |
| `--mcp-warning-dark` | Warning state (dark) | `#92400e` |
| `--mcp-error-light` | Error state (light) | `#fee2e2` |
| `--mcp-error-medium` | Error state (medium) | `#ef4444` |
| `--mcp-error-dark` | Error state (dark) | `#991b1b` |
| `--mcp-info-light` | Info state (light) | `#dbeafe` |
| `--mcp-info-medium` | Info state (medium) | `#3b82f6` |
| `--mcp-info-dark` | Info state (dark) | `#1e40af` |

**MWP-5.5.4:** Widgets SHOULD apply tokens in shadow DOM:

```css
:host {
  font-family: var(--mcp-font-family);
  color: var(--mcp-text-primary);
  background: var(--mcp-background);
}

.panel {
  background: var(--mcp-surface);
  border: 1px solid var(--mcp-border);
  border-radius: var(--mcp-radius-md);
  padding: var(--mcp-spacing-md);
}

button {
  background: var(--mcp-primary-color);
  color: white;
  padding: var(--mcp-spacing-sm) var(--mcp-spacing-md);
  border-radius: var(--mcp-radius-sm);
}

/* Using extended tokens for data visualization */
.chart-bar:nth-child(1) { background: var(--mcp-data-1); }
.chart-bar:nth-child(2) { background: var(--mcp-data-2); }
.chart-bar:nth-child(3) { background: var(--mcp-data-3); }

/* Using semantic gradients */
.status-success {
  background: var(--mcp-success-light);
  border-left: 3px solid var(--mcp-success-dark);
  color: var(--mcp-success-dark);
}
```

**MWP-5.5.5:** Dynamic theme switching:

```javascript
// Widget reacts to theme changes
const unsubscribe = Theme.onThemeChange((newTokens, mode) => {
  // Tokens automatically update via CSS custom properties
  // Optionally update UI based on mode
  if (mode === 'high-contrast') {
    // Enhance visual accessibility
  }
});
```

**MWP-5.5.6:** Scoped Theming (for widgets with custom color requirements):

Widgets MAY use scoped theming to separate chrome styling from content styling:

```typescript
// Widget metadata declares scoped theming
interface WidgetMetadata {
  scopedTheming?: {
    chrome: 'host' | 'custom';      // Widget borders, headers, controls
    content: 'host' | 'custom';     // Data visualizations, custom UI
    customTokens?: Record<string, string>;
  };
}
```

```css
/* Chrome uses host theme */
.widget-header {
  background: var(--mcp-surface);
  border-bottom: 1px solid var(--mcp-border);
  color: var(--mcp-text-primary);
}

/* Content uses custom brand colors */
.chart-container {
  --brand-color-1: #ff6b35;
  --brand-color-2: #004e89;
  --brand-color-3: #f7931e;
}

.logo {
  /* Preserve brand identity */
  color: var(--brand-color-1);
}
```

**MWP-5.5.7:** Color Adaptation Helpers (for custom widget colors):

Widgets with custom colors MAY use Theme helper methods to adapt colors to current mode:

```javascript
// Adapt custom brand color to dark mode
const brandColor = '#ff6b35';
const adaptedColor = Theme.adaptColor?.(brandColor, {
  respectMode: true,
  targetContrast: 4.5  // WCAG AA
});

// Check contrast ratio
const ratio = Theme.getContrastRatio?.(adaptedColor, backgroundColor);
if (ratio < 4.5) {
  console.warn('Insufficient contrast for WCAG AA');
}

// Generate color scale for gradients
const colorScale = Theme.generateColorScale?.(brandColor, 5);
// Returns: ['#lightest', '#lighter', '#base', '#darker', '#darkest']
```

**MWP-5.5.8:** Hosts implementing theming MUST:
- Inject CSS custom properties into widget shadow roots
- Provide at least `light` and `dark` themes
- Update tokens dynamically when user changes theme
- Persist theme preference across sessions
- Provide all 18 base tokens

**MWP-5.5.9:** Hosts implementing theming SHOULD:
- Provide extended tokens (accent, data, semantic gradients)
- Implement Theme helper methods (getContrastRatio, adaptColor, etc.)
- Support scoped theming configuration
- Respect system-level theme preferences

**MWP-5.5.10:** Widget theming benefits:
- **Visual consistency:** Widgets match host application design
- **White-label support:** Hosts can rebrand dashboards
- **Accessibility:** High-contrast themes for visual impairments
- **User preference:** Respect system-level theme settings
- **Brand preservation:** Custom widgets maintain identity with scoped theming
- **Data visualization:** Rich color palettes for complex widgets

---
