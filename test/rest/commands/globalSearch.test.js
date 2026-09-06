const assert = require("assert");
const commands = require("../../../app/lang/rest/commands");
const { createFakeVscode } = require("../testHelpers");
const { baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - globalSearch", () => {
  test("shows error when credentials are not configured", async () => {
    const errors = [];
    const vscode = createFakeVscode({
      config: { "connection.siteUrl": "" },
      window: { showErrorMessage: (msg) => errors.push(msg) },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runGlobalSearchBml(makeContext({}), vscode, terminal);
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("credentials"));
  });

  test("prompts for query when not passed, and outputs search results to terminal", () =>
    withTempDir(async (tmpDir) => {
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showInputBox: async () => "calcPrice",
        },
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
      });
      const lines = [];
      const terminal = fakeResultsTerminal(lines);
      const mockResult = {
        items: [
          {
            scriptText: "calcPrice = 100.0;\nreturn calcPrice;",
            locations: [
              {
                type: "Rule",
                name: "Calculate Price Rule",
                variableName: "calcPriceRule",
                path: "commerce/oraclecpqo/rules",
              },
            ],
          },
        ],
        count: 1,
        totalResults: 1,
        hasMore: false,
      };

      const transport = async (opts) => {
        assert.ok(opts.path.startsWith("/rest/v19/bml/scripts?"));
        assert.ok(decodeURIComponent(opts.path).includes("{'scriptText':{$contains:'calcPrice',$options:'I'}}"));
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify(mockResult),
        };
      };

      const result = await commands.runGlobalSearchBml(makeContext(), vscode, terminal, { transport });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.totalResults, 1);
      assert.ok(lines.some((l) => l.includes("Found 1 match")));
      assert.ok(lines.some((l) => l.includes("Calculate Price Rule")));
    }));

  test("cancels gracefully if input box is dismissed", async () => {
    const vscode = createFakeVscode({
      config: baseVscodeConfig(),
      window: { showInputBox: async () => undefined },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runGlobalSearchBml(makeContext(), vscode, terminal);
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("cancelled"));
  });
});
