## 16. Conformance Test Suite & Quality Assurance (Normative)

### 17.1 Purpose and Scope

**MWP-17.1.1:** This section defines requirements for widget conformance testing and quality assurance.

**MWP-17.1.2:** Widgets MAY use the official `@mcpwp/test-kit` package for automated validation.

**MWP-17.1.3:** Passing conformance tests is REQUIRED for "MWP Certified" marketplace badge.

### 17.2 Test Kit Interface

**MWP-17.2.1:** The official test kit MUST provide the following test categories:

```typescript
interface ConformanceTestSuite {
  // Lifecycle contract validation
  testLifecycle(widget: MCPWidgetInterface): Promise<TestResult>;

  // Event emission contract validation
  testEventContracts(widget: MCPWidgetInterface): Promise<TestResult>;

  // Accessibility compliance (WCAG 2.1 AA)
  testAccessibility(widget: MCPWidgetInterface): Promise<TestResult>;

  // Performance budget validation
  testPerformance(widget: MCPWidgetInterface): Promise<TestResult>;

  // Security requirements validation
  testSecurity(widget: MCPWidgetInterface): Promise<TestResult>;

  // Metadata schema validation
  testMetadata(widget: MCPWidgetInterface): Promise<TestResult>;

  // Run all tests
  runAll(widget: MCPWidgetInterface): Promise<ConformanceReport>;
}

interface TestResult {
  category: string;
  passed: boolean;
  failures: TestFailure[];
  warnings: TestWarning[];
  executionTime: number;       // milliseconds
}

interface TestFailure {
  rule: string;                // e.g., "MWP-3.4.2"
  description: string;
  severity: 'critical' | 'error';
  location?: string;           // Code location if available
}

interface TestWarning {
  rule: string;
  description: string;
  recommendation: string;
}

interface ConformanceReport {
  version: string;             // Test kit version
  timestamp: string;
  widgetName: string;
  passed: boolean;
  results: TestResult[];
  overallScore: number;        // 0-100
  certificationEligible: boolean;
}
```

### 17.3 Lifecycle Correctness Tests

**MWP-17.3.1:** Test that `api.initialize()` completes successfully within 5000ms.

**MWP-17.3.2:** Test that `api.destroy()` removes all EventBus listeners.

**MWP-17.3.3:** Test that `api.destroy()` completes within 5000ms.

**MWP-17.3.4:** Test that `api.refresh()` updates widget UI with new data.

**MWP-17.3.5:** Test that widget custom element defines `getStatus()` method.

**MWP-17.3.6:** Test that `getStatus()` returns valid `MCPWidgetStatus` schema.

### 17.4 Event Contract Tests

**MWP-17.4.1:** Test that widgets emit events with correct naming (`mcp:<subject>:<action>`).

**MWP-17.4.2:** Test that `mcp:tool:invoke-requested` events include required fields (`serverName`, `toolName`, `args`).

**MWP-17.4.3:** Test that widgets listen for appropriate response events (`mcp:tool:result`, `mcp:tool:error`).

**MWP-17.4.4:** Test that widgets do NOT call `MCPBridge.callTool()` directly (security violation).

### 17.5 Accessibility Tests

**MWP-17.5.1:** Run `axe-core` automated accessibility audit on widget DOM.

**MWP-17.5.2:** Test keyboard navigation:
- All interactive elements reachable via Tab
- Enter/Space activates focused element
- Escape dismisses modals

**MWP-17.5.3:** Test ARIA labels presence on all buttons and form inputs.

**MWP-17.5.4:** Test color contrast ratios meet WCAG AA standards (4.5:1 for text).

**MWP-17.5.5:** Test focus indicators are visible (outline or alternative styling).

**MWP-17.5.6:** Test that error messages are associated with form fields via `aria-describedby`.

### 17.6 Performance Tests

**MWP-17.6.1:** Measure widget bundle size (gzipped):
- **MUST** be ≤ 500KB including all assets
- **SHOULD** be ≤ 100KB for core logic
- **Warn** if > 200KB

