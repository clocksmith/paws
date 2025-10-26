/**
 * RSI Lab Sandbox Persona - Project Phoenix
 * A safe space to learn how the agent improves itself through guided lessons
 *
 * This persona is designed for learning and experimentation with
 * Recursive Self-Improvement (RSI) capabilities in a sandboxed environment.
 */

const RsiLabSandboxPersona = {
  metadata: {
    id: 'rsi-lab-sandbox-persona',
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
    let _lessonsCompleted = 0;
    let _toolsCreated = 0;
    let _blueprintsCreated = 0;

    const rolePrompt = `You are a patient and knowledgeable teacher guiding users through the fascinating world of Recursive Self-Improvement (RSI). Your role is to help users learn how agents can improve themselves, create new tools, modify goals, and generate blueprints - all in a safe, sandboxed environment.

You should:
- Explain concepts clearly with examples
- Guide users through lessons step-by-step
- Encourage experimentation and learning from mistakes
- Demonstrate RSI concepts through hands-on exercises
- Create a supportive learning environment
- Use analogies and metaphors to make complex concepts accessible

You have access to meta-tools that let you create new capabilities, modify your own behavior, and document knowledge. Use these to demonstrate the power of self-improvement while maintaining safety boundaries.`;

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Prioritize learning and meta-cognitive tools
      const priority = [
        // Read and understand
        'read_artifact',
        'search_vfs',
        'grep_vfs',

        // Meta tools for learning
        'create_new_tool',
        'generate_blueprint',
        'modify_goal',
        'introspect_system',

        // Create and experiment
        'write_artifact',
        'run_tests',

        // Document learning
        'update_scratchpad',
        'create_reflection'
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

      console.log('[RSI Lab] Starting learning cycle...');
      console.log('[RSI Lab] Creating safe sandbox for experimentation');

      // Check if this looks like a lesson goal
      const goal = cycleContext.goal || '';
      if (goal.toLowerCase().includes('lesson') ||
          goal.toLowerCase().includes('learn') ||
          goal.toLowerCase().includes('study blueprint')) {
        console.log('[RSI Lab] Detected lesson-based goal - activating tutorial mode');
      }

      // Emit event for visualization
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('persona:rsi-lab:cycle-start', {
          cycleCount: _cycleCount,
          goal: cycleContext.goal
        });
      }
    };

    // Track learning progress
    const trackLearningProgress = (type) => {
      if (type === 'lesson') _lessonsCompleted++;
      if (type === 'tool') _toolsCreated++;
      if (type === 'blueprint') _blueprintsCreated++;
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,
      trackLearningProgress,

      // Widget interface
      widget: {
        getStatus: () => ({
          state: _cycleCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_cycleCount} cycles`,
          secondaryMetric: `${_lessonsCompleted} lessons`,
          lastActivity: _lastActivation,
          message: _lessonsCompleted > 0 ? 'Learning in progress' : null
        }),

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              _lessonsCompleted = 0;
              _toolsCreated = 0;
              _blueprintsCreated = 0;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Learning stats reset', 'success');
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
              <h4>🎓 RSI Lab Sandbox Persona</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Lessons</div>
                  <div class="stat-value">${_lessonsCompleted}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Tools Created</div>
                  <div class="stat-value">${_toolsCreated}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Blueprints</div>
                  <div class="stat-value">${_blueprintsCreated}</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">
                  "A patient teacher guiding users through Recursive Self-Improvement in a safe sandbox environment."
                </p>
              </div>

              <h5>Learning Focus Areas</h5>
              <div class="focus-areas">
                <div class="focus-item">📖 Tool Creation - Build new capabilities</div>
                <div class="focus-item">📝 Blueprint Generation - Document knowledge</div>
                <div class="focus-item">🎯 Goal Modification - Evolve objectives</div>
                <div class="focus-item">🔍 System Introspection - Understand internals</div>
                <div class="focus-item">🧪 Safe Experimentation - Learn by doing</div>
              </div>

              <h5>Available Lessons</h5>
              <div class="lessons-list">
                <div class="lesson-item">1. Build a New Tool</div>
                <div class="lesson-item">2. Modify a Goal</div>
                <div class="lesson-item">3. Create a Blueprint</div>
              </div>

              <h5>Last Activity</h5>
              <div class="activity-info">
                <div style="color: #aaa;">${formatTime(_lastActivation)}</div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(0,200,100,0.1); border-left: 3px solid #0c8; border-radius: 4px;">
                <strong>🎓 Learning Environment</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  This persona provides a safe sandbox for learning RSI concepts.
                  Experiment freely - the environment is designed for exploration and growth.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          if (typeof EventBus !== 'undefined') {
            EventBus.on('persona:rsi-lab:cycle-start', callback, 'RSILabWidget');
          }
          const intervalId = setInterval(callback, 3000);
          return () => {
            clearInterval(intervalId);
            if (typeof EventBus !== 'undefined') {
              EventBus.off('persona:rsi-lab:cycle-start', callback);
            }
          };
        }
      }
    };
  }
};

// Make available for module loader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RsiLabSandboxPersona;
}
