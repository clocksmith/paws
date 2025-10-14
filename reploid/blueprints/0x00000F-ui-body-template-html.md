# Blueprint 0x00000F: UI Body Template (HTML)

**Objective:** To describe the foundational HTML skeleton artifact that structures the agent's user interface.

**Prerequisites:** `0x00000D`

**Affected Artifacts:** `/modules/ui-body-template.html`, `/modules/ui-manager.js`

---

### 1. The Strategic Imperative

The agent's interface requires a structured Document Object Model (DOM). Hardcoding this complex HTML structure directly within the JavaScript of the `UIManager` would be unmaintainable and would prevent the agent from being able to reason about or modify its own UI layout. Therefore, the structure of the UI must exist as a dedicated artifact within the agent's Virtual File System (VFS).

### 2. The Architectural Solution

The `/modules/ui-body-template.html` artifact will contain the complete HTML structure for the agent's developer console. This includes all the `fieldset`, `legend`, `textarea`, `button`, and `ul` elements that form the interface. It is a "template" in the sense that it defines the static structure, which the `UIManager` will then populate with dynamic data.

By isolating the HTML structure in its own artifact, the agent gains the ability to:
-   **Perform Structural Self-Modification:** The agent can read the template, parse its structure (as a string), and generate a modified version to add, remove, or rearrange UI components.
-   **Maintain Separation of Concerns:** This keeps the definition of the UI's structure (HTML) separate from its presentation (CSS) and its behavior (JavaScript).

### 3. The Implementation Pathway

1.  **Create HTML Artifact:** Create the `/modules/ui-body-template.html` file. This file will contain the HTML for the developer console, including elements with specific `id` attributes that the `UIManager` will use to find and manipulate them (e.g., `<ul id="timeline-log"></ul>`).
2.  **Modify `UIManager`:**
    a.  In the `init()` method of `/modules/ui-manager.js`, add logic to fetch the content of the `/modules/ui-body-template.html` artifact from the VFS.
    b.  Find the main application root element in the main page (e.g., `<div id="app-root">`).
    c.  Set the `innerHTML` of the application root to the content of the HTML artifact.
    d.  **Crucially**, only *after* injecting the HTML should the `UIManager` proceed to cache its DOM element references, as the elements it needs to find now exist in the DOM.
3.  **Test a Modification:** A potential goal for the agent could be: "Add a new fieldset to the UI for displaying configuration settings." This would require the agent to read the existing HTML template, insert the new `<fieldset>` block, and save the modified artifact.