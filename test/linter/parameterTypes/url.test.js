const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - All URL Access Functions', () => {
    test('makeurlparam() expects Dictionary (p1), flags String (p1)', () => {
        const diags = lintText('s = "not_dict"; res = makeurlparam(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to makeurlparam() arg 1 expecting Dictionary');
    });

    test('urldata() expects String for URL (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = urldata(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to urldata() arg 1 expecting String URL');
    });

    test('urldatabyget() expects String (p1, p2, p3), flags Integer (p1)', () => {
        const diags = lintText('res = urldatabyget(123, "a=1", "default"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to urldatabyget() arg 1 expecting String URL');
    });

    test('urldatabypost() expects String (p1, p2, p3), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = urldatabypost(dt, "a=1", "default"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to urldatabypost() arg 1 expecting String URL');
    });

    test('urldatabypostasync() expects String (p1, p2, p3, p4), flags Float (p1)', () => {
        const diags = lintText('f = 12.3; res = urldatabypostasync(f, "a=1", "default", "action"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to urldatabypostasync() arg 1 expecting String URL');
    });

    test('urlmultipartbypost() expects String (p1) and String payload (p2), flags Integer (p1)', () => {
        const diags = lintText('res = urlmultipartbypost(123, "body"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to urlmultipartbypost() arg 1 expecting String URL');
    });

    test('Valid URL access operations raise no false positives', () => {
        const diags = lintText(`
            d = dict("string");
            p = makeurlparam(d);
            r1 = urldata("http://example.com", "GET");
            r2 = urldatabyget("http://example.com", "a=1", "err");
            r3 = urldatabypost("http://example.com", "a=1", "err");
            r4 = urldatabypostasync("http://example.com", "a=1", "err", "myAction");
            r5 = urlmultipartbypost("http://example.com", "body");
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
    });
});
