const assert = require("assert");
const fs = require("fs");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../test-helpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - pull", () => {
  suite("runPullLibraryFunctions", () => {
    test("shows an error and makes no API call when no workspace folder is open", async () => {
      const errors = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: { showErrorMessage: (msg) => errors.push(msg) },
        workspaceFolders: undefined,
      });
      let transportCalled = false;
      await commands.runPullLibraryFunctions(makeContext(), vscode, fakeResultsTerminal(), {
        transport: async () => {
          transportCalled = true;
          return { statusCode: 200, headers: {}, text: "{}" };
        },
      });
      assert.strictEqual(transportCalled, false);
      assert.ok(errors[0].includes("open a workspace folder"));
    });

    test("paginates the list, lets the user pick functions, and writes .bml + -meta.json locally", () =>
      withTempDir(async (tmpDir) => {
        let listCalls = 0;
        const transport = async (opts) => {
          if (opts.path.startsWith("/rest/v18/bml/library/functions?")) {
            listCalls++;
            const isFirstPage = opts.path.includes("offset=0");
            const body = isFirstPage
              ? {
                  items: [
                    {
                      variableName: "concatString",
                      folderName: "util",
                      name: "ConcatString",
                    },
                  ],
                  hasMore: true,
                }
              : {
                  items: [
                    {
                      variableName: "otherFn",
                      folderName: "util",
                      name: "OtherFn",
                    },
                  ],
                  hasMore: false,
                };
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify(body),
            };
          }
          // Get-one for whichever function the test selects
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify(SAMPLE_FUNCTION),
          };
        };

        let quickPickItems;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: {
            showQuickPick: async (items) => {
              quickPickItems = items;
              return [items[0]]; // pick just the first function
            },
          },
        });

        const lines = [];
        await commands.runPullLibraryFunctions(makeContext(), vscode, fakeResultsTerminal(lines), {
          transport,
        });

        assert.strictEqual(
          listCalls,
          2,
          "should have paginated through both pages",
        );
        assert.strictEqual(
          quickPickItems.length,
          2,
          "quick pick should offer both pages worth of items",
        );

        const bmlPath = path.join(
          tmpDir,
          "library",
          "util",
          "concatString",
          "concatString.bml",
        );
        const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
        assert.strictEqual(
          fs.readFileSync(bmlPath, "utf8"),
          SAMPLE_FUNCTION.scriptText,
        );
        assert.strictEqual(
          JSON.parse(fs.readFileSync(metaPath, "utf8")).variableName,
          "concatString",
        );

        // The pull is logged to the results terminal start to finish.
        assert.ok(lines.some((l) => l.includes("Pull") && l.includes("util library")));
        assert.ok(lines.some((l) => l.includes("Pulled concatString")));
        assert.ok(lines.some((l) => l.includes("Pulled 1 function")));
      }));

    test("writes nothing when the user cancels the quick pick", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "concatString", folderName: "util" }],
            hasMore: false,
          }),
        });
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: { showQuickPick: async () => undefined },
        });

        const lines = [];
        await commands.runPullLibraryFunctions(makeContext(), vscode, fakeResultsTerminal(lines), {
          transport,
        });

        assert.deepStrictEqual(fs.readdirSync(tmpDir), []);
        assert.ok(lines.some((l) => l.includes("cancelled")));
      }));

    test("logs a failure line when the list call fails", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => ({ statusCode: 500, headers: {}, text: "boom" });
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        });

        const lines = [];
        await commands.runPullLibraryFunctions(makeContext(), vscode, fakeResultsTerminal(lines), { transport });

        assert.ok(lines.some((l) => l.includes("Pull failed")));
      }));
  });

  suite("runPullCommerceFunctions", () => {
    test("shows an error and makes no API call when no workspace folder is open", async () => {
      const errors = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: { showErrorMessage: (msg) => errors.push(msg) },
        workspaceFolders: undefined,
      });
      let transportCalled = false;
      await commands.runPullCommerceFunctions(makeContext(), vscode, fakeResultsTerminal(), {
        transport: async () => {
          transportCalled = true;
          return { statusCode: 200, headers: {}, text: "{}" };
        },
      });
      assert.strictEqual(transportCalled, false);
      assert.ok(errors[0].includes("open a workspace folder"));
    });

    test("shows an error and makes no API call when commerceProcess/commerceDocument settings are blank", () =>
      withTempDir(async (tmpDir) => {
        const errors = [];
        let transportCalled = false;
        const vscode = createFakeVscode({
          config: baseVscodeConfig({ "rest.commerceProcess": "", "rest.commerceDocument": "" }),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: { showErrorMessage: (msg) => errors.push(msg) },
        });

        await commands.runPullCommerceFunctions(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => {
            transportCalled = true;
            return { statusCode: 200, headers: {}, text: "{}" };
          },
        });

        assert.strictEqual(transportCalled, false);
        assert.ok(errors[0].includes("cpqBml.rest.commerceProcess"));
      }));

    test("lists/paginates under the commerceProcess/commerceDocument settings (defaulting to oraclecpqo/transaction), and writes picked functions under <process>/<document>/libraries/<name>/", () =>
      withTempDir(async (tmpDir) => {
        let listCalls = 0;
        const commercePathPrefix =
          "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions";
        const transport = async (opts) => {
          if (opts.path.startsWith(`${commercePathPrefix}?`)) {
            listCalls++;
            const isFirstPage = opts.path.includes("offset=0");
            const body = isFirstPage
              ? { items: [{ variableName: "currentStep", name: "CurrentStep" }], hasMore: true }
              : { items: [{ variableName: "otherCommerceFn", name: "OtherCommerceFn" }], hasMore: false };
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify(body),
            };
          }
          // Get-one for whichever function the test selects
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              ...SAMPLE_FUNCTION,
              variableName: "currentStep",
              name: "CurrentStep",
              folderName: undefined,
            }),
          };
        };

        let quickPickItems;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: {
            showQuickPick: async (items) => {
              quickPickItems = items;
              return [items[0]];
            },
          },
        });

        const lines = [];
        await commands.runPullCommerceFunctions(makeContext(), vscode, fakeResultsTerminal(lines), { transport });

        assert.strictEqual(listCalls, 2, "should have paginated through both pages");
        assert.strictEqual(quickPickItems.length, 2);

        const bmlPath = path.join(
          tmpDir,
          "library",
          "oraclecpqo",
          "transaction",
          "libraries",
          "currentStep",
          "currentStep.bml",
        );
        const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
        assert.strictEqual(fs.readFileSync(bmlPath, "utf8"), SAMPLE_FUNCTION.scriptText);

        const savedMeta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        assert.strictEqual(savedMeta.variableName, "currentStep");
        assert.strictEqual(savedMeta.commerceProcess, "oraclecpqo");
        assert.strictEqual(savedMeta.commerceDocument, "transaction");

        assert.ok(lines.some((l) => l.includes("Pull") && l.includes("oraclecpqo/transaction")));
        assert.ok(lines.some((l) => l.includes("Pulled 1 function")));
      }));

    test("uses a configured commerceDocument other than the transaction default", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          if (opts.path.includes("?")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({ items: [{ variableName: "lineItemFn" }], hasMore: false }),
            };
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ ...SAMPLE_FUNCTION, variableName: "lineItemFn", folderName: undefined }),
          };
        };
        const vscode = createFakeVscode({
          config: baseVscodeConfig({ "rest.commerceDocument": "lineItem" }),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: { showQuickPick: async (items) => [items[0]] },
        });

        await commands.runPullCommerceFunctions(makeContext(), vscode, fakeResultsTerminal(), { transport });

        assert.ok(calls[0].includes("/documents/lineItem/bml/library/functions"));
      }));

    test("writes nothing when the user cancels the quick pick", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "currentStep" }],
            hasMore: false,
          }),
        });
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: { showQuickPick: async () => undefined },
        });

        const lines = [];
        await commands.runPullCommerceFunctions(makeContext(), vscode, fakeResultsTerminal(lines), { transport });

        assert.deepStrictEqual(fs.readdirSync(tmpDir), []);
        assert.ok(lines.some((l) => l.includes("cancelled")));
      }));
  });
});
