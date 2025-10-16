/**
 * Edge case tests for cats.js (context bundler)
 * Matches Python test_cats_edge_cases.py structure
 */

const { expect } = require("chai");
const path = require("path");
const {
  catsCliPath,
  runCliWithInput,
  createTempDir,
  cleanupTempDir
} = require("../helpers");

describe("CATS Edge Cases", function () {
  this.timeout(5000);
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir({
      "src/main.js": 'console.log("main");',
      "src/api/v1.js": "// API v1",
      "README.md": "# Project",
      ".gitignore": "node_modules\n.env",
    });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("Glob Pattern Handling", () => {
    it("should bundle files using glob patterns", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(
          tempDir,
          "src/**/*.js"
        )}" -o - -q --no-sys-prompt`
      );
      expect(stdout).to.include("🐈 --- CATS_START_FILE: src/main.js ---");
      expect(stdout).to.not.include("README.md");
    });

    it("should respect exclude patterns", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(
          tempDir,
          "src/**/*.js"
        )}" -x "${path.join(tempDir, "src/api/**")}" -o - -q --no-sys-prompt`
      );
      expect(stdout).to.include("🐈 --- CATS_START_FILE: src/main.js ---");
      expect(stdout).to.not.include("src/api/v1.js");
    });
  });

  describe("Default Excludes", () => {
    it("should exclude dot files by default", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(tempDir, ".*")}" -o - -q --no-sys-prompt`
      );
      expect(stdout).to.not.include(".gitignore");
    });

    it("should include dot files with -N flag", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(
          tempDir,
          ".gitignore"
        )}" -N -o - -q --no-sys-prompt`
      );
      expect(stdout).to.include("🐈 --- CATS_START_FILE: .gitignore ---");
    });
  });

  describe("Persona and System Prompt Ordering", () => {
    it("should prepend persona before system prompt", async () => {
      const fs = require("fs").promises;
      await fs.writeFile(path.join(tempDir, "p.md"), "PERSONA");
      await fs.writeFile(path.join(tempDir, "s.md"), "SYSTEM");

      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(
          tempDir,
          "README.md"
        )}" -p "${path.join(tempDir, "p.md")}" -s "${path.join(
          tempDir,
          "s.md"
        )}" -o - -q`
      );

      expect(stdout).to.match(/^(\r\n|\n|\r)--- START PERSONA ---/);
      expect(stdout).to.include("PERSONA");
      expect(stdout.indexOf("PERSONA")).to.be.lessThan(
        stdout.indexOf("SYSTEM")
      );
    });
  });

  describe("Delta Reference Hint", () => {
    it("should add delta reference hint with -t flag", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(tempDir, "README.md")}" -t -o - -q`
      );
      expect(stdout).to.include("# Delta Reference: Yes");
    });

    it("should not add delta hint without -t flag", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(tempDir, "README.md")}" -o - -q`
      );
      expect(stdout).to.not.include("# Delta Reference: Yes");
      expect(stdout).to.include("# Format: FULL");
    });
  });
});
