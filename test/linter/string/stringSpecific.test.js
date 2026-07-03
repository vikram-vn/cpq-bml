const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - String specific tests", () => {
  const vscode = require("vscode");

  suite("atoi() / atof() - require exactly 1 string argument", () => {
    test("atoi() - zero args → Error severity", () => {
      const diagnostics = lintText('x = atoi();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("atoi(\"123\") - correct 1 arg → no error", () => {
      const diagnostics = lintText('x = atoi("123");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("atoi(\"123\", \"extra\") - 2 args → Error severity", () => {
      const diagnostics = lintText('x = atoi("123", "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("atof() - zero args → Error severity", () => {
      const diagnostics = lintText('x = atof();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("atof(\"3.14\") - correct 1 arg → no error", () => {
      const diagnostics = lintText('x = atof("3.14");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("atoi(\"123.45\") - string representing a decimal → Error", () => {
      const diagnostics = lintText('x = atoi("123.45");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-atoi-decimal-string");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("atoi(\"\") - empty string → Error", () => {
      const diagnostics = lintText('x = atoi("");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-atoi-atof-empty-string");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("atof(\"\") - empty string → Error", () => {
      const diagnostics = lintText('x = atof("");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-atoi-atof-empty-string");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("atoi(x) - variable argument → no error", () => {
      const diagnostics = lintText('s = "123";\nx = atoi(s);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-atoi-atof-empty-string");
      assert.strictEqual(err, undefined);
    });

    test("atof(x) - variable argument → no error", () => {
      const diagnostics = lintText('s = "3.14";\nx = atof(s);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-atoi-atof-empty-string");
      assert.strictEqual(err, undefined);
    });
  });

  suite("substring() - requires 2 or 3 arguments (str, start[, end])", () => {
    test("substring() - zero args → Error severity", () => {
      const diagnostics = lintText('x = substring();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag substring with 0 args");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("substring(str) - 1 arg → Error severity", () => {
      const diagnostics = lintText('x = substring("hello");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag substring with 1 arg");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("substring(str, start) - 2 args → no error", () => {
      const diagnostics = lintText('x = substring("hello", 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined, "substring(str, start) is valid");
    });

    test("substring(str, start, end) - 3 args → no error", () => {
      const diagnostics = lintText('x = substring("hello", 1, 3);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined, "substring(str, start, end) is valid");
    });

    test("substring(str, start, end, extra) - 4 args → Error severity", () => {
      const diagnostics = lintText('x = substring("hello", 1, 3, "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err, "Should flag substring with 4 args");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("substring(str, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('x = substring("hello", );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("substring(str, start, end) with variables - valid", () => {
      const diagnostics = lintText('s = "hello";\na = 1;\nb = 3;\nx = substring(s, a, b);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("substring(str, start) with variables - valid", () => {
      const diagnostics = lintText('s = "hello";\na = 1;\nx = substring(s, a);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("substring(\"abc\", 1, 2) literal - valid", () => {
      const diagnostics = lintText('x = substring("abc", 1, 2);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("substring(\"abc\", 1) literal - valid", () => {
      const diagnostics = lintText('x = substring("abc", 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });

  suite("find() - requires 2 to 4 arguments (str, substr[, start[, end]])", () => {
    test("find() - zero args → Error severity", () => {
      const diagnostics = lintText('x = find();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("find(str) - 1 arg → Error severity", () => {
      const diagnostics = lintText('x = find("hello");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("find(str, sub) - 2 args → no error", () => {
      const diagnostics = lintText('x = find("hello", "ell");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("find(str, sub, start) - 3 args → no error", () => {
      const diagnostics = lintText('x = find("hello", "ell", 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("find(str, sub, start, end) - 4 args → no error", () => {
      const diagnostics = lintText('x = find("hello", "ell", 1, 5);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("find(str, sub, start, end, extra) - 5 args → Error severity", () => {
      const diagnostics = lintText('x = find("hello", "ell", 1, 5, "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("find(str, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('x = find("hello", );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("find(str, sub) with variables - valid", () => {
      const diagnostics = lintText('s = "hello";\nsub = "ell";\nx = find(s, sub);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("find(str, sub, start) with variables - valid", () => {
      const diagnostics = lintText('s = "hello";\nsub = "ell";\na = 1;\nx = find(s, sub, a);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("find(str, sub, start, end) with variables - valid", () => {
      const diagnostics = lintText('s = "hello";\nsub = "ell";\na = 1;\nb = 5;\nx = find(s, sub, a, b);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });

  suite("replace() - requires 3 or 4 arguments (str, old, new[, n])", () => {
    test("replace() - zero args → Error severity", () => {
      const diagnostics = lintText('x = replace();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("replace(str) - 1 arg → Error severity", () => {
      const diagnostics = lintText('x = replace("hello");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("replace(str, old) - 2 args → Error severity", () => {
      const diagnostics = lintText('x = replace("hello", "ell");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("replace(str, old, new) - 3 args → no error", () => {
      const diagnostics = lintText('x = replace("hello", "ell", "ELL");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("replace(str, old, new, n) - 4 args → no error", () => {
      const diagnostics = lintText('x = replace("hello", "l", "L", 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("replace(str, old, new, n, extra) - 5 args → Error severity", () => {
      const diagnostics = lintText('x = replace("hello", "l", "L", 1, "extra");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("replace(str, old, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('x = replace("hello", "ell", );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("replace(str, \"\", \"new\") - empty search string → Error", () => {
      const diagnostics = lintText('x = replace("hello", "", "ELL");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-replace-empty-search-string");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("replace(s, old, new) - variables - valid", () => {
      const diagnostics = lintText('s = "hello";\no = "ell";\nn = "ELL";\nx = replace(s, o, n);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("replace(s, old, new, n) - variables - valid", () => {
      const diagnostics = lintText('s = "hello";\no = "l";\nn = "L";\na = 1;\nx = replace(s, o, n, a);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });

  suite("Other String functions - len, lower, upper, startswith, endswith, join, split, string, trim", () => {
    test("len() / lower() / upper() / trim() - correct 1 argument → no error", () => {
      const diagnostics = lintText('s = "hello"; a = len(s); b = lower(s); c = upper(s); d = trim(s); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("len() - type mismatch (expected String) → Warning", () => {
      const diagnostics = lintText('x = len(123); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });

    test("startswith() / endswith() - correct 2 arguments → no error", () => {
      const diagnostics = lintText('x = startswith("hello", "he"); y = endswith("world", "ld"); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("join() - correct 2 arguments → no error", () => {
      const diagnostics = lintText('arr = string[]{"a", "b"}; x = join(arr, ","); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("join() - type mismatch for array (expected String[]) → Warning", () => {
      const diagnostics = lintText('x = join("not_an_array", ","); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });

    test("split() - correct 2 arguments → no error", () => {
      const diagnostics = lintText('x = split("a,b,c", ","); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("string() - correct 1 argument with Float/Integer/Boolean → no error", () => {
      const diagnostics1 = lintText('x = string(123); return "";');
      const diagnostics2 = lintText('x = string(true); return "";');
      assert.strictEqual(diagnostics1.find((d) => d.code === "bml-function-arg-count"), undefined);
      assert.strictEqual(diagnostics2.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("string(invalid) - too many arguments, string cast of string, or type mismatch", () => {
      const dCount = lintText('x = string(1, 2); return "";');
      const dCastString = lintText('x = string("hello"); return "";');
      const dType = lintText('x = string(getdate()); return "";');

      assert.ok(dCount.find((d) => d.code === "bml-function-arg-count"));
      assert.ok(dCastString.find((d) => d.code === "bml-string-cast-of-string"));
      assert.ok(dType.find((d) => d.code === "bml-function-arg-type"));
    });

    test("isnumber(invalid) - no arguments", () => {
      const diagnostics = lintText('x = isnumber(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-isnumber-no-args");
      assert.ok(err);
    });

    test("html() - type mismatch when integer is passed → Warning", () => {
      const diagnostics = lintText('x = html(123); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });
});
