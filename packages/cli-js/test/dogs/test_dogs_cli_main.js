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

  describe("Interactive Deletion Prompts", () => {
    it("should handle interactive deletion prompts (y, n, a, q)", async () => {
      const filesToDelete = ["f1.txt", "f2.txt", "f3.txt", "f4.txt", "f5.txt"];
      const files = {};
      for (const file of filesToDelete) {
        files[file] = "delete data";
      }
      tempDir = await createTempDir(files);

      const bundleContent = filesToDelete
        .map(
          (f) =>
            `🐕 --- DOGS_START_FILE: ${f} ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: ${f} ---`
        )
        .join("\n");
      const bundlePath = path.join(tempDir, "delete.bundle");
      const fs = require("fs").promises;
      await fs.writeFile(bundlePath, bundleContent);

      const command = `node ${dogsCliPath} "${bundlePath}" "${tempDir}"`;
      await runCliWithInput(command, ["y", "n", "a", "q"]);

      // Check file deletion results
      expect(await fileExists(path.join(tempDir, "f1.txt"))).to.be.false; // y -> deleted
      expect(await fileExists(path.join(tempDir, "f2.txt"))).to.be.true;  // n -> skipped
      expect(await fileExists(path.join(tempDir, "f3.txt"))).to.be.false; // a -> deleted
      expect(await fileExists(path.join(tempDir, "f4.txt"))).to.be.false; // a -> still in effect
      expect(await fileExists(path.join(tempDir, "f5.txt"))).to.be.true;  // q -> quit before this one
    });
  });

  describe("Content Identical Prompt", () => {
    it("should prompt with filename when content is identical", async () => {
      tempDir = await createTempDir({
        "file.txt": "identical content"
      });

      const bundleContent = `🐕 --- DOGS_START_FILE: file.txt ---\nidentical content\n🐕 --- DOGS_END_FILE: file.txt ---`;
      const bundlePath = path.join(tempDir, "identical.bundle");
      const fs = require("fs").promises;
      await fs.writeFile(bundlePath, bundleContent);

      const { stderr } = await runCliWithInput(
        `node ${dogsCliPath} "${bundlePath}" "${tempDir}"`,
        ["n"]
      );
      expect(stderr).to.include(
        "File content for 'file.txt' is identical. Overwrite anyway?"
      );
    });
  });

  describe("Security", () => {
    it("should sanitize paths and prevent directory traversal", async () => {
      const bundleContent = `🐕 --- DOGS_START_FILE: ../evil.txt ---\nowned\n🐕 --- DOGS_END_FILE: ../evil.txt ---`;
      const bundlePath = path.join(tempDir, "evil.bundle");
      const fs = require("fs").promises;
      await fs.writeFile(bundlePath, bundleContent);

      const { stderr } = await runCliWithInput(
        `node ${dogsCliPath} "${bundlePath}" "${tempDir}" -y`
      );
      expect(stderr).to.include("Security Alert");

      const parentDir = path.resolve(tempDir, "..");
      expect(await fileExists(path.join(parentDir, "evil.txt"))).to.be.false;
    });
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
