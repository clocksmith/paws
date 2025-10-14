# E2E Tests - Playwright

## Overview

End-to-end tests for REPLOID Sentinel Agent using Playwright.

## Setup

```bash
# Install dependencies (already done if you ran npm install)
npm install

# Install browser binaries
npx playwright install chromium
```

## Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with Playwright UI (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/boot-flow.spec.js

# Run all tests (unit + E2E)
npm run test:all
```

## Test Files

### `simple.spec.js`
Basic smoke tests to verify Playwright setup:
- Page loads correctly
- REPLOID heading is present

### `boot-flow.spec.js`
Tests for persona selection and boot screen:
- Persona card rendering and selection
- Goal input enablement and validation
- Input sanitization (maxlength)
- Advanced mode toggle
- Single persona selection enforcement

### `sentinel-flow.spec.js`
Full Sentinel Agent workflow tests:
- Boot to dashboard transition
- FSM state management
- Goal processing with special characters
- Panel toggle functionality
- localStorage persistence

### `accessibility.spec.js`
Accessibility and keyboard navigation:
- Keyboard navigation on boot screen
- ARIA labels and semantic HTML
- Focus indicators
- ESC key handling
- Dashboard keyboard navigation

## Known Issues

**Test Timeout:** Some tests may timeout during development due to:
- Long module initialization times
- External API dependencies
- Complex boot process

**Workarounds:**
1. Increase test timeout in playwright.config.js
2. Run tests with `--headed` flag to debug
3. Use `test:e2e:ui` for interactive debugging
4. Set `reuseExistingServer: true` to use existing dev server

## Writing New Tests

Follow these patterns:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');

    // Your test code
    const element = page.locator('#my-element');
    await expect(element).toBeVisible();
  });
});
```

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** before interacting
3. **Test user flows**, not implementation details
4. **Keep tests independent** - don't rely on test execution order
5. **Clean up state** between tests using beforeEach/afterEach

## CI/CD Integration

E2E tests are configured to run in CI with:
- Headless mode by default
- Retries on failure (2 retries in CI)
- HTML reporter for results
- Screenshots and videos on failure

## Debugging

```bash
# Run with UI mode for interactive debugging
npm run test:e2e:ui

# Run with trace enabled
npx playwright test --trace on

# Open test report
npx playwright show-report
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
