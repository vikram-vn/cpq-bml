const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Math Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // ==========================================
    // 1. Single-Operand Functions
    // ==========================================
    suite('Single-Operand Math Functions (abs, ceil, floor, sqrt, exp, log, ln, sin, cos, tan, etc.)', () => {
        suite('Positive', () => {
            test('Basic numeric calculations with Float and Integer literals', () => {
                const diags = lintText(`
                    a = abs(-10.5);
                    c = ceil(4.1);
                    f = floor(4.9);
                    s = sqrt(25.0);
                    e = exp(1.0);
                    l = ln(2.718);
                    lg = log(100.0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Trigonometric and Hyperbolic functions: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh', () => {
                const diags = lintText(`
                    sn = sin(0.0); cs = cos(0.0); tn = tan(0.0);
                    as = asin(0.5); ac = acos(0.5); at = atan(1.0);
                    sh = sinh(1.0); ch = cosh(1.0); th = tanh(1.0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Conversions: todegrees, toradians, tointegral, integer', () => {
                const diags = lintText(`
                    deg = todegrees(3.14159);
                    rad = toradians(180.0);
                    ti = tointegral(4.99);
                    it = integer(5.8);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Special numeric checks: isnan, isinf, jNaN', () => {
                const diags = lintText(`
                    n = isnan(0.0);
                    i = isinf(100.0);
                    jn = jNaN();
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sqrt(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('2 arguments (excess parameter) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sqrt(16.0, 2.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('s = sqrt(16.0, ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Keyword identifier collision recovery', () => {
                const diags = lintText('s = sqrt(return); return "";');
                assert.ok(diags.length > 0);
            });

            test('Illegal assignment to math function call', () => {
                const diags = lintText('sqrt(16.0) = 4.0; return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // ==========================================
    // 2. Double-Operand Functions (pow, fmod, hypot, atan2, round)
    // ==========================================
    suite('Double-Operand Math Functions (pow, fmod, hypot, atan2, round)', () => {
        suite('Positive', () => {
            test('pow, fmod, hypot, atan2 with 2 arguments', () => {
                const diags = lintText(`
                    p = pow(2.0, 3.0);
                    fm = fmod(10.0, 3.0);
                    h = hypot(3.0, 4.0);
                    at2 = atan2(1.0, 1.0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('round() with 2 arguments (number, precision)', () => {
                const diags = lintText('r = round(4.5678, 2); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('pow with 1 argument → flags bml-function-arg-count Error', () => {
                const diags = lintText('p = pow(2.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('pow with 3 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('p = pow(2.0, 3.0, 4.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('round with 1 argument → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = round(4.5678); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
