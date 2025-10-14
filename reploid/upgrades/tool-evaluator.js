{
  "declaration": {
    "name": "run_self_evaluation",
    "description": "Executes a self-evaluation task using an LLM based on defined criteria and a target artifact or text.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "contentToEvaluate": {
          "type": "string",
          "description": "The explicit content (e.g., a proposed change description) to be evaluated."
        },
        "criteria": {
          "type": "string",
          "description": "The evaluation criteria, as a string. E.g., 'Does this proposal align with the primary goal? Is it specific and actionable?'"
        },
        "goalContext": {
          "type": "string",
          "description": "The relevant goal context against which the content should be evaluated."
        }
      },
      "required": ["contentToEvaluate", "criteria", "goalContext"]
    }
  },
  "prompt": "You are Evaluator-X0. Your sole task is to objectively evaluate the provided 'Target Content' against the 'Evaluation Criteria' within the 'Original Goal Context'. Provide a numerical score from 0.0 (total failure) to 1.0 (perfect alignment) and a concise, factual report explaining your reasoning. Focus only on the provided information.\n\n**Original Goal Context:**\n[[GOAL_CONTEXT]]\n\n**Evaluation Criteria:**\n[[EVALUATION_CRITERIA]]\n\n**Target Content to Evaluate:**\n[[TARGET_CONTENT]]\n\n**Your Response (JSON ONLY):**\n```json\n{\n  \"evaluation_score\": float,\n  \"evaluation_report\": \"string\"\n}\n```"
}