/**
 * Model Experimentation Workflow
 *
 * Use GAMMA to compare multiple LLM models on a test prompt,
 * demonstrating sampling capabilities.
 */

import { PAWSCommandCenter } from "../src/index.js";
import { getGammaServerConfig } from "../src/servers/registry.js";

async function runModelExperiments() {
  console.log("🧪 Model Experimentation Workflow\n");

  // Initialize Command Center with GAMMA
  const commandCenter = new PAWSCommandCenter({
    servers: [getGammaServerConfig()],
    requireApproval: false, // Auto-approve for this demo
  });

  try {
    await commandCenter.initialize();

    // Test prompt
    const testPrompt = "Explain quantum computing in one sentence.";

    console.log(`Test Prompt: "${testPrompt}"\n`);

    // Get available models
    console.log("📋 Fetching available models...");
    const modelsResource = await commandCenter.readResource(
      "gamma",
      "gamma://models/available"
    );

    console.log(modelsResource.contents[0]?.text || "No models found");
    console.log("\n");

    // Run inference with auto model selection
    console.log("🤖 Running inference with auto model selection...");
    const result = await commandCenter.callTool("gamma", "run_inference", {
      prompt: testPrompt,
      model: "auto",
      max_tokens: 100,
    });

    if (result.content[0] && "text" in result.content[0]) {
      console.log(result.content[0].text);
    }

    console.log("\n");

    // Use sampling to compare multiple models
    console.log("🔄 Using sampling to compare models...");

    const comparisonPrompt = `Compare these AI models for code generation tasks:
- Claude 3.5 Sonnet
- GPT-4
- Llama 3

Provide a brief 2-sentence comparison.`;

    const samplingResult = await commandCenter.sample({
      messages: [{ role: "user", content: comparisonPrompt }],
      modelPreferences: {
        hints: [{ name: "claude-3-5-sonnet" }],
        intelligencePriority: 0.9,
      },
      maxTokens: 150,
    });

    if (samplingResult) {
      console.log(`\nModel: ${samplingResult.model}`);
      console.log(`Response: ${samplingResult.content}\n`);
    }

    await commandCenter.shutdown();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runModelExperiments();
}

export { runModelExperiments };
