const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - XML Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. readxmlsingle(String xmlPayload, String xpath) OR readxmlsingle(String xmlPayload, String[] xpaths [, String defaultErrorMessage])
    // =========================================================================
    suite('readxmlsingle() - Extract Single XML Node / Attribute Values', () => {
        suite('Positive', () => {
            test('2 arguments (String xpath): extracts text node value', () => {
                const diags = lintText(`
                    xml = "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><library><book lang=\\"en\\">Spring in Action</book></library>";
                    val = readxmlsingle(xml, "/library/book/text()");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments (String xpath): extracts ATTRIBUTE_NODE value (@lang)', () => {
                const diags = lintText(`
                    xml = "<order id=\\"1001\\" status=\\"Approved\\"><total>500</total></order>";
                    id = readxmlsingle(xml, "/order/@id");
                    status = readxmlsingle(xml, "/order/@status");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments (String[] xpaths array): returns Dictionary of results', () => {
                const diags = lintText(`
                    xml = "<library><book lang=\\"en\\">Spring in Action</book></library>";
                    xpaths = string[1];
                    xpaths[0] = "/library/book[1]/@lang";
                    output = readxmlsingle(xml, xpaths);
                    langVal = get(output, xpaths[0]);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments (with defaultErrorMessage): returns BM_READXMLSINGLE_ERROR fallback', () => {
                const diags = lintText(`
                    xml = "<library><book>Data</book></library>";
                    xpaths = string[]{"/library/missingNode"};
                    output = readxmlsingle(xml, xpaths, "BM_READXMLSINGLE_ERROR");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Root default namespace handling with BM_NS prefix', () => {
                const diags = lintText(`
                    xml = "<root xmlns=\\"http://example.com/schema\\"><item>Value</item></root>";
                    val = readxmlsingle(xml, "/BM_NS:root/BM_NS:item");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Multi-line formatting with block comments', () => {
                const diags = lintText(`
                    res = readxmlsingle(
                        /* xmlPayload */ "<root><id>999</id></root>",
                        /* xpathQuery */ "/root/id/text()"
                    );
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = readxmlsingle(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing xpath) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = readxmlsingle("<root></root>"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = readxmlsingle("<root/>", string[]{"/root"}, "default", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('val = readxmlsingle("<root/>", "/root", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty XML payload and empty XPath string', () => {
                const diags = lintText('val = readxmlsingle("", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Keyword identifier collision recovery', () => {
                const diags = lintText('val = readxmlsingle(return, break); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 2. readxmlmultiple(String xmlPayload, String[] xpaths [, String defaultErrorMessage])
    // =========================================================================
    suite('readxmlmultiple() - Extract Multiple XML Node Matches into Dictionary', () => {
        suite('Positive', () => {
            test('2 arguments: xmlPayload and String[] xpaths array returning multiple values', () => {
                const diags = lintText(`
                    xmlPayload = "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><library><book lang=\\"en\\">Spring in Action</book><book lang=\\"fr\\">J2EE Blueprint</book></library>";
                    xpaths = string[1];
                    xpaths[0] = "/library/book/@lang";
                    output = readxmlmultiple(xmlPayload, xpaths);
                    values = get(output, xpaths[0]);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: with default error message fallback (BM_READXMLMULTIPLE_ERROR)', () => {
                const diags = lintText(`
                    xmlPayload = "<catalog><item id=\\"1\\">A</item><item id=\\"2\\">B</item></catalog>";
                    xpaths = string[]{"/catalog/item/@id", "/catalog/missing"};
                    items = readxmlmultiple(xmlPayload, xpaths, "BM_READXMLMULTIPLE_ERROR");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Namespaces with prefixes and CDATA node concatenation', () => {
                const diags = lintText(`
                    xmlPayload = "<soapenv:Envelope xmlns:soapenv=\\"http://schemas.xmlsoap.org/soap/envelope/\\"><soapenv:Body><data><![CDATA[Special & Raw Data]]></data></soapenv:Body></soapenv:Envelope>";
                    xpaths = string[]{"//data"};
                    output = readxmlmultiple(xmlPayload, xpaths);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('items = readxmlmultiple(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing xpaths) → flags bml-function-arg-count Error', () => {
                const diags = lintText('items = readxmlmultiple("<root/>"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText(`
                    xpaths = string[]{"/root"};
                    items = readxmlmultiple("<root/>", xpaths, "default", "excess");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('items = readxmlmultiple("<root/>", string[]{"/root"}, ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty xpaths array argument', () => {
                const diags = lintText('items = readxmlmultiple("<root/>", string[]{}); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. applytemplate(String templateFileLocation [, Dictionary payload [, String defaultErrorMessage [, Json jsonIdentifier]]])
    // =========================================================================
    suite('applytemplate() - Apply Template with Tokens, Loops, Conditionals, Dict & JSON', () => {
        suite('Positive', () => {
            test('1 argument: templateFileLocation alone', () => {
                const diags = lintText('output = applytemplate("$BASE_PATH$/templates/quote_template.txt"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: templateFileLocation and Dictionary payload (with global & local 1~ overwrite)', () => {
                const diags = lintText(`
                    templateFileLocation = "$BASE_PATH$/ApplytemplateTest/test.txt";
                    payload = dict("string");
                    put(payload, "VAR1", "Hello world");
                    put(payload, "1~_price_subtotal", "$500.00");
                    output = applytemplate(templateFileLocation, payload);
                    return output;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: with default error message string', () => {
                const diags = lintText(`
                    templateFileLocation = "$BASE_PATH$/templates/order.txt";
                    payload = dict("string");
                    put(payload, "CUSTOMER_NAME", "Acme Corp");
                    output = applytemplate(templateFileLocation, payload, "TEMPLATE_RENDER_ERROR");
                    return output;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('4 arguments: with Json data overriding dictionary payload', () => {
                const diags = lintText(`
                    templateFileLocation = "$BASE_PATH$/ApplytemplateTest/test.txt";
                    payload = dict("string");
                    put(payload, "VAR1", "payloadVal1");
                    put(payload, "VAR2", "payloadVal2");
                    jsonObj = json("{\\"VAR2\\":\\"jsonVal2\\",\\"VAR3\\":\\"jsonVal3\\"}");
                    output = applytemplate(templateFileLocation, payload, "", jsonObj);
                    return output;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = applytemplate(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = applytemplate("loc", dict("string"), "err", json("{}"), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('out = applytemplate("loc", dict("string"), ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty template location string and empty JSON payload', () => {
                const diags = lintText('out = applytemplate("", dict("string"), "", json("{}")); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. transformxml(String xml, String xslFileLocation [, String defaultErrorMessage])
    // =========================================================================
    suite('transformxml() - Transform XML with XSLT Stylesheet from File Manager', () => {
        suite('Positive', () => {
            test('2 arguments: xml string and xslFileLocation from File Manager', () => {
                const diags = lintText(`
                    xmlcontent = "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><book><id>123456</id></book>";
                    xslt = "xsl/test.xsl";
                    output = transformxml(xmlcontent, xslt);
                    return output;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: with default error message fallback', () => {
                const diags = lintText(`
                    xmlcontent = "<quote id=\\"100\\"><total>1500</total></quote>";
                    xslt = "xsl/quote_html.xsl";
                    output = transformxml(xmlcontent, xslt, "TRANSFORMATION_FAILED");
                    return output;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = transformxml(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing xslFileLocation) → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = transformxml("<root/>"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('out = transformxml("<root/>", "xsl/test.xsl", "err", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('out = transformxml("<root/>", "xsl/test.xsl", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Keyword identifier collision in parameters', () => {
                const diags = lintText('out = transformxml(return, break); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });
});
