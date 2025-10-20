#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAWS Swarm - Swarm Intelligence Coordinator

Unlike Paxos (competitive), Swarm enables agents to collaborate:
- Hierarchical task decomposition
- Real-time agent communication
- Multi-round consensus voting
- Specialized agent roles (architect, implementer, reviewer)
"""

import argparse
import json
import sys
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum


# Import from paws.paxos
from paws.paxos import LLMClient, CompetitorConfig


class AgentRole(Enum):
    """Specialized roles for swarm agents"""
    ARCHITECT = "architect"      # High-level design decisions
    IMPLEMENTER = "implementer"  # Code implementation
    REVIEWER = "reviewer"        # Code review and critique
    TESTER = "tester"           # Test case generation


@dataclass
class SwarmAgent:
    """An agent in the swarm with a specialized role"""
    name: str
    role: AgentRole
    config: CompetitorConfig
    _client: Optional[LLMClient] = field(default=None, repr=False)

    @property
    def client(self) -> LLMClient:
        """Lazy-load LLM client"""
        if self._client is None:
            self._client = LLMClient(self.config)
        return self._client


@dataclass
class SwarmMessage:
    """A message in the swarm communication protocol"""
    from_agent: str
    to_agent: Optional[str]  # None for broadcast
    round_num: int
    content: str
    message_type: str  # proposal, critique, revision, vote


@dataclass
class TaskDecomposition:
    """Hierarchical decomposition of a complex task"""
    task_id: str
    description: str
    subtasks: List['TaskDecomposition'] = field(default_factory=list)
    assigned_to: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed
    solution: Optional[str] = None


class SwarmOrchestrator:
    """Orchestrates collaborative multi-agent problem solving"""

    def __init__(self, task: str, context_bundle: str, output_dir: str = "workspace/swarm"):
        self.task = task
        self.context_bundle = context_bundle
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Load context
        with open(context_bundle, 'r', encoding='utf-8') as f:
            self.context_content = f.read()

        self.agents: List[SwarmAgent] = []
        self.messages: List[SwarmMessage] = []
        self.task_tree: Optional[TaskDecomposition] = None

    def add_agent(self, agent: SwarmAgent):
        """Add an agent to the swarm"""
        self.agents.append(agent)

    def get_agents_by_role(self, role: AgentRole) -> List[SwarmAgent]:
        """Get all agents with a specific role"""
        return [a for a in self.agents if a.role == role]

    def decompose_task(self) -> TaskDecomposition:
        """
        Use architect agents to decompose the main task into subtasks
        """
        print(f"\n☇ PHASE 1: TASK DECOMPOSITION")
        print(f"{'='*60}\n")

        architects = self.get_agents_by_role(AgentRole.ARCHITECT)
        if not architects:
            # Fallback: create a single task without decomposition
            return TaskDecomposition(
                task_id="task_1",
                description=self.task,
                subtasks=[]
            )

        # Ask architect to decompose the task
        architect = architects[0]

        prompt = f"""You are a senior software architect. Analyze this task and break it down into smaller, manageable subtasks.

TASK:
{self.task}

CONTEXT:
{self.context_content[:2000]}  # Truncated for brevity

INSTRUCTIONS:
Decompose this task into 2-5 clear subtasks that can be worked on semi-independently.
Return your response as JSON in this format:

