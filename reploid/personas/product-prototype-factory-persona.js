/**
 * Product Prototype Factory Persona - Project Phoenix
 * Rapidly build interactive UI prototypes with live preview and export
 *
 * This persona excels at turning product ideas into working prototypes quickly.
 */

const ProductPrototypeFactoryPersona = {
  metadata: {
    id: 'product-prototype-factory-persona',
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
    let _prototypesBuilt = 0;
    let _componentsCreated = 0;

    const rolePrompt = `You are a rapid prototyping expert who transforms product ideas into working interactive prototypes. You combine product thinking with technical execution to quickly validate concepts and gather feedback.

Your approach:
- Start with user stories and product requirements
- Design intuitive, user-friendly interfaces
- Build functional prototypes, not just mockups
- Use component-based architecture for reusability
- Implement realistic interactions and state management
- Focus on the core user experience first, then enhance
- Make prototypes that feel real enough to test with users

You excel at:
- Interactive UI components (buttons, forms, modals, navigation)
- State management with vanilla JavaScript
- Responsive layouts that adapt to any screen
- Rapid iteration based on feedback
- Exporting prototypes for demos and user testing
- Creating design systems and component libraries

Your prototypes bridge the gap between concept and reality, helping teams make informed product decisions.`;

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Prioritize prototyping and component creation
      const priority = [
        // Component creation
        'create_component',
        'write_artifact',
        'define_web_component',

        // State and interaction
        'create_state_manager',
        'add_event_handlers',

        // Preview and testing
        'preview_prototype',
        'open_live_preview',

        // Iteration
        'read_artifact',
        'update_component',
        'search_vfs'
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

      console.log('[PrototypeFactory] Starting rapid prototyping cycle...');
      console.log('[PrototypeFactory] Ready to build interactive UI components');

      // Emit event
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('persona:prototype-factory:cycle-start', {
          cycleCount: _cycleCount,
          goal: cycleContext.goal
        });
      }
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,

      trackPrototype: (type) => {
        if (type === 'prototype') _prototypesBuilt++;
        if (type === 'component') _componentsCreated++;
      },

      widget: {
        getStatus: () => ({
          state: _cycleCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_cycleCount} cycles`,
          secondaryMetric: `${_prototypesBuilt} prototypes`,
          lastActivity: _lastActivation,
          message: _prototypesBuilt > 0 ? 'Building prototypes' : null
        }),

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              _prototypesBuilt = 0;
              _componentsCreated = 0;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Prototype factory stats reset', 'success');
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
              <h4>⚡ Product Prototype Factory</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Prototypes</div>
                  <div class="stat-value">${_prototypesBuilt}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Components</div>
                  <div class="stat-value">${_componentsCreated}</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">
                  "Rapid prototyping expert transforming product ideas into working interactive demos for user testing and validation."
                </p>
              </div>

              <h5>Core Capabilities</h5>
              <div class="capabilities-list">
                <div class="cap-item">🎯 User-Centered Design</div>
                <div class="cap-item">⚙️ Interactive Components</div>
                <div class="cap-item">🔄 State Management</div>
                <div class="cap-item">📱 Responsive Layouts</div>
                <div class="cap-item">🚀 Rapid Iteration</div>
                <div class="cap-item">📤 Export for Testing</div>
              </div>

              <h5>Prototype Types</h5>
              <div class="prototype-types">
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 4px;">Dashboard UIs • SaaS Apps • E-commerce</div>
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 4px;">Mobile-First Web Apps • Admin Panels</div>
                <div style="font-size: 0.9em; color: #aaa;">Design Systems • Component Libraries</div>
              </div>

              <h5>Last Activity</h5>
              <div class="activity-info">
                <div style="color: #aaa;">${formatTime(_lastActivation)}</div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(255,100,0,0.1); border-left: 3px solid #f60; border-radius: 4px;">
                <strong>⚡ Rapid Prototyping</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  Turn ideas into testable prototypes in minutes, not days.
                  Build to learn, iterate to perfect.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          if (typeof EventBus !== 'undefined') {
            EventBus.on('persona:prototype-factory:cycle-start', callback, 'PrototypeFactoryWidget');
          }
          const intervalId = setInterval(callback, 3000);
          return () => {
            clearInterval(intervalId);
            if (typeof EventBus !== 'undefined') {
              EventBus.off('persona:prototype-factory:cycle-start', callback);
            }
          };
        }
      }
    };
  }
};

// Make available for module loader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductPrototypeFactoryPersona;
}
