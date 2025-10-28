/**
 * API tests for cats.js
 * Tests the programmatic API (createBundle, CatsBundler class)
 */

const { expect } = require("chai");
const { createBundle } = require("../../src/cats");

describe("CATS API", function () {
  this.timeout(5000);

  describe("createBundle with Virtual FS", () => {
    it("should create a bundle from a virtual file system", async () => {
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

    it("should handle text files correctly", async () => {
      const virtualFS = [
        { path: "test.txt", content: "Hello World" },
      ];
      const bundleString = await createBundle({ virtualFS });
      expect(bundleString).to.include("--- CATS_START_FILE: test.txt ---");
      expect(bundleString).to.include("Hello World");
    });

    it("should handle binary files with base64 encoding", async () => {
      const binaryData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const virtualFS = [
        { path: "image.jpg", content: binaryData },
      ];
      const bundleString = await createBundle({ virtualFS });
      expect(bundleString).to.include("(Content:Base64)");
      expect(bundleString).to.include(binaryData.toString("base64"));
    });
  });
});
