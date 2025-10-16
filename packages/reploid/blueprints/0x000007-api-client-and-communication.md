# Blueprint 0x000007: API Client and Communication

**Objective:** To detail the architecture for a robust API client module responsible for all communication with the external Large Language Model.

**Prerequisites:** `0x000003`

**Affected Artifacts:** `/modules/api-client.js`

---

### 1. The Strategic Imperative

Directly using the `fetch` API throughout the codebase for LLM calls is brittle and leads to duplicated logic. A dedicated `ApiClient` module is essential to encapsulate the specifics of communicating with the LLM provider (e.g., Google's Gemini API). This abstraction allows the agent to have a single, reliable point for making requests, handling errors, managing abort signals, and processing responses, making the rest of the codebase cleaner and independent of the specific API endpoint details.

### 2. The Architectural Solution

The `/modules/api-client.js` artifact will provide a clean interface for the agent's cognitive cycle. It will manage the complexities of the API interaction internally.

**Core Features:**
-   **Request Formatting:** It will be responsible for constructing the correct JSON body for the API request, including the conversation `history`, `safetySettings`, `generationConfig`, and `tools` for function calling.
-   **Retry Logic:** The primary `callApiWithRetry` function will include logic to automatically retry requests on specific, transient server errors (e.g., HTTP 5xx) or rate limit errors (HTTP 429), using an exponential backoff strategy.
-   **Abort Handling:** It will use an `AbortController` to allow the main agent cycle to cancel an in-flight API request, which is critical for responsiveness and user control.
-   **Response Processing:** It will parse the JSON response from the API, identify the type of response (text vs. function call), and return it in a standardized format to the caller. It will also use a `sanitizeLlmJsonResp` helper to clean up malformed JSON often returned by LLMs.

### 3. The Implementation Pathway

1.  **Create Module:** Implement the `ApiClientModule` factory function in `/modules/api-client.js`.
2.  **Implement `callApiWithRetry`:** This will be the core method. It will:
    a.  Instantiate a new `AbortController`.
    b.  Construct the request body based on its arguments.
    c.  Use a `while` loop for retries. Inside the loop, wrap the `fetch` call in a `try...catch` block.
    d.  If the fetch is successful, parse the response and return it in a standardized format.
    e.  If the fetch fails, check the error type. If it is a retryable error and attempts remain, delay and continue the loop. Otherwise, throw a specific `ApiError`.
3.  **Implement `abortCurrentCall`:** This method will simply call `.abort()` on the `currentAbortController` if it exists.
4.  **Integrate with Agent Cycle:** The `/modules/agent-cycle.js` module will be the primary consumer of the `ApiClient`. It will `await` the result of `callApiWithRetry` and use the `abortCurrentCall` method when the user initiates an abort.