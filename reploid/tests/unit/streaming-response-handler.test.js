/**
 * @fileoverview Unit tests for StreamingResponseHandler module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load StreamingResponseHandler module
const StreamingResponseHandler = require(resolve(__dirname, '../../upgrades/streaming-response-handler.js')).default || require(resolve(__dirname, '../../upgrades/streaming-response-handler.js'));

// Mock dependencies
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn()
};

const mockUtils = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
};

const mockStateManager = {
  getHistory: vi.fn(() => [])
};

let handler;

describe('StreamingResponseHandler - Basic Streaming', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should stream response chunks', async () => {
    const chunks = ['Hello', ' ', 'World'];
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0] + '\n') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1] + '\n') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[2] + '\n') })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      onComplete,
      onError
    );

    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onComplete).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('should handle SSE format', async () => {
    const sseData = 'data: {"choices":[{"delta":{"content":"Test"}}]}\n';
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();
    const onComplete = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      onComplete,
      () => {}
    );

    expect(onChunk).toHaveBeenCalledWith('Test');
  });

  it('should handle response without body', async () => {
    const mockResponse = {
      body: null,
      text: async () => 'Full response text'
    };

    const onChunk = vi.fn();
    const onComplete = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      onComplete,
      () => {}
    );

    expect(onChunk).toHaveBeenCalledWith('Full response text');
    expect(onComplete).toHaveBeenCalledWith('Full response text');
  });
});

describe('StreamingResponseHandler - SSE Parsing', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should parse SSE JSON chunks', async () => {
    const sseChunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n';
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseChunk) })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      () => {},
      () => {}
    );

    expect(onChunk).toHaveBeenCalledWith('Hello');
  });

  it('should skip [DONE] markers', async () => {
    const sseData = 'data: [DONE]\n';
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      () => {},
      () => {}
    );

    expect(onChunk).not.toHaveBeenCalled();
  });

  it('should handle non-JSON SSE data', async () => {
    const sseData = 'data: plain text content\n';
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      () => {},
      () => {}
    );

    expect(onChunk).toHaveBeenCalledWith('plain text content');
  });
});

describe('StreamingResponseHandler - Stream Control', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should get stream status', () => {
    const status = handler.api.getStreamStatus();

    expect(status).toHaveProperty('active');
    expect(status).toHaveProperty('chunks');
    expect(status).toHaveProperty('partialText');
    expect(status.active).toBe(false);
  });

  it('should abort active stream', async () => {
    let readCount = 0;
    const mockReader = {
      read: vi.fn(async () => {
        readCount++;
        if (readCount === 1) {
          // First read returns data
          return { done: false, value: new TextEncoder().encode('chunk\n') };
        } else {
          // Simulate abort - subsequent reads should not happen
          return { done: true };
        }
      }),
      cancel: vi.fn()
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const streamPromise = handler.api.streamResponse(
      async () => mockResponse,
      () => {},
      () => {},
      () => {}
    );

    // Abort after a short delay
    setTimeout(() => {
      handler.api.abortStream();
    }, 10);

    await streamPromise;

    expect(mockEventBus.emit).toHaveBeenCalledWith('stream:aborted',
      expect.objectContaining({ partialText: expect.any(String) })
    );
  });
});

describe('StreamingResponseHandler - Events', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should emit stream:chunk events', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('test\n') })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    await handler.api.streamResponse(
      async () => mockResponse,
      () => {},
      () => {},
      () => {}
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('stream:chunk',
      expect.objectContaining({ text: 'test' })
    );
  });

  it('should emit stream:complete event', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('done\n') })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    await handler.api.streamResponse(
      async () => mockResponse,
      () => {},
      () => {},
      () => {}
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('stream:complete',
      expect.objectContaining({ text: expect.any(String) })
    );
  });

  it('should emit stream:error on failure', async () => {
    const mockResponse = {
      body: {
        getReader: () => {
          throw new Error('Stream error');
        }
      }
    };

    const onError = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      () => {},
      () => {},
      onError
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('stream:error',
      expect.objectContaining({ error: 'Stream error' })
    );
    expect(onError).toHaveBeenCalled();
  });
});

describe('StreamingResponseHandler - API Wrapper', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should wrap API for streaming', async () => {
    const mockApiClient = {
      callApiWithRetry: vi.fn(async () => ({
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('test\n') })
              .mockResolvedValueOnce({ done: true })
          })
        }
      }))
    };

    const wrapped = handler.api.wrapApiForStreaming(mockApiClient);
    const result = await wrapped.streamCall([], []);

    expect(result).toHaveProperty('type', 'text');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('streamed', true);
    expect(mockApiClient.callApiWithRetry).toHaveBeenCalled();
  });

  it('should reject on stream error', async () => {
    const mockApiClient = {
      callApiWithRetry: vi.fn(async () => {
        throw new Error('API error');
      })
    };

    const wrapped = handler.api.wrapApiForStreaming(mockApiClient);

    await expect(wrapped.streamCall([], [])).rejects.toThrow('API error');
  });
});

describe('StreamingResponseHandler - Error Handling', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should handle stream read errors', async () => {
    const mockReader = {
      read: vi.fn().mockRejectedValue(new Error('Read error'))
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onError = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      () => {},
      () => {},
      onError
    );

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle API call errors', async () => {
    const onError = vi.fn();

    await handler.api.streamResponse(
      async () => {
        throw new Error('API call failed');
      },
      () => {},
      () => {},
      onError
    );

    expect(onError).toHaveBeenCalled();
  });
});

describe('StreamingResponseHandler - Web Component Widget', () => {
  beforeEach(() => {
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should export widget configuration', () => {
    expect(handler.widget).toBeDefined();
    expect(handler.widget.element).toBe('streaming-handler-widget');
    expect(handler.widget.displayName).toBe('Streaming Handler');
    expect(handler.widget.icon).toBe('⏃');
    expect(handler.widget.category).toBe('service');
    expect(handler.widget.updateInterval).toBe(1000);
  });
});

describe('StreamingResponseHandler - Multiline Buffers', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    handler = StreamingResponseHandler.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  it('should handle incomplete lines in buffer', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('partial') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(' line\n') })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();
    const onComplete = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      onComplete,
      () => {}
    );

    expect(onComplete).toHaveBeenCalled();
    const finalText = onComplete.mock.calls[0][0];
    expect(finalText).toContain('partial line');
  });

  it('should process remaining buffer on completion', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('no newline') })
        .mockResolvedValueOnce({ done: true })
    };

    const mockResponse = {
      body: {
        getReader: () => mockReader
      }
    };

    const onChunk = vi.fn();

    await handler.api.streamResponse(
      async () => mockResponse,
      onChunk,
      () => {},
      () => {}
    );

    expect(onChunk).toHaveBeenCalledWith('no newline');
  });
});
