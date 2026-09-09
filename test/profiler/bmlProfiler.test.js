const assert = require('assert');
const { BmlProfiler } = require('../../app/lang/profiler/bmlProfiler');

describe('BML Performance & Timeout Profiler', () => {
    it('flags unsupported while loops with critical error', () => {
        const code = `
            i = 0;
            while (i < 10) {
                i = i + 1;
            }
        `;
        const issues = BmlProfiler.profile(code);
        const whileIssue = issues.find(i => i.ruleId === 'bml-no-while-loop');

        assert.ok(whileIssue, 'Should flag while loop as unsupported');
        assert.strictEqual(whileIssue.severity, 'error');
        assert.ok(whileIssue.message.includes("Oracle CPQ BML does not support 'while' loops"));
    });

    it('flags BMQL queries executed inside loops (N+1 query bottleneck)', () => {
        const code = `
            for id in ids {
                bmql select name, price from Parts where partId = $id;
            }
        `;
        const issues = BmlProfiler.profile(code);
        const bmqlInLoop = issues.find(i => i.ruleId === 'bml-bmql-in-loop');

        assert.ok(bmqlInLoop, 'Should flag BMQL inside loop');
        assert.strictEqual(bmqlInLoop.severity, 'error');
        assert.ok(bmqlInLoop.message.includes('BMQL database query detected inside a loop'));
    });

    it('flags repeated string concatenation inside loops', () => {
        const code = `
            result = "";
            for item in items {
                result += item;
            }
        `;
        const issues = BmlProfiler.profile(code);
        const concatIssue = issues.find(i => i.ruleId === 'bml-string-concat-in-loop');

        assert.ok(concatIssue, 'Should warn about string concatenation in loop');
        assert.ok(concatIssue.message.includes('stringbuilder'));
    });

    it('flags excessive loop nesting depth > 3', () => {
        const code = `
            for a in arrA {
                for b in arrB {
                    for c in arrC {
                        for d in arrD {
                            print "deep";
                        }
                    }
                }
            }
        `;
        const issues = BmlProfiler.profile(code);
        const nestingIssue = issues.find(i => i.ruleId === 'bml-loop-nesting-limit');

        assert.ok(nestingIssue, 'Should flag deep loop nesting > 3');
    });

    it('passes clean scripts without errors', () => {
        const code = `
            // Bulk query outside loop
            rs = bmql select sku, price from Parts where active = 1;
            sb = stringbuilder();
            for row in rs {
                sbappend(sb, get(row, "sku"));
            }
            return sb;
        `;
        const issues = BmlProfiler.profile(code);
        const errors = issues.filter(i => i.severity === 'error');
        assert.strictEqual(errors.length, 0, 'Clean code should have zero error diagnostics');
    });
});
