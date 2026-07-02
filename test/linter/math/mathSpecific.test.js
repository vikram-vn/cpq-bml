const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - Math specific tests", () => {
    const vscode = require("vscode");

    suite("Math functions domain boundary constraints (acos/asin)", () => {
        test("1. acos(1.5) - value > 1.0 flags domain warning", () => {
            const diagnostics = lintText(`x = acos(1.5); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-math-domain-error');
            assert.ok(diag);
            assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
        });

        test("2. asin(-2.0) - value < -1.0 flags domain warning", () => {
            const diagnostics = lintText(`x = asin(-2.0); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-math-domain-error');
            assert.ok(diag);
        });

        test("3. acos(-1.01) - boundary value slightly under -1.0 flags warning", () => {
            const diagnostics = lintText(`x = acos(-1.01); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-math-domain-error');
            assert.ok(diag);
        });

        test("4. acos(-1.0) - boundary value exactly -1.0 is valid", () => {
            const diagnostics = lintText(`x = acos(-1.0); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-math-domain-error');
            assert.strictEqual(diag, undefined);
        });

        test("5. asin(1.0) - boundary value exactly 1.0 is valid", () => {
            const diagnostics = lintText(`x = asin(1.0); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-math-domain-error');
            assert.strictEqual(diag, undefined);
        });
    });

    suite("Math functions argument counts and types (negative tests)", () => {
        test("6. fabs() and fabs(1, 2) - incorrect argument count", () => {
            const diagnostics1 = lintText(`x = fabs(); return "";`);
            const diagnostics2 = lintText(`x = fabs(1.5, 2.5); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("7. sqrt() and sqrt(1, 2) - incorrect argument count", () => {
            const diagnostics1 = lintText(`x = sqrt(); return "";`);
            const diagnostics2 = lintText(`x = sqrt(4.0, 9.0); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("8. pow(2.0) and pow(2.0, 3.0, 4.0) - incorrect argument count", () => {
            const diagnostics1 = lintText(`x = pow(2.0); return "";`);
            const diagnostics2 = lintText(`x = pow(2.0, 3.0, 4.0); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("9. hypot(2.0) and hypot(2.0, 3.0, 4.0) - incorrect argument count", () => {
            const diagnostics1 = lintText(`x = hypot(2.0); return "";`);
            const diagnostics2 = lintText(`x = hypot(2.0, 3.0, 4.0); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("10. round() and round(1.0, 2.0) - incorrect argument count", () => {
            const diagnostics1 = lintText(`x = round(1.5); return "";`);
            const diagnostics2 = lintText(`x = round(1.5, 2.5, 3.5); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("11. passing string literals to float math functions flags type errors", () => {
            const diagnostics = lintText(`x = sqrt("4.0"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
            assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
        });

        test("12. passing string literals to pow() flags type errors on operands", () => {
            const diagnostics1 = lintText(`x = pow("2.0", 3.0); return "";`);
            const diagnostics2 = lintText(`x = pow(2.0, "3.0"); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-type'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-type'));
        });
    });
});
