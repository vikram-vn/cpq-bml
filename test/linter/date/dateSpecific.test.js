const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - Date specific tests", () => {
  const vscode = require("vscode");

  suite("datetostr() - requires 1 to 3 arguments (date[, format[, tz]])", () => {
    test("datetostr() - zero args → Error severity", () => {
      const diagnostics = lintText('x = datetostr();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("datetostr(d) - 1 arg → no error", () => {
      const diagnostics = lintText('d = getdate();\nx = datetostr(d);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("datetostr(d, fmt) - 2 args → no error", () => {
      const diagnostics = lintText('d = getdate();\nx = datetostr(d, "MM/dd/yyyy");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("datetostr(d, fmt, tz) - 3 args → no error", () => {
      const diagnostics = lintText('d = getdate();\nx = datetostr(d, "MM/dd/yyyy", "UTC");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("datetostr(d, fmt, tz, extra) - 4 args → Error severity", () => {
      const diagnostics = lintText('d = getdate();\nx = datetostr(d, "MM/dd/yyyy", "UTC", "x");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("datetostr(d, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('d = getdate();\nx = datetostr(d, );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("dateToStr(d, fmt) - case insensitivity - valid", () => {
      const diagnostics = lintText('d = getdate();\nx = dateToStr(d, "MM/dd/yyyy");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unknown-function");
      assert.strictEqual(err, undefined);
    });

    test("datetostr(d, fmt, tz) with variables - valid", () => {
      const diagnostics = lintText('d = getdate();\nf = "MM/dd/yyyy";\nt = "UTC";\nx = datetostr(d, f, t);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test('datetostr(getdate(), "yyyy-MM-dd") - valid', () => {
      const diagnostics = lintText('x = datetostr(getdate(), "yyyy-MM-dd");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("datetostr(getdate()) - valid", () => {
      const diagnostics = lintText('x = datetostr(getdate());\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });
  });
});
