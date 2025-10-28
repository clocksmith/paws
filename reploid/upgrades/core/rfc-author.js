// @blueprint 0x00001A - Guides RFC authoring for documenting change proposals.
// RFC Authoring Assistant - automates structured change proposal drafting

const RFCAuthor = {
  metadata: {
    id: 'RFCAuthor',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, Utils } = deps;
    const { logger } = Utils;

    // Widget tracking
    let _rfcCount = 0;
    let _lastRfcTime = null;
    let _recentRfcs = [];

    const sanitizeFileName = (title) =>
      title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'untitled';

    const coalesce = (value, placeholder = 'TBD') =>
      value && value.trim().length > 0 ? value.trim() : placeholder;

    const ensureArray = (value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const loadTemplate = async () => {
      try {
        return await StateManager.getArtifactContent('/templates/rfc.md');
      } catch (error) {
        logger.warn('[RFCAuthor] Unable to load RFC template:', error);
        return null;
      }
    };

    const fillTemplate = (template, data) => {
      let populated = template;
      Object.entries(data).forEach(([key, value]) => {
        const token = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        populated = populated.replace(token, value);
      });
      return populated;
    };

    const buildDefaultContent = (data) => {
      const bullets = (items, emptyLabel = 'TBD') =>
        items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${emptyLabel}`;

      return `# ${data.TITLE}

## Metadata
- **Author:** ${data.AUTHOR}
- **Date:** ${data.DATE}
- **Status:** ${data.STATUS}
- **Reviewers:** ${bullets(data.REVIEWERS)}
- **Target Release:** ${data.TIMELINE}

## Background
${data.BACKGROUND}

## Problem Statement
${data.PROBLEM}

## Goals & Non-Goals
### Goals
${bullets(data.GOALS)}

### Non-Goals
${bullets(data.NONGOALS)}

## Proposed Solution
${data.SOLUTION}

## Technical Scope
${data.SCOPE}

## Deliverables & Milestones
${bullets(data.DELIVERABLES)}

## Risks & Mitigations
${bullets(data.RISKS)}

## Open Questions
${bullets(data.QUESTIONS)}
`;
    };

    const ensureUniquePath = async (basePath) => {
      let candidate = basePath;
      let counter = 1;
      while (StateManager.getArtifactMetadata(candidate)) {
        candidate = `${basePath.replace(/\\.md$/, '')}-${counter}.md`;
        counter += 1;
      }
      return candidate;
    };

    const gatherRecentContext = async (limit = 5) => {
      const metadata = await StateManager.getAllArtifactMetadata();
      const entries = Object.values(metadata || {});
      const recent = entries
        .filter((item) => item && item.id && item.type)
        .slice(-limit)
        .reverse()
        .map((item) => `- \`${item.id}\` (${item.type})`);

      return recent.length
        ? recent.join('\n')
        : '- No recent artifacts recorded';
    };

    const draftRFC = async (options = {}) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const data = {
        TITLE: coalesce(options.title, 'Untitled RFC'),
        AUTHOR: coalesce(options.author, 'REPLOID Agent'),
        DATE: today,
        STATUS: coalesce(options.status, 'Draft'),
        REVIEWERS: ensureArray(options.reviewers),
        TIMELINE: coalesce(options.timeline, 'TBD'),
        BACKGROUND: coalesce(options.background || options.context, '*Provide relevant background here.*'),
        PROBLEM: coalesce(options.problem, '*Define the problem this RFC addresses.*'),
        GOALS: ensureArray(options.goals),
        NONGOALS: ensureArray(options.nonGoals),
        SOLUTION: coalesce(options.solution, '*Outline the proposed approach.*'),
        SCOPE: coalesce(
          options.scope,
          '### Affected Components\n- TBD\n\n### Out of Scope\n- TBD'
        ),
        DELIVERABLES: ensureArray(options.deliverables),
        RISKS: ensureArray(options.risks),
        QUESTIONS: ensureArray(options.openQuestions)
      };

      if (!options.includeArtifacts === false) {
        const contextBullets = await gatherRecentContext();
        data.SCOPE += `\n\n### Recent Artifacts\n${contextBullets}`;
      }

      const template = await loadTemplate();
      const content = template ? fillTemplate(template, data) : buildDefaultContent(data);

      const safeTitle = sanitizeFileName(data.TITLE);
      const basePath = `/docs/rfc-${today}-${safeTitle}.md`;
      const path = await ensureUniquePath(basePath);

      await StateManager.createArtifact(path, 'document', content, `RFC draft: ${data.TITLE}`);
      logger.info(`[RFCAuthor] RFC draft created at ${path}`);

      // Track RFC creation
      _rfcCount++;
      _lastRfcTime = Date.now();
      _recentRfcs.push({
        title: data.TITLE,
        path,
        timestamp: Date.now()
      });
      // Keep only last 10 RFCs
      if (_recentRfcs.length > 10) {
        _recentRfcs.shift();
      }

      return { path, content, title: data.TITLE };
    };

    const produceOutline = async () => {
      const state = await StateManager.getAllArtifactMetadata();
      const artifactCount = Object.keys(state || {}).length;

      return {
        artifactCount,
        recentArtifacts: await gatherRecentContext(10),
        suggestedSections: [
          '## Metrics Impact',
          '## Rollout Plan',
          '## Backout Strategy',
          '## Dependencies'
        ]
      };
    };

    // Web Component Widget (INSIDE factory closure to access state)
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
        // Auto-refresh every 10 seconds
        this._interval = setInterval(() => this.render(), 10000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        return {
          state: _rfcCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_rfcCount} RFCs`,
          secondaryMetric: _recentRfcs.length > 0 ? 'Ready' : 'Idle',
          lastActivity: _lastRfcTime,
          message: 'RFC drafting assistant'
        };
      }

      renderPanel() {
        const formatTime = (timestamp) => {
          if (!timestamp) return 'Never';
          const diff = Date.now() - timestamp;
          if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
          if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
          return `${Math.floor(diff/3600000)}h ago`;
        };

        return `
          <h3>✎ RFC Author</h3>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">RFCs Created</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_rfcCount}</div>
            </div>
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Last RFC</div>
              <div style="font-size: 1.3em; font-weight: bold;">${formatTime(_lastRfcTime)}</div>
            </div>
          </div>

          ${_recentRfcs.length > 0 ? `
            <h4 style="margin-top: 16px;">☷ Recent RFCs</h4>
            <div style="max-height: 150px; overflow-y: auto; margin-top: 8px;">
              ${_recentRfcs.slice().reverse().map((rfc, idx) => `
                <div style="padding: 8px; background: rgba(255,255,255,0.05); border-left: 3px solid #6496ff; border-radius: 3px; margin-bottom: 6px;">
                  <div style="font-weight: bold; color: #6496ff;">${rfc.title}</div>
                  <div style="font-size: 0.85em; color: #888; margin-top: 2px; font-family: monospace;">${rfc.path}</div>
                  <div style="font-size: 0.8em; color: #666; margin-top: 2px;">${formatTime(rfc.timestamp)}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center; color: #888; font-style: italic;">
              No RFCs created yet
            </div>
          `}

          <h4 style="margin-top: 16px;">ℹ️ RFC Structure</h4>
          <div style="margin-top: 8px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 0.85em; color: #aaa;">
            <div style="margin-bottom: 4px;">• Metadata (author, date, status, reviewers)</div>
            <div style="margin-bottom: 4px;">• Background & problem statement</div>
            <div style="margin-bottom: 4px;">• Goals & non-goals</div>
            <div style="margin-bottom: 4px;">• Proposed solution</div>
            <div style="margin-bottom: 4px;">• Technical scope & deliverables</div>
            <div style="margin-bottom: 4px;">• Risks, mitigations & open questions</div>
          </div>

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>✎ RFC Authoring</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Automated RFC drafting for structured change proposals.<br>
              Creates standardized documentation with all required sections.
            </div>
          </div>

          <button class="draft-sample-btn" style="width: 100%; margin-top: 16px; padding: 10px; background: #6496ff; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
            ⛿ Draft Sample RFC
          </button>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: system-ui, -apple-system, sans-serif;
              color: #ccc;
            }

            .widget-content {
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h4 {
              margin: 16px 0 8px 0;
              font-size: 0.95em;
              color: #aaa;
            }

            button {
              transition: all 0.2s ease;
            }

            button:hover {
              background: #7ba6ff !important;
              transform: translateY(-1px);
            }

            button:active {
              transform: translateY(0);
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up button
        const draftBtn = this.shadowRoot.querySelector('.draft-sample-btn');
        if (draftBtn) {
          draftBtn.addEventListener('click', async () => {
            try {
              const result = await draftRFC({
                title: 'Sample RFC Document',
                author: 'REPLOID Agent',
                goals: ['Demonstrate RFC authoring', 'Show structured documentation'],
                background: 'This is a sample RFC to demonstrate the RFC authoring capability.'
              });
              logger.info(`[RFCAuthor] Widget: Sample RFC created at ${result.path}`);
              this.render(); // Refresh to show new RFC
            } catch (error) {
              logger.error('[RFCAuthor] Widget: Failed to create sample RFC', error);
            }
          });
        }
      }
    }

    // Define custom element
    if (!customElements.get('rfc-author-widget')) {
      customElements.define('rfc-author-widget', RFCAuthorWidget);
    }

    return {
      api: {
        draftRFC,
        produceOutline
      },
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

export default RFCAuthor;
