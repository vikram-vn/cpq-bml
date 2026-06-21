const assert = require("assert");
const { request, buildPath } = require("../../app/lang/rest/client");

suite("BML REST client", () => {
  test("buildPath appends a query string only when query params are given", () => {
    assert.strictEqual(buildPath("/a/b", undefined), "/a/b");
    assert.strictEqual(buildPath("/a/b", {}), "/a/b");
    assert.strictEqual(
      buildPath("/a/b", { offset: 0, limit: 1000 }),
      "/a/b?offset=0&limit=1000",
    );
  });

  test("buildPath omits undefined/null query values and encodes the rest", () => {
    assert.strictEqual(
      buildPath("/a", { q: 'name eq "x y"', offset: undefined, limit: null }),
      "/a?q=name%20eq%20%22x%20y%22",
    );
  });

  test("request() passes hostname/port/path/method/headers/body to the transport", async () => {
    let captured;
    const fakeTransport = async (opts) => {
      captured = opts;
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: '{"ok":true}',
      };
    };

    const result = await request({
      baseUrl: "https://sitename.bigmachines.com:8443",
      path: "/rest/v18/bml/library/functions",
      method: "POST",
      query: { offset: 0 },
      body: { foo: "bar" },
      authHeader: "Basic abc123",
      transport: fakeTransport,
    });

    assert.strictEqual(captured.hostname, "sitename.bigmachines.com");
    assert.strictEqual(captured.port, "8443");
    assert.strictEqual(
      captured.path,
      "/rest/v18/bml/library/functions?offset=0",
    );
    assert.strictEqual(captured.method, "POST");
    assert.strictEqual(captured.headers.Authorization, "Basic abc123");
    assert.strictEqual(captured.headers["Content-Type"], "application/json");
    assert.strictEqual(captured.body, JSON.stringify({ foo: "bar" }));
    assert.deepStrictEqual(result, { statusCode: 200, body: { ok: true } });
  });

  test("request() defaults to port 443 when the site URL has none", async () => {
    let captured;
    const fakeTransport = async (opts) => {
      captured = opts;
      return { statusCode: 204, headers: {}, text: "" };
    };

    await request({
      baseUrl: "https://sitename.bigmachines.com",
      path: "/rest/v18/bml/library/functions/actions/validate",
      method: "POST",
      body: { scriptText: "x" },
      transport: fakeTransport,
    });

    assert.strictEqual(captured.port, 443);
  });

  test("request() returns an empty/raw body untouched for a 204 No Content response", async () => {
    const fakeTransport = async () => ({
      statusCode: 204,
      headers: {},
      text: "",
    });

    const result = await request({
      baseUrl: "https://sitename.bigmachines.com",
      path: "/rest/v18/bml/library/functions/actions/validate",
      method: "POST",
      transport: fakeTransport,
    });

    assert.deepStrictEqual(result, { statusCode: 204, body: "" });
  });

  test("request() leaves a non-JSON response body as raw text", async () => {
    const fakeTransport = async () => ({
      statusCode: 500,
      headers: { "content-type": "text/html" },
      text: "<html>Internal Server Error</html>",
    });

    const result = await request({
      baseUrl: "https://sitename.bigmachines.com",
      path: "/rest/v18/bml/library/functions",
      transport: fakeTransport,
    });

    assert.strictEqual(result.statusCode, 500);
    assert.strictEqual(result.body, "<html>Internal Server Error</html>");
  });

  test("request() throws a clear error when no baseUrl/siteUrl is configured", async () => {
    await assert.rejects(
      () =>
        request({
          baseUrl: "",
          path: "/rest/v18/bml/library/functions",
          transport: async () => ({}),
        }),
      /siteUrl is not configured/,
    );
  });

  test("request() omits the Authorization header when no authHeader is given", async () => {
    let captured;
    const fakeTransport = async (opts) => {
      captured = opts;
      return { statusCode: 200, headers: {}, text: "" };
    };

    await request({
      baseUrl: "https://sitename.bigmachines.com",
      path: "/rest/v18/bml/library/folders",
      transport: fakeTransport,
    });

    assert.strictEqual(captured.headers.Authorization, undefined);
  });

  test("request() writes request and response payloads to logFilePath when provided", async () => {
    const fs = require("fs");
    const os = require("os");
    const pathLib = require("path");
    const tmpDir = fs.mkdtempSync(pathLib.join(os.tmpdir(), "client-log-test-"));
    const logFilePath = pathLib.join(tmpDir, "bml_rest_api.log");

    const fakeTransport = async () => ({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      text: '{"ok":true}',
    });

    try {
      await request({
        baseUrl: "https://sitename.bigmachines.com",
        path: "/rest/v18/bml/library/functions",
        method: "POST",
        body: { query: "val" },
        logFilePath,
        transport: fakeTransport,
      });

      const logContents = fs.readFileSync(logFilePath, "utf8");
      assert.ok(logContents.includes("REQUEST:\n"));
      assert.ok(logContents.includes("RESPONSE:\n"));
      assert.ok(logContents.includes('"query": "val"'));
      assert.ok(logContents.includes('"statusCode": 200'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("request() redacts the Authorization header and any Set-Cookie before writing to logFilePath", async () => {
    const fs = require("fs");
    const os = require("os");
    const pathLib = require("path");
    const tmpDir = fs.mkdtempSync(pathLib.join(os.tmpdir(), "client-log-redact-test-"));
    const logFilePath = pathLib.join(tmpDir, "bml_rest_api.log");

    const fakeTransport = async () => ({
      statusCode: 200,
      headers: { "content-type": "application/json", "set-cookie": ["JSESSIONID=super-secret-session"] },
      text: "{}",
    });

    try {
      await request({
        baseUrl: "https://sitename.bigmachines.com",
        path: "/rest/v18/bml/library/functions",
        authHeader: "Basic YXBleGNwcTpBcGV4QDEyMw==",
        logFilePath,
        transport: fakeTransport,
      });

      const logContents = fs.readFileSync(logFilePath, "utf8");
      assert.ok(!logContents.includes("YXBleGNwcTpBcGV4QDEyMw=="), "must not leak the Authorization header value");
      assert.ok(!logContents.includes("super-secret-session"), "must not leak the Set-Cookie value");
      assert.ok(logContents.includes('"Authorization": "[REDACTED]"'));
      assert.ok(logContents.includes('"set-cookie": "[REDACTED]"'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
