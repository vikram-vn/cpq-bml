const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Others / BOM / Sessions / SysConfig Specific & Edge Tests', () => {
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

    suite('Global Dictionary & User Session functions', () => {
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

    suite('BOM Mapping functions (convertbomtohier, convertbomtoflat, applybom)', () => {
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
                base = json("{}");
                one = json("{}");
                res = applybom(base, one);
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });

    suite('General helper functions (print, isnull, throwerror, generateuuid, logtime)', () => {
        test('print("msg") / isnull("str") / throwerror("error") / generateuuid() / logtime("tag", 100) - valid', () => {
            const diags = lintText(`
                print("Logging message");
                n = isnull("sample");
                u = generateuuid();
                logtime("perf_step", 150);
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('BOM & Commerce functions (getbom, savebom, calculatedeltabom, setattributevalue, getoldvalue)', () => {
            const diags = lintText(`
                b = getbom(12345, 1);
                sb = savebom(12345, json("{}"));
                delta = calculatedeltabom(json("{}"), json("{}"), json("{}"));
                setattributevalue(1, "attr", "val");
                old = getoldvalue("attr", 1);
                hmac = generatehmacmessage("secret", "message", "HmacSHA256");
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });
});