{{
  "subtasks": [
    {{"id": "1", "description": "Subtask description"}},
    {{"id": "2", "description": "Another subtask"}}
  ]
}}
"""

        print(f"[{architect.name}] Decomposing task...")
        response, tokens = architect.client.generate(prompt)

        # Parse response
        try:
            # Extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                data = json.loads(json_match.group())
                subtasks = data.get("subtasks", [])

                task_tree = TaskDecomposition(
                    task_id="root",
                    description=self.task,
                    subtasks=[
                        TaskDecomposition(
                            task_id=st["id"],
                            description=st["description"]
                        )
                        for st in subtasks
                    ]
                )

                print(f"\n[{architect.name}] Task decomposed into {len(task_tree.subtasks)} subtasks:")
                for st in task_tree.subtasks:
                    print(f"  - {st.task_id}: {st.description[:60]}...")

                self.task_tree = task_tree
                return task_tree

        except Exception as e:
            print(f"[{architect.name}] Failed to parse decomposition: {e}")

        # Fallback
        return TaskDecomposition(
            task_id="task_1",
            description=self.task,
            subtasks=[]
        )

    def solve_subtask_collaboratively(self, subtask: TaskDecomposition, round_limit: int = 3) -> str:
        """
        Collaborative problem solving with multiple rounds:
        1. Implementer proposes solution
        2. Reviewer critiques
        3. Implementer revises
        """
        print(f"\n☇ SOLVING: {subtask.description[:60]}...")
        print(f"{'='*60}\n")

        implementers = self.get_agents_by_role(AgentRole.IMPLEMENTER)
        reviewers = self.get_agents_by_role(AgentRole.REVIEWER)

        if not implementers:
            print("No implementer agents available!")
            return ""

        implementer = implementers[0]
        reviewer = reviewers[0] if reviewers else None

        # Round 1: Initial proposal
        current_solution = self._generate_initial_solution(implementer, subtask)

        # Rounds 2+: Critique and revision
        for round_num in range(2, round_limit + 1):
            if not reviewer:
                break

            print(f"\n--- Round {round_num}: Review and Revision ---")

            # Reviewer critiques
            critique = self._generate_critique(reviewer, subtask, current_solution)

            if "LGTM" in critique or "looks good" in critique.lower():
                print(f"[{reviewer.name}] Approved solution")
                break

            # Implementer revises
            current_solution = self._revise_solution(implementer, subtask, current_solution, critique)

        return current_solution

    def _generate_initial_solution(self, implementer: SwarmAgent, subtask: TaskDecomposition) -> str:
        """Generate initial solution proposal"""
        print(f"[{implementer.name}] Generating initial solution...")

        prompt = f"""You are an experienced software engineer. Implement a solution for this subtask.

SUBTASK:
{subtask.description}

FULL CONTEXT:
{self.context_content}

INSTRUCTIONS:
Generate a complete solution using the DOGS format for file changes:

🐕 --- DOGS_START_FILE: path/to/file.py ---
```python
# Your implementation here
```
🐕 --- DOGS_END_FILE: path/to/file.py ---
"""

        response, tokens = implementer.client.generate(prompt)

        # Save message
        self.messages.append(SwarmMessage(
            from_agent=implementer.name,
            to_agent=None,
            round_num=1,
            content=response,
            message_type="proposal"
        ))

        print(f"[{implementer.name}] Generated solution ({tokens} tokens)")
        return response

    def _generate_critique(self, reviewer: SwarmAgent, subtask: TaskDecomposition, solution: str) -> str:
        """Generate critique of proposed solution"""
        print(f"[{reviewer.name}] Reviewing solution...")

        prompt = f"""You are a senior code reviewer. Review this solution and provide constructive feedback.

SUBTASK:
{subtask.description}

PROPOSED SOLUTION:
{solution}

INSTRUCTIONS:
Review the solution for:
- Correctness
- Code quality
- Edge cases
- Performance
- Security

If the solution is good, respond with "LGTM: [brief approval note]"
Otherwise, provide specific, actionable feedback for improvement.
"""

        response, tokens = reviewer.client.generate(prompt)

        # Save message
        self.messages.append(SwarmMessage(
            from_agent=reviewer.name,
            to_agent=None,
            round_num=2,
            content=response,
            message_type="critique"
        ))

        print(f"[{reviewer.name}] Review complete")
        return response

    def _revise_solution(self, implementer: SwarmAgent, subtask: TaskDecomposition,
                        original_solution: str, critique: str) -> str:
        """Revise solution based on critique"""
        print(f"[{implementer.name}] Revising based on feedback...")

        prompt = f"""You are revising your previous solution based on code review feedback.

SUBTASK:
{subtask.description}

YOUR PREVIOUS SOLUTION:
{original_solution}

REVIEWER FEEDBACK:
{critique}

INSTRUCTIONS:
Address the reviewer's feedback and provide an improved solution using the same DOGS format.
"""

        response, tokens = implementer.client.generate(prompt)

        # Save message
        self.messages.append(SwarmMessage(
            from_agent=implementer.name,
            to_agent=None,
            round_num=3,
            content=response,
            message_type="revision"
        ))

        print(f"[{implementer.name}] Revision complete")
        return response

    def merge_solutions(self, solutions: Dict[str, str]) -> str:
        """
        Merge multiple subtask solutions into a coherent whole
        """
        print(f"\n☇ PHASE 3: SOLUTION INTEGRATION")
        print(f"{'='*60}\n")

        architects = self.get_agents_by_role(AgentRole.ARCHITECT)
        if not architects or len(solutions) <= 1:
            # Just concatenate if no architect or only one solution
            return "\n\n".join(solutions.values())

        architect = architects[0]

        solutions_text = "\n\n---\n\n".join([
            f"SUBTASK: {task_id}\n{solution}"
            for task_id, solution in solutions.items()
        ])

        prompt = f"""You are integrating multiple subtask solutions into a coherent whole.

