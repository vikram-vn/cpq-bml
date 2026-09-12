const assert = require("assert");
const { handleMessage } = require("@/lang/settings-panel/messageHandler");
const config = require("@/lang/rest/config");
const { decryptSecret, isCustomAesEncrypted } = require("@/lang/rest/crypto");
const { createFakeVscode, createFakeContext } = require("@/test/rest/testHelpers");
const path = require("path");

function fakePanel() {
  const posted = [];
  return { posted, webview: { postMessage: (msg) => posted.push(msg) } };
}

// Regression guard for the non-negotiable rule: a secret value must never be
// included in any outbound postMessage, in any test in this file.
function assertNoSecretLeak(posted, secretValue) {
  assert.ok(!JSON.stringify(posted).includes(secretValue), `secret "${secretValue}" leaked into a postMessage payload`);
}

suite("settings-panel messageHandler", () => {
  test("'ready' sends a full state snapshot", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "sitename" } });
    const context = createFakeContext({});

    await handleMessage({ type: "ready" }, context, vscode, panel);

    assert.strictEqual(panel.posted.length, 1);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[0].connection.siteUrl, "sitename");
  });

  test("'updateField' writes the setting and re-sends state", async () => {
    const configValues = {};
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "updateField", key: "connection.siteUrl", value: "newsite" }, context, vscode, panel);

    assert.strictEqual(configValues["connection.siteUrl"], "newsite");
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[0].connection.siteUrl, "newsite");
  });

  test("'updateField' supports updating connection.enabled", async () => {
    const configValues = {};
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "updateField", key: "connection.enabled", value: false }, context, vscode, panel);

    assert.strictEqual(configValues["connection.enabled"], false);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[0].connection.enabled, false);
  });

  test("'updateField' supports updating inlayHints fields", async () => {
    const configValues = {};
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "updateField", key: "inlayHints.enabled", value: false }, context, vscode, panel);
    assert.strictEqual(configValues["inlayHints.enabled"], false);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[0].inlayHints.enabled, false);

    await handleMessage({ type: "updateField", key: "inlayHints.variableTypes.enabled", value: true }, context, vscode, panel);
    assert.strictEqual(configValues["inlayHints.variableTypes.enabled"], true);
    assert.strictEqual(panel.posted[1].type, "state");
    assert.strictEqual(panel.posted[1].inlayHints.variableTypes, true);
  });

  test("'updateField' with a key outside the allow-list is rejected with an error message, and writes nothing", async () => {
    const configValues = {};
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "updateField", key: "connection.password", value: "hack" }, context, vscode, panel);

    assert.strictEqual(configValues["connection.password"], undefined);
    assert.strictEqual(panel.posted[0].type, "error");
    assert.ok(panel.posted[0].message.includes("unknown setting"));
  });

  test("'setPassword' dual-writes the secret (never echoed back) and re-sends state", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({
      config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
    });
    const context = createFakeContext({});

    await handleMessage({ type: "setPassword", value: "super-secret-pw" }, context, vscode, panel);

    const storedGlobal = await context.secrets.get(config.SECRET_PASSWORD);
    assert.ok(isCustomAesEncrypted(storedGlobal));
    assert.strictEqual(decryptSecret(storedGlobal, context, vscode), "super-secret-pw");
    const storedSite = await context.secrets.get(config.getPasswordSecretKey("https://sitename.oracle.com", "alice"));
    assert.ok(isCustomAesEncrypted(storedSite));
    assert.strictEqual(decryptSecret(storedSite, context, vscode), "super-secret-pw");
    assert.strictEqual(panel.posted[panel.posted.length - 1].type, "state");
    assert.strictEqual(panel.posted[panel.posted.length - 1].hasPassword, true);
    assertNoSecretLeak(panel.posted, "super-secret-pw");
  });

  test("'setAuthToken' dual-writes the secret (never echoed back) and re-sends state", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "https://sitename.oracle.com" } });
    const context = createFakeContext({});

    await handleMessage({ type: "setAuthToken", value: "super-secret-token" }, context, vscode, panel);

    const storedToken = await context.secrets.get(config.SECRET_TOKEN);
    assert.ok(isCustomAesEncrypted(storedToken));
    assert.strictEqual(decryptSecret(storedToken, context, vscode), "super-secret-token");
    assert.strictEqual(panel.posted[panel.posted.length - 1].hasToken, true);
    assertNoSecretLeak(panel.posted, "super-secret-token");
  });

  test("'testConnection' posts a testConnectionResult reflecting config.runTestConnection's outcome", async () => {
    const original = config.runTestConnection;
    config.runTestConnection = async () => ({ ok: true, reason: undefined, message: "CPQ-BML: connection successful." });
    try {
      const panel = fakePanel();
      const vscode = createFakeVscode({});
      const context = createFakeContext({});

      await handleMessage({ type: "testConnection" }, context, vscode, panel);

      assert.deepStrictEqual(panel.posted, [
        { type: "testConnectionResult", ok: true, message: "CPQ-BML: connection successful." },
      ]);
    } finally {
      config.runTestConnection = original;
    }
  });

  test("'activateEnvironment' copies the selected environment into active settings and re-sends state", async () => {
    const configValues = {
      "connection.environments": [{ name: "uat", siteUrl: "https://uat.bigmachines.com", username: "bob", authMethod: "bearer" }],
    };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "activateEnvironment", index: 0 }, context, vscode, panel);

    assert.strictEqual(configValues["connection.siteUrl"], "https://uat.bigmachines.com");
    assert.strictEqual(configValues["connection.username"], "bob");
    assert.strictEqual(panel.posted[panel.posted.length - 1].type, "state");
  });

  test("'activateEnvironment' with an out-of-range index posts an error instead of throwing", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "connection.environments": [] } });
    const context = createFakeContext({});

    await handleMessage({ type: "activateEnvironment", index: 0 }, context, vscode, panel);

    assert.strictEqual(panel.posted[0].type, "error");
  });

  test("'addEnvironment' appends to the array and re-sends state", async () => {
    const configValues = { "connection.environments": [] };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "addEnvironment", env: { name: "dev", siteUrl: "dev.bigmachines.com" } }, context, vscode, panel);

    assert.strictEqual(configValues["connection.environments"].length, 1);
    assert.strictEqual(panel.posted[panel.posted.length - 1].environments.length, 1);
  });

  test("'addEnvironment' with a missing name posts an error instead of throwing", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "connection.environments": [] } });
    const context = createFakeContext({});

    await handleMessage({ type: "addEnvironment", env: { name: "", siteUrl: "x" } }, context, vscode, panel);

    assert.strictEqual(panel.posted[0].type, "error");
  });

  test("'updateEnvironment' replaces the entry at the given index and re-sends state", async () => {
    const configValues = { "connection.environments": [{ name: "dev", siteUrl: "dev.bigmachines.com" }] };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage(
      { type: "updateEnvironment", index: 0, env: { name: "dev2", siteUrl: "dev2.bigmachines.com" } },
      context,
      vscode,
      panel,
    );

    assert.strictEqual(configValues["connection.environments"][0].name, "dev2");
  });

  test("'deleteEnvironment' removes the entry at the given index and re-sends state", async () => {
    const configValues = { "connection.environments": [{ name: "dev", siteUrl: "dev.bigmachines.com" }] };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "deleteEnvironment", index: 0 }, context, vscode, panel);

    assert.deepStrictEqual(configValues["connection.environments"], []);
  });

  test("'openNativeSettings' opens the native Settings UI scoped to cpqBml by default", async () => {
    let openedWith;
    const panel = fakePanel();
    const vscode = createFakeVscode({
      commands: { executeCommand: async (cmd, arg) => { openedWith = [cmd, arg]; } },
    });
    const context = createFakeContext({});

    await handleMessage({ type: "openNativeSettings" }, context, vscode, panel);

    assert.deepStrictEqual(openedWith, ["workbench.action.openSettings", "cpqBml"]);
  });

  test("'ready' switches to targetTab if set on panel", async () => {
    const panel = fakePanel();
    panel.targetTab = "environments";
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "sitename" } });
    const context = createFakeContext({});

    await handleMessage({ type: "ready" }, context, vscode, panel);

    assert.strictEqual(panel.posted.length, 1);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[0].activeTab, "environments");
    assert.strictEqual(panel.targetTab, null);
  });

  test("'tabChanged' updates the panel's editor tab title to match the new tab", async () => {
    const panel = fakePanel();
    panel.title = "CPQ-BML: Connection Settings";
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    await handleMessage({ type: "tabChanged", tab: "mcp" }, context, vscode, panel);

    assert.strictEqual(panel.title, "CPQ-BML: AI & MCP");
    assert.strictEqual(panel.posted.length, 0, "tabChanged should not post anything back to the webview");
  });

  test("'resetSettings' resets settings to factory defaults and posts state and toast", async () => {
    const configValues = { "connection.siteUrl": "custom-site", "features.lint": false };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext({});

    await handleMessage({ type: "resetSettings" }, context, vscode, panel);

    assert.strictEqual(configValues["connection.siteUrl"], "");
    assert.strictEqual(configValues["features.lint"], true);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[1].type, "toast");
    assert.strictEqual(panel.posted[1].message, "Settings reset to defaults");
  });

  test("'clearPassword' deletes stored password and posts state and toast", async () => {
    const secrets = { [config.SECRET_PASSWORD]: "secret123" };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "mysite", "connection.username": "myuser" } });
    const context = createFakeContext(secrets);

    await handleMessage({ type: "clearPassword" }, context, vscode, panel);

    assert.strictEqual(await context.secrets.get(config.SECRET_PASSWORD), undefined);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[1].type, "toast");
    assert.strictEqual(panel.posted[1].message, "Password cleared successfully");
  });

  test("'clearAuthToken' deletes stored token and posts state and toast", async () => {
    const secrets = { [config.SECRET_TOKEN]: "token123" };
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "mysite" } });
    const context = createFakeContext(secrets);

    await handleMessage({ type: "clearAuthToken" }, context, vscode, panel);

    assert.strictEqual(await context.secrets.get(config.SECRET_TOKEN), undefined);
    assert.strictEqual(panel.posted[0].type, "state");
    assert.strictEqual(panel.posted[1].type, "toast");
    assert.strictEqual(panel.posted[1].message, "Auth token cleared successfully");
  });

  test("'toast' echoes the toast notification back to the panel webview", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    await handleMessage({ type: "toast", message: "Hello from webview" }, context, vscode, panel);

    assert.strictEqual(panel.posted.length, 1);
    assert.strictEqual(panel.posted[0].type, "toast");
    assert.strictEqual(panel.posted[0].message, "Hello from webview");
  });

  test("'syncMetadata' posts syncProgress updates to the panel webview", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    await handleMessage({ type: "syncMetadata" }, context, vscode, panel);

    const progressMessages = panel.posted.filter((m) => m.type === "syncProgress");
    assert.ok(progressMessages.length >= 1, "Expected at least one syncProgress message");
    assert.strictEqual(progressMessages[0].isSyncing, true);
  });

  test("'removeMetadata' invokes removal and posts updated state and toast", async () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-remove-panel-test-"));
    const cpqDir = path.join(tempDir, "cpq");
    fs.mkdirSync(cpqDir, { recursive: true });
    fs.writeFileSync(path.join(cpqDir, "commerce.attributes.min.json"), JSON.stringify({ attributes: [] }));

    const panel = fakePanel();
    const vscode = createFakeVscode({
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });
    const context = createFakeContext({});

    try {
      await handleMessage({ type: "removeMetadata" }, context, vscode, panel);

      const stateMsg = panel.posted.find((m) => m.type === "state");
      const toastMsg = panel.posted.find((m) => m.type === "toast");

      assert.ok(stateMsg, "Expected state message to be posted");
      assert.strictEqual(stateMsg.metadata.isSynced, false);
      assert.ok(toastMsg, "Expected toast message to be posted");
      assert.ok(toastMsg.message.includes("removed"));
      assert.strictEqual(fs.existsSync(cpqDir), false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("'registerMcp' posts toast and mcpActionResult with detected/skipped tools", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "mcp.port": 48888 } });
    const context = createFakeContext({});

    await handleMessage({ type: "registerMcp" }, context, vscode, panel);

    const toastMsg = panel.posted.find((m) => m.type === "toast");
    const actionMsg = panel.posted.find((m) => m.type === "mcpActionResult");
    assert.ok(toastMsg, "Expected toast message to be posted");
    assert.ok(actionMsg, "Expected mcpActionResult message to be posted");
    assert.strictEqual(actionMsg.action, "register");
    assert.strictEqual(actionMsg.port, 48888);
    assert.ok(Array.isArray(actionMsg.registered));
    assert.ok(Array.isArray(actionMsg.skipped));
  });

  test("'deregisterMcp' posts toast and mcpActionResult", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    await handleMessage({ type: "deregisterMcp" }, context, vscode, panel);

    const toastMsg = panel.posted.find((m) => m.type === "toast");
    const actionMsg = panel.posted.find((m) => m.type === "mcpActionResult");
    assert.ok(toastMsg, "Expected toast message to be posted");
    assert.ok(actionMsg, "Expected mcpActionResult message to be posted");
    assert.strictEqual(actionMsg.action, "deregister");
    assert.ok(Array.isArray(actionMsg.deregistered));
  });

  test("'syncBmlSkills' syncs skills from extension to global config and posts result", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({});
    const context = createFakeContext({ extensionPath: path.resolve(__dirname, "../..") });

    await handleMessage({ type: "syncBmlSkills" }, context, vscode, panel);

    const toastMsg = panel.posted.find((m) => m.type === "toast");
    const resultMsg = panel.posted.find((m) => m.type === "bmlSkillsSyncResult");
    assert.ok(toastMsg, "Expected toast message to be posted");
    assert.ok(resultMsg, "Expected bmlSkillsSyncResult to be posted");
    assert.strictEqual(resultMsg.success, true);
    assert.ok(typeof resultMsg.synced === "number" && resultMsg.synced >= 0);
  });

  test("'getAiToolsStatus' posts aiToolsStatus with all supported tools", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    await handleMessage({ type: "getAiToolsStatus" }, context, vscode, panel);

    const statusMsg = panel.posted.find((m) => m.type === "aiToolsStatus");
    assert.ok(statusMsg, "Expected aiToolsStatus message to be posted");
    assert.ok(Array.isArray(statusMsg.tools));
    assert.ok(statusMsg.tools.length >= 7);
  });

  test("'getMcpHealth' returns healthy status", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({ config: { "mcp.enable": true, "mcp.port": 47821 } });
    const context = createFakeContext({});

    await handleMessage({ type: "getMcpHealth" }, context, vscode, panel);

    const healthMsg = panel.posted.find((m) => m.type === "mcpHealth");
    assert.ok(healthMsg, "Expected mcpHealth message to be posted");
    assert.ok(typeof healthMsg.healthy === "boolean");
    assert.ok(healthMsg.port);
  });

  test("an unknown message type posts an error instead of throwing", async () => {
    const panel = fakePanel();
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    await handleMessage({ type: "somethingUnknown" }, context, vscode, panel);

    assert.strictEqual(panel.posted[0].type, "error");
    assert.ok(panel.posted[0].message.includes("unknown message type"));
  });
});
