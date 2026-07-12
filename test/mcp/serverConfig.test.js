const assert = require("assert");
const vscode = require("vscode");
const { getMcpServerStatus, stopMcpServer } = require("../../app/lang/mcp/server");
const { activateExtension } = require("../extensionHelper");

suite("MCP Server Config Reactivity Integration", () => {
  suiteSetup(async () => {
    await activateExtension(vscode);
    // Wait dynamically for setImmediate commands registration to finish
    let commands = await vscode.commands.getCommands(true);
    while (!commands.includes('cpqBml.mcp.showInfo')) {
        await new Promise(resolve => setTimeout(resolve, 50));
        commands = await vscode.commands.getCommands(true);
    }
    const { startMcpServer, stopMcpServer, getMcpServerStatus } = require("../../app/lang/mcp/server");

  });

  suiteTeardown(() => {
    stopMcpServer();
  });

  test("toggling cpqBml.mcp.enable starts and stops the server", async function () {
    this.timeout(10000);
    const config = vscode.workspace.getConfiguration("cpqBml");
    const originalEnable = config.get("mcp.enable");
    const originalPort = config.get("mcp.port");

    try {
      stopMcpServer();
      assert.strictEqual(getMcpServerStatus().running, false, "Server should be stopped initially");

      await config.update("mcp.port", 0, vscode.ConfigurationTarget.Global);
      await new Promise(resolve => setTimeout(resolve, 500));

      await config.update("mcp.enable", true, vscode.ConfigurationTarget.Global);
      for (let i = 0; i < 50; i++) {
        if (getMcpServerStatus().running) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const statusEnabled = getMcpServerStatus();
      assert.strictEqual(statusEnabled.running, true, "Server should have started automatically when enabled");

      await config.update("mcp.enable", false, vscode.ConfigurationTarget.Global);
      for (let i = 0; i < 50; i++) {
        if (!getMcpServerStatus().running) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const statusDisabled = getMcpServerStatus();
      assert.strictEqual(statusDisabled.running, false, "Server should have stopped automatically when disabled");
    } finally {
      await config.update("mcp.enable", originalEnable, vscode.ConfigurationTarget.Global);
      await config.update("mcp.port", originalPort, vscode.ConfigurationTarget.Global);
    }
  });
});
