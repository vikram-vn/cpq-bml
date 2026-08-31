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

function writeLocalUtilFunction(tmpDir, overrides) {
  const bmlPath = path.join(tmpDir, "library", "util", "concatString", "concatString.bml");
  const { scriptText, metadata } = metadataLib.splitFunctionResponse({ ...SAMPLE_FUNCTION, ...overrides });
  metadataLib.writeBmlFile(bmlPath, scriptText);
  metadataLib.writeMetadata(metadataLib.bmlPathToMetaPath(bmlPath), metadata);
  return bmlPath;
}

suite("MCP tools - lifecycle", () => {
  suite("AI working copy isolation", () => {
    test("save/validate/debug/deploy operate on the AI copy, never the pulled canonical file", () =>
      withTempDir(async (tmpDir) => {
        const canonicalPath = writeLocalUtilFunction(tmpDir);
        const vscode = vscodeRootedAt(tmpDir);

        // First tool call auto-creates the AI copy from the (unedited) canonical.
        const calls = [];
        await tools.validateFunction(makeContext(), vscode, { variableName: "concatString" }, async (opts) => {
          calls.push(opts);
          return { statusCode: 204, headers: {}, text: "" };
        });

        const aiPath = path.join(tmpDir, "library", "util", "concatString", "concatString_ai.bml");
        assert.ok(fs.existsSync(aiPath), "AI copy should have been created");
        assert.strictEqual(fs.readFileSync(canonicalPath, "utf8"), SAMPLE_FUNCTION.scriptText, "canonical untouched");

        // Now edit only the AI copy, leaving canonical exactly as pulled.
        fs.writeFileSync(aiPath, 'return "edited by ai";');

        const sentBodies = [];
        await tools.saveFunction(makeContext(), vscode, { variableName: "concatString" }, async (opts) => {
          sentBodies.push(opts.body);
          return { statusCode: 200, headers: {}, text: "" };
        });

        const patchCall = sentBodies.find((b) => b && JSON.parse(b).scriptText);
        assert.strictEqual(JSON.parse(patchCall).scriptText, 'return "edited by ai";');
        assert.strictEqual(
          fs.readFileSync(canonicalPath, "utf8"),
          SAMPLE_FUNCTION.scriptText,
          "canonical must still be untouched after save",
        );
      }));
  });

  suite("saveFunction", () => {
    test("saves (PATCH + deploy) a previously-pulled util function", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.method);
          return { statusCode: 200, headers: {}, text: "" };
        };

        const result = await tools.saveFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);

        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(calls, ["PATCH", "POST"]);
        assert.ok(result.message.includes("saved"));
      }));

    test("errors without calling the network when the function was never pulled", () =>
      withTempDir(async (tmpDir) => {
        let called = false;
        const transport = async () => { called = true; return { statusCode: 200, headers: {}, text: "" }; };
        const result = await tools.saveFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "neverPulled" }, transport);
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("pull_function"));
        assert.strictEqual(called, false);
      }));
  });

  suite("validateFunction", () => {
    test("reports success on a 2xx validate response", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () => ({ statusCode: 204, headers: {}, text: "" });
        const result = await tools.validateFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, true);
      }));

    test("reports the failure error on a non-2xx validate response", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () => jsonResponse(400, { detail: "syntax error" });
        const result = await tools.validateFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("syntax error"));
      }));

    test("parses a line number out of the compiler error into errorLine", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () => jsonResponse(400, { detail: "Syntax error on line 7" });
        const result = await tools.validateFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.errorLine, 7);
      }));
  });

  suite("deployFunction", () => {
    test("refuses to run without confirm:true", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const result = await tools.deployFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("human permission"));
      }));

    test("deploys a single already-saved util function with confirm:true", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          return { statusCode: 204, headers: {}, text: "" };
        };
        const result = await tools.deployFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString", confirm: true }, transport);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.variableName, "concatString");
        assert.ok(result.message.includes("deployed"));
        assert.deepStrictEqual(calls, ["/rest/v18/bml/library/functions/actions/deploy"]);
      }));

    test("rejects deploying a commerce function with a clear error", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir, { commerceProcess: "oraclecpqo", commerceDocument: "transaction" });
        const result = await tools.deployFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString", confirm: true }, async () => ({ statusCode: 200, headers: {}, text: "" }));
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.variableName, "concatString");
        assert.ok(result.error.includes("Deploy Commerce Process"));
      }));
  });

  suite("debugFunction", () => {
    test("runs with AI-supplied parameter values without any interactive prompt", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () => jsonResponse(200, { returnData: "alice bob", scriptSize: 42 });
        const context = makeContext();

        const result = await tools.debugFunction(
          context,
          vscodeRootedAt(tmpDir),
          { variableName: "concatString", parameters: { stringOne: "alice", stringTwo: "bob" } },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.returnValue, "alice bob");
        assert.strictEqual(result.scriptSize, 42);
        assert.strictEqual(result.table, null);
        assert.ok(result.log.some((l) => l.includes("alice bob")));
        assert.deepStrictEqual(context.workspaceState.get("debugCache:concatString").parameterValues, {
          stringOne: "alice",
          stringTwo: "bob",
        });
      }));

    test("returns only debug print results and omits returnValue when printOnly: true", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () =>
          jsonResponse(200, {
            returnData: "returnValueData",
            executionLog: "line 1\nline 2\n",
            scriptSize: 42,
          });
        const context = makeContext();

        const result = await tools.debugFunction(
          context,
          vscodeRootedAt(tmpDir),
          {
            variableName: "concatString",
            parameters: { stringOne: "alice", stringTwo: "bob" },
            printOnly: true,
          },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.returnValue, undefined);
        assert.strictEqual(result.table, undefined);
        assert.deepStrictEqual(result.printOutput, ["line 1", "line 2"]);
        assert.strictEqual(result.scriptSize, 42);
      }));

    test("returns only debug print results when showDebugPrintOnly: true alias is passed", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () =>
          jsonResponse(200, {
            returnData: "returnValueData",
            executionLog: "print line from alias\n",
            scriptSize: 50,
          });
        const context = makeContext();

        const result = await tools.debugFunction(
          context,
          vscodeRootedAt(tmpDir),
          {
            variableName: "concatString",
            showDebugPrintOnly: true,
          },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.returnValue, undefined);
        assert.strictEqual(result.table, undefined);
        assert.deepStrictEqual(result.printOutput, ["print line from alias"]);
      }));

    test("returns empty printOutput array and no returnValue when printOnly: true with no execution logs", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () =>
          jsonResponse(200, {
            returnData: "someReturnVal",
            scriptSize: 10,
          });
        const context = makeContext();

        const result = await tools.debugFunction(
          context,
          vscodeRootedAt(tmpDir),
          {
            variableName: "concatString",
            printOnly: true,
          },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.returnValue, undefined);
        assert.strictEqual(result.table, undefined);
        assert.deepStrictEqual(result.printOutput, []);
      }));

    test("splits a documentNumber~variableName~value dump into header/line tables", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const dump = "1~customerName~Acme|1~customerId~12345|2~quantity~10|2~price~99.99|3~quantity~5|3~price~49.99";
        const transport = async () => jsonResponse(200, { returnData: dump });

        const result = await tools.debugFunction(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "concatString", parameters: { stringOne: "a", stringTwo: "b" } },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(result.table.header, [
          { variableName: "customerName", value: "Acme" },
          { variableName: "customerId", value: "12345" },
        ]);
        assert.deepStrictEqual(result.table.lines, [
          { documentNumber: 2, quantity: "10", price: "99.99" },
          { documentNumber: 3, quantity: "5", price: "49.99" },
        ]);
      }));

    test("reports errorLine when the debug runtime error names a line number", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () => jsonResponse(400, { detail: "Division by zero on line 3" });

        const result = await tools.debugFunction(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "concatString", parameters: { stringOne: "a", stringTwo: "b" } },
          transport,
        );

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.errorLine, 3);
        assert.ok(result.error.includes("Division by zero"));
      }));

    test("requires a transactionId for commerce functions", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir, { commerceProcess: "oraclecpqo", commerceDocument: "transaction" });
        const result = await tools.debugFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, async () => ({ statusCode: 200, headers: {}, text: "{}" }));
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("transactionId"));
      }));
  });
});

