const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - JSON specific tests", () => {
    const vscode = require("vscode");

    suite("jsonput() literal value constraints & warnings", () => {
        test("1. jsonput(obj, k, 'null') - Flags the literal string 'null' as value", () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "null");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.ok(diag);
            assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
        });

        test("2. jsonput(obj, k, '{foo}') - Flags value wrapped in curly braces", () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "{foo}");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.ok(diag);
        });

        test("3. jsonput(obj, k, '[foo]') - Flags value wrapped in square brackets", () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "[foo]");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.ok(diag);
        });

        test("4. jsonput(obj, k, 'hello') - Does not flag a normal string value", () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "hello world");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.strictEqual(diag, undefined);
        });

        test("5. jsonput(obj, k, var) - Does not flag a variable value", () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", someVar);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.strictEqual(diag, undefined);
        });
    });

    suite("JSON functions argument counts and types (negative tests)", () => {
        test("6. jsonget() - Invalid 0 args & 1 arg", () => {
            const diagnostics1 = lintText(`x = jsonget(); return "";`);
            const diagnostics2 = lintText(`x = jsonget(obj); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("7. jsonarrayappend() - Invalid 0 args & 1 arg", () => {
            const diagnostics1 = lintText(`jsonarrayappend(); return "";`);
            const diagnostics2 = lintText(`jsonarrayappend(arr); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("8. jsonarraysize() - Invalid 0 args & 2 args", () => {
            const diagnostics1 = lintText(`x = jsonarraysize(); return "";`);
            const diagnostics2 = lintText(`x = jsonarraysize(arr, extra); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("9. jsonremove() - Invalid 0 args & 3 args", () => {
            const diagnostics1 = lintText(`jsonremove(); return "";`);
            const diagnostics2 = lintText(`jsonremove(obj, "key", "extra"); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("10. jsonarrayget() - Invalid 0 args & 4 args", () => {
            const diagnostics1 = lintText(`x = jsonarrayget(); return "";`);
            const diagnostics2 = lintText(`x = jsonarrayget(arr, 0, "string", "extra"); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-count'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-count'));
        });

        test("11. passing non-json/jsonarray types to copy functions flags type warnings", () => {
            const diagnostics1 = lintText(`x = jsoncopy("string"); return "";`);
            const diagnostics2 = lintText(`x = jsonarraycopy("string"); return "";`);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-type'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-type'));
        });
    });
});
