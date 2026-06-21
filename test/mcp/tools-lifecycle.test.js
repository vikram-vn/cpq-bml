const assert = require("assert");
const fs = require("fs");
const path = require("path");
const tools = require("../../app/lang/mcp/tools");
const metadataLib = require("../../app/lang/rest/metadata");
const { createFakeVscode } = require("../rest/test-helpers");
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
    test("save/validate/debug/deploy operate on the -AI copy, never the pulled canonical file", () =>
      withTempDir(async (tmpDir) => {
        const canonicalPath = writeLocalUtilFunction(tmpDir);
        const vscode = vscodeRootedAt(tmpDir);

        // First tool call auto-creates the AI copy from the (unedited) canonical.
        const calls = [];
        await tools.validateFunction(makeContext(), vscode, { variableName: "concatString" }, async (opts) => {
          calls.push(opts);
          return { statusCode: 204, headers: {}, text: "" };
        });

        const aiPath = path.join(tmpDir, "library", "util", "concatString-AI", "concatString.bml");
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

    test("reports the failure message on a non-2xx validate response", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const transport = async () => jsonResponse(400, { detail: "syntax error" });
        const result = await tools.validateFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, false);
        assert.ok(result.message.includes("syntax error"));
      }));
  });

  suite("deployFunction", () => {
    test("deploys a single already-saved util function", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          return { statusCode: 204, headers: {}, text: "" };
        };
        const result = await tools.deployFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(calls, ["/rest/v18/bml/library/functions/actions/deploy"]);
      }));

    test("rejects deploying a commerce function with a clear error", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir, { commerceProcess: "oraclecpqo", commerceDocument: "transaction" });
        const result = await tools.deployFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, async () => ({ statusCode: 200, headers: {}, text: "" }));
        assert.strictEqual(result.success, false);
        assert.ok(result.message.includes("Deploy Commerce Process"));
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
        assert.ok(result.log.some((l) => l.includes("alice bob")));
        assert.deepStrictEqual(context.workspaceState.get("debugCache:concatString").parameterValues, {
          stringOne: "alice",
          stringTwo: "bob",
        });
      }));

    test("requires a transactionId for commerce functions", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir, { commerceProcess: "oraclecpqo", commerceDocument: "transaction" });
        const result = await tools.debugFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, async () => ({ statusCode: 200, headers: {}, text: "{}" }));
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("transactionId"));
      }));
  });

  suite("massDeployUtilFunctions", () => {
    test("deploys only the variableNames the caller selected", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts);
          if (opts.method === "GET") {
            return jsonResponse(200, { items: [{ variableName: "a" }, { variableName: "b" }, { variableName: "c" }], hasMore: false });
          }
          return { statusCode: 204, headers: {}, text: "" };
        };

        const result = await tools.massDeployUtilFunctions(makeContext(), vscodeRootedAt(tmpDir), { variableNames: ["a", "c"] }, transport);

        assert.strictEqual(result.success, true);
        const deployCall = calls.find((c) => c.method === "POST");
        const deployBody = JSON.parse(deployCall.body);
        assert.deepStrictEqual(deployBody.items.map((i) => i.variableName), ["a", "c"]);
      }));

    test("requires a non-empty variableNames array", async () => {
      const result = await tools.massDeployUtilFunctions(makeContext(), createFakeVscode({}), {}, async () => {});
      assert.strictEqual(result.success, false);
    });
  });

  suite("deployCommerceProcess", () => {
    test("deploys the explicitly given processVarName and polls until complete", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          if (opts.method === "POST") return jsonResponse(200, { taskId: "task-1" });
          return jsonResponse(200, { status: "Completed" });
        };

        const result = await tools.deployCommerceProcess(makeContext(), vscodeRootedAt(tmpDir), { processVarName: "customProc" }, transport);

        assert.strictEqual(result.success, true);
        assert.ok(calls[0].includes("customProc"));
      }));
  });

  suite("createUtilFunction", () => {
    test("creates a function on CPQ, then pulls it back so there is exactly one local copy", () =>
      withTempDir(async (tmpDir) => {
        const created = { ...SAMPLE_FUNCTION, variableName: "newFn", name: "New Fn", scriptText: 'return "hi";', folderName: "util" };
        const transport = async (opts) => {
          if (opts.method === "POST" && opts.path.endsWith("/functions")) return { statusCode: 201, headers: {}, text: "" };
          if (opts.method === "GET" && opts.path.endsWith("/functions/newFn")) return jsonResponse(200, created);
          // list call used by pullFunction's findLibraryFunctionByVariableName
          return jsonResponse(200, { items: [created], hasMore: false });
        };

        const result = await tools.createUtilFunction(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "newFn", name: "New Fn", returnType: "String", scriptText: 'return "hi";' },
          transport,
        );

        assert.strictEqual(result.success, true);
        const meta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(result.localPath));
        assert.strictEqual(meta.variableName, "newFn");
        // localPath is the AI working copy - the same one pullFunction would produce
        assert.strictEqual(result.localPath, path.join(tmpDir, "library", "util", "newFn-AI", "newFn.bml"));
        // log covers both the create call and the pull-back it triggers internally
        assert.ok(result.log.some((l) => l.includes("Create") && l.includes("newFn")));
        assert.ok(result.log.some((l) => l.includes("Pull") && l.includes("newFn")));
      }));

    test("reports the server error when create fails", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => jsonResponse(400, { detail: "already exists" });
        const result = await tools.createUtilFunction(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "dup", name: "Dup", returnType: "String" },
          transport,
        );
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("already exists"));
        assert.ok(result.log.some((l) => l.includes("Create failed")));
      }));
  });
});
