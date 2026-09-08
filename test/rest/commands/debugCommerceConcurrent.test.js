const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../testHelpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - debug concurrency (commerce functions)", () => {
  suite("runDebugCurrentFile concurrency", () => {
    test("debugs multiple transactions concurrently (between 2 and 10 max)", () =>
      withTempDir(async (tmpDir) => {
        const commerceFunction = {
          ...SAMPLE_FUNCTION,
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          systemAttributes: [{ name: "stage" }],
          mainDocAttributes: [{ name: "price" }],
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

        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async ({ prompt }) => {
              if (prompt.includes("stringOne")) return "val1";
              if (prompt.includes("stringTwo")) return "val2";
              return "48420721, 48420722, 48420723";
            },
          },
        });

        const transportCalls = [];
        let activeRequests = 0;
        let maxObservedActive = 0;

        const transport = async (opts) => {
          activeRequests++;
          maxObservedActive = Math.max(maxObservedActive, activeRequests);
          transportCalls.push(opts);
          await new Promise((r) => setTimeout(r, 10)); // simulate network latency
          activeRequests--;

          if (opts.path.includes("/actions/loadTransactionData")) {
            const body = JSON.parse(opts.body);
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                systemAttributes: [{ name: "stage", value: `stage_${body.transactionId}` }],
              }),
            };
          }
          const body = JSON.parse(opts.body);
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              returnData: `result_for_${body.transactionId}`,
              scriptSize: "15 bytes",
            }),
          };
        };

        const result = await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.transactionCount, 3);
        assert.ok(result.concurrency >= 2 && result.concurrency <= 10);
        assert.strictEqual(result.results.length, 3);

        // Verify each transaction executed with its own isolated parameters
        assert.strictEqual(result.results[0].transactionId, "48420721");
        assert.strictEqual(result.results[0].returnValue, "result_for_48420721");
        assert.strictEqual(result.results[1].transactionId, "48420722");
        assert.strictEqual(result.results[1].returnValue, "result_for_48420722");
        assert.strictEqual(result.results[2].transactionId, "48420723");
        assert.strictEqual(result.results[2].returnValue, "result_for_48420723");

        // 3 transactions x 2 calls each = 6 transport calls
        assert.strictEqual(transportCalls.length, 6);
      }));

    test("caps transactions at 10 max when user specifies more than 10 transactions", () =>
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

        let warningShown = false;
        const twelveTransactions = Array.from({ length: 12 }, (_, i) => String(90001 + i)).join(", ");

        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async ({ prompt }) => {
              if (prompt.includes("stringOne")) return "a";
              if (prompt.includes("stringTwo")) return "b";
              return twelveTransactions;
            },
            showWarningMessage: async (msg) => {
              if (msg.includes("10 transactions max")) {
                warningShown = true;
              }
            },
          },
        });

        const transport = async (opts) => {
          if (opts.path.includes("/actions/loadTransactionData")) {
            return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
          }
          return { statusCode: 200, headers: { "content-type": "application/json" }, text: JSON.stringify({ returnData: "ok" }) };
        };

        const result = await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          fakeResultsTerminal(),
          { transport },
        );

        assert.strictEqual(warningShown, true);
        assert.strictEqual(result.transactionCount, 10);
        assert.strictEqual(result.results.length, 10);
        assert.strictEqual(result.concurrency, 10);
      }));

    test("runConcurrentPool clamps concurrency between 2 and 10 and preserves order", async () => {
      const items = [1, 2, 3, 4, 5];
      let active = 0;
      let maxActive = 0;

      const results = await commands.runConcurrentPool(
        items,
        async (item) => {
          active++;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
          return item * 10;
        },
        3, // desired concurrency
        2, // min concurrency
        10 // max concurrency
      );

      assert.deepStrictEqual(results, [10, 20, 30, 40, 50]);
      assert.ok(maxActive <= 10);
      assert.ok(maxActive >= 2);
    });
  });
});
