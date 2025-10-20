# Blueprint 0x00001A: RFC Authoring

**Objective:** To define the structure, tone, and required components for a standard Request for Change document.

**Target Upgrade:** RFCA (`rfc-author.js`)


**Prerequisites:** 0x000012 (Structured Self-Evaluation), **0x00004E** (Module Widget Protocol)

**Affected Artifacts:** `/docs/rfc-*.md`, `/templates/rfc.md`

---

## 1. The Strategic Imperative

To ensure project changes are well-documented, reviewed, and aligned with strategic goals, a formal RFC process is necessary. This blueprint provides the knowledge to automate the drafting of these documents.

The RFC process serves multiple critical functions:
- **Alignment**: Ensures proposed changes align with project vision and technical architecture
- **Documentation**: Creates a historical record of decisions and their rationale
- **Review**: Enables stakeholder feedback before implementation
- **Risk Management**: Identifies potential issues and mitigation strategies early

## 2. The Architectural Solution

The RFC Author module provides both programmatic RFC generation and real-time monitoring through a Web Component-based widget. It creates markdown documents from templates while tracking RFC creation activity.

### Module Architecture:

**Factory Pattern with Web Component Widget:**
```javascript
const RFCAuthor = {
  metadata: {
    id: 'RFCAuthor',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils'],
    type: 'service'
  },
  factory: (deps) => {
    // Business logic for RFC creation
    const draftRFC = async (options) => { /*...*/ };
    const produceOutline = async () => { /*...*/ };

    // Web Component Widget (defined inside factory to access closure state)
    class RFCAuthorWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 10000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      render() {
        // Access closure state for RFC statistics
        const rfcCount = this._api?.getRFCCount?.() || 0;
        const lastRFC = this._api?.getLastRFCTime?.() || null;
        const timeSinceLast = lastRFC ? Math.floor((Date.now() - lastRFC) / 1000 / 60) : null;

        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; font-size: 12px; }
            .rfc-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
            .stat { padding: 8px; background: rgba(255, 255, 255, 0.08); margin: 4px 0; }
          </style>
          <div class="rfc-panel">
            <h4>✎ RFC Author</h4>
            <div class="stat">Total RFCs: ${rfcCount}</div>
            ${timeSinceLast !== null ? `
              <div class="stat">Last RFC: ${timeSinceLast}m ago</div>
            ` : '<div class="stat">No RFCs created yet</div>'}
            <div style="margin-top: 8px; font-size: 10px; color: #888;">
              Creates formal RFC documents for project changes
            </div>
          </div>
        `;
      }
    }

    customElements.define('rfc-author-widget', RFCAuthorWidget);

    return {
      api: { draftRFC, produceOutline },
      widget: {
        element: 'rfc-author-widget',
        displayName: 'RFC Author',
        icon: '✎',
        category: 'service',
        updateInterval: 10000
      }
    };
  }
};
```

### Core RFC Structure:

1. **Title**: Clear, descriptive summary of the change (50 chars max)
2. **Metadata**: Author, date, status, and review timeline
3. **Background**: Context and problem statement (2-3 paragraphs)
4. **Goals**: Specific, measurable outcomes (3-5 bullet points)
5. **Technical Scope**: Implementation details and affected systems
6. **Deliverables**: Concrete outputs and success criteria
7. **Risks & Mitigations**: Potential issues and prevention strategies
8. **Approval**: Review and sign-off requirements

### Web Component Widget Features:

The `RFCAuthorWidget` provides real-time visibility into RFC creation:
- **Statistics Dashboard**: Shows total RFCs created and time since last RFC
- **Recent RFCs List**: Displays the last 10 RFCs with titles, paths, and timestamps
- **RFC Structure Reference**: Lists all standard RFC sections
- **Interactive Actions**: "Draft Sample RFC" button for quick RFC creation
- **Auto-refresh**: Updates every 10 seconds to reflect new RFC creation

### Tone Guidelines:

- **Professional**: Use formal but accessible language
- **Objective**: Present facts and data, minimize subjective opinions
- **Concise**: Each section should be thorough but brief
- **Structured**: Use consistent formatting and clear hierarchies

## 3. The Implementation Pathway

### 3.1 Module Implementation Steps:

**Step 1: Module Registration**
```javascript
// In config.json, ensure RFCAuthor is registered with dependencies
{
  "modules": {
    "RFCAuthor": {
      "dependencies": ["StateManager", "Utils"],
      "enabled": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates the RFC authoring logic:
```javascript
factory: (deps) => {
  const { StateManager, Utils } = deps;
  const { logger } = Utils;

  // Internal state (accessible to widget via closure)
  let _rfcCount = 0;
  let _lastRfcTime = null;
  let _recentRfcs = [];

  // Core API functions
  const draftRFC = async (options = {}) => {
    // Build RFC data structure
    // Load template or use default
    // Create artifact via StateManager
    // Track creation in internal state
    return { path, content, title };
  };

  // Web Component defined here to access closure variables
  class RFCAuthorWidget extends HTMLElement { /*...*/ }
  customElements.define('rfc-author-widget', RFCAuthorWidget);

  return { api, widget };
}
```

**Step 3: RFC Creation Logic**

The `draftRFC` function implements the full workflow:
1. **Data Preparation**: Coalesce options with defaults using helper functions
2. **Template Loading**: Attempt to load `/templates/rfc.md` from StateManager
3. **Content Generation**: Either fill template or use `buildDefaultContent()`
4. **Path Generation**: Create unique path using `sanitizeFileName()` and `ensureUniquePath()`
5. **Artifact Creation**: Save RFC via `StateManager.createArtifact()`
6. **State Tracking**: Update `_rfcCount`, `_lastRfcTime`, and `_recentRfcs` for widget display

**Step 4: Web Component Widget**

The widget provides real-time monitoring inside factory closure:
```javascript
class RFCAuthorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set moduleApi(api) {
    this._api = api;  // Receives { draftRFC, produceOutline }
    this.render();
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 10000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  render() {
    // Access closure state for RFC statistics
    const rfcCount = this._api?.getRFCCount?.() || 0;
    const lastRFC = this._api?.getLastRFCTime?.() || null;
    const timeSinceLast = lastRFC ? Math.floor((Date.now() - lastRFC) / 1000 / 60) : null;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .rfc-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .stat { padding: 8px; background: rgba(255, 255, 255, 0.08); margin: 4px 0; }
        .draft-btn { padding: 4px 8px; background: #0a0; color: #000; border: none; cursor: pointer; }
      </style>
      <div class="rfc-panel">
        <h4>✎ RFC Author</h4>
        <div class="stat">Total RFCs: ${rfcCount}</div>
        ${timeSinceLast !== null ? `
          <div class="stat">Last RFC: ${timeSinceLast}m ago</div>
        ` : '<div class="stat">No RFCs created yet</div>'}
        <button class="draft-btn draft-sample-btn">Draft Sample RFC</button>
      </div>
    `;

    // Wire up interactive button
    const btn = this.shadowRoot.querySelector('.draft-sample-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        const draftRFC = this._api?.draftRFC;
        if (draftRFC) {
          await draftRFC({ title: 'Sample RFC Document', /*...*/ });
        }
      });
    }
  }
}
```

**Step 5: Shadow DOM Rendering**

The widget renders encapsulated UI:
- **Statistics Grid**: 2-column layout showing RFC count and last creation time
- **Recent RFCs**: Scrollable list (max-height: 150px) of last 10 RFCs
- **Structure Reference**: Informational panel listing RFC sections
- **Action Button**: Interactive "Draft Sample RFC" button
- **Auto-refresh**: Updates display every 10 seconds

### 3.2 Quality Checklist:

Before finalizing an RFC, verify:
- [ ] Title accurately summarizes the change
- [ ] Background provides sufficient context
- [ ] Goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- [ ] Technical scope identifies all affected components
- [ ] Risks are realistic and mitigations are actionable
- [ ] Document follows markdown best practices
- [ ] All placeholders have been replaced with content

### 3.3 Advanced Techniques:

**Change Impact Analysis**:
- Use `read_artifact` to examine affected files
- Analyze dependency chains with blueprint cross-references
- Estimate implementation complexity based on scope

**Automated Goal Extraction**:
- Parse user input for action verbs and outcomes
- Identify implicit goals from problem descriptions
- Prioritize goals based on strategic alignment

**Risk Assessment Matrix**:
- Technical risks: Performance, scalability, compatibility
- Process risks: Timeline, resource availability, dependencies
- Business risks: User impact, cost, strategic alignment

## 4. Integration Points

### Module Dependencies:
- **StateManager**: For artifact creation and retrieval
  - `createArtifact(path, type, content, note)`: Saves RFC documents
  - `getArtifactContent(path)`: Loads RFC templates
  - `getArtifactMetadata(path)`: Checks for existing RFCs
  - `getAllArtifactMetadata()`: Gathers context for recent artifacts section
- **Utils**: For logging and common utilities
  - `logger`: For tracking RFC creation events
  - Helper functions for string sanitization and validation

### Widget Integration:
The RFCAuthor widget integrates with the module dashboard system:
```javascript
widget: {
  element: 'rfc-author-widget',        // Custom element tag name
  displayName: 'RFC Author',            // Dashboard display name
  icon: '✎',                            // Visual identifier
  category: 'service',                  // Dashboard grouping
  updateInterval: 10000                 // 10-second refresh rate
}
```

**Dashboard Communication:**
- Widget accesses module API via `.moduleApi` property setter
- Widget uses closure variables for real-time state display
- Interactive buttons call API functions directly from Shadow DOM

### Blueprint Dependencies:
- 0x000012: Provides self-evaluation framework
- 0x000018: Offers meta-blueprint creation patterns
- 0x000009: Supplies pure logic for analysis
- 0x000005: StateManager for artifact persistence
- 0x000003: Utils for common functionality

### Persona Compatibility:
- **RFC Author**: Primary persona for this blueprint
- **Code Refactorer**: Can use RFCs to document refactoring plans
- **RSI Lab Sandbox**: Can practice RFC creation as a learning exercise

## 5. Example RFC Snippets

### Well-Written Background:
```markdown
### Background

