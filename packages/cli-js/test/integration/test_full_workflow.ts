/**
 * Full workflow integration tests
 * Tests complete cats -> dogs workflows
 */

const { expect } = require("chai");
const path = require("path");
const fs = require("fs").promises;
const {
  catsCliPath,
  dogsCliPath,
  runCliWithInput,
  createTempDir,
  cleanupTempDir
} = require("../helpers");

describe("Full Workflow Integration", function () {
  this.timeout(5000);
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir({
      "src/main.js": 'console.log("main");',
      "src/api/v1.js": "// API v1",
      "README.md": "# Project"
    });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should correctly process a project from cats -> dogs with deltas and deletions", async () => {
    const refBundlePath = path.join(tempDir, "ref.bundle");
    let command = `node ${catsCliPath} "${tempDir}" -t -o "${refBundlePath}" -q`;
    await runCliWithInput(command);

    const deltaBundlePath = path.join(tempDir, "delta.bundle");
    const deltaBundleContent = `
🐕 --- DOGS_START_FILE: src/main.js ---
@@ PAWS_CMD REPLACE_LINES(1, 1) @@
console.log("main MODIFIED");
🐕 --- DOGS_END_FILE: src/main.js ---
🐕 --- DOGS_START_FILE: src/new_feature.js ---
export const newFeature = true;
🐕 --- DOGS_END_FILE: src/new_feature.js ---
🐕 --- DOGS_START_FILE: src/api/v1.js ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: src/api/v1.js ---`;
    await fs.writeFile(deltaBundlePath, deltaBundleContent);

    command = `node ${dogsCliPath} "${deltaBundlePath}" "${tempDir}" -d "${refBundlePath}" -y -q`;
    await runCliWithInput(command);

    const modifiedMain = await fs.readFile(
      path.join(tempDir, "src/main.js"),
      "utf-8"
    );
    expect(modifiedMain.trim()).to.equal('console.log("main MODIFIED");');

    const newFeature = await fs.readFile(
      path.join(tempDir, "src/new_feature.js"),
      "utf-8"
    );
    expect(newFeature.trim()).to.equal("export const newFeature = true;");

    // Check that file was deleted
    let fileExists = true;
    try {
      await fs.access(path.join(tempDir, "src/api/v1.js"));
    } catch {
      fileExists = false;
    }
    expect(fileExists).to.be.false;
  });
});
