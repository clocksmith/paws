/**
 * Creative Writer Persona - Project Phoenix
 * A creative partner to help you write, edit, and brainstorm new ideas for documents
 *
 * This persona focuses on creative and professional writing tasks.
 */

import BasePersona from './base-persona.js';
const CreativeWriterPersona = {
  metadata: {
    id: 'creative-writer-persona',
    version: '1.0.0',
    dependencies: ['base-persona'],
    type: 'persona'
  },

  factory: () => {
    // Get base platform capabilities
    const basePersona = BasePersona.factory();
    const basePlatformPrompt = basePersona.getSystemPromptFragment();

    // Widget tracking
    let _cycleCount = 0;
    let _lastActivation = null;
    let _documentsCreated = 0;
    let _revisionsCompleted = 0;

    const rolePrompt = `You are a skilled creative and professional writer who helps users create, edit, and brainstorm content. You adapt your writing style to the user's needs, whether that's creative fiction, technical documentation, business content, or personal essays.

Your approach:
- Listen to the user's intent and audience
- Adapt tone, style, and structure to fit the purpose
- Provide constructive feedback on drafts
- Suggest improvements while respecting the user's voice
- Help with brainstorming and overcoming writer's block
- Organize ideas into coherent structures
- Edit for clarity, flow, and impact

You excel at:
- Creative writing (stories, narratives, dialogue)
- Professional content (blog posts, articles, reports)
- Documentation (user guides, README files, tutorials)
- Business writing (proposals, emails, presentations)
- Editing and revision with track changes
- Outlining and structuring complex documents
- Finding the right words to express ideas clearly

Whether the goal is to inform, persuade, entertain, or inspire, you help users craft content that achieves their objectives.`;

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Prioritize writing and editing tools
      const priority = [
        // Creation
        'write_artifact',
        'create_markdown',
        'create_document',

        // Editing
        'read_artifact',
        'update_artifact',
        'track_changes',

        // Organization
        'search_vfs',
        'list_documents',
        'create_outline',

        // Preview
        'preview_document',
        'render_markdown',

        // Brainstorming
        'create_mind_map',
        'generate_ideas'
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

      console.log('[CreativeWriter] Starting writing session...');
      console.log('[CreativeWriter] Ready to create, edit, and refine content');

      // Emit event
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('persona:creative-writer:cycle-start', {
          cycleCount: _cycleCount,
          goal: cycleContext.goal
        });
      }
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,

      trackWriting: (type) => {
        if (type === 'document') _documentsCreated++;
        if (type === 'revision') _revisionsCompleted++;
      },

      widget: {
        getStatus: () => ({
          state: _cycleCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_cycleCount} cycles`,
          secondaryMetric: `${_documentsCreated} documents`,
          lastActivity: _lastActivation,
          message: _documentsCreated > 0 ? 'Writing in progress' : null
        }),

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              _documentsCreated = 0;
              _revisionsCompleted = 0;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Creative Writer stats reset', 'success');
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
              <h4>✍️ Creative Writer Persona</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Documents</div>
                  <div class="stat-value">${_documentsCreated}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Revisions</div>
                  <div class="stat-value">${_revisionsCompleted}</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">
                  "Skilled creative and professional writer helping you create, edit, and brainstorm content across all genres and formats."
                </p>
              </div>

              <h5>Writing Styles</h5>
              <div class="writing-styles">
                <div class="style-item">📖 Creative Fiction</div>
                <div class="style-item">📄 Technical Documentation</div>
                <div class="style-item">💼 Business Content</div>
                <div class="style-item">📝 Personal Essays</div>
                <div class="style-item">🎓 Educational Content</div>
                <div class="style-item">📰 Articles & Blog Posts</div>
              </div>

              <h5>Services Offered</h5>
              <div class="services">
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 4px;">✏️ Drafting • ✂️ Editing • 🔄 Revision</div>
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 4px;">💡 Brainstorming • 🗂️ Organizing • 📊 Outlining</div>
                <div style="font-size: 0.9em; color: #aaa;">🎨 Style Adaptation • 🔍 Proofreading • 📐 Formatting</div>
              </div>

              <h5>Last Activity</h5>
              <div class="activity-info">
                <div style="color: #aaa;">${formatTime(_lastActivation)}</div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(200,100,200,0.1); border-left: 3px solid #c6c; border-radius: 4px;">
                <strong>✍️ Your Writing Partner</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  From first draft to final polish, helping you find the right words
                  to express your ideas clearly and compellingly.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          if (typeof EventBus !== 'undefined') {
            EventBus.on('persona:creative-writer:cycle-start', callback, 'CreativeWriterWidget');
          }
          const intervalId = setInterval(callback, 3000);
          return () => {
            clearInterval(intervalId);
            if (typeof EventBus !== 'undefined') {
              EventBus.off('persona:creative-writer:cycle-start', callback);
            }
          };
        }
      }
    };
  }
};

export default CreativeWriterPersona;
