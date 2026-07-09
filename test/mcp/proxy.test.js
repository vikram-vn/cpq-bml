const assert = require("assert");
const { createCapturingTerminal } = require("../../app/lang/mcp/proxy");

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
});
