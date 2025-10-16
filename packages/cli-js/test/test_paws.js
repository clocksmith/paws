const { expect } = require("chai");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

// Import the library functions to test the API directly
const { createBundle } = require("../src/cats.js");
const { extractBundle } = require("../src/dogs.js");

// Resolve paths to the CLI scripts
const catsCliPath = path.resolve(__dirname, "..", "bin", "cats.js");
const dogsCliPath = path.resolve(__dirname, "..", "bin", "dogs.js");

/**
 * Helper function to run a CLI command with interactive input.
 * @param {string} command The base command to execute.
 * @param {string[]} inputs Array of strings to be piped to stdin.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function runCliWithInput(command, inputs = []) {
  // Parse command string properly, handling quoted arguments
  const args = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  const [cmd, ...cmdArgs] = args;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on("error", (err) => reject(err));

    // Write inputs to stdin
    let currentInput = 0;
    const writeNextInput = () => {
      if (currentInput < inputs.length) {
        child.stdin.write(inputs[currentInput] + "\n");
        currentInput++;
      } else {
        child.stdin.end();
      }
    };

    // Wait for prompts before writing
    child.stderr.on("data", (data) => {
      if (data.toString().includes("? [y/N")) {
        writeNextInput();
      }
    });

    // Start the process
    writeNextInput();
  });
}

describe("PAWS for Node.js", function () {
  this.timeout(5000);

  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paws-js-test-"));
    await fs.mkdir(path.join(tempDir, "src", "api"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src", "main.js"),
      'console.log("main");'
    );
    await fs.writeFile(path.join(tempDir, "src", "api", "v1.js"), "// API v1");
    await fs.writeFile(path.join(tempDir, "README.md"), "# Project");
    await fs.writeFile(path.join(tempDir, ".gitignore"), "node_modules\n.env");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("cats.js", () => {
    it("CLI should bundle files using glob patterns and respect excludes", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(
          tempDir,
          "src/**/*.js"
        )}" -x "${path.join(tempDir, "src/api/**")}" -o - -q --no-sys-prompt`
      );
      expect(stdout).to.include("🐈 --- CATS_START_FILE: src/main.js ---");
      expect(stdout).to.not.include("src/api/v1.js");
    });

    it("CLI should respect default excludes and the -N flag", async () => {
      let { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(tempDir, ".*")}" -o - -q --no-sys-prompt`
      );
      expect(stdout).to.not.include(".gitignore");

      ({ stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(tempDir, ".gitignore")}" -N -o - -q --no-sys-prompt`
      ));
      expect(stdout).to.include("🐈 --- CATS_START_FILE: .gitignore ---");
    });

    it("CLI should prepend persona and sysprompt files in the correct order", async () => {
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

    it("CLI should add delta reference hint with -t flag", async () => {
      const { stdout } = await runCliWithInput(
        `node ${catsCliPath} "${path.join(tempDir, "README.md")}" -t -o - -q`
      );
      expect(stdout).to.include("# Delta Reference: Yes");
    });

    it("API should create a bundle from a virtual file system", async () => {
      const virtualFS = [
        { path: "app.js", content: "let x = 1;" },
        { path: "assets/logo.png", content: Buffer.from([1, 2, 3, 0]) },
      ];
      const bundleString = await createBundle({ virtualFS });
      expect(bundleString).to.include("--- CATS_START_FILE: app.js ---");
      expect(bundleString).to.include(
        "--- CATS_START_FILE: assets/logo.png (Content:Base64) ---"
      );
      expect(bundleString).to.include(
        Buffer.from([1, 2, 3, 0]).toString("base64")
      );
    });
  });

  describe("dogs.js", () => {
    it("CLI should handle interactive deletion prompts (y, n, a, q)", async () => {
      const filesToDelete = ["f1.txt", "f2.txt", "f3.txt", "f4.txt", "f5.txt"];
      for (const file of filesToDelete) {
        await fs.writeFile(path.join(tempDir, file), "delete data");
      }
      const bundleContent = filesToDelete
        .map(
          (f) =>
            `🐕 --- DOGS_START_FILE: ${f} ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: ${f} ---`
        )
        .join("\n");
      const bundlePath = path.join(tempDir, "delete.bundle");
      await fs.writeFile(bundlePath, bundleContent);

      const command = `node ${dogsCliPath} "${bundlePath}" "${tempDir}"`;
      await runCliWithInput(command, ["y", "n", "a", "q"]);

      // Check file deletion results
      let f1Exists = true;
      try { await fs.access(path.join(tempDir, "f1.txt")); } catch { f1Exists = false; }
      expect(f1Exists).to.be.false; // y -> deleted

      let f2Exists = true;
      try { await fs.access(path.join(tempDir, "f2.txt")); } catch { f2Exists = false; }
      expect(f2Exists).to.be.true; // n -> skipped

      let f3Exists = true;
      try { await fs.access(path.join(tempDir, "f3.txt")); } catch { f3Exists = false; }
      expect(f3Exists).to.be.false; // a -> deleted

      let f4Exists = true;
      try { await fs.access(path.join(tempDir, "f4.txt")); } catch { f4Exists = false; }
      expect(f4Exists).to.be.false; // a -> still in effect

      let f5Exists = true;
      try { await fs.access(path.join(tempDir, "f5.txt")); } catch { f5Exists = false; }
      expect(f5Exists).to.be.true; // q -> quit before this one
    });

    it("CLI should prompt with filename when content is identical", async () => {
      const filePath = path.join(tempDir, "file.txt");
      await fs.writeFile(filePath, "identical content");
      const bundleContent = `🐕 --- DOGS_START_FILE: file.txt ---\nidentical content\n🐕 --- DOGS_END_FILE: file.txt ---`;
      const bundlePath = path.join(tempDir, "identical.bundle");
      await fs.writeFile(bundlePath, bundleContent);

      const { stderr } = await runCliWithInput(
        `node ${dogsCliPath} "${bundlePath}" "${tempDir}"`,
        ["n"]
      );
      expect(stderr).to.include(
        "File content for 'file.txt' is identical. Overwrite anyway?"
      );
    });

    it("CLI should sanitize paths and prevent directory traversal", async () => {
      const bundleContent = `🐕 --- DOGS_START_FILE: ../evil.txt ---\nowned\n🐕 --- DOGS_END_FILE: ../evil.txt ---`;
      const bundlePath = path.join(tempDir, "evil.bundle");
      await fs.writeFile(bundlePath, bundleContent);

      const { stderr } = await runCliWithInput(
        `node ${dogsCliPath} "${bundlePath}" "${tempDir}" -y`
      );
      expect(stderr).to.include("Security Alert");
      const parentDir = path.resolve(tempDir, "..");
      let evilExists = true;
      try { await fs.access(path.join(parentDir, "evil.txt")); } catch { evilExists = false; }
      expect(evilExists).to.be.false;
    });

    it("CLI should handle DELETE_FILE command without delta flag", async () => {
      const fileToDeletePath = path.join(tempDir, "delete_me.txt");
      await fs.writeFile(fileToDeletePath, "some data");
      const bundlePath = path.join(tempDir, "delete.bundle");
      const bundleContent = `🐕 --- DOGS_START_FILE: delete_me.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: delete_me.txt ---`;
      await fs.writeFile(bundlePath, bundleContent);

      // Note: NO -d flag is used here
      const command = `node ${dogsCliPath} "${bundlePath}" "${tempDir}" -y -q`;
      await runCliWithInput(command);

      let fileExists = true;
      try { await fs.access(fileToDeletePath); } catch { fileExists = false; }
      expect(fileExists).to.be.false;
    });

    it("API should correctly apply complex delta changes", async () => {
      const originalBundleContent = `🐈 --- CATS_START_FILE: main.js ---\nline 1\nline 2 OLD\nline 3\nline 4 to be deleted\nline 5\n🐈 --- CATS_END_FILE: main.js ---`;
      const deltaBundleContent = `🐕 --- DOGS_START_FILE: main.js ---\n@@ PAWS_CMD INSERT_AFTER_LINE(1) @@\nline 1.5 INSERTED\n@@ PAWS_CMD REPLACE_LINES(2, 2) @@\nline 2 NEW\n@@ PAWS_CMD DELETE_LINES(4, 4) @@\n🐕 --- DOGS_END_FILE: main.js ---`;
      const resultFiles = await extractBundle({
        bundleContent: deltaBundleContent,
        originalBundleContent,
      });
      const finalContent = resultFiles[0].contentBytes.toString();
      const expectedContent = [
        "line 1",
        "line 1.5 INSERTED",
        "line 2 NEW",
        "line 3",
        "line 5",
      ].join("\n");
      expect(finalContent).to.equal(expectedContent);
    });
  });

  describe("Full Workflow Integration", () => {
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
      await expect(
        fs.access(path.join(tempDir, "src/api/v1.js"))
      ).to.be.rejectedWith(Error);
    });
  });
});
