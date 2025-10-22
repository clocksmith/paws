# REPLOID Test Suite

**Last Updated:** 2025-09-30

This directory contains the comprehensive test suite for REPLOID's RSI-enabled agent system.

---

## 📁 Directory Structure

```
tests/
├── unit/              # Unit tests for individual modules
│   ├── utils.test.js
│   ├── event-bus.test.js
│   └── state-manager.test.js
├── integration/       # Integration tests for system behavior
│   └── fsm.test.js
├── agent-logic-pure.test.js  # Unit tests for pure functions (25+ tests)
├── e2e/              # End-to-end tests (planned)
└── README.md         # This file
```

---

## 🧪 Test Coverage

### Current Coverage

**Unit Tests:** 92+ tests across 4 core modules
- `utils.test.js`: 32 tests - Error classes, logging, string utilities, DRY helpers
- `event-bus.test.js`: 19 tests - Pub/sub system, subscription tracking, memory management
- `state-manager.test.js`: 16 tests - State management, VFS operations, persistence
- `agent-logic-pure.test.js`: 25+ tests - Pure function validation, prompt assembly, tool formatting

**Integration Tests:** 18 tests
- `fsm.test.js`: FSM state machine validation, transitions, human-in-the-loop

**Total:** 110+ passing tests

### Coverage Statistics

- **utils.js:** 98.85% lines, 85.36% functions
- **event-bus.js:** 100% coverage (via integration tests)
- **state-manager.js:** Full mocked coverage

---

## 🚀 Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Generate coverage report
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test tests/unit/utils.test.js
npm test tests/integration/fsm.test.js
```

---

## 📝 Writing Tests

### Test Structure

All tests follow Vitest conventions:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Module Name', () => {
  describe('Feature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Mocking

Use Vitest's `vi` for mocking:

```javascript
const mockFunction = vi.fn();
const spy = vi.spyOn(console, 'log');
```

### DOM Testing

Tests run in happy-dom environment for DOM-related functionality.

---

## 🎯 Test Categories

### Unit Tests (`tests/unit/`)

Test individual functions and modules in isolation.

**Guidelines:**
- Test pure functions without side effects
- Mock all external dependencies
- Focus on edge cases and error handling
- Aim for 100% coverage of public APIs

**Example:**
```javascript
describe('Utils - String Utilities', () => {
  describe('trunc', () => {
    it('should truncate strings longer than specified length', () => {
      expect(utils.trunc('hello world', 8)).toBe('hello...');
    });
  });
});
```

### Integration Tests (`tests/integration/`)

Test module interactions and system behavior.

**Guidelines:**
- Test workflows that span multiple modules
- Verify state transitions and event emissions
- Test with realistic data flows
- Can use partial mocking

**Example:**
```javascript
describe('Sentinel FSM - Integration Tests', () => {
  it('should support full cycle', () => {
    const fullCycle = [
      'IDLE',
      'CURATING_CONTEXT',
      'AWAITING_CONTEXT_APPROVAL',
      // ... full cycle
      'DONE',
      'IDLE'
    ];

    expect(fullCycle[0]).toBe('IDLE');
    expect(fullCycle[fullCycle.length - 1]).toBe('IDLE');
  });
});
```

### E2E Tests (`tests/e2e/`) - Planned

Test complete user workflows with Playwright.

**Future tests:**
- Full agent cycle from goal to completion
- UI dashboard interactions
- PAWS CLI workflow (cats → dogs → apply)
- Browser API integrations

---

## 🔍 Coverage Thresholds

Configured in `vitest.config.js`:

```javascript
coverage: {
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 60,
    statements: 60
  }
}
```

**Current Status:** Meeting thresholds for tested modules (utils.js at 98.85%)

---

## 🤖 CI/CD Integration

Tests run automatically on:
- **Push** to main/develop branches
- **Pull requests** to main/develop branches

GitHub Actions workflow:
- Runs tests on Node.js 18.x and 20.x
- Generates coverage reports
- Archives test results
- Comments on PRs with coverage data

See `.github/workflows/test.yml` for configuration.

---

## 📚 Testing Best Practices

### 1. Test Naming

Use descriptive test names that explain the expected behavior:

✅ Good:
```javascript
it('should throw StateError when accessing state before initialization', () => {
```

❌ Bad:
```javascript
it('test state error', () => {
```

### 2. Arrange-Act-Assert Pattern

Structure tests clearly:

```javascript
it('should save artifact with metadata', async () => {
  // Arrange
  const path = '/test.txt';
  const content = 'test content';

  // Act
  await stateManager.saveArtifact(path, content);

  // Assert
  const metadata = stateManager.getArtifactMetadata(path);
  expect(metadata).toBeDefined();
});
```

### 3. Test Independence

Each test should be independent:

```javascript
beforeEach(() => {
  // Reset state before each test
  stateManager = createStateManager();
});
```

### 4. Test Edge Cases

Test boundary conditions:

```javascript
it('should handle empty strings', () => {
  expect(utils.trunc('', 5)).toBe('');
});

it('should handle exact length', () => {
  expect(utils.trunc('hello', 5)).toBe('hello');
});
```

### 5. Meaningful Assertions

Be specific about what you're testing:

✅ Good:
```javascript
expect(result).toHaveProperty('sanitizedJson');
expect(result.sanitizedJson).toBe('{"key":"value"}');
expect(result.method).toBe('code block');
```

❌ Bad:
```javascript
expect(result).toBeDefined();
```

---

## 🐛 Debugging Tests

### Run single test
```bash
npm test -- --reporter=verbose tests/unit/utils.test.js
```

### Run with debugging
```bash
node --inspect-brk node_modules/.bin/vitest run
```

### View coverage details
```bash
npm run test:coverage
# Then open coverage/index.html in browser
```

---

## 📅 Future Enhancements

### Short Term
- [ ] Add E2E tests with Playwright
- [ ] Increase coverage to 80%+ across all modules
- [ ] Add performance benchmarks
- [ ] Add snapshot testing for UI components

### Long Term
- [ ] Property-based testing with fast-check
- [ ] Visual regression testing
- [ ] Load testing for WebSocket connections
- [ ] Mutation testing with Stryker

---

## 🔗 Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Happy DOM](https://github.com/capricorn86/happy-dom)

---

**For questions or contributions to the test suite, see the main [CONTRIBUTING.md](../CONTRIBUTING.md) guide.**
