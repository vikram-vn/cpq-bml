const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const api = require("../../app/lang/rest/api");
const { createFakeVscode, createFakeContext } = require("./test-helpers");

const SECRET_PASSWORD = "cpqBml.connection.password";

function baseConfig(extra = {}) {
  return {
    "connection.siteUrl": "https://sitename.bigmachines.com",
    "connection.username": "alice",
    ...extra,
  };
}

function fakeContext() {
  return createFakeContext({ [SECRET_PASSWORD]: "secret" });
}

// Captures whatever client.js's request() hands to the transport, and returns
// a canned 200/JSON response so every api.js wrapper resolves cleanly.
function capturingTransport(sink) {
  return async (opts) => {
    sink.captured = opts;
    return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
  };
}

suite("BML REST api", () => {
  suite("functionsPath", () => {
    test("builds the plain util path using the configured REST version", () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      assert.strictEqual(
        api.functionsPath(vscode),
        "/rest/v18/bml/library/functions",
      );
    });

    test("respects a non-default configured REST version", () => {
      const vscode = createFakeVscode({ config: baseConfig({ "rest.restVersion": "v19" }) });
      assert.strictEqual(
        api.functionsPath(vscode),
        "/rest/v19/bml/library/functions",
      );
    });

    test("ignores commerceProcess alone - commerceDocument is what switches the path", () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      assert.strictEqual(
        api.functionsPath(vscode, { commerceProcess: "oraclecpqo" }),
        "/rest/v18/bml/library/functions",
      );
    });

    test("builds the commerce documents path when metadata.commerceDocument is set", () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      assert.strictEqual(
        api.functionsPath(vscode, { commerceProcess: "myProcess", commerceDocument: "transaction" }),
        "/rest/v18/commerceProcessSetups/myProcess/documents/transaction/bml/library/functions",
      );
    });

    test("falls back to the configured commerceProcess when metadata has none", () => {
      const vscode = createFakeVscode({
        config: baseConfig({ "rest.commerceProcess": "configuredProcess" }),
      });
      assert.strictEqual(
        api.functionsPath(vscode, { commerceDocument: "transaction" }),
        "/rest/v18/commerceProcessSetups/configuredProcess/documents/transaction/bml/library/functions",
      );
    });

    test("falls back to oraclecpqo when neither metadata nor settings name a commerceProcess", () => {
      const vscode = createFakeVscode({ config: baseConfig({ "rest.commerceProcess": "" }) });
      assert.strictEqual(
        api.functionsPath(vscode, { commerceDocument: "transaction" }),
        "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions",
      );
    });
  });

  test("listLibraryFunctions sends GET with offset/limit query params", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const result = await api.listLibraryFunctions(fakeContext(), vscode, { offset: 20, limit: 50 }, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "GET");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions?offset=20&limit=50");
    assert.strictEqual(sink.captured.body, undefined);
    assert.deepStrictEqual(result, { statusCode: 200, body: {} });
  });

  test("listLibraryFunctions defaults offset/limit and routes through the commerce path when given metadata", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    await api.listLibraryFunctions(fakeContext(), vscode, {}, capturingTransport(sink), {
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
    });

    assert.strictEqual(sink.captured.path, "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions?offset=0&limit=1000");
  });

  test("getLibraryFunction sends GET to the namespace.variableName resource", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    await api.getLibraryFunction(fakeContext(), vscode, "myFolder.concatString", capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "GET");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions/myFolder.concatString");
  });

  test("getLibraryFunction uses the commerce path when given metadata", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    await api.getLibraryFunction(fakeContext(), vscode, "currentStep", capturingTransport(sink), {
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
    });

    assert.strictEqual(
      sink.captured.path,
      "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/currentStep",
    );
  });

  test("updateLibraryFunction sends PATCH with the payload as the body, routed via the payload's own commerce fields", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const payload = { variableName: "concatString", scriptText: "return 1;" };
    await api.updateLibraryFunction(fakeContext(), vscode, "concatString", payload, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "PATCH");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions/concatString");
    assert.deepStrictEqual(JSON.parse(sink.captured.body), payload);
  });

  test("validateLibraryFunction sends POST to .../actions/validate with the payload as the body", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const payload = { variableName: "concatString", scriptText: "return 1;" };
    await api.validateLibraryFunction(fakeContext(), vscode, payload, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions/actions/validate");
    assert.deepStrictEqual(JSON.parse(sink.captured.body), payload);
  });

  test("deployLibraryFunctions sends POST to .../actions/deploy with { items }, routed via the separate metadata arg", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const items = [{ namespace: "", type: "util", variableName: "concatString" }];
    await api.deployLibraryFunctions(fakeContext(), vscode, items, capturingTransport(sink), {
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
    });

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(
      sink.captured.path,
      "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/actions/deploy",
    );
    assert.deepStrictEqual(JSON.parse(sink.captured.body), { items });
  });

  test("deployLibraryFunctions wraps items in { items } for util functions too (no commerce metadata)", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const items = [
      { namespace: "", type: "util", variableName: "test23" },
      { namespace: "", type: "util", variableName: "test234" },
    ];
    await api.deployLibraryFunctions(fakeContext(), vscode, items, capturingTransport(sink), {});

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions/actions/deploy");
    assert.deepStrictEqual(JSON.parse(sink.captured.body), { items });
  });

  test("deployCommerceProcess sends POST to .../deploymentCenter/actions with category DEPLOY_PROCESS and an ISO scheduledTime", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    await api.deployCommerceProcess(fakeContext(), vscode, "oraclecpqo", capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(
      sink.captured.path,
      "/rest/v18/commerceProcessSetups/oraclecpqo/deploymentCenter/actions",
    );
    const body = JSON.parse(sink.captured.body);
    assert.strictEqual(body.category, "DEPLOY_PROCESS");
    assert.strictEqual(body.sendEmail, false);
    assert.ok(!Number.isNaN(Date.parse(body.scheduledTime)), "scheduledTime parses as a valid date");
  });

  test("getTask sends GET to /rest/<version>/tasks/{taskId}", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    await api.getTask(fakeContext(), vscode, 555, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "GET");
    assert.strictEqual(sink.captured.path, "/rest/v18/tasks/555");
  });

  test("debugLibraryFunction sends POST to .../actions/debug with the payload as the body", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const payload = { variableName: "concatString", parameters: [{ name: "a", value: "1" }] };
    await api.debugLibraryFunction(fakeContext(), vscode, payload, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions/actions/debug");
    assert.deepStrictEqual(JSON.parse(sink.captured.body), payload);
  });

  test("loadTransactionData sends POST to .../actions/loadTransactionData with queryParams and routes via the payload's commerce fields", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const payload = { variableName: "currentStep", commerceProcess: "oraclecpqo", commerceDocument: "transaction", transactionId: 123 };
    await api.loadTransactionData(fakeContext(), vscode, payload, { contextParams: "language=en,currency=USD" }, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(
      sink.captured.path,
      "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/actions/loadTransactionData?contextParams=language%3Den%2Ccurrency%3DUSD",
    );
  });

  test("getDependentAttributes sends POST to .../actions/dependentAttributes with the payload as the body", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const payload = { libraryFunctions: [{ variableName: "x", type: "COMMERCE" }] };
    await api.getDependentAttributes(fakeContext(), vscode, payload, capturingTransport(sink));

    assert.strictEqual(sink.captured.method, "POST");
    assert.strictEqual(sink.captured.path, "/rest/v18/bml/library/functions/actions/dependentAttributes");
    assert.deepStrictEqual(JSON.parse(sink.captured.body), payload);
  });

  test("strips commerceProcess/commerceDocument out of the request body even though they drove the path", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    const payload = {
      variableName: "currentStep",
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
      scriptText: "return 1;",
    };
    await api.validateLibraryFunction(fakeContext(), vscode, payload, capturingTransport(sink));

    const sentBody = JSON.parse(sink.captured.body);
    assert.strictEqual(sentBody.commerceProcess, undefined);
    assert.strictEqual(sentBody.commerceDocument, undefined);
    assert.strictEqual(sentBody.scriptText, "return 1;");
    assert.strictEqual(
      sink.captured.path,
      "/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/actions/validate",
    );
  });

  test("attaches the auth header built from configured username + stored password", async () => {
    const sink = {};
    const vscode = createFakeVscode({ config: baseConfig() });
    await api.listLibraryFunctions(fakeContext(), vscode, {}, capturingTransport(sink));

    const expected = `Basic ${Buffer.from("alice:secret").toString("base64")}`;
    assert.strictEqual(sink.captured.headers.Authorization, expected);
  });

  suite("debug logging (cpqBml.debug.logRestDetails)", () => {
    let tmpDir;

    function withWorkspace(extraConfig) {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rest-api-test-"));
      const vscode = createFakeVscode({
        config: baseConfig(extraConfig),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
      });
      return vscode;
    }

    function cleanup() {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }

    test("writes bml_rest_api.log under the workspace root when debugLog is enabled", async () => {
      const vscode = withWorkspace({ "debug.logRestDetails": true });
      try {
        await api.validateLibraryFunction(fakeContext(), vscode, { variableName: "x" }, capturingTransport({}));
        const logPath = path.join(tmpDir, "bml_rest_api.log");
        assert.ok(fs.existsSync(logPath));
        assert.ok(fs.readFileSync(logPath, "utf8").includes("REQUEST:"));
      } finally {
        cleanup();
      }
    });

    test("writes no log file when debugLog is left at its default (false)", async () => {
      const vscode = withWorkspace({});
      try {
        await api.validateLibraryFunction(fakeContext(), vscode, { variableName: "x" }, capturingTransport({}));
        assert.ok(!fs.existsSync(path.join(tmpDir, "bml_rest_api.log")));
      } finally {
        cleanup();
      }
    });

    test("writes no log file when debugLog is enabled but no workspace folder is open", async () => {
      const vscode = createFakeVscode({ config: baseConfig({ "debug.logRestDetails": true }) });
      // No workspaceFolders at all - should not throw despite debugLog being on.
      await assert.doesNotReject(() =>
        api.validateLibraryFunction(fakeContext(), vscode, { variableName: "x" }, capturingTransport({})),
      );
    });
  });
});
