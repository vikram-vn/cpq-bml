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

    suite("jsonget() 3-arg numeric valueType without a defaultValue (bml-json-get-throws-without-default)", () => {
        test("jsonget(obj, key, 'integer') - flags missing defaultValue for a numeric valueType", () => {
            const diagnostics = lintText(`x = jsonget(obj, "key", "integer"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-json-get-throws-without-default');
            assert.ok(diag, 'Json.md: throws if the key is missing AND valueType is Integer/Float/Boolean AND no defaultValue is given');
        });

        test("jsonget(obj, key, 'float') - flags missing defaultValue", () => {
            const diagnostics = lintText(`x = jsonget(obj, "key", "float"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-json-get-throws-without-default');
            assert.ok(diag);
        });

        test("jsonget(obj, key, 'boolean') - flags missing defaultValue", () => {
            const diagnostics = lintText(`x = jsonget(obj, "key", "boolean"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-json-get-throws-without-default');
            assert.ok(diag);
        });

        test("jsonget(obj, key, 'integer', 0) - does not flag when a defaultValue is provided", () => {
            const diagnostics = lintText(`x = jsonget(obj, "key", "integer", 0); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-json-get-throws-without-default');
            assert.strictEqual(diag, undefined);
        });

        test("jsonget(obj, key, 'string') - does not flag String valueType (returns null safely)", () => {
            const diagnostics = lintText(`x = jsonget(obj, "key", "string"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-json-get-throws-without-default');
            assert.strictEqual(diag, undefined);
        });

        test("jsonget(obj, key) - does not flag the 2-arg form", () => {
            const diagnostics = lintText(`x = jsonget(obj, "key"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-json-get-throws-without-default');
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

    suite("Other JSON functions - json, jsonkeys, jsonpathset, etc.", () => {
        test("json() / jsonarray() - correct 0 or 1 argument → no error", () => {
            const diagnostics1 = lintText('x = json(); y = jsonarray(); return "";');
            const diagnostics2 = lintText('x = json("{}"); y = jsonarray("[]"); return "";');
            assert.strictEqual(diagnostics1.find((d) => d.code === "bml-function-arg-count"), undefined);
            assert.strictEqual(diagnostics2.find((d) => d.code === "bml-function-arg-count"), undefined);
        });

        test("json(invalid) - too many arguments or type mismatch", () => {
            const dCount = lintText('x = json("a", "b"); return "";');
            const dType = lintText('x = json(123); return "";');
            assert.ok(dCount.find((d) => d.code === "bml-function-arg-count"));
            assert.ok(dType.find((d) => d.code === "bml-function-arg-type"));
        });

        test("jsonarray(invalid) - too many arguments or type mismatch", () => {
            const dCount = lintText('x = jsonarray("a", "b"); return "";');
            const dType = lintText('x = jsonarray(123); return "";');
            assert.ok(dCount.find((d) => d.code === "bml-function-arg-count"));
            assert.ok(dType.find((d) => d.code === "bml-function-arg-type"));
        });

        test("jsonnull(invalid) - arguments passed", () => {
            const diagnostics = lintText('x = jsonnull(1); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.ok(err);
        });

        test("jsonkeys(obj) - correct 1 or 2 arguments → no error", () => {
            const diagnostics1 = lintText('obj = json(); x = jsonkeys(obj); return "";');
            const diagnostics2 = lintText('obj = json(); x = jsonkeys(obj, true); return "";');
            assert.strictEqual(diagnostics1.find((d) => d.code === "bml-function-arg-count"), undefined);
            assert.strictEqual(diagnostics2.find((d) => d.code === "bml-function-arg-count"), undefined);
        });

        test("jsonkeys(obj) - type mismatch for 1st arg (expected Json) → Warning", () => {
            const diagnostics = lintText('x = jsonkeys("not_json"); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
            assert.ok(err);
        });

        test("jsonpathgetsingle(obj, path) - correct 2 to 4 arguments → no error", () => {
            const diagnostics = lintText('obj = json(); x = jsonpathgetsingle(obj, "$.path", "string", "def"); return "";');
            assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
        });

        test("jsonpathset(obj, path, val) - correct 3 arguments → no error", () => {
            const diagnostics = lintText('obj = json(); x = jsonpathset(obj, "$.path", "val"); return "";');
            assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
        });

        test("jsonpathcheck(obj, path) - correct 2 arguments → no error", () => {
            const diagnostics = lintText('obj = json(); x = jsonpathcheck(obj, "$.path"); return "";');
            assert.strictEqual(diagnostics.find((d) => d.code === "bml-function-arg-count"), undefined);
        });
    });
});
