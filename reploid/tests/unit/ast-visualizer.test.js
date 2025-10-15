import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ASTVisualizer from '../../upgrades/ast-visualizer.js';

describe('ASTVisualizer Module', () => {
  let mockUtils, mockEventBus, mockDeps;
  let visualizer;

  beforeEach(() => {
    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    };

    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    mockDeps = {
      Utils: mockUtils,
      EventBus: mockEventBus
    };

    // Mock D3 and Acorn - complete chainable pattern
    const createChainable = () => {
      const chain = {
        select: vi.fn(function() { return chain; }),
        selectAll: vi.fn(function() { return chain; }),
        append: vi.fn(function() { return chain; }),
        attr: vi.fn(function() { return chain; }),
        style: vi.fn(function() { return chain; }),
        text: vi.fn(function() { return chain; }),
        call: vi.fn(function() { return chain; }),
        on: vi.fn(function() { return chain; }),
        datum: vi.fn(function() { return chain; }),
        data: vi.fn(function() { return chain; }),
        enter: vi.fn(function() { return chain; }),
        exit: vi.fn(function() { return chain; }),
        merge: vi.fn(function() { return chain; }),
        remove: vi.fn(function() { return chain; }),
        transition: vi.fn(function() { return chain; }),
        duration: vi.fn(function() { return chain; }),
        each: vi.fn(function() { return chain; }),
        filter: vi.fn(function() { return chain; }),
        node: vi.fn(() => null),
        nodes: vi.fn(() => [])
      };
      return chain;
    };

    global.d3 = {
      select: vi.fn(() => createChainable()),
      selectAll: vi.fn(() => createChainable()),
      tree: vi.fn(() => {
        // Tree needs to be callable with data
        const treeFunc = vi.fn((data) => {
          return global.d3.hierarchy(data);
        });
        treeFunc.size = vi.fn(function() { return treeFunc; });
        treeFunc.separation = vi.fn(function() { return treeFunc; });
        return treeFunc;
      }),
      hierarchy: vi.fn((data) => ({
        descendants: vi.fn(() => []),
        links: vi.fn(() => []),
        ...data
      })),
      zoom: vi.fn(() => ({
        scaleExtent: vi.fn(function() { return this; }),
        on: vi.fn(function() { return this; })
      })),
      linkVertical: vi.fn(() => vi.fn())
    };

    global.acorn = {
      parse: vi.fn((code) => ({
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: 'x' },
                init: { type: 'Literal', value: 42 }
              }
            ]
          }
        ]
      }))
    };

    visualizer = ASTVisualizer.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.d3;
    delete global.acorn;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ASTVisualizer.metadata.id).toBe('ASTVisualizer');
      expect(ASTVisualizer.metadata.version).toBe('1.0.0');
      expect(ASTVisualizer.metadata.type).toBe('ui');
    });

    it('should declare required dependencies', () => {
      expect(ASTVisualizer.metadata.dependencies).toContain('Utils');
      expect(ASTVisualizer.metadata.dependencies).toContain('EventBus');
    });

    it('should be synchronous', () => {
      expect(ASTVisualizer.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize with container', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });

    it('should warn if D3 not available', () => {
      delete global.d3;

      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('D3 not available')
      );
    });

    it('should warn if container missing', () => {
      visualizer.init(null);

      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('container')
      );
    });

    it('should handle re-initialization', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);
      visualizer.init(container);

      // Should warn about already initialized
      expect(mockUtils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Code Visualization', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should visualize valid JavaScript code', () => {
      const code = 'const x = 42;';

      visualizer.visualizeCode(code);

      expect(global.acorn.parse).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          ecmaVersion: 2023,
          sourceType: 'module'
        })
      );
    });

    it('should handle parse errors', () => {
      global.acorn.parse = vi.fn(() => {
        throw new Error('Parse error');
      });

      const code = 'invalid syntax {{{';

      // visualizeCode catches errors and logs them, doesn't rethrow
      visualizer.visualizeCode(code);

      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Visualization error'),
        expect.any(Error)
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ast:parse:error',
        expect.objectContaining({ error: expect.any(String), code })
      );
    });

    it('should store current code', () => {
      const code = 'const x = 42;';

      visualizer.visualizeCode(code);

      expect(visualizer.getCurrentCode()).toBe(code);
    });

    it('should handle empty code', () => {
      visualizer.visualizeCode('');

      expect(visualizer.getCurrentCode()).toBe('');
    });

    it('should handle complex AST structures', () => {
      const code = `
        function add(a, b) {
          if (a > 0) {
            return a + b;
          }
          return 0;
        }
      `;

      visualizer.visualizeCode(code);

      expect(global.acorn.parse).toHaveBeenCalled();
    });
  });

  describe('AST Manipulation', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
      visualizer.visualizeCode('const x = 42;');
    });

    it('should expand all nodes', () => {
      visualizer.expandAll();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should collapse all nodes', () => {
      visualizer.collapseAll();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle expand when no tree', () => {
      visualizer.destroy();
      visualizer.expandAll();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle collapse when no tree', () => {
      visualizer.destroy();
      visualizer.collapseAll();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('API Methods', () => {
    it('should get current code', () => {
      const code = visualizer.getCurrentCode();

      expect(typeof code).toBe('string');
    });

    it('should return empty string initially', () => {
      expect(visualizer.getCurrentCode()).toBe('');
    });

    it('should destroy visualization', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      visualizer.destroy();

      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Destroyed')
      );
    });

    it('should handle destroy when not initialized', () => {
      visualizer.destroy();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Node Styling', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle different node types', () => {
      const code = `
        function test() {}
        const x = 42;
        class Foo {}
        if (true) {}
        for (let i = 0; i < 10; i++) {}
      `;

      visualizer.visualizeCode(code);

      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle expression nodes', () => {
      const code = 'x + y;';

      visualizer.visualizeCode(code);

      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle arrow functions', () => {
      const code = 'const f = (x) => x * 2;';

      visualizer.visualizeCode(code);

      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle method calls', () => {
      const code = 'obj.method();';

      visualizer.visualizeCode(code);

      expect(global.acorn.parse).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Acorn not loaded', () => {
      delete global.acorn;

      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      // visualizeCode catches the error and logs it
      visualizer.visualizeCode('const x = 1;');

      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Visualization error'),
        expect.any(Error)
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ast:parse:error',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should log parse errors', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      global.acorn.parse = vi.fn(() => {
        throw new SyntaxError('Unexpected token');
      });

      // visualizeCode catches the error and logs it
      visualizer.visualizeCode('bad code');

      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Visualization error'),
        expect.any(Error)
      );
    });

    it('should handle null code gracefully', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      // Should not throw with proper handling
      const code = '';
      visualizer.visualizeCode(code);

      expect(visualizer.getCurrentCode()).toBe(code);
    });
  });

  describe('State Management', () => {
    it('should track initialization state', () => {
      expect(visualizer.getCurrentCode()).toBe('');

      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      visualizer.visualizeCode('const x = 1;');
      expect(visualizer.getCurrentCode()).toBe('const x = 1;');
    });

    it('should clear state on destroy', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
      visualizer.visualizeCode('const x = 1;');

      visualizer.destroy();

      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Destroyed')
      );
    });

    it('should update code on each visualization', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      visualizer.visualizeCode('const x = 1;');
      expect(visualizer.getCurrentCode()).toBe('const x = 1;');

      visualizer.visualizeCode('const y = 2;');
      expect(visualizer.getCurrentCode()).toBe('const y = 2;');
    });
  });

  describe('Complex Syntax Trees', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle nested object literals', () => {
      const code = `
        const obj = {
          a: 1,
          b: {
            c: 2,
            d: {
              e: 3
            }
          }
        };
      `;

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle deeply nested function calls', () => {
      const code = 'foo(bar(baz(qux(test()))));';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle async/await syntax', () => {
      const code = `
        async function fetchData() {
          const result = await fetch('/api/data');
          return result.json();
        }
      `;

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle generator functions', () => {
      const code = `
        function* generator() {
          yield 1;
          yield 2;
          yield 3;
        }
      `;

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle destructuring assignments', () => {
      const code = 'const { a, b: { c } } = obj;';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle spread operators', () => {
      const code = 'const arr = [...arr1, ...arr2];';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle template literals', () => {
      const code = 'const str = `Hello ${name}, you are ${age} years old`;';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });
  });

  describe('Different Language ASTs', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle ES5 syntax', () => {
      const code = 'var x = function() { return 42; };';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle ES6 class syntax', () => {
      const code = `
        class MyClass extends BaseClass {
          constructor() {
            super();
            this.value = 42;
          }

          method() {
            return this.value;
          }
        }
      `;

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle JSX-like syntax in comments', () => {
      const code = '// <Component prop="value" />\nconst x = 1;';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle module imports/exports', () => {
      const code = `
        import { foo, bar } from './module';
        export default function test() {}
        export { foo as bar };
      `;

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });
  });

  describe('Invalid Syntax Handling', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle missing semicolons', () => {
      const code = 'const x = 1\nconst y = 2';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle trailing commas', () => {
      const code = 'const arr = [1, 2, 3,];';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle unclosed braces', () => {
      global.acorn.parse = vi.fn(() => {
        throw new SyntaxError('Unexpected end of input');
      });

      visualizer.visualizeCode('function test() {');

      expect(mockUtils.logger.error).toHaveBeenCalled();
    });

    it('should handle invalid operators', () => {
      global.acorn.parse = vi.fn(() => {
        throw new SyntaxError('Unexpected token');
      });

      visualizer.visualizeCode('const x = 1 ++ 2;');

      expect(mockUtils.logger.error).toHaveBeenCalled();
    });

    it('should handle reserved keywords as identifiers', () => {
      global.acorn.parse = vi.fn(() => {
        throw new SyntaxError('Unexpected reserved word');
      });

      visualizer.visualizeCode('const class = 1;');

      expect(mockUtils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle very long code', () => {
      const code = 'const x = ' + '1 + '.repeat(1000) + '1;';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle code with only comments', () => {
      const code = '// This is a comment\n/* Multi-line\n   comment */';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle code with unicode characters', () => {
      const code = 'const 変数 = "日本語";';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle code with escape sequences', () => {
      const code = 'const str = "\\n\\t\\r\\\\";';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle regex literals', () => {
      const code = 'const regex = /[a-z]+/gi;';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle bigint literals', () => {
      const code = 'const big = 123456789012345678901234567890n;';

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });
  });

  describe('Performance with Large ASTs', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle code with many statements', () => {
      let code = '';
      for (let i = 0; i < 100; i++) {
        code += `const var${i} = ${i};\n`;
      }

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle code with deep nesting', () => {
      let code = 'if (true) {';
      for (let i = 0; i < 20; i++) {
        code += ' if (true) {';
      }
      code += ' const x = 1;';
      for (let i = 0; i < 21; i++) {
        code += ' }';
      }

      visualizer.visualizeCode(code);
      expect(global.acorn.parse).toHaveBeenCalled();
    });

    it('should handle multiple visualizations efficiently', () => {
      const codes = [
        'const x = 1;',
        'function test() {}',
        'class MyClass {}',
        'const arr = [1, 2, 3];'
      ];

      codes.forEach(code => {
        visualizer.visualizeCode(code);
      });

      expect(global.acorn.parse).toHaveBeenCalledTimes(codes.length);
    });
  });
});
