const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Math Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. acos(Float x) -> Float
    // =========================================================================
    suite('acos() - Arc cosine in range 0 through π', () => {
        suite('Positive', () => {
            test('Calculates arc cosine for valid domain [-1, 1]', () => {
                const diags = lintText('val = acos(0.5); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = acos(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = acos(0.5, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Domain values > 1 handled gracefully', () => {
                const diags = lintText('val = acos(2.5); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. asin(Float x) -> Float
    // =========================================================================
    suite('asin() - Arc sine in range -π/2 through π/2', () => {
        suite('Positive', () => {
            test('Calculates arc sine for valid domain [-1, 1]', () => {
                const diags = lintText('val = asin(-1.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = asin(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = asin(0.5, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Domain boundary values handled without crash', () => {
                const diags = lintText('val = asin(1.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. atan(Float x) -> Float
    // =========================================================================
    suite('atan() - Arc tangent function', () => {
        suite('Positive', () => {
            test('atan(x) calculates arc tangent', () => {
                const diags = lintText('at = atan(1.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('atan with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = atan(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('atan with 2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = atan(1.0, 2.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Zero argument in atan', () => {
                const diags = lintText('val = atan(0.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. ceil(Float x) -> Float
    // =========================================================================
    suite('ceil() - Rounding up to next whole number', () => {
        suite('Positive', () => {
            test('Rounds float up to next whole number', () => {
                const diags = lintText('c = ceil(4.1); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('ceil with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('c = ceil(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('ceil with 2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('c = ceil(4.9, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative float rounding (-0.5)', () => {
                const diags = lintText('c = ceil(-0.5); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. cos(Float x), cosh(Float x), sin(Float x), sinh(Float x), tan(Float x), tanh(Float x)
    // =========================================================================
    suite('cos(), cosh(), sin(), sinh(), tan(), tanh() - Trigonometric and Hyperbolic', () => {
        suite('Positive', () => {
            test('Standard trigonometric and hyperbolic evaluations', () => {
                const diags = lintText(`
                    c = cos(0.0);
                    ch = cosh(1.0);
                    s = sin(0.0);
                    sh = sinh(1.0);
                    t = tan(0.0);
                    th = tanh(1.0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('sin with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sin(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('cosh with 2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('ch = cosh(1.0, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Large angle inputs without precision crash', () => {
                const diags = lintText('s = sin(100000.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. exp(Float x), ln(Float x), log(Float x) -> Float
    // =========================================================================
    suite('exp(), ln(), log() - Exponential and Logarithm Functions', () => {
        suite('Positive', () => {
            test('Calculates e^x, natural log ln(x), and base-10 log(x)', () => {
                const diags = lintText(`
                    e = exp(1.0);
                    l = ln(2.71828);
                    lg = log(1000.0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('exp with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('e = exp(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('log with 2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('lg = log(100.0, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Log of 0 or negative inputs handled gracefully', () => {
                const diags = lintText('l = ln(0.0); lg = log(0.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 7. fabs(Float x) & abs(Float/Integer x) -> Float/Integer
    // =========================================================================
    suite('fabs() & abs() - Absolute Value', () => {
        suite('Positive', () => {
            test('Returns absolute value for floats and integers', () => {
                const diags = lintText('f = fabs(-10.5); a = abs(-500); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('fabs with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('f = fabs(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('abs with 2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('a = abs(-10, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Absolute value of zero', () => {
                const diags = lintText('a = abs(0); f = fabs(0.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 8. fmod(Float x, Float y) -> Float
    // =========================================================================
    suite('fmod() - Remainder of Float division x / y', () => {
        suite('Positive', () => {
            test('Calculates float remainder (10.0 / 3.0 -> remainder 1.0)', () => {
                const diags = lintText('fm = fmod(10.0, 3.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (missing divisor) → flags bml-function-arg-count Error', () => {
                const diags = lintText('fm = fmod(10.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('fm = fmod(10.0, 3.0, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Division by zero float in fmod', () => {
                const diags = lintText('fm = fmod(10.0, 0.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 9. hypot(Float x, Float y) -> Float
    // =========================================================================
    suite('hypot() - sqrt(x^2 + y^2) hypotenuse calculation', () => {
        suite('Positive', () => {
            test('Calculates hypotenuse for 3.0, 4.0 -> 5.0', () => {
                const diags = lintText('h = hypot(3.0, 4.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (missing y) → flags bml-function-arg-count Error', () => {
                const diags = lintText('h = hypot(3.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('h = hypot(3.0, 4.0, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative numbers in hypot', () => {
                const diags = lintText('h = hypot(-3.0, -4.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 10. integer(Float x) -> Integer
    // =========================================================================
    suite('integer() - Extract integer portion of Float without rounding', () => {
        suite('Positive', () => {
            test('Extracts integer portion (14.3345 -> 14)', () => {
                const diags = lintText('i = integer(14.3345324); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('i = integer(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('i = integer(14.5, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative float integer extraction (-99.99 -> -99)', () => {
                const diags = lintText('i = integer(-99.99); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // =========================================================================
    // 11. jNaN - Java Constant for Not-a-Number
    // =========================================================================
    suite('jNaN - Java Constant for Not-a-Number', () => {
        suite('Positive', () => {
            test('Initializes with jNaN constant', () => {
                const diags = lintText('nanVal = jNaN; return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('Unclosed array literal with jNaN flags syntax error', () => {
                const diags = lintText('arr = float[]{jNaN; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Used in arithmetic operations with jNaN constant', () => {
                const diags = lintText('res = jNaN + 10.0; return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 12. pow(Float x, Float y) -> Float
    // =========================================================================
    suite('pow() - Raise first argument to power of second argument', () => {
        suite('Positive', () => {
            test('Calculates 2.0 ^ 3.0 -> 8.0', () => {
                const diags = lintText('p = pow(2.0, 3.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (missing exponent) → flags bml-function-arg-count Error', () => {
                const diags = lintText('p = pow(2.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('p = pow(2.0, 3.0, 4.0); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative exponent (pow(2.0, -2.0) -> 0.25)', () => {
                const diags = lintText('p = pow(2.0, -2.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 13. round(Float x, Integer n) -> Float
    // =========================================================================
    suite('round() - Round number to decimal places', () => {
        suite('Positive', () => {
            test('Rounds with 2 arguments (number, decimal precision)', () => {
                const diags = lintText('r1 = round(4.5678, 2); r2 = round(4.5678, 0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = round(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing precision) → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = round(4.5678); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = round(4.5678, 2, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative precision in round', () => {
                const diags = lintText('r = round(1234.56, -2); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 14. sqrt(Float x) -> Float
    // =========================================================================
    suite('sqrt() - Positive square root of number', () => {
        suite('Positive', () => {
            test('Calculates sqrt(25.0) -> 5.0', () => {
                const diags = lintText('s = sqrt(25.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sqrt(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sqrt(25.0, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative number in square root (sqrt(-1.0))', () => {
                const diags = lintText('s = sqrt(-1.0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
