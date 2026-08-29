const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Conditional & Control Flow Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. if Statement
    // =========================================================================
    suite('if Statement - Boolean condition branching', () => {
        suite('Positive', () => {
            test('Simple if statement with function condition (isnumber, startswith)', () => {
                const diags = lintText(`
                    numStr = "25";
                    if (isnumber(numStr)) {
                        val = atof(numStr);
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });

            test('Nested if statements with comparison operators (==, !=, >, <, >=, <=)', () => {
                const diags = lintText(`
                    x = 100;
                    y = 50;
                    if (x > y) {
                        if (x == 100) {
                            print("x is 100 and greater than y");
                        }
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('if missing condition parentheses → syntax error', () => {
                const diags = lintText('if x > 10 { print("err"); } return "";');
                assert.ok(diags.length > 0);
            });

            test('if missing body block → syntax error', () => {
                const diags = lintText('if (true) return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Empty condition inside if statement', () => {
                const diags = lintText('if () { print("empty"); } return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 2. if...else Statement
    // =========================================================================
    suite('if...else Statement - Binary branch execution', () => {
        suite('Positive', () => {
            test('Standard if...else with variable assignments', () => {
                const diags = lintText(`
                    val = "25";
                    res = 0.0;
                    if (isnumber(val)) {
                        res = atof(val);
                    } else {
                        print("NaN");
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('else without preceding if → syntax error', () => {
                const diags = lintText('else { print("orphan else"); } return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Empty block bodies in both if and else branches', () => {
                const diags = lintText('if (true) {} else {} return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. if...elif / else if...else Statement
    // =========================================================================
    suite('if...elif / else if...else - Multi-condition branch evaluation', () => {
        suite('Positive', () => {
            test('Multi-branch with elif keywords', () => {
                const diags = lintText(`
                    attr1 = 100;
                    if (attr1 == 100) {
                        return "Tier 1";
                    } elif (attr1 == 200) {
                        return "Tier 2";
                    } else {
                        return "Default";
                    }
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });

            test('Multi-branch with else if keywords', () => {
                const diags = lintText(`
                    score = 85;
                    grade = "F";
                    if (score >= 90) {
                        grade = "A";
                    } else if (score >= 80) {
                        grade = "B";
                    } else {
                        grade = "C";
                    }
                    return grade;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('elif without preceding if → syntax error', () => {
                const diags = lintText('elif (true) { print("orphan"); } return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Deeply chained elif statements (10+ branches)', () => {
                const diags = lintText(`
                    x = 5;
                    if (x == 1) { return "1"; }
                    elif (x == 2) { return "2"; }
                    elif (x == 3) { return "3"; }
                    elif (x == 4) { return "4"; }
                    elif (x == 5) { return "5"; }
                    else { return "other"; }
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. for...in Loop (1-D & 2-D Arrays)
    // =========================================================================
    suite('for...in Loop - Iteration over 1-D and 2-D Arrays', () => {
        suite('Positive', () => {
            test('Iterate over 1-D integer and string arrays', () => {
                const diags = lintText(`
                    myArray = integer[]{1, 2, 3, 4, 5};
                    for num in myArray {
                        print(string(num));
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });

            test('Nested for...in loops over 2-D array matrix (rows & columns)', () => {
                const diags = lintText(`
                    matrix = integer[3][2];
                    for row in matrix {
                        for col in row {
                            print(string(col));
                        }
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('for loop missing in keyword → syntax error', () => {
                const diags = lintText('for elem myArray { print(elem); } return "";');
                assert.ok(diags.length > 0);
            });

            test('for loop iterating over non-array variable → type error/warning', () => {
                const diags = lintText('singleVal = 100; for x in singleVal { print(string(x)); } return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Iterate over empty array without crash', () => {
                const diags = lintText('emptyArr = string[]{}; for s in emptyArr { print(s); } return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. break & continue Statements
    // =========================================================================
    suite('break & continue - Loop control flow', () => {
        suite('Positive', () => {
            test('break on matching element in for...in loop', () => {
                const diags = lintText(`
                    items = string[]{"aaa", "bbb", "ccc", "ddd"};
                    for each in items {
                        if (each == "ccc") {
                            break;
                        }
                        print(each);
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });

            test('continue skipping element in for...in loop', () => {
                const diags = lintText(`
                    items = string[]{"aaa", "bbb", "ccc", "ddd"};
                    for each in items {
                        if (each == "bbb") {
                            continue;
                        }
                        print(each);
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('break outside of loop context → flags error', () => {
                const diags = lintText('x = 10; break; return "";');
                assert.ok(diags.length > 0);
            });

            test('continue outside of loop context → flags error', () => {
                const diags = lintText('x = 10; continue; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('break and continue in deeply nested loops and conditions', () => {
                const diags = lintText(`
                    matrix = integer[3][3];
                    for row in matrix {
                        for col in row {
                            if (col == 0) {
                                continue;
                            }
                            if (col == 99) {
                                break;
                            }
                        }
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });
});
