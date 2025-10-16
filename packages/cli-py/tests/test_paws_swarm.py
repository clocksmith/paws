#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test suite for paws_swarm.py
"""

import unittest
import tempfile
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from paws.swarm import (
    AgentRole,
    SwarmAgent,
    SwarmMessage,
    TaskDecomposition,
    SwarmOrchestrator
)
from paws.paxos import CompetitorConfig


class TestAgentRole(unittest.TestCase):
    """Test AgentRole enum"""

    def test_all_roles_exist(self):
        """Test that all expected roles exist"""
        self.assertTrue(hasattr(AgentRole, 'ARCHITECT'))
        self.assertTrue(hasattr(AgentRole, 'IMPLEMENTER'))
        self.assertTrue(hasattr(AgentRole, 'REVIEWER'))
        self.assertTrue(hasattr(AgentRole, 'TESTER'))

    def test_role_values(self):
        """Test role enum values"""
        self.assertEqual(AgentRole.ARCHITECT.value, "architect")
        self.assertEqual(AgentRole.IMPLEMENTER.value, "implementer")
        self.assertEqual(AgentRole.REVIEWER.value, "reviewer")
        self.assertEqual(AgentRole.TESTER.value, "tester")


class TestSwarmAgent(unittest.TestCase):
    """Test SwarmAgent class"""

    def test_create_agent(self):
        """Test creating a swarm agent"""
        config = CompetitorConfig(
            name="TestAgent",
            model_id="gemini-pro"
        )
        agent = SwarmAgent(
            name="Architect1",
            role=AgentRole.ARCHITECT,
            config=config
        )
        self.assertEqual(agent.name, "Architect1")
        self.assertEqual(agent.role, AgentRole.ARCHITECT)
        self.assertEqual(agent.config.model_id, "gemini-pro")

    def test_lazy_client_loading(self):
        """Test that LLM client is lazily loaded"""
        config = CompetitorConfig(
            name="TestAgent",
            model_id="gemini-pro",
            api_key="test-key"
        )
        agent = SwarmAgent(
            name="TestAgent",
            role=AgentRole.IMPLEMENTER,
            config=config
        )

        # Client should not be initialized yet
        self.assertIsNone(agent._client)

        # Accessing client property should initialize it (but will fail without proper setup)
        # We just verify the property exists
        self.assertTrue(hasattr(agent, 'client'))


class TestSwarmMessage(unittest.TestCase):
    """Test SwarmMessage class"""

    def test_create_message(self):
        """Test creating a swarm message"""
        message = SwarmMessage(
            from_agent="Agent1",
            to_agent="Agent2",
            round_num=1,
            content="Here's my proposal",
            message_type="proposal"
        )
        self.assertEqual(message.from_agent, "Agent1")
        self.assertEqual(message.to_agent, "Agent2")
        self.assertEqual(message.round_num, 1)
        self.assertEqual(message.message_type, "proposal")

    def test_broadcast_message(self):
        """Test creating a broadcast message"""
        message = SwarmMessage(
            from_agent="Coordinator",
            to_agent=None,  # Broadcast
            round_num=0,
            content="Starting collaboration",
            message_type="announcement"
        )
        self.assertIsNone(message.to_agent)


class TestTaskDecomposition(unittest.TestCase):
    """Test TaskDecomposition class"""

    def test_create_simple_task(self):
        """Test creating a simple task"""
        task = TaskDecomposition(
            task_id="task_1",
            description="Implement feature X"
        )
        self.assertEqual(task.task_id, "task_1")
        self.assertEqual(task.description, "Implement feature X")
        self.assertEqual(len(task.subtasks), 0)
        self.assertEqual(task.status, "pending")

    def test_create_hierarchical_task(self):
        """Test creating a task with subtasks"""
        subtask1 = TaskDecomposition(
            task_id="task_1.1",
            description="Design API"
        )
        subtask2 = TaskDecomposition(
            task_id="task_1.2",
            description="Implement logic"
        )

        main_task = TaskDecomposition(
            task_id="task_1",
            description="Build feature",
            subtasks=[subtask1, subtask2]
        )

        self.assertEqual(len(main_task.subtasks), 2)
        self.assertEqual(main_task.subtasks[0].task_id, "task_1.1")

    def test_task_assignment(self):
        """Test assigning a task to an agent"""
        task = TaskDecomposition(
            task_id="task_1",
            description="Write tests",
            assigned_to="Agent1",
            status="in_progress"
        )
        self.assertEqual(task.assigned_to, "Agent1")
        self.assertEqual(task.status, "in_progress")


class TestSwarmOrchestrator(unittest.TestCase):
    """Test SwarmOrchestrator class"""

    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="paws_swarm_test_"))

        # Create a test context bundle
        self.context_file = self.temp_dir / "context.md"
        self.context_file.write_text("# Test Project\nSome context about the project")

        self.output_dir = self.temp_dir / "output"
        self.orchestrator = SwarmOrchestrator(
            task="Build a calculator app",
            context_bundle=str(self.context_file),
            output_dir=str(self.output_dir)
        )

    def tearDown(self):
        """Clean up test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_init_creates_output_dir(self):
        """Test that initialization creates output directory"""
        self.assertTrue(self.output_dir.exists())

    def test_init_loads_context(self):
        """Test that initialization loads context content"""
        self.assertIn("Test Project", self.orchestrator.context_content)

    def test_add_agent(self):
        """Test adding an agent to the swarm"""
        config = CompetitorConfig(name="A1", model_id="gemini-pro")
        agent = SwarmAgent(name="A1", role=AgentRole.ARCHITECT, config=config)

        self.orchestrator.add_agent(agent)
        self.assertEqual(len(self.orchestrator.agents), 1)
        self.assertEqual(self.orchestrator.agents[0].name, "A1")

    def test_get_agents_by_role(self):
        """Test filtering agents by role"""
        config1 = CompetitorConfig(name="A1", model_id="gemini-pro")
        config2 = CompetitorConfig(name="A2", model_id="gpt-4")
        config3 = CompetitorConfig(name="A3", model_id="claude-3")

        agent1 = SwarmAgent(name="A1", role=AgentRole.ARCHITECT, config=config1)
        agent2 = SwarmAgent(name="A2", role=AgentRole.IMPLEMENTER, config=config2)
        agent3 = SwarmAgent(name="A3", role=AgentRole.ARCHITECT, config=config3)

        self.orchestrator.add_agent(agent1)
        self.orchestrator.add_agent(agent2)
        self.orchestrator.add_agent(agent3)

        architects = self.orchestrator.get_agents_by_role(AgentRole.ARCHITECT)
        implementers = self.orchestrator.get_agents_by_role(AgentRole.IMPLEMENTER)

        self.assertEqual(len(architects), 2)
        self.assertEqual(len(implementers), 1)
        self.assertEqual(implementers[0].name, "A2")

    def test_decompose_task_without_architects(self):
        """Test task decomposition when no architects are available"""
        # Add only implementer, no architect
        config = CompetitorConfig(name="Impl1", model_id="gemini-pro")
        agent = SwarmAgent(name="Impl1", role=AgentRole.IMPLEMENTER, config=config)
        self.orchestrator.add_agent(agent)

        # Should create a simple task without decomposition
        task = self.orchestrator.decompose_task()
        self.assertEqual(task.task_id, "task_1")
        self.assertEqual(task.description, self.orchestrator.task)
        self.assertEqual(len(task.subtasks), 0)

    def test_initial_state(self):
        """Test initial state of orchestrator"""
        self.assertEqual(len(self.orchestrator.agents), 0)
        self.assertEqual(len(self.orchestrator.messages), 0)
        self.assertIsNone(self.orchestrator.task_tree)

    def test_has_required_methods(self):
        """Test that orchestrator has expected methods"""
        self.assertTrue(hasattr(self.orchestrator, 'add_agent'))
        self.assertTrue(hasattr(self.orchestrator, 'get_agents_by_role'))
        self.assertTrue(hasattr(self.orchestrator, 'decompose_task'))
        self.assertTrue(hasattr(self.orchestrator, 'solve_subtask_collaboratively'))
        self.assertTrue(hasattr(self.orchestrator, 'merge_solutions'))
        self.assertTrue(hasattr(self.orchestrator, 'run_swarm'))


