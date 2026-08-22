const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - Array Functions & Array Declarations', () => {

    test('append() expects Array (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "not_array"; append(s, "elem"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to append() arg 1');
    });

    test('findinarray() expects Array (p1), flags non-array Float (p1)', () => {
        const diags = lintText('f = 12.34; idx = findinarray(f, "search"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array Float to findinarray() arg 1');
    });

    test('isempty() expects Array (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "not_array"; res = isempty(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to isempty() arg 1');
    });

    test('max() expects Array (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "not_array"; res = max(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to max() arg 1');
    });

    test('min() expects Array (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "not_array"; res = min(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to min() arg 1');
    });

    test('range() expects Integer (p1), flags String (p1)', () => {
        const diags = lintText('s = "5"; arr = range(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to range() arg 1 expecting Integer');
    });

    test('remove() expects Array (p1) and Integer index (p2), flags String (p2)', () => {
        const diags = lintText('arr = string[5]; remove(arr, "first"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String index to remove() arg 2 expecting Integer');
    });

    test('reverse() expects Array (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "not_array"; res = reverse(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to reverse() arg 1');
    });

    test('sizeofarray() expects Array (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); sz = sizeofarray(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to sizeofarray() arg 1');
    });

    test('sort() expects Array (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "not_array"; res = sort(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to sort() arg 1');
    });

    test('join() expects String[] (p1) and String (p2), flags non-array String (p1)', () => {
        const diags = lintText('s = "abc"; x = join(s, ","); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to join() expecting String[]');
    });

    test('split() expects String (p1) and String (p2), flags Float[] (p1)', () => {
        const diags = lintText('floatArr = float[5]; res = split(floatArr, ","); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing float[] to split() expecting String');
    });

    test('Valid array operations raise no false positives', () => {
        const diags = lintText(`
            arr = string[5];
            append(arr, "elem");
            idx = findinarray(arr, "elem");
            e = isempty(arr);
            sz = sizeofarray(arr);
            sorted = sort(arr);
            reversed = reverse(arr);
            remove(arr, 0);
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
    });

});
