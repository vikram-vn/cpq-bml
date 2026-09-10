const assert = require("assert");
const fs = require("fs");
const path = require("path");
const commands = require("@/lang/rest/commands");
const { createFakeVscode } = require("@/test/rest/testHelpers");
const { baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("@/test/rest/commands/fixtures");

suite("BML REST commands - syncCommerceMetadata", () => {
  test("refreshCommerceSyncContext sets cpqBml.commerceMetadataSynced to false when no cache exists", () =>
    withTempDir(async (tmpDir) => {
      const calls = [];
      const vscode = createFakeVscode({
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        commands: { executeCommand: async (...args) => calls.push(args) },
      });

      const synced = commands.refreshCommerceSyncContext(vscode);
      assert.strictEqual(synced, false);
      assert.deepStrictEqual(calls, [["setContext", "cpqBml.commerceMetadataSynced", false]]);
    }));

  test("refreshCommerceSyncContext sets cpqBml.commerceMetadataSynced to true when cache exists", () =>
    withTempDir(async (tmpDir) => {
      const cacheDir = path.join(tmpDir, ".cpq", "cache");
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, "commerce-attributes.json"),
        JSON.stringify({ attributes: [] }),
        "utf8",
      );

      const calls = [];
      const vscode = createFakeVscode({
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        commands: { executeCommand: async (...args) => calls.push(args) },
      });

      const synced = commands.refreshCommerceSyncContext(vscode);
      assert.strictEqual(synced, true);
      assert.deepStrictEqual(calls, [["setContext", "cpqBml.commerceMetadataSynced", true]]);
    }));

  test("runSyncCommerceMetadata fails if credentials not configured", async () => {
    const vscode = createFakeVscode({
      config: { "connection.siteUrl": "" },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runSyncCommerceMetadata(makeContext({}), vscode, terminal);
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("credentials"));
  });

  test("runSyncCommerceMetadata performs sync, sets context, and writes cache", () =>
    withTempDir(async (tmpDir) => {
      const calls = [];
      const infoMessages = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        commands: { executeCommand: async (...args) => calls.push(args) },
        window: { showInformationMessage: (msg) => infoMessages.push(msg) },
      });
      const lines = [];
      const terminal = fakeResultsTerminal(lines);

      const transport = async (opts) => {
        if (opts.path.includes("/attributes")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              items: [{ variableName: "status_t", name: "Status", dataType: "String" }],
            }),
          };
        }
        if (opts.path.includes("/arraySets")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              items: [{ variableName: "lineItems", name: "Line Items" }],
            }),
          };
        }
        if (opts.path.includes("/systemAttributes")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              items: [{ variableName: "_transaction_id", name: "Transaction ID" }],
            }),
          };
        }
        return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
      };

      const result = await commands.runSyncCommerceMetadata(
        makeContext(),
        vscode,
        terminal,
        { transport, fetchMenuItems: false },
      );

      assert.strictEqual(result.success, true);
      assert.ok(calls.some(([cmd, key, val]) => cmd === "setContext" && key === "cpqBml.commerceMetadataSynced" && val === true));
      assert.ok(lines.some((l) => l.includes("Sync complete:")));
      assert.ok(infoMessages.some((m) => m.includes("Synced 1 attributes, 1 systemAttributes")));

      // Verify file written to .cpq/commerce.attributes.min.json
      const cachePath = path.join(tmpDir, ".cpq", "commerce.attributes.min.json");
      assert.ok(fs.existsSync(cachePath));
      const saved = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      assert.strictEqual(saved.items ? saved.items.length : saved.length, 1);
    }));

  test("runSyncCommerceMetadata integrates with withProgress and handles cancellation", () =>
    withTempDir(async (tmpDir) => {
      let withProgressCalled = false;
      const warningMessages = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        window: {
          withProgress: async (opts, task) => {
            withProgressCalled = true;
            assert.strictEqual(opts.cancellable, true);
            const token = {
              isCancellationRequested: true,
              onCancellationRequested: (cb) => cb(),
            };
            return task({ report: () => {} }, token);
          },
          showWarningMessage: (msg) => warningMessages.push(msg),
        },
      });

      const terminal = fakeResultsTerminal();
      const result = await commands.runSyncCommerceMetadata(
        makeContext(),
        vscode,
        terminal,
        {
          transport: async () => {
            throw new Error("Request aborted");
          },
        },
      );

      assert.strictEqual(withProgressCalled, true);
      assert.strictEqual(result.success, false);
      assert.ok(result.errorMessage.includes("cancelled"));
      assert.ok(warningMessages.some((m) => m.includes("cancelled")));
    }));
});
