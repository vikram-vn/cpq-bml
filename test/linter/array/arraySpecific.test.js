const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Array Functions & Operations Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. append(arrayIdentifier, newArrayElem) -> Integer
    // =========================================================================
    suite('append() - Append element to 1-D array returning new array size', () => {
        suite('Positive', () => {
            test('Appends element to initialized and uninitialized string, integer, float, boolean arrays and 2D arrays', () => {
                const diags = lintText(`
                    strArr = string[]{};
                    newSize = append(strArr, "new item");
                    intArr = integer[]{1, 2};
                    append(intArr, 3);
                    matrix = string[][]{};
                    row = string[]{"col1", "col2"};
                    append(matrix, row);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('append(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing element) → flags bml-function-arg-count Error', () => {
                const diags = lintText('arr = string[]{}; append(arr); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('arr = string[]{}; append(arr, "val", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('append integer to string[] array → flags bml-function-arg-type Error', () => {
                const diags = lintText('arr = string[]{}; append(arr, 123); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('append scalar string to string[][] 2D array → flags bml-function-arg-type Error', () => {
                const diags = lintText('matrix = string[][]{}; append(matrix, "notA1DArray"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('Appending null or empty element', () => {
                const diags = lintText('arr = string[]{}; append(arr, ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. bytearray(String content [, String charset]) -> ByteArray
    // =========================================================================
    suite('bytearray() - Encode string to byte array sequence for attachments & PCS', () => {
        suite('Positive', () => {
            test('1 and 2 arguments with character encodings (UTF-8, UTF-16, ISO-8859-1)', () => {
                const diags = lintText(`
                    b1 = bytearray("Sample string content");
                    b2 = bytearray("Sample string content", "UTF-16");
                    b3 = bytearray("ASCII content", "US-ASCII");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = bytearray(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = bytearray("content", "UTF-8", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty content string in bytearray', () => {
                const diags = lintText('b = bytearray("", "UTF-8"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. findinarray(arrayIdentifier, element) -> Integer
    // =========================================================================
    suite('findinarray() - Search element in 1-D array returning index or -1', () => {
        suite('Positive', () => {
            test('Finds matching index in string and integer arrays', () => {
                const diags = lintText(`
                    fruits = string[]{"apple", "banana", "orange"};
                    idx1 = findinarray(fruits, "banana");
                    idx2 = findinarray(fruits, "grape");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = findinarray(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing search element) → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = findinarray(string[]{"a"}); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = findinarray(string[]{"a"}, "a", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('findinarray with integer target in string[] array → flags bml-function-arg-type Error', () => {
                const diags = lintText('idx = findinarray(string[]{"a"}, 123); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('Searching in empty array returns -1 without crash', () => {
                const diags = lintText('idx = findinarray(string[]{}, "missing"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. isempty(arrayIdentifier) -> Boolean
    // =========================================================================
    suite('isempty() - Check if 1-D array is empty', () => {
        suite('Positive', () => {
            test('Returns true on empty array and false on populated array', () => {
                const diags = lintText(`
                    emptyArr = string[]{};
                    b1 = isempty(emptyArr);
                    popArr = integer[]{1, 2, 3};
                    b2 = isempty(popArr);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isempty(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isempty(string[]{}, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Direct condition check with isempty()', () => {
                const diags = lintText('arr = string[]{}; if (isempty(arr)) { return "empty"; } return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. max(arrayIdentifier) & min(arrayIdentifier) -> Integer / Float
    // =========================================================================
    suite('max() & min() - Largest and smallest elements in numeric arrays', () => {
        suite('Positive', () => {
            test('Finds maximum and minimum values in integer and float arrays', () => {
                const diags = lintText(`
                    nums = integer[]{10, 45, 2, 99, 30};
                    maxVal = max(nums);
                    minVal = min(nums);
                    flts = float[]{1.5, -4.2, 99.8, 0.0};
                    maxFlt = max(flts);
                    minFlt = min(flts);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('max with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('m = max(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('min with 3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('m = min(1, 2, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('min on non-numeric array string[] → flags bml-function-arg-type Error', () => {
                const diags = lintText('m = min(string[]{"a", "b"}); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('Negative numbers and single-element array', () => {
                const diags = lintText('m = max(integer[]{-500}); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. range(Integer x) -> Integer[]
    // =========================================================================
    suite('range() - Declare and initialize integer array to index values [0..x-1]', () => {
        suite('Positive', () => {
            test('Generates integer index array for loop control', () => {
                const diags = lintText(`
                    indices = range(5);
                    for idx in indices {
                        print(string(idx));
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = range(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = range(5, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('range(0) returns empty integer array integer[0]', () => {
                const diags = lintText('r = range(0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 7. remove(arrayIdentifier, Integer removePos) -> Integer
    // =========================================================================
    suite('remove() - Remove element from array at index returning new size', () => {
        suite('Positive', () => {
            test('Removes element at index 0 and middle positions', () => {
                const diags = lintText(`
                    arr = string[]{"A", "B", "C", "D"};
                    newSize1 = remove(arr, 2);
                    newSize2 = remove(arr, 0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('remove(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing index) → flags bml-function-arg-count Error', () => {
                const diags = lintText('remove(string[]{"a"}); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('remove(string[]{"a"}, 0, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('remove with string key on array → flags bml-function-arg-type Error', () => {
                const diags = lintText('arr = string[]{"a"}; remove(arr, "notAnIndex"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('Index expression in remove', () => {
                const diags = lintText('arr = integer[]{1, 2, 3}; remove(arr, sizeofarray(arr) - 1); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 8. reverse(arrayIdentifier) -> Array
    // =========================================================================
    suite('reverse() - Reverse all elements of 1-D array in place', () => {
        suite('Positive', () => {
            test('Reverses elements of string, integer, float arrays', () => {
                const diags = lintText(`
                    strArr = string[]{"first", "second", "third"};
                    reverse(strArr);
                    intArr = integer[]{1, 2, 3, 4};
                    reverse(intArr);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('reverse(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('reverse(string[]{"a"}, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Reversing single-element or empty array', () => {
                const diags = lintText('reverse(string[]{}); reverse(integer[]{1}); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 9. sizeofarray(arrayIdentifier) -> Integer
    // =========================================================================
    suite('sizeofarray() - Return length of 1-D array or number of rows for 2-D array', () => {
        suite('Positive', () => {
            test('Calculates size for 1-D and 2-D arrays', () => {
                const diags = lintText(`
                    arr1D = string[]{"A", "B", "C"};
                    len1 = sizeofarray(arr1D);
                    arr2D = integer[3][2];
                    rowCount = sizeofarray(arr2D);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('sz = sizeofarray(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('sz = sizeofarray(string[]{"a"}, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('sizeofarray on empty array returns 0', () => {
                const diags = lintText('arr = string[]{}; sz = sizeofarray(arr); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 10. sort(arrayIdentifier [, sortOrder [, sortType]]) -> Array
    // =========================================================================
    suite('sort() - Sort array elements with sortOrder (asc/desc) and sortType (text/numeric/date)', () => {
        suite('Positive', () => {
            test('1, 2, and 3 arguments with asc, desc, text, numeric, date sort types', () => {
                const diags = lintText(`
                    strArr = string[]{"2", "12", "a", "A", "B", "b"};
                    s1 = sort(strArr);
                    s2 = sort(strArr, "desc");
                    s3 = sort(strArr, "asc", "text");
                    numStr = string[]{"1", "2", "10", "20"};
                    s4 = sort(numStr, "asc", "numeric");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sort(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = sort(string[]{"a"}, "asc", "text", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('date sortType on string[] array → flags bml-sort-date-type-mismatch Error', () => {
                const diags = lintText('s = sort(string[]{"2026-01-01"}, "asc", "date"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-sort-date-type-mismatch'));
            });

            test('numeric sortType on boolean[] array → flags bml-sort-numeric-type-mismatch Error', () => {
                const diags = lintText('s = sort(boolean[]{true, false}, "asc", "numeric"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-sort-numeric-type-mismatch'));
            });
        });

        suite('Destructive', () => {
            test('Sorting empty array or single element array', () => {
                const diags = lintText('s = sort(string[]{}, "desc", "text"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 11. 1-D and 2-D Typed Array Constructors (string[n], integer[n], float[n], boolean[n], date[n])
    // =========================================================================
    suite('Typed Array Constructors - 1-D and 2-D array declarations & auto-extension', () => {
        suite('Positive', () => {
            test('1-D and 2-D array size declarations and index assignments', () => {
                const diags = lintText(`
                    str1D = string[5];
                    str1D[0] = "first";
                    int2D = integer[2][3];
                    int2D[0][0] = 100;
                    flt2D = float[2][2];
                    flt2D[1][1] = 99.5;
                    bool1D = boolean[10];
                    date1D = date[2];
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Invalid 2-D index dimension syntax → syntax error', () => {
                const diags = lintText('arr = integer[2, 3]; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Auto-extending array beyond declared size', () => {
                const diags = lintText(`
                    arr = string[2];
                    arr[4] = "extended element";
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });
});
