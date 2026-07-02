const assert = require("assert");
const { lintText } = require("../fixtures");
const { runDynamicTestsForCategory } = require("../dynamicHelper");

runDynamicTestsForCategory("xml", "XML Functions Dynamic Validation");

suite("BML Linter Test Suite - XML specific tests", () => {
    const vscode = require("vscode");

    suite("applytemplate() parameter validation", () => {
        test("1. applytemplate() - missing all arguments → Error", () => {
            const diagnostics = lintText(`
                val = applytemplate();
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("2. applytemplate('path') - valid 1 argument → no error", () => {
            const diagnostics = lintText(`
                val = applytemplate("path/to/template.txt");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("3. applytemplate('path', payload) - valid 2 arguments → no error", () => {
            const diagnostics = lintText(`
                payload = dict("string");
                val = applytemplate("path", payload);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("4. applytemplate('path', payload, 'err', jsonVal, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                payload = dict("string");
                j = json("{}");
                val = applytemplate("path", payload, "err", j, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("5. applytemplate(123) - first parameter type mismatch (expected String) → Warning", () => {
            const diagnostics = lintText(`
                val = applytemplate(123);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });
    });

    suite("transformxml() parameter validation", () => {
        test("6. transformxml() - missing all arguments → Error", () => {
            const diagnostics = lintText(`
                val = transformxml();
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("7. transformxml('xml') - missing second argument → Error", () => {
            const diagnostics = lintText(`
                val = transformxml("<root/>");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("8. transformxml('xml', 'xsl') - valid 2 arguments → no error", () => {
            const diagnostics = lintText(`
                val = transformxml("<root/>", "xsl/test.xsl");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("9. transformxml('xml', 'xsl', 'err', extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                val = transformxml("<root/>", "xsl/test.xsl", "error", "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("readxmlsingle() parameter validation", () => {
        test("10. readxmlsingle() - missing all arguments → Error", () => {
            const diagnostics = lintText(`
                val = readxmlsingle();
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("11. readxmlsingle('xml') - missing second argument → Error", () => {
            const diagnostics = lintText(`
                val = readxmlsingle("<root/>");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("12. readxmlsingle('xml', xpaths) - valid 2 arguments → no error", () => {
            const diagnostics = lintText(`
                paths = string[1];
                paths[0] = "/root/node";
                val = readxmlsingle("<root/>", paths);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("13. readxmlsingle('xml', xpaths, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                paths = string[1];
                val = readxmlsingle("<root/>", paths, "error", "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("readxmlmultiple() parameter validation", () => {
        test("14. readxmlmultiple() - missing all arguments → Error", () => {
            const diagnostics = lintText(`
                val = readxmlmultiple();
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("15. readxmlmultiple('xml') - missing second argument → Error", () => {
            const diagnostics = lintText(`
                val = readxmlmultiple("<root/>");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("16. readxmlmultiple('xml', xpaths) - valid 2 arguments → no error", () => {
            const diagnostics = lintText(`
                paths = string[1];
                paths[0] = "/root/node";
                val = readxmlmultiple("<root/>", paths);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("17. readxmlmultiple('xml', xpaths, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                paths = string[1];
                val = readxmlmultiple("<root/>", paths, "error", "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });
});
