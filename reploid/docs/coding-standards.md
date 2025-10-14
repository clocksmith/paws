# REPLOID Coding Standards

## Module System (ES6)

All JavaScript code in REPLOID uses ES6 modules with the following standards:

### Module Structure

```javascript
// All modules are automatically in strict mode - no need for 'use strict'
// ES6 modules are strict by default per ECMAScript specification

// Import statements at the top
import { moduleA } from './module-a.js';
import moduleB from './module-b.js';

// Module implementation
export class MyClass {
  // ...
}

export function myFunction() {
  // ...
}

// Default export at the bottom
export default {
  MyClass,
  myFunction
};
```

### Strict Mode

**Important:** All ES6 modules automatically run in strict mode. You do NOT need to add `'use strict';` to any module files.

Benefits of automatic strict mode in ES6 modules:
- Eliminates silent errors by throwing exceptions
- Fixes mistakes that make JavaScript engines difficult to optimize
- Prohibits syntax likely to be defined in future ECMAScript versions
- Prevents accidental global variable creation
- Makes `this` undefined in functions (not window)
- Disallows duplicate parameter names
- Makes eval() safer by creating its own scope

### Module Patterns

1. **Service Modules** - Export a class or factory function
```javascript
export class ServiceName {
  constructor(dependencies) {
    this.deps = dependencies;
  }
  
  async init() {
    // Initialization logic
  }
}
```

2. **Utility Modules** - Export individual functions
```javascript
export function utilityA() { /* ... */ }
export function utilityB() { /* ... */ }

export default { utilityA, utilityB };
```

3. **Constant Modules** - Export configuration or constants
```javascript
export const CONFIG = {
  API_ENDPOINT: 'https://api.example.com',
  TIMEOUT: 5000
};

export const ERROR_CODES = {
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};
```

## DOM Manipulation

Use vanilla DOM APIs consistently throughout the codebase:

### Creating Elements

```javascript
// ✅ Correct - Use standard DOM API
const div = document.createElement('div');
div.className = 'my-class';
div.setAttribute('data-id', '123');
div.textContent = 'Hello World';

// ❌ Incorrect - Don't mix patterns
const div = createElement('div', { className: 'my-class' }); // Custom helper
```

### Setting Attributes

```javascript
// ✅ Correct - Use setAttribute for all attributes
element.setAttribute('id', 'my-id');
element.setAttribute('data-value', '123');
element.setAttribute('aria-label', 'Close button');

// Special cases - use properties for these:
element.className = 'my-class another-class';
element.textContent = 'Text content';
element.innerHTML = '<span>HTML content</span>'; // Use sparingly
```

### Event Handling

```javascript
// ✅ Correct - Use addEventListener
button.addEventListener('click', handleClick);
input.addEventListener('input', handleInput, { passive: true });

// ❌ Incorrect - Don't use inline handlers
button.onclick = handleClick;
```

### Querying Elements

```javascript
// ✅ Correct - Use standard query methods
const element = document.getElementById('my-id');
const elements = document.querySelectorAll('.my-class');
const firstMatch = document.querySelector('[data-type="widget"]');

// With error handling (use helper functions)
import { querySelector } from './utils/dom-helpers.js';
const safeElement = querySelector('#my-id'); // Returns null on error
```

## Error Handling

Use consistent try-catch patterns with our standardized error handling:

### Basic Pattern

```javascript
import { handleError, ErrorCodes, ReploidError } from './utils/error-handler.js';

// Async functions
async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ReploidError(
        'Failed to fetch data',
        ErrorCodes.API_REQUEST_FAILED,
        { status: response.status, url }
      );
    }
    return await response.json();
  } catch (error) {
    handleError(error, 'fetchData');
    return null; // Return sensible default
  }
}

// Sync functions
function processData(data) {
  try {
    // Processing logic
    return result;
  } catch (error) {
    handleError(error, 'processData');
    return []; // Return sensible default
  }
}
```

### Module Initialization

```javascript
import { wrapModuleFactory } from './utils/error-handler.js';

export const MyModule = {
  metadata: {
    id: 'MyModule',
    dependencies: ['dep1', 'dep2']
  },
  
  // Wrap factory with error handling
  factory: wrapModuleFactory('MyModule', async (deps) => {
    // Initialization logic
    return moduleInstance;
  })
};
```

### Parameter Validation

```javascript
import { validateParams } from './utils/error-handler.js';

function createWidget(options) {
  // Validate required parameters
  validateParams(options, ['id', 'type', 'container'], 'createWidget');
  
  // Function logic...
}
```

### Retry Logic

```javascript
import { retryWithBackoff } from './utils/error-handler.js';

async function reliableFetch(url) {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    },
    3, // max retries
    1000, // initial delay
    'reliableFetch'
  );
}
```

## File Organization

```
x/
├── modules/          # Core ES6 modules
│   ├── module-loader.js
│   └── *.js
├── utils/           # Utility modules
│   ├── dom-helpers.js
│   ├── error-handler.js
│   └── *.js
├── upgrades/        # Feature modules
├── styles/          # CSS files (no inline styles)
│   ├── boot-wizard.css
│   └── *.css
└── docs/           # Documentation
    └── coding-standards.md
```

## Best Practices

1. **No inline styles** - All CSS in external files
2. **No inline event handlers** - Use addEventListener
3. **No 'use strict'** - ES6 modules are strict by default
4. **Consistent error handling** - Use try-catch with handleError
5. **Validate inputs** - Use validateParams for public APIs
6. **Return sensible defaults** - Never leave catch blocks empty
7. **Log errors appropriately** - Use context parameter in handleError
8. **Use semantic HTML** - Choose appropriate elements
9. **Accessibility** - Include ARIA attributes where needed
10. **Performance** - Use passive event listeners where appropriate

## Type Documentation

While we don't use TypeScript, document types in JSDoc comments:

```javascript
/**
 * Creates a new widget
 * @param {Object} options - Widget options
 * @param {string} options.id - Widget ID
 * @param {string} options.type - Widget type
 * @param {HTMLElement} options.container - Container element
 * @returns {Widget} The created widget
 * @throws {ReploidError} If required parameters are missing
 */
export function createWidget(options) {
  // Implementation
}
```

## Testing Patterns

Test modules in isolation using the module system:

```javascript
import { MyModule } from './my-module.js';
import { tryAsync } from './utils/error-handler.js';

async function testMyModule() {
  const result = await tryAsync(
    async () => {
      const instance = await MyModule.factory({});
      return instance.someMethod();
    },
    'testMyModule',
    null
  );
  
  console.assert(result !== null, 'Module should initialize');
}
```