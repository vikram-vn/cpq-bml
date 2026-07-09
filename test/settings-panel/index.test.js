const assert = require("assert");
const { shouldAutoOpenOnInstall, FIRST_INSTALL_KEY, hasMissingCredentials } = require("../../app/lang/settings-panel");
const { createFakeContext, createFakeVscode } = require("../rest/testHelpers");

suite("settings-panel index - first-install auto-open", () => {
  test("returns true the first time (flag not yet set)", () => {
    const context = createFakeContext();
    assert.strictEqual(shouldAutoOpenOnInstall(context), true);
  });

  test("returns false once the flag has been recorded", async () => {
    const context = createFakeContext();
    await context.globalState.update(FIRST_INSTALL_KEY, true);
    assert.strictEqual(shouldAutoOpenOnInstall(context), false);
  });
});

suite("settings-panel index - hasMissingCredentials", () => {
  test("returns true if siteUrl is empty", async () => {
    const context = createFakeContext();
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "",
        "connection.authMethod": "basic",
        "connection.username": "testuser"
      }
    });
    const result = await hasMissingCredentials(context, vscode);
    assert.strictEqual(result, true);
  });

  test("returns true if username is empty for basic auth", async () => {
    const context = createFakeContext();
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "testsite",
        "connection.authMethod": "basic",
        "connection.username": ""
      }
    });
    const result = await hasMissingCredentials(context, vscode);
    assert.strictEqual(result, true);
  });

  test("returns true if password is empty in basic auth", async () => {
    const context = createFakeContext();
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "testsite",
        "connection.authMethod": "basic",
        "connection.username": "testuser"
      }
    });
    const result = await hasMissingCredentials(context, vscode);
    assert.strictEqual(result, true);
  });

  test("returns false if siteUrl, username and password are all present in basic auth", async () => {
    const context = createFakeContext({
      "cpqBml.connection.password.https___testsite_bigmachines_com.testuser": "mypassword"
    });
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "testsite",
        "connection.authMethod": "basic",
        "connection.username": "testuser"
      }
    });
    const result = await hasMissingCredentials(context, vscode);
    assert.strictEqual(result, false);
  });

  test("returns true if token is missing in bearer auth", async () => {
    const context = createFakeContext();
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "testsite",
        "connection.authMethod": "bearer"
      }
    });
    const result = await hasMissingCredentials(context, vscode);
    assert.strictEqual(result, true);
  });

  test("returns false if token is present in bearer auth", async () => {
    const context = createFakeContext({
      "cpqBml.connection.token.https___testsite_bigmachines_com": "mytoken"
    });
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "testsite",
        "connection.authMethod": "bearer"
      }
    });
    const result = await hasMissingCredentials(context, vscode);
    assert.strictEqual(result, false);
  });
});

suite("settings-panel index - registerSettingsPanel smart activation", () => {
  let originalFindFiles;
  let originalGetConfiguration;
  let originalRegisterCommand;
  let originalOnDidChangeActiveTextEditor;
  let originalOnDidOpenTextDocument;

  setup(() => {
    const vscode = require('vscode');
    originalFindFiles = vscode.workspace.findFiles;
    originalGetConfiguration = vscode.workspace.getConfiguration;
    originalRegisterCommand = vscode.commands.registerCommand;
    originalOnDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor;
    originalOnDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument;
  });

  teardown(() => {
    const vscode = require('vscode');
    vscode.workspace.findFiles = originalFindFiles;
    vscode.workspace.getConfiguration = originalGetConfiguration;
    vscode.commands.registerCommand = originalRegisterCommand;
    vscode.window.onDidChangeActiveTextEditor = originalOnDidChangeActiveTextEditor;
    vscode.workspace.onDidOpenTextDocument = originalOnDidOpenTextDocument;
  });

  test("does not open settings panel if workspace has no -meta.json files", async () => {
    const vscode = require('vscode');
    const { registerSettingsPanel } = require("../../app/lang/settings-panel");
    const context = createFakeContext();
    context.subscriptions = [];

    vscode.workspace.findFiles = async () => [];
    vscode.workspace.getConfiguration = () => ({
      get: (key, def) => (key === 'connection.siteUrl' ? '' : def),
      update: async () => {}
    });
    vscode.commands.registerCommand = () => ({ dispose: () => {} });
    vscode.window.onDidChangeActiveTextEditor = () => ({ dispose: () => {} });
    vscode.workspace.onDidOpenTextDocument = () => ({ dispose: () => {} });

    registerSettingsPanel(context);

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(context.globalState.get(FIRST_INSTALL_KEY, false), false);
  });

  test("opens settings panel if workspace has -meta.json files and config is empty", async () => {
    const vscode = require('vscode');
    const { registerSettingsPanel } = require("../../app/lang/settings-panel");
    const context = createFakeContext();
    context.subscriptions = [];

    vscode.workspace.findFiles = async () => [vscode.Uri.file('some-meta.json')];
    vscode.workspace.getConfiguration = () => ({
      get: (key, def) => (key === 'connection.siteUrl' ? '' : def),
      update: async () => {}
    });
    vscode.commands.registerCommand = () => ({ dispose: () => {} });
    vscode.window.onDidChangeActiveTextEditor = () => ({ dispose: () => {} });
    vscode.workspace.onDidOpenTextDocument = () => ({ dispose: () => {} });

    registerSettingsPanel(context);

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(context.globalState.get(FIRST_INSTALL_KEY, false), true);
  });
});
