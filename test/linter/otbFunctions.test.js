const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { lintText } = require('./fixtures');
const { parseParameterSignature } = require('../../app/lang/lint/functionSignature');

function getSafeLiteralForType(type, index) {
    if (!type) return `arg${index}`;
    const typeLower = Array.isArray(type) ? type[0].toLowerCase() : type.toLowerCase();
    if (typeLower.includes('record')) {
        return `arg${index}`;
    }
    if (typeLower.includes('jsonarray')) return 'jsonarray()';
    if (typeLower.includes('json')) return 'json()';
    if (typeLower.includes('integer[]') || typeLower.includes('long[]')) return 'integer[]{1}';
    if (typeLower.includes('float[]') || typeLower.includes('numeric[]') || typeLower.includes('double[]')) return 'float[]{0.5}';
    if (typeLower.includes('boolean[]')) return 'boolean[]{true}';
    if (typeLower.includes('date[]')) return 'date[]{getdate()}';
    if (typeLower.includes('array') || typeLower.includes('[]')) {
        return 'string[]{"123"}';
    }
    if (typeLower.includes('integer') || typeLower.includes('long')) return '1';
    if (typeLower.includes('float') || typeLower.includes('numeric') || typeLower.includes('double')) return '0.5';
    if (typeLower.includes('boolean')) return 'true';
    if (typeLower.includes('date')) return 'getdate()';
    if (typeLower.includes('stringbuilder')) return 'stringbuilder()';
    if (typeLower.includes('dictionary') || typeLower.includes('dict')) return 'dict("string")';
    return '"123"';
}

suite('BML Linter Test Suite - OTB Functions validation', () => {
    const apiUsagePath = path.join(__dirname, '../../app/lang/intellisense/bml_functions_api_usage.json');
    const apiData = JSON.parse(fs.readFileSync(apiUsagePath, 'utf8'));

    const localKeywords = new Set([
        'if', 'elif', 'else', 'for', 'in', 'break', 'continue', 'return',
        'true', 'false', 'null', 'and', 'or', 'not',
        'string', 'integer', 'float', 'boolean', 'date', 'json', 'jsonarray',
        'jsonnull', 'bytearray', 'record', 'recordset', 'stringbuilder', 'dictionary', 'dict',
        'bmql',
    ]);
    const deprecated = new Set(['strtodate', 'gettabledata', 'getpartsdata']);

    Object.keys(apiData).forEach(name => {
        const nameLower = name.toLowerCase();
        if (nameLower === 'nan' || nameLower === 'jnan' || name.startsWith('BM_') || !/^[a-zA-Z0-9_]+$/.test(name) || localKeywords.has(nameLower) || deprecated.has(nameLower)) {
            return; // Skip keywords, deprecated, special/doc names, constants, and NaN constants
        }

        const item = apiData[name];
        const overloads = item.fullSignature.split(/\r?\n\s*\(or\)\s*\r?\n/).map(sig => parseParameterSignature(sig));

        suite(`Function: ${name}`, () => {
            const globalMin = Math.min(...overloads.map(ov => ov.min));
            const globalMax = Math.max(...overloads.map(ov => ov.max));
            const firstMin = overloads[0].min;

            test('1. validates correct argument count with variables', () => {
                if (name === 'put' || name === 'sbappend') {
                    overloads.forEach(parsed => {
                        assert.strictEqual(parsed.params, null);
                    });
                    return;
                }
                const correctArgs = Array.from({ length: firstMin }, (_, i) => `arg${i}`).join(', ');
                const code = `x = ${name}(${correctArgs});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined, `Should NOT flag correct argument count for ${name}(${correctArgs})`);
            });

            test('2. validates correct argument count with safe literals', () => {
                if (name === 'put' || name === 'sbappend') return;
                const correctArgs = (overloads[0].params || []).slice(0, firstMin).map((p, idx) => getSafeLiteralForType(p.type, idx)).join(', ');
                const code = `x = ${name}(${correctArgs});\nreturn "";`;
                const diagnostics = lintText(code);
                const errCount = diagnostics.find(d => d.code === 'bml-function-arg-count');
                const errType = diagnostics.find(d => d.code === 'bml-function-arg-type');
                assert.strictEqual(errCount, undefined, `Should not flag count error for ${name}(${correctArgs})`);
                assert.strictEqual(errType, undefined, `Should not flag type error for ${name}(${correctArgs})`);
            });

            if (globalMin > 0) {
                test('3. validates too few arguments is a fatal Error', () => {
                    const dummyArgs = Array.from({ length: globalMin - 1 }, (_, i) => `arg${i}`).join(', ');
                    const code = `x = ${name}(${dummyArgs});\nreturn "";`;
                    const diagnostics = lintText(code);
                    const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                    assert.ok(err, `Should flag too few arguments for ${name}(${dummyArgs}) - expected at least ${globalMin}, got ${globalMin - 1}`);
                    assert.strictEqual(err.severity, require('vscode').DiagnosticSeverity.Error, `arg-count diagnostic must be Error severity for ${name}`);
                });

                test('4. validates zero arguments is a fatal Error', () => {
                    const code = `x = ${name}();\nreturn "";`;
                    const diagnostics = lintText(code);
                    const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                    assert.ok(err, `Should flag too few arguments for ${name}() - expected at least ${globalMin}, got 0`);
                    assert.strictEqual(err.severity, require('vscode').DiagnosticSeverity.Error, `arg-count diagnostic must be Error severity for ${name}`);
                });
            } else {
                test('3. validates too few arguments is a fatal Error (skipped - min is 0)', () => {});
                test('4. validates zero arguments is a fatal Error (skipped - min is 0)', () => {});
            }

            if (globalMax !== Infinity) {
                test('5. validates too many arguments is a fatal Error', () => {
                    const dummyArgs = Array.from({ length: globalMax + 1 }, (_, i) => `arg${i}`).join(', ');
                    const code = `x = ${name}(${dummyArgs});\nreturn "";`;
                    const diagnostics = lintText(code);
                    const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                    assert.ok(err, `Should flag too many arguments for ${name}(${dummyArgs}) - expected at most ${globalMax}, got ${globalMax + 1}`);
                    assert.strictEqual(err.severity, require('vscode').DiagnosticSeverity.Error, `arg-count diagnostic must be Error severity for ${name}`);
                });

                test('6. validates extreme argument overflow is a fatal Error', () => {
                    const dummyArgs = Array.from({ length: globalMax + 5 }, (_, i) => `arg${i}`).join(', ');
                    const code = `x = ${name}(${dummyArgs});\nreturn "";`;
                    const diagnostics = lintText(code);
                    const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                    assert.ok(err, `Should flag too many arguments for ${name}(${dummyArgs}) - expected at most ${globalMax}, got ${globalMax + 5}`);
                    assert.strictEqual(err.severity, require('vscode').DiagnosticSeverity.Error, `arg-count diagnostic must be Error severity for ${name}`);
                });
            } else {
                test('5. validates too many arguments is a fatal Error (skipped - max is Infinity)', () => {});
                test('6. validates extreme argument overflow is a fatal Error (skipped - max is Infinity)', () => {});
            }

            test('7. validates trailing comma error', () => {
                const correctArgs = Array.from({ length: firstMin || 1 }, (_, i) => `arg${i}`).join(', ');
                const code = `x = ${name}(${correctArgs}, );\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
                assert.ok(err, `Should flag trailing comma for ${name}(${correctArgs}, )`);
            });

            test('8. validates spacing and newlines in call', () => {
                if (name === 'put' || name === 'sbappend') return;
                const correctArgs = Array.from({ length: firstMin }, (_, i) => `\n  arg${i}`).join(', ');
                const code = `x = ${name}(\n  ${correctArgs}\n);\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined, `Should allow extra spacing and newlines in ${name}`);
            });

            test('9. validates comments inside argument list', () => {
                if (name === 'put' || name === 'sbappend') return;
                const correctArgs = Array.from({ length: firstMin }, (_, i) => `arg${i} /* comment ${i} */`).join(', ');
                const code = `x = ${name}(${correctArgs});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined, `Should allow comments in ${name}`);
            });

            test('10. validates nested parenthesized expressions as arguments', () => {
                if (name === 'put' || name === 'sbappend') return;
                const correctArgs = Array.from({ length: firstMin }, (_, i) => `(1 + arg${i})`).join(', ');
                const code = `x = ${name}(${correctArgs});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined, `Should allow nested expressions in ${name}`);
            });

            test('11. validates case-insensitivity of built-in name', () => {
                if (name === 'put' || name === 'sbappend') return;
                const correctArgs = Array.from({ length: firstMin }, (_, i) => `arg${i}`).join(', ');
                const code = `x = ${name.toUpperCase()}(${correctArgs});\nreturn "";`;
                const diagnostics = lintText(code);
                const errUnknown = diagnostics.find(d => d.code === 'bml-unknown-function');
                const errCount = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(errUnknown, undefined, `Should recognize uppercase ${name.toUpperCase()}`);
                assert.strictEqual(errCount, undefined, `Should accept correct arg count for uppercase ${name.toUpperCase()}`);
            });

            const firstParam = overloads[0].params && overloads[0].params[0];
            if (firstParam && firstParam.type && typeof firstParam.type === 'string') {
                const pType = firstParam.type.toLowerCase();
                if (pType === 'string' || pType === 'integer' || pType === 'float' || pType === 'numeric' || pType === 'boolean') {
                    test('12. validates type mismatch on first argument', () => {
                        if (name === 'put' || name === 'sbappend') return;
                        const mismatchedVal = pType === 'string' ? '123' : '"abc"';
                        const otherArgs = overloads[0].params.slice(1).map((p, idx) => getSafeLiteralForType(p.type, idx + 1));
                        const allArgs = [mismatchedVal, ...otherArgs].join(', ');
                        const code = `x = ${name}(${allArgs});\nreturn "";`;
                        const diagnostics = lintText(code);
                        const err = diagnostics.find(d => d.code === 'bml-function-arg-type');
                        assert.ok(err, `Should flag type mismatch for ${name}(${allArgs}) - expected ${firstParam.type}`);
                    });
                } else {
                    test('12. validates type mismatch on first argument (skipped - non-primitive type)', () => {});
                }
            } else {
                test('12. validates type mismatch on first argument (skipped - no typed params)', () => {});
            }
        });
    });
});
