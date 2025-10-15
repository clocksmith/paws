import { describe, it, expect } from 'vitest';

describe('ToolEvaluator JSON Definition', () => {
  let toolDef;

  beforeEach(() => {
    toolDef = {
      declaration: {
        name: "run_self_evaluation",
        description: "Executes a self-evaluation task using an LLM based on defined criteria and a target artifact or text.",
        inputSchema: {
          type: "object",
          properties: {
            contentToEvaluate: {
              type: "string",
              description: "The explicit content (e.g., a proposed change description) to be evaluated."
            },
            criteria: {
              type: "string",
              description: "The evaluation criteria, as a string."
            },
            goalContext: {
              type: "string",
              description: "The relevant goal context against which the content should be evaluated."
            }
          },
          required: ["contentToEvaluate", "criteria", "goalContext"]
        }
      },
      prompt: "You are Evaluator-X0. Your sole task is to objectively evaluate the provided 'Target Content' against the 'Evaluation Criteria' within the 'Original Goal Context'. Provide a numerical score from 0.0 (total failure) to 1.0 (perfect alignment) and a concise, factual report explaining your reasoning. Focus only on the provided information.\n\n**Original Goal Context:**\n[[GOAL_CONTEXT]]\n\n**Evaluation Criteria:**\n[[EVALUATION_CRITERIA]]\n\n**Target Content to Evaluate:**\n[[TARGET_CONTENT]]\n\n**Your Response (JSON ONLY):**\n```json\n{\n  \"evaluation_score\": float,\n  \"evaluation_report\": \"string\"\n}\n```"
    };
  });

  describe('Declaration Structure', () => {
    it('should have required declaration fields', () => {
      expect(toolDef.declaration.name).toBe('run_self_evaluation');
      expect(toolDef.declaration.description).toBeDefined();
      expect(toolDef.declaration.inputSchema).toBeDefined();
    });

    it('should define input schema', () => {
      const schema = toolDef.declaration.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toEqual(['contentToEvaluate', 'criteria', 'goalContext']);
    });

    it('should have contentToEvaluate property', () => {
      const prop = toolDef.declaration.inputSchema.properties.contentToEvaluate;
      expect(prop.type).toBe('string');
      expect(prop.description).toContain('content');
    });

    it('should have criteria property', () => {
      const prop = toolDef.declaration.inputSchema.properties.criteria;
      expect(prop.type).toBe('string');
      expect(prop.description).toContain('criteria');
    });

    it('should have goalContext property', () => {
      const prop = toolDef.declaration.inputSchema.properties.goalContext;
      expect(prop.type).toBe('string');
      expect(prop.description).toContain('goal');
    });

    it('should have all required fields marked as required', () => {
      const required = toolDef.declaration.inputSchema.required;
      expect(required).toContain('contentToEvaluate');
      expect(required).toContain('criteria');
      expect(required).toContain('goalContext');
    });
  });

  describe('Prompt Template', () => {
    it('should have prompt template', () => {
      expect(toolDef.prompt).toBeDefined();
      expect(toolDef.prompt.length).toBeGreaterThan(0);
    });

    it('should include Evaluator-X0 role', () => {
      expect(toolDef.prompt).toContain('Evaluator-X0');
    });

    it('should have placeholder for goal context', () => {
      expect(toolDef.prompt).toContain('[[GOAL_CONTEXT]]');
    });

    it('should have placeholder for criteria', () => {
      expect(toolDef.prompt).toContain('[[EVALUATION_CRITERIA]]');
    });

    it('should have placeholder for target content', () => {
      expect(toolDef.prompt).toContain('[[TARGET_CONTENT]]');
    });

    it('should specify JSON response format', () => {
      expect(toolDef.prompt).toContain('```json');
      expect(toolDef.prompt).toContain('evaluation_score');
      expect(toolDef.prompt).toContain('evaluation_report');
    });

    it('should specify score range', () => {
      expect(toolDef.prompt).toContain('0.0');
      expect(toolDef.prompt).toContain('1.0');
    });
  });

  describe('Tool Usage', () => {
    it('should accept valid input', () => {
      const input = {
        contentToEvaluate: "Test content",
        criteria: "Test criteria",
        goalContext: "Test goal"
      };

      // Validate against schema
      const props = toolDef.declaration.inputSchema.properties;
      expect(typeof input.contentToEvaluate).toBe(props.contentToEvaluate.type);
      expect(typeof input.criteria).toBe(props.criteria.type);
      expect(typeof input.goalContext).toBe(props.goalContext.type);
    });

    it('should flag missing required fields', () => {
      const invalidInput = {
        contentToEvaluate: "Test"
        // missing criteria and goalContext
      };

      const required = toolDef.declaration.inputSchema.required;
      const missingFields = required.filter(field => !Object.keys(invalidInput).includes(field));

      expect(missingFields).toContain('criteria');
      expect(missingFields).toContain('goalContext');
    });

    it('should validate all required fields present', () => {
      const validInput = {
        contentToEvaluate: "Test content",
        criteria: "Test criteria",
        goalContext: "Test goal"
      };

      const required = toolDef.declaration.inputSchema.required;
      const hasAllRequired = required.every(field => Object.keys(validInput).includes(field));

      expect(hasAllRequired).toBe(true);
    });
  });

  describe('Expected Output Format', () => {
    it('should expect evaluation_score field', () => {
      expect(toolDef.prompt).toContain('"evaluation_score": float');
    });

    it('should expect evaluation_report field', () => {
      expect(toolDef.prompt).toContain('"evaluation_report": "string"');
    });

    it('should expect JSON format', () => {
      const jsonMatch = toolDef.prompt.match(/```json[\s\S]*?```/);
      expect(jsonMatch).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should be usable as tool definition', () => {
      expect(toolDef.declaration).toHaveProperty('name');
      expect(toolDef.declaration).toHaveProperty('description');
      expect(toolDef.declaration).toHaveProperty('inputSchema');
      expect(toolDef).toHaveProperty('prompt');
    });

    it('should have complete schema structure', () => {
      const schema = toolDef.declaration.inputSchema;
      expect(schema).toHaveProperty('type');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      expect(Object.keys(schema.properties).length).toBe(3);
    });
  });
});
