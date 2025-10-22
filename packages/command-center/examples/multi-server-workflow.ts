/**
 * Multi-Server Workflow
 *
 * Orchestrate GAMMA, REPLOID, and filesystem servers together
 * for a comprehensive AI-powered code review and improvement cycle.
 */

import { PAWSCommandCenter } from "../src/index.js";
import {
  getGammaServerConfig,
  getReploidServerConfig,
  getFilesystemServerConfig,
} from "../src/servers/registry.js";

async function runMultiServerWorkflow() {
  console.log("🌐 Multi-Server Orchestration Workflow\n");

  // Initialize Command Center with multiple servers
  const commandCenter = new PAWSCommandCenter({
    servers: [
      getGammaServerConfig(),
      getReploidServerConfig(),
      getFilesystemServerConfig([process.cwd()]),
    ],
    requireApproval: false, // Auto-approve for demo
  });

  try {
    await commandCenter.initialize();

    console.log("Connected servers:", commandCenter.getConnectedServers().join(", "));
    console.log("\n");

    // Show filesystem roots
    const roots = commandCenter.getRoots();
    console.log("📁 Filesystem Roots:");
    for (const root of roots) {
      console.log(`  • ${root.name}: ${root.uri}`);
    }
    console.log("\n");

    // Workflow: AI-Powered Code Review
    console.log("=== AI-Powered Code Review Workflow ===\n");

    // Step 1: Read REPLOID's VFS structure
    console.log("1️⃣  Analyzing REPLOID codebase structure...");
    const vfsTree = await commandCenter.readResource("reploid", "reploid://vfs/tree");

    if (vfsTree.contents[0] && "text" in vfsTree.contents[0]) {
      const modules = vfsTree.contents[0].text
        .split("\n")
        .filter((line) => line.includes("upgrades/"))
        .slice(0, 3);

      console.log("   Found modules:");
      modules.forEach((m) => console.log(`   ${m}`));
      console.log("\n");
    }

    // Step 2: Use GAMMA sampling to analyze architecture
    console.log("2️⃣  Using GAMMA to analyze codebase architecture...");

    const analysisPrompt = `Based on a codebase with these modules:
- agent-cycle.js (core agent loop)
- state-manager.js (state management)
- ui-components.js (UI rendering)

What are 2 key architectural improvements to recommend?`;

    const analysis = await commandCenter.sample({
      messages: [{ role: "user", content: analysisPrompt }],
      modelPreferences: {
        hints: [{ name: "auto" }],
        intelligencePriority: 0.8,
      },
      maxTokens: 200,
    });

    if (analysis) {
      console.log(`   Analysis (${analysis.model}):`);
      console.log(`   ${analysis.content}\n`);
    }

    // Step 3: Query REPLOID blueprints for implementation guidance
    console.log("3️⃣  Querying REPLOID blueprints for patterns...");

    const blueprints = await commandCenter.callTool("reploid", "query_blueprints", {
      query: "architecture",
    });

    if (blueprints.content[0] && "text" in blueprints.content[0]) {
      const blueprintText = blueprints.content[0].text;
      const firstBlueprint = blueprintText.split("\n").slice(0, 5).join("\n");
      console.log(firstBlueprint);
      console.log("   ... (more blueprints available)\n");
    }

    // Step 4: Check REPLOID test status
    console.log("4️⃣  Validating current system health...");

    const tests = await commandCenter.callTool("reploid", "run_tests");

    if (tests.content[0] && "text" in tests.content[0]) {
      const testText = tests.content[0].text;
      const summary = testText.split("\n").slice(0, 3).join("\n");
      console.log(summary);
      console.log("\n");
    }

    // Step 5: Demonstrate coordination
    console.log("5️⃣  Coordination Summary:");
    console.log("   ✓ REPLOID provided codebase structure");
    console.log("   ✓ GAMMA provided AI-powered analysis");
    console.log("   ✓ Blueprints provided implementation guidance");
    console.log("   ✓ Filesystem roots maintain boundary awareness");
    console.log("   ✓ Test validation ensures safety\n");

    // Potential next steps (commented for demo)
    console.log("📋 Next Steps (manual execution):");
    console.log("   • Use elicitation to gather user preferences");
    console.log("   • Create checkpoint before modifications");
    console.log("   • Apply changes through REPLOID");
    console.log("   • Use GAMMA to validate improvements");
    console.log("   • Rollback if tests fail\n");

    console.log("✓ Multi-server workflow complete!");

    await commandCenter.shutdown();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiServerWorkflow();
}

export { runMultiServerWorkflow };
