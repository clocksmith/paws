# Blueprint 0x00000D: UI Management

**Objective:** To detail the architecture for managing the agent's developer console UI, including rendering, event handling, and state display.

**Prerequisites:** `0x00000E`, `0x00000F`

**Affected Artifacts:** `/modules/ui-manager.js`

---

### 1. The Strategic Imperative

The agent needs an interface to communicate with its human operator. A dedicated `UIManager` module is required to encapsulate all the logic for manipulating the DOM. This separation is critical: the agent's core cognitive logic (`agent-cycle.js`) should not contain any direct DOM manipulation code. The `UIManager` provides a clean, declarative API (e.g., `UI.logToTimeline(...)`, `UI.displayCycleArtifact(...)`) that the core logic can call, keeping the concerns of "thinking" and "displaying" separate.

### 2. The Architectural Solution

The `/modules/ui-manager.js` will be a stateful module that holds references to all key DOM elements.

**Core Responsibilities:**
-   **Initialization (`init`)**: On startup, it injects the HTML from `/modules/ui-body-template.html` and the CSS from `/modules/ui-style.css` into the main page. It then caches references to all important DOM elements (buttons, textareas, log containers) and sets up all necessary event listeners.
-   **State Display (`updateStateDisplay`)**: It provides a single function that reads the latest data from the `StateManager` and updates all relevant parts of the UI, such as the cycle counter and other metrics.
-   **Logging (`logToTimeline`)**: It exposes a method to append formatted log messages to the execution timeline, handling details like cycle numbers and message types.
-   **Artifact Rendering (`displayCycleArtifact`)**: It provides a structured way to display the inputs and outputs of a cycle, such as prompts and code changes, in a dedicated area.
-   **User Interaction**: It handles all UI event listeners (e.g., the "Run Cycle" button click) and calls the appropriate methods on the `CycleLogic` module in response.

### 3. The Implementation Pathway

1.  **Create Module:** Implement the `UIModule` factory function in `/modules/ui-manager.js`. It will receive `StateManager` and `CycleLogic` as dependencies during its `init` phase.
2.  **Implement `init`:**
    a.  Fetch the body and style artifacts from `Storage`.
    b.  Inject them into the DOM.
    c.  Cache all necessary DOM element references in a local `uiRefs` object.
    d.  Call a `setupEventListeners()` helper function.
3.  **Implement UI Update Functions:** Build out the methods for `updateStateDisplay`, `logToTimeline`, `displayCycleArtifact`, `setRunButtonState`, etc. These methods will read from the `StateManager` and manipulate the DOM elements stored in `uiRefs`.
4.  **Implement Event Handlers:** Create the event handler functions for button clicks and other user interactions. These handlers will be responsible for calling the public methods of the `CycleLogic` module (e.g., `CycleLogic.executeCycle()`).