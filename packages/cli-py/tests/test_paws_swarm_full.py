#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for paws_swarm.py
Tests SwarmOrchestrator and related classes
"""

import unittest
import os
import sys
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import patch, Mock, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

import paws.swarm
from paws.swarm import (
    AgentRole, SwarmAgent, SwarmMessage, TaskDecomposition, SwarmOrchestrator
)
from paws.paxos import CompetitorConfig


class TestAgentRole(unittest.TestCase):
    """Test AgentRole enum"""

    def test_agent_roles_exist(self):
        """Test all agent roles are defined"""
        self.assertEqual(AgentRole.ARCHITECT.value, "architect")
        self.assertEqual(AgentRole.IMPLEMENTER.value, "implementer")
        self.assertEqual(AgentRole.REVIEWER.value, "reviewer")
        self.assertEqual(AgentRole.TESTER.value, "tester")

    def test_agent_role_comparison(self):
        """Test agent role comparisons"""
        role1 = AgentRole.ARCHITECT
        role2 = AgentRole.ARCHITECT
        role3 = AgentRole.IMPLEMENTER

        self.assertEqual(role1, role2)
        self.assertNotEqual(role1, role3)


class TestSwarmAgent(unittest.TestCase):
    """Test SwarmAgent dataclass"""

    def setUp(self):
        self.config = CompetitorConfig(
            name="Test Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

    def test_swarm_agent_creation(self):
        """Test creating SwarmAgent"""
        agent = SwarmAgent(
            name="agent1",
            role=AgentRole.ARCHITECT,
            config=self.config
        )

        self.assertEqual(agent.name, "agent1")
        self.assertEqual(agent.role, AgentRole.ARCHITECT)
        self.assertEqual(agent.config, self.config)
        self.assertIsNone(agent._client)

    def test_swarm_agent_client_lazy_loading(self):
        """Test lazy loading of LLM client (lines 43-48)"""
        agent = SwarmAgent(
            name="agent1",
            role=AgentRole.IMPLEMENTER,
            config=self.config
        )

        # Client should be None initially
        self.assertIsNone(agent._client)

        # Mock LLMClient to avoid actual API calls
        with patch('paws.swarm.LLMClient') as mock_llm:
            mock_client = Mock()
            mock_llm.return_value = mock_client

            # Access client property
            client = agent.client

            # Should create client
            mock_llm.assert_called_once_with(self.config)
            self.assertEqual(client, mock_client)

            # Second access should reuse same client
            client2 = agent.client
            self.assertEqual(client, client2)
            # LLMClient should still only be called once
            self.assertEqual(mock_llm.call_count, 1)


class TestSwarmMessage(unittest.TestCase):
    """Test SwarmMessage dataclass"""

    def test_swarm_message_creation(self):
        """Test creating SwarmMessage"""
        message = SwarmMessage(
            from_agent="agent1",
            to_agent="agent2",
            round_num=1,
            content="Test message",
            message_type="proposal"
        )

        self.assertEqual(message.from_agent, "agent1")
        self.assertEqual(message.to_agent, "agent2")
        self.assertEqual(message.round_num, 1)
        self.assertEqual(message.content, "Test message")
        self.assertEqual(message.message_type, "proposal")

    def test_broadcast_message(self):
        """Test broadcast message with None to_agent"""
        message = SwarmMessage(
            from_agent="agent1",
            to_agent=None,  # Broadcast
            round_num=2,
            content="Broadcast",
            message_type="vote"
        )

        self.assertIsNone(message.to_agent)


class TestTaskDecomposition(unittest.TestCase):
    """Test TaskDecomposition dataclass"""

    def test_task_decomposition_creation(self):
        """Test creating TaskDecomposition"""
        task = TaskDecomposition(
            task_id="task_1",
            description="Implement feature X"
        )

        self.assertEqual(task.task_id, "task_1")
        self.assertEqual(task.description, "Implement feature X")
        self.assertEqual(len(task.subtasks), 0)
        self.assertIsNone(task.assigned_to)
        self.assertEqual(task.status, "pending")
        self.assertIsNone(task.solution)

    def test_task_decomposition_with_subtasks(self):
        """Test hierarchical task decomposition"""
        subtask1 = TaskDecomposition(
            task_id="task_1.1",
            description="Subtask 1"
        )
        subtask2 = TaskDecomposition(
            task_id="task_1.2",
            description="Subtask 2"
        )

        parent_task = TaskDecomposition(
            task_id="task_1",
            description="Parent task",
            subtasks=[subtask1, subtask2],
            assigned_to="agent1",
            status="in_progress",
            solution="Partial solution"
        )

        self.assertEqual(len(parent_task.subtasks), 2)
        self.assertEqual(parent_task.assigned_to, "agent1")
        self.assertEqual(parent_task.status, "in_progress")
        self.assertEqual(parent_task.solution, "Partial solution")


class TestSwarmOrchestrator(unittest.TestCase):
    """Test SwarmOrchestrator class"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="swarm_test_"))

        # Create test context bundle
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("""
# Context Bundle
Test context for swarm orchestrator
""")

        self.config1 = CompetitorConfig(
            name="Architect Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        self.config2 = CompetitorConfig(
            name="Implementer Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_orchestrator_initialization(self):
        """Test SwarmOrchestrator initialization (lines 75-87)"""
        orchestrator = SwarmOrchestrator(
            task="Implement feature X",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        self.assertEqual(orchestrator.task, "Implement feature X")
        self.assertTrue((self.test_dir / "output").exists())
        self.assertIn("Context Bundle", orchestrator.context_content)
        self.assertEqual(len(orchestrator.agents), 0)
        self.assertEqual(len(orchestrator.messages), 0)
        self.assertIsNone(orchestrator.task_tree)

    def test_add_agent(self):
        """Test adding agent to swarm (lines 89-91)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        agent = SwarmAgent(
            name="agent1",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )

        orchestrator.add_agent(agent)

        self.assertEqual(len(orchestrator.agents), 1)
        self.assertEqual(orchestrator.agents[0], agent)

    def test_get_agents_by_role(self):
        """Test getting agents by role (lines 93-95)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add agents with different roles
        agent1 = SwarmAgent(
            name="architect1",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )
        agent2 = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config2
        )
        agent3 = SwarmAgent(
            name="architect2",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )

        orchestrator.add_agent(agent1)
        orchestrator.add_agent(agent2)
        orchestrator.add_agent(agent3)

        # Get architects
        architects = orchestrator.get_agents_by_role(AgentRole.ARCHITECT)
        self.assertEqual(len(architects), 2)
        self.assertIn(agent1, architects)
        self.assertIn(agent3, architects)

        # Get implementers
        implementers = orchestrator.get_agents_by_role(AgentRole.IMPLEMENTER)
        self.assertEqual(len(implementers), 1)
        self.assertIn(agent2, implementers)

        # Get testers (none added)
        testers = orchestrator.get_agents_by_role(AgentRole.TESTER)
        self.assertEqual(len(testers), 0)

    def test_decompose_task_no_architects(self):
        """Test task decomposition without architects (lines 105-111)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Decompose without any agents
        task = orchestrator.decompose_task()

        # Should create fallback single task
        self.assertEqual(task.task_id, "task_1")
        self.assertEqual(task.description, "Test task")
        self.assertEqual(len(task.subtasks), 0)

    def test_decompose_task_with_architect(self):
        """Test task decomposition with architect (lines 140-175)"""
        orchestrator = SwarmOrchestrator(
            task="Implement feature X",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add architect agent
        agent = SwarmAgent(
            name="architect1",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )
        orchestrator.add_agent(agent)

        # Mock the LLM client by patching _client field
        mock_client = Mock()
        mock_client.generate.return_value = ("""
{
  "subtasks": [
    {"id": "1", "description": "Subtask 1"},
    {"id": "2", "description": "Subtask 2"}
  ]
}
""", 100)
        agent._client = mock_client

        # Decompose task
        with patch('sys.stdout', new=MagicMock()):  # Suppress output
            task = orchestrator.decompose_task()

        # Should have called LLM
        self.assertTrue(mock_client.generate.called)
        # Should have created task tree
        self.assertEqual(task.task_id, "root")
        self.assertEqual(len(task.subtasks), 2)
        self.assertEqual(task.subtasks[0].task_id, "1")
        self.assertEqual(task.subtasks[1].task_id, "2")

    def test_decompose_task_parse_error_fallback(self):
        """Test task decomposition fallback on parse error (lines 167-175)"""
        orchestrator = SwarmOrchestrator(
            task="Implement feature X",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add architect agent
        agent = SwarmAgent(
            name="architect1",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )
        orchestrator.add_agent(agent)

        # Mock the LLM client to return invalid JSON
        mock_client = Mock()
        mock_client.generate.return_value = ("This is not valid JSON", 50)
        agent._client = mock_client

        # Decompose task
        with patch('sys.stdout', new=MagicMock()):
            task = orchestrator.decompose_task()

        # Should fall back to single task
        self.assertEqual(task.task_id, "task_1")
        self.assertEqual(task.description, "Implement feature X")
        self.assertEqual(len(task.subtasks), 0)

    def test_solve_subtask_collaboratively(self):
        """Test collaborative subtask solving (lines 177-217)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add implementer and reviewer agents
        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config1
        )
        reviewer = SwarmAgent(
            name="reviewer1",
            role=AgentRole.REVIEWER,
            config=self.config2
        )
        orchestrator.add_agent(implementer)
        orchestrator.add_agent(reviewer)

        # Mock LLM clients
        impl_client = Mock()
        impl_client.generate.return_value = ("Initial solution", 100)
        implementer._client = impl_client

        rev_client = Mock()
        rev_client.generate.return_value = ("LGTM: Looks good!", 50)
        reviewer._client = rev_client

        # Create subtask
        subtask = TaskDecomposition(
            task_id="test_1",
            description="Test subtask"
        )

        # Solve collaboratively
        with patch('sys.stdout', new=MagicMock()):
            solution = orchestrator.solve_subtask_collaboratively(subtask, round_limit=3)

        # Should return solution
        self.assertEqual(solution, "Initial solution")
        # Should have generated initial solution
        self.assertTrue(impl_client.generate.called)
        # Should have reviewed
        self.assertTrue(rev_client.generate.called)
        # Should have messages
        self.assertGreater(len(orchestrator.messages), 0)

    def test_solve_subtask_no_implementer(self):
        """Test collaborative solving without implementer (lines 190-192)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        subtask = TaskDecomposition(
            task_id="test_1",
            description="Test subtask"
        )

        # Solve without implementer
        with patch('sys.stdout', new=MagicMock()):
            solution = orchestrator.solve_subtask_collaboratively(subtask)

        # Should return empty string
        self.assertEqual(solution, "")

    def test_solve_subtask_needs_revision(self):
        """Test collaborative solving with revision (lines 201-217)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add implementer and reviewer
        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config1
        )
        reviewer = SwarmAgent(
            name="reviewer1",
            role=AgentRole.REVIEWER,
            config=self.config2
        )
        orchestrator.add_agent(implementer)
        orchestrator.add_agent(reviewer)

        # Mock LLM clients
        impl_client = Mock()
        impl_client.generate.side_effect = [
            ("Initial solution", 100),        # Initial
            ("Revised solution v1", 120),     # After revision round 2
            ("Revised solution v2", 130)      # After revision round 3
        ]
        implementer._client = impl_client

        rev_client = Mock()
        rev_client.generate.return_value = ("Needs improvement: Add error handling", 50)
        reviewer._client = rev_client

        # Create subtask
        subtask = TaskDecomposition(
            task_id="test_1",
            description="Test subtask"
        )

        # Solve collaboratively
        with patch('sys.stdout', new=MagicMock()):
            solution = orchestrator.solve_subtask_collaboratively(subtask, round_limit=3)

        # Should return final revised solution
        self.assertEqual(solution, "Revised solution v2")
        # Implementer should be called three times (initial + 2 revisions for rounds 2 and 3)
        self.assertEqual(impl_client.generate.call_count, 3)

    def test_generate_initial_solution(self):
        """Test initial solution generation (lines 219-253)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config1
        )

        # Mock LLM client
        mock_client = Mock()
        mock_client.generate.return_value = ("Solution code here", 100)
        implementer._client = mock_client

        subtask = TaskDecomposition(
            task_id="test_1",
            description="Implement feature"
        )

        # Generate initial solution
        with patch('sys.stdout', new=MagicMock()):
            solution = orchestrator._generate_initial_solution(implementer, subtask)

        # Should return solution
        self.assertEqual(solution, "Solution code here")
        # Should have saved message
        self.assertEqual(len(orchestrator.messages), 1)
        self.assertEqual(orchestrator.messages[0].message_type, "proposal")

    def test_generate_critique(self):
        """Test critique generation (lines 255-291)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        reviewer = SwarmAgent(
            name="reviewer1",
            role=AgentRole.REVIEWER,
            config=self.config1
        )

        # Mock LLM client
        mock_client = Mock()
        mock_client.generate.return_value = ("Needs improvement", 80)
        reviewer._client = mock_client

        subtask = TaskDecomposition(
            task_id="test_1",
            description="Implement feature"
        )

        # Generate critique
        with patch('sys.stdout', new=MagicMock()):
            critique = orchestrator._generate_critique(reviewer, subtask, "Solution here")

        # Should return critique
        self.assertEqual(critique, "Needs improvement")
        # Should have saved message
        self.assertEqual(len(orchestrator.messages), 1)
        self.assertEqual(orchestrator.messages[0].message_type, "critique")

    def test_revise_solution(self):
        """Test solution revision (lines 293-325)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config1
        )

        # Mock LLM client
        mock_client = Mock()
        mock_client.generate.return_value = ("Revised solution", 120)
        implementer._client = mock_client

        subtask = TaskDecomposition(
            task_id="test_1",
            description="Implement feature"
        )

        # Revise solution
        with patch('sys.stdout', new=MagicMock()):
            revised = orchestrator._revise_solution(
                implementer, subtask, "Original solution", "Needs improvement"
            )

        # Should return revised solution
        self.assertEqual(revised, "Revised solution")
        # Should have saved message
        self.assertEqual(len(orchestrator.messages), 1)
        self.assertEqual(orchestrator.messages[0].message_type, "revision")

    def test_merge_solutions_no_architect(self):
        """Test merging solutions without architect (lines 327-337)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        solutions = {
            "task_1": "Solution 1",
            "task_2": "Solution 2"
        }

        # Merge without architect
        with patch('sys.stdout', new=MagicMock()):
            merged = orchestrator.merge_solutions(solutions)

        # Should concatenate solutions
        self.assertIn("Solution 1", merged)
        self.assertIn("Solution 2", merged)

    def test_merge_solutions_with_architect(self):
        """Test merging solutions with architect (lines 334-364)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add architect
        architect = SwarmAgent(
            name="architect1",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )
        orchestrator.add_agent(architect)

        # Mock LLM client
        mock_client = Mock()
        mock_client.generate.return_value = ("Merged solution", 200)
        architect._client = mock_client

        solutions = {
            "task_1": "Solution 1",
            "task_2": "Solution 2"
        }

        # Merge with architect
        with patch('sys.stdout', new=MagicMock()):
            merged = orchestrator.merge_solutions(solutions)

        # Should return merged solution from architect
        self.assertEqual(merged, "Merged solution")
        self.assertTrue(mock_client.generate.called)

    def test_merge_solutions_single_solution(self):
        """Test merging with single solution (line 335-337)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add architect but only one solution
        architect = SwarmAgent(
            name="architect1",
            role=AgentRole.ARCHITECT,
            config=self.config1
        )
        orchestrator.add_agent(architect)

        solutions = {
            "task_1": "Only solution"
        }

        # Merge single solution
        with patch('sys.stdout', new=MagicMock()):
            merged = orchestrator.merge_solutions(solutions)

        # Should just return the single solution
        self.assertEqual(merged, "Only solution")


class TestSwarmEdgeCases(unittest.TestCase):
    """Test edge cases"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="swarm_edge_"))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_orchestrator_with_empty_context(self):
        """Test orchestrator with empty context file"""
        context_file = self.test_dir / "empty.md"
        context_file.write_text("")

        orchestrator = SwarmOrchestrator(
            task="Test",
            context_bundle=str(context_file),
            output_dir=str(self.test_dir / "out")
        )

        self.assertEqual(orchestrator.context_content, "")

    def test_multiple_agents_same_role(self):
        """Test adding multiple agents with same role"""
        context_file = self.test_dir / "context.md"
        context_file.write_text("test")

        orchestrator = SwarmOrchestrator(
            task="Test",
            context_bundle=str(context_file),
            output_dir=str(self.test_dir / "out")
        )

        config = CompetitorConfig(
            name="Agent",
            model_id="gemini-pro",
            provider="gemini",
            api_key="key"
        )

        # Add multiple architects
        for i in range(3):
            agent = SwarmAgent(
                name=f"architect{i}",
                role=AgentRole.ARCHITECT,
                config=config
            )
            orchestrator.add_agent(agent)

        # Should have all 3 architects
        architects = orchestrator.get_agents_by_role(AgentRole.ARCHITECT)
        self.assertEqual(len(architects), 3)


class TestSwarmRunSwarm(unittest.TestCase):
    """Test run_swarm orchestration method"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="swarm_run_"))

        # Create test context bundle
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("# Test Context\nSample context for testing")

        self.config1 = CompetitorConfig(
            name="Architect",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

        self.config2 = CompetitorConfig(
            name="Implementer",
            model_id="gemini-pro",
            provider="gemini",
            api_key="test_key"
        )

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_run_swarm_no_subtasks(self):
        """Test run_swarm with no subtasks (lines 385-392)"""
        orchestrator = SwarmOrchestrator(
            task="Simple task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add implementer agent
        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config2
        )
        orchestrator.add_agent(implementer)

        # Mock decompose_task to return no subtasks
        mock_task_tree = TaskDecomposition(
            task_id="root",
            description="Simple task",
            subtasks=[]
        )

        # Mock the methods
        with patch.object(orchestrator, 'decompose_task', return_value=mock_task_tree):
            with patch.object(orchestrator, '_generate_initial_solution', return_value="Single solution"):
                with patch.object(orchestrator, 'merge_solutions', return_value="Final solution"):
                    with patch('sys.stdout', new=MagicMock()):
                        output_path = orchestrator.run_swarm()

        # Check output path exists
        self.assertTrue(Path(output_path).exists())

        # Check solution was saved
        with open(output_path, 'r') as f:
            content = f.read()
        self.assertEqual(content, "Final solution")

    def test_run_swarm_with_subtasks(self):
        """Test run_swarm with multiple subtasks (lines 393-397)"""
        orchestrator = SwarmOrchestrator(
            task="Complex task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add agents
        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config2
        )
        orchestrator.add_agent(implementer)

        # Mock decompose_task to return multiple subtasks
        subtask1 = TaskDecomposition(task_id="sub1", description="Subtask 1")
        subtask2 = TaskDecomposition(task_id="sub2", description="Subtask 2")
        mock_task_tree = TaskDecomposition(
            task_id="root",
            description="Complex task",
            subtasks=[subtask1, subtask2]
        )

        # Mock the methods
        with patch.object(orchestrator, 'decompose_task', return_value=mock_task_tree):
            with patch.object(orchestrator, 'solve_subtask_collaboratively') as mock_solve:
                mock_solve.side_effect = ["Solution 1", "Solution 2"]
                with patch.object(orchestrator, 'merge_solutions', return_value="Merged solution"):
                    with patch('sys.stdout', new=MagicMock()):
                        output_path = orchestrator.run_swarm()

        # Check solve_subtask_collaboratively was called for each subtask
        self.assertEqual(mock_solve.call_count, 2)

        # Check output path exists
        self.assertTrue(Path(output_path).exists())

        # Check solution was saved
        with open(output_path, 'r') as f:
            content = f.read()
        self.assertEqual(content, "Merged solution")

    def test_run_swarm_output_file_created(self):
        """Test run_swarm creates output file (lines 402-410)"""
        orchestrator = SwarmOrchestrator(
            task="Test task",
            context_bundle=str(self.context_file),
            output_dir=str(self.test_dir / "output")
        )

        # Add implementer
        implementer = SwarmAgent(
            name="implementer1",
            role=AgentRole.IMPLEMENTER,
            config=self.config2
        )
        orchestrator.add_agent(implementer)

        # Mock methods
        mock_task_tree = TaskDecomposition(task_id="root", description="Test", subtasks=[])

        with patch.object(orchestrator, 'decompose_task', return_value=mock_task_tree):
            with patch.object(orchestrator, '_generate_initial_solution', return_value="Test solution"):
                with patch.object(orchestrator, 'merge_solutions', return_value="Final output"):
                    with patch('sys.stdout', new=MagicMock()):
                        output_path = orchestrator.run_swarm()

        # Check the file path format
        self.assertTrue(output_path.endswith("swarm_solution.dogs.md"))

        # Check file exists and contains correct content
        self.assertTrue(Path(output_path).exists())
        with open(output_path, 'r') as f:
            content = f.read()
        self.assertEqual(content, "Final output")


class TestSwarmMain(unittest.TestCase):
    """Test main() CLI function"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="swarm_main_"))

        # Create test context file
        self.context_file = self.test_dir / "context.md"
        self.context_file.write_text("# Test Context")

        # Create test config file
        self.config_file = self.test_dir / "test_config.json"
        config_data = {
            "competitors": [
                {
                    "name": "Agent1",
                    "model_id": "gemini-pro",
                    "provider": "gemini",
                    "persona": None,
                    "temperature": 0.7,
                    "max_tokens": 4000
                },
                {
                    "name": "Agent2",
                    "model_id": "gemini-flash",
                    "provider": "gemini",
                    "persona": None
                },
                {
                    "name": "Agent3",
                    "model_id": "gemini-pro",
                    "provider": "gemini"
                }
            ]
        }
        self.config_file.write_text(json.dumps(config_data))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_main_with_arguments(self):
        """Test main() with command-line arguments (lines 424-431)"""
        test_args = [
            'paws_swarm.py',
            'Test task description',
            str(self.context_file),
            '--config', str(self.config_file),
            '--output-dir', str(self.test_dir / "output"),
            '--rounds', '5'
        ]

        with patch('sys.argv', test_args):
            with patch.object(SwarmOrchestrator, 'run_swarm', return_value=str(self.test_dir / "output.md")):
                with patch('sys.stdout', new=MagicMock()):
                    result = paws.swarm.main()

        self.assertEqual(result, 0)

    def test_main_with_interactive_prompts(self):
        """Test main() with interactive prompts (lines 427-428)"""
        test_args = [
            'paws_swarm.py',
            '--config', str(self.config_file),
            '--output-dir', str(self.test_dir / "output")
        ]

        with patch('sys.argv', test_args):
            with patch('builtins.input') as mock_input:
                mock_input.side_effect = [
                    "Interactive task description",
                    str(self.context_file)
                ]
                with patch.object(SwarmOrchestrator, 'run_swarm', return_value=str(self.test_dir / "output.md")):
                    with patch('sys.stdout', new=MagicMock()):
                        result = paws.swarm.main()

        self.assertEqual(result, 0)
        # Check input was called twice
        self.assertEqual(mock_input.call_count, 2)

    def test_main_loads_config_and_assigns_roles(self):
        """Test main() loads config and assigns roles (lines 434-467)"""
        test_args = [
            'paws_swarm.py',
            'Test task',
            str(self.context_file),
            '--config', str(self.config_file)
        ]

        with patch('sys.argv', test_args):
            with patch.object(SwarmOrchestrator, 'run_swarm', return_value=str(self.test_dir / "output.md")):
                with patch.object(SwarmOrchestrator, 'add_agent') as mock_add_agent:
                    with patch('sys.stdout', new=MagicMock()):
                        result = paws.swarm.main()

        # Should have added 3 agents
        self.assertEqual(mock_add_agent.call_count, 3)

        # Check roles were assigned: first is architect, rest alternate
        calls = mock_add_agent.call_args_list
        self.assertEqual(calls[0][0][0].role, AgentRole.ARCHITECT)  # Agent 0
        self.assertEqual(calls[1][0][0].role, AgentRole.IMPLEMENTER)  # Agent 1 (odd)
        self.assertEqual(calls[2][0][0].role, AgentRole.REVIEWER)  # Agent 2 (even)

        self.assertEqual(result, 0)

    def test_main_config_file_not_found(self):
        """Test main() with missing config file (lines 468-470)"""
        test_args = [
            'paws_swarm.py',
            'Test task',
            str(self.context_file),
            '--config', str(self.test_dir / "nonexistent.json")
        ]

        with patch('sys.argv', test_args):
            with patch('sys.stdout', new=MagicMock()):
                result = paws.swarm.main()

        # Should return error code
        self.assertEqual(result, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