ORIGINAL TASK:
{self.task}

SUBTASK SOLUTIONS:
{solutions_text}

INSTRUCTIONS:
Merge these solutions into a single, coherent implementation.
Ensure proper integration, no conflicts, and consistent style.
Use the DOGS format for the final merged solution.
"""

        print(f"[{architect.name}] Integrating solutions...")
        response, tokens = architect.client.generate(prompt)
        print(f"[{architect.name}] Integration complete")

        return response

    def run_swarm(self) -> str:
        """
        Main swarm orchestration flow:
        1. Decompose task (Architect)
        2. Solve subtasks collaboratively (Implementer + Reviewer)
        3. Integrate solutions (Architect)
        """
        print(f"\n☇ Starting PAWS Swarm Intelligence")
        print(f"Task: {self.task[:80]}...")
        print(f"Agents: {len(self.agents)}")
        print()

        # Phase 1: Decomposition
        task_tree = self.decompose_task()

        # Phase 2: Collaborative solving
        print(f"\n☇ PHASE 2: COLLABORATIVE SOLVING")
        print(f"{'='*60}\n")

        if not task_tree.subtasks:
            # No decomposition, solve as single task
            implementer = self.get_agents_by_role(AgentRole.IMPLEMENTER)[0]
            solution = self._generate_initial_solution(
                implementer,
                TaskDecomposition(task_id="main", description=self.task)
            )
            solutions = {"main": solution}
        else:
            solutions = {}
            for subtask in task_tree.subtasks:
                solution = self.solve_subtask_collaboratively(subtask)
                solutions[subtask.task_id] = solution

        # Phase 3: Integration
        final_solution = self.merge_solutions(solutions)

        # Save final solution
        output_path = self.output_dir / "swarm_solution.dogs.md"
        with open(output_path, 'w') as f:
            f.write(final_solution)

        print(f"\n♲ Final solution saved to: {output_path}")
        print(f"♲ Total messages exchanged: {len(self.messages)}")

        return str(output_path)


def main():
    parser = argparse.ArgumentParser(
        description="PAWS Swarm - Collaborative multi-agent problem solving"
    )

    parser.add_argument("task", nargs='?', help="Task description")
    parser.add_argument("context_bundle", nargs='?', help="Context bundle path")
    parser.add_argument("--config", default="paxos_config.json", help="Agent config file")
    parser.add_argument("--output-dir", default="workspace/swarm", help="Output directory")
    parser.add_argument("--rounds", type=int, default=3, help="Max collaboration rounds")

    args = parser.parse_args()

    # Interactive prompts
    task = args.task or input("Enter task description:\n> ")
    context_bundle = args.context_bundle or input("Enter context bundle path:\n> ")

    # Create orchestrator
    orchestrator = SwarmOrchestrator(task, context_bundle, args.output_dir)

    # Load config and create agents
    try:
        with open(args.config, 'r') as f:
            config_data = json.load(f)

        # Create swarm with specialized roles
        competitors = config_data.get("competitors", [])

        # Assign roles (simple strategy: first is architect, rest split between implementer/reviewer)
        for i, comp in enumerate(competitors):
            provider = comp.get("provider", "gemini")

            if i == 0:
                role = AgentRole.ARCHITECT
            elif i % 2 == 1:
                role = AgentRole.IMPLEMENTER
            else:
                role = AgentRole.REVIEWER

            agent = SwarmAgent(
                name=comp["name"],
                role=role,
                config=CompetitorConfig(
                    name=comp["name"],
                    model_id=comp["model_id"],
                    persona_file=comp.get("persona"),
                    provider=provider,
                    temperature=comp.get("temperature", 0.7),
                    max_tokens=comp.get("max_tokens", 4000)
                )
            )

            orchestrator.add_agent(agent)
            print(f"Added agent: {agent.name} ({agent.role.value})")

    except FileNotFoundError:
        print(f"Error: Config file not found: {args.config}")
        return 1

    # Run swarm
    solution_path = orchestrator.run_swarm()

    print(f"\n☉ Swarm collaboration complete!")
    print(f"Review solution: paws-dogs {solution_path} --interactive")

    return 0


if __name__ == "__main__":
    sys.exit(main())
