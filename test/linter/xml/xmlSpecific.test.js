const assert = require("assert");
const { lintText } = require("../fixtures");

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

        test("18. applytemplate() - type check 4th argument (expected Json) → Warning", () => {
            const diagnostics = lintText(`
                payload = dict("string");
                val = applytemplate("path", payload, "error", "not_json_type");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("19. readxmlsingle() - type check 2nd argument (expected String[]) → Warning", () => {
            const diagnostics = lintText(`
                val = readxmlsingle("<root/>", "not_a_string_array");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("20. readxmlmultiple() - type check 2nd argument (expected String[]) → Warning", () => {
            const diagnostics = lintText(`
                val = readxmlmultiple("<root/>", "not_a_string_array");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });
    });

    suite("readxmlmultiple()/readxmlsingle() result never checked for the sentinel error key (bml-readxml-error-key-unchecked)", () => {
        test("Flags readxmlmultiple() result read via get() without checking BM_READXMLMULTIPLE_ERROR", () => {
            const diagnostics = lintText(`
                result = readxmlmultiple("<root/>", xpaths);
                val = get(result, "/root/name");
                return val;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-readxml-error-key-unchecked');
            assert.ok(diag, 'XML.md: readxmlmultiple() reports errors via a BM_READXMLMULTIPLE_ERROR dictionary key instead of throwing');
        });

        test("Flags readxmlsingle() result read via get() without checking BM_READXMLSINGLE_ERROR", () => {
            const diagnostics = lintText(`
                result = readxmlsingle("<root/>", xpaths);
                val = get(result, "/root/name");
                return val;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-readxml-error-key-unchecked');
            assert.ok(diag);
        });

        test("Does not flag when the sentinel error key is checked first", () => {
            const diagnostics = lintText(`
                result = readxmlmultiple("<root/>", xpaths);
                if (containskey(result, "BM_READXMLMULTIPLE_ERROR")) {
                    return "";
                }
                val = get(result, "/root/name");
                return val;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-readxml-error-key-unchecked');
            assert.strictEqual(diag, undefined);
        });

        test("Does not flag when the result is never read via get() at all", () => {
            const diagnostics = lintText(`
                result = readxmlmultiple("<root/>", xpaths);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-readxml-error-key-unchecked');
            assert.strictEqual(diag, undefined);
        });
    });
});
