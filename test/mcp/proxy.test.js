const assert = require("assert");
const { createCapturingTerminal } = require("@/lang/mcp/proxy");

suite("MCP proxy - createCapturingTerminal", () => {
  test("forwards lines to the real terminal prefixed with [MCP]", () => {
    const realLines = [];
    const { terminal } = createCapturingTerminal({
      writeLine: (l) => realLines.push(l),
      show: () => {},
      clear: () => {},
    });

    terminal.writeLine("Pulled concatString");

    assert.deepStrictEqual(realLines, ["[MCP] Pulled concatString"]);
  });

  test("does not prefix the lines captured for the tool's own result", () => {
    const { terminal, getLines } = createCapturingTerminal({ writeLine: () => {} });

    terminal.writeLine("Pulled concatString");

    assert.deepStrictEqual(getLines(), ["Pulled concatString"]);
  });

  test("is a no-op on the real terminal when none is provided", () => {
    const { terminal, getLines } = createCapturingTerminal(undefined);
    assert.doesNotThrow(() => terminal.writeLine("no real terminal"));
    assert.deepStrictEqual(getLines(), ["no real terminal"]);
  });

  test("still strips ANSI codes from captured lines", () => {
    const { terminal, getLines } = createCapturingTerminal(undefined);
    terminal.writeLine("\x1b[32mok\x1b[0m");
    assert.deepStrictEqual(getLines(), ["ok"]);
  });

  test("scrubs instance URLs from captured lines returned to MCP", () => {
    const { terminal, getLines } = createCapturingTerminal(undefined);
    terminal.writeLine("Connecting to https://myinstance.bigmachines.com/rest/v18/currentUser");
    terminal.writeLine("Calling https://prod.oracle.com/rest/v19/commerce");
    assert.deepStrictEqual(getLines(), [
      "Connecting to [INSTANCE_URL]/rest/v18/currentUser",
      "Calling [INSTANCE_URL]/rest/v19/commerce",
    ]);
  });
});

const { jsonResult, scrubForMcp } = require("@/lang/mcp/jsonResult");

suite("MCP jsonResult - privacy sanitization", () => {
  test("scrubs instance URLs, hypermedia links, and credentials from MCP tool output", () => {
    const payload = {
      success: true,
      site: "https://myinstance.bigmachines.com",
      links: [{ rel: "self", href: "https://myinstance.bigmachines.com/rest" }],
      href: "https://myinstance.bigmachines.com/rest",
      password: "secretPassword",
      token: "secretToken",
      authHeader: "Bearer secret",
      cookie: "session=123",
      items: [
        {
          id: 1,
          endpoint: "https://myinstance.oracle.com/rest/v19/bml",
          links: [{ rel: "self", href: "https://myinstance.oracle.com" }],
          token: "bad",
        },
      ],
    };

    const clean = scrubForMcp(payload);
    assert.strictEqual(clean.site, "[INSTANCE_URL]");
    assert.strictEqual(clean.links, undefined);
    assert.strictEqual(clean.href, undefined);
    assert.strictEqual(clean.password, undefined);
    assert.strictEqual(clean.token, undefined);
    assert.strictEqual(clean.authHeader, undefined);
    assert.strictEqual(clean.cookie, undefined);
    assert.strictEqual(clean.items[0].links, undefined);
    assert.strictEqual(clean.items[0].token, undefined);
    assert.strictEqual(clean.items[0].endpoint, "[INSTANCE_URL]/rest/v19/bml");

    const result = jsonResult(payload);
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.site, "[INSTANCE_URL]");
    assert.strictEqual(content.password, undefined);
  });
});

