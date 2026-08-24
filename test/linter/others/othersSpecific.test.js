const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Others / BOM / Sessions / SysConfig Specific & Edge Tests', () => {
    suite('StringBuilder functions (stringbuilder, sbappend, sbtostring)', () => {
        test('stringbuilder() / sbappend(sb, "text") / sbtostring(sb) - valid', () => {
            const diags = lintText(`
                sb = stringbuilder();
                sbappend(sb, "Hello");
                sbappend(sb, " World");
                res = sbtostring(sb);
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sbtostring() with 0 args flags bml-function-arg-count', () => {
            const diags = lintText('res = sbtostring(); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
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
    });
});
