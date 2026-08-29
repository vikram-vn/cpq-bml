const assert = require("assert");
const fs = require("fs");
const path = require("path");
const tools = require("../../app/lang/mcp/tools");
const metadataLib = require("../../app/lang/rest/metadata");
const { createFakeVscode } = require("../rest/testHelpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir } = require("../rest/commands/fixtures");

function vscodeRootedAt(tmpDir, overrides) {
  return createFakeVscode({
    config: baseVscodeConfig(overrides),
    workspaceFolders: [{ uri: { fsPath: tmpDir } }],
  });
}

function writeLocalUtilFunction(tmpDir, scriptText) {
  const bmlPath = path.join(tmpDir, "library", "util", "concatString", "concatString.bml");
  const { metadata } = metadataLib.splitFunctionResponse(SAMPLE_FUNCTION);
  metadataLib.writeBmlFile(bmlPath, scriptText);
  metadataLib.writeMetadata(metadataLib.bmlPathToMetaPath(bmlPath), metadata);
  return bmlPath;
}

suite("MCP tools - formatBmlFunction", () => {
  test("requires a variableName", async () => {
    const result = await tools.formatBmlFunction(makeContext(), createFakeVscode({}));
    assert.strictEqual(result.success, false);
  });

  test("reports an error when the function was never pulled locally", () =>
    withTempDir(async (tmpDir) => {
      const result = await tools.formatBmlFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "neverPulled" });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("neverPulled"));
    }));

  test("reformats messy code and writes the result back to the AI working copy", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir, 'x=1;if(x==1){return "a";}');

      const result = await tools.formatBmlFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.changed, true);
      assert.strictEqual(path.basename(result.filePath), "concatString_ai.bml");
      assert.ok(result.formattedText.includes("x = 1;"));
      assert.ok(result.formattedText.includes("if (x == 1)"));

      const onDisk = fs.readFileSync(result.filePath, "utf8");
      assert.strictEqual(onDisk, result.formattedText, "the formatted text should be written back to the file");
    }));

  test("reports changed:false when the code is already formatted", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir, SAMPLE_FUNCTION.scriptText);
      const vscode = vscodeRootedAt(tmpDir);

      // First call normalizes formatting (establishes a stable baseline).
      const first = await tools.formatBmlFunction(makeContext(), vscode, { variableName: "concatString" });
      // Second call against the now-formatted file should be a no-op.
      const second = await tools.formatBmlFunction(makeContext(), vscode, { variableName: "concatString" });

      assert.strictEqual(second.success, true);
      assert.strictEqual(second.changed, false);
      assert.strictEqual(second.formattedText, first.formattedText);
    }));
});
