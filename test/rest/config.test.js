const assert = require("assert");
const config = require("../../app/lang/rest/config");
const {
  createFakeVscode,
  createFakeContext,
} = require("./test-helpers");

suite("BML REST config", () => {
  test("getSettings reads connection settings and strips a trailing slash from siteUrl", () => {
    const vscode = createFakeVscode({
      config: {
        "connection.siteUrl": "https://sitename.bigmachines.com/",
        "connection.authMethod": "bearer",
        "connection.username": "alice",
        "connection.restVersion": "v20",
        "rest.pullFolder": "my-library",
      },
    });

    assert.deepStrictEqual(config.getSettings(vscode), {
      siteUrl: "https://sitename.bigmachines.com",
      authMethod: "bearer",
      username: "alice",
      restVersion: "v20",
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
      pullFolder: "my-library",
      debugLog: false,
      logOutputToFile: false,
    });
  });

  test("getSettings falls back to documented defaults when nothing is configured, including REST version v18", () => {
    const vscode = createFakeVscode({});
    assert.deepStrictEqual(config.getSettings(vscode), {
      siteUrl: "",
      authMethod: "basic",
      username: "",
      restVersion: "v18",
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
      pullFolder: "library",
      debugLog: false,
      logOutputToFile: false,
    });
    assert.strictEqual(config.DEFAULT_REST_VERSION, "v18");
  });

  test("getSettings reads connection.debugLog setting when configured", () => {
    const vscode = createFakeVscode({
      config: {
        "connection.debugLog": true,
      },
    });
    assert.strictEqual(config.getSettings(vscode).debugLog, true);
  });

  test("getRestVersion reads cpqBml.connection.restVersion, defaulting to v18", () => {
    assert.strictEqual(config.getRestVersion(createFakeVscode({})), "v18");
    assert.strictEqual(
      config.getRestVersion(
        createFakeVscode({ config: { "connection.restVersion": "v21" } }),
      ),
      "v21",
    );
  });

  test("getCommerceProcess reads cpqBml.connection.commerceProcess, defaulting to oraclecpqo", () => {
    assert.strictEqual(config.getCommerceProcess(createFakeVscode({})), "oraclecpqo");
    assert.strictEqual(
      config.getCommerceProcess(
        createFakeVscode({ config: { "connection.commerceProcess": "customProcess" } }),
      ),
      "customProcess",
    );
  });

  test("getCommerceDocument reads cpqBml.connection.commerceDocument, defaulting to transaction", () => {
    assert.strictEqual(config.getCommerceDocument(createFakeVscode({})), "transaction");
    assert.strictEqual(
      config.getCommerceDocument(
        createFakeVscode({ config: { "connection.commerceDocument": "lineItem" } }),
      ),
      "lineItem",
    );
  });

  test("normalizeSiteUrl accepts every documented input form and normalizes to https://host with no trailing slash", () => {
    const expected = "https://sitename.bigmachines.com";
    assert.strictEqual(config.normalizeSiteUrl("https://sitename.bigmachines.com/"), expected);
    assert.strictEqual(config.normalizeSiteUrl("https://sitename.bigmachines.com"), expected);
    assert.strictEqual(config.normalizeSiteUrl("sitename.bigmachines.com/"), expected);
    assert.strictEqual(config.normalizeSiteUrl("sitename.bigmachines.com"), expected);
    assert.strictEqual(config.normalizeSiteUrl("sitename"), expected);
  });

  test("normalizeSiteUrl trims whitespace and collapses multiple trailing slashes", () => {
    assert.strictEqual(
      config.normalizeSiteUrl("  sitename.bigmachines.com//  "),
      "https://sitename.bigmachines.com",
    );
  });

  test("normalizeSiteUrl preserves an explicit http:// scheme rather than forcing https", () => {
    assert.strictEqual(
      config.normalizeSiteUrl("http://sitename.bigmachines.com/"),
      "http://sitename.bigmachines.com",
    );
  });

  test("normalizeSiteUrl preserves an explicit port and still appends the domain to a bare sitename", () => {
    assert.strictEqual(
      config.normalizeSiteUrl("sitename:8443"),
      "https://sitename.bigmachines.com:8443",
    );
  });

  test("normalizeSiteUrl returns an empty string when nothing is configured", () => {
    assert.strictEqual(config.normalizeSiteUrl(""), "");
    assert.strictEqual(config.normalizeSiteUrl(undefined), "");
  });

  test("getSettings normalizes a bare sitename the same way normalizeSiteUrl does", () => {
    const vscode = createFakeVscode({ config: { "connection.siteUrl": "sitename" } });
    assert.strictEqual(config.getSettings(vscode).siteUrl, "https://sitename.bigmachines.com");
  });

  test("getAuthHeader builds a Basic header from username + stored password", async () => {
    const vscode = createFakeVscode({
      config: { "connection.username": "alice" },
    });
    const context = createFakeContext({
      [config.SECRET_PASSWORD]: "secret123",
    });

    const header = await config.getAuthHeader(context, vscode);
    assert.strictEqual(
      header,
      `Basic ${Buffer.from("alice:secret123").toString("base64")}`,
    );
  });

  test("getAuthHeader builds a Bearer header from a stored token", async () => {
    const vscode = createFakeVscode({
      config: { "connection.authMethod": "bearer" },
    });
    const context = createFakeContext({ [config.SECRET_TOKEN]: "tok-abc" });

    const header = await config.getAuthHeader(context, vscode);
    assert.strictEqual(header, "Bearer tok-abc");
  });

  test("getAuthHeader throws a clear error when basic auth has no username configured", async () => {
    const vscode = createFakeVscode({});
    const context = createFakeContext({
      [config.SECRET_PASSWORD]: "secret123",
    });

    await assert.rejects(
      () => config.getAuthHeader(context, vscode),
      /username is not configured/,
    );
  });

  test("getAuthHeader throws a clear error when no password has been set", async () => {
    const vscode = createFakeVscode({
      config: { "connection.username": "alice" },
    });
    const context = createFakeContext({});

    await assert.rejects(
      () => config.getAuthHeader(context, vscode),
      /Set CPQ Password/,
    );
  });

  test("getAuthHeader throws a clear error when bearer auth has no token set", async () => {
    const vscode = createFakeVscode({
      config: { "connection.authMethod": "bearer" },
    });
    const context = createFakeContext({});

    await assert.rejects(
      () => config.getAuthHeader(context, vscode),
      /Set CPQ Auth Token/,
    );
  });

  suite("runTestConnection (no prompts/toasts - used by the settings webview's Test Connection button)", () => {
    function jsonResponse(statusCode, body) {
      return { statusCode, headers: { "content-type": "application/json" }, text: JSON.stringify(body) };
    }

    test("returns ok:true on a clean 200 with isSystemAdmin true", async () => {
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
      });
      const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });

      const result = await config.runTestConnection(context, vscode, async () => jsonResponse(200, { isSystemAdmin: true }));

      assert.deepStrictEqual(result.ok, true);
    });

    test("returns ok:false, reason:auth on 401/403, without showing any toast", async () => {
      let toastShown = false;
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
        window: { showErrorMessage: () => { toastShown = true; } },
      });
      const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });

      const result = await config.runTestConnection(context, vscode, async () => ({ statusCode: 401, headers: {}, text: "" }));

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, "auth");
      assert.strictEqual(toastShown, false);
    });

    test("returns ok:false, reason:permission when isSystemAdmin is false", async () => {
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
      });
      const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });

      const result = await config.runTestConnection(context, vscode, async () => jsonResponse(200, { isSystemAdmin: false }));

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, "permission");
    });

    test("returns ok:false, reason:network on a transport error, without throwing", async () => {
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
      });
      const context = createFakeContext({ [config.SECRET_PASSWORD]: "pw" });

      const result = await config.runTestConnection(context, vscode, async () => { throw new Error("ECONNREFUSED"); });

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, "network");
    });

    test("returns ok:false, reason:config when no password/token has been set yet", async () => {
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
      });
      const context = createFakeContext({});

      const result = await config.runTestConnection(context, vscode, async () => jsonResponse(200, {}));

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, "config");
    });
  });
});
