/**
 * Delta operation tests for dogs.js
 * Tests INSERT_AFTER_LINE, REPLACE_LINES, DELETE_LINES commands
 */

const { expect } = require("chai");
const { extractBundle } = require("../../src/dogs");

describe("DOGS Delta Operations", function () {
  this.timeout(5000);

  describe("API Delta Commands", () => {
    it("should correctly apply complex delta changes", async () => {
      const originalBundleContent = `🐈 --- CATS_START_FILE: main.js ---
line 1
line 2 OLD
line 3
line 4 to be deleted
line 5
🐈 --- CATS_END_FILE: main.js ---`;

      const deltaBundleContent = `🐕 --- DOGS_START_FILE: main.js ---
@@ PAWS_CMD INSERT_AFTER_LINE(1) @@
line 1.5 INSERTED
@@ PAWS_CMD REPLACE_LINES(2, 2) @@
line 2 NEW
@@ PAWS_CMD DELETE_LINES(4, 4) @@
🐕 --- DOGS_END_FILE: main.js ---`;

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

    it("should handle INSERT_AFTER_LINE", async () => {
      const originalBundleContent = `🐈 --- CATS_START_FILE: test.js ---
line 1
line 2
🐈 --- CATS_END_FILE: test.js ---`;

      const deltaBundleContent = `🐕 --- DOGS_START_FILE: test.js ---
@@ PAWS_CMD INSERT_AFTER_LINE(1) @@
inserted line
🐕 --- DOGS_END_FILE: test.js ---`;

      const resultFiles = await extractBundle({
        bundleContent: deltaBundleContent,
        originalBundleContent,
      });

      const finalContent = resultFiles[0].contentBytes.toString();
      expect(finalContent).to.equal("line 1\ninserted line\nline 2");
    });

    it("should handle REPLACE_LINES", async () => {
      const originalBundleContent = `🐈 --- CATS_START_FILE: test.js ---
line 1
line 2
line 3
🐈 --- CATS_END_FILE: test.js ---`;

      const deltaBundleContent = `🐕 --- DOGS_START_FILE: test.js ---
@@ PAWS_CMD REPLACE_LINES(2, 2) @@
replaced line
🐕 --- DOGS_END_FILE: test.js ---`;

      const resultFiles = await extractBundle({
        bundleContent: deltaBundleContent,
        originalBundleContent,
      });

      const finalContent = resultFiles[0].contentBytes.toString();
      expect(finalContent).to.equal("line 1\nreplaced line\nline 3");
    });

    it("should handle DELETE_LINES", async () => {
      const originalBundleContent = `🐈 --- CATS_START_FILE: test.js ---
line 1
line 2
line 3
🐈 --- CATS_END_FILE: test.js ---`;

      const deltaBundleContent = `🐕 --- DOGS_START_FILE: test.js ---
@@ PAWS_CMD DELETE_LINES(2, 2) @@
🐕 --- DOGS_END_FILE: test.js ---`;

      const resultFiles = await extractBundle({
        bundleContent: deltaBundleContent,
        originalBundleContent,
      });

      const finalContent = resultFiles[0].contentBytes.toString();
      expect(finalContent).to.equal("line 1\nline 3");
    });
  });
});
