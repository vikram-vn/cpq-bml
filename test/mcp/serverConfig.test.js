const assert = require("assert");
const vscode = require("vscode");
const { getMcpServerStatus, stopMcpServer } = require("../../app/lang/mcp/server");

suite("MCP Server Config Reactivity Integration", () => {
  suiteSetup(async () => {
    const { startMcpServer, stopMcpServer, getMcpServerStatus } = require("../../app/lang/mcp/server");

    const getSettings = () => {
        const cfg = vscode.workspace.getConfiguration('cpqBml');
        return {
            enable: cfg.get('mcp.enable', false),
            port: cfg.get('mcp.port', 47821),
        };
    };

    const ensureStarted = async () => {
        const { enable, port } = getSettings();
        if (!enable) return { started: false, reason: 'cpqBml.mcp.enable is false' };
        try {
            const result = await startMcpServer(null, vscode, port);
            return { started: true, port: result.port };
        } catch (err) {
            console.error("TEST ENSURE STARTED ERROR:", err);
            return { started: false, reason: err && err.message ? err.message : String(err) };
        }
    };

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration('cpqBml.mcp')) return;
        const status = getMcpServerStatus();
        const { enable, port } = getSettings();
        
        if (!enable) {
            if (status.running) {
                stopMcpServer();
            }
        } else {
            if (status.running && status.port !== port) {
                stopMcpServer();
                await ensureStarted();
            } else if (!status.running) {
                await ensureStarted();
            }
        }
    });
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
