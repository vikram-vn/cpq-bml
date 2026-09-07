const assert = require("assert");
const commands = require("../../../app/lang/rest/commands");
const { createFakeVscode } = require("../testHelpers");
const { baseVscodeConfig, makeContext, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - pipelineViewer", () => {
  test("fails if credentials are not configured", async () => {
    const vscode = createFakeVscode({
      config: { "connection.siteUrl": "" },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runPipelineViewerCommand(
      makeContext({}),
      vscode,
      terminal,
      { id: "12345" },
    );
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("credentials"));
  });

  test("cancels gracefully if input box is dismissed", async () => {
    const vscode = createFakeVscode({
      config: baseVscodeConfig(),
      window: { showInputBox: async () => undefined },
    });
    const terminal = fakeResultsTerminal();
    const result = await commands.runPipelineViewerCommand(
      makeContext(),
      vscode,
      terminal,
    );
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage.includes("cancelled"));
  });

  test("executes pipeline viewer and prints steps to results terminal", async () => {
    const lines = [];
    const terminal = fakeResultsTerminal(lines);
    const infoMessages = [];
    const vscode = createFakeVscode({
      config: baseVscodeConfig(),
      window: { showInformationMessage: (msg) => infoMessages.push(msg) },
    });

    const mockResponse = {
      items: [
        { name: "Calculate Pricing", type: "FORMULA", executionTimeMs: 12 },
        { name: "Validate Discount Limits", type: "VALIDATION", executionTimeMs: 5 },
        { name: "Apply Tax Modify Script", type: "ADVANCED_MODIFY", executionTimeMs: 45 },
      ],
    };

    const transport = async (opts) => {
      assert.strictEqual(opts.method, "POST");
      assert.ok(opts.path.includes("/actions/_pipelineViewer"));
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify(mockResponse),
      };
    };

    const result = await commands.runPipelineViewerCommand(
      makeContext(),
      vscode,
      terminal,
      { id: "36365138", transport },
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.statusCode, 200);
    assert.ok(lines.some((l) => l.includes("Pipeline Viewer completed:")));
    assert.ok(lines.some((l) => l.includes("Calculate Pricing")));
    assert.ok(lines.some((l) => l.includes("Apply Tax Modify Script")));
    assert.ok(infoMessages.some((m) => m.includes("36365138")));
  });

  test("handles CPQ error response gracefully", async () => {
    const lines = [];
    const terminal = fakeResultsTerminal(lines);
    const errorMessages = [];
    const vscode = createFakeVscode({
      config: baseVscodeConfig(),
      window: { showErrorMessage: (msg) => errorMessages.push(msg) },
    });

    const transport = async () => ({
      statusCode: 404,
      headers: { "content-type": "application/json" },
      text: JSON.stringify({ error: "Transaction not found" }),
    });

    const result = await commands.runPipelineViewerCommand(
      makeContext(),
      vscode,
      terminal,
      { id: "99999", transport },
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 404);
    assert.ok(lines.some((l) => l.includes("Pipeline Viewer failed:")));
    assert.ok(errorMessages.some((m) => m.includes("404")));
  });
});
