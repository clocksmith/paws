## 11. Security Requirements (Normative)

### 11.1 XSS Prevention

**MWP-11.1.1:** MCP tool names, resource URIs, and prompt arguments received from servers MUST be treated as untrusted.

**MWP-11.1.2:** Widgets MUST use `textContent` when rendering MCP server data.

**MWP-11.1.3:** Tool result content of type `text` MUST be sanitized before rendering as HTML.

### 11.2 Tool Invocation Security

**MWP-11.2.1:** The host MUST require user confirmation before executing any tool.

**MWP-11.2.2:** Confirmation dialog MUST display:

```
Invoke tool: github:create_issue

Server: github (MCP Server)
Arguments:
{
  "owner": "anthropics",
  "repo": "mcp",
  "title": "Bug report"
}

⚠️ This action will be performed on your behalf.
[Cancel] [Confirm]
```

**MWP-11.2.3:** The host MUST validate arguments against `inputSchema` before sending to MCP server.

**MWP-11.2.4:** Widgets MUST NOT bypass confirmation by calling `MCPBridge.callTool()` directly.

### 11.3 Resource URI Validation

**MWP-11.3.1:** Before reading a resource, the host SHOULD validate the URI scheme against an allowlist.

**MWP-11.3.2:** URIs with `file://` scheme SHOULD be restricted to server-declared paths.

### 11.4 Widget Permission Model 

**MWP-11.4.1:** Widgets MAY declare required permissions in the `permissions` field of widget metadata.

**MWP-11.4.2:** If `permissions` is undefined, the widget MUST be treated as having no permissions (maximum restriction).

**MWP-11.4.3:** Hosts MUST enforce permissions via:
- Content Security Policy (CSP) headers
- API gate enforcement on `MCPBridge`, storage, clipboard, and network APIs
- Runtime validation before sensitive operations

**MWP-11.4.4:** Permission enforcement by trust level:

| Trust Level | Network | Storage | MCP Operations | Confirmation Required |
|-------------|---------|---------|----------------|----------------------|
| untrusted   | None    | None    | None (blocked) | Always               |
| community   | Declared domains only | Session only | With confirmation | First-time only |
| verified    | Declared domains | Persistent allowed | With confirmation | First-time only |
| enterprise  | Full (within declared) | Full | No confirmation | Never |

**MWP-11.4.5:** Before widget installation, hosts MUST display requested permissions to user for consent.

**MWP-11.4.6:** Hosts SHOULD maintain audit logs of permission grants, revocations, and violations for compliance purposes (SOC2, ISO 27001, GDPR).

**MWP-11.4.7:** Widgets requiring additional permissions in updates MUST trigger re-consent flow.

**MWP-11.4.8:** For verified widgets (`trustLevel: 'verified'`), hosts MUST validate code signatures before granting elevated permissions.

### 11.5 Accessibility Requirements (WCAG 2.1 Level AA)

**MWP-11.5.1:** All MWP widgets MUST conform to WCAG 2.1 Level AA accessibility standards.

**MWP-11.5.2:** Widgets MUST provide keyboard navigation for all interactive elements:
- **Tab:** Focus next element
- **Shift+Tab:** Focus previous element
- **Enter/Space:** Activate focused element
- **Escape:** Close modals/dialogs

**MWP-11.5.3:** Widgets MUST include appropriate ARIA labels and roles:

```html
<button aria-label="Invoke create_issue tool" role="button">
  Create Issue
</button>

<div role="alert" aria-live="polite">
  Tool execution completed successfully
</div>
```

**MWP-11.5.4:** Dynamic content changes MUST be announced to screen readers via ARIA live regions (`aria-live="polite"` or `aria-live="assertive"`).

**MWP-11.5.5:** Hosts SHOULD provide an `A11yHelper` dependency for accessibility utilities:

```typescript
interface A11yHelper {
  // Announce message to screen readers
  announce(message: string, politeness: 'polite' | 'assertive'): void;

  // Create focus trap for modal dialogs
  setFocusTrap(element: HTMLElement): ReleaseTrapFunction;

  // Validate color contrast ratio (WCAG AA: 4.5:1 for normal text)
  validateContrast(fgColor: string, bgColor: string): boolean;

  // Get user's accessibility preferences
  getPreferences(): A11yPreferences;
}

interface A11yPreferences {
  reducedMotion: boolean;       // prefers-reduced-motion
  highContrast: boolean;         // prefers-contrast: high
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  screenReaderActive: boolean;
}

type ReleaseTrapFunction = () => void;
```

**MWP-11.5.6:** Widgets MUST respect user accessibility preferences:
- Honor `prefers-reduced-motion` (disable animations)
- Honor `prefers-contrast` (adjust colors)
- Support browser zoom (use relative units like `rem`, `em`)

**MWP-11.5.7:** Color MUST NOT be the only means of conveying information:
- Use icons + color for status indicators
- Provide text labels in addition to color coding
- Example: Error state = red color + "✗" icon + "Error" text

**MWP-11.5.8:** Widgets MUST maintain minimum color contrast ratios:
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components and graphics: 3:1

**MWP-11.5.9:** Form inputs MUST have associated labels:

```html
<label for="tool-arg-repo">Repository Name</label>
<input id="tool-arg-repo" type="text" aria-required="true" />
```

**MWP-11.5.10:** Error messages MUST be programmatically associated with form fields:

```html
<input id="repo" aria-invalid="true" aria-describedby="repo-error" />
<span id="repo-error" role="alert">Repository name is required</span>
```

**MWP-11.5.11:** Widgets SHOULD integrate automated accessibility testing:
- Use `axe-core` library for runtime validation
- Include accessibility tests in conformance test suite (Section 17)
- Report violations to host for debugging

**MWP-11.5.12:** Host confirmation dialogs (e.g., tool invocation) MUST be accessible:
- Focus trap within dialog
- Announce dialog opening to screen readers
- Escape key to dismiss
- Focus returns to trigger element on close

---

### 11.6 HTTP Authorization (Informative)

The MCP 2025-06-18 specification introduces an HTTP authorization framework that hosts **MAY** adopt when communicating with servers over HTTP transports. MWP does not mandate a specific authentication scheme, but hosts that implement OAuth 2.0 or similar mechanisms SHOULD:

- Store credentials securely and scope tokens to the minimum permissions required by each server.
- Inject authorization headers only for transports that require them; STDIO transports SHOULD source credentials from the process environment per the MCP spec.
- Expose revocation and credential rotation controls to users or administrators.
- Ensure widgets never receive raw credentials—authorization flows terminate at the host layer.

This subsection is informative: implementations can choose alternative authentication strategies so long as they maintain the consent and least-privilege principles described throughout Section 11.

---
