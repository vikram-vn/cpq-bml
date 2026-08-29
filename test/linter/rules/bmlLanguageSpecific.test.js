const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - BML Core Language & Best Practices Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. Variable Declarations & Simultaneous Initialization
    // =========================================================================
    suite('Variable Declarations - Simultaneous declaration and initialization', () => {
        suite('Positive', () => {
            test('Declares and initializes Integer, Float, String, and Boolean variables', () => {
                const diags = lintText(`
                    itemCount = 10;
                    unitPrice = 49.99;
                    itemDescription = "Standard Server Rack";
                    isDiscountEligible = true;
                    return itemDescription;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Uninitialized variable declaration (e.g. integer x;) → syntax error', () => {
                const diags = lintText('count; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Variable re-assignment with matching and expression values', () => {
                const diags = lintText(`
                    total = 0.0;
                    total = total + 150.0;
                    total = total * 1.10;
                    return string(total);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. Relational & Logical Operators (==, <>, <, >, <=, >=, and, or, not)
    // =========================================================================
    suite('Relational & Logical Operators - Equality, Comparison, and Booleans', () => {
        suite('Positive', () => {
            test('Relational equality (==) and inequality (<>) on numbers, strings, booleans', () => {
                const diags = lintText(`
                    b1 = (12 == 12);
                    b2 = ("string" <> "abc");
                    b3 = (true == true);
                    b4 = (12 < 13);
                    b5 = (15 >= 10);
                    b6 = (true and not false or b1);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Invalid operator syntax (e.g. && instead of and, || instead of or, ! instead of not)', () => {
                const diags = lintText('b = true && false; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Deeply nested boolean logic trees with parentheses', () => {
                const diags = lintText(`
                    valid = ((10 > 5 and "a" == "a") or (not(false) and 20 <= 30));
                    if (valid) {
                        return "valid";
                    }
                    return "invalid";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. Numeric & String Concatenation Operators (+, -, *, /, %, +)
    // =========================================================================
    suite('Numeric & String Operators - Arithmetic and Concatenation', () => {
        suite('Positive', () => {
            test('Standard arithmetic operations and string concatenation with +', () => {
                const diags = lintText(`
                    sum = 12 + 12;
                    diff = 15 - 12;
                    prod = 15 * 12;
                    quot = 15 / 12;
                    rem = 15 % 12;
                    msg = "Total: " + string(sum) + " USD";
                    return msg;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Missing operand in arithmetic expression → syntax error', () => {
                const diags = lintText('x = 10 + ; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Complex compound mathematical expressions with operator precedence', () => {
                const diags = lintText('val = (3 * 3) + (4 * 4) - (10 / 2) + (25 % 4); return string(val);');
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. Return Statement Requirements (Mandatory return, return "";)
    // =========================================================================
    suite('Return Statements - Mandatory return handling in BML', () => {
        suite('Positive', () => {
            test('Valid return statement terminating script', () => {
                const diags = lintText('res = "success"; return res;');
                assert.strictEqual(diags.find(d => d.code === 'bml-missing-return'), undefined);
            });

            test('return ""; returning empty string', () => {
                const diags = lintText('print("debugging info"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-missing-return'), undefined);
            });
        });

        suite('Negative', () => {
            test('Script missing return statement → flags warning/error', () => {
                const diags = lintText('x = 100; y = 200;');
                assert.ok(diags.find(d => d.code === 'bml-missing-return' || d.code === 'bml-syntax-error') || diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Multiple branches returning values', () => {
                const diags = lintText(`
                    flag = true;
                    if (flag) {
                        return "True branch";
                    } else {
                        return "False branch";
                    }
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. Statement Terminators & Comments (; and //)
    // =========================================================================
    suite('Statement Terminators & Comments - Semicolons and Comment lines', () => {
        suite('Positive', () => {
            test('Statements terminated with semicolons and documented with // comments', () => {
                const diags = lintText(`
                    // Header comment explaining function purpose
                    sku = "PART-99"; // Key part identifier
                    /* Multi-line block comment */
                    qty = 5;
                    return sku;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Missing semicolon at end of statement → flags syntax error', () => {
                const diags = lintText('x = 100\nreturn "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Comments with special characters and embedded code fragments', () => {
                const diags = lintText(`
                    // TODO: check if (x == 100) { return ""; }
                    // Special symbols: @#$%^&*()_+-=[]{}|;':",.<>/?
                    res = "OK";
                    return res;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });
});