The current REPLOID system initializes with a developer-centric interface that requires 
deep technical knowledge to operate effectively. User feedback from Q2 testing revealed 
that 78% of non-technical stakeholders struggled with the initial configuration process, 
leading to a 45% drop-off rate within the first session.

This friction point significantly limits adoption among our target user base of product 
managers, designers, and content creators who would benefit from AI-assisted prototyping 
but lack the technical expertise to navigate complex configuration wizards.
```

### Clear Goals Section:
```markdown
### Goals

- Reduce first-session drop-off rate from 45% to under 15%
- Enable non-technical users to start productive work within 2 minutes
- Maintain full functionality for power users via progressive disclosure
- Achieve 80% user satisfaction score in onboarding surveys
- Complete implementation by end of Q3
```

## 6. Meta-Considerations

This blueprint itself demonstrates RFC principles:
- Clear structure with numbered sections
- Specific, actionable guidance
- Integration with existing systems
- Measurable success criteria

When creating new RFCs, the agent should:
1. Reference this blueprint for structural guidance
2. Adapt tone and depth to audience needs
3. Balance thoroughness with conciseness
4. Maintain consistency with prior RFCs in the project

## 7. Conclusion

RFC authoring is a critical meta-capability that enables the REPLOID system to document 
its own evolution. By following this blueprint, the agent can produce professional, 
actionable change proposals that facilitate both human review and automated implementation.

The RFC process transforms ad-hoc changes into structured, reviewable proposals that 
enhance project governance and maintain architectural coherence as the system grows.