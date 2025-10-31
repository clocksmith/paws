/**
 * @fileoverview Structured 8-Step Agent Cycle for REPLOID
 * Implements explicit deliberation → proposal → assessment flow with confidence scoring
 *
 * @blueprint 0x000041 - 8-step structured agent cycle with explicit deliberation, self-assessment, and confidence scoring.
 * @module AgentCycleStructured
 * @version 1.0.0
 * @category agent
 */

const AgentCycleStructured = {
  metadata: {
    id: 'AgentCycleStructured',
    version: '1.0.0',
    dependencies: [
      'Storage',
      'ApiClient',
      'HybridLLMProvider',
      'EventBus',
      'Utils',
      'Persona',
      'ReflectionStore'
    ],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const {
      Storage,
      ApiClient,
      HybridLLMProvider,
      EventBus,
      Utils,
      Persona,
      ReflectionStore
    } = deps;
    const { logger } = Utils;

    // Widget tracking state
    const _cycleHistory = [];
    let _currentCycle = null;
    let _currentStep = 0;
    const _personaHistory = [];
    let _lastActivity = null;

    /**
     * Execute one complete structured agent cycle
     * Returns structured JSON output with all 8 steps
     *
     * @param {string} goal - The task to accomplish
     * @param {string} contextPath - Path to cats bundle (optional)
     * @returns {Promise<StructuredCycleOutput>}
     */
    const executeStructuredCycle = async (goal, contextPath = null) => {
      logger.info('[StructuredCycle] Starting 8-step cycle', { goal });

      // Track cycle start
      const cycleStartTime = Date.now();
      _currentCycle = {
        goal,
        startTime: cycleStartTime,
        steps: []
      };
      _currentStep = 0;
      _lastActivity = Date.now();

      // Load context if provided
      let contextContent = '';
      if (contextPath) {
        contextContent = await Storage.getArtifactContent(contextPath);
      }

      // Step 1: Deliberate & Analyze (Persona Selection + Analysis)
      _currentStep = 1;
      const step1 = await deliberateAndAnalyze(goal, contextContent);
      _currentCycle.steps.push({ step: 1, name: 'Deliberate & Analyze', completed: true, persona: step1.persona });
      logger.info('[StructuredCycle] Step 1 complete: Persona Analysis');

      // Step 2: Propose Changes
      _currentStep = 2;
      const step2 = await proposeChanges(goal, contextContent, step1);
      _currentCycle.steps.push({ step: 2, name: 'Propose Changes', completed: true });
      logger.info('[StructuredCycle] Step 2 complete: Proposed Changes');

      // Step 3: Generate Artifact Changes
      _currentStep = 3;
      const step3 = await generateArtifactChanges(goal, contextContent, step1, step2);
      _currentCycle.steps.push({ step: 3, name: 'Artifact Changes', completed: true });
      logger.info('[StructuredCycle] Step 3 complete: Artifact Changes');

      // Step 4: Tool/Component Creation (if needed)
      _currentStep = 4;
      const step4 = await createToolsOrComponents(step2, step3);
      _currentCycle.steps.push({ step: 4, name: 'Tool/WC Creation', completed: true });
      logger.info('[StructuredCycle] Step 4 complete: Tool/WC Creation');

      // Step 5: Tool Calls
      _currentStep = 5;
      const step5 = await generateToolCalls(step3, step4);
      _currentCycle.steps.push({ step: 5, name: 'Tool Calls', completed: true });
      logger.info('[StructuredCycle] Step 5 complete: Tool Calls');

      // Step 6: Justification
      _currentStep = 6;
      const step6 = await generateJustification(goal, step1, step2, step3);
      _currentCycle.steps.push({ step: 6, name: 'Justification', completed: true });
      logger.info('[StructuredCycle] Step 6 complete: Justification');

      // Step 7: Self-Assessment
      _currentStep = 7;
      const step7 = await selfAssess(goal, step2, step3, step5);
      _currentCycle.steps.push({ step: 7, name: 'Self-Assessment', completed: true });
      logger.info('[StructuredCycle] Step 7 complete: Self-Assessment');

      // Step 8: Confidence Score
      _currentStep = 8;
      const step8 = await calculateConfidence(step7, step3);
      _currentCycle.steps.push({ step: 8, name: 'Confidence Score', completed: true });
      logger.info('[StructuredCycle] Step 8 complete: Confidence Score');

      // Assemble complete output
      const output = {
        // Step 1
        persona_analysis_musing: step1.analysis,
        selected_persona: step1.persona,
        context_focus: step1.focus,
        evaluation_strategy: step1.evaluation,

        // Step 2
        proposed_changes_description: step2.description,
        change_type: step2.type, // 'tool', 'web_component', 'page_composition', 'code_modification'

        // Step 3
        artifact_changes: step3,

        // Step 4
        proposed_new_tools: step4.tools || [],
        web_components: step4.components || [],

        // Step 5
        tool_calls: step5.calls,

        // Step 6
        justification_persona_musing: step6.justification,

        // Step 7
        self_assessment_notes: step7,

        // Step 8
        agent_confidence_score: step8.score,
        confidence_breakdown: step8.breakdown,

        // Metadata
        goal: goal,
        timestamp: new Date().toISOString(),
        cycle_duration_ms: step8.duration
      };

      // Store in reflection system for learning
      await ReflectionStore.storeReflection({
        type: 'structured_cycle',
        goal,
        confidence: step8.score,
        output
      });

      // Track cycle completion
      const cycleDuration = Date.now() - cycleStartTime;
      _currentCycle.endTime = Date.now();
      _currentCycle.duration = cycleDuration;
      _currentCycle.confidence = step8.score;
      _currentCycle.persona = step1.persona;
      _currentCycle.completed = true;

      _cycleHistory.push({ ..._currentCycle });
      if (_cycleHistory.length > 20) _cycleHistory.shift();

      _personaHistory.push({ persona: step1.persona, timestamp: Date.now(), goal });
      if (_personaHistory.length > 50) _personaHistory.shift();

      _currentStep = 0;
      _currentCycle = null;
      _lastActivity = Date.now();

      // Emit event
      EventBus.emit('cycle:structured:complete', output);

      return output;
    };

    /**
     * Step 1: Deliberate & Analyze
     * Choose persona, analyze inputs, decide evaluation strategy
     */
    const deliberateAndAnalyze = async (goal, contextContent) => {
      const startTime = Date.now();

      // Get available personas
      const availablePersonas = [
        { id: 'architect', name: 'The Architect', focus: 'high-level design, structure, modularity' },
        { id: 'purist', name: 'The Purist', focus: 'correctness, edge cases, type safety' },
        { id: 'auditor', name: 'The Auditor', focus: 'security, performance, anti-patterns' },
        { id: 'craftsman', name: 'The Craftsman', focus: 'readability, maintainability, SOLID' }
      ];

      // Use custom persona if available
      let basePersonaPrompt = '';
      if (Persona && Persona.getSystemPromptFragment) {
        basePersonaPrompt = Persona.getSystemPromptFragment();
      }

      const prompt = `You are analyzing a software engineering task to determine the best approach.

TASK: ${goal}

${contextContent ? `CONTEXT:\n${contextContent.substring(0, 2000)}...\n` : ''}

AVAILABLE PERSONAS:
${availablePersonas.map(p => `- ${p.name}: ${p.focus}`).join('\n')}

Analyze this task and output JSON with:
{
  "analysis": "Your multi-perspective deliberation. Consider: What patterns apply? What are the risks? What historical insights are relevant? What are the edge cases?",
  "persona": "architect|purist|auditor|craftsman - which mindset dominates?",
  "focus": "What should the agent focus on? (e.g., 'modularity and extensibility', 'error handling and validation')",
  "evaluation": "How will success be measured? (e.g., 'tests pass + no performance regression', 'code coverage > 80%')"
}

Be thorough in your analysis. Consider multiple perspectives before choosing.`;

      try {
        const response = await HybridLLMProvider.complete([
          {
            role: 'system',
            content: basePersonaPrompt || 'You are an expert software analyst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          temperature: 0.7,
          maxOutputTokens: 1500,
          responseFormat: 'json'
        });

        const parsed = JSON.parse(response.text);
        return {
          analysis: parsed.analysis,
          persona: parsed.persona,
          focus: parsed.focus,
          evaluation: parsed.evaluation,
          duration: Date.now() - startTime
        };
      } catch (error) {
        logger.error('[StructuredCycle] Step 1 failed', error);
        // Fallback
        return {
          analysis: 'Analysis failed - using default approach',
          persona: 'architect',
          focus: 'general code quality',
          evaluation: 'manual review',
          duration: Date.now() - startTime
        };
      }
    };

    /**
     * Step 2: Propose Changes
     * High-level description of what will change
     */
    const proposeChanges = async (goal, contextContent, step1) => {
      const personaPrompts = {
        architect: 'Focus on high-level structure and modularity.',
        purist: 'Focus on correctness, edge cases, and type safety.',
        auditor: 'Focus on security, performance, and avoiding anti-patterns.',
        craftsman: 'Focus on code readability, maintainability, and design patterns.'
      };

      const personaGuidance = personaPrompts[step1.persona] || personaPrompts.architect;

      const prompt = `You are ${step1.persona.toUpperCase()}. ${personaGuidance}

TASK: ${goal}
FOCUS: ${step1.focus}
EVALUATION: ${step1.evaluation}

${contextContent ? `CONTEXT:\n${contextContent.substring(0, 3000)}...\n` : ''}

Propose your changes as JSON:
{
  "description": "High-level description of proposed changes (2-4 sentences)",
  "type": "tool|web_component|page_composition|code_modification",
  "files_affected": ["path/to/file1.js", "path/to/file2.css"],
  "approach": "Brief explanation of your approach",
  "dependencies": ["Any new dependencies needed"]
}`;

      try {
        const response = await HybridLLMProvider.complete([
          {
            role: 'system',
            content: 'You are proposing software changes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          temperature: 0.6,
          maxOutputTokens: 1000,
          responseFormat: 'json'
        });

        return JSON.parse(response.text);
      } catch (error) {
        logger.error('[StructuredCycle] Step 2 failed', error);
        return {
          description: 'Modify code to accomplish goal',
          type: 'code_modification',
          files_affected: [],
          approach: 'Direct implementation',
          dependencies: []
        };
      }
    };

    /**
     * Step 3: Generate Artifact Changes
     * Detailed file changes
     */
    const generateArtifactChanges = async (goal, contextContent, step1, step2) => {
      const prompt = `Generate detailed file changes for this task.

TASK: ${goal}
APPROACH: ${step2.approach}
FILES TO MODIFY: ${step2.files_affected.join(', ')}
PERSONA: ${step1.persona}

${contextContent ? `CONTEXT:\n${contextContent.substring(0, 2000)}...\n` : ''}

Output JSON array of changes:
{
  "changes": [
    {
      "artifact_id": "path/to/file.js",
      "operation": "CREATE|MODIFY|DELETE",
      "paradigm": "module|component|page|tool",
      "content": "Full file content (for CREATE/MODIFY)",
      "reason": "Why this change?"
    }
  ],
  "paradigm": "Overall architectural paradigm (e.g., 'modular', 'component-based')"
}

IMPORTANT: If type is 'page_composition', do NOT use 'full_html_source'. Use semantic components instead.`;

      try {
        const response = await HybridLLMProvider.complete([
          {
            role: 'system',
            content: 'You are generating code changes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          temperature: 0.5,
          maxOutputTokens: 4000,
          responseFormat: 'json'
        });

        return JSON.parse(response.text);
      } catch (error) {
        logger.error('[StructuredCycle] Step 3 failed', error);
        return {
          changes: [],
          paradigm: 'unknown'
        };
      }
    };

    /**
     * Step 4: Tool/WC Creation
     * Generate new tools or web components if needed
     */
    const createToolsOrComponents = async (step2, step3) => {
      if (step2.type !== 'tool' && step2.type !== 'web_component') {
        return { tools: [], components: [] };
      }

      // Check if we need to create new tools
      const newTools = [];
      const newComponents = [];

      if (step2.type === 'tool') {
        // Generate tool definition
        newTools.push({
          name: `custom_${Date.now()}`,
          description: step2.description,
          parameters: [],
          implementation: step3.changes?.[0]?.content || ''
        });
      }

      if (step2.type === 'web_component') {
        // Generate web component definition
        newComponents.push({
          tag_name: `custom-component-${Date.now()}`,
          description: step2.description,
          template: step3.changes?.[0]?.content || '',
          styles: step3.changes?.[1]?.content || ''
        });
      }

      return {
        tools: newTools,
        components: newComponents
      };
    };

    /**
     * Step 5: Generate Tool Calls
     * Determine which tools to call and with what arguments
     */
    const generateToolCalls = async (step3, step4) => {
      const toolCalls = [];

      // Map artifact changes to tool calls
      for (const change of step3.changes || []) {
        if (change.operation === 'CREATE') {
          toolCalls.push({
            tool_name: 'write_artifact',
            arguments: {
              path: change.artifact_id,
              content: change.content,
              reason: change.reason
            }
          });
        } else if (change.operation === 'MODIFY') {
          toolCalls.push({
            tool_name: 'write_artifact',
            arguments: {
              path: change.artifact_id,
              content: change.content,
              reason: change.reason
            }
          });
        } else if (change.operation === 'DELETE') {
          toolCalls.push({
            tool_name: 'delete_artifact',
            arguments: {
              path: change.artifact_id,
              reason: change.reason
            }
          });
        }
      }

      // Add tool definition calls if new tools created
      for (const tool of step4.tools || []) {
        toolCalls.push({
          tool_name: 'create_dynamic_tool',
          arguments: tool
        });
      }

      // Add web component calls if components created
      for (const component of step4.components || []) {
        toolCalls.push({
          tool_name: 'define_web_component',
          arguments: component
        });
      }

      return { calls: toolCalls };
    };

    /**
     * Step 6: Generate Justification
     * Explain why this approach was chosen
     */
    const generateJustification = async (goal, step1, step2, step3) => {
      const prompt = `Justify your proposed solution from the ${step1.persona} perspective.

TASK: ${goal}
APPROACH: ${step2.approach}
CHANGES: ${step3.changes?.length || 0} files modified

Why is this the best approach? What alternatives were considered? What trade-offs were made?

Respond with:
{
  "justification": "Detailed explanation of why this approach is best (2-3 paragraphs)",
  "alternatives_considered": ["Alternative 1", "Alternative 2"],
  "trade_offs": {
    "benefits": ["Benefit 1", "Benefit 2"],
    "costs": ["Cost 1", "Cost 2"]
  }
}`;

      try {
        const response = await HybridLLMProvider.complete([
          {
            role: 'system',
            content: 'You are justifying your design decisions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          temperature: 0.7,
          maxOutputTokens: 1000,
          responseFormat: 'json'
        });

        return JSON.parse(response.text);
      } catch (error) {
        logger.error('[StructuredCycle] Step 6 failed', error);
        return {
          justification: 'This approach accomplishes the goal efficiently.',
          alternatives_considered: [],
          trade_offs: { benefits: [], costs: [] }
        };
      }
    };

    /**
     * Step 7: Self-Assessment
     * Agent evaluates its own proposal
     */
    const selfAssess = async (goal, step2, step3, step5) => {
      const prompt = `Assess your proposed solution critically.

TASK: ${goal}
CHANGES: ${step3.changes?.length || 0} files, ${step5.calls?.length || 0} tool calls

Self-assess:
{
  "assessment": "Overall assessment of the solution (2-3 sentences)",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "uncertainties": ["What you're uncertain about", "What could go wrong"],
  "testing_recommendations": ["How to test this", "What to verify"],
  "improvement_ideas": ["How this could be improved later"]
}

Be honest and critical. What are you NOT confident about?`;

      try {
        const response = await HybridLLMProvider.complete([
          {
            role: 'system',
            content: 'You are critically assessing your own work.'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          temperature: 0.8,
          maxOutputTokens: 1000,
          responseFormat: 'json'
        });

        return JSON.parse(response.text);
      } catch (error) {
        logger.error('[StructuredCycle] Step 7 failed', error);
        return {
          assessment: 'Solution appears sound but needs testing.',
          strengths: [],
          weaknesses: [],
          uncertainties: ['Untested'],
          testing_recommendations: [],
          improvement_ideas: []
        };
      }
    };

    /**
     * Step 8: Calculate Confidence Score
     * Numeric confidence rating 0.0-1.0
     */
    const calculateConfidence = async (step7, step3) => {
      // Calculate confidence based on multiple factors
      let score = 0.5; // Base confidence

      // Adjust based on strengths vs weaknesses
      const strengthCount = step7.strengths?.length || 0;
      const weaknessCount = step7.weaknesses?.length || 0;
      const uncertaintyCount = step7.uncertainties?.length || 0;

      score += (strengthCount * 0.1);
      score -= (weaknessCount * 0.1);
      score -= (uncertaintyCount * 0.15);

      // Adjust based on change complexity
      const changeCount = step3.changes?.length || 0;
      if (changeCount === 0) {
        score -= 0.3; // No changes = low confidence
      } else if (changeCount > 10) {
        score -= 0.1; // Too many changes = risky
      }

      // Clamp to [0.0, 1.0]
      score = Math.max(0.0, Math.min(1.0, score));

      return {
        score: parseFloat(score.toFixed(2)),
        breakdown: {
          base: 0.5,
          from_strengths: strengthCount * 0.1,
          from_weaknesses: -(weaknessCount * 0.1),
          from_uncertainties: -(uncertaintyCount * 0.15),
          from_complexity: changeCount > 10 ? -0.1 : 0.0
        },
        interpretation: score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low'
      };
    };

    // Web Component Widget
    class AgentCycleStructuredWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Auto-refresh every 2 seconds
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        const isRunning = _currentCycle !== null;
        const avgConfidence = _cycleHistory.length > 0
          ? (_cycleHistory.reduce((sum, c) => sum + (c.confidence || 0), 0) / _cycleHistory.length).toFixed(2)
          : '0.00';

        return {
          state: isRunning ? 'active' : 'idle',
          primaryMetric: isRunning ? `Step ${_currentStep}/8` : 'Idle',
          secondaryMetric: `Conf: ${avgConfidence}`,
          lastActivity: _lastActivity,
          message: isRunning ? `${_currentCycle.goal?.substring(0, 40)}...` : `${_cycleHistory.length} cycles`
        };
      }

      renderPanel() {
        const avgDuration = _cycleHistory.length > 0
          ? (_cycleHistory.reduce((sum, c) => sum + (c.duration || 0), 0) / _cycleHistory.length / 1000).toFixed(1)
          : '0.0';

        const avgConfidence = _cycleHistory.length > 0
          ? (_cycleHistory.reduce((sum, c) => sum + (c.confidence || 0), 0) / _cycleHistory.length).toFixed(2)
          : '0.00';

        // Count persona usage
        const personaCount = {};
        _personaHistory.forEach(p => {
          personaCount[p.persona] = (personaCount[p.persona] || 0) + 1;
        });

        const stepNames = [
          'Deliberate & Analyze',
          'Propose Changes',
          'Artifact Changes',
          'Tool/WC Creation',
          'Tool Calls',
          'Justification',
          'Self-Assessment',
          'Confidence Score'
        ];

        return `
          ${_currentCycle ? `
            <h3>↻ Current Cycle Progress</h3>
            <div style="margin-top: 12px; padding: 12px; background: rgba(255,165,0,0.1); border-radius: 4px; border-left: 3px solid #ffa500;">
              <div style="font-size: 0.9em; color: #888; margin-bottom: 8px;">Goal</div>
              <div style="font-size: 0.95em; margin-bottom: 12px;">${_currentCycle.goal}</div>

              <div style="font-size: 0.9em; color: #888; margin-bottom: 6px;">Progress</div>
              <div style="background: rgba(0,0,0,0.3); height: 20px; border-radius: 10px; overflow: hidden;">
                <div style="height: 100%; background: linear-gradient(90deg, #4fc3f7, #0c0); width: ${(_currentStep / 8) * 100}%; transition: width 0.3s;"></div>
              </div>
              <div style="text-align: center; margin-top: 6px; font-weight: bold; font-size: 1.1em;">Step ${_currentStep}/8</div>
            </div>

            <h3 style="margin-top: 20px;">☷ 8-Step Breakdown</h3>
            <div style="margin-top: 12px;">
              ${stepNames.map((name, idx) => {
                const stepNum = idx + 1;
                const isComplete = stepNum < _currentStep;
                const isCurrent = stepNum === _currentStep;
                const isPending = stepNum > _currentStep;

                return `
                  <div style="padding: 8px; background: ${isCurrent ? 'rgba(255,165,0,0.1)' : (isComplete ? 'rgba(0,200,100,0.1)' : 'rgba(255,255,255,0.03)')}; border-radius: 4px; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; ${isCurrent ? 'border-left: 3px solid #ffa500;' : ''}">
                    <div style="font-size: 1.2em;">${isComplete ? '✓' : (isCurrent ? '▶' : '○')}</div>
                    <div style="flex: 1;">
                      <div style="font-size: 0.9em; font-weight: bold;">Step ${stepNum}: ${name}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <h3 style="margin-top: 20px;">☱ Cycle Statistics</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;">
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Total Cycles</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_cycleHistory.length}</div>
            </div>
            <div style="padding: 12px; background: rgba(0,200,100,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Avg Confidence</div>
              <div style="font-size: 1.3em; font-weight: bold;">${avgConfidence}</div>
            </div>
            <div style="padding: 12px; background: rgba(255,165,0,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Avg Duration</div>
              <div style="font-size: 1.3em; font-weight: bold;">${avgDuration}s</div>
            </div>
          </div>

          ${Object.keys(personaCount).length > 0 ? `
            <h3 style="margin-top: 20px;">☯ Persona Usage</h3>
            <div style="margin-top: 12px;">
              ${Object.entries(personaCount).sort(([,a], [,b]) => b - a).map(([persona, count]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 4px;">
                  <span style="text-transform: capitalize;">${persona}</span>
                  <span style="font-weight: bold; color: #6496ff;">${count}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${_cycleHistory.length > 0 ? `
            <h3 style="margin-top: 20px;">⌚ Recent Cycles (Last 10)</h3>
            <div style="margin-top: 12px; max-height: 300px; overflow-y: auto;">
              ${_cycleHistory.slice(-10).reverse().map(cycle => {
                const timeAgo = Math.floor((Date.now() - cycle.endTime) / 1000);
                const durationSec = (cycle.duration / 1000).toFixed(1);
                const confidenceColor = cycle.confidence >= 0.8 ? '#0c0' : cycle.confidence >= 0.5 ? '#ffa500' : '#ff6b6b';

                return `
                  <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 6px; font-size: 0.85em;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 4px;">${cycle.goal?.substring(0, 60)}...</div>
                        <div style="color: #888;">Persona: <span style="text-transform: capitalize;">${cycle.persona}</span></div>
                      </div>
                      <div style="text-align: right; margin-left: 12px;">
                        <div style="font-weight: bold; color: ${confidenceColor};">Conf: ${(cycle.confidence || 0).toFixed(2)}</div>
                        <div style="color: #666;">${durationSec}s</div>
                        <div style="color: #666; font-size: 0.85em;">${timeAgo}s ago</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div style="margin-top: 12px; color: #888; font-style: italic;">No cycles completed yet</div>'}

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>ℹ️ Structured 8-Step Cycle</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Explicit deliberation → proposal → assessment flow with confidence scoring.<br>
              Each cycle selects a persona (Architect, Purist, Auditor, Craftsman) for the task.
            </div>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
              color: #ccc;
              font-family: system-ui, -apple-system, sans-serif;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #0ff;
            }

            strong {
              color: #fff;
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;
      }
    }

    // Define custom element
    if (!customElements.get('agent-cycle-structured-widget')) {
      customElements.define('agent-cycle-structured-widget', AgentCycleStructuredWidget);
    }

    // Widget metadata
    const widget = {
      element: 'agent-cycle-structured-widget',
      displayName: 'Agent Cycle (Structured)',
      icon: '☱',
      category: 'agent',
      updateInterval: 2000
    };

    // Public API
    return {
      api: {
        executeStructuredCycle
      },
      widget
    };
  }
};

// Export standardized module
export default AgentCycleStructured;
