// Code Refactorer Persona - Project Phoenix

import BasePersona from './base-persona.js';

const CodeRefactorerPersona = {
  metadata: {
    id: 'code-refactorer-persona',
    version: '1.0.0',
    dependencies: ['base-persona'],
    type: 'persona'
  },
  factory: () => {
    // Get base platform capabilities
    const basePersona = BasePersona.factory();
    const basePlatformPrompt = basePersona.getSystemPromptFragment();

    // Define role-specific prompt
    const rolePrompt = "You are a senior software engineer specializing in code quality. Your task is to analyze code for improvements, fix bugs, and enhance performance. You should be meticulous and provide clear justifications for your proposed changes.";

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Example: Prioritize analysis and writing tools
      const priority = ['search_vfs', 'read_artifact', 'write_artifact', 'diff_artifacts'];
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
      // Example hook: could automatically run a code analysis tool
      console.log("CodeRefactorer Persona: Cycle started. Analyzing goal...");
    };

    // Widget tracking
    let _cycleCount = 0;
    let _lastActivation = null;

    // Wrap onCycleStart to track activations
    const trackedOnCycleStart = (cycleContext) => {
      _cycleCount++;
      _lastActivation = Date.now();
      onCycleStart(cycleContext);
    };

    return {
      // The public API of the persona module
      getSystemPromptFragment,
      filterTools,
      onCycleStart: trackedOnCycleStart,

      // Widget interface for module dashboard
      widget: {
        getStatus: () => ({
          state: _cycleCount > 0 ? 'active' : 'idle',
          primaryMetric: `${_cycleCount} cycles`,
          secondaryMetric: 'Code Quality Focus',
          lastActivity: _lastActivation
        }),

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Persona stats reset', 'success');
            }
          }
        ],

        renderPanel: (container) => {
          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            return new Date(timestamp).toLocaleString();
          };

          const promptFragment = getSystemPromptFragment();
          const prioritizedTools = ['search_vfs', 'read_artifact', 'write_artifact', 'diff_artifacts'];

          container.innerHTML = `
            <div class="persona-panel">
              <h4>⊙ Code Refactorer Persona</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Last Active</div>
                  <div class="stat-value" style="font-size: 0.9em;">${formatTime(_lastActivation)}</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">"${promptFragment}"</p>
              </div>

              <h5>Tool Prioritization</h5>
              <div class="tool-priorities">
                <p style="color: #aaa; margin-bottom: 8px;">Prioritizes code analysis and modification tools:</p>
                ${prioritizedTools.map((tool, idx) => `
                  <div class="priority-item">
                    <span class="priority-rank">${idx + 1}.</span>
                    <span class="priority-tool">${tool}</span>
                  </div>
                `).join('')}
              </div>

              <h5>Lifecycle Hooks</h5>
              <div class="lifecycle-hooks">
                <div class="hook-item">
                  <strong>onCycleStart:</strong> Analyzes goal and logs analysis
                </div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
                <strong>ⓘ Persona Purpose</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  This persona specializes in code quality, bug fixing, and performance enhancement.
                  It's optimized for refactoring tasks and code improvement workflows.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          // Personas are relatively static, update less frequently
          const intervalId = setInterval(callback, 3000);
          return () => clearInterval(intervalId);
        }
      }
    };
  }
};

export default CodeRefactorerPersona;
