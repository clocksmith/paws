#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAWS Paxos - Multi-Agent Competitive Verification Orchestrator

Runs multiple LLM agents in parallel on the same task with:
- Isolated git worktree environments
- Automated test-driven verification
- Consensus-based solution selection
- Performance metrics and benchmarking
"""

import argparse
import json
import subprocess
import os
import sys
import uuid
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

# LLM API imports
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


@dataclass
class CompetitorConfig:
    """Configuration for a single competitor agent"""
    name: str
    model_id: str
    persona_file: Optional[str] = None
    api_key: Optional[str] = None
    provider: str = "gemini"  # gemini, claude, openai
    temperature: float = 0.7
    max_tokens: int = 4000


@dataclass
class CompetitionResult:
    """Result from a single competitor"""
    name: str
    model_id: str
    solution_path: str
    status: str  # PASS, FAIL, ERROR
    verification_output: str = ""
    execution_time: float = 0.0
    token_count: int = 0
    error_message: Optional[str] = None


class LLMClient:
    """Unified client for multiple LLM providers"""

    def __init__(self, config: CompetitorConfig):
        self.config = config
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the appropriate LLM client"""
        api_key = self.config.api_key or os.environ.get(f"{self.config.provider.upper()}_API_KEY")

        if not api_key:
            raise ValueError(f"No API key found for {self.config.provider}")

        if self.config.provider == "gemini":
            if not GEMINI_AVAILABLE:
                raise ImportError("google-generativeai not installed. Run: pip install google-generativeai")
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(self.config.model_id)

        elif self.config.provider == "claude":
            if not CLAUDE_AVAILABLE:
                raise ImportError("anthropic not installed. Run: pip install anthropic")
            self.client = anthropic.Anthropic(api_key=api_key)

        elif self.config.provider == "openai":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai not installed. Run: pip install openai")
            self.client = OpenAI(api_key=api_key)

        else:
            raise ValueError(f"Unknown provider: {self.config.provider}")

    def generate(self, prompt: str) -> tuple[str, int]:
        """
        Generate a response from the LLM
        Returns: (response_text, token_count)
        """
        if self.config.provider == "gemini":
            return self._generate_gemini(prompt)
        elif self.config.provider == "claude":
            return self._generate_claude(prompt)
        elif self.config.provider == "openai":
            return self._generate_openai(prompt)

    def _generate_gemini(self, prompt: str) -> tuple[str, int]:
        """Generate with Gemini"""
        response = self.client.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens,
            )
        )

        # Estimate token count (Gemini doesn't always provide this)
        token_count = len(response.text.split()) * 1.3  # Rough estimate
        return response.text, int(token_count)

    def _generate_claude(self, prompt: str) -> tuple[str, int]:
        """Generate with Claude"""
        response = self.client.messages.create(
            model=self.config.model_id,
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text
        token_count = response.usage.input_tokens + response.usage.output_tokens
        return text, token_count

    def _generate_openai(self, prompt: str) -> tuple[str, int]:
        """Generate with OpenAI"""
        response = self.client.chat.completions.create(
            model=self.config.model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens
        )

        text = response.choices[0].message.content
        token_count = response.usage.total_tokens
        return text, token_count


class PaxosOrchestrator:
    """Orchestrates multi-agent competition with Paxos-style consensus"""

    def __init__(self, task: str, context_bundle: str, verify_cmd: Optional[str],
                 output_dir: str = "workspace/competition"):
        self.task = task
        self.context_bundle = context_bundle
        self.verify_cmd = verify_cmd
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Load context
        with open(context_bundle, 'r', encoding='utf-8') as f:
            self.context_content = f.read()

    def load_competitors(self, config_path: str) -> List[CompetitorConfig]:
        """Load competitor configurations from JSON file"""
        with open(config_path, 'r') as f:
            config_data = json.load(f)

        competitors = []
        for comp in config_data.get("competitors", []):
            # Infer provider from model_id if not specified
            provider = comp.get("provider")
            if not provider:
                model_id = comp["model_id"].lower()
                if "gemini" in model_id:
                    provider = "gemini"
                elif "claude" in model_id:
                    provider = "claude"
                elif "gpt" in model_id or "davinci" in model_id:
                    provider = "openai"
                else:
                    provider = "gemini"  # default

            competitors.append(CompetitorConfig(
                name=comp["name"],
                model_id=comp["model_id"],
                persona_file=comp.get("persona"),
                provider=provider,
                temperature=comp.get("temperature", 0.7),
                max_tokens=comp.get("max_tokens", 4000)
            ))

        return competitors

    def build_prompt(self, competitor: CompetitorConfig) -> str:
        """Build the full prompt for a competitor"""
        prompt_parts = []

        # Add persona if specified
        if competitor.persona_file and Path(competitor.persona_file).exists():
            with open(competitor.persona_file, 'r') as f:
                prompt_parts.append(f.read())
                prompt_parts.append("\n")

        # Add task
        prompt_parts.append("--- TASK ---\n")
        prompt_parts.append(self.task)
        prompt_parts.append("\n\n")

        # Add context
        prompt_parts.append("--- CONTEXT ---\n")
        prompt_parts.append(self.context_content)
        prompt_parts.append("\n\n")

        # Add instructions
        prompt_parts.append("--- INSTRUCTIONS ---\n")
        prompt_parts.append("Generate a complete solution for the task above.\n")
        prompt_parts.append("Format your response as file changes using the DOGS format:\n\n")
        prompt_parts.append("🐕 --- DOGS_START_FILE: path/to/file.py ---\n")
        prompt_parts.append("```python\n")
        prompt_parts.append("# Your code here\n")
        prompt_parts.append("```\n")
        prompt_parts.append("🐕 --- DOGS_END_FILE: path/to/file.py ---\n")

        return "".join(prompt_parts)

    def run_competitor(self, competitor: CompetitorConfig) -> CompetitionResult:
        """Run a single competitor and verify their solution"""
        print(f"\n{'='*60}")
        print(f"☇ PHASE: PROPOSAL from Agent: {competitor.name}")
        print(f"{'='*60}")

        start_time = time.time()

        try:
            # 1. Generate solution
            print(f"[{competitor.name}] Generating solution...")
            client = LLMClient(competitor)
            prompt = self.build_prompt(competitor)

            solution_text, token_count = client.generate(prompt)

            # Save solution
            solution_path = self.output_dir / f"{competitor.name}_solution.dogs.md"
            with open(solution_path, 'w', encoding='utf-8') as f:
                f.write(solution_text)

            print(f"[{competitor.name}] Solution saved to {solution_path}")
            print(f"[{competitor.name}] Token count: {token_count}")

            # 2. Verify solution if verification command provided
            if self.verify_cmd:
                print(f"\n{'='*60}")
                print(f"⚘ PHASE: VERIFICATION for {competitor.name}")
                print(f"{'='*60}")

                verification_output = self.verify_solution(competitor.name, solution_path)
                status = "PASS" if "VERIFICATION PASSED" in verification_output else "FAIL"

                print(f"[{competitor.name}] Vote Result: {status}")
            else:
                status = "PASS"  # No verification requested
                verification_output = "No verification requested"

            execution_time = time.time() - start_time

            return CompetitionResult(
                name=competitor.name,
                model_id=competitor.model_id,
                solution_path=str(solution_path),
                status=status,
                verification_output=verification_output,
                execution_time=execution_time,
                token_count=token_count
            )

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Error: {str(e)}"
            print(f"[{competitor.name}] {error_msg}")

            return CompetitionResult(
                name=competitor.name,
                model_id=competitor.model_id,
                solution_path="",
                status="ERROR",
                verification_output="",
                execution_time=execution_time,
                token_count=0,
                error_message=error_msg
            )

    def verify_solution(self, competitor_name: str, solution_path: Path) -> str:
        """Verify a solution in an isolated environment"""
        # Create a temporary worktree for verification
        session_id = f"paxos-{competitor_name}-{uuid.uuid4().hex[:6]}"
        worktree_path = Path(f".paws_sessions/{session_id}")

        try:
            # Create worktree
            print(f"[{competitor_name}] Creating isolated environment...")
            result = subprocess.run(
                ["git", "worktree", "add", str(worktree_path), "HEAD"],
                capture_output=True,
                text=True,
                check=False
            )

            if result.returncode != 0:
                return f"VERIFICATION FAILED: Could not create worktree\n{result.stderr}"

            # Apply solution using dogs.py
            print(f"[{competitor_name}] Applying solution...")
            apply_result = subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).parent / "dogs.py"),
                    str(solution_path.absolute()),
                    str(worktree_path),
                    "--yes"
                ],
                capture_output=True,
                text=True,
                cwd=worktree_path,
                check=False
            )

            if apply_result.returncode != 0:
                return f"VERIFICATION FAILED: Could not apply solution\n{apply_result.stderr}"

            # Run verification command
            print(f"[{competitor_name}] Running tests: {self.verify_cmd}")
            verify_result = subprocess.run(
                self.verify_cmd,
                shell=True,
                capture_output=True,
                text=True,
                cwd=worktree_path,
                timeout=300,  # 5 minute timeout
                check=False
            )

            output = f"STDOUT:\n{verify_result.stdout}\n\nSTDERR:\n{verify_result.stderr}"

            if verify_result.returncode == 0:
                return f"VERIFICATION PASSED\n\n{output}"
            else:
                return f"VERIFICATION FAILED\n\n{output}"

        except subprocess.TimeoutExpired:
            return "VERIFICATION FAILED: Timeout (5 minutes)"

        except Exception as e:
            return f"VERIFICATION FAILED: {str(e)}"

        finally:
            # Clean up worktree
            try:
                subprocess.run(
                    ["git", "worktree", "remove", str(worktree_path), "--force"],
                    capture_output=True,
                    check=False
                )
            except:
                pass

    def run_competition(self, competitors: List[CompetitorConfig],
                       parallel: bool = True) -> List[CompetitionResult]:
        """Run all competitors and return results"""
        results = []

        if parallel and len(competitors) > 1:
            print(f"\n☇ Running {len(competitors)} agents in parallel...\n")
            with ThreadPoolExecutor(max_workers=len(competitors)) as executor:
                futures = {
                    executor.submit(self.run_competitor, comp): comp
                    for comp in competitors
                }

                for future in as_completed(futures):
                    result = future.result()
                    results.append(result)
        else:
            print(f"\n☇ Running {len(competitors)} agents sequentially...\n")
            for competitor in competitors:
                result = self.run_competitor(competitor)
                results.append(result)

        return results

    def generate_report(self, results: List[CompetitionResult]):
        """Generate and display final consensus report"""
        print(f"\n{'='*60}")
        print(f"♃ PHASE: CONSENSUS REPORT")
        print(f"{'='*60}\n")

        passing = [r for r in results if r.status == "PASS"]
        failing = [r for r in results if r.status == "FAIL"]
        errors = [r for r in results if r.status == "ERROR"]

        # Summary table
        print("Summary:")
        print(f"  Total agents: {len(results)}")
        print(f"  ☉ Passed: {len(passing)}")
        print(f"  ☋ Failed: {len(failing)}")
        print(f"  ☊ Errors: {len(errors)}")
        print()

        # Individual results
        print("Individual Results:")
        for result in results:
            status_symbol = {"PASS": "☉", "FAIL": "☋", "ERROR": "☊"}[result.status]
            print(f"  {status_symbol} {result.name} ({result.model_id})")
            print(f"     Status: {result.status}")
            print(f"     Time: {result.execution_time:.2f}s")
            print(f"     Tokens: {result.token_count}")
            if result.solution_path:
                print(f"     Solution: {result.solution_path}")
            if result.error_message:
                print(f"     Error: {result.error_message}")
            print()

        # Consensus outcome
        if not passing:
            print("☋ CONSENSUS FAILED")
            print("No solutions passed verification.")
            print(f"\nAll proposals available for review in: {self.output_dir}")
            return 1
        else:
            print("☉ CONSENSUS REACHED")
            print(f"\n{len(passing)} solution(s) passed verification:")
            for result in passing:
                print(f"  ☉ {result.name}: {result.solution_path}")

            print(f"\n♲ NEXT STEP: Review and apply the best solution:")
            best = passing[0]  # Could add ranking logic here
            print(f"  python py/dogs.py {best.solution_path} --interactive")
            return 0


