const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Others / BOM / Sessions / SysConfig Exhaustive 3-Tier Suite', () => {
    // =========================================================================
    // 1. StringBuilder Functions (stringbuilder, sbappend, sbtostring)
    // =========================================================================
    suite('StringBuilder functions (stringbuilder, sbappend, sbtostring)', () => {
        suite('sbtostring() - Positive, Negative, and Destructive Tests', () => {
            test('Positive: standard 1 argument on StringBuilder instance', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "Hello");
                    res = sbtostring(sb);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Positive: nested within print() and len() expressions', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "World");
                    print(sbtostring(sb));
                    l = len(sbtostring(sb));
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Positive: multi-line formatting with block comments', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    res = sbtostring(
                        /* target stringbuilder */
                        sb
                    );
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Negative: 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = sbtostring(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('Negative: excess 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    res = sbtostring(sb, "excess");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Negative: trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    res = sbtostring(sb, );
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });

            test('Negative: type mismatch on first arg (passing Integer/String) → Warning', () => {
                const diags = lintText('res = sbtostring(12345); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('Destructive: keyword identifier as argument', () => {
                const diags = lintText('res = sbtostring(return); return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('sbappend() - Positive, Negative, and Destructive Tests', () => {
            test('Positive: 2 arguments (sb, text)', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "Line 1");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Positive: variadic multi-arguments (sb, a, b, c)', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "A", "B", "C", "D");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Positive: expressions and type conversions as values', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "Sum: " + string(10 + 20));
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Negative: trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText(`
                    sb = stringbuilder();
                    sbappend(sb, "text", );
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('stringbuilder() - Positive and Negative Tests', () => {
            test('Positive: 0 arguments creates StringBuilder', () => {
                const diags = lintText('sb = stringbuilder(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Positive: initial arguments creates populated StringBuilder', () => {
                const diags = lintText('sb = stringbuilder("a", "b", "c"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. Global Dictionary & User Session Functions
    // =========================================================================
    suite('Global Dictionary & User Session functions', () => {
        suite('Positive', () => {
            test('globaldictset("key", "val") & globaldictget("key") & globaldictremove("key")', () => {
                const diags = lintText(`
                    s = globaldictset("k1", "v1");
                    v = globaldictget("k1");
                    r = globaldictremove("k1");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('usersessionset("key", "val") & usersessionget("key") & usersessionremove("key")', () => {
                const diags = lintText(`
                    usersessionset("k1", "v1");
                    v = usersessionget("k1");
                    r = usersessionremove("k1");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('globaldictset with 1 arg (missing value) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = globaldictset("k1"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('usersessionget with 0 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = usersessionget(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // =========================================================================
    // 3. BOM Mapping Functions (convertbomtohier, convertbomtoflat, applybom, getbom, savebom, calculatedeltabom)
    // =========================================================================
    suite('BOM Functions (convertbomtohier, convertbomtoflat, applybom, getbom, savebom, calculatedeltabom)', () => {
        suite('Positive', () => {
            test('convertbomtohier(j) & convertbomtoflat(j) - valid 1 arg', () => {
                const diags = lintText(`
                    j = json("{}");
                    h = convertbomtohier(j);
                    f = convertbomtoflat(j);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('applybom(base, one) - valid 2 args', () => {
                const diags = lintText(`
                    b = json("{}");
                    o = json("{}");
                    res = applybom(b, o);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('getbom(bsId, lineNum [, ...]) - 2 to 6 arguments', () => {
                const diags = lintText(`
                    b2 = getbom(12345, 1);
                    fields = string[]{"partNumber", "quantity"};
                    b3 = getbom(12345, 1, fields);
                    b4 = getbom(12345, 1, fields, true);
                    b5 = getbom(12345, 1, fields, true, false);
                    b6 = getbom(12345, 1, fields, true, false, true);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('savebom(bsId, bomJson [, configKey]) - 2 to 3 arguments', () => {
                const diags = lintText(`
                    s2 = savebom(12345, json("{}"));
                    s3 = savebom(12345, json("{}"), "rootKey");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('calculatedeltabom(priorBom, currentBom, inputBom [, setting]) - 3 to 4 arguments', () => {
                const diags = lintText(`
                    p = json("{}"); c = json("{}"); i = json("{}");
                    d3 = calculatedeltabom(p, c, i);
                    d4 = calculatedeltabom(p, c, i, json("{}"));
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('getbom with 1 argument → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = getbom(12345); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('savebom with 1 argument → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = savebom(12345); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('calculatedeltabom with 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = calculatedeltabom(json("{}"), json("{}")); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // =========================================================================
    // 4. Commerce & System Helpers (setattributevalue, getoldvalue, generatehmacmessage, print, isnull, throwerror, generateuuid, logtime)
    // =========================================================================
    suite('Commerce & System Helpers (setattributevalue, getoldvalue, generatehmacmessage, print, isnull, throwerror, generateuuid, logtime)', () => {
        suite('Positive', () => {
            test('Commerce attribute operations: setattributevalue & getoldvalue', () => {
                const diags = lintText(`
                    setattributevalue(1, "price_each", 100.50);
                    oldVal = getoldvalue("price_each", 1);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Security & Cryptography: generatehmacmessage(msg, key [, algorithm])', () => {
                const diags = lintText(`
                    sig1 = generatehmacmessage("payload", "secretKey");
                    sig2 = generatehmacmessage("payload", "secretKey", "HmacSHA256");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('System Diagnostics: print, isnull, throwerror, generateuuid, logtime', () => {
                const diags = lintText(`
                    print("Debug message");
                    b = isnull("sample");
                    uid = generateuuid();
                    logtime("timestamp_marker", 125);
                    if (b) {
                        throwerror("Fatal error message");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('generatehmacmessage with 4 args (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('sig = generatehmacmessage("payload", "key", "SHA256", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('getoldvalue with 0 args (missing parameter) → flags bml-function-arg-count Error', () => {
                const diags = lintText('old = getoldvalue(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('getoldvalue with 3 args (excess parameter) → flags bml-function-arg-count Error', () => {
                const diags = lintText('old = getoldvalue("attr", 1, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
