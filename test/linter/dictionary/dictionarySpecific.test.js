const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - Dictionary specific tests", () => {
  const vscode = require("vscode");

  suite("put() - always requires exactly 3 arguments (dict, key, value)", () => {
    test("put() - zero args → flags bml-function-arg-count error", () => {
      const diagnostics = lintText('put();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "put with 0 args should flag bml-function-arg-count");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("put(dict) - only 1 arg → flags bml-function-arg-count error", () => {
      const diagnostics = lintText('d = dict("string");\nput(d);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "put with 1 arg should flag bml-function-arg-count");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("put(dict, key) - 2 args missing value → flags bml-function-arg-count error", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "put with 2 args should flag bml-function-arg-count");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("put(dict, key, value) - correct 3 args with String key → no arg-count error", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", "val");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined, "put with 3 args should not flag arg-count error");
    });

    test("put(dict, key, value) - correct 3 args with Integer key → valid", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, 123, "val");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
      const typeErr = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.strictEqual(typeErr, undefined);
    });

    test("put(dict, key, value) - correct 3 args with Float key → valid", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, 12.34, "val");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
      const typeErr = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.strictEqual(typeErr, undefined);
    });

    test("put(dict, key, val, extra) - 4 args → flags bml-function-arg-count error", () => {
      const diagnostics = lintText('d = dict("string");\nput(d, "key", "val", "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "put with 4 args should flag bml-function-arg-count");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
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

  suite("Other Dictionary functions - dict, containskey, get, keys, values", () => {
    test("dict(type) - correct 1 argument → no error", () => {
      const diagnostics = lintText('x = dict("string"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("dict() - missing argument → bml-dict-missing-type", () => {
      const diagnostics = lintText('x = dict(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-dict-missing-type");
      assert.ok(err);
    });

    test("dict(type) - invalid type argument → bml-dict-invalid-type", () => {
      const diagnostics = lintText('x = dict("invalid_type"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-dict-invalid-type");
      assert.ok(err);
    });

    test("dict(type) - dict<anytype>, dict<string>, bytearray, json, and jsonarray are valid type arguments → no error", () => {
      const diagnostics = lintText('x = dict("dict<anytype>"); y = dict("dict<string>"); z = dict("bytearray"); a = dict("json"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-dict-invalid-type");
      assert.strictEqual(err, undefined);
    });

    test("containskey(dict, key) - correct 2 arguments → no error", () => {
      const diagnostics = lintText('d = dict("string"); x = containskey(d, "key"); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("containskey(dict, key) - type mismatch for dict (expected Dictionary) → Warning", () => {
      const diagnostics = lintText('x = containskey("not_a_dict", "key"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });

    test("get(dict, key) - correct 2 arguments → no error", () => {
      const diagnostics = lintText('d = dict("string"); x = get(d, "key"); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("get(dict, key, type) - correct 3 arguments → no error", () => {
      const diagnostics = lintText('d = dict("string"); x = get(d, "key", "string"); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("keys(dict) / values(dict) - correct 1 argument → no error", () => {
      const diagnostics = lintText('d = dict("string"); k = keys(d); v = values(d); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });
  });
});
