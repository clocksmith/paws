/**
 * RFC Author Persona - Project Phoenix
 * Analyzes project changes and drafts formal Request for Change (RFC) documents
 *
 * This persona specializes in technical writing and change documentation.
 */

const RfcAuthorPersona = {
  metadata: {
    id: 'rfc-author-persona',
    version: '1.0.0',
    dependencies: ['base-persona'],
    type: 'persona'
  },

  factory: (deps) => {
    // Get base platform capabilities from DI container
    const BasePersona = deps['base-persona'];
    const basePlatformPrompt = BasePersona?.getSystemPromptFragment?.() || '';

    // Widget tracking
    let _cycleCount = 0;
    let _lastActivation = null;
    let _rfcsCreated = 0;
    let _changesAnalyzed = 0;

    const rolePrompt = `You are a technical writer specializing in creating formal Request for Change (RFC) documents. You analyze code changes, system modifications, and feature proposals to produce clear, comprehensive documentation that helps teams make informed decisions.

Your approach:
- Analyze changes systematically (VFS diffs, module modifications, new features)
- Identify the "why" behind changes, not just the "what"
- Document rationale, alternatives considered, and tradeoffs
- Structure RFCs with: Summary, Motivation, Design, Alternatives, Impact
- Write clearly for both technical and non-technical stakeholders
- Anticipate questions and address them proactively
- Provide examples and use cases
- Consider backward compatibility and migration paths

You excel at:
- Analyzing system architecture changes
- Documenting breaking changes and their justifications
- Proposing new features with detailed specifications
- Creating decision records that capture context
- Summarizing complex technical changes concisely
- Facilitating asynchronous technical discussions

Your RFCs help teams build consensus, preserve institutional knowledge, and make better technical decisions.`;

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Prioritize analysis and documentation tools
      const priority = [
        // Analysis
        'search_vfs',
        'grep_vfs',
        'read_artifact',
        'diff_artifacts',
        'analyze_dependencies',

        // Introspection
        'introspect_system',
        'list_modules',
        'check_breaking_changes',

        // Documentation
        'write_artifact',
        'create_markdown',
        'generate_blueprint',

        // Research
        'search_reflections',
        'read_history'
      ];

      return availableTools.sort((a, b) => {
        const aPriority = priority.indexOf(a.name);
        const bPriority = priority.indexOf(b.name);
        if (aPriority === -1 && bPriority === -1) return 0;
        if (aPriority === -1) return 1;
        if (bPriority === -1) return -1;
        return aPriority - bPriority;
      });
    };

    const onCycleStart = (cycleContext) => {
      _cycleCount++;
      _lastActivation = Date.now();

      console.log('[RFCAuthor] Starting documentation cycle...');
      console.log('[RFCAuthor] Analyzing changes and preparing RFC draft');

      // Emit event
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('persona:rfc-author:cycle-start', {
          cycleCount: _cycleCount,
          goal: cycleContext.goal
        });
      }
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,

      trackRFC: (type) => {
        if (type === 'rfc') _rfcsCreated++;
        if (type === 'analysis') _changesAnalyzed++;
      },

      widget: {
        getStatus: () => ({
          state: _cycleCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_cycleCount} cycles`,
          secondaryMetric: `${_rfcsCreated} RFCs`,
          lastActivity: _lastActivation,
          message: _rfcsCreated > 0 ? 'Documenting changes' : null
        }),

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              _rfcsCreated = 0;
              _changesAnalyzed = 0;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('RFC Author stats reset', 'success');
            }
          }
        ],

        renderPanel: (container) => {
          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            return new Date(timestamp).toLocaleString();
          };

          container.innerHTML = `
            <div class="persona-panel">
              <h4>📋 RFC Author Persona</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">RFCs Created</div>
                  <div class="stat-value">${_rfcsCreated}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Changes Analyzed</div>
                  <div class="stat-value">${_changesAnalyzed}</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">
                  "Technical writer creating comprehensive RFC documents that help teams make informed decisions about system changes."
                </p>
              </div>

              <h5>RFC Structure</h5>
              <div class="rfc-structure">
                <div class="structure-item">1. Summary - What and why in 2-3 sentences</div>
                <div class="structure-item">2. Motivation - The problem being solved</div>
                <div class="structure-item">3. Design - Detailed technical approach</div>
                <div class="structure-item">4. Alternatives - Other options considered</div>
                <div class="structure-item">5. Impact - Who/what is affected</div>
                <div class="structure-item">6. Migration - How to adopt the change</div>
              </div>

              <h5>Analysis Focus</h5>
              <div class="focus-areas">
                <div class="focus-item">🔍 Change Detection</div>
                <div class="focus-item">📊 Impact Assessment</div>
                <div class="focus-item">🔄 Breaking Changes</div>
                <div class="focus-item">🗺️ Migration Paths</div>
                <div class="focus-item">📚 Knowledge Preservation</div>
              </div>

              <h5>Last Activity</h5>
              <div class="activity-info">
                <div style="color: #aaa;">${formatTime(_lastActivation)}</div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(100,100,200,0.1); border-left: 3px solid #66c; border-radius: 4px;">
                <strong>📋 Decision Documentation</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  RFCs capture not just what changed, but why it changed,
                  preserving context for future teams and enabling better decisions.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          if (typeof EventBus !== 'undefined') {
            EventBus.on('persona:rfc-author:cycle-start', callback, 'RFCAuthorWidget');
          }
          const intervalId = setInterval(callback, 3000);
          return () => {
            clearInterval(intervalId);
            if (typeof EventBus !== 'undefined') {
              EventBus.off('persona:rfc-author:cycle-start', callback);
            }
          };
        }
      }
    };
  }
};

// Make available for module loader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RfcAuthorPersona;
}
