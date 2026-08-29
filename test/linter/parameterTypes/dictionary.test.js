const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - All Dictionary & Global Dictionary Functions', () => {
    test('put() expects Dictionary (p1), flags String variable', () => {
        const diags = lintText('str = "not_dict"; put(str, "key", "val"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to put() arg 1 expecting Dictionary');
    });

    test('get() expects Dictionary (p1), flags Integer variable', () => {
        const diags = lintText('i = 10; val = get(i, "key"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to get() arg 1 expecting Dictionary');
    });

    test('containskey() expects Dictionary (p1), flags Float variable', () => {
        const diags = lintText('f = 99.9; res = containskey(f, "key"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to containskey() arg 1 expecting Dictionary');
    });

    test('keys() expects Dictionary (p1), flags String variable', () => {
        const diags = lintText('s = "str"; k = keys(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to keys() arg 1 expecting Dictionary');
    });

    test('values() expects Dictionary (p1), flags String variable', () => {
        const diags = lintText('s = "str"; v = values(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to values() arg 1 expecting Dictionary');
    });

    test('remove() expects Dictionary (p1), flags String variable', () => {
        const diags = lintText('s = "str"; remove(s, "key"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to remove() arg 1 expecting Dictionary');
    });

    test('clear() expects Dictionary (p1), flags String variable', () => {
        const diags = lintText('s = "str"; clear(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to clear() arg 1 expecting Dictionary');
    });

    test('size() expects Dictionary (p1), flags String variable', () => {
        const diags = lintText('s = "str"; res = size(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to size() arg 1 expecting Dictionary');
    });

    test('globaldictget() expects String key (p1), flags Date argument', () => {
        const diags = lintText('dt = getdate(); res = globaldictget(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to globaldictget() arg 1 expecting String');
    });

    test('globaldictremove() expects String key (p1), flags Integer argument', () => {
        const diags = lintText('res = globaldictremove(12345); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to globaldictremove() arg 1 expecting String');
    });

    test('globaldictset() expects String key (p1) and String value (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = globaldictset(dt, "val"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to globaldictset() arg 1 expecting String');
    });

    test('Valid Dictionary & Global Dictionary operations raise no false positives', () => {
        const diags = lintText(`
            d = dict("string");
            put(d, "k1", "v1");
            v = get(d, "k1");
            ck = containskey(d, "k1");
            ks = keys(d);
            vs = values(d);
            remove(d, "k1");
            sz = size(d);
            clear(d);
            gset = globaldictset("gk1", "gv1");
            gget = globaldictget("gk1");
            grem = globaldictremove("gk1");
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
    });
});
