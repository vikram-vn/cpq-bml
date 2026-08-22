const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - All Date Functions', () => {
    test('adddays() expects Date (p1) and Integer (p2), flags String (p1)', () => {
        const diags = lintText('s = "2026-01-01"; d = adddays(s, 5); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to adddays() arg 1');
    });

    test('adddays() expects Integer (p2), flags String (p2)', () => {
        const diags = lintText('dt = getdate(); d = adddays(dt, "five"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to adddays() arg 2');
    });

    test('addmonths() expects Date (p1) and Integer (p2), flags Float (p1)', () => {
        const diags = lintText('f = 10.5; d = addmonths(f, 3); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to addmonths() arg 1');
    });

    test('comparedates() expects Date (p1 & p2), flags String (p1)', () => {
        const diags = lintText('res = comparedates("2026-01-01", getdate()); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to comparedates() arg 1 expecting Date');
    });

    test('datetostr() expects Date (p1), flags String (p1)', () => {
        const diags = lintText('s = "2026-01-01"; str = datetostr(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to datetostr() arg 1');
    });

    test('getcurrenttimeinmillis() takes no arguments, flags unexpected argument count', () => {
        const diags = lintText('res = getcurrenttimeinmillis("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-count');
        assert.ok(err, 'Should flag passing argument to getcurrenttimeinmillis()');
    });

    test('getdate() expects Boolean (p1), flags String (p1)', () => {
        const diags = lintText('res = getdate("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to getdate() arg 1');
    });

    test('getdiffindays() expects Date (p1 & p2), flags String (p1)', () => {
        const diags = lintText('res = getdiffindays("2026-01-01", getdate()); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to getdiffindays() arg 1');
    });

    test('getstrdate() takes no arguments, flags unexpected argument count', () => {
        const diags = lintText('res = getstrdate("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-count');
        assert.ok(err, 'Should flag passing argument to getstrdate()');
    });

    test('isleap() expects Integer (p1), flags String (p1)', () => {
        const diags = lintText('s = "2026"; res = isleap(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to isleap() expecting Integer');
    });

    test('isweekend() expects Date (p1), flags Integer (p1)', () => {
        const diags = lintText('i = 2026; res = isweekend(i); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to isweekend() expecting Date');
    });

    test('minusdays() expects Date (p1) and Integer (p2), flags String (p1)', () => {
        const diags = lintText('s = "2026-01-01"; d = minusdays(s, 5); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to minusdays() arg 1 expecting Date');
    });

    test('strtodate() expects String (p1) and String (p2), flags Integer (p1)', () => {
        const diags = lintText('res = strtodate(12345, "MM/dd/yyyy"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to strtodate() arg 1');
    });

    test('strtojavadate() expects String (p1) and String (p2), flags Boolean (p1)', () => {
        const diags = lintText('res = strtojavadate(true, "MM/dd/yyyy"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Boolean to strtojavadate() arg 1');
    });

    test('Valid Date operations raise no false positives', () => {
        const diags = lintText(`
            d = getdate();
            d1 = adddays(d, 5);
            d2 = addmonths(d, 2);
            d3 = minusdays(d, 3);
            cmp = comparedates(d1, d2);
            diff = getdiffindays(d1, d2);
            s = datetostr(d1);
            leap = isleap(2024);
            wk = isweekend(d);
            ms = getcurrenttimeinmillis();
            st = getstrdate();
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
});