**MWP-17.6.2:** Measure initial render time:
- **MUST** be ≤ 500ms from `connectedCallback()` to first paint
- **SHOULD** be ≤ 200ms
- **Warn** if > 300ms

**MWP-17.6.3:** Measure memory usage after initialization:
- **MUST** be ≤ 20MB
- **SHOULD** be ≤ 10MB
- **Warn** if > 15MB

**MWP-17.6.4:** Test for memory leaks:
- Create widget → destroy → measure memory
- Repeat 10 times
- Memory MUST NOT increase by more than 10% over baseline

**MWP-17.6.5:** Measure `getResourceUsage()` if implemented:

```typescript
interface WidgetResourceUsage {
  memoryUsed: number;          // bytes
  bundleSize: number;          // bytes (gzipped)
  renderTime: number;          // milliseconds (last render)
}
```

### 17.7 Security Tests

**MWP-17.7.1:** Test that widgets use `textContent` for untrusted data (not `innerHTML`).

**MWP-17.7.2:** Test that widgets do not execute `eval()` or `new Function()`.

**MWP-17.7.3:** Test Content Security Policy compliance (no inline scripts in production).

**MWP-17.7.4:** Test that widgets declare permissions in metadata if accessing restricted APIs.

**MWP-17.7.5:** Test that code signature is valid if `trustLevel: 'verified'`.

### 17.8 Visual Regression Testing

**MWP-17.8.1:** Hosts MAY implement visual regression testing via screenshot comparison.

**MWP-17.8.2:** Test kit SHOULD provide utilities for capturing widget screenshots:

```typescript
interface VisualTesting {
  captureScreenshot(widget: HTMLElement): Promise<ImageData>;
  compareScreenshots(baseline: ImageData, current: ImageData): VisualDiff;
}

interface VisualDiff {
  pixelDifference: number;     // Number of pixels changed
  percentDifference: number;   // 0-100
  diffImage: ImageData;        // Highlighted differences
}
```

**MWP-17.8.3:** Visual diffs > 5% SHOULD trigger review.

### 17.9 Integration Test Utilities

**MWP-17.9.1:** Test kit MUST provide mock implementations:

```typescript
interface MockDependencies {
  EventBus: MockEventBus;
  MCPBridge: MockMCPBridge;
  Configuration: MockConfiguration;
}

// Mock EventBus records all events
class MockEventBus implements EventBusInterface {
  events: Array<{ name: string; data: any; timestamp: number }>;
  on(event: string, handler: Function): UnsubscribeFunction;
  emit(event: string, data: any): void;
  getEmittedEvents(pattern: RegExp): Array<any>;
}

// Mock MCPBridge simulates MCP server responses
class MockMCPBridge implements MCPBridgeInterface {
  setToolResult(toolName: string, result: ToolResult): void;
  setResourceContents(uri: string, contents: ResourceContents): void;
  getCallHistory(): Array<{ method: string; args: any[] }>;
}
```

### 17.10 Certification Badge Requirements

**MWP-17.10.1:** To qualify for "MWP Certified v1.2.0" badge, widgets MUST:
- Pass all lifecycle tests (100%)
- Pass all event contract tests (100%)
- Pass all security tests (100%)
- Pass ≥ 90% of accessibility tests
- Pass ≥ 80% of performance tests
- Overall conformance score ≥ 85/100

**MWP-17.10.2:** Certification is version-specific. Widget updates require re-certification.

**MWP-17.10.3:** Hosts MAY display certification badges in widget marketplace UI.

### 17.11 Continuous Testing

**MWP-17.11.1:** Widget authors SHOULD integrate conformance tests into CI/CD pipelines.

**MWP-17.11.2:** Example GitHub Actions workflow:

```yaml
name: MWP Conformance Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npx @mcpwp/test-kit test --widget ./dist/widget.js
      - run: npx @mcpwp/test-kit certify --report ./conformance-report.json
```

**MWP-17.11.3:** Failed conformance tests SHOULD block widget releases.

---
