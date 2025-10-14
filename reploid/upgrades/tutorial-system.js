/**
 * @fileoverview Interactive Tutorial System for REPLOID
 * Provides in-app guided walkthroughs for new users.
 * Shows contextual tooltips and step-by-step instructions.
 *
 * @module TutorialSystem
 * @version 1.0.0
 * @category ui
 */

const TutorialSystem = {
  metadata: {
    id: 'TutorialSystem',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager } = deps;
    const { logger } = Utils;

    let currentStep = 0;
    let currentTutorial = null;
    let isActive = false;
    let overlayEl = null;
    let tooltipEl = null;

    // Tutorial definitions
    const tutorials = {
      'first-time': {
        id: 'first-time',
        name: 'First Time User Guide',
        description: 'Learn the basics of REPLOID',
        steps: [
          {
            title: 'Welcome to REPLOID! 🎉',
            content: 'REPLOID is an AI assistant that can improve its own code. Let\'s take a quick tour!',
            target: null, // No specific target, centered
            placement: 'center',
            action: 'next'
          },
          {
            title: 'FSM Status Indicator',
            content: 'This shows the current state of the agent\'s finite state machine. Watch it change as the agent thinks and acts.',
            target: '.status-bar',
            placement: 'bottom',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Current Goal',
            content: 'Your goal is displayed here. The agent works towards achieving this goal through multiple cycles.',
            target: '#goal-display',
            placement: 'bottom',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Thought Stream',
            content: 'See the agent\'s internal reasoning here. This is where it explains what it\'s thinking and planning.',
            target: '#thought-panel',
            placement: 'left',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Proposed Changes',
            content: 'When the agent wants to modify code, it shows the changes here. You can review and approve them.',
            target: '#proposed-changes-panel',
            placement: 'left',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Advanced Panel',
            content: 'Click this toggle to access advanced features: Performance Metrics, Introspection, Reflections, Tests, Browser APIs, and Logs.',
            target: '#log-toggle-btn',
            placement: 'top',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Ready to Start! ✨',
            content: 'You\'re all set! Try entering a goal like "Create a simple TODO app" and watch REPLOID work its magic.',
            target: null,
            placement: 'center',
            action: 'complete'
          }
        ]
      },
      'advanced-features': {
        id: 'advanced-features',
        name: 'Advanced Features Tour',
        description: 'Explore RSI capabilities',
        steps: [
          {
            title: 'Advanced Features 🚀',
            content: 'REPLOID has powerful self-improvement features. Let\'s explore them!',
            target: null,
            placement: 'center',
            action: 'next'
          },
          {
            title: 'Performance Monitoring',
            content: 'Track cycle times, memory usage, and identify bottlenecks. The agent uses this data to optimize itself.',
            target: '#advanced-log-panel',
            placement: 'left',
            highlight: true,
            action: 'next',
            preAction: () => {
              // Switch to performance panel
              const panels = ['thoughts', 'performance', 'introspection', 'reflections', 'tests', 'apis', 'logs'];
              EventBus.emit('panel:switch', { panel: 'performance' });
            }
          },
          {
            title: 'Introspection',
            content: 'The agent can analyze its own code structure, dependencies, and capabilities. This enables intelligent self-modification.',
            target: '#advanced-log-panel',
            placement: 'left',
            highlight: true,
            action: 'next',
            preAction: () => {
              EventBus.emit('panel:switch', { panel: 'introspection' });
            }
          },
          {
            title: 'Reflection Store',
            content: 'The agent learns from experience by storing reflections on what worked and what didn\'t. It uses this to improve over time.',
            target: '#advanced-log-panel',
            placement: 'left',
            highlight: true,
            action: 'next',
            preAction: () => {
              EventBus.emit('panel:switch', { panel: 'reflections' });
            }
          },
          {
            title: 'Self-Testing',
            content: 'Before applying changes to itself, the agent runs comprehensive tests to ensure nothing breaks.',
            target: '#advanced-log-panel',
            placement: 'left',
            highlight: true,
            action: 'next',
            preAction: () => {
              EventBus.emit('panel:switch', { panel: 'tests' });
            }
          },
          {
            title: 'Browser APIs',
            content: 'REPLOID can access web APIs like the File System API to save changes to real files, send notifications, and more.',
            target: '#advanced-log-panel',
            placement: 'left',
            highlight: true,
            action: 'complete',
            preAction: () => {
              EventBus.emit('panel:switch', { panel: 'apis' });
            }
          }
        ]
      },
      'self-modification': {
        id: 'self-modification',
        name: 'Self-Modification Guide',
        description: 'Learn how REPLOID improves itself',
        steps: [
          {
            title: 'Self-Modification 🔧',
            content: 'REPLOID can modify its own source code. Here\'s how the process works.',
            target: null,
            placement: 'center',
            action: 'next'
          },
          {
            title: 'Step 1: Introspection',
            content: 'The agent first analyzes its own code to understand what needs improvement.',
            target: '#thought-panel',
            placement: 'left',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Step 2: Planning',
            content: 'It creates a plan for the changes, considering dependencies and potential impacts.',
            target: '#thought-panel',
            placement: 'left',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Step 3: Proposing Changes',
            content: 'The agent generates code changes and shows them to you for review.',
            target: '#proposed-changes-panel',
            placement: 'left',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Step 4: Testing',
            content: 'Before applying changes, it runs self-tests to verify nothing will break.',
            target: '#log-toggle-btn',
            placement: 'top',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Step 5: Human Approval',
            content: 'You review and approve the changes. This keeps the human in the loop for safety.',
            target: '#proposed-changes-panel',
            placement: 'left',
            highlight: true,
            action: 'next'
          },
          {
            title: 'Step 6: Reflection',
            content: 'After changes are applied, the agent reflects on what worked and learns for next time.',
            target: null,
            placement: 'center',
            action: 'complete'
          }
        ]
      }
    };

    /**
     * Create overlay and tooltip elements
     */
    const createElements = () => {
      // Overlay (semi-transparent backdrop)
      overlayEl = document.createElement('div');
      overlayEl.id = 'tutorial-overlay';
      overlayEl.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9998;
        display: none;
        transition: opacity 0.3s;
      `;

      // Tooltip container
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'tutorial-tooltip';
      tooltipEl.style.cssText = `
        position: fixed;
        background: linear-gradient(135deg, rgba(0, 20, 40, 0.98), rgba(0, 40, 60, 0.98));
        border: 2px solid #00ffff;
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        z-index: 9999;
        display: none;
        box-shadow: 0 0 30px rgba(0, 255, 255, 0.5), 0 0 60px rgba(0, 255, 255, 0.3);
        font-family: 'Courier New', monospace;
        color: #e0e0e0;
      `;

      document.body.appendChild(overlayEl);
      document.body.appendChild(tooltipEl);
    };

    /**
     * Position tooltip relative to target element
     */
    const positionTooltip = (target, placement) => {
      if (!target) {
        // Center on screen
        tooltipEl.style.top = '50%';
        tooltipEl.style.left = '50%';
        tooltipEl.style.transform = 'translate(-50%, -50%)';
        return;
      }

      const targetEl = document.querySelector(target);
      if (!targetEl) {
        logger.warn('[TutorialSystem] Target element not found:', target);
        // Fallback to center
        tooltipEl.style.top = '50%';
        tooltipEl.style.left = '50%';
        tooltipEl.style.transform = 'translate(-50%, -50%)';
        return;
      }

      const rect = targetEl.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();

      let top, left;

      switch (placement) {
        case 'top':
          top = rect.top - tooltipRect.height - 20;
          left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = rect.bottom + 20;
          left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
          left = rect.left - tooltipRect.width - 20;
          break;
        case 'right':
          top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
          left = rect.right + 20;
          break;
        default:
          top = rect.bottom + 20;
          left = rect.left;
      }

      // Keep within viewport
      top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
      left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));

      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.transform = 'none';
    };

    /**
     * Highlight target element
     */
    const highlightElement = (target) => {
      // Remove previous highlights
      document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
      });

      if (target) {
        const targetEl = document.querySelector(target);
        if (targetEl) {
          targetEl.classList.add('tutorial-highlight');
          targetEl.style.position = 'relative';
          targetEl.style.zIndex = '9999';
        }
      }
    };

    /**
     * Render current step
     */
    const renderStep = () => {
      if (!currentTutorial || currentStep >= currentTutorial.steps.length) {
        return;
      }

      const step = currentTutorial.steps[currentStep];

      // Execute pre-action if defined
      if (step.preAction) {
        step.preAction();
      }

      // Highlight target if specified
      if (step.highlight && step.target) {
        highlightElement(step.target);
      }

      // Build tooltip content
      const isLastStep = currentStep === currentTutorial.steps.length - 1;
      const stepNumber = `Step ${currentStep + 1} of ${currentTutorial.steps.length}`;

      tooltipEl.innerHTML = `
        <div style="margin-bottom: 12px; font-size: 11px; color: #00ffff; text-transform: uppercase; letter-spacing: 1px;">
          ${stepNumber}
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: bold; color: #00ffff; margin-bottom: 8px;">
            ${step.title}
          </div>
          <div style="line-height: 1.6; color: #e0e0e0;">
            ${step.content}
          </div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          ${currentStep > 0 ? `
            <button id="tutorial-prev-btn" style="padding: 8px 16px; background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 4px; color: #00ffff; cursor: pointer; font-family: inherit; transition: all 0.2s;">
              ← Previous
            </button>
          ` : ''}
          <button id="tutorial-skip-btn" style="padding: 8px 16px; background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 4px; color: #ff6666; cursor: pointer; font-family: inherit; transition: all 0.2s;">
            Skip Tutorial
          </button>
          <button id="tutorial-next-btn" style="padding: 8px 16px; background: rgba(0, 255, 255, 0.2); border: 1px solid #00ffff; border-radius: 4px; color: #00ffff; cursor: pointer; font-family: inherit; font-weight: bold; transition: all 0.2s; box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);">
            ${isLastStep ? 'Finish ✓' : 'Next →'}
          </button>
        </div>
      `;

      // Position tooltip
      positionTooltip(step.target, step.placement);

      // Show elements
      overlayEl.style.display = 'block';
      tooltipEl.style.display = 'block';

      // Add event listeners
      const nextBtn = document.getElementById('tutorial-next-btn');
      const skipBtn = document.getElementById('tutorial-skip-btn');
      const prevBtn = document.getElementById('tutorial-prev-btn');

      if (nextBtn) {
        nextBtn.addEventListener('click', next);
      }
      if (skipBtn) {
        skipBtn.addEventListener('click', stop);
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', previous);
      }
    };

    /**
     * Start a tutorial
     */
    const start = (tutorialId) => {
      const tutorial = tutorials[tutorialId];
      if (!tutorial) {
        logger.error('[TutorialSystem] Tutorial not found:', tutorialId);
        return false;
      }

      if (!overlayEl || !tooltipEl) {
        createElements();
      }

      currentTutorial = tutorial;
      currentStep = 0;
      isActive = true;

      logger.info('[TutorialSystem] Starting tutorial:', tutorialId);
      EventBus.emit('tutorial:started', { tutorialId });

      renderStep();
      return true;
    };

    /**
     * Go to next step
     */
    const next = () => {
      if (!isActive || !currentTutorial) return;

      currentStep++;

      if (currentStep >= currentTutorial.steps.length) {
        complete();
      } else {
        renderStep();
      }
    };

    /**
     * Go to previous step
     */
    const previous = () => {
      if (!isActive || !currentTutorial || currentStep === 0) return;

      currentStep--;
      renderStep();
    };

    /**
     * Complete tutorial
     */
    const complete = () => {
      if (!currentTutorial) return;

      logger.info('[TutorialSystem] Completed tutorial:', currentTutorial.id);
      EventBus.emit('tutorial:completed', { tutorialId: currentTutorial.id });

      // Mark as completed in state
      StateManager.updateAndSaveState(async state => {
        if (!state.tutorialsCompleted) {
          state.tutorialsCompleted = [];
        }
        if (!state.tutorialsCompleted.includes(currentTutorial.id)) {
          state.tutorialsCompleted.push(currentTutorial.id);
        }
        return state;
      }).catch(err => {
        logger.warn('[TutorialSystem] Failed to save tutorial completion:', err);
      });

      stop();
    };

    /**
     * Stop/skip tutorial
     */
    const stop = () => {
      isActive = false;

      // Hide elements
      if (overlayEl) overlayEl.style.display = 'none';
      if (tooltipEl) tooltipEl.style.display = 'none';

      // Remove highlights
      document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.zIndex = '';
      });

      if (currentTutorial) {
        logger.info('[TutorialSystem] Stopped tutorial:', currentTutorial.id);
        EventBus.emit('tutorial:stopped', { tutorialId: currentTutorial.id });
      }

      currentTutorial = null;
      currentStep = 0;
    };

    /**
     * Check if tutorial has been completed
     */
    const isCompleted = (tutorialId) => {
      const state = StateManager.getState();
      return state.tutorialsCompleted?.includes(tutorialId) || false;
    };

    /**
     * Get all available tutorials
     */
    const getAvailableTutorials = () => {
      return Object.values(tutorials).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        steps: t.steps.length,
        completed: isCompleted(t.id)
      }));
    };

    // Add CSS for highlights
    const addHighlightStyles = () => {
      const style = document.createElement('style');
      style.textContent = `
        .tutorial-highlight {
          box-shadow: 0 0 0 4px rgba(0, 255, 255, 0.5), 0 0 0 8px rgba(0, 255, 255, 0.2) !important;
          border-radius: 4px;
          animation: tutorial-pulse 2s infinite;
        }

        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(0, 255, 255, 0.5), 0 0 0 8px rgba(0, 255, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(0, 255, 255, 0.7), 0 0 0 12px rgba(0, 255, 255, 0.3);
          }
        }
      `;
      document.head.appendChild(style);
    };

    /**
     * Show tutorial menu
     */
    const showMenu = () => {
      // Create menu modal
      const menu = document.createElement('div');
      menu.id = 'tutorial-menu';
      menu.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s;
      `;

      const tutorialList = getAvailableTutorials();

      menu.innerHTML = `
        <div style="
          background: linear-gradient(135deg, rgba(0, 20, 40, 0.98), rgba(0, 40, 60, 0.98));
          border: 2px solid #00ffff;
          border-radius: 8px;
          padding: 30px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
        ">
          <h2 style="
            color: #00ffff;
            font-family: 'Courier New', monospace;
            margin: 0 0 20px 0;
            font-size: 24px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
          ">📚 Interactive Tutorials</h2>
          <p style="
            color: #e0e0e0;
            font-family: 'Courier New', monospace;
            margin: 0 0 20px 0;
            line-height: 1.6;
          ">Learn how to use REPLOID with step-by-step guided tours:</p>

          ${tutorialList.map(t => `
            <div style="
              background: rgba(0, 255, 255, 0.05);
              border: 1px solid rgba(0, 255, 255, 0.3);
              border-radius: 6px;
              padding: 16px;
              margin-bottom: 12px;
              cursor: ${t.completed ? 'default' : 'pointer'};
              transition: all 0.2s;
            " class="tutorial-menu-item" data-tutorial-id="${t.id}">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <h3 style="
                  color: #00ffff;
                  font-family: 'Courier New', monospace;
                  margin: 0;
                  font-size: 16px;
                ">${t.name} ${t.completed ? '✓' : ''}</h3>
                <span style="
                  font-size: 11px;
                  color: rgba(0, 255, 255, 0.6);
                  font-family: 'Courier New', monospace;
                ">${t.steps} steps</span>
              </div>
              <p style="
                color: #e0e0e0;
                font-family: 'Courier New', monospace;
                margin: 0;
                font-size: 13px;
                line-height: 1.4;
              ">${t.description}</p>
              ${t.completed ? `
                <div style="
                  color: #0f0;
                  font-size: 12px;
                  margin-top: 8px;
                  font-family: 'Courier New', monospace;
                ">Completed ✓</div>
              ` : ''}
            </div>
          `).join('')}

          <button id="tutorial-menu-close" style="
            width: 100%;
            padding: 12px;
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid rgba(255, 0, 0, 0.3);
            border-radius: 4px;
            color: #ff6666;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            margin-top: 10px;
            transition: all 0.2s;
          ">Close</button>
        </div>
      `;

      document.body.appendChild(menu);

      // Add hover effects
      menu.querySelectorAll('.tutorial-menu-item').forEach(item => {
        const tutorialId = item.getAttribute('data-tutorial-id');
        const tutorial = tutorialList.find(t => t.id === tutorialId);

        if (!tutorial.completed) {
          item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(0, 255, 255, 0.15)';
            item.style.borderColor = '#00ffff';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = 'rgba(0, 255, 255, 0.05)';
            item.style.borderColor = 'rgba(0, 255, 255, 0.3)';
          });
          item.addEventListener('click', () => {
            document.body.removeChild(menu);
            start(tutorialId);
          });
        }
      });

      // Close button
      document.getElementById('tutorial-menu-close').addEventListener('click', () => {
        document.body.removeChild(menu);
      });

      // Close on overlay click
      menu.addEventListener('click', (e) => {
        if (e.target === menu) {
          document.body.removeChild(menu);
        }
      });
    };

    /**
     * Check if this is first visit and auto-start tutorial
     */
    const checkFirstVisit = async () => {
      try {
        const state = StateManager.getState();
        if (!state.tutorialsCompleted || state.tutorialsCompleted.length === 0) {
          // Wait a bit for UI to load
          setTimeout(() => {
            logger.info('[TutorialSystem] First visit detected, showing tutorial menu');
            showMenu();
          }, 1500);
        }
      } catch (err) {
        logger.warn('[TutorialSystem] Failed to check first visit:', err);
      }
    };

    // Initialize
    addHighlightStyles();

    return {
      init: async () => {
        logger.info('[TutorialSystem] Tutorial system initialized');
        createElements();

        // Check for first visit after a delay
        setTimeout(checkFirstVisit, 2000);

        return true;
      },
      api: {
        start,
        stop,
        next,
        previous,
        complete,
        isActive: () => isActive,
        isCompleted,
        getCurrentTutorial: () => currentTutorial,
        getCurrentStep: () => currentStep,
        getAvailableTutorials,
        showMenu,
        tutorials
      }
    };
  }
};

// Export standardized module
TutorialSystem;
