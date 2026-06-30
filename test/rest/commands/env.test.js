const assert = require("assert");
const commands = require("../../../app/lang/rest/commands");
const config = require("../../../app/lang/rest/config");
const {
  applyEnvironment,
  addEnvironment,
  updateEnvironment,
  deleteEnvironment,
} = require("../../../app/lang/rest/commands/env");
const { createFakeVscode, createFakeContext } = require("../test-helpers");

suite("BML REST commands - environment CRUD (used by the settings webview)", () => {
  test("applyEnvironment copies siteUrl/username/authMethod into active settings, excluding any password/token", async () => {
    const configValues = { "connection.siteUrl": "https://old.bigmachines.com" };
    const vscode = createFakeVscode({ config: configValues });

    await applyEnvironment(vscode, { name: "uat", siteUrl: "https://uat.bigmachines.com", username: "bob", authMethod: "bearer" });

    assert.strictEqual(configValues["connection.siteUrl"], "https://uat.bigmachines.com");
    assert.strictEqual(configValues["connection.username"], "bob");
    assert.strictEqual(configValues["connection.authMethod"], "bearer");
  });

  test("addEnvironment appends a normalized environment and rejects one missing a name or siteUrl", async () => {
    const configValues = { "connection.environments": [] };
    const vscode = createFakeVscode({ config: configValues });

    await addEnvironment(vscode, { name: "dev", siteUrl: "dev.bigmachines.com" });
    assert.deepStrictEqual(configValues["connection.environments"], [
      { name: "dev", siteUrl: "dev.bigmachines.com", username: "", authMethod: "basic" },
    ]);

    await assert.rejects(() => addEnvironment(vscode, { name: "", siteUrl: "x" }), /requires a name/);
    await assert.rejects(() => addEnvironment(vscode, { name: "x", siteUrl: "" }), /requires a name/);
  });

  test("updateEnvironment replaces the environment at the given index", async () => {
    const configValues = {
      "connection.environments": [{ name: "dev", siteUrl: "dev.bigmachines.com", username: "", authMethod: "basic" }],
    };
    const vscode = createFakeVscode({ config: configValues });

    await updateEnvironment(vscode, 0, { name: "dev2", siteUrl: "dev2.bigmachines.com", username: "alice", authMethod: "bearer" });

    assert.deepStrictEqual(configValues["connection.environments"], [
      { name: "dev2", siteUrl: "dev2.bigmachines.com", username: "alice", authMethod: "bearer" },
    ]);

    await assert.rejects(() => updateEnvironment(vscode, 5, { name: "x", siteUrl: "y" }), /index out of range/);
  });

  test("deleteEnvironment removes the environment at the given index", async () => {
    const configValues = {
      "connection.environments": [
        { name: "dev", siteUrl: "dev.bigmachines.com" },
        { name: "uat", siteUrl: "uat.bigmachines.com" },
      ],
    };
    const vscode = createFakeVscode({ config: configValues });

    await deleteEnvironment(vscode, 0);

    assert.deepStrictEqual(configValues["connection.environments"], [{ name: "uat", siteUrl: "uat.bigmachines.com" }]);

    await assert.rejects(() => deleteEnvironment(vscode, 5), /index out of range/);
  });
});

