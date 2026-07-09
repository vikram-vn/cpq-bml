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

  suite("Other Date functions - adddays, minusdays, getdate, etc.", () => {
    test("adddays(d, days) - correct 2 arguments → no error", () => {
      const diagnostics = lintText('d = getdate(); x = adddays(d, 5); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("adddays() - invalid argument count → Error", () => {
      const diagnostics = lintText('x = adddays(); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("adddays(d, days) - type mismatch (expected Integer) → Warning", () => {
      const diagnostics = lintText('d = getdate(); x = adddays(d, "not_an_int"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });

    test("getdate() - correct 0 or 1 argument → no error", () => {
      const diagnostics1 = lintText('x = getdate(); return "";');
      const diagnostics2 = lintText('x = getdate(true); return "";');
      assert.strictEqual(diagnostics1.find((d) => d.code === "bml-function-arg-count"), undefined);
      assert.strictEqual(diagnostics2.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("getdiffindays() - correct 2 arguments → no error", () => {
      const diagnostics = lintText('d1 = getdate(); d2 = getdate(); x = getdiffindays(d1, d2); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("isleap() - correct 1 argument → no error", () => {
      const diagnostics = lintText('x = isleap(2020); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("isleap() - type mismatch (expected Integer) → Warning", () => {
      const diagnostics = lintText('x = isleap("2020"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });

    test("comparedates() - correct 2 arguments → no error", () => {
      const diagnostics = lintText('d1 = getdate(); d2 = getdate(); x = comparedates(d1, d2); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("getcurrenttimeinmillis() - correct 0 arguments → no error", () => {
      const diagnostics = lintText('x = getcurrenttimeinmillis(); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("strtodate() - correct 2 or 3 arguments → no error", () => {
      const diagnostics = lintText('x = strtodate("2020-01-01", "yyyy-MM-dd"); return "";');
      assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("date() overloads - valid counts → no error", () => {
      const d1 = lintText('x = date(); return "";');
      const d2 = lintText('x = date(123456); return "";');
      const d3 = lintText('x = date("2020-01-01"); return "";');
      const d4 = lintText('x = date(2020, 1, 1); return "";');
      const d5 = lintText('x = date(2020, 1, 1, 12, 0, 0); return "";');

      assert.strictEqual(d1.find((d) => d.code === "bml-function-arg-count"), undefined);
      assert.strictEqual(d2.find((d) => d.code === "bml-function-arg-count"), undefined);
      assert.strictEqual(d3.find((d) => d.code === "bml-function-arg-count"), undefined);
      assert.strictEqual(d4.find((d) => d.code === "bml-function-arg-count"), undefined);
      assert.strictEqual(d5.find((d) => d.code === "bml-function-arg-count"), undefined);
    });

    test("date(2 args) - invalid count → Error", () => {
      const diagnostics = lintText('x = date(2020, 1); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.ok(err);
    });

    test("date(3 args with strings) - type mismatch → Warning", () => {
      const diagnostics = lintText('x = date("2020", "1", "1"); return "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
      assert.ok(err);
    });
  });
});
