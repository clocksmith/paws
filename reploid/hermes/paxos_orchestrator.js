
const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const uuid = require('uuid');

// Use the dogs.js module for applying and verifying changes from shared js/
const { BundleProcessor } = require('../../js/dogs.js');

async function applyAndVerify(dogsContent, worktreePath, verifyCmd) {
    // Use the dogs.js BundleProcessor to parse and apply changes
    const config = {
        outputDir: worktreePath,
        verify: verifyCmd,
        revertOnFail: true,
        quiet: false,
        autoAccept: true // Auto-accept all changes in paxos workflow
    };

    try {
        const processor = new BundleProcessor(config);
        const changeSet = await processor.parseBundle(dogsContent);

        if (changeSet.changes.length === 0) {
            throw new Error("No valid changes found in dogs bundle");
        }

        // Auto-accept all changes
        changeSet.changes.forEach(c => c.status = 'accepted');

        // Apply changes with verification
        let success;
        if (verifyCmd) {
            success = await processor.runWithVerification(changeSet, verifyCmd);
        } else {
            success = await processor.applyChanges(changeSet);
        }

        if (success) {
            return { success: true };
        } else {
            throw new Error('Failed to apply changes');
        }

    } catch (error) {
        console.error(`[Orchestrator] Error applying changes: ${error.message}`);
        return { success: false, error: error.message };
    }
}


// Placeholder for actual LLM API calls
function callLlmApi(modelId, fullPrompt) {
    console.log(`[Orchestrator] Agent is generating its proposed solution...`);
    if (modelId.includes("gemini")) {
        return "🐕 --- DOGS_START_FILE: test.js ---\n// Gemini was here\nconsole.log('hello from gemini');\n🐕 --- DOGS_END_FILE: test.js ---";
    } else if (modelId.includes("claude")) {
        return "🐕 --- DOGS_START_FILE: test.js ---\n// Claude was here\nconsole.log('hello from claude');\n🐕 --- DOGS_END_FILE: test.js ---";
    } else {
        return "🐕 --- DOGS_START_FILE: test.js ---\n// Codex was here\nTHIS IS A SYNTAX ERROR\n🐕 --- DOGS_END_FILE: test.js ---";
    }
}

