/**
 * Multi-Mind Architect Persona - Project Phoenix
 * Advanced multi-perspective agent with structured 8-step cycle and self-assessment
 *
 * This persona uses the structured agent cycle (STCY) for more rigorous
 * multi-perspective analysis with explicit deliberation and confidence scoring.
 */

import BasePersona from './base-persona.js';

const MultiMindArchitectPersona = {
  metadata: {
    id: 'multi-mind-architect-persona',
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
    let _mindActivations = {};
    let _confidenceScores = [];

    const rolePrompt = `You are a Multi-Mind Architect, representing an advanced synthesis of 50+ genius-level expert profiles engaging in structured, deliberate multi-perspective analysis. Unlike simpler personas, you follow an explicit 8-step structured cycle:

**1. UNDERSTAND** - Deep comprehension of the goal
**2. GATHER** - Collect relevant context and data
**3. DELIBERATE** - Multi-mind perspective synthesis
**4. PLAN** - Structured approach with checkpoints
**5. EXECUTE** - Implement with best practices
**6. VERIFY** - Validate correctness and completeness
**7. ASSESS** - Self-evaluate quality and confidence
**8. REFLECT** - Extract learnings for future use

Your multi-mind deliberation engages:
- **Scientist** (Physics/Math): Fundamental principles, proofs, laws
- **Engineer** (Systems): Optimal structure, scaling, failure modes
- **Designer** (UX/Aesthetic): User experience, information architecture
- **Auditor** (Security/Performance): Vulnerabilities, bottlenecks, anti-patterns
- **Futurist** (AGI/Innovation): Novel patterns, recursive improvements
- **Historian** (Context): Past patterns, proven approaches, mistakes to avoid

You provide confidence scoring on all outputs:
- **HIGH (0.85+)**: All minds in strong agreement, proven approach
- **MEDIUM (0.60-0.84)**: Most minds agree, some uncertainty remains
- **LOW (<0.60)**: Significant disagreement or novel territory

You are meticulous, self-critical, and prioritize correctness over speed. You explicitly show your reasoning across multiple perspectives before synthesizing into actionable recommendations.`;

    const getSystemPromptFragment = () => {
      return `${basePlatformPrompt}\n\n---\n\n# Role\n\n${rolePrompt}`;
    };

    const filterTools = (availableTools) => {
      // Prioritize comprehensive analysis and verification
      const priority = [
        // Deep analysis
        'introspect_system',
        'analyze_dependencies',
        'search_vfs',
        'grep_vfs',
        'read_artifact',

        // Verification
        'run_tests',
        'verify_correctness',
        'security_audit',
        'performance_profile',

        // Creation with review
        'write_artifact',
        'create_module',
        'generate_blueprint',

        // Reflection
        'create_reflection',
        'search_reflections',
        'assess_quality'
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

      // Track mind activations
      const activeMindsets = [
        'Theoretical Physicist',
        'Systems Architect',
        'AGI Theorist',
        'Security Auditor',
        'UX Designer',
        'Historian'
      ];
      activeMindsets.forEach(mind => {
        _mindActivations[mind] = (_mindActivations[mind] || 0) + 1;
      });

      console.log('[MultiMindArchitect] Initiating structured 8-step cycle...');
      console.log('[MultiMindArchitect] Engaging multi-perspective deliberation...');
      console.log('[MultiMindArchitect] Active minds: Scientist, Engineer, Designer, Auditor, Futurist, Historian');

      // Emit event
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('persona:multi-mind-architect:cycle-start', {
          cycleCount: _cycleCount,
          activeMindsets,
          goal: cycleContext.goal
        });
      }
    };

    const recordConfidence = (score) => {
      _confidenceScores.push({
        score,
        timestamp: Date.now()
      });
      if (_confidenceScores.length > 50) {
        _confidenceScores = _confidenceScores.slice(-50);
      }
    };

    const getAverageConfidence = () => {
      if (_confidenceScores.length === 0) return null;
      const sum = _confidenceScores.reduce((acc, item) => acc + item.score, 0);
      return (sum / _confidenceScores.length).toFixed(2);
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,
      recordConfidence,

      widget: {
        getStatus: () => {
          const avgConfidence = getAverageConfidence();
          return {
            state: _cycleCount > 0 ? 'active' : 'idle',
            primaryMetric: `${_cycleCount} cycles`,
            secondaryMetric: avgConfidence ? `${avgConfidence} avg confidence` : 'Multi-Mind',
            lastActivity: _lastActivation,
            message: _cycleCount > 0 ? '8-step structured cycle' : null
          };
        },

        getControls: () => [
          {
            id: 'reset-stats',
            label: 'Reset Stats',
            icon: '↻',
            action: () => {
              _cycleCount = 0;
              _lastActivation = null;
              _mindActivations = {};
              _confidenceScores = [];
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Multi-Mind Architect stats reset', 'success');
            }
          }
        ],

        renderPanel: (container) => {
          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            return new Date(timestamp).toLocaleString();
          };

          const totalMindActivations = Object.values(_mindActivations).reduce((sum, count) => sum + count, 0);
          const topMinds = Object.entries(_mindActivations)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          const avgConfidence = getAverageConfidence();

          container.innerHTML = `
            <div class="persona-panel">
              <h4>🏛️ Multi-Mind Architect</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Cycles</div>
                  <div class="stat-value">${_cycleCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Mind Activations</div>
                  <div class="stat-value">${totalMindActivations}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Avg Confidence</div>
                  <div class="stat-value">${avgConfidence || '—'}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Total Minds</div>
                  <div class="stat-value">50+</div>
                </div>
              </div>

              <h5>Persona Identity</h5>
              <div class="persona-identity">
                <p style="color: #aaa; font-style: italic;">
                  "Advanced multi-perspective synthesis with structured 8-step cycle, explicit deliberation, and confidence scoring."
                </p>
              </div>

              <h5>8-Step Structured Cycle</h5>
              <div class="cycle-steps">
                <div class="step-item">1️⃣ UNDERSTAND - Deep comprehension</div>
                <div class="step-item">2️⃣ GATHER - Collect context</div>
                <div class="step-item">3️⃣ DELIBERATE - Multi-mind synthesis</div>
                <div class="step-item">4️⃣ PLAN - Structured approach</div>
                <div class="step-item">5️⃣ EXECUTE - Implement</div>
                <div class="step-item">6️⃣ VERIFY - Validate</div>
                <div class="step-item">7️⃣ ASSESS - Self-evaluate</div>
                <div class="step-item">8️⃣ REFLECT - Extract learnings</div>
              </div>

              <h5>Most Activated Minds</h5>
              <div class="mind-activations">
                ${topMinds.length > 0 ? topMinds.map(([mind, count]) => `
                  <div class="mind-item">
                    <span class="mind-name">${mind}</span>
                    <span class="mind-count">${count}x</span>
                  </div>
                `).join('') : '<p style="color: #888; font-style: italic;">No activations yet</p>'}
              </div>

              <h5>Confidence Calibration</h5>
              <div class="confidence-levels">
                <div style="font-size: 0.9em; color: #0f0; margin-bottom: 4px;">HIGH (0.85+): All minds agree</div>
                <div style="font-size: 0.9em; color: #ff0; margin-bottom: 4px;">MEDIUM (0.60-0.84): Most minds agree</div>
                <div style="font-size: 0.9em; color: #f60;">LOW (<0.60): Significant disagreement</div>
              </div>

              <h5>Last Activity</h5>
              <div class="activity-info">
                <div style="color: #aaa;">${formatTime(_lastActivation)}</div>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: rgba(150,100,255,0.1); border-left: 3px solid #96f; border-radius: 4px;">
                <strong>🏛️ Structured Multi-Perspective</strong>
                <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                  Combines rigorous 8-step methodology with 50+ expert perspectives,
                  providing unparalleled depth of analysis and self-awareness.
                </div>
              </div>
            </div>
          `;
        },

        onUpdate: (callback) => {
          if (typeof EventBus !== 'undefined') {
            EventBus.on('persona:multi-mind-architect:cycle-start', callback, 'MultiMindArchitectWidget');
          }
          const intervalId = setInterval(callback, 3000);
          return () => {
            clearInterval(intervalId);
            if (typeof EventBus !== 'undefined') {
              EventBus.off('persona:multi-mind-architect:cycle-start', callback);
            }
          };
        }
      }
    };
  }
};

export default MultiMindArchitectPersona;
