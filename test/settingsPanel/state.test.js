const assert = require("assert");
const { buildState } = require("../../app/lang/settingsPanel/state");
const config = require("../../app/lang/rest/config");
const { createFakeVscode, createFakeContext } = require("../rest/testHelpers");

suite("settingsPanel state", () => {
  test("buildState assembles all non-secret settings plus environments and hasPassword/hasToken booleans", async () => {
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "sitename",
        "connection.username": "alice",
        "connection.authMethod": "basic",
        "rest.restVersion": "v20",
        "rest.commerceProcess": "myProcess",
        "rest.commerceDocument": "myDoc",
        "debug.logRestDetails": true,
        "connection.environments": [{ name: "dev", siteUrl: "dev.bigmachines.com" }],
        "rest.pullFolder": "myLib",
        "features.lint": false,
        "features.spelling": false,
        "mcp.enable": true,
        "mcp.port": 12345,
        "mcp.logToTerminal": true,
        "debug.logOutputToFile": true,
      },
    });
    const context = createFakeContext({
      [config.getPasswordSecretKey("sitename", "alice")]: "secret-pw",
    });

    const state = await buildState(context, vscode);

    assert.deepStrictEqual(state, {
      connection: {
        siteUrl: "sitename",
        authMethod: "basic",
        username: "alice",
        enabled: true,
      },
      rest: {
        pullFolder: "myLib",
        restVersion: "v20",
        commerceProcess: "myProcess",
        commerceDocument: "myDoc",
      },
      features: {
        lint: false,
        comments: true,
        spelling: false,
        beautifier: true,
        intellisense: true,
        docHeader: true,
        xslt: true,
        metrics: true,
        testing: true
      },
      mcp: { enable: true, port: 12345, logToTerminal: true },
      debug: { logOutputToFile: true, logRestDetails: true, showResultsAsTable: false },
      environments: [{ name: "dev", siteUrl: "dev.bigmachines.com" }],
      hasPassword: true,
      hasToken: false,
    });
  });

  test("never includes the actual secret value anywhere in the returned object", async () => {
    const vscode = createFakeVscode({
      config: { "connection.siteUrl": "sitename", "connection.username": "alice" },
    });
    const context = createFakeContext({
      [config.getPasswordSecretKey("sitename", "alice")]: "super-secret-password",
    });

    const state = await buildState(context, vscode);

    assert.ok(!JSON.stringify(state).includes("super-secret-password"));
  });

  test("hasPassword/hasToken fall back to the legacy global secret key", async () => {
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "sitename" } });
    const context = createFakeContext({ [config.SECRET_TOKEN]: "tok" });

    const state = await buildState(context, vscode);

    assert.strictEqual(state.hasToken, true);
    assert.strictEqual(state.hasPassword, false);
  });

  test("defaults environments to an empty array when unset", async () => {
    const vscode = createFakeVscode({});
    const context = createFakeContext({});

    const state = await buildState(context, vscode);

    assert.deepStrictEqual(state.environments, []);
  });
});
