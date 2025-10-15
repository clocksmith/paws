import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutonomousOrchestrator from '../../upgrades/autonomous-orchestrator.js';

describe('AutonomousOrchestrator Module', () => {
  let mockConfig, mockUtils, mockStateManager, mockEventBus, mockStorage, mockDeps;
  let orchestrator;
  let eventHandlers;

  beforeEach(() => {
    vi.useFakeTimers();

    // Track event handlers
    eventHandlers = {};

    // Mock Utils
    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    };

    // Mock StateManager
    mockStateManager = {
      writeArtifact: vi.fn().mockResolvedValue(true)
    };

    // Mock EventBus
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      })
    };

    // Mock Storage
    mockStorage = {
      getArtifactContent: vi.fn(),
      setArtifactContent: vi.fn()
    };

    mockConfig = {};

    mockDeps = {
      config: mockConfig,
      Utils: mockUtils,
      StateManager: mockStateManager,
      EventBus: mockEventBus,
      Storage: mockStorage
    };

    orchestrator = AutonomousOrchestrator.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(AutonomousOrchestrator.metadata.id).toBe('AutonomousOrchestrator');
      expect(AutonomousOrchestrator.metadata.version).toBe('1.0.0');
      expect(AutonomousOrchestrator.metadata.type).toBe('service');
    });

    it('should declare required dependencies', () => {
      expect(AutonomousOrchestrator.metadata.dependencies).toContain('Utils');
      expect(AutonomousOrchestrator.metadata.dependencies).toContain('StateManager');
      expect(AutonomousOrchestrator.metadata.dependencies).toContain('EventBus');
    });

    it('should be synchronous', () => {
      expect(AutonomousOrchestrator.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should start with not running status', () => {
      expect(orchestrator.api.isRunning()).toBe(false);
    });

    it('should register event handlers', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('agent:state:change', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('agent:error', expect.any(Function));
    });

    it('should return default config', () => {
      const config = orchestrator.api.getConfig();

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('autoApproveContext');
      expect(config).toHaveProperty('autoApproveProposal');
      expect(config).toHaveProperty('maxProposalsPerGoal');
      expect(config).toHaveProperty('iterationDelay');
      expect(config).toHaveProperty('goals');
    });
  });

  describe('Starting Curator Mode', () => {
    it('should start curator mode successfully', async () => {
      const result = await orchestrator.api.startCuratorMode();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Curator mode started');
      expect(result.sessionId).toMatch(/^curator-\d+$/);
      expect(orchestrator.api.isRunning()).toBe(true);
    });

    it('should use custom goals when provided', async () => {
      const customGoals = ['Goal A', 'Goal B'];
      await orchestrator.api.startCuratorMode(customGoals);

      const config = orchestrator.api.getConfig();
      expect(config.goals).toEqual(customGoals);
    });

    it('should emit curator:started event', async () => {
      await orchestrator.api.startCuratorMode();

      expect(mockEventBus.emit).toHaveBeenCalledWith('curator:started', {
        goals: expect.any(Array),
        maxProposalsPerGoal: expect.any(Number),
        startTime: expect.any(Number)
      });
    });

    it('should emit goal:set event for first goal', async () => {
      await orchestrator.api.startCuratorMode(['Test goal 1', 'Test goal 2']);

      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:set', 'Test goal 1');
    });

    it('should reject if already running', async () => {
      await orchestrator.api.startCuratorMode();
      const result = await orchestrator.api.startCuratorMode();

      expect(result.success).toBe(false);
      expect(result.message).toContain('already running');
    });

    it('should initialize session history', async () => {
      await orchestrator.api.startCuratorMode();

      const status = orchestrator.api.getCurrentStatus();
      expect(status.iteration).toBeGreaterThan(0);
    });
  });

  describe('Stopping Curator Mode', () => {
    it('should stop curator mode successfully', async () => {
      await orchestrator.api.startCuratorMode();
      const result = orchestrator.api.stopCuratorMode();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('totalProposals');
      expect(result).toHaveProperty('report');
      expect(orchestrator.api.isRunning()).toBe(false);
    });

    it('should fail to stop when not running', () => {
      const result = orchestrator.api.stopCuratorMode();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not running');
    });

    it('should emit curator:stopped event', async () => {
      await orchestrator.api.startCuratorMode();
      orchestrator.api.stopCuratorMode();

      expect(mockEventBus.emit).toHaveBeenCalledWith('curator:stopped', {
        report: expect.any(Object)
      });
    });

    it('should generate and save report', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);
      orchestrator.api.stopCuratorMode();

      // Wait for async report saving
      await vi.runAllTimersAsync();

      const calls = mockStateManager.writeArtifact.mock.calls;
      expect(calls.some(call => call[0].endsWith('.json'))).toBe(true);
      expect(calls.some(call => call[0].endsWith('.html'))).toBe(true);
    });
  });

  describe('Iteration Management', () => {
    it('should emit iteration start event', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      expect(mockEventBus.emit).toHaveBeenCalledWith('curator:iteration:start', {
        id: expect.any(Number),
        goalIndex: expect.any(Number),
        goal: expect.any(String),
        proposalNumber: expect.any(Number),
        startTime: expect.any(Number),
        status: 'running'
      });
    });

    it('should track iteration status', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      const status = orchestrator.api.getCurrentStatus();
      expect(status.running).toBe(true);
      expect(status.iteration).toBe(1);
      expect(status.goalIndex).toBe(0);
      expect(status.proposalsForCurrentGoal).toBe(0);
    });

    it('should handle proposal generated event', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      // Simulate proposal approval state change
      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({
        newState: 'AWAITING_PROPOSAL_APPROVAL',
        context: { turn: { dogs_path: '/proposals/test.dogs' } }
      });

      // Should schedule next iteration
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Proposal 1 generated')
      );
    });

    it('should progress to next goal after max proposals', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1', 'Goal 2']);

      const stateChangeHandler = eventHandlers['agent:state:change'];

      // Generate max proposals (7 by default) for goal 1
      for (let i = 0; i < 7; i++) {
        stateChangeHandler({
          newState: 'AWAITING_PROPOSAL_APPROVAL',
          context: {}
        });
        await vi.advanceTimersByTimeAsync(5000);
      }

      const status = orchestrator.api.getCurrentStatus();
      expect(status.goalIndex).toBe(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:set', 'Goal 2');
    });

    it('should stop after completing all goals', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1']);

      const stateChangeHandler = eventHandlers['agent:state:change'];

      // Complete max proposals for the only goal
      for (let i = 0; i < 7; i++) {
        stateChangeHandler({
          newState: 'AWAITING_PROPOSAL_APPROVAL',
          context: {}
        });
        await vi.advanceTimersByTimeAsync(5000);
      }

      // After completing all goals, should stop
      expect(orchestrator.api.isRunning()).toBe(false);
      expect(mockEventBus.emit).toHaveBeenCalledWith('curator:stopped', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle cycle errors', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      const errorHandler = eventHandlers['agent:error'];
      errorHandler({ message: 'Test error' });

      // Should schedule next iteration
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        '[Curator] Cycle error:',
        expect.any(Object)
      );
    });

    it('should mark iteration as error on failure', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      const errorHandler = eventHandlers['agent:error'];
      errorHandler({ message: 'Test error' });

      orchestrator.api.stopCuratorMode();
      const status = orchestrator.api.getCurrentStatus();

      expect(status.totalProposals).toBe(0);
    });

    it('should continue to next iteration after error', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1', 'Goal 2']);

      const errorHandler = eventHandlers['agent:error'];
      errorHandler({ message: 'Test error' });

      // Should schedule next iteration
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:set', expect.any(String));
    });
  });

  describe('Report Generation', () => {
    it('should generate complete report', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({
        newState: 'AWAITING_PROPOSAL_APPROVAL',
        context: {}
      });

      const result = orchestrator.api.stopCuratorMode();

      expect(result.report).toHaveProperty('sessionId');
      expect(result.report).toHaveProperty('startTime');
      expect(result.report).toHaveProperty('endTime');
      expect(result.report).toHaveProperty('totalDuration');
      expect(result.report).toHaveProperty('totalIterations');
      expect(result.report).toHaveProperty('totalProposals');
      expect(result.report).toHaveProperty('goals');
      expect(result.report).toHaveProperty('iterations');
      expect(result.report).toHaveProperty('averageDuration');
    });

    it('should include goal statistics', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1', 'Goal 2']);

      const stateChangeHandler = eventHandlers['agent:state:change'];

      // Generate 2 proposals for goal 1
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });
      await vi.advanceTimersByTimeAsync(5000);
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });
      await vi.advanceTimersByTimeAsync(5000);

      const result = orchestrator.api.stopCuratorMode();

      expect(result.report.goals).toHaveLength(2);
      expect(result.report.goals[0].goal).toBe('Goal 1');
      expect(result.report.goals[0].proposals).toBe(2);
    });

    it('should generate HTML report', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);
      orchestrator.api.stopCuratorMode();

      // Wait for async report saving
      await vi.runAllTimersAsync();

      const htmlCall = mockStateManager.writeArtifact.mock.calls.find(
        call => call[0].endsWith('.html')
      );

      expect(htmlCall).toBeDefined();
      expect(htmlCall[1]).toContain('<!DOCTYPE html>');
      expect(htmlCall[1]).toContain('Curator Mode Report');
      expect(htmlCall[1]).toContain('Test goal');
    });

    it('should emit report:saved event', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);
      orchestrator.api.stopCuratorMode();

      await vi.runAllTimersAsync();

      expect(mockEventBus.emit).toHaveBeenCalledWith('curator:report:saved', {
        jsonPath: expect.any(String),
        htmlPath: expect.any(String),
        report: expect.any(Object)
      });
    });

    it('should calculate average duration correctly', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      // Advance time before completing proposal
      await vi.advanceTimersByTimeAsync(1000);

      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });

      const result = orchestrator.api.stopCuratorMode();

      expect(result.report.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should return config with default values', () => {
      const config = orchestrator.api.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.autoApproveContext).toBe(true);
      expect(config.autoApproveProposal).toBe(false);
      expect(config.maxProposalsPerGoal).toBe(7);
      expect(config.iterationDelay).toBe(5000);
    });

    it('should update config', () => {
      const updates = {
        maxProposalsPerGoal: 5,
        iterationDelay: 3000
      };

      const updated = orchestrator.api.updateConfig(updates);

      expect(updated.maxProposalsPerGoal).toBe(5);
      expect(updated.iterationDelay).toBe(3000);
    });

    it('should use default goals if none provided', async () => {
      await orchestrator.api.startCuratorMode();

      const config = orchestrator.api.getConfig();
      expect(config.goals.length).toBeGreaterThan(0);
    });

    it('should preserve other config values when updating', () => {
      orchestrator.api.updateConfig({ maxProposalsPerGoal: 10 });

      const config = orchestrator.api.getConfig();
      expect(config.autoApproveContext).toBe(true);
      expect(config.maxProposalsPerGoal).toBe(10);
    });
  });

  describe('Status Tracking', () => {
    it('should return current status', () => {
      const status = orchestrator.api.getCurrentStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('iteration');
      expect(status).toHaveProperty('goalIndex');
      expect(status).toHaveProperty('proposalsForCurrentGoal');
      expect(status).toHaveProperty('totalProposals');
    });

    it('should track iteration progress', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1']);

      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });

      const status = orchestrator.api.getCurrentStatus();
      expect(status.totalProposals).toBe(1);
      expect(status.proposalsForCurrentGoal).toBe(1);
    });

    it('should reset status when stopped', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1']);
      orchestrator.api.stopCuratorMode();

      expect(orchestrator.api.isRunning()).toBe(false);
    });
  });

  describe('Event Integration', () => {
    it('should only handle events when running', async () => {
      const stateChangeHandler = eventHandlers['agent:state:change'];

      // Event before starting
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });

      const status = orchestrator.api.getCurrentStatus();
      expect(status.totalProposals).toBe(0);
    });

    it('should ignore non-proposal state changes', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1']);

      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({ newState: 'CURATING_CONTEXT', context: {} });

      const status = orchestrator.api.getCurrentStatus();
      expect(status.totalProposals).toBe(0);
    });

    it('should emit iteration:complete event', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1']);

      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });

      expect(mockEventBus.emit).toHaveBeenCalledWith('curator:iteration:complete', {
        id: expect.any(Number),
        goalIndex: expect.any(Number),
        goal: expect.any(String),
        proposalNumber: expect.any(Number),
        startTime: expect.any(Number),
        status: 'completed',
        endTime: expect.any(Number),
        duration: expect.any(Number),
        proposalPath: expect.any(String)
      });
    });
  });

  describe('HTML Report Content', () => {
    it('should include success metrics in HTML', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      const stateChangeHandler = eventHandlers['agent:state:change'];
      stateChangeHandler({ newState: 'AWAITING_PROPOSAL_APPROVAL', context: {} });

      orchestrator.api.stopCuratorMode();

      // Wait for async report saving
      await vi.runAllTimersAsync();

      const htmlCall = mockStateManager.writeArtifact.mock.calls.find(
        call => call[0].endsWith('.html')
      );

      expect(htmlCall[1]).toContain('Total Proposals');
      expect(htmlCall[1]).toContain('Success Rate');
      expect(htmlCall[1]).toContain('Total Duration');
      expect(htmlCall[1]).toContain('Avg Iteration');
    });

    it('should include goals summary in HTML', async () => {
      await orchestrator.api.startCuratorMode(['Goal 1', 'Goal 2']);
      orchestrator.api.stopCuratorMode();

      // Wait for async report saving
      await vi.runAllTimersAsync();

      const htmlCall = mockStateManager.writeArtifact.mock.calls.find(
        call => call[0].endsWith('.html')
      );

      expect(htmlCall[1]).toContain('Goals Summary');
      expect(htmlCall[1]).toContain('Goal 1');
      expect(htmlCall[1]).toContain('Goal 2');
    });

    it('should include iteration timeline in HTML', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);
      orchestrator.api.stopCuratorMode();

      // Wait for async report saving
      await vi.runAllTimersAsync();

      const htmlCall = mockStateManager.writeArtifact.mock.calls.find(
        call => call[0].endsWith('.html')
      );

      expect(htmlCall[1]).toContain('Iteration Timeline');
      expect(htmlCall[1]).toContain('Iteration #1');
    });

    it('should show error status in HTML for failed iterations', async () => {
      await orchestrator.api.startCuratorMode(['Test goal']);

      const errorHandler = eventHandlers['agent:error'];
      errorHandler({ message: 'Test error' });

      orchestrator.api.stopCuratorMode();

      // Wait for async report saving
      await vi.runAllTimersAsync();

      const htmlCall = mockStateManager.writeArtifact.mock.calls.find(
        call => call[0].endsWith('.html')
      );

      expect(htmlCall[1]).toContain('Test error');
    });
  });
});