async function runPaxosWorkflow({ objective, contextPath, verifyCmd, broadcast }) {
    const PARENT_DIR = path.join(__dirname, '..'); // reploid/
    const WORKSPACE_DIR = path.join(PARENT_DIR, 'hermes_workspace');
    const COMPETITION_DIR = path.join(WORKSPACE_DIR, 'competition');
    const CONFIG_PATH = path.join(PARENT_DIR, 'paxos_config.json'); // Assumes config is moved here
    const PERSONAS_DIR = path.join(PARENT_DIR, 'personas'); // Assumes personas are moved here

    await fs.mkdir(COMPETITION_DIR, { recursive: true });

    // --- Mock files for demonstration ---
    // In a real scenario, these would be provided in the request.
    await fs.writeFile(path.join(PARENT_DIR, contextPath), "# Mock Context");
    await fs.writeFile(CONFIG_PATH, JSON.stringify({
        "competitors": [
            { "name": "gemini-pro", "model_id": "gemini-pro-1.5", "persona": "p_gemini_coder.md" },
            { "name": "claude-3", "model_id": "claude-3-opus", "persona": "p_claude_coder.md" },
            { "name": "codex-davinci", "model_id": "codex-davinci-002", "persona": "p_codex_coder.md" }
        ]
    }, null, 2));
    await fs.mkdir(PERSONAS_DIR, { recursive: true });
    await fs.writeFile(path.join(PERSONAS_DIR, 'p_gemini_coder.md'), "You are Gemini.");
    await fs.writeFile(path.join(PERSONAS_DIR, 'p_claude_coder.md'), "You are Claude.");
    await fs.writeFile(path.join(PERSONAS_DIR, 'p_codex_coder.md'), "You are Codex.");
    // --- End Mock files ---

    const contextContent = await fs.readFile(path.join(PARENT_DIR, contextPath), 'utf-8');
    const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
    const results = [];

    broadcast({ type: 'PAXOS_LOG', payload: 'Starting PAWS Competitive Verification...' });

    for (const competitor of config.competitors) {
        const name = competitor.name;
        broadcast({ type: 'PAXOS_LOG', payload: `\n--- [PAXOS] PHASE: PROPOSAL from Agent: ${name} ---` });

        const worktreeName = `paxos_session_${name}_${uuid.v4().slice(0, 8)}`;
        const worktreePath = path.join(WORKSPACE_DIR, worktreeName);

        try {
            // 1. Create isolated environment (git worktree)
            broadcast({ type: 'PAXOS_LOG', payload: `Creating isolated environment: ${worktreeName}` });
            execSync(`git worktree add -b ${worktreeName} ${worktreePath}`, { cwd: PARENT_DIR });

            // 2. Prepare Prompt
            const personaContent = await fs.readFile(path.join(PERSONAS_DIR, competitor.persona), 'utf-8');
            // --- Master Prompt Synthesis ---
            // This new prompt structure synthesizes the best practices from the PAWS personas (sys_x1, p_refactor, sys_c1).
            // It forces a deliberate, multi-perspective thought process before code generation.
            const fullPrompt = `
#  MISSION
You are an elite, autonomous software engineer. Your purpose is to solve the user's TASK with precision, elegance, and robustness by adhering to a strict protocol of deliberation and execution.

# PROTOCOL: MULTI-MIND DELIBERATION
Before writing any code, you MUST conduct a silent, internal deliberation by adopting the following mindsets. Your final plan should be a synthesis of their perspectives.

1.  **The Architect:** What is the high-level plan? How does this change fit into the existing structure? What modules are affected?
2.  **The Purist:** What are the edge cases? How can I ensure type safety, null safety, and logical correctness? Is the code free of side effects where possible?
3.  **The Auditor:** What are the potential security flaws, performance bottlenecks (e.g., N+1 queries), or anti-patterns? How can this change be abused?
4.  **The Craftsman:** Is the proposed solution clean, readable, and maintainable? Does it follow standard design patterns and SOLID principles?

# PERSONA
Your specific persona for this task is:
${personaContent}

# TASK
${objective}

# PROVIDED CONTEXT
${contextContent}

# EXECUTION PLAN
You MUST now formulate your final execution plan based on your internal deliberation. This plan should be a clear, step-by-step outline of the changes you will make.

# OUTPUT
Your final output MUST be a valid dogs.md bundle. You will first write your execution plan as a comment, then you will write the code blocks.
- Every file's content MUST be wrapped in the mandatory `DOGS_START_FILE` and `DOGS_END_FILE` markers.
- You MUST provide the full, final content for any file you modify.

Begin your response now.
`;

            // 3. Generate Solution
            const solutionContent = callLlmApi(competitor.model_id, fullPrompt);
            const solutionPath = path.join(COMPETITION_DIR, `${name}_solution.dogs.md`);
            await fs.writeFile(solutionPath, solutionContent);
            broadcast({ type: 'PAXOS_LOG', payload: `Proposal saved to ${path.relative(PARENT_DIR, solutionPath)}` });

            // 4. Automated Verification
            broadcast({ type: 'PAXOS_LOG', payload: `\n--- [PAXOS] PHASE: VERIFICATION for ${name}'s Proposal ---` });
            const verificationResult = await applyAndVerify(solutionContent, worktreePath, verifyCmd);

            // 5. Record Outcome
            if (verificationResult.success) {
                broadcast({ type: 'PAXOS_LOG', payload: `Vote Result: ${name}'s proposal was ACCEPTED (PASS)` });
                results.push({ name, status: "PASS", solution: solutionPath });
            } else {
                throw new Error(verificationResult.error || 'Verification failed');
            }
        } catch (error) {
            broadcast({ type: 'PAXOS_ERROR', payload: `Vote Result: ${name}'s proposal was REJECTED (FAIL)\nReason: ${error.message}` });
            results.push({ name, status: "FAIL" });
        } finally {
            // 6. Clean up environment
            broadcast({ type: 'PAXOS_LOG', payload: `Cleaning up environment: ${worktreeName}` });
            execSync(`git worktree remove ${worktreePath} --force`, { cwd: PARENT_DIR });
            execSync(`git branch -D ${worktreeName}`, { cwd: PARENT_DIR });
        }
    }

    // 7. Final Report
    broadcast({ type: 'PAXOS_LOG', payload: "\n--- [PAXOS] PHASE: CONSENSUS REPORT ---" });
    const passingSolutions = results.filter(r => r.status === "PASS");
    if (passingSolutions.length === 0) {
        broadcast({ type: 'PAXOS_LOG', payload: "🔴 Consensus failed. No solutions passed the verification vote." });
    } else {
        broadcast({ type: 'PAXOS_LOG', payload: `🟢 Consensus reached! ${passingSolutions.length} proposal(s) were accepted:` });
        for (const result of passingSolutions) {
            broadcast({ type: 'PAXOS_LOG', payload: `  - Agent: ${result.name}, Proposal: ${path.relative(PARENT_DIR, result.solution)}` });
        }
    }
}

module.exports = { runPaxosWorkflow };
