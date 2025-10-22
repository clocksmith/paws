/**
 * REPLOID Self-Improvement Workflow
 *
 * Use REPLOID to propose and validate code modifications,
 * demonstrating elicitation for user approval.
 */

import { PAWSCommandCenter } from "../src/index.js";
import { getReploidServerConfig } from "../src/servers/registry.js";

async function runReploidImprovement() {
  console.log("🔧 REPLOID Self-Improvement Workflow\n");

  // Initialize Command Center with REPLOID
  const commandCenter = new PAWSCommandCenter({
    servers: [getReploidServerConfig()],
    requireApproval: true, // Require approval for REPLOID operations
  });

  try {
    await commandCenter.initialize();

    // 1. Explore REPLOID's structure
    console.log("📂 Exploring REPLOID structure...");
    const vfsTree = await commandCenter.readResource("reploid", "reploid://vfs/tree");

    if (vfsTree.contents[0] && "text" in vfsTree.contents[0]) {
      const treeText = vfsTree.contents[0].text;
      console.log(treeText.split("\n").slice(0, 20).join("\n"));
      console.log("... (truncated)\n");
    }

    // 2. Query blueprints for implementation patterns
    console.log("📚 Querying architectural blueprints...");
    const blueprintsResult = await commandCenter.callTool("reploid", "query_blueprints", {
      query: "testing",
    });

    if (blueprintsResult.content[0] && "text" in blueprintsResult.content[0]) {
      console.log(blueprintsResult.content[0].text);
      console.log("\n");
    }

    // 3. Check current test status
    console.log("✅ Running REPLOID self-tests...");
    const testResult = await commandCenter.callTool("reploid", "run_tests");

    if (testResult.content[0] && "text" in testResult.content[0]) {
      console.log(testResult.content[0].text);
      console.log("\n");
    }

    // 4. Create a checkpoint before experiments
    console.log("💾 Creating checkpoint...");
    const checkpointResult = await commandCenter.callTool("reploid", "create_checkpoint", {
      message: "Before improvement experiment",
    });

    if (checkpointResult.content[0] && "text" in checkpointResult.content[0]) {
      console.log(checkpointResult.content[0].text);
      console.log("\n");
    }

    // 5. View checkpoint history
    console.log("📜 Checkpoint history:");
    const historyResource = await commandCenter.readResource(
      "reploid",
      "reploid://checkpoints/history"
    );

    if (historyResource.contents[0] && "text" in historyResource.contents[0]) {
      console.log(historyResource.contents[0].text);
      console.log("\n");
    }

    // 6. Analyze dependencies for a module
    console.log("🔍 Analyzing dependencies for agent-cycle.js...");
    const depsResult = await commandCenter.callTool("reploid", "analyze_dependencies", {
      file_path: "upgrades/agent-cycle.js",
    });

    if (depsResult.content[0] && "text" in depsResult.content[0]) {
      console.log(depsResult.content[0].text);
      console.log("\n");
    }

    // 7. Example of proposing a modification (requires approval)
    console.log("📝 Proposing a modification...");
    console.log("(This would require user approval in interactive mode)\n");

    // In a real scenario:
    // const proposal = await commandCenter.callTool("reploid", "propose_modification", {
    //   operation: "MODIFY",
    //   file_path: "upgrades/test-module.js",
    //   new_content: "// Improved implementation...",
    //   rationale: "Adding better error handling per blueprint patterns"
    // });

    // Then use elicitation to get user approval:
    // const approval = await commandCenter.elicit(
    //   "REPLOID proposes modifying test-module.js. Review the changes above.",
    //   {
    //     type: "object",
    //     properties: {
    //       approve: { type: "boolean", description: "Approve the modification" },
    //       runTests: { type: "boolean", default: true, description: "Run tests after applying" }
    //     },
    //     required: ["approve"]
    //   }
    // );

    console.log("✓ REPLOID workflow complete!");

    await commandCenter.shutdown();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReploidImprovement();
}

export { runReploidImprovement };
