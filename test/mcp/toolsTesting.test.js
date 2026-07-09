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

const JSON_HEADERS = { "content-type": "application/json" };
function jsonResponse(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, text: JSON.stringify(body) };
}

function writeLocalUtilFunction(tmpDir) {
  const bmlPath = path.join(tmpDir, "library", "util", "concatString", "concatString.bml");
  const { scriptText, metadata } = metadataLib.splitFunctionResponse(SAMPLE_FUNCTION);
  metadataLib.writeBmlFile(bmlPath, scriptText);
  metadataLib.writeMetadata(metadataLib.bmlPathToMetaPath(bmlPath), metadata);
  return bmlPath;
}

function writeTestFile(tmpDir, cases) {
  const testFilePath = path.join(tmpDir, "library", "util", "concatString", "concatString.bmltest.json");
  fs.writeFileSync(testFilePath, JSON.stringify(cases), "utf8");
  return testFilePath;
}

suite("MCP tools - runBmlTests", () => {
  test("requires a variableName", async () => {
    const result = await tools.runBmlTests(makeContext(), createFakeVscode({}), {});
    assert.strictEqual(result.success, false);
  });

  test("reports an error when no .bmltest.json file exists", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      const result = await tools.runBmlTests(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("concatString.bmltest.json"));
    }));

  test("passes cases whose actual return value matches expected, fails the rest", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      writeTestFile(tmpDir, [
        { description: "hello case", params: { stringOne: "hello", stringTwo: "world" }, expected: "hello world" },
        { description: "wrong case", params: { stringOne: "foo", stringTwo: "bar" }, expected: "not this" },
      ]);

      const transport = async (opts) => {
        if (opts.method === "POST" && opts.path.includes("/actions/debug")) {
          const body = JSON.parse(opts.body);
          const values = body.parameters.map((p) => p.value);
          return jsonResponse(200, { returnData: values.join(" ") });
        }
        return jsonResponse(200, {});
      };

      const result = await tools.runBmlTests(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.passedCount, 1);
      assert.strictEqual(result.failedCount, 1);
      assert.strictEqual(result.results[0].passed, true);
      assert.strictEqual(result.results[1].passed, false);
      assert.strictEqual(result.results[1].actual, "foo bar");
      assert.strictEqual(result.results[1].expected, "not this");
    }));

  test("a case with no expected value passes as long as debug ran without error", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      writeTestFile(tmpDir, [{ description: "no assertion", params: { stringOne: "a", stringTwo: "b" } }]);

      const transport = async () => jsonResponse(200, { returnData: "a b" });
      const result = await tools.runBmlTests(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.passedCount, 1);
    }));
});

suite("MCP tools - updateSnapshot / compareSnapshot", () => {
  test("updateSnapshot captures the return value into <variableName>.snap.json", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      const transport = async () => jsonResponse(200, { returnData: "alice bob" });

      const result = await tools.updateSnapshot(
        makeContext(),
        vscodeRootedAt(tmpDir),
        { variableName: "concatString", parameters: { stringOne: "alice", stringTwo: "bob" } },
        transport,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output, "alice bob");
      assert.ok(fs.existsSync(result.snapshotPath));
      const saved = JSON.parse(fs.readFileSync(result.snapshotPath, "utf8"));
      assert.strictEqual(saved.output, "alice bob");
      assert.deepStrictEqual(saved.params, { stringOne: "alice", stringTwo: "bob" });
    }));

  test("compareSnapshot reports a match when the return value hasn't changed", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      const vscode = vscodeRootedAt(tmpDir);
      const transport = async () => jsonResponse(200, { returnData: "alice bob" });

      await tools.updateSnapshot(makeContext(), vscode, { variableName: "concatString", parameters: { stringOne: "alice", stringTwo: "bob" } }, transport);
      const result = await tools.compareSnapshot(makeContext(), vscode, { variableName: "concatString" }, transport);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.matches, true);
      assert.strictEqual(result.expected, "alice bob");
      assert.strictEqual(result.actual, "alice bob");
    }));

  test("compareSnapshot reports a mismatch (regression) when the return value has changed", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      const vscode = vscodeRootedAt(tmpDir);

      await tools.updateSnapshot(
        makeContext(),
        vscode,
        { variableName: "concatString", parameters: { stringOne: "alice", stringTwo: "bob" } },
        async () => jsonResponse(200, { returnData: "alice bob" }),
      );

      const result = await tools.compareSnapshot(
        makeContext(),
        vscode,
        { variableName: "concatString" },
        async () => jsonResponse(200, { returnData: "alice CHANGED" }),
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.matches, false);
      assert.strictEqual(result.expected, "alice bob");
      assert.strictEqual(result.actual, "alice CHANGED");
    }));

  test("compareSnapshot errors when no snapshot exists yet", () =>
    withTempDir(async (tmpDir) => {
      writeLocalUtilFunction(tmpDir);
      const result = await tools.compareSnapshot(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, async () => jsonResponse(200, {}));
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("update_snapshot"));
    }));
});
