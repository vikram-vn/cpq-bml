const assert = require("assert");
const tools = require("../../app/lang/mcp/tools");
const config = require("../../app/lang/rest/config");
const { createFakeVscode, createFakeContext } = require("../rest/testHelpers");

function vscodeWith(configOverrides) {
  return createFakeVscode({ config: configOverrides });
}

suite("MCP tools - getConnectionStatus", () => {
  test("reports not configured, with a reason, when siteUrl is blank", async () => {
    const context = createFakeContext({});
    const vscode = vscodeWith({});

    const result = await tools.getConnectionStatus(context, vscode, {});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.configured, false);
    assert.ok(result.missingReason.includes("siteUrl"));
    assert.strictEqual(result.siteUrl, null);
  });

  test("reports not configured when siteUrl/username are set but no password secret exists", async () => {
    const context = createFakeContext({});
    const vscode = vscodeWith({
      "connection.siteUrl": "https://sitename.oracle.com",
      "connection.username": "alice",
      "connection.authMethod": "basic",
    });

    const result = await tools.getConnectionStatus(context, vscode, {});

    assert.strictEqual(result.configured, false);
    assert.ok(result.missingReason.includes("password"));
  });

  test("reports configured once siteUrl/username/password are all present, without ever including the secret", async () => {
    const context = createFakeContext({ [config.SECRET_PASSWORD]: "super-secret-pw" });
    const vscode = vscodeWith({
      "connection.siteUrl": "https://sitename.oracle.com",
      "connection.username": "alice",
      "connection.authMethod": "basic",
    });

    const result = await tools.getConnectionStatus(context, vscode, {});

    assert.strictEqual(result.configured, true);
    assert.strictEqual(result.missingReason, null);
    assert.strictEqual(result.username, "alice");
    assert.ok(!JSON.stringify(result).includes("super-secret-pw"), "secret must never appear in the result");
  });

  test("omits username for bearer auth", async () => {
    const context = createFakeContext({ [config.SECRET_TOKEN]: "super-secret-token" });
    const vscode = vscodeWith({
      "connection.siteUrl": "https://sitename.oracle.com",
      "connection.authMethod": "bearer",
    });

    const result = await tools.getConnectionStatus(context, vscode, {});

    assert.strictEqual(result.configured, true);
    assert.strictEqual(result.username, null);
    assert.strictEqual(result.authMethod, "bearer");
  });

  test("reports the matching environment name when the active site/username/authMethod matches one", async () => {
    const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });
    const vscode = vscodeWith({
      "connection.siteUrl": "https://sitename.oracle.com",
      "connection.username": "alice",
      "connection.authMethod": "basic",
      "connection.environments": [
        { name: "Production", siteUrl: "https://sitename.oracle.com", username: "alice", authMethod: "basic" },
      ],
    });

    const result = await tools.getConnectionStatus(context, vscode, {});

    assert.strictEqual(result.activeEnvironmentName, "Production");
    assert.strictEqual(result.environmentCount, 1);
  });

  test("does not make a network call unless testConnection:true is passed", async () => {
    let called = false;
    const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });
    const vscode = vscodeWith({
      "connection.siteUrl": "https://sitename.oracle.com",
      "connection.username": "alice",
    });
    const transport = async () => { called = true; return { statusCode: 200, headers: {}, text: "{}" }; };

    const result = await tools.getConnectionStatus(context, vscode, {}, transport);

    assert.strictEqual(called, false);
    assert.strictEqual(result.testResult, undefined);
  });

  test("pings CPQ live and includes testResult when testConnection:true is passed", async () => {
    const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });
    const vscode = vscodeWith({
      "connection.siteUrl": "https://sitename.oracle.com",
      "connection.username": "alice",
    });
    const transport = async () => ({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      text: JSON.stringify({ isSystemAdmin: true }),
    });

    const result = await tools.getConnectionStatus(context, vscode, { testConnection: true }, transport);

    assert.ok(result.testResult);
    assert.strictEqual(result.testResult.ok, true);
  });
});