suite("BML REST commands - changeEnvironment & site-specific secrets", () => {
  test("switches environment configurations correctly based on cpqBml.connection.environments setting", async () => {
    const configValues = {
      "connection.environments": [
        { name: "dev", siteUrl: "https://dev.bigmachines.com", username: "alice", authMethod: "basic" },
        { name: "uat", siteUrl: "https://uat.bigmachines.com", username: "bob", authMethod: "bearer" }
      ],
      "connection.siteUrl": "https://old.bigmachines.com",
      "connection.username": "olduser",
      "connection.authMethod": "basic"
    };

    const vscode = createFakeVscode({
      config: configValues,
      window: {
        showQuickPick: async (items) => {
          // select "uat" environment
          return items.find((item) => item.label === "uat");
        }
      }
    });

    await commands.runChangeEnvironment(createFakeContext(), vscode);

    assert.strictEqual(configValues["connection.siteUrl"], "https://uat.bigmachines.com");
    assert.strictEqual(configValues["connection.username"], "bob");
    assert.strictEqual(configValues["connection.authMethod"], "bearer");
  });

  test("shows warning and option to open settings if no environments are configured", async () => {
    const configValues = {
      "connection.environments": []
    };
    let warningShown = false;
    let openedSettings = false;

    const vscode = createFakeVscode({
      config: configValues,
      window: {
        showWarningMessage: async (msg, button) => {
          warningShown = true;
          return "Open Settings";
        }
      },
      commands: {
        executeCommand: async (cmd, arg) => {
          if (cmd === "cpqBml.settings.open") {
            openedSettings = true;
          }
        }
      }
    });

    await commands.runChangeEnvironment(createFakeContext(), vscode);

    assert.ok(warningShown);
    assert.ok(openedSettings);
  });

  test("stores and retrieves password in site-specific secrets, and falls back to legacy global key", async () => {
    const configValues = {
      "connection.siteUrl": "https://dev.bigmachines.com",
      "connection.username": "alice",
      "connection.authMethod": "basic"
    };

    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext();

    // 1. Store via ensureCredentials
    let prompts = ["mypassword"];
    vscode.window.showInputBox = async () => prompts.shift();
    const ok = await config.ensureCredentials(context, vscode);
    assert.ok(ok);

    const siteSpecificKey = config.getPasswordSecretKey("https://dev.bigmachines.com", "alice");
    assert.strictEqual(siteSpecificKey, "cpqBml.connection.password.https___dev_bigmachines_com.alice");

    // Password must be in siteSpecificKey
    const savedPassword = await context.secrets.get(siteSpecificKey);
    assert.strictEqual(savedPassword, "mypassword");

    // 2. Retrieve header
    const authHeader = await config.getAuthHeader(context, vscode);
    const expectedEncoded = Buffer.from("alice:mypassword").toString("base64");
    assert.strictEqual(authHeader, `Basic ${expectedEncoded}`);

    // 3. Fallback check: delete site-specific, set global secret
    await context.secrets.store(siteSpecificKey, null);
    await context.secrets.store(config.SECRET_PASSWORD, "fallbackpw");

    const authHeaderFallback = await config.getAuthHeader(context, vscode);
    const expectedFallbackEncoded = Buffer.from("alice:fallbackpw").toString("base64");
    assert.strictEqual(authHeaderFallback, `Basic ${expectedFallbackEncoded}`);
  });

  test("stores and retrieves token in site-specific secrets for bearer auth", async () => {
    const configValues = {
      "connection.siteUrl": "https://uat.bigmachines.com",
      "connection.authMethod": "bearer"
    };

    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext();

    // 1. Store via ensureCredentials
    let prompts = ["mytoken"];
    vscode.window.showInputBox = async () => prompts.shift();
    const ok = await config.ensureCredentials(context, vscode);
    assert.ok(ok);

    const siteSpecificKey = config.getTokenSecretKey("https://uat.bigmachines.com");
    assert.strictEqual(siteSpecificKey, "cpqBml.connection.token.https___uat_bigmachines_com");

    const savedToken = await context.secrets.get(siteSpecificKey);
    assert.strictEqual(savedToken, "mytoken");

    // 2. Retrieve header
    const authHeader = await config.getAuthHeader(context, vscode);
    assert.strictEqual(authHeader, "Bearer mytoken");

    // 3. Fallback check
    await context.secrets.store(siteSpecificKey, null);
    await context.secrets.store(config.SECRET_TOKEN, "fallbacktoken");

    const authHeaderFallback = await config.getAuthHeader(context, vscode);
    assert.strictEqual(authHeaderFallback, "Bearer fallbacktoken");
  });

  test("does not fall back to legacy global secrets when multiple environments are configured", async () => {
    const configValues = {
      "connection.environments": [
        { name: "dev", siteUrl: "https://dev.bigmachines.com", username: "alice", authMethod: "basic" },
        { name: "uat", siteUrl: "https://uat.bigmachines.com", username: "bob", authMethod: "bearer" }
      ],
      "connection.siteUrl": "https://dev.bigmachines.com",
      "connection.username": "alice",
      "connection.authMethod": "basic"
    };

    const vscode = createFakeVscode({ config: configValues });
    const context = createFakeContext();

    // Set legacy global password in secrets, but NOT site-specific password
    await context.secrets.store(config.SECRET_PASSWORD, "globalpassword");

    // Since multiple environments are configured, ensureCredentials must prompt the user instead of falling back to globalpassword
    let promptedValue = null;
    vscode.window.showInputBox = async (options) => {
      promptedValue = "newpassword";
      return promptedValue;
    };

    const ok = await config.ensureCredentials(context, vscode);
    assert.ok(ok);
    assert.strictEqual(promptedValue, "newpassword");

    const siteSpecificKey = config.getPasswordSecretKey("https://dev.bigmachines.com", "alice");
    const savedPassword = await context.secrets.get(siteSpecificKey);
    assert.strictEqual(savedPassword, "newpassword");
  });
});

