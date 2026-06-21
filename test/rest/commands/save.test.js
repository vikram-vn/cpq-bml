const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const config = require("../../../app/lang/rest/config");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode, createFakeContext } = require("../test-helpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - save", () => {
  suite("runSaveCurrentFile", () => {
    function makeEditorWithMetadata(tmpDir, scriptText) {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      return {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => scriptText,
        },
      };
    }

    test("updates then deploys (util function), and reports success as Saved only after both succeed", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const infos = [];
        const lines = [];
        const editor = makeEditorWithMetadata(tmpDir, 'return "v2";');
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showInformationMessage: (m) => infos.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async (opts) => {
          calls.push(opts.method + " " + opts.path);
          return {
            statusCode: opts.method === "PATCH" ? 200 : 200,
            headers: {},
            text: "",
          };
        };

        await commands.runSaveCurrentFile(makeContext(), vscode, fakeResultsTerminal(lines), {
          transport,
        });

        assert.deepStrictEqual(calls, [
          "PATCH /rest/v18/bml/library/functions/concatString",
          "POST /rest/v18/bml/library/functions/actions/deploy",
        ]);
        assert.ok(infos[0].includes("saved"));
        assert.ok(lines[1].includes("concatString"));
        assert.ok(lines[3].includes("Saved"));
      }));

    test("uses the configured cpqBml.connection.restVersion instead of the v18 default", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const editor = makeEditorWithMetadata(tmpDir, 'return "v2";');
        const vscode = createFakeVscode({
          config: baseVscodeConfig({ "connection.restVersion": "v21" }),
          window: { activeTextEditor: editor },
        });
        const transport = async (opts) => {
          calls.push(opts.path);
          return { statusCode: 200, headers: {}, text: "" };
        };

        await commands.runSaveCurrentFile(makeContext(), vscode, fakeResultsTerminal(), { transport });

        assert.deepStrictEqual(calls, [
          "/rest/v21/bml/library/functions/concatString",
          "/rest/v21/bml/library/functions/actions/deploy",
        ]);
      }));

    test("stops and reports an error if the update step fails, without attempting deploy", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const errors = [];
        const lines = [];
        const editor = makeEditorWithMetadata(tmpDir, 'return "v2";');
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showErrorMessage: (m) => errors.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async (opts) => {
          calls.push(opts.method);
          return { statusCode: 400, headers: {}, text: "bad request" };
        };

        await commands.runSaveCurrentFile(makeContext(), vscode, fakeResultsTerminal(lines), {
          transport,
        });

        assert.deepStrictEqual(calls, ["PATCH"]);
        assert.ok(errors[0].includes("update failed"));
        assert.ok(lines.some((l) => l.includes("Update failed")));
      }));

    test("saves a commerce document function with PATCH alone - no deploy action is called", () =>
      withTempDir(async (tmpDir) => {
        const commerceFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
        };
        const bmlPath = path.join(tmpDir, "concatString.bml");
        metadataLib.writeMetadata(
          metadataLib.bmlPathToMetaPath(bmlPath),
          metadataLib.splitFunctionResponse(commerceFunction).metadata,
        );
        const editor = {
          document: {
            languageId: "bml",
            uri: { fsPath: bmlPath },
            getText: () => 'return commerce.currentStep("current");',
          },
        };

        const calls = [];
        const infos = [];
        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showInformationMessage: (m) => infos.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async (opts) => {
          calls.push(opts.method + " " + opts.path);
          return { statusCode: 200, headers: {}, text: "" };
        };

        await commands.runSaveCurrentFile(makeContext(), vscode, fakeResultsTerminal(lines), { transport });

        assert.deepStrictEqual(calls, [
          "PATCH /rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/concatString",
        ]);
        assert.ok(infos[0].includes("saved"));
        assert.ok(!infos[0].includes("deployed"));
      }));
    test("shows a clear error and makes no API call when saving a standard function that has not been overridden", () =>
      withTempDir(async (tmpDir) => {
        const standardFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          isStandardFunction: true,
          isOverridden: false,
        };
        const bmlPath = path.join(tmpDir, "concatString.bml");
        metadataLib.writeMetadata(
          metadataLib.bmlPathToMetaPath(bmlPath),
          metadataLib.splitFunctionResponse(standardFunction).metadata,
        );
        const editor = {
          document: {
            languageId: "bml",
            uri: { fsPath: bmlPath },
            getText: () => 'return "edited";',
          },
        };

        const errors = [];
        let transportCalled = false;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showErrorMessage: (m) => errors.push(m),
          },
        });

        await commands.runSaveCurrentFile(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => { transportCalled = true; return { statusCode: 200, headers: {}, text: "" }; },
        });

        assert.strictEqual(transportCalled, false, "no API call should be made");
        assert.ok(errors[0].includes("standard"), "error should mention standard function");
        assert.ok(errors[0].includes("Create Override"), "error should guide user to Create Override");
      }));

    test("prompts for Site URL, Username, and Password if not configured, then continues to save", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const infos = [];
        const lines = [];
        const editor = makeEditorWithMetadata(tmpDir, 'return "v2";');
        
        // Mock prompt values
        const promptResponses = ["testsite", "testuser", "testpass"];
        let promptIndex = 0;
        
        const vscode = createFakeVscode({
          config: {
            "connection.siteUrl": "",
            "connection.username": "",
            "connection.authMethod": "basic",
          },
          window: {
            showInformationMessage: (m) => infos.push(m),
            activeTextEditor: editor,
            showInputBox: async (opts) => {
              const res = promptResponses[promptIndex++];
              return res;
            },
          },
        });
        
        const context = createFakeContext(); // No password set in secrets
        
        const transport = async (opts) => {
          calls.push(opts.method + " " + opts.path);
          return { statusCode: 200, headers: {}, text: "" };
        };

        await commands.runSaveCurrentFile(context, vscode, fakeResultsTerminal(lines), {
          transport,
        });

        // Config should be updated
        const updatedConfig = vscode.workspace.getConfiguration("cpqBml");
        assert.strictEqual(updatedConfig.get("connection.siteUrl"), "testsite");
        assert.strictEqual(updatedConfig.get("connection.username"), "testuser");
        assert.strictEqual(await context.secrets.get(config.SECRET_PASSWORD), "testpass");

        // The save succeeded
        assert.ok(infos[0].includes("saved"));
        assert.strictEqual(calls[0], "PATCH /rest/v18/bml/library/functions/concatString");
      }));

    test("attempts to create function when update fails because function does not exist", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const infos = [];
        const lines = [];
        const editor = makeEditorWithMetadata(tmpDir, 'return "new";');
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showInformationMessage: (m) => infos.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async (opts) => {
          calls.push(opts.method + " " + opts.path);
          if (opts.method === "PATCH") {
            return {
              statusCode: 404,
              headers: {},
              text: JSON.stringify({ detail: "BML Library with variable name concatString does not exist" }),
            };
          }
          return { statusCode: 200, headers: {}, text: "" };
        };

        await commands.runSaveCurrentFile(makeContext(), vscode, fakeResultsTerminal(lines), {
          transport,
        });

        assert.deepStrictEqual(calls, [
          "PATCH /rest/v18/bml/library/functions/concatString",
          "POST /rest/v18/bml/library/functions",
          "POST /rest/v18/bml/library/functions/actions/deploy",
        ]);
        assert.ok(infos[0].includes("saved"));
        assert.ok(lines.some((l) => l.includes("does not exist. Attempting to create")));
      }));
  });
});
