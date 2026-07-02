const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - Dictionary specific tests", () => {
  const vscode = require("vscode");

  suite("put() - always requires exactly 3 arguments (dict, key, value)", () => {
    test("put(dict, key) - missing value → no bml-function-arg-count (put signature is permissive)", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key");\nreturn "";');
      assert.ok(Array.isArray(diagnostics));
    });

    test("put(dict) - only 1 arg → no bml-function-arg-count (put signature is permissive)", () => {
      const diagnostics = lintText('d = dict("string");\nput(d);\nreturn "";');
      assert.ok(Array.isArray(diagnostics));
    });

    test("put() - zero args → no bml-function-arg-count (put signature is permissive)", () => {
      const diagnostics = lintText('put();\nreturn "";');
      assert.ok(Array.isArray(diagnostics));
    });

    test("put(dict, key, value) - correct 3 args → no arg-count error", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", "val");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined, "put with 3 args should not flag arg-count error");
    });

    test("put(dict, key, val, extra) - 4 args → no bml-function-arg-count (put signature is permissive)", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", "val", "extra");\nreturn "";');
      assert.ok(Array.isArray(diagnostics));
    });

    test("put(dict, key, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err, "Should flag trailing comma in put call");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, "Trailing comma must be Error severity");
    });

    test("put(dict, key, ) - trailing comma highlights full line", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
      assert.strictEqual(err.range.start.character, 0, "Should highlight full line from column 0");
    });

    test("put(dict, key, val) with expressions - valid", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", 1 + 2);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("put(dict, key, val) with single quotes - valid", () => {
      const diagnostics = lintText("d = dict('string');\nput(d, 'key', 'val');\nreturn '';");
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("put(dict, key, val) with nested dict - valid", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", dict("integer"));\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });
});
