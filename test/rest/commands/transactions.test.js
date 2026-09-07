const assert = require("assert");
const commands = require("../../../app/lang/rest/commands");
const { createFakeVscode } = require("../testHelpers");
const { baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - getTransactions", () => {
  test("shows error when credentials are not configured", async () => {
    const errors = [];
    const vscode = createFakeVscode({
      config: { "connection.siteUrl": "" },
      window: { showErrorMessage: (msg) => errors.push(msg) },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runGetTransactions(makeContext({}), vscode, terminal);
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("credentials"));
  });

  test("pulls transactions and writes formatted _id and transactionID_t to terminal", () =>
    withTempDir(async (tmpDir) => {
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
      });
      const lines = [];
      const terminal = fakeResultsTerminal(lines);
      const mockResult = {
        items: [
          {
            _id: "36365138",
            transactionID_t: "CPQ-3",
            totalContractValue_t: "236133.32",
            links: [
              { rel: "self", href: "https://sitename.oracle.com/rest/v19/commerceDocumentsOraclecpqoTransaction/36365138" },
            ],
          },
        ],
        links: [
          { rel: "canonical", href: "https://sitename.oracle.com/rest/v19/commerceDocumentsOraclecpqoTransaction" },
        ],
        count: 1,
        totalResults: 1,
        hasMore: false,
        offset: 25,
        limit: 25,
      };

      const transport = async (opts) => {
        assert.ok(opts.path.startsWith("/rest/v19/commerceDocumentsOraclecpqoTransaction?"));
        assert.ok(opts.path.includes("offset=25"));
        assert.ok(opts.path.includes("limit=25"));
        assert.ok(opts.path.includes("excludeFieldTypes=yes"));
        assert.ok(opts.path.includes("fields=_id%2CtransactionID_t"));
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify(mockResult),
        };
      };

      const result = await commands.runGetTransactions(makeContext(), vscode, terminal, {
        q: "{status_t:'CREATED'}",
        transport,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0]._id, "36365138");
      assert.strictEqual(result.items[0].transactionID_t, "CPQ-3");
      assert.strictEqual(result.items[0].links, undefined);
      assert.ok(lines.some((l) => l.includes("Retrieved 1 transaction")));
      assert.ok(lines.some((l) => l.includes("36365138")));
      assert.ok(lines.some((l) => l.includes("CPQ-3")));
    }));

  test("cancels gracefully if input box is dismissed", async () => {
    const vscode = createFakeVscode({
      config: baseVscodeConfig(),
      window: { showInputBox: async () => undefined },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runGetTransactions(makeContext(), vscode, terminal);
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("cancelled"));
  });
});
