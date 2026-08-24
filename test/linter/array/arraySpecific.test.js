const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Array Specific & Edge Tests', () => {
    suite('append() - requires 2 arguments (array, element)', () => {
        test('append() - zero args → Error', () => {
            const diags = lintText('append(); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('append(arr) - 1 arg → Error', () => {
            const diags = lintText('arr = string[]{"a"}; append(arr); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
        });

        test('append(arr, elem) - correct 2 args → no error', () => {
            const diags = lintText('arr = string[]{"a"}; res = append(arr, "b"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('append(arr, elem, extra) - 3 args → Error', () => {
            const diags = lintText('arr = string[]{"a"}; append(arr, "b", "c"); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
        });

        test('append(arr, ) - trailing comma → bml-trailing-comma-error', () => {
            const diags = lintText('arr = string[]{"a"}; append(arr, "b", ); return "";');
            assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
        });

        test('append() on 2-D array → bml-array-dimension-error', () => {
            const diags = lintText('arr = string[2][2]; append(arr, string[]{"x"}); return "";');
            assert.ok(diags.find(d => d.code === 'bml-array-dimension-error'));
        });
    });

    suite('findinarray() - requires 2 arguments (array, element)', () => {
        test('findinarray(arr, elem) - correct 2 args → no error', () => {
            const diags = lintText('arr = integer[]{1, 2, 3}; idx = findinarray(arr, 2); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('findinarray() on 2-D array → bml-array-dimension-error', () => {
            const diags = lintText('arr = integer[2][2]; idx = findinarray(arr, 1); return "";');
            assert.ok(diags.find(d => d.code === 'bml-array-dimension-error'));
        });
    });

    suite('sizeofarray() - 1 argument (1-D or 2-D array)', () => {
        test('sizeofarray(arr) on 1-D array → no error', () => {
            const diags = lintText('arr = float[]{1.0, 2.5}; sz = sizeofarray(arr); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sizeofarray(arr) on 2-D array → valid (no dimension error)', () => {
            const diags = lintText('arr = string[3][4]; sz = sizeofarray(arr); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-array-dimension-error'), undefined);
        });
    });

    suite('sort() - 1 to 3 arguments (array [, order [, type]])', () => {
        test('sort(arr) - valid 1 arg', () => {
            const diags = lintText('arr = string[]{"b", "a"}; sort(arr); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sort(arr, "desc") - valid 2 args', () => {
            const diags = lintText('arr = string[]{"b", "a"}; sort(arr, "desc"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sort(arr, "asc", "text") - valid 3 args', () => {
            const diags = lintText('arr = string[]{"b", "a"}; sort(arr, "asc", "text"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sort(arr, "invalid") - invalid sort order flags error', () => {
            const diags = lintText('arr = string[]{"b", "a"}; sort(arr, "invalid"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-sort-invalid-order'));
        });

        test('sort(arr, "asc", "invalid") - invalid sort type flags error', () => {
            const diags = lintText('arr = string[]{"b", "a"}; sort(arr, "asc", "invalid"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-sort-invalid-type'));
        });

        test('sort(arr, "asc", "date") on non-date array flags error', () => {
            const diags = lintText('arr = string[]{"2026-01-01"}; sort(arr, "asc", "date"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-sort-date-type-mismatch'));
        });

        test('sort(arr) on 2-D array flags dimension error', () => {
            const diags = lintText('arr = string[2][2]; sort(arr); return "";');
            assert.ok(diags.find(d => d.code === 'bml-sort-array-dimension'));
        });
    });

    suite('reverse() & isempty() & range()', () => {
        test('reverse(arr) on 1-D array is valid', () => {
            const diags = lintText('arr = string[]{"x", "y"}; rev = reverse(arr); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('reverse(arr) on 2-D array flags dimension error', () => {
            const diags = lintText('arr = float[2][2]; rev = reverse(arr); return "";');
            assert.ok(diags.find(d => d.code === 'bml-array-dimension-error'));
        });

        test('isempty(arr) on array is valid', () => {
            const diags = lintText('arr = integer[]{}; res = isempty(arr); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('range(5) integer argument is valid', () => {
            const diags = lintText('r = range(5); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });

    suite('Array indexing & initialization edge cases', () => {
        test('Negative indexing on array variable flags bml-array-negative-index', () => {
            const diags = lintText('arr = string[]{"a", "b"}; x = arr[-1]; return "";');
            assert.ok(diags.find(d => d.code === 'bml-array-negative-index'));
        });

        test('Valid positive indexing arr[0] and arr[1] raise no error', () => {
            const diags = lintText('arr = string[]{"a", "b"}; x = arr[0]; y = arr[1]; return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-array-negative-index'), undefined);
        });
    });
});
