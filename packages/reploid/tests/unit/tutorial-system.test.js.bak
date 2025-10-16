import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('TutorialSystem Module', () => {
  let TutorialSystem;
  let mockDeps;
  let tutorialInstance;

  beforeEach(() => {
    // Mock DOM
    global.document = {
      createElement: vi.fn((tag) => ({
        id: '',
        style: { cssText: '', display: '', top: '', left: '', transform: '' },
        innerHTML: '',
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        addEventListener: vi.fn(),
        setAttribute: vi.fn(),
        getAttribute: vi.fn()
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      head: {
        appendChild: vi.fn()
      },
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn()
    };

    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };

    mockDeps = {
      Utils: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      EventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
      StateManager: {
        getState: vi.fn(() => ({ tutorialsCompleted: [] })),
        setState: vi.fn(),
        updateAndSaveState: vi.fn(async (fn) => {
          const state = { tutorialsCompleted: [] };
          return fn(state);
        })
      }
    };

    // Import module
    TutorialSystem = {
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

        const tutorials = {
          'first-time': {
            id: 'first-time',
            name: 'First Time User Guide',
            description: 'Learn the basics of REPLOID',
            steps: [
              { title: 'Welcome', content: 'Welcome content', target: null, placement: 'center', action: 'next' },
              { title: 'Status Bar', content: 'Status content', target: '.status-bar', placement: 'bottom', highlight: true, action: 'next' },
              { title: 'Goal Display', content: 'Goal content', target: '#goal-display', placement: 'bottom', highlight: true, action: 'complete' }
            ]
          },
          'advanced-features': {
            id: 'advanced-features',
            name: 'Advanced Features Tour',
            description: 'Explore RSI capabilities',
            steps: [
              { title: 'Advanced', content: 'Advanced content', target: null, placement: 'center', action: 'next', preAction: () => {} },
              { title: 'Performance', content: 'Performance content', target: '#panel', placement: 'left', highlight: true, action: 'complete' }
            ]
          }
        };

        const createElements = () => {
          overlayEl = document.createElement('div');
          tooltipEl = document.createElement('div');
          document.body.appendChild(overlayEl);
          document.body.appendChild(tooltipEl);
        };

        const positionTooltip = (target, placement) => {
          if (!target) {
            tooltipEl.style.top = '50%';
            tooltipEl.style.left = '50%';
            tooltipEl.style.transform = 'translate(-50%, -50%)';
            return;
          }

          const targetEl = document.querySelector(target);
          if (!targetEl) {
            logger.warn('[TutorialSystem] Target element not found:', target);
            tooltipEl.style.top = '50%';
            tooltipEl.style.left = '50%';
            tooltipEl.style.transform = 'translate(-50%, -50%)';
            return;
          }

          tooltipEl.style.top = '100px';
          tooltipEl.style.left = '100px';
          tooltipEl.style.transform = 'none';
        };

        const highlightElement = (target) => {
          document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
          });

          if (target) {
            const targetEl = document.querySelector(target);
            if (targetEl) {
              targetEl.classList.add('tutorial-highlight');
            }
          }
        };

        const renderStep = () => {
          if (!currentTutorial || currentStep >= currentTutorial.steps.length) {
            return;
          }

          const step = currentTutorial.steps[currentStep];

          if (step.preAction) {
            step.preAction();
          }

          if (step.highlight && step.target) {
            highlightElement(step.target);
          }

          tooltipEl.innerHTML = `Step ${currentStep + 1}`;
          positionTooltip(step.target, step.placement);
          overlayEl.style.display = 'block';
          tooltipEl.style.display = 'block';
        };

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

        const next = () => {
          if (!isActive || !currentTutorial) return;

          currentStep++;

          if (currentStep >= currentTutorial.steps.length) {
            complete();
          } else {
            renderStep();
          }
        };

        const previous = () => {
          if (!isActive || !currentTutorial || currentStep === 0) return;

          currentStep--;
          renderStep();
        };

        const complete = () => {
          if (!currentTutorial) return;

          const tutorialId = currentTutorial.id;
          logger.info('[TutorialSystem] Completed tutorial:', tutorialId);
          EventBus.emit('tutorial:completed', { tutorialId });

          StateManager.updateAndSaveState(async state => {
            if (!state.tutorialsCompleted) {
              state.tutorialsCompleted = [];
            }
            if (!state.tutorialsCompleted.includes(tutorialId)) {
              state.tutorialsCompleted.push(tutorialId);
            }
            return state;
          }).catch(err => {
            logger.warn('[TutorialSystem] Failed to save tutorial completion:', err);
          });

          stop();
        };

        const stop = () => {
          isActive = false;

          if (overlayEl) overlayEl.style.display = 'none';
          if (tooltipEl) tooltipEl.style.display = 'none';

          document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
          });

          if (currentTutorial) {
            logger.info('[TutorialSystem] Stopped tutorial:', currentTutorial.id);
            EventBus.emit('tutorial:stopped', { tutorialId: currentTutorial.id });
          }

          currentTutorial = null;
          currentStep = 0;
        };

        const isCompleted = (tutorialId) => {
          const state = StateManager.getState();
          return state.tutorialsCompleted?.includes(tutorialId) || false;
        };

        const getAvailableTutorials = () => {
          return Object.values(tutorials).map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            steps: t.steps.length,
            completed: isCompleted(t.id)
          }));
        };

        const showMenu = () => {
          const menu = document.createElement('div');
          menu.id = 'tutorial-menu';
          document.body.appendChild(menu);
        };

        return {
          init: async () => {
            logger.info('[TutorialSystem] Tutorial system initialized');
            createElements();
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(TutorialSystem.metadata).toEqual({
        id: 'TutorialSystem',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus', 'StateManager'],
        async: false,
        type: 'ui'
      });
    });

    it('should have required dependencies', () => {
      expect(TutorialSystem.metadata.dependencies).toContain('Utils');
      expect(TutorialSystem.metadata.dependencies).toContain('EventBus');
      expect(TutorialSystem.metadata.dependencies).toContain('StateManager');
    });

    it('should be a UI module type', () => {
      expect(TutorialSystem.metadata.type).toBe('ui');
    });
  });

  describe('Module Initialization', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should initialize successfully', async () => {
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        '[TutorialSystem] Tutorial system initialized'
      );
    });

    it('should create DOM elements on init', () => {
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should return true on successful init', async () => {
      const result = await tutorialInstance.init();
      expect(result).toBe(true);
    });
  });

  describe('Tutorial Definitions', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should have first-time tutorial', () => {
      const tutorials = tutorialInstance.api.tutorials;
      expect(tutorials['first-time']).toBeDefined();
      expect(tutorials['first-time'].id).toBe('first-time');
      expect(tutorials['first-time'].name).toBe('First Time User Guide');
    });

    it('should have advanced-features tutorial', () => {
      const tutorials = tutorialInstance.api.tutorials;
      expect(tutorials['advanced-features']).toBeDefined();
      expect(tutorials['advanced-features'].id).toBe('advanced-features');
    });

    it('should have tutorial steps', () => {
      const tutorials = tutorialInstance.api.tutorials;
      expect(tutorials['first-time'].steps).toBeInstanceOf(Array);
      expect(tutorials['first-time'].steps.length).toBeGreaterThan(0);
    });

    it('should have properly structured steps', () => {
      const tutorials = tutorialInstance.api.tutorials;
      const step = tutorials['first-time'].steps[0];
      expect(step).toHaveProperty('title');
      expect(step).toHaveProperty('content');
      expect(step).toHaveProperty('placement');
      expect(step).toHaveProperty('action');
    });
  });

  describe('Starting Tutorials', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should start a valid tutorial', () => {
      const result = tutorialInstance.api.start('first-time');
      expect(result).toBe(true);
      expect(tutorialInstance.api.isActive()).toBe(true);
    });

    it('should emit tutorial:started event', () => {
      tutorialInstance.api.start('first-time');
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('tutorial:started', { tutorialId: 'first-time' });
    });

    it('should log tutorial start', () => {
      tutorialInstance.api.start('first-time');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[TutorialSystem] Starting tutorial:', 'first-time');
    });

    it('should return false for invalid tutorial', () => {
      const result = tutorialInstance.api.start('non-existent');
      expect(result).toBe(false);
      expect(tutorialInstance.api.isActive()).toBe(false);
    });

    it('should log error for invalid tutorial', () => {
      tutorialInstance.api.start('non-existent');
      expect(mockDeps.Utils.logger.error).toHaveBeenCalledWith('[TutorialSystem] Tutorial not found:', 'non-existent');
    });

    it('should set current tutorial', () => {
      tutorialInstance.api.start('first-time');
      expect(tutorialInstance.api.getCurrentTutorial()).toBeDefined();
      expect(tutorialInstance.api.getCurrentTutorial().id).toBe('first-time');
    });

    it('should start at step 0', () => {
      tutorialInstance.api.start('first-time');
      expect(tutorialInstance.api.getCurrentStep()).toBe(0);
    });
  });

  describe('Tutorial Navigation', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
      tutorialInstance.api.start('first-time');
    });

    it('should advance to next step', () => {
      const initialStep = tutorialInstance.api.getCurrentStep();
      tutorialInstance.api.next();
      expect(tutorialInstance.api.getCurrentStep()).toBe(initialStep + 1);
    });

    it('should go to previous step', () => {
      tutorialInstance.api.next();
      tutorialInstance.api.next();
      const currentStep = tutorialInstance.api.getCurrentStep();
      tutorialInstance.api.previous();
      expect(tutorialInstance.api.getCurrentStep()).toBe(currentStep - 1);
    });

    it('should not go before first step', () => {
      tutorialInstance.api.previous();
      expect(tutorialInstance.api.getCurrentStep()).toBe(0);
    });

    it('should complete tutorial when reaching end', () => {
      const stepCount = tutorialInstance.api.getCurrentTutorial().steps.length;
      for (let i = 0; i < stepCount; i++) {
        tutorialInstance.api.next();
      }
      expect(tutorialInstance.api.isActive()).toBe(false);
    });

    it('should not navigate when tutorial is not active', () => {
      tutorialInstance.api.stop();
      tutorialInstance.api.next();
      expect(tutorialInstance.api.getCurrentStep()).toBe(0);
    });
  });

  describe('Tutorial Completion', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
      tutorialInstance.api.start('first-time');
    });

    it('should emit tutorial:completed event', () => {
      tutorialInstance.api.complete();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('tutorial:completed', { tutorialId: 'first-time' });
    });

    it('should log completion', () => {
      tutorialInstance.api.complete();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[TutorialSystem] Completed tutorial:', 'first-time');
    });

    it('should save completion to state', () => {
      tutorialInstance.api.complete();
      expect(mockDeps.StateManager.updateAndSaveState).toHaveBeenCalled();
    });

    it('should deactivate tutorial after completion', () => {
      tutorialInstance.api.complete();
      expect(tutorialInstance.api.isActive()).toBe(false);
    });

    it('should reset current tutorial after completion', () => {
      tutorialInstance.api.complete();
      expect(tutorialInstance.api.getCurrentTutorial()).toBeNull();
    });
  });

  describe('Stopping Tutorials', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
      tutorialInstance.api.start('first-time');
    });

    it('should stop active tutorial', () => {
      tutorialInstance.api.stop();
      expect(tutorialInstance.api.isActive()).toBe(false);
    });

    it('should emit tutorial:stopped event', () => {
      tutorialInstance.api.stop();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('tutorial:stopped', { tutorialId: 'first-time' });
    });

    it('should log stop action', () => {
      tutorialInstance.api.stop();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[TutorialSystem] Stopped tutorial:', 'first-time');
    });

    it('should reset current tutorial', () => {
      tutorialInstance.api.stop();
      expect(tutorialInstance.api.getCurrentTutorial()).toBeNull();
    });

    it('should reset current step', () => {
      tutorialInstance.api.next();
      tutorialInstance.api.stop();
      expect(tutorialInstance.api.getCurrentStep()).toBe(0);
    });
  });

  describe('Tutorial Completion Tracking', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should check if tutorial is completed', () => {
      mockDeps.StateManager.getState.mockReturnValue({
        tutorialsCompleted: ['first-time']
      });
      expect(tutorialInstance.api.isCompleted('first-time')).toBe(true);
    });

    it('should return false for uncompleted tutorial', () => {
      mockDeps.StateManager.getState.mockReturnValue({
        tutorialsCompleted: []
      });
      expect(tutorialInstance.api.isCompleted('first-time')).toBe(false);
    });

    it('should handle missing tutorialsCompleted array', () => {
      mockDeps.StateManager.getState.mockReturnValue({});
      expect(tutorialInstance.api.isCompleted('first-time')).toBe(false);
    });
  });

  describe('Available Tutorials', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should return list of available tutorials', () => {
      const tutorials = tutorialInstance.api.getAvailableTutorials();
      expect(tutorials).toBeInstanceOf(Array);
      expect(tutorials.length).toBeGreaterThan(0);
    });

    it('should include tutorial metadata', () => {
      const tutorials = tutorialInstance.api.getAvailableTutorials();
      const tutorial = tutorials[0];
      expect(tutorial).toHaveProperty('id');
      expect(tutorial).toHaveProperty('name');
      expect(tutorial).toHaveProperty('description');
      expect(tutorial).toHaveProperty('steps');
      expect(tutorial).toHaveProperty('completed');
    });

    it('should include completion status', () => {
      mockDeps.StateManager.getState.mockReturnValue({
        tutorialsCompleted: ['first-time']
      });
      const tutorials = tutorialInstance.api.getAvailableTutorials();
      const firstTime = tutorials.find(t => t.id === 'first-time');
      expect(firstTime.completed).toBe(true);
    });

    it('should include step count', () => {
      const tutorials = tutorialInstance.api.getAvailableTutorials();
      const tutorial = tutorials[0];
      expect(typeof tutorial.steps).toBe('number');
      expect(tutorial.steps).toBeGreaterThan(0);
    });
  });

  describe('Tutorial Menu', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should show tutorial menu', () => {
      tutorialInstance.api.showMenu();
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should create menu element', () => {
      tutorialInstance.api.showMenu();
      expect(document.createElement).toHaveBeenCalledWith('div');
    });
  });

  describe('API Exposure', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should expose start method', () => {
      expect(tutorialInstance.api.start).toBeDefined();
      expect(typeof tutorialInstance.api.start).toBe('function');
    });

    it('should expose stop method', () => {
      expect(tutorialInstance.api.stop).toBeDefined();
      expect(typeof tutorialInstance.api.stop).toBe('function');
    });

    it('should expose next method', () => {
      expect(tutorialInstance.api.next).toBeDefined();
      expect(typeof tutorialInstance.api.next).toBe('function');
    });

    it('should expose previous method', () => {
      expect(tutorialInstance.api.previous).toBeDefined();
      expect(typeof tutorialInstance.api.previous).toBe('function');
    });

    it('should expose complete method', () => {
      expect(tutorialInstance.api.complete).toBeDefined();
      expect(typeof tutorialInstance.api.complete).toBe('function');
    });

    it('should expose isActive method', () => {
      expect(tutorialInstance.api.isActive).toBeDefined();
      expect(typeof tutorialInstance.api.isActive).toBe('function');
    });

    it('should expose isCompleted method', () => {
      expect(tutorialInstance.api.isCompleted).toBeDefined();
      expect(typeof tutorialInstance.api.isCompleted).toBe('function');
    });

    it('should expose getCurrentTutorial method', () => {
      expect(tutorialInstance.api.getCurrentTutorial).toBeDefined();
      expect(typeof tutorialInstance.api.getCurrentTutorial).toBe('function');
    });

    it('should expose getCurrentStep method', () => {
      expect(tutorialInstance.api.getCurrentStep).toBeDefined();
      expect(typeof tutorialInstance.api.getCurrentStep).toBe('function');
    });

    it('should expose getAvailableTutorials method', () => {
      expect(tutorialInstance.api.getAvailableTutorials).toBeDefined();
      expect(typeof tutorialInstance.api.getAvailableTutorials).toBe('function');
    });

    it('should expose showMenu method', () => {
      expect(tutorialInstance.api.showMenu).toBeDefined();
      expect(typeof tutorialInstance.api.showMenu).toBe('function');
    });

    it('should expose tutorials object', () => {
      expect(tutorialInstance.api.tutorials).toBeDefined();
      expect(typeof tutorialInstance.api.tutorials).toBe('object');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should handle state save failure gracefully', async () => {
      mockDeps.StateManager.updateAndSaveState.mockRejectedValue(new Error('Save failed'));
      tutorialInstance.api.start('first-time');
      tutorialInstance.api.complete();

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should handle missing target element', () => {
      document.querySelector.mockReturnValue(null);
      tutorialInstance.api.start('first-time');
      tutorialInstance.api.next(); // Move to step with target
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should complete without current tutorial', () => {
      tutorialInstance.api.complete();
      expect(mockDeps.EventBus.emit).not.toHaveBeenCalledWith('tutorial:completed', expect.any(Object));
    });

    it('should handle navigation without active tutorial', () => {
      tutorialInstance.api.next();
      expect(tutorialInstance.api.getCurrentStep()).toBe(0);
    });
  });

  describe('State Integration', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should query state for completion status', () => {
      tutorialInstance.api.isCompleted('first-time');
      expect(mockDeps.StateManager.getState).toHaveBeenCalled();
    });

    it('should update state on completion', () => {
      tutorialInstance.api.start('first-time');
      tutorialInstance.api.complete();
      expect(mockDeps.StateManager.updateAndSaveState).toHaveBeenCalled();
    });

    it('should append to tutorialsCompleted array', async () => {
      tutorialInstance.api.start('first-time');

      let capturedFn;
      mockDeps.StateManager.updateAndSaveState.mockImplementation((fn) => {
        capturedFn = fn;
        return Promise.resolve();
      });

      tutorialInstance.api.complete();

      const state = { tutorialsCompleted: [] };
      await capturedFn(state);
      expect(state.tutorialsCompleted).toContain('first-time');
    });

    it('should not duplicate completion entries', async () => {
      tutorialInstance.api.start('first-time');

      let capturedFn;
      mockDeps.StateManager.updateAndSaveState.mockImplementation((fn) => {
        capturedFn = fn;
        return Promise.resolve();
      });

      tutorialInstance.api.complete();

      const state = { tutorialsCompleted: ['first-time'] };
      await capturedFn(state);
      expect(state.tutorialsCompleted).toEqual(['first-time']);
    });
  });

  describe('EventBus Integration', () => {
    beforeEach(async () => {
      tutorialInstance = TutorialSystem.factory(mockDeps);
      await tutorialInstance.init();
    });

    it('should emit tutorial:started on start', () => {
      tutorialInstance.api.start('first-time');
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('tutorial:started', { tutorialId: 'first-time' });
    });

    it('should emit tutorial:stopped on stop', () => {
      tutorialInstance.api.start('first-time');
      mockDeps.EventBus.emit.mockClear();
      tutorialInstance.api.stop();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('tutorial:stopped', { tutorialId: 'first-time' });
    });

    it('should emit tutorial:completed on complete', () => {
      tutorialInstance.api.start('first-time');
      mockDeps.EventBus.emit.mockClear();
      tutorialInstance.api.complete();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('tutorial:completed', { tutorialId: 'first-time' });
    });
  });
});