def main():
    parser = argparse.ArgumentParser(
        description="PAWS Paxos - Multi-Agent Competitive Verification Orchestrator"
    )

    parser.add_argument(
        "task",
        nargs='?',
        help="The detailed task description for the AI agents"
    )
    parser.add_argument(
        "context_bundle",
        nargs='?',
        help="Path to the cats.md context bundle"
    )
    parser.add_argument(
        "--verify-cmd",
        help="Shell command to run for verification (e.g., 'pytest')"
    )
    parser.add_argument(
        "--config",
        default="py/paxos_config.json",
        help="Path to competitor config file"
    )
    parser.add_argument(
        "--output-dir",
        default="workspace/competition",
        help="Directory to store results"
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run competitors sequentially instead of in parallel"
    )

    args = parser.parse_args()

    # Interactive prompts if arguments not provided
    task = args.task
    if not task:
        task = input("Enter the task description:\n> ")

    context_bundle = args.context_bundle
    if not context_bundle:
        context_bundle = input("Enter path to context bundle (e.g., context.md):\n> ")

    verify_cmd = args.verify_cmd
    if not verify_cmd:
        verify_cmd = input("Enter verification command (e.g., 'pytest', or press Enter to skip):\n> ")
        if not verify_cmd.strip():
            verify_cmd = None

    # Create orchestrator
    orchestrator = PaxosOrchestrator(
        task=task,
        context_bundle=context_bundle,
        verify_cmd=verify_cmd,
        output_dir=args.output_dir
    )

    # Load competitors
    try:
        competitors = orchestrator.load_competitors(args.config)
    except FileNotFoundError:
        print(f"Error: Config file not found: {args.config}")
        print("Create a config file with competitor definitions. Example:")
        print(json.dumps({
            "competitors": [
                {
                    "name": "gemini-pro",
                    "model_id": "gemini-pro",
                    "provider": "gemini",
                    "persona": "personas/p_refactor.md"
                },
                {
                    "name": "claude-sonnet",
                    "model_id": "claude-3-sonnet-20240229",
                    "provider": "claude",
                    "persona": "personas/p_refactor.md"
                }
            ]
        }, indent=2))
        return 1

    print(f"\n☇ Starting PAWS Multi-Agent Competition")
    print(f"Task: {task[:80]}...")
    print(f"Competitors: {len(competitors)}")
    print(f"Verification: {'Yes' if verify_cmd else 'No'}")

    # Run competition
    results = orchestrator.run_competition(
        competitors,
        parallel=not args.sequential
    )

    # Generate report
    return orchestrator.generate_report(results)


if __name__ == "__main__":
    sys.exit(main())
