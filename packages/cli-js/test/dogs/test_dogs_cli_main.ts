/**
 * CLI tests for dogs.js
 * Tests command-line interface behavior
 */

const { expect } = require("chai");
const path = require("path");
const {
  dogsCliPath,
  runCliWithInput,
  createTempDir,
  cleanupTempDir,
  fileExists
} = require("../helpers");

describe("DOGS CLI", function () {
  this.timeout(5000);
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });


  describe("DELETE_FILE Command", () => {
    it("should handle DELETE_FILE command without delta flag", async () => {
      tempDir = await createTempDir({
        "delete_me.txt": "some data"
      });
      const fileToDeletePath = path.join(tempDir, "delete_me.txt");

      const bundlePath = path.join(tempDir, "delete.bundle");
      const bundleContent = `🐕 --- DOGS_START_FILE: delete_me.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: delete_me.txt ---`;
      const fs = require("fs").promises;
      await fs.writeFile(bundlePath, bundleContent);

      // Note: NO -d flag is used here
      const command = `node ${dogsCliPath} "${bundlePath}" "${tempDir}" -y -q`;
      await runCliWithInput(command);

      expect(await fileExists(fileToDeletePath)).to.be.false;
    });
  });
});
