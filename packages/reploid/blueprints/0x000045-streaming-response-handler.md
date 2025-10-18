# Blueprint 0x000045: Streaming Response Handler

**Status:** ✅ Implemented
**Module ID:** STRM
**File:** `upgrades/streaming-response-handler.js`
**Version:** 1.0.0
**Category:** User Experience

---

## Purpose

The Streaming Response Handler enables real-time incremental display of LLM responses as they are generated, rather than waiting for the complete response. This dramatically improves perceived performance and user experience during long-running agent reasoning sessions.

## Problem Statement

Traditional API calls wait for the entire response before displaying anything to the user. For complex reasoning tasks that may take 10-30 seconds, this creates a poor user experience where the interface appears frozen. Users cannot see progress, cannot cancel early if the response is going in the wrong direction, and lose confidence in the system.

## Solution Architecture

### Core Components

1. **Stream Reader**
   - Uses the Streams API to read response chunks incrementally
   - Handles both Server-Sent Events (SSE) and raw streaming formats
   - Manages decoder state across chunk boundaries

2. **Event Emission**
   - Emits `stream:chunk` events for each text fragment received
   - Emits `stream:complete` when the full response is assembled
   - Emits `stream:aborted` if user cancels mid-stream
   - Emits `stream:error` for any streaming failures

3. **Buffer Management**
   - Maintains a buffer for incomplete lines/chunks
   - Reassembles split multi-byte characters correctly
   - Aggregates chunks into the complete response

### Key Features

**Graceful Degradation**
- Falls back to non-streaming if API doesn't support streaming
- Handles both streaming and non-streaming APIs transparently

**Early Cancellation**
- Users can abort streams mid-flight
- Returns partial response text on abort
- Cleans up resources properly

**Format Flexibility**
- Supports SSE (Server-Sent Events) format
- Supports raw text streaming
- Parses JSON chunks from OpenAI/Anthropic format
- Handles Gemini streaming format

## Integration Points

### With Agent Cycle
```javascript
const StreamingHandler = await container.resolve('StreamingResponseHandler');

// Wrap API client for streaming
const streamingApi = StreamingHandler.wrapApiForStreaming(ApiClient);

// Use in agent cycle
const response = await streamingApi.streamCall(history, funcDecls);
```

### With UI Manager
```javascript
EventBus.on('stream:chunk', ({ text, total }) => {
  // Update UI incrementally
  UI.updateThinkingDisplay(total);
});

EventBus.on('stream:complete', ({ text }) => {
  // Finalize UI
  UI.completeResponse(text);
});
```

### With StateManager
```javascript
// Track streaming state
EventBus.on('stream:chunk', ({ text, total }) => {
  StateManager.updatePartialResponse(total);
});
```

## Public API

### `streamResponse(apiCall, onChunk, onComplete, onError)`
Streams a response with callback handlers for each phase.

**Parameters:**
- `apiCall`: Function that returns a fetch Response with streaming body
- `onChunk`: Called for each text fragment received
- `onComplete`: Called with full text when stream finishes
- `onError`: Called if streaming fails

**Example:**
```javascript
await streamResponse(
  () => fetch('/api/generate', { method: 'POST', body: '...' }),
  (chunk) => console.log('Chunk:', chunk),
  (full) => console.log('Complete:', full),
  (err) => console.error('Error:', err)
);
```

### `abortStream()`
Cancels the currently active stream.

**Example:**
```javascript
// User clicks cancel button
StreamingHandler.abortStream();
```

### `getStreamStatus()`
Returns current stream state.

**Returns:**
```javascript
{
  active: boolean,      // Is a stream currently running?
  chunks: number,       // How many chunks received so far
  partialText: string   // Current accumulated text
}
```

### `wrapApiForStreaming(apiClient)`
Wraps an existing API client to add streaming support.

**Returns:** Object with `streamCall` method that mirrors the API client interface but streams responses.

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `stream:chunk` | `{ text, total }` | New text chunk received |
| `stream:complete` | `{ text }` | Stream finished successfully |
| `stream:aborted` | `{ partialText }` | User canceled stream |
| `stream:error` | `{ error }` | Stream failed |

## Dependencies

- **Utils**: Logging and error handling
- **EventBus**: Event emission for UI updates
- **StateManager**: Optional state tracking

## Configuration

No configuration required. Module adapts to API response format automatically.

## Performance Characteristics

- **Latency:** First chunk typically arrives 200-500ms after request (vs 3-10s for full response)
- **Memory:** Minimal overhead (~1KB per active stream)
- **Throughput:** Handles up to 100KB/s streaming rate

## Error Handling

1. **Network Interruption:** Emits `stream:error`, returns partial text
2. **Invalid Format:** Falls back to non-streaming, logs warning
3. **User Abort:** Clean cancellation, emits `stream:aborted`

## Testing Strategy

```javascript
// Unit tests
describe('StreamingResponseHandler', () => {
  it('should emit chunks as they arrive', async () => {
    const chunks = [];
    await streamResponse(mockStreamingApi, (c) => chunks.push(c), ...);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle aborts gracefully', async () => {
    streamResponse(slowApi, ...);
    setTimeout(() => abortStream(), 100);
    // Should emit stream:aborted event
  });
});
```

## Future Enhancements

1. **Adaptive Buffering:** Adjust chunk size based on network speed
2. **Progress Estimation:** Estimate completion percentage
3. **Multi-Stream:** Handle multiple concurrent streams
4. **Replay:** Record and replay streams for debugging

## Related Blueprints

- **0x00000D:** UI Manager (consumer of streaming events)
- **0x000007:** API Client (wrapped by streaming handler)
- **0x000046:** Context Manager (benefits from faster feedback)

---

**Architectural Principle:** Progressive Enhancement

Streaming is optional - the system works without it, but provides a superior experience when available. All APIs can be wrapped transparently without changing calling code.
