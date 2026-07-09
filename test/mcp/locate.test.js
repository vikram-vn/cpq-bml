const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { findLocalBmlPath, findOrCreateAiCopy, resetAiCopy } = require("../../app/lang/mcp/locate");
const { createFakeVscode } = require("../rest/testHelpers");
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

    test("clones the canonical .bml and -meta.json into a same-folder <variableName>_ai.bml", () =>
      withTempDir((tmpDir) => {
        writeCanonical(tmpDir, "groupDiscount", 'return "v1";', { variableName: "groupDiscount" });

        const aiPath = findOrCreateAiCopy(vscodeRootedAt(tmpDir), "groupDiscount");

        assert.strictEqual(aiPath, path.join(tmpDir, "library", "util", "groupDiscount", "groupDiscount_ai.bml"));
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), 'return "v1";');
        const aiMeta = JSON.parse(fs.readFileSync(path.join(tmpDir, "library", "util", "groupDiscount", "groupDiscount_ai-meta.json"), "utf8"));
        assert.strictEqual(aiMeta.variableName, "groupDiscount");
      }));

    test("recognizes a pre-existing legacy <variableName>-AI sibling folder instead of creating a new same-folder copy", () =>
      withTempDir((tmpDir) => {
        const canonicalPath = writeCanonical(tmpDir, "legacyFn", 'return "v1";', { variableName: "legacyFn" });
        const legacyDir = path.join(tmpDir, "library", "util", "legacyFn-AI");
        fs.mkdirSync(legacyDir, { recursive: true });
        const legacyAiPath = path.join(legacyDir, "legacyFn.bml");
        fs.writeFileSync(legacyAiPath, 'return "legacy-ai-edited";');

        const aiPath = findOrCreateAiCopy(vscodeRootedAt(tmpDir), "legacyFn");

        assert.strictEqual(aiPath, legacyAiPath);
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), 'return "legacy-ai-edited";');
        assert.ok(
          !fs.existsSync(path.join(path.dirname(canonicalPath), "legacyFn_ai.bml")),
          "should not also create a new same-folder copy when a legacy copy already exists",
        );
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
          path.join(tmpDir, "library", "oraclecpqo", "transaction", "libraries", "myFunc", "myFunc_ai.bml"),
        );
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), 'return "x";');
      }));
  });

  suite("resetAiCopy", () => {
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

    test("discards AI edits and recreates a fresh copy matching the canonical file", () =>
      withTempDir((tmpDir) => {
        writeCanonical(tmpDir, "groupDiscount", 'return "v1";', { variableName: "groupDiscount" });
        const vscode = vscodeRootedAt(tmpDir);
        const aiPath = findOrCreateAiCopy(vscode, "groupDiscount");
        fs.writeFileSync(aiPath, 'return "ai-edited-and-broken";');

        const resetPath = resetAiCopy(vscode, "groupDiscount");

        assert.strictEqual(resetPath, aiPath);
        assert.strictEqual(fs.readFileSync(resetPath, "utf8"), 'return "v1";');
      }));

    test("also discards a legacy -AI folder copy and recreates on the new same-folder scheme", () =>
      withTempDir((tmpDir) => {
        const canonicalPath = writeCanonical(tmpDir, "legacyFn", 'return "v1";', { variableName: "legacyFn" });
        const legacyDir = path.join(tmpDir, "library", "util", "legacyFn-AI");
        fs.mkdirSync(legacyDir, { recursive: true });
        fs.writeFileSync(path.join(legacyDir, "legacyFn.bml"), 'return "legacy-ai-edited";');

        const resetPath = resetAiCopy(vscodeRootedAt(tmpDir), "legacyFn");

        assert.strictEqual(resetPath, path.join(path.dirname(canonicalPath), "legacyFn_ai.bml"));
        assert.strictEqual(fs.readFileSync(resetPath, "utf8"), 'return "v1";');
        assert.ok(!fs.existsSync(path.join(legacyDir, "legacyFn.bml")), "legacy copy should be discarded");
      }));

    test("returns null when the canonical file does not exist", () =>
      withTempDir((tmpDir) => {
        assert.strictEqual(resetAiCopy(vscodeRootedAt(tmpDir), "doesNotExist"), null);
      }));
  });
});
