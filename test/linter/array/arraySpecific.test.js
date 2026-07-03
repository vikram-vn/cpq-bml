const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - Array specific tests", () => {
  const vscode = require("vscode");

  suite("findinarray() - always requires exactly 2 arguments (array, element)", () => {
    test("findinarray(arr) - missing element → Error severity", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag findinarray with 1 arg as error");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, "Must be Error not Warning");
    });

    test("findinarray() - zero args → Error severity", () => {
      const diagnostics = lintText('x = findinarray();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag findinarray with 0 args as error");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, "Must be Error not Warning");
    });

    test("findinarray(arr, elem) - correct 2 args → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, "a");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined, "findinarray with 2 args should not flag arg-count error");
    });

    test("findinarray(arr, elem, extra) - 3 args → Error severity", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, "a", "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag findinarray with 3 args as error");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, "Must be Error not Warning");
    });

    test("findinarray(arr, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err, "Should flag trailing comma in findinarray");
    });

    test("findinarray(arr, elem) with float array - valid", () => {
      const diagnostics = lintText('arr = float[]{0.5};\nx = findinarray(arr, 0.5);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("findinarray(arr, elem) with integer array - valid", () => {
      const diagnostics = lintText('arr = integer[]{1};\nx = findinarray(arr, 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("findinarray(arr, elem) with expressions - valid", () => {
      const diagnostics = lintText('arr = integer[]{1};\nx = findinarray(arr, 1 + 0);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("findinarray(arr, elem) with null element - valid", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, null);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("findinarray(arr, elem) case insensitivity - valid", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = findInArray(arr, "a");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unknown-function");
      assert.strictEqual(err, undefined);
    });
  });

  suite("append() - requires at least 2 arguments (array, element)", () => {
    test("append(arr) - missing element → Error severity", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nappend(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag append with 1 arg");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("append() - zero args → Error severity", () => {
      const diagnostics = lintText('append();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag append with 0 args");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("append(arr, elem) - correct 2 args → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nappend(arr, "b");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("append(arr, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nappend(arr, );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("append(arr, elem) float array - valid", () => {
      const diagnostics = lintText('arr = float[]{0.5};\nappend(arr, 0.6);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("append(arr, elem) int array - valid", () => {
      const diagnostics = lintText('arr = integer[]{1};\nappend(arr, 2);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("append(arr, elem) boolean array - valid", () => {
      const diagnostics = lintText('arr = boolean[]{true};\nappend(arr, false);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("append(arr, elem) date array - valid", () => {
      const diagnostics = lintText('arr = date[]{getdate()};\nappend(arr, getdate());\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("append(arr, elem) double array - valid", () => {
      const diagnostics = lintText('arr = float[][]{float[]{0.5}};\nappend(arr, float[]{0.6});\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("append(arr, elem) with expressions - valid", () => {
      const diagnostics = lintText('arr = integer[]{1};\nappend(arr, 2 + 3);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });

  suite("sizeofarray() - requires exactly 1 argument (array)", () => {
    test("sizeofarray() - zero args → Error severity", () => {
      const diagnostics = lintText('x = sizeofarray();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag sizeofarray with 0 args");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("sizeofarray(arr) - correct 1 arg → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sizeofarray(arr, extra) - 2 args → Error severity", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr, "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("sizeofarray(arr, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr, );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("sizeofarray(arr) float array - valid", () => {
      const diagnostics = lintText('arr = float[]{0.5};\nx = sizeofarray(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sizeofarray(arr) int array - valid", () => {
      const diagnostics = lintText('arr = integer[]{1};\nx = sizeofarray(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sizeofarray(arr) boolean array - valid", () => {
      const diagnostics = lintText('arr = boolean[]{true};\nx = sizeofarray(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sizeofarray(arr) date array - valid", () => {
      const diagnostics = lintText('arr = date[]{getdate()};\nx = sizeofarray(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sizeofarray(arr) with complex expression - valid", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr) + 1;\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sizeofarray(arr) with inline declaration - valid", () => {
      const diagnostics = lintText('x = sizeofarray(string[]{"a", "b"});\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });

  suite("remove() - requires exactly 2 arguments (array, index)", () => {
    test("remove() - zero args → Error severity", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nremove(arr);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("remove(arr, 0) - correct 2 args → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nremove(arr, 0);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("remove(arr, 0, extra) - 3 args → Error severity", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nremove(arr, 0, "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("remove(arr, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nremove(arr, );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("remove(floatArr, 0) - float → no error", () => {
      const diagnostics = lintText('arr = float[]{0.5};\nremove(arr, 0);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("remove(intArr, 0) - int → no error", () => {
      const diagnostics = lintText('arr = integer[]{1};\nremove(arr, 0);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("remove(boolArr, 0) - bool → no error", () => {
      const diagnostics = lintText('arr = boolean[]{true};\nremove(arr, 0);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("remove(dateArr, 0) - date → no error", () => {
      const diagnostics = lintText('arr = date[]{getdate()};\nremove(arr, 0);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("remove(arr, idx) - variable → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nidx = 0;\nremove(arr, idx);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("remove(arr, idx + 1) - expression → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"};\nidx = 0;\nremove(arr, idx + 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });

  suite("isempty() - requires exactly 1 argument (array)", () => {
    test("isempty() - zero args → Error", () => {
      const diagnostics = lintText('x = isempty(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("isempty(arr) - correct 1 arg → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = isempty(arr); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("isempty(arr, extra) - 2 args → Error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = isempty(arr, "extra"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("isempty(not_an_array) - type mismatch → Warning", () => {
      const diagnostics = lintText('x = isempty("string"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });

  suite("max() / min() - require exactly 1 array argument", () => {
    test("max() - zero args → Error", () => {
      const diagnostics = lintText('x = max(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("max(arr) - correct 1 arg → no error", () => {
      const diagnostics = lintText('arr = integer[]{1, 2}; x = max(arr); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("max(not_an_array) - type mismatch → Warning", () => {
      const diagnostics = lintText('x = max("string"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });

  suite("range() - requires exactly 1 Integer argument", () => {
    test("range() - zero args → Error", () => {
      const diagnostics = lintText('x = range(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("range(5) - correct 1 arg → no error", () => {
      const diagnostics = lintText('x = range(5); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("range('abc') - type mismatch → Warning", () => {
      const diagnostics = lintText('x = range("abc"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });

  suite("reverse() - requires exactly 1 array argument", () => {
    test("reverse() - zero args → Error", () => {
      const diagnostics = lintText('x = reverse(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("reverse(arr) - correct 1 arg → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = reverse(arr); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("reverse('abc') - type mismatch → Warning", () => {
      const diagnostics = lintText('x = reverse("abc"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });

  suite("sort() - requires 1 to 3 arguments (array[, order[, type]])", () => {
    test("sort() - zero args → Error", () => {
      const diagnostics = lintText('x = sort(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("sort(arr) - 1 arg → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = sort(arr); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sort(arr, 'asc') - 2 args → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = sort(arr, "asc"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sort(arr, 'asc', 'string') - 3 args → no error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = sort(arr, "asc", "string"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sort(arr, 'asc', 'string', extra) - 4 args → Error", () => {
      const diagnostics = lintText('arr = string[]{"a"}; x = sort(arr, "asc", "string", "extra"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });
  });

  suite("bytearray() - requires 1 or 2 arguments (content[, charset])", () => {
    test("bytearray(content) - 1 arg → no error", () => {
      const diagnostics = lintText('x = bytearray("content"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("bytearray(content, charset) - 2 args → no error", () => {
      const diagnostics = lintText('x = bytearray("content", "UTF-8"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("bytearray() - 0 args → Error", () => {
      const diagnostics = lintText('x = bytearray(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("bytearray(c, cs, extra) - 3 args → Error", () => {
      const diagnostics = lintText('x = bytearray("c", "cs", "extra"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("bytearray(123) - type mismatch → Warning", () => {
      const diagnostics = lintText('x = bytearray(123); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });
});
