/**
 * Website Builder Persona - Project Phoenix
 * Generate and preview a complete landing page with HTML, CSS, and JS
 *
 * This persona specializes in creating beautiful, functional websites
 * with live preview capabilities.
 */

import BasePersona from './base-persona.js';

const WebsiteBuilderPersona = {
  metadata: {
    id: 'website-builder-persona',
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
    let _pagesCreated = 0;
    let _assetsGenerated = 0;

    const rolePrompt = `You are an expert web developer specializing in creating beautiful, responsive landing pages and websites. You have mastery over modern HTML5, CSS3, and vanilla JavaScript.

Your approach:
- Write semantic, accessible HTML with proper structure
- Create clean, maintainable CSS with modern layout techniques (Flexbox, Grid)
- Use vanilla JavaScript for interactivity (no frameworks required)
- Optimize for performance and user experience
- Ensure responsive design that works on all devices
- Follow web standards and best practices
- Create visually appealing designs with good typography and color choices

You can generate complete websites with:
- Landing pages with hero sections, features, testimonials
- Navigation and footer components
- Forms and call-to-action elements
- Animations and transitions
- Responsive layouts

Always provide code that is ready to preview immediately in the browser.`;

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Prioritize web development tools
      const priority = [
        // Creation
        'write_artifact',
        'create_html_file',
        'create_css_file',
        'create_js_file',

        // Preview
        'preview_html',
        'open_live_preview',

        // Assets
        'read_artifact',
        'search_vfs',

        // Testing
        'validate_html',
        'check_accessibility'
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

      console.log('[WebsiteBuilder] Starting website generation cycle...');
      console.log('[WebsiteBuilder] Ready to create HTML, CSS, and JavaScript');

      // Emit event
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('persona:website-builder:cycle-start', {
          cycleCount: _cycleCount,
          goal: cycleContext.goal
        });
      }
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,

      trackCreation: (type) => {
        if (type === 'page') _pagesCreated++;
        if (type === 'asset') _assetsGenerated++;
      },

      widget: {
        getStatus: () => ({
          state: _cycleCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_cycleCount} cycles`,
          secondaryMetric: `${_pagesCreated} pages`,
          lastActivity: _lastActivation,
          message: _pagesCreated > 0 ? `${_pagesCreated} pages created` : null
        }),

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              _pagesCreated = 0;
              _assetsGenerated = 0;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Website builder stats reset', 'success');
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
              <h4>🌐 Website Builder Persona</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Pages Created</div>
                  <div class="stat-value">${_pagesCreated}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Assets</div>
                  <div class="stat-value">${_assetsGenerated}</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">
                  "Expert web developer creating beautiful, responsive landing pages with modern HTML, CSS, and JavaScript."
                </p>
              </div>

              <h5>Specializations</h5>
              <div class="specializations">
                <div class="spec-item">📄 Semantic HTML5</div>
                <div class="spec-item">🎨 Modern CSS3 (Flexbox, Grid)</div>
                <div class="spec-item">⚡ Vanilla JavaScript</div>
                <div class="spec-item">📱 Responsive Design</div>
                <div class="spec-item">♿ Accessibility (A11y)</div>
                <div class="spec-item">🚀 Performance Optimization</div>
              </div>

              <h5>Can Create</h5>
              <div class="capabilities">
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 4px;">Landing Pages • Portfolios • Product Pages</div>
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 4px;">Forms • Navigation • Hero Sections</div>
                <div style="font-size: 0.9em; color: #aaa;">Animations • Responsive Layouts • Interactive Elements</div>
              </div>

              <h5>Last Activity</h5>
              <div class="activity-info">
                <div style="color: #aaa;">${formatTime(_lastActivation)}</div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(0,150,255,0.1); border-left: 3px solid #09f; border-radius: 4px;">
                <strong>🌐 Preview Ready</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  All websites are generated with live preview capability.
                  Code is production-ready and follows modern web standards.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          if (typeof EventBus !== 'undefined') {
            EventBus.on('persona:website-builder:cycle-start', callback, 'WebsiteBuilderWidget');
          }
          const intervalId = setInterval(callback, 3000);
          return () => {
            clearInterval(intervalId);
            if (typeof EventBus !== 'undefined') {
              EventBus.off('persona:website-builder:cycle-start', callback);
            }
          };
        }
      }
    };
  }
};

export default WebsiteBuilderPersona;