class TestIntegration(unittest.TestCase):
    """Integration tests for paws_swarm"""

    def test_full_workflow_setup(self):
        """Test setting up a complete swarm workflow"""
        with tempfile.TemporaryDirectory(prefix="paws_swarm_integration_") as temp_dir:
            temp_path = Path(temp_dir)

            # Create context
            context_file = temp_path / "context.md"
            context_file.write_text("# Project Context\nTest content")

            # Create orchestrator
            output_dir = temp_path / "output"
            orchestrator = SwarmOrchestrator(
                task="Implement feature",
                context_bundle=str(context_file),
                output_dir=str(output_dir)
            )

            # Add agents
            architect_config = CompetitorConfig(name="A", model_id="gemini-pro")
            implementer_config = CompetitorConfig(name="I", model_id="gpt-4")
            reviewer_config = CompetitorConfig(name="R", model_id="claude-3")

            orchestrator.add_agent(SwarmAgent("Arch1", AgentRole.ARCHITECT, architect_config))
            orchestrator.add_agent(SwarmAgent("Impl1", AgentRole.IMPLEMENTER, implementer_config))
            orchestrator.add_agent(SwarmAgent("Rev1", AgentRole.REVIEWER, reviewer_config))

            # Verify setup
            self.assertEqual(len(orchestrator.agents), 3)
            self.assertEqual(len(orchestrator.get_agents_by_role(AgentRole.ARCHITECT)), 1)
            self.assertEqual(len(orchestrator.get_agents_by_role(AgentRole.IMPLEMENTER)), 1)
            self.assertEqual(len(orchestrator.get_agents_by_role(AgentRole.REVIEWER)), 1)

    def test_message_flow(self):
        """Test message creation and flow"""
        messages = []

        # Round 1: Proposals
        messages.append(SwarmMessage(
            from_agent="Architect1",
            to_agent=None,
            round_num=1,
            content="Here's the design",
            message_type="proposal"
        ))

        # Round 2: Critiques
        messages.append(SwarmMessage(
            from_agent="Reviewer1",
            to_agent="Architect1",
            round_num=2,
            content="Consider edge cases",
            message_type="critique"
        ))

        # Round 3: Revisions
        messages.append(SwarmMessage(
            from_agent="Architect1",
            to_agent=None,
            round_num=3,
            content="Updated design",
            message_type="revision"
        ))

        self.assertEqual(len(messages), 3)
        self.assertEqual(messages[0].message_type, "proposal")
        self.assertEqual(messages[1].message_type, "critique")
        self.assertEqual(messages[2].message_type, "revision")


def suite():
    """Create test suite"""
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestAgentRole))
    suite.addTests(loader.loadTestsFromTestCase(TestSwarmAgent))
    suite.addTests(loader.loadTestsFromTestCase(TestSwarmMessage))
    suite.addTests(loader.loadTestsFromTestCase(TestTaskDecomposition))
    suite.addTests(loader.loadTestsFromTestCase(TestSwarmOrchestrator))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))

    return suite


if __name__ == '__main__':
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())
