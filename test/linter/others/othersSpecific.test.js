const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Others / BOM / Commerce / SysConfig Exhaustive 3-Tier Suite', () => {
    // =========================================================================
    // 1. StringBuilder Functions (stringbuilder, sbappend, sbtostring)
    // =========================================================================
    suite('stringbuilder() - Initialize StringBuilder object', () => {
        suite('Positive', () => {
            test('0 arguments creates empty StringBuilder', () => {
                const diags = lintText('sb = stringbuilder(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Initial string arguments populate StringBuilder', () => {
                const diags = lintText('sb = stringbuilder("Hello", " ", "World"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('Trailing comma in initialization flags bml-trailing-comma-error', () => {
                const diags = lintText('sb = stringbuilder("Hello", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Keyword identifier collision inside arguments', () => {
                const diags = lintText('sb = stringbuilder(return, break); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    suite('sbappend() - Attach elements to StringBuilder object', () => {
        suite('Positive', () => {
            test('2 arguments: append string to StringBuilder', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "Line 1");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Variadic multiple arguments (sb, a, b, c)', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "A", "B", "C", "D");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('Trailing comma flags bml-trailing-comma-error', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "text", );
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty string append does not crash', () => {
                const diags = lintText('sb = stringbuilder(); sbappend(sb, ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    suite('sbtostring() - Convert finished StringBuilder to String', () => {
        suite('Positive', () => {
            test('Standard 1 argument on StringBuilder instance', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "Hello");
                    res = sbtostring(sb);
                    return res;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = sbtostring(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('Excess 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    res = sbtostring(sb, "excess");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Keyword identifier as argument', () => {
                const diags = lintText('res = sbtostring(return); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 2. Transaction & Parts Functions (addpartstotransaction, addtotransaction, importtransactiondata)
    // =========================================================================
    suite('addpartstotransaction() - Add parts to quote automatically within Transaction', () => {
        suite('Positive', () => {
            test('1, 2, and 3 arguments: jsonArray, priceBookVarName, resultAttributeArray', () => {
                const diags = lintText(`
                    partsArr = jsonarray("[{\\"partNumber\\":\\"part1\\", \\"quantity\\":1, \\"price\\":3.50}]");
                    res1 = addpartstotransaction(partsArr);
                    res2 = addpartstotransaction(partsArr, "_default_price_book");
                    res3 = addpartstotransaction(partsArr, "_default_price_book", string[]{"_part_quantity", "_document_number"});
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('addpartstotransaction(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('addpartstotransaction(jsonarray(), "pb", string[]{}, "none", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty parts array in addpartstotransaction', () => {
                const diags = lintText('addpartstotransaction(jsonarray()); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    suite('addtotransaction() - Add Models and Config attribute values to Transaction', () => {
        suite('Positive', () => {
            test('1, 2, 3, and 4 arguments: items, priceBookVarName, resultAttributeArray, pricingTriggerPoint', () => {
                const diags = lintText(`
                    items = jsonarray();
                    m1 = json("{\\"_model_variable_name\\":\\"serverRack\\",\\"_price_quantity\\":5}");
                    jsonarrayappend(items, m1);
                    res = addtotransaction(items, "_default_price_book", jsonarray("[\"_document_number\"]"), "afterInsert");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('addtotransaction(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('addtotransaction(jsonarray(), "pb", jsonarray(), "none", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty items array in addtotransaction', () => {
                const diags = lintText('res = addtotransaction(jsonarray()); return jsontostr(json());');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    suite('importtransactiondata() - Import Transaction data by BSID', () => {
        suite('Positive', () => {
            test('1 argument: bsid Commerce Transaction ID integer/long', () => {
                const diags = lintText(`
                    bSuccess = importtransactiondata(123456);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('importtransactiondata(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('importtransactiondata(123456, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Zero transaction ID in importtransactiondata', () => {
                const diags = lintText('b = importtransactiondata(0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. Security, HMAC & UUID Functions (generatehmacmessage, getuuid, generateuuid)
    // =========================================================================
    suite('generatehmacmessage() - Generate HMAC hash message authentication code', () => {
        suite('Positive', () => {
            test('2 and 3 arguments with SHA256, SHA384, SHA512, SHA1, MD5 algorithms', () => {
                const diags = lintText(`
                    hmac1 = generatehmacmessage("message payload", "secretKey");
                    hmac2 = generatehmacmessage("message payload", "secretKey", "SHA256");
                    hmac3 = generatehmacmessage("message payload", "secretKey", "MD5");
                    return hmac1;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('h = generatehmacmessage(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing key) → flags bml-function-arg-count Error', () => {
                const diags = lintText('h = generatehmacmessage("msg"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('h = generatehmacmessage("m", "k", "SHA256", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty message string in generatehmacmessage', () => {
                const diags = lintText('h = generatehmacmessage("", "key", "SHA256"); return h;');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    suite('getuuid() & generateuuid() - Generate unique UUID asset identifiers for ABO', () => {
        suite('Positive', () => {
            test('getuuid(count) generates String[] array and generateuuid() generates single string', () => {
                const diags = lintText(`
                    ids = getuuid(5);
                    singleId = generateuuid();
                    return singleId;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('generateuuid with 1 argument (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('u = generateuuid("excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('getuuid(0) returns empty string array', () => {
                const diags = lintText('ids = getuuid(0); return string(sizeofarray(ids));');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. Attachments & Configuration Attribute Readers (getattachmentdata, getconfigattrvalue, getarraystr)
    // =========================================================================
    suite('getattachmentdata() - Retrieve filename, filecontent, mimetype dictionary', () => {
        suite('Positive', () => {
            test('1 and 2 arguments (attachmentId, asBytes boolean)', () => {
                const diags = lintText(`
                    attDict1 = getattachmentdata("att_12345");
                    attDict2 = getattachmentdata("att_12345", true);
                    fn = get(attDict1, "filename", "string");
                    return fn;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = getattachmentdata(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = getattachmentdata("att", true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty attachment ID in getattachmentdata', () => {
                const diags = lintText('d = getattachmentdata(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    suite('getconfigattrvalue() & getarraystr() - Retrieve Configuration Attribute Values', () => {
        suite('Positive', () => {
            test('getconfigattrvalue with 1 and 2 args (attrVarName, docNumber)', () => {
                const diags = lintText(`
                    val1 = getconfigattrvalue("memorySize");
                    val2 = getconfigattrvalue(2, "processorType");
                    arrStr = getarraystr(string[]{"A", "B", "C"});
                    return val1;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('getconfigattrvalue with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = getconfigattrvalue(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('getarraystr with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = getarraystr(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('getarraystr on empty array', () => {
                const diags = lintText('s = getarraystr(string[]{}); return s;');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. Commerce Attribute Modification, Old Values & Approvals (setattributevalue, getoldvalue, getreasonstatus, validatequoteforagreement)
    // =========================================================================
    suite('setattributevalue() - Set Commerce Main and Sub-document attributes', () => {
        suite('Positive', () => {
            test('Main document (2 args) and Sub-document (3 args) attribute value updates', () => {
                const diags = lintText(`
                    setattributevalue("contractDuration_t", 24);
                    setattributevalue(2, "unitPrice_l", 199.99);
                    setattributevalue("1", "customStatus_l", "Approved");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('Trailing comma in setattributevalue flags bml-trailing-comma-error', () => {
                const diags = lintText('setattributevalue(1, "attr", "val", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Setting array set reference ID with setattributevalue', () => {
                const diags = lintText(`
                    arr = jsonarray("[{\\"field\\":\\"val\\"}]");
                    setattributevalue(1, "arraySetAttr", jsonarrayrefid(arr));
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    suite('getoldvalue(), getreasonstatus(), validatequoteforagreement(), invoke()', () => {
        suite('Positive', () => {
            test('Retrieves old values, reason status, validates agreements, and invokes global table functions', () => {
                const diags = lintText(`
                    old1 = getoldvalue("_quote_bill_to_address");
                    old2 = getoldvalue("_price_net_price", 2);
                    reasonStatus = getreasonstatus("discountReason");
                    errors = validatequoteforagreement();
                    bInvoked = invoke("customGlobalFunc", "arg1~arg2", "defaultResult");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('getoldvalue with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = getoldvalue(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('getreasonstatus with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = getreasonstatus(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('validatequoteforagreement with 1 argument (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('errs = validatequoteforagreement("excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Iterate over validatequoteforagreement errors array', () => {
                const diags = lintText(`
                    errs = validatequoteforagreement();
                    for err in errs {
                        print(err);
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. Diagnostics, Logging & Flow Termination (print, isnull, throwerror, logtime)
    // =========================================================================
    suite('print(), isnull(), throwerror(), logtime() - Logging & Execution Control', () => {
        suite('Positive', () => {
            test('Executes print, isnull, logtime, and throwerror', () => {
                const diags = lintText(`
                    print("Debug message");
                    bNull = isnull("test");
                    logtime("BenchmarkTag", 150);
                    if (false) {
                        throwerror("Business rule violated", false);
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('isnull with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isnull(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('logtime with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('logtime(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('throwerror with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('throwerror(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('throwerror system error mode (isSystemError = true)', () => {
                const diags = lintText('throwerror("System failure in payment gateway", true); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
