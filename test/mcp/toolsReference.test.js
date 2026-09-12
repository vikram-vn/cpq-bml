const assert = require("assert");
const tools = require("@/lang/mcp/tools");
const { createFakeVscode } = require("@/test/rest/testHelpers");
const { makeContext } = require("@/test/rest/commands/fixtures");

suite("MCP tools - lookupBmlReference", () => {
  test("requires at least one of name/category/scope", async () => {
    const result = await tools.lookupBmlReference(makeContext(), createFakeVscode({}), {});
    assert.strictEqual(result.success, false);
  });

  test("rejects an unknown category", async () => {
    const result = await tools.lookupBmlReference(makeContext(), createFakeVscode({}), { category: "bogus" });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes("bogus"));
  });

  test("finds a known built-in function by exact name, case-insensitively", async () => {
    const result = await tools.lookupBmlReference(makeContext(), createFakeVscode({}), { name: "ATOF" });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.results[0].name, "atof");
    assert.strictEqual(result.results[0].category, "function");
    assert.strictEqual(result.results[0].returnType, "Float");
  });

  test("browses a category without a name and respects limit", async () => {
    const result = await tools.lookupBmlReference(makeContext(), createFakeVscode({}), { category: "function", limit: 5 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results.length, 5);
    assert.ok(result.results.every((r) => r.category === "function"));
    assert.strictEqual(result.truncated, true);
  });

  test("filters attributes by scope", async () => {
    const result = await tools.lookupBmlReference(makeContext(), createFakeVscode({}), {
      category: "attribute",
      scope: "Transaction",
      limit: 100,
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.results.length > 0);
    assert.ok(result.results.every((r) => r.scope === "Transaction"));
  });

  test("returns an empty result set for a name that doesn't exist", async () => {
    const result = await tools.lookupBmlReference(makeContext(), createFakeVscode({}), { name: "notARealFunctionName" });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.results, []);
  });

  test("finds workspace Configuration attribute and includes productFamily", async () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-mcp-ref-"));
    try {
      const cpqDir = path.join(tmpDir, "cpq", "config", "monitors");
      fs.mkdirSync(cpqDir, { recursive: true });
      fs.writeFileSync(
        path.join(cpqDir, "attributes.min.json"),
        JSON.stringify([{ variableName: "screen_size", name: "Screen Size", dataType: "FLOAT", productFamily: "monitors" }]),
        "utf8"
      );

      const fakeVscode = createFakeVscode({
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
      });
      const result = await tools.lookupBmlReference(makeContext(), fakeVscode, {
        name: "screen_size",
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.results[0].name, "screen_size");
      assert.strictEqual(result.results[0].scope, "Configuration");
      assert.strictEqual(result.results[0].productFamily, "monitors");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
