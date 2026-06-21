const assert = require("assert");
const vscode = require("vscode");
const { getAiTerminal } = require("../../app/lang/mcp/aiTerminal");

suite("MCP aiTerminal", () => {
  test("returns null by default (cpqBml.mcp.logToTerminal is off until a user opts in)", () => {
    assert.strictEqual(getAiTerminal(vscode), null);
  });

  test("creates a real, writable integrated terminal once cpqBml.mcp.logToTerminal is enabled", async () => {
    const config = vscode.workspace.getConfiguration("cpqBml");
    await config.update("mcp.logToTerminal", true, vscode.ConfigurationTarget.Global);
    try {
      const terminal = getAiTerminal(vscode);
      assert.ok(terminal, "expected a real terminal, not the null fallback");
      assert.strictEqual(typeof terminal.writeLine, "function");
      assert.doesNotThrow(() => terminal.writeLine("MCP aiTerminal integration test line"));
      assert.doesNotThrow(() => terminal.show());

      // same singleton instance on repeated calls while still enabled
      assert.strictEqual(getAiTerminal(vscode), terminal);
    } finally {
      await config.update("mcp.logToTerminal", false, vscode.ConfigurationTarget.Global);
    }
  });

  test("stops returning the terminal once the setting is disabled again", () => {
    assert.strictEqual(getAiTerminal(vscode), null);
  });
});
