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

  suite("massDeployUtilFunctions", () => {
    test("refuses to run without confirm:true", () =>
      withTempDir(async (tmpDir) => {
        const result = await tools.massDeployUtilFunctions(makeContext(), vscodeRootedAt(tmpDir), { variableNames: ["a"] });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("human permission"));
      }));

    test("deploys only the variableNames the caller selected with confirm:true", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts);
          if (opts.method === "GET") {
            return jsonResponse(200, { items: [{ variableName: "a" }, { variableName: "b" }, { variableName: "c" }], hasMore: false });
          }
          return { statusCode: 204, headers: {}, text: "" };
        };

        const result = await tools.massDeployUtilFunctions(makeContext(), vscodeRootedAt(tmpDir), { variableNames: ["a", "c"], confirm: true }, transport);

        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(result.variableNames, ["a", "c"]);
        assert.deepStrictEqual(result.deployedVariableNames, ["a", "c"]);
        assert.ok(result.message.includes("deployed"));
        const deployCall = calls.find((c) => c.method === "POST");
        const deployBody = JSON.parse(deployCall.body);
        assert.deepStrictEqual(deployBody.items.map((i) => i.variableName), ["a", "c"]);
      }));

    test("requires a non-empty variableNames array", async () => {
      const result = await tools.massDeployUtilFunctions(makeContext(), createFakeVscode({}), { confirm: true }, async () => {});
      assert.strictEqual(result.success, false);
    });
  });

  suite("deployCommerceProcess", () => {
    test("refuses to run without confirm:true", () =>
      withTempDir(async (tmpDir) => {
        const result = await tools.deployCommerceProcess(makeContext(), vscodeRootedAt(tmpDir), { processVarName: "customProc" });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("human permission"));
      }));

    test("deploys the explicitly given processVarName and polls until complete with confirm:true", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          if (opts.method === "POST") return jsonResponse(200, { taskId: "task-1" });
          return jsonResponse(200, { status: "Completed" });
        };

        const result = await tools.deployCommerceProcess(makeContext(), vscodeRootedAt(tmpDir), { processVarName: "customProc", confirm: true }, transport);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.processVarName, "customProc");
        assert.strictEqual(result.status, "complete");
        assert.ok(result.message.includes("customProc"));
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
        assert.strictEqual(result.localPath, path.join(tmpDir, "library", "util", "newFn", "newFn_ai.bml"));
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

  suite("createOverride", () => {
    test("overrides a standard function and marks the AI copy as overridden", () =>
      withTempDir(async (tmpDir) => {
        const canonicalPath = writeLocalUtilFunction(tmpDir, { isStandardFunction: true, isOverridden: false });
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts);
          return jsonResponse(200, { ...SAMPLE_FUNCTION, isStandardFunction: true, isOverridden: true });
        };

        const result = await tools.createOverride(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.variableName, "concatString");
        assert.ok(result.message.includes("override created"));
        assert.strictEqual(calls[0].method, "POST");
        assert.ok(calls[0].path.endsWith("/actions/override"));

        const aiMetaPath = path.join(tmpDir, "library", "util", "concatString", "concatString_ai.bml");
        const aiMeta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(aiMetaPath));
        assert.strictEqual(aiMeta.isOverridden, true);
        assert.strictEqual(fs.readFileSync(canonicalPath, "utf8"), SAMPLE_FUNCTION.scriptText, "canonical untouched");
      }));

    test("reports the server error when override creation fails", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir, { isStandardFunction: true, isOverridden: false });
        const transport = async () => jsonResponse(400, { detail: "cannot override" });
        const result = await tools.createOverride(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.variableName, "concatString");
        assert.ok(result.error.includes("cannot override"));
      }));

    test("requires a variableName", async () => {
      const result = await tools.createOverride(makeContext(), createFakeVscode({}), {}, async () => {});
      assert.strictEqual(result.success, false);
    });
  });

  suite("removeOverride", () => {
    test("refuses to run without confirm:true, and never calls the network", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir, { isStandardFunction: true, isOverridden: true });
        let called = false;
        const transport = async () => { called = true; return jsonResponse(200, {}); };
        const result = await tools.removeOverride(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" }, transport);
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("confirm:true"));
        assert.strictEqual(called, false);
      }));

    test("with confirm:true, reverts the AI copy to the system script", () =>
      withTempDir(async (tmpDir) => {
        const systemScript = 'return "system version";';
        writeLocalUtilFunction(tmpDir, { isStandardFunction: true, isOverridden: true });
        const aiPath = path.join(tmpDir, "library", "util", "concatString", "concatString_ai.bml");

        const transport = async (opts) =>
          jsonResponse(200, { ...SAMPLE_FUNCTION, isStandardFunction: true, isOverridden: false, scriptText: systemScript });

        const result = await tools.removeOverride(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "concatString", confirm: true },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.variableName, "concatString");
        assert.ok(result.message.includes("override removed"));
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), systemScript);
      }));
  });

  suite("resetAiCopy", () => {
    test("requires a variableName", async () => {
      const result = await tools.resetAiCopy(makeContext(), createFakeVscode({}), { confirm: true });
      assert.strictEqual(result.success, false);
    });

    test("refuses to run without confirm:true", () =>
      withTempDir(async (tmpDir) => {
        writeLocalUtilFunction(tmpDir);
        const result = await tools.resetAiCopy(makeContext(), vscodeRootedAt(tmpDir), { variableName: "concatString" });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("confirm:true"));
      }));

    test("reports an error when the function was never pulled locally", () =>
      withTempDir(async (tmpDir) => {
        const result = await tools.resetAiCopy(makeContext(), vscodeRootedAt(tmpDir), { variableName: "neverPulled", confirm: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("neverPulled"));
      }));

    test("with confirm:true, discards AI edits and restores the canonical content", () =>
      withTempDir(async (tmpDir) => {
        const canonicalPath = writeLocalUtilFunction(tmpDir);
        const vscode = vscodeRootedAt(tmpDir);
        const aiPath = path.join(tmpDir, "library", "util", "concatString", "concatString_ai.bml");

        // First tool call auto-creates the AI copy, then it gets edited (and broken).
        await tools.lintFunction(makeContext(), vscode, { variableName: "concatString" });
        fs.writeFileSync(aiPath, 'return "broken edit');

        const result = await tools.resetAiCopy(makeContext(), vscode, { variableName: "concatString", confirm: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.variableName, "concatString");
        assert.strictEqual(result.filePath, aiPath);
        assert.strictEqual(fs.readFileSync(aiPath, "utf8"), fs.readFileSync(canonicalPath, "utf8"));
      }));
  });
});
