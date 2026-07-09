const assert = require("assert");
const vscode = require("vscode");

// Real-vscode integration smoke test (the actual webview panel/JS context
// itself isn't reachable from Node-side Mocha tests - see messageHandler.test.js
// and state.test.js for the fully unit-tested business logic this panel is
// built on). This just confirms the command is registered and actually
// creates a real webview panel (including reading webview/index.html off disk,
// building the CSP, and resolving asWebviewUri) without throwing, and that
// re-invoking it (the singleton/reveal path) doesn't throw either.
suite("settings-panel panel (real vscode integration)", () => {
  test("cpqBml.settings.open creates a real webview panel without throwing, and re-invoking it (reveal path) doesn't throw either", async () => {
    await assert.doesNotReject(() => vscode.commands.executeCommand("cpqBml.settings.open"));
    await assert.doesNotReject(() => vscode.commands.executeCommand("cpqBml.settings.open"));
  });

  test("cpqBml.settings.open executes with specific tab arguments without throwing", async () => {
    await assert.doesNotReject(() => vscode.commands.executeCommand("cpqBml.settings.open", "environments"));
    await assert.doesNotReject(() => vscode.commands.executeCommand("cpqBml.settings.open", "connection"));
  });
});
