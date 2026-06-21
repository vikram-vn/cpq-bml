const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { findLocalBmlPath, findOrCreateAiCopy } = require("../../app/lang/mcp/locate");
const { createFakeVscode } = require("../rest/test-helpers");
const { withTempDir } = require("../rest/commands/fixtures");

function vscodeRootedAt(tmpDir, configOverrides) {
  return createFakeVscode({
    config: { "rest.pullFolder": "library", ...configOverrides },
    workspaceFolders: [{ uri: { fsPath: tmpDir } }],
  });
}

suite("MCP locate", () => {
  suite("findLocalBmlPath", () => {
    test("finds a util function nested under the pull folder", () =>
      withTempDir((tmpDir) => {
        const dir = path.join(tmpDir, "library", "util", "concatString");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "concatString.bml"), 'return "x";');

        const found = findLocalBmlPath(vscodeRootedAt(tmpDir), "concatString");
        assert.strictEqual(found, path.join(dir, "concatString.bml"));
      }));

    test("finds a commerce function nested several levels deeper", () =>
      withTempDir((tmpDir) => {
        const dir = path.join(tmpDir, "library", "oraclecpqo", "transaction", "libraries", "myFunc");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "myFunc.bml"), 'return "x";');

        const found = findLocalBmlPath(vscodeRootedAt(tmpDir), "myFunc");
        assert.strictEqual(found, path.join(dir, "myFunc.bml"));
      }));

    test("returns null when no matching folder exists", () =>
      withTempDir((tmpDir) => {
        fs.mkdirSync(path.join(tmpDir, "library"), { recursive: true });
        const found = findLocalBmlPath(vscodeRootedAt(tmpDir), "doesNotExist");
        assert.strictEqual(found, null);
      }));

    test("returns null when no workspace folder is open", () => {
      const vscode = createFakeVscode({ config: { "rest.pullFolder": "library" } });
      assert.strictEqual(findLocalBmlPath(vscode, "concatString"), null);
    });

    test("returns null (rather than throwing) when the pull folder does not exist yet", () =>
      withTempDir((tmpDir) => {
        const found = findLocalBmlPath(vscodeRootedAt(tmpDir), "concatString");
        assert.strictEqual(found, null);
      }));
  });

  suite("findOrCreateAiCopy", () => {
    function writeCanonical(tmpDir, variableName, scriptText, metaContent) {
      const dir = path.join(tmpDir, "library", "util", variableName);
      fs.mkdirSync(dir, { recursive: true });
      const bmlPath = path.join(dir, `${variableName}.bml`);
      fs.writeFileSync(bmlPath, scriptText);
      if (metaContent !== undefined) {
        fs.writeFileSync(path.join(dir, `${variableName}-meta.json`), JSON.stringify(metaContent));
      }
      return bmlPath;
    }

    test("clones the canonical .bml and -meta.json into a sibling <variableName>-AI folder", () =>
      withTempDir((tmpDir) => {
        writeCanonical(tmpDir, "groupDiscount", 'return "v1";', { variableName: "groupDiscount" });

        const aiPath = findOrCreateAiCopy(vscodeRootedAt(tmpDir), "groupDiscount");

        assert.strictEqual(aiPath, path.join(tmpDir, "library", "util", "groupDiscount-AI", "groupDiscount.bml"));
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), 'return "v1";');
        const aiMeta = JSON.parse(fs.readFileSync(path.join(tmpDir, "library", "util", "groupDiscount-AI", "groupDiscount-meta.json"), "utf8"));
        assert.strictEqual(aiMeta.variableName, "groupDiscount");
      }));

    test("never overwrites an existing AI copy - re-pulling the canonical file does not clobber in-progress AI edits", () =>
      withTempDir((tmpDir) => {
        writeCanonical(tmpDir, "groupDiscount", 'return "v1";', { variableName: "groupDiscount" });
        const aiPath = findOrCreateAiCopy(vscodeRootedAt(tmpDir), "groupDiscount");

        // Simulate the AI editing its working copy, then the canonical file
        // getting refreshed from the server (a normal re-pull).
        fs.writeFileSync(aiPath, 'return "ai-edited";');
        writeCanonical(tmpDir, "groupDiscount", 'return "v2-from-server";', { variableName: "groupDiscount" });

        const secondCall = findOrCreateAiCopy(vscodeRootedAt(tmpDir), "groupDiscount");

        assert.strictEqual(secondCall, aiPath);
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), 'return "ai-edited";', "AI copy must survive a canonical refresh");
      }));

    test("returns null when the canonical file does not exist", () =>
      withTempDir((tmpDir) => {
        assert.strictEqual(findOrCreateAiCopy(vscodeRootedAt(tmpDir), "doesNotExist"), null);
      }));

    test("works for a commerce function nested several levels deep", () =>
      withTempDir((tmpDir) => {
        const dir = path.join(tmpDir, "library", "oraclecpqo", "transaction", "libraries", "myFunc");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "myFunc.bml"), 'return "x";');

        const aiPath = findOrCreateAiCopy(vscodeRootedAt(tmpDir), "myFunc");

        assert.strictEqual(
          aiPath,
          path.join(tmpDir, "library", "oraclecpqo", "transaction", "libraries", "myFunc-AI", "myFunc.bml"),
        );
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), 'return "x";');
      }));
  });
});
