const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - All String Functions', () => {
    test('atof() expects String, flags Integer argument', () => {
        const diags = lintText('x = atof(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to atof()');
    });

    test('atoi() expects String, flags Float argument', () => {
        const diags = lintText('x = atoi(123.4); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to atoi()');
    });

    test('decodebase64() expects String, flags Integer argument', () => {
        const diags = lintText('x = decodebase64(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to decodebase64()');
    });

    test('encodebase64() expects String, flags Date argument', () => {
        const diags = lintText('dt = getdate(); x = encodebase64(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to encodebase64()');
    });

    test('endswith() expects String (p1 & p2), flags Integer (p1)', () => {
        const diags = lintText('x = endswith(123, "3"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to endswith() arg 1');
    });

    test('formatascurrency() expects Float (p1), flags String (p1)', () => {
        const diags = lintText('s = "100"; c = formatascurrency(s, "USD"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to formatascurrency() expecting Float');
    });

    test('find() expects String (p1 & p2), flags Float (p1)', () => {
        const diags = lintText('f = 12.34; x = find(f, "3"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to find() arg 1');
    });

    test('getcurrencyvalue() expects String (p1), flags Integer (p1)', () => {
        const diags = lintText('c = getcurrencyvalue(100); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to getcurrencyvalue()');
    });

    test('html() expects String, flags Date argument', () => {
        const diags = lintText('dt = getdate(); x = html(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to html()');
    });

    test('isnumber() expects String, flags Boolean argument', () => {
        const diags = lintText('x = isnumber(true); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Boolean to isnumber()');
    });

    test('join() expects String[] (p1) and String (p2), flags String (p1)', () => {
        const diags = lintText('s = "abc"; x = join(s, ","); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to join() expecting String[]');
    });

    test('len() expects String, flags Date argument', () => {
        const diags = lintText('d = getdate(); x = len(d); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to len()');
    });

    test('lower() expects String, flags Integer argument', () => {
        const diags = lintText('x = lower(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to lower()');
    });

    test('replace() expects String (p1, p2, p3), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); x = replace(dt, "a", "b"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to replace() arg 1');
    });

    test('split() expects String (p1) and String (p2), flags Float[] (p1)', () => {
        const diags = lintText('floatArr = float[5]; res = split(floatArr, ","); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing float[] to split() expecting String');
    });

    test('startswith() expects String (p1 & p2), flags Integer (p1)', () => {
        const diags = lintText('x = startswith(123, "1"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to startswith() arg 1');
    });

    test('string() accepts Float, Integer, or Boolean, flags Date argument', () => {
        const diags = lintText('dt = getdate(); x = string(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to string() conversion function');
    });

    test('substring() expects String (p1) and Integer (p2/p3), flags Boolean (p1)', () => {
        const diags = lintText('b = true; s = substring(b, 1); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Boolean to substring() arg 1');
    });

    test('trim() expects String, flags Integer argument', () => {
        const diags = lintText('x = trim(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to trim()');
    });

    test('upper() expects String, flags Boolean argument', () => {
        const diags = lintText('x = upper(false); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Boolean to upper()');
    });

    test('Valid String operations raise no false positives', () => {
        const diags = lintText(`
            s1 = atof("12.3");
            s2 = atoi("123");
            b1 = decodebase64("abc");
            b2 = encodebase64("xyz");
            ew = endswith("hello", "o");
            f = find("hello", "e");
            c = formatascurrency(100.0, "USD");
            val = getcurrencyvalue("$100");
            h = html("<tag>");
            n = isnumber("123");
            arr = string[2];
            j = join(arr, ",");
            l = len("str");
            lw = lower("ABC");
            rep = replace("abc", "a", "x");
            sp = split("a,b", ",");
            sw = startswith("hello", "h");
            st = string(123);
            sub = substring("hello", 0, 2);
            tr = trim(" abc ");
            up = upper("abc");
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
    });
});
