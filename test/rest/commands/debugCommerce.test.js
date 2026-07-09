const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../testHelpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - debug (commerce functions)", () => {
  suite("runDebugCurrentFile", () => {
    test("prompts for Transaction ID for commerce functions, calls loadTransactionData, merges attributes, and debugs", () =>
      withTempDir(async (tmpDir) => {
        const commerceFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          systemAttributes: [{ name: "stage" }],
          mainDocAttributes: [{ name: "price" }],
          subDocAttributes: [{ name: "quantity" }]
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
            getText: () => SAMPLE_FUNCTION.scriptText,
          },
        };

        const prompts = [];
        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async ({ prompt }) => {
              prompts.push(prompt);
              if (prompt.includes("stringOne")) return "hello";
              if (prompt.includes("stringTwo")) return "world";
              return "48420727";
            },
          },
        });

        const transportCalls = [];
        const transport = async (opts) => {
          transportCalls.push(opts);
          if (opts.path.includes("/actions/loadTransactionData")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                systemAttributes: [{ name: "stage", value: "approved" }],
                mainDocAttributes: [{ name: "price", value: 100.0 }],
                subDocAttributes: [{ name: "quantity", value: 5 }]
              }),
            };
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              returnData: "hello world",
              scriptSize: "*** 10 bytes ***",
            }),
          };
        };

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.strictEqual(prompts.length, 3);
        assert.ok(prompts[2].includes("Transaction ID"));

        assert.strictEqual(transportCalls.length, 2);

        const loadCall = transportCalls[0];
        assert.ok(loadCall.path.includes("/actions/loadTransactionData"));
        assert.ok(loadCall.path.includes("contextParams=language%3Den%2Ccurrency%3DUSD"));
        const loadBody = JSON.parse(loadCall.body);
        assert.strictEqual(loadBody.transactionId, 48420727);
        assert.deepStrictEqual(loadBody.libraryFunctions, []);

        const debugCall = transportCalls[1];
        assert.ok(debugCall.path.endsWith("/actions/debug"));
        const debugBody = JSON.parse(debugCall.body);
        assert.strictEqual(debugBody.transactionId, 48420727);
        assert.deepStrictEqual(debugBody.systemAttributes, [{ name: "stage", value: "approved" }]);
        assert.deepStrictEqual(debugBody.mainDocAttributes, [{ name: "price", value: 100.0 }]);
        assert.deepStrictEqual(debugBody.subDocAttributes, [{ name: "quantity", value: 5 }]);

        assert.ok(lines.some((l) => l.includes("hello world")));
      }));

    test("prompts for inputs on first run, caches them, and reuses them on subsequent runs without prompting when selected", () =>
      withTempDir(async (tmpDir) => {
        const commerceFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          systemAttributes: [],
          mainDocAttributes: [],
          subDocAttributes: []
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
            getText: () => SAMPLE_FUNCTION.scriptText,
          },
        };

        const testContext = makeContext();
        let showInputBoxCalls = 0;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async ({ prompt, value }) => {
              showInputBoxCalls++;
              if (prompt.includes("stringOne")) return "cachedOne";
              if (prompt.includes("stringTwo")) return "cachedTwo";
              return "99999";
            },
          },
        });

        const transportCalls = [];
        const transport = async (opts) => {
          transportCalls.push(opts);
          if (opts.path.includes("/actions/loadTransactionData")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: "{}"
            };
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ returnData: "ok" }),
          };
        };

        // First run: should prompt
        await commands.runDebugCurrentFile(testContext, vscode, fakeResultsTerminal(), { transport });
        assert.strictEqual(showInputBoxCalls, 3);
        assert.strictEqual(transportCalls.length, 2);

        // Verify cache in context
        const cache = testContext.workspaceState.get("debugCache:concatString");
        assert.ok(cache);
        assert.strictEqual(cache.transactionId, "99999");
        assert.deepStrictEqual(cache.parameterValues, { stringOne: "cachedOne", stringTwo: "cachedTwo" });

        // Second run: mock QuickPick to return 'last'
        let quickPickOptions = [];
        let quickPickCalled = false;
        let showInputBoxCalledOnSecondRun = false;
        const vscodeSecond = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showQuickPick: async (picks) => {
              quickPickCalled = true;
              quickPickOptions = picks;
              return picks.find(p => p.id === 'last');
            },
            showInputBox: async () => {
              showInputBoxCalledOnSecondRun = true;
              return "";
            }
          }
        });

        transportCalls.length = 0; // reset
        await commands.runDebugCurrentFile(testContext, vscodeSecond, fakeResultsTerminal(), { transport });

        assert.strictEqual(quickPickCalled, true);
        assert.strictEqual(quickPickOptions.length, 2);
        assert.strictEqual(showInputBoxCalledOnSecondRun, false); // should not have prompted
        assert.strictEqual(transportCalls.length, 2);

        // Verify values sent on second run
        const loadCall = transportCalls[0];
        const loadBody = JSON.parse(loadCall.body);
        assert.strictEqual(loadBody.transactionId, 99999);
        assert.deepStrictEqual(loadBody.libraryFunctions, []);

        const debugCall = transportCalls[1];
        const debugBody = JSON.parse(debugCall.body);
        assert.strictEqual(debugBody.transactionId, 99999);
        assert.deepStrictEqual(debugBody.parameters, [
          { name: "stringOne", dataType: { value: 2, displayValue: "String" }, value: "cachedOne" },
          { name: "stringTwo", dataType: { value: 2, displayValue: "String" }, value: "cachedTwo" }
        ]);
      }));

    test("allows editing cached inputs when user chooses configure option", () =>
      withTempDir(async (tmpDir) => {
        const commerceFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          systemAttributes: [],
          mainDocAttributes: [],
          subDocAttributes: []
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
            getText: () => SAMPLE_FUNCTION.scriptText,
          },
        };

        const testContext = makeContext();
        // Seed the cache
        testContext.workspaceState.update("debugCache:concatString", {
          transactionId: "11111",
          parameterValues: { stringOne: "oldOne", stringTwo: "oldTwo" }
        });

        const promptsPrefills = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showQuickPick: async (picks) => {
              return picks.find(p => p.id === 'new');
            },
            showInputBox: async ({ prompt, value }) => {
              promptsPrefills.push({ prompt, value });
              if (prompt.includes("stringOne")) return "newOne";
              if (prompt.includes("stringTwo")) return "newTwo";
              return "22222";
            },
          },
        });

        const transportCalls = [];
        const transport = async (opts) => {
          transportCalls.push(opts);
          if (opts.path.includes("/actions/loadTransactionData")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: "{}"
            };
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ returnData: "ok" }),
          };
        };

        await commands.runDebugCurrentFile(testContext, vscode, fakeResultsTerminal(), { transport });

        // Verify prefilled values were shown to the user
        assert.strictEqual(promptsPrefills.length, 3);
        assert.strictEqual(promptsPrefills[0].value, "oldOne");
        assert.strictEqual(promptsPrefills[1].value, "oldTwo");
        assert.strictEqual(promptsPrefills[2].value, "11111");

        // Verify updated cache in context
        const cache = testContext.workspaceState.get("debugCache:concatString");
        assert.strictEqual(cache.transactionId, "22222");
        assert.deepStrictEqual(cache.parameterValues, { stringOne: "newOne", stringTwo: "newTwo" });

        // Verify updated values sent to server
        assert.strictEqual(transportCalls.length, 2);
        const loadBody = JSON.parse(transportCalls[0].body);
        assert.strictEqual(loadBody.transactionId, 22222);

        const debugBody = JSON.parse(transportCalls[1].body);
        assert.strictEqual(debugBody.transactionId, 22222);
        assert.deepStrictEqual(debugBody.parameters, [
          { name: "stringOne", dataType: { value: 2, displayValue: "String" }, value: "newOne" },
          { name: "stringTwo", dataType: { value: 2, displayValue: "String" }, value: "newTwo" }
        ]);
      }));

    test("queries dependentAttributes, merges attributes, and normalizes libraryFunctions objects when debugging commerce functions", () =>
      withTempDir(async (tmpDir) => {
        const commerceFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          libraryFunctions: [ "commerce.currentStep" ],
          systemAttributes: [{ name: "directSys" }],
          mainDocAttributes: [],
          subDocAttributes: []
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
            getText: () => SAMPLE_FUNCTION.scriptText,
          },
        };

        const testContext = makeContext();
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async ({ prompt }) => {
              if (prompt.includes("stringOne")) return "val1";
              if (prompt.includes("stringTwo")) return "val2";
              return "12345";
            },
          },
        });

        const transportCalls = [];
        const transport = async (opts) => {
          transportCalls.push(opts);
          if (opts.path.includes("/actions/dependentAttributes")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                systemAttributes: [{ name: "_system_current_step_var" }],
                mainDocAttributes: [{ name: "transactionID_t" }],
                subDocAttributes: [{ name: "_document_number" }]
              })
            };
          }
          if (opts.path.includes("/actions/loadTransactionData")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                systemAttributes: [{ name: "directSys", value: "ok" }, { name: "_system_current_step_var", value: "step1" }],
                mainDocAttributes: [{ name: "transactionID_t", value: "12345" }],
                subDocAttributes: [{ name: "_document_number", value: "1" }]
              })
            };
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ returnData: "done" }),
          };
        };

        await commands.runDebugCurrentFile(testContext, vscode, fakeResultsTerminal(), { transport });

        // Should have 3 transport calls: dependentAttributes, loadTransactionData, debug
        assert.strictEqual(transportCalls.length, 3);

        // 1. Check dependentAttributes call
        const depCall = transportCalls[0];
        assert.ok(depCall.path.includes("/actions/dependentAttributes"));
        const depBody = JSON.parse(depCall.body);
        assert.deepStrictEqual(depBody.libraryFunctions, [
          { variableName: "currentStep", type: "COMMERCE" }
        ]);

        // 2. Check loadTransactionData call
        const loadCall = transportCalls[1];
        assert.ok(loadCall.path.includes("/actions/loadTransactionData"));
        const loadBody = JSON.parse(loadCall.body);
        assert.strictEqual(loadBody.transactionId, 12345);
        assert.deepStrictEqual(loadBody.libraryFunctions, []); // must be cleared
        // Check attributes are merged properly
        assert.deepStrictEqual(loadBody.systemAttributes, [{ name: "directSys" }, { name: "_system_current_step_var" }]);
        assert.deepStrictEqual(loadBody.mainDocAttributes, [{ name: "transactionID_t" }]);
        assert.deepStrictEqual(loadBody.subDocAttributes, [{ name: "_document_number" }]);

        // 3. Check debug call
        const debugCall = transportCalls[2];
        assert.ok(debugCall.path.includes("/actions/debug"));
        const debugBody = JSON.parse(debugCall.body);
        assert.strictEqual(debugBody.transactionId, 12345);
        // Dependent attributes should be merged and populated with loadTransactionData values
        assert.deepStrictEqual(debugBody.systemAttributes, [{ name: "directSys", value: "ok" }, { name: "_system_current_step_var", value: "step1" }]);
        assert.deepStrictEqual(debugBody.mainDocAttributes, [{ name: "transactionID_t", value: "12345" }]);
        assert.deepStrictEqual(debugBody.subDocAttributes, [{ name: "_document_number", value: "1" }]);
        // libraryFunctions should be normalized to objects in debug payload
        assert.deepStrictEqual(debugBody.libraryFunctions, [
          { variableName: "currentStep", type: "COMMERCE" }
        ]);
      }));
  });
});
