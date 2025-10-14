import argparse
import json
import subprocess
import os
import uuid

# --- Placeholder for actual LLM API calls ---
def call_llm_api(model_id, full_prompt):
    """
    Placeholder function to simulate an LLM API call.
    In a real implementation, this would use libraries like google.generativeai,
    anthropic, or openai to get the model's response.
    """
    print(f"Agent is generating its proposed solution...")
    # Simulate different outputs for demonstration
    if "gemini" in model_id:
        return "🐕 --- DOGS_START_FILE: src/main.py ---\n# Gemini was here\nprint('hello from gemini')\n🐕 --- DOGS_END_FILE: src/main.py ---"
    elif "claude" in model_id:
        return "🐕 --- DOGS_START_FILE: src/main.py ---\n# Claude was here\nprint('hello from claude')\n🐕 --- DOGS_END_FILE: src/main.py ---"
    else:
        # Simulate a failing change
        return "🐕 --- DOGS_START_FILE: src/main.py ---\n# Codex was here\nprint('hello from codex')\nTHIS IS A SYNTAX ERROR\n🐕 --- DOGS_END_FILE: src/main.py ---"

def run_command(command, cwd):
    """Runs a command and returns the result."""
    # This function is internal and less verbose now
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True)

def main():
    parser = argparse.ArgumentParser(description="PAWS Competitive Verification Orchestrator")
    parser.add_argument("task", nargs='?', default=None, help="The detailed task description for the AI agents.")
    parser.add_argument("context_bundle", nargs='?', default=None, help="Path to the cats.md context bundle.")
    parser.add_argument("--verify-cmd", default=None, help="The shell command to run for verification (e.g., 'pytest').")
    parser.add_argument("--config", default="py/paxos_config.json", help="Path to the competitor config file.")
    parser.add_argument("--output-dir", default="workspace/competition", help="Directory to store results.")
    args = parser.parse_args()

    # --- Conversational Interface ---
    if not args.task:
        args.task = input("Please enter the detailed task description:\n> ")
    if not args.context_bundle:
        args.context_bundle = input("Please provide the path to the context bundle (e.g., context.cats.md):\n> ")
    if not args.verify_cmd:
        args.verify_cmd = input("Please enter the verification command (e.g., 'pytest'):\n> ")

    print("\nStarting PAWS Competitive Verification...")

    os.makedirs(args.output_dir, exist_ok=True)

    with open(args.context_bundle, 'r') as f:
        context_content = f.read()

    with open(args.config, 'r') as f:
        config = json.load(f)

    results = []

    for competitor in config["competitors"]:
        name = competitor["name"]
        print(f"\n--- [PAXOS] PHASE: PROPOSAL from Agent: {name} ---")

        # 1. Prepare Prompt
        with open(competitor["persona"], 'r') as f:
            persona_content = f.read()
        full_prompt = f'{persona_content}\n\n--- TASK ---\n{args.task}\n\n--- CONTEXT ---\n{context_content}'

        # 2. Generate Solution
        solution_content = call_llm_api(competitor["model_id"], full_prompt)
        solution_path = os.path.join(args.output_dir, f"{name}_solution.dogs.md")
        with open(solution_path, 'w') as f:
            f.write(solution_content)
        print(f"Proposal saved to {solution_path}")

        # 3. Automated Verification Gauntlet
        print(f"\n--- [PAXOS] PHASE: VERIFICATION (VOTING) for {name}'s Proposal ---")
        session_name = f"compete-{name}-{uuid.uuid4().hex[:6]}"
        worktree_path = f".paws_sessions/{session_name}"
        
        print(f"Creating isolated environment: {session_name}")
        run_command(["python", "py/paws_session.py", "start", session_name], cwd=".")

        print(f"Casting vote by running verification command: '{args.verify_cmd}'")
        verify_result = run_command(
            [
                "python", "../dogs.py",
                os.path.abspath(solution_path),
                "--yes",
                "--verify", args.verify_cmd,
                "--revert-on-fail"
            ],
            cwd=worktree_path
        )

        print(f"Cleaning up environment: {session_name}")
        run_command(["python", "py/paws_session.py", "end"], cwd=".")

        # 4. Record Outcome
        if verify_result.returncode == 0 and "Verification successful" in verify_result.stdout:
            print(f"Vote Result: {name}'s proposal was ACCEPTED (PASS)")
            results.append({"name": name, "status": "PASS", "solution": solution_path})
        else:
            print(f"Vote Result: {name}'s proposal was REJECTED (FAIL)")
            results.append({"name": name, "status": "FAIL", "solution": solution_path})

    # 5. Final Report
    print("\n--- [PAXOS] PHASE: CONSENSUS REPORT ---")
    passing_solutions = [r for r in results if r["status"] == "PASS"]
    if not passing_solutions:
        print("🔴 Consensus failed. No solutions passed the verification vote.")
        print("Failed proposals are available for review in:", args.output_dir)
    else:
        print(f"🟢 Consensus reached! {len(passing_solutions)} proposal(s) were accepted:")
        for result in passing_solutions:
            print(f"  - Agent: {result['name']}, Proposal: {result['solution']}")
        print("\nDeveloper Action: Please review the accepted proposal(s) and use `dogs.py -i` to apply the best one.")

if __name__ == "__main__":
    main()