import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ToolWorker Web Worker', () => {
  let workerEnv;
  let messageCallbacks;
  let messageIdCounter;

  beforeEach(() => {
    // Reset worker environment
    messageIdCounter = 0;
    messageCallbacks = {};

    // Mock global self for worker context
    workerEnv = {
      postMessage: vi.fn(),
      LS_shim: null,
      StateManager_shim: null,
      onmessage: null
    };

    // Implement makeShimRequest function
    const makeShimRequest = (requestType, payload) => {
      return new Promise((resolve, reject) => {
        const id = messageIdCounter++;
        messageCallbacks[id] = { resolve, reject };
        workerEnv.postMessage({
          type: 'request',
          id: id,
          requestType: requestType,
          payload: payload
        });
      });
    };

    // Initialize LS_shim
    workerEnv.LS_shim = {
      getArtifactContent: (id, cycle, versionId = null) => {
        if (
          typeof id !== 'string' ||
          typeof cycle !== 'number' ||
          (versionId !== null && typeof versionId !== 'string')
        ) {
          return Promise.reject(
            new Error('Invalid arguments for getArtifactContent')
          );
        }
        return makeShimRequest('getArtifactContent', { id, cycle, versionId });
      }
    };

    // Initialize StateManager_shim
    workerEnv.StateManager_shim = {
      getArtifactMetadata: (id, versionId = null) => {
        if (
          typeof id !== 'string' ||
          (versionId !== null && typeof versionId !== 'string')
        ) {
          return Promise.reject(
            new Error('Invalid arguments for getArtifactMetadata')
          );
        }
        return makeShimRequest('getArtifactMetadata', { id, versionId });
      },
      getArtifactMetadataAllVersions: (id) => {
        if (typeof id !== 'string') {
          return Promise.reject(
            new Error('Invalid arguments for getArtifactMetadataAllVersions')
          );
        }
        return makeShimRequest('getArtifactMetadataAllVersions', { id });
      },
      getAllArtifactMetadata: () => {
        return makeShimRequest('getAllArtifactMetadata', {});
      }
    };

    // Implement onmessage handler
    workerEnv.onmessage = async (event) => {
      const { type, payload, id, data, error } = event.data;

      if (type === 'init') {
        const { toolCode, toolArgs } = payload;
        try {
          const AsyncFunction = Object.getPrototypeOf(
            async function () {}
          ).constructor;
          const func = new AsyncFunction(
            'params',
            'LS',
            'StateManager',
            toolCode + '\n\nreturn await run(params, LS, StateManager);'
          );
          const result = await func(toolArgs, workerEnv.LS_shim, workerEnv.StateManager_shim);
          workerEnv.postMessage({ success: true, result: result });
        } catch (e) {
          const errorDetail = {
            message: e.message || 'Unknown worker execution error',
            stack: e.stack,
            name: e.name
          };
          workerEnv.postMessage({ success: false, error: errorDetail });
        }
      } else if (type === 'response') {
        const callback = messageCallbacks[id];
        if (callback) {
          if (error) {
            callback.reject(
              new Error(error.message || 'Worker shim request failed')
            );
          } else {
            callback.resolve(data);
          }
          delete messageCallbacks[id];
        }
      }
    };
  });

  describe('Worker Structure', () => {
    it('should have message handler', () => {
      expect(workerEnv.onmessage).toBeTypeOf('function');
    });

    it('should have postMessage function', () => {
      expect(workerEnv.postMessage).toBeTypeOf('function');
    });

    it('should have LS_shim', () => {
      expect(workerEnv.LS_shim).toBeDefined();
      expect(workerEnv.LS_shim.getArtifactContent).toBeTypeOf('function');
    });

    it('should have StateManager_shim', () => {
      expect(workerEnv.StateManager_shim).toBeDefined();
      expect(workerEnv.StateManager_shim.getArtifactMetadata).toBeTypeOf('function');
      expect(workerEnv.StateManager_shim.getArtifactMetadataAllVersions).toBeTypeOf('function');
      expect(workerEnv.StateManager_shim.getAllArtifactMetadata).toBeTypeOf('function');
    });
  });

  describe('Tool Execution (init message)', () => {
    it('should execute simple tool code successfully', async () => {
      const toolCode = `
        const run = async (params) => {
          return { result: params.value * 2 };
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: { value: 5 }
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: { result: 10 }
      });
    });

    it('should execute async tool code', async () => {
      const toolCode = `
        const run = async (params) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return { message: 'done', input: params.text };
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: { text: 'test' }
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: { message: 'done', input: 'test' }
      });
    });

    it('should handle tool code with no parameters', async () => {
      const toolCode = `
        const run = async (params) => {
          return { status: 'ok' };
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: { status: 'ok' }
      });
    });

    it('should handle tool code with complex return value', async () => {
      const toolCode = `
        const run = async (params) => {
          return {
            data: [1, 2, 3],
            metadata: { count: 3 },
            nested: { deep: { value: params.input } }
          };
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: { input: 'test' }
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: {
          data: [1, 2, 3],
          metadata: { count: 3 },
          nested: { deep: { value: 'test' } }
        }
      });
    });

    it('should catch and report syntax errors', async () => {
      const toolCode = `
        const run = async (params) => {
          return { this is invalid syntax
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          name: 'SyntaxError'
        })
      });
    });

    it('should catch and report runtime errors', async () => {
      const toolCode = `
        const run = async (params) => {
          throw new Error('Test error');
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Test error',
          name: 'Error'
        })
      });
    });

    it('should include error stack in error response', async () => {
      const toolCode = `
        const run = async (params) => {
          throw new Error('Stack test');
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      const errorResponse = workerEnv.postMessage.mock.calls[0][0];
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.stack).toBeDefined();
    });
  });

  describe('LS_shim (LocalStorage shim)', () => {
    it('should make request for getArtifactContent with valid args', async () => {
      const promise = workerEnv.LS_shim.getArtifactContent('test-id', 1);

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        type: 'request',
        id: 0,
        requestType: 'getArtifactContent',
        payload: { id: 'test-id', cycle: 1, versionId: null }
      });

      // Simulate response
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          data: 'artifact content'
        }
      });

      await expect(promise).resolves.toBe('artifact content');
    });

    it('should make request with optional versionId', async () => {
      const promise = workerEnv.LS_shim.getArtifactContent('test-id', 2, 'v123');

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        type: 'request',
        id: 0,
        requestType: 'getArtifactContent',
        payload: { id: 'test-id', cycle: 2, versionId: 'v123' }
      });
    });

    it('should reject with invalid id (non-string)', async () => {
      await expect(
        workerEnv.LS_shim.getArtifactContent(123, 1)
      ).rejects.toThrow('Invalid arguments for getArtifactContent');
    });

    it('should reject with invalid cycle (non-number)', async () => {
      await expect(
        workerEnv.LS_shim.getArtifactContent('test', 'not-a-number')
      ).rejects.toThrow('Invalid arguments for getArtifactContent');
    });

    it('should reject with invalid versionId (non-string)', async () => {
      await expect(
        workerEnv.LS_shim.getArtifactContent('test', 1, 123)
      ).rejects.toThrow('Invalid arguments for getArtifactContent');
    });

    it('should handle error responses', async () => {
      const promise = workerEnv.LS_shim.getArtifactContent('test-id', 1);

      // Simulate error response
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          error: { message: 'Artifact not found' }
        }
      });

      await expect(promise).rejects.toThrow('Artifact not found');
    });
  });

  describe('StateManager_shim', () => {
    describe('getArtifactMetadata', () => {
      it('should make request with valid args', async () => {
        const promise = workerEnv.StateManager_shim.getArtifactMetadata('test-id');

        expect(workerEnv.postMessage).toHaveBeenCalledWith({
          type: 'request',
          id: 0,
          requestType: 'getArtifactMetadata',
          payload: { id: 'test-id', versionId: null }
        });

        // Simulate response
        await workerEnv.onmessage({
          data: {
            type: 'response',
            id: 0,
            data: { name: 'test', size: 100 }
          }
        });

        await expect(promise).resolves.toEqual({ name: 'test', size: 100 });
      });

      it('should make request with optional versionId', async () => {
        workerEnv.StateManager_shim.getArtifactMetadata('test-id', 'v456');

        expect(workerEnv.postMessage).toHaveBeenCalledWith({
          type: 'request',
          id: 0,
          requestType: 'getArtifactMetadata',
          payload: { id: 'test-id', versionId: 'v456' }
        });
      });

      it('should reject with invalid id', async () => {
        await expect(
          workerEnv.StateManager_shim.getArtifactMetadata(null)
        ).rejects.toThrow('Invalid arguments for getArtifactMetadata');
      });

      it('should reject with invalid versionId type', async () => {
        await expect(
          workerEnv.StateManager_shim.getArtifactMetadata('test', 123)
        ).rejects.toThrow('Invalid arguments for getArtifactMetadata');
      });
    });

    describe('getArtifactMetadataAllVersions', () => {
      it('should make request with valid id', async () => {
        const promise = workerEnv.StateManager_shim.getArtifactMetadataAllVersions('test-id');

        expect(workerEnv.postMessage).toHaveBeenCalledWith({
          type: 'request',
          id: 0,
          requestType: 'getArtifactMetadataAllVersions',
          payload: { id: 'test-id' }
        });

        // Simulate response
        await workerEnv.onmessage({
          data: {
            type: 'response',
            id: 0,
            data: [{ version: 'v1' }, { version: 'v2' }]
          }
        });

        await expect(promise).resolves.toEqual([{ version: 'v1' }, { version: 'v2' }]);
      });

      it('should reject with invalid id', async () => {
        await expect(
          workerEnv.StateManager_shim.getArtifactMetadataAllVersions(123)
        ).rejects.toThrow('Invalid arguments for getArtifactMetadataAllVersions');
      });

      it('should handle empty response', async () => {
        const promise = workerEnv.StateManager_shim.getArtifactMetadataAllVersions('test-id');

        await workerEnv.onmessage({
          data: {
            type: 'response',
            id: 0,
            data: []
          }
        });

        await expect(promise).resolves.toEqual([]);
      });
    });

    describe('getAllArtifactMetadata', () => {
      it('should make request without arguments', async () => {
        const promise = workerEnv.StateManager_shim.getAllArtifactMetadata();

        expect(workerEnv.postMessage).toHaveBeenCalledWith({
          type: 'request',
          id: 0,
          requestType: 'getAllArtifactMetadata',
          payload: {}
        });

        // Simulate response
        await workerEnv.onmessage({
          data: {
            type: 'response',
            id: 0,
            data: {
              'file1.js': { size: 100 },
              'file2.js': { size: 200 }
            }
          }
        });

        await expect(promise).resolves.toEqual({
          'file1.js': { size: 100 },
          'file2.js': { size: 200 }
        });
      });

      it('should handle empty metadata', async () => {
        const promise = workerEnv.StateManager_shim.getAllArtifactMetadata();

        await workerEnv.onmessage({
          data: {
            type: 'response',
            id: 0,
            data: {}
          }
        });

        await expect(promise).resolves.toEqual({});
      });
    });
  });

  describe('Response Message Handling', () => {
    it('should resolve pending request on response', async () => {
      const promise = workerEnv.StateManager_shim.getArtifactMetadata('test-id');

      // Simulate response
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          data: { result: 'success' }
        }
      });

      await expect(promise).resolves.toEqual({ result: 'success' });
    });

    it('should reject pending request on error response', async () => {
      const promise = workerEnv.StateManager_shim.getArtifactMetadata('test-id');

      // Simulate error response
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          error: { message: 'Request failed' }
        }
      });

      await expect(promise).rejects.toThrow('Request failed');
    });

    it('should handle error response without message', async () => {
      const promise = workerEnv.StateManager_shim.getArtifactMetadata('test-id');

      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          error: {}
        }
      });

      await expect(promise).rejects.toThrow('Worker shim request failed');
    });

    it('should ignore response for unknown message id', async () => {
      // This should not throw
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 999,
          data: 'orphan response'
        }
      });

      // No error expected
      expect(true).toBe(true);
    });

    it('should remove callback after resolving', async () => {
      const promise = workerEnv.StateManager_shim.getArtifactMetadata('test-id');

      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          data: { result: 'ok' }
        }
      });

      await promise;

      // Verify callback was removed
      expect(messageCallbacks[0]).toBeUndefined();
    });
  });

  describe('Message ID Counter', () => {
    it('should increment message ID for each request', async () => {
      workerEnv.LS_shim.getArtifactContent('id1', 1);
      workerEnv.LS_shim.getArtifactContent('id2', 2);
      workerEnv.StateManager_shim.getArtifactMetadata('id3');

      expect(workerEnv.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 0 }));
      expect(workerEnv.postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 1 }));
      expect(workerEnv.postMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: 2 }));
    });

    it('should handle multiple concurrent requests', async () => {
      const promise1 = workerEnv.StateManager_shim.getArtifactMetadata('id1');
      const promise2 = workerEnv.StateManager_shim.getArtifactMetadata('id2');
      const promise3 = workerEnv.StateManager_shim.getArtifactMetadata('id3');

      // Respond out of order
      await workerEnv.onmessage({ data: { type: 'response', id: 2, data: 'result3' } });
      await workerEnv.onmessage({ data: { type: 'response', id: 0, data: 'result1' } });
      await workerEnv.onmessage({ data: { type: 'response', id: 1, data: 'result2' } });

      await expect(promise1).resolves.toBe('result1');
      await expect(promise2).resolves.toBe('result2');
      await expect(promise3).resolves.toBe('result3');
    });
  });

  describe('Integration with Shims', () => {
    it('should allow tool code to use LS_shim', async () => {
      const toolCode = `
        const run = async (params, LS) => {
          const content = await LS.getArtifactContent(params.id, params.cycle);
          return { content };
        };
      `;

      const executionPromise = workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: { id: 'test', cycle: 1 }
          }
        }
      });

      // Simulate shim response
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          data: 'file contents'
        }
      });

      await executionPromise;

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: { content: 'file contents' }
      });
    });

    it('should allow tool code to use StateManager_shim', async () => {
      const toolCode = `
        const run = async (params, LS, StateManager) => {
          const metadata = await StateManager.getArtifactMetadata(params.id);
          return { metadata };
        };
      `;

      const executionPromise = workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: { id: 'test' }
          }
        }
      });

      // Simulate shim response
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          data: { name: 'test', size: 100 }
        }
      });

      await executionPromise;

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: { metadata: { name: 'test', size: 100 } }
      });
    });

    it('should allow tool code to use multiple shim methods', async () => {
      const toolCode = `
        const run = async (params, LS, StateManager) => {
          const metadata = await StateManager.getArtifactMetadata('file1');
          const allMeta = await StateManager.getAllArtifactMetadata();
          return { metadata, allMeta };
        };
      `;

      const executionPromise = workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      // Respond to first request
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          data: { name: 'file1' }
        }
      });

      // Respond to second request
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 1,
          data: { 'file1': {}, 'file2': {} }
        }
      });

      await executionPromise;

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: {
          metadata: { name: 'file1' },
          allMeta: { 'file1': {}, 'file2': {} }
        }
      });
    });

    it('should handle shim errors in tool code', async () => {
      const toolCode = `
        const run = async (params, LS, StateManager) => {
          const metadata = await StateManager.getArtifactMetadata('missing');
          return { metadata };
        };
      `;

      const executionPromise = workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      // Simulate error from shim
      await workerEnv.onmessage({
        data: {
          type: 'response',
          id: 0,
          error: { message: 'Artifact not found' }
        }
      });

      await executionPromise;

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Artifact not found'
        })
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle tool code that returns undefined', async () => {
      const toolCode = `
        const run = async (params) => {
          // No return statement
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: undefined
      });
    });

    it('should handle tool code that returns null', async () => {
      const toolCode = `
        const run = async (params) => {
          return null;
        };
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: true,
        result: null
      });
    });

    it('should handle tool code with no run function', async () => {
      const toolCode = `
        // No run function defined
        const something = 'test';
      `;

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String)
        })
      });
    });

    it('should handle empty tool code', async () => {
      const toolCode = '';

      await workerEnv.onmessage({
        data: {
          type: 'init',
          payload: {
            toolCode,
            toolArgs: {}
          }
        }
      });

      expect(workerEnv.postMessage).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String)
        })
      });
    });

    it('should handle unknown message types gracefully', async () => {
      // Should not throw
      await workerEnv.onmessage({
        data: {
          type: 'unknown-type',
          payload: {}
        }
      });

      // Worker should not post any message
      expect(workerEnv.postMessage).not.toHaveBeenCalled();
    });
  });
});
