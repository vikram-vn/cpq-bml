const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Array Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // ==========================================
    // 1. append(array, element)
    // ==========================================
    suite('append() - Attach element to array', () => {
        suite('Positive', () => {
            test('Appends element to String[] array returning Integer length', () => {
                const diags = lintText(`
                    arr = string[]{"A", "B"};
                    len = append(arr, "C");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Appends to Integer[], Float[], Boolean[], and Date[] arrays', () => {
                const diags = lintText(`
                    iArr = integer[]{1, 2}; append(iArr, 3);
                    fArr = float[]{1.1, 2.2}; append(fArr, 3.3);
                    bArr = boolean[]{true}; append(bArr, false);
                    dArr = date[]{getdate()}; append(dArr, getdate());
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Appends with expression and variable arguments', () => {
                const diags = lintText(`
                    arr = string[]{"A"};
                    elem = "B" + "C";
                    append(arr, elem);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Multi-line call with inline comments', () => {
                const diags = lintText(`
                    arr = string[]{"A"};
                    append(
                        /* target array */ arr,
                        /* new element */ "B"
                    );
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('append(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('1 argument (missing element) → Error', () => {
                const diags = lintText('arr = string[]{"a"}; append(arr); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess parameter) → Error', () => {
                const diags = lintText('arr = string[]{"a"}; append(arr, "b", "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → bml-trailing-comma-error', () => {
                const diags = lintText('arr = string[]{"a"}; append(arr, "b", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });

            test('Append on 2-D array → flags bml-array-dimension-error', () => {
                const diags = lintText('arr = string[2][2]; append(arr, string[]{"x"}); return "";');
                assert.ok(diags.find(d => d.code === 'bml-array-dimension-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty string element does not crash linter', () => {
                const diags = lintText('arr = string[]{}; append(arr, ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Keyword identifier collision recovery', () => {
                const diags = lintText('append(return, break); return "";');
                assert.ok(diags.length > 0);
            });

            test('Illegal assignment target to append() call', () => {
                const diags = lintText('arr = string[]{}; append(arr, "x") = 5; return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // ==========================================
    // 2. findinarray(array, element)
    // ==========================================
    suite('findinarray() - Search element in array', () => {
        suite('Positive', () => {
            test('Finds element in 1-D array returning index', () => {
                const diags = lintText(`
                    arr = string[]{"apple", "banana"};
                    idx = findinarray(arr, "banana");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Finds with integer, float, and date element types', () => {
                const diags = lintText(`
                    iArr = integer[]{10, 20, 30}; iIdx = findinarray(iArr, 20);
                    fArr = float[]{1.5, 2.5}; fIdx = findinarray(fArr, 1.5);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → Error', () => {
                const diags = lintText('findinarray(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument → Error', () => {
                const diags = lintText('arr = string[]{"a"}; findinarray(arr); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments → Error', () => {
                const diags = lintText('arr = string[]{"a"}; findinarray(arr, "a", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('findinarray() on 2-D array → flags bml-array-dimension-error', () => {
                const diags = lintText('arr = integer[2][2]; idx = findinarray(arr, 1); return "";');
                assert.ok(diags.find(d => d.code === 'bml-array-dimension-error'));
            });
        });

        suite('Destructive', () => {
            test('Semicolon delimiter recovery', () => {
                const diags = lintText('arr = string[]{"a"}; findinarray(arr; "a"); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // ==========================================
    // 3. sizeofarray(array)
    // ==========================================
    suite('sizeofarray() - Get array length', () => {
        suite('Positive', () => {
            test('1-D array size', () => {
                const diags = lintText('arr = string[]{"a", "b"}; sz = sizeofarray(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2-D array size (row count) - valid without dimension error', () => {
                const diags = lintText('arr = string[3][4]; sz = sizeofarray(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-array-dimension-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → Error', () => {
                const diags = lintText('sz = sizeofarray(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments → Error', () => {
                const diags = lintText('arr = string[]{"a"}; sz = sizeofarray(arr, "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // ==========================================
    // 4. sort(array [, order [, type]])
    // ==========================================
    suite('sort() - In-place array sorting', () => {
        suite('Positive', () => {
            test('1 argument: sort(arr)', () => {
                const diags = lintText('arr = string[]{"b", "a"}; sort(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: sort(arr, "desc")', () => {
                const diags = lintText('arr = integer[]{3, 1, 2}; sort(arr, "desc"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: sort(arr, "asc", "text")', () => {
                const diags = lintText('arr = string[]{"10", "2"}; sort(arr, "asc", "text"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments on Date[] array: sort(arr, "asc", "date")', () => {
                const diags = lintText('arr = date[]{getdate()}; sort(arr, "asc", "date"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-sort-date-type-mismatch'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → Error', () => {
                const diags = lintText('sort(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments → Error', () => {
                const diags = lintText('arr = string[]{"a"}; sort(arr, "asc", "text", "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Invalid sortOrder literal → flags bml-sort-invalid-order', () => {
                const diags = lintText('arr = string[]{"a"}; sort(arr, "invalid_order"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-sort-invalid-order'));
            });

            test('Invalid sortType literal → flags bml-sort-invalid-type', () => {
                const diags = lintText('arr = string[]{"a"}; sort(arr, "asc", "invalid_type"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-sort-invalid-type'));
            });

            test('SortType "date" on non-date array → flags bml-sort-date-type-mismatch', () => {
                const diags = lintText('arr = string[]{"2026-01-01"}; sort(arr, "asc", "date"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-sort-date-type-mismatch'));
            });

            test('sort() on 2-D array → flags bml-sort-array-dimension', () => {
                const diags = lintText('arr = string[2][2]; sort(arr); return "";');
                assert.ok(diags.find(d => d.code === 'bml-sort-array-dimension'));
            });
        });
    });

    // ==========================================
    // 5. reverse(array), remove(array, index), isempty(array), range(n)
    // ==========================================
    suite('reverse(), remove(), isempty(), range()', () => {
        suite('Positive', () => {
            test('reverse(arr) on 1-D array', () => {
                const diags = lintText('arr = string[]{"a", "b"}; rev = reverse(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('remove(arr, 0) removes element at index', () => {
                const diags = lintText('arr = integer[]{10, 20, 30}; res = remove(arr, 1); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('isempty(arr) checks empty array', () => {
                const diags = lintText('arr = string[]{}; e = isempty(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('range(5) generates sequence [0, 1, 2, 3, 4]', () => {
                const diags = lintText('for i in range(5) { print(string(i)); } return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('reverse() on 2-D array → flags bml-array-dimension-error', () => {
                const diags = lintText('arr = float[2][2]; rev = reverse(arr); return "";');
                assert.ok(diags.find(d => d.code === 'bml-array-dimension-error'));
            });

            test('remove() missing index argument → Error', () => {
                const diags = lintText('arr = integer[]{1}; remove(arr); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // ==========================================
    // 6. bytearray(content [, charset]), max(arr), min(arr)
    // ==========================================
    suite('bytearray(), max(), min()', () => {
        suite('Positive', () => {
            test('bytearray with 1 and 2 arguments', () => {
                const diags = lintText('b1 = bytearray("data"); b2 = bytearray("data", "UTF-8"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('max(arr) and min(arr) on numeric array', () => {
                const diags = lintText('arr = float[]{2.5, 9.8, 1.2}; mx = max(arr); mn = min(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // ==========================================
    // 7. Array declarations & Negative indexing
    // ==========================================
    suite('Array declarations & Negative Indexing', () => {
        test('1-D and 2-D declarations across all types', () => {
            const diags = lintText(`
                s1 = string[5]; s2 = string[2][2];
                i1 = integer[10]; i2 = integer[3][3];
                f1 = float[4]; f2 = float[2][2];
                b1 = boolean[2]; b2 = boolean[2][2];
                d1 = date[1]; d2 = date[2][2];
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-unknown-variable'), undefined);
        });

        test('Negative indexing arr[-1] flags bml-array-negative-index', () => {
            const diags = lintText('arr = string[]{"a", "b"}; x = arr[-1]; return "";');
            assert.ok(diags.find(d => d.code === 'bml-array-negative-index'));
        });

        test('Valid indexing arr[0] and arr[1] pass without error', () => {
            const diags = lintText('arr = string[]{"a", "b"}; x = arr[0]; y = arr[1]; return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-array-negative-index'), undefined);
        });
    });
});
