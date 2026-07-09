const assert = require("assert");
const { getNonce, buildCsp } = require("../../app/lang/settings-panel/html");

suite("settings-panel html", () => {
  test("getNonce returns a non-empty string and is different on each call", () => {
    const a = getNonce();
    const b = getNonce();
    assert.ok(typeof a === "string" && a.length > 0);
    assert.notStrictEqual(a, b);
  });

  test("buildCsp produces a strict, nonce-scoped policy with no inline/remote/eval sources", () => {
    const csp = buildCsp("abc123", "vscode-webview://abc");
    assert.ok(csp.includes("default-src 'none'"));
    assert.ok(csp.includes("script-src 'nonce-abc123'"));
    assert.ok(!csp.includes("unsafe-inline"));
    assert.ok(!csp.includes("unsafe-eval"));
    assert.ok(!csp.includes("http:"));
    assert.ok(!csp.includes("https:"));
  });
});
