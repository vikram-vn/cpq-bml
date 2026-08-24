const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - XML Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // ==========================================
    // 1. readxmlsingle() & readxmlmultiple()
    // ==========================================
    suite('readxmlsingle() & readxmlmultiple() - XPath extraction', () => {
        suite('Positive', () => {
            test('readxmlsingle(xml, xpath) returns single String match', () => {
                const diags = lintText(`
                    xml = "<root><item>Hello</item></root>";
                    val = readxmlsingle(xml, "/root/item");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('readxmlmultiple(xml, xpath) returns String[] array', () => {
                const diags = lintText(`
                    xml = "<root><item>A</item><item>B</item></root>";
                    items = readxmlmultiple(xml, "/root/item");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('readxmlsingle with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = readxmlsingle(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('readxmlsingle with 1 argument (missing xpath) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = readxmlsingle("<root></root>"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('readxmlmultiple with 3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('items = readxmlmultiple("<root/>", "/root", "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('val = readxmlsingle("<root/>", "/root", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });
    });

    // ==========================================
    // 2. applytemplate() & transformxml()
    // ==========================================
    suite('applytemplate() & transformxml() - XSLT transformation', () => {
        suite('Positive', () => {
            test('applytemplate(xml, xslt) returns transformed String', () => {
                const diags = lintText(`
                    xml = "<root><name>CPQ</name></root>";
                    xslt = "<xsl:stylesheet version='1.0'>...</xsl:stylesheet>";
                    out = applytemplate(xml, xslt);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('transformxml(xml, xslt) returns transformed String', () => {
                const diags = lintText(`
                    xml = "<root/>";
                    xslt = "<xsl:stylesheet/>";
                    out = transformxml(xml, xslt);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('applytemplate with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = applytemplate(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('transformxml with 1 arg → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = transformxml("<root/>"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
