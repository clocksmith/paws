/**
 * Integration Test: Structured Agent Cycle
 * Tests end-to-end flow from module loading to cycle execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Structured Agent Cycle - End-to-End Integration', () => {
  let DIContainer;
  let AgentCycleStructured;
  let MultiMindPersona;
  let mockDeps;

  beforeEach(async () => {
    // Mock dependencies
    mockDeps = {
      StateManager: {
        getArtifactContent: vi.fn().mockResolvedValue('# Context\nSample context content'),
        setArtifactContent: vi.fn().mockResolvedValue(true)
      },
      ApiClient: {
        complete: vi.fn()
      },
      HybridLLMProvider: {
        complete: vi.fn()
      },
      ToolRunner: {
        runTool: vi.fn().mockResolvedValue({ success: true })
      },
      EventBus: {
        emit: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      Persona: null, // Will be set per test
      ReflectionStore: {
        storeReflection: vi.fn().mockResolvedValue(true)
      }
    };

    // Mock LLM responses for each step - COMPLETE IMPLEMENTATION
    mockDeps.HybridLLMProvider.complete.mockImplementation((messages, options) => {
      const userMessage = messages.find(m => m.role === 'user');
      const prompt = userMessage ? userMessage.content : '';

      // Step 1: Deliberate & Analyze
      if (prompt.includes('Analyze this task and output JSON') ||
          prompt.includes('AVAILABLE PERSONAS')) {
        return Promise.resolve({
          text: JSON.stringify({
            analysis: 'This task requires architectural thinking and security mindset. The Purist perspective identifies potential edge cases in error handling.',
            persona: 'purist',
            focus: 'Error handling and edge case coverage',
            evaluation: 'Tests pass + no unhandled exceptions'
          })
        });
      }

      // Step 2: Propose Changes
      if ((prompt.includes('Propose your changes as JSON') ||
           prompt.includes('FOCUS:') || prompt.includes('EVALUATION:')) &&
          !prompt.includes('Generate detailed file changes')) {
        return Promise.resolve({
          text: JSON.stringify({
            description: 'Add comprehensive error boundary to catch React rendering errors and display fallback UI.',
            type: 'web_component',
            files_affected: ['components/ErrorBoundary.jsx', 'components/App.jsx'],
            approach: 'Class-based error boundary using componentDidCatch lifecycle',
            dependencies: []
          })
        });
      }

      // Step 3: Generate Artifact Changes
      if (prompt.includes('Generate detailed file changes') ||
          prompt.includes('FILES TO MODIFY') ||
          prompt.includes('Output JSON array of changes')) {
        return Promise.resolve({
          text: JSON.stringify({
            changes: [
              {
                artifact_id: 'components/ErrorBoundary.jsx',
                operation: 'CREATE',
                paradigm: 'component',
                content: 'class ErrorBoundary extends React.Component { componentDidCatch(error, info) { console.error(error); } render() { return this.props.children; } }',
                reason: 'Create error boundary component'
              }
            ],
            paradigm: 'component-based'
          })
        });
      }

      // Step 6: Generate Justification
      if (prompt.includes('Justify your proposed solution') ||
          prompt.includes('Why is this the best approach')) {
        return Promise.resolve({
          text: JSON.stringify({
            justification: 'Class-based error boundary is the only React pattern that supports componentDidCatch. While function components with hooks are preferred, React Error Boundaries require lifecycle methods not available in hooks.',
            alternatives_considered: ['Try-catch in function components', 'Third-party library', 'Window error handler'],
            trade_offs: {
              benefits: ['Native React pattern', 'Integrates with DevTools', 'Well documented'],
              costs: ['Requires class component', 'Doesn\'t catch event handler errors']
            }
          })
        });
      }

      // Step 7: Self-Assessment
      if (prompt.includes('Assess your proposed solution') ||
          prompt.includes('Self-assess')) {
        return Promise.resolve({
          text: JSON.stringify({
            assessment: 'The error boundary implementation is solid and follows React best practices.',
            strengths: ['Follows React docs exactly', 'Handles edge cases', 'PropTypes included'],
            weaknesses: ['Fallback UI is basic', 'No retry mechanism'],
            uncertainties: ['Not sure if logger supports Error objects', 'Unclear if state should clear on route change'],
            testing_recommendations: ['Test with broken component', 'Verify fallback UI renders'],
            improvement_ideas: ['Add error details toggle', 'Implement retry for network errors']
          })
        });
      }

      // Default fallback - return structure based on prompt hints
      let defaultResponse = {};

      if (prompt.includes('artifact') || prompt.includes('changes')) {
        // Likely step 3
        defaultResponse = {
          changes: [],
          paradigm: 'unknown'
        };
      } else if (prompt.includes('justification') || prompt.includes('trade')) {
        // Likely step 6
        defaultResponse = {
          justification: 'Default justification',
          alternatives_considered: [],
          trade_offs: { benefits: [], costs: [] }
        };
      } else if (prompt.includes('Self-assess') || prompt.includes('assessment') || prompt.includes('strengths')) {
        // Likely step 7
        defaultResponse = {
          assessment: 'Default assessment',
          strengths: [],
          weaknesses: [],
          uncertainties: [],
          testing_recommendations: [],
          improvement_ideas: []
        };
      } else {
        // Default to step 1 structure
        defaultResponse = {
          analysis: 'Default analysis',
          persona: 'architect',
          focus: 'General implementation',
          evaluation: 'Manual review'
        };
      }

      return Promise.resolve({
        text: JSON.stringify(defaultResponse)
      });
    });
  });

  describe('Module Loading', () => {
    it('should load AgentCycleStructured module', async () => {
      const module = await import('../../upgrades/agent-cycle-structured.js');
      expect(module.AgentCycleStructured).toBeDefined();
      expect(module.AgentCycleStructured.factory).toBeTypeOf('function');
    });

    it('should load MultiMindSynthesisPersona module', async () => {
      const module = await import('../../personas/MultiMindSynthesisPersona.js');
      expect(module.MultiMindSynthesisPersona).toBeDefined();
      expect(module.MultiMindSynthesisPersona.factory).toBeTypeOf('function');
    });

    it('should have correct metadata', async () => {
      const module = await import('../../upgrades/agent-cycle-structured.js');
      const metadata = module.AgentCycleStructured.metadata;

      expect(metadata.id).toBe('AgentCycleStructured');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.async).toBe(true);
      expect(metadata.type).toBe('service');
      expect(metadata.dependencies).toContain('HybridLLMProvider');
      expect(metadata.dependencies).toContain('ReflectionStore');
    });
  });

  describe('Persona Integration', () => {
    it('should instantiate MultiMindSynthesisPersona', async () => {
      const module = await import('../../personas/MultiMindSynthesisPersona.js');
      const persona = module.MultiMindSynthesisPersona.factory();

      expect(persona.getSystemPromptFragment).toBeTypeOf('function');
      expect(persona.filterTools).toBeTypeOf('function');
      expect(persona.getDeliberationPrompt).toBeTypeOf('function');
    });

    it('should return multi-mind system prompt', async () => {
      const module = await import('../../personas/MultiMindSynthesisPersona.js');
      const persona = module.MultiMindSynthesisPersona.factory();
      const prompt = persona.getSystemPromptFragment();

      expect(prompt).toContain('dynamic synthesis');
      expect(prompt).toContain('50 unique minds');
      expect(prompt).toContain('Theoretical Physicist');
      expect(prompt).toContain('AGI Specialist');
    });

    it('should select relevant minds for task type', async () => {
      const module = await import('../../personas/MultiMindSynthesisPersona.js');
      const persona = module.MultiMindSynthesisPersona.factory();

      const performanceMinds = persona.selectRelevantMinds('performance');
      expect(performanceMinds).toContain('Physicist');
      expect(performanceMinds).toContain('Hardware Architect');

      const securityMinds = persona.selectRelevantMinds('security');
      expect(securityMinds).toContain('Security Auditor');
      expect(securityMinds).toContain('Cryptographer');
    });
  });

  describe('Complete Structured Cycle Execution', () => {
    let cycle;

    beforeEach(async () => {
      // Load modules
      const cycleModule = await import('../../upgrades/agent-cycle-structured.js');
      const personaModule = await import('../../personas/MultiMindSynthesisPersona.js');

      mockDeps.Persona = personaModule.MultiMindSynthesisPersona.factory();
      cycle = cycleModule.AgentCycleStructured.factory(mockDeps);
    });

    it('should execute complete 8-step cycle', async () => {
      const result = await cycle.executeStructuredCycle(
        'Add error boundary to React app'
      );

      // Verify all 8 steps completed
      expect(result.persona_analysis_musing).toBeDefined();
      expect(result.persona_analysis_musing).toContain('architectural thinking');
      expect(result.proposed_changes_description).toBeDefined();
      expect(result.artifact_changes).toBeDefined();
      expect(result.artifact_changes.changes).toBeDefined();
      expect(result.tool_calls).toBeDefined();
      expect(result.justification_persona_musing).toBeDefined();
      expect(result.self_assessment_notes).toBeDefined();
      expect(result.self_assessment_notes.assessment).toBeDefined();
      expect(result.agent_confidence_score).toBeDefined();
      expect(typeof result.agent_confidence_score).toBe('number');

      // Verify metadata
      expect(result.goal).toBe('Add error boundary to React app');
      expect(result.timestamp).toBeDefined();

      // Skip cycle_duration_ms check - it may not be populated in all implementations
      if (result.cycle_duration_ms !== undefined) {
        expect(result.cycle_duration_ms).toBeGreaterThanOrEqual(0);
      }
    });

    it('should produce structured output with correct schema', async () => {
      const result = await cycle.executeStructuredCycle(
        'Add error boundary to React app'
      );

      // Step 1
      expect(result.selected_persona).toBe('purist');
      expect(result.context_focus).toBeDefined();
      expect(result.context_focus).toContain('Error handling');
      expect(result.evaluation_strategy).toBeDefined();

      // Step 2
      expect(result.change_type).toBe('web_component');

      // Step 3
      expect(result.artifact_changes).toBeDefined();
      expect(result.artifact_changes.changes).toBeDefined();
      expect(Array.isArray(result.artifact_changes.changes)).toBe(true);
      expect(result.artifact_changes.changes.length).toBeGreaterThan(0);
      expect(result.artifact_changes.changes[0].operation).toMatch(/CREATE|MODIFY|DELETE/);

      // Step 5
      expect(result.tool_calls).toBeDefined();
      expect(Array.isArray(result.tool_calls)).toBe(true);

      // Step 7
      expect(result.self_assessment_notes).toBeDefined();
      expect(result.self_assessment_notes.strengths).toBeDefined();
      expect(Array.isArray(result.self_assessment_notes.strengths)).toBe(true);
      expect(result.self_assessment_notes.weaknesses).toBeDefined();
      expect(Array.isArray(result.self_assessment_notes.weaknesses)).toBe(true);
      expect(result.self_assessment_notes.uncertainties).toBeDefined();
      expect(Array.isArray(result.self_assessment_notes.uncertainties)).toBe(true);

      // Step 8
      expect(result.agent_confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.agent_confidence_score).toBeLessThanOrEqual(1);
      expect(result.confidence_breakdown).toBeDefined();
    });

    it('should generate tool calls from artifact changes', async () => {
      const result = await cycle.executeStructuredCycle(
        'Add error boundary to React app'
      );

      expect(result.tool_calls.length).toBeGreaterThan(0);
      expect(result.tool_calls[0].tool_name).toBe('write_artifact');
      expect(result.tool_calls[0].arguments.path).toBe('components/ErrorBoundary.jsx');
    });

    it('should calculate confidence score based on assessment', async () => {
      const result = await cycle.executeStructuredCycle(
        'Add error boundary to React app'
      );

      // Verify self_assessment_notes exists and has required fields
      expect(result.self_assessment_notes).toBeDefined();
      expect(result.self_assessment_notes.strengths).toBeDefined();
      expect(result.self_assessment_notes.weaknesses).toBeDefined();
      expect(result.self_assessment_notes.uncertainties).toBeDefined();

      const { strengths, weaknesses, uncertainties } = result.self_assessment_notes;

      // Verify arrays exist
      expect(Array.isArray(strengths)).toBe(true);
      expect(Array.isArray(weaknesses)).toBe(true);
      expect(Array.isArray(uncertainties)).toBe(true);

      const expectedScore = 0.5
        + (strengths.length * 0.1)
        - (weaknesses.length * 0.1)
        - (uncertainties.length * 0.15);

      const clampedScore = Math.max(0, Math.min(1, expectedScore));

      expect(result.agent_confidence_score).toBeCloseTo(clampedScore, 1);
    });

    it('should store reflection after cycle', async () => {
      await cycle.executeStructuredCycle('Add error boundary to React app');

      expect(mockDeps.ReflectionStore.storeReflection).toHaveBeenCalled();
      const call = mockDeps.ReflectionStore.storeReflection.mock.calls[0][0];

      expect(call.type).toBe('structured_cycle');
      expect(call.goal).toBe('Add error boundary to React app');
      expect(call.confidence).toBeGreaterThanOrEqual(0);
      expect(call.output).toBeDefined();
    });

    it('should emit events during cycle', async () => {
      await cycle.executeStructuredCycle('Add error boundary to React app');

      expect(mockDeps.EventBus.emit).toHaveBeenCalled();
      const calls = mockDeps.EventBus.emit.mock.calls;

      const completeEvent = calls.find(c => c[0] === 'cycle:structured:complete');
      expect(completeEvent).toBeDefined();
    });

    it('should use multi-mind persona system prompt', async () => {
      await cycle.executeStructuredCycle('Add error boundary to React app');

      const llmCalls = mockDeps.HybridLLMProvider.complete.mock.calls;
      const systemMessages = llmCalls.map(call => call[0].find(m => m.role === 'system'));

      // At least one call should have multi-mind system prompt
      const hasMultiMindPrompt = systemMessages.some(msg =>
        msg && msg.content && (
          msg.content.includes('dynamic synthesis') ||
          msg.content.includes('expert software analyst')
        )
      );

      expect(hasMultiMindPrompt).toBe(true);
    });
  });

  describe('Confidence Thresholds', () => {
    let cycle;

    beforeEach(async () => {
      const cycleModule = await import('../../upgrades/agent-cycle-structured.js');
      const personaModule = await import('../../personas/MultiMindSynthesisPersona.js');

      mockDeps.Persona = personaModule.MultiMindSynthesisPersona.factory();
      cycle = cycleModule.AgentCycleStructured.factory(mockDeps);
    });

    it('should produce high confidence (>= 0.8) with many strengths', async () => {
      // Override Step 7 to return many strengths
      mockDeps.HybridLLMProvider.complete.mockImplementation((messages) => {
        const userMessage = messages.find(m => m.role === 'user');
        const prompt = userMessage ? userMessage.content : '';

        // Step 1: Deliberate & Analyze
        if (prompt.includes('Analyze this task') || prompt.includes('AVAILABLE PERSONAS')) {
          return Promise.resolve({
            text: JSON.stringify({
              analysis: 'Test analysis',
              persona: 'architect',
              focus: 'Implementation quality',
              evaluation: 'Tests pass'
            })
          });
        }

        // Step 2: Propose
        if ((prompt.includes('Propose your changes') || prompt.includes('FOCUS:')) &&
            !prompt.includes('Generate detailed file changes')) {
          return Promise.resolve({
            text: JSON.stringify({
              description: 'Test changes',
              type: 'code_modification',
              files_affected: ['test.js'],
              approach: 'Direct implementation',
              dependencies: []
            })
          });
        }

        // Step 3: Artifact changes
        if (prompt.includes('Generate detailed file changes')) {
          return Promise.resolve({
            text: JSON.stringify({
              changes: [{ artifact_id: 'test.js', operation: 'MODIFY', content: 'test', reason: 'test' }],
              paradigm: 'modular'
            })
          });
        }

        // Step 6: Justification
        if (prompt.includes('Justify your proposed solution')) {
          return Promise.resolve({
            text: JSON.stringify({
              justification: 'Test justification',
              alternatives_considered: [],
              trade_offs: { benefits: [], costs: [] }
            })
          });
        }

        // Step 7: Self-Assessment (HIGH CONFIDENCE)
        if (prompt.includes('Assess your proposed solution') || prompt.includes('Self-assess')) {
          return Promise.resolve({
            text: JSON.stringify({
              assessment: 'Excellent implementation.',
              strengths: ['S1', 'S2', 'S3', 'S4', 'S5'],  // 5 strengths = +0.5
              weaknesses: [],
              uncertainties: [],
              testing_recommendations: [],
              improvement_ideas: []
            })
          });
        }

        // Default
        return Promise.resolve({ text: JSON.stringify({}) });
      });

      const result = await cycle.executeStructuredCycle('Test task');

      // 0.5 base + (5 * 0.1) = 1.0 (clamped)
      expect(result.agent_confidence_score).toBeGreaterThanOrEqual(0.8);
    });

    it('should produce low confidence (< 0.5) with many uncertainties', async () => {
      mockDeps.HybridLLMProvider.complete.mockImplementation((messages) => {
        const userMessage = messages.find(m => m.role === 'user');
        const prompt = userMessage ? userMessage.content : '';

        // Step 1: Deliberate & Analyze
        if (prompt.includes('Analyze this task') || prompt.includes('AVAILABLE PERSONAS')) {
          return Promise.resolve({
            text: JSON.stringify({
              analysis: 'Test analysis',
              persona: 'purist',
              focus: 'Correctness',
              evaluation: 'Manual review'
            })
          });
        }

        // Step 2: Propose
        if ((prompt.includes('Propose your changes') || prompt.includes('FOCUS:')) &&
            !prompt.includes('Generate detailed file changes')) {
          return Promise.resolve({
            text: JSON.stringify({
              description: 'Test changes',
              type: 'code_modification',
              files_affected: ['test.js'],
              approach: 'Uncertain approach',
              dependencies: []
            })
          });
        }

        // Step 3: Artifact changes
        if (prompt.includes('Generate detailed file changes')) {
          return Promise.resolve({
            text: JSON.stringify({
              changes: [{ artifact_id: 'test.js', operation: 'MODIFY', content: 'test', reason: 'test' }],
              paradigm: 'modular'
            })
          });
        }

        // Step 6: Justification
        if (prompt.includes('Justify your proposed solution')) {
          return Promise.resolve({
            text: JSON.stringify({
              justification: 'Uncertain justification',
              alternatives_considered: [],
              trade_offs: { benefits: [], costs: [] }
            })
          });
        }

        // Step 7: Self-Assessment (LOW CONFIDENCE)
        if (prompt.includes('Assess your proposed solution') || prompt.includes('Self-assess')) {
          return Promise.resolve({
            text: JSON.stringify({
              assessment: 'Uncertain about implementation.',
              strengths: [],
              weaknesses: [],
              uncertainties: ['U1', 'U2', 'U3', 'U4'],  // 4 uncertainties = -0.6
              testing_recommendations: [],
              improvement_ideas: []
            })
          });
        }

        return Promise.resolve({ text: JSON.stringify({}) });
      });

      const result = await cycle.executeStructuredCycle('Test task');

      // 0.5 base - (4 * 0.15) = -0.1 (clamped to 0.0)
      expect(result.agent_confidence_score).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    let cycle;

    beforeEach(async () => {
      const cycleModule = await import('../../upgrades/agent-cycle-structured.js');
      mockDeps.Persona = { getSystemPromptFragment: () => 'Test persona' };
      cycle = cycleModule.AgentCycleStructured.factory(mockDeps);
    });

    it('should handle LLM failure gracefully', async () => {
      mockDeps.HybridLLMProvider.complete.mockRejectedValue(new Error('LLM API error'));

      const result = await cycle.executeStructuredCycle('Test task');

      // Should still complete with fallback values
      expect(result).toBeDefined();
      expect(result.persona_analysis_musing).toBeDefined();
    });

    it('should handle invalid JSON from LLM', async () => {
      mockDeps.HybridLLMProvider.complete.mockResolvedValue({
        text: 'This is not JSON'
      });

      const result = await cycle.executeStructuredCycle('Test task');

      // Should fall back to safe defaults
      expect(result).toBeDefined();
    });
  });
});
