const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - JSON Functions', () => {
    test('jsonarrayappend() expects JsonArray (p1), flags String variable', () => {
        const diags = lintText('test = "hello"; jsonarrayappend(test, 1); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonarrayappend() arg 1');
    });

    test('jsonarrayget() expects JsonArray (p1) and Integer (p2), flags String (p2)', () => {
        const diags = lintText('arr = jsonarray(); item = jsonarrayget(arr, "first"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonarrayget() arg 2 expecting Integer');
    });

    test('jsonarraycopy() expects JsonArray (p1), flags String (p1)', () => {
        const diags = lintText('res = jsonarraycopy("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonarraycopy() arg 1');
    });

    test('jsonarrayremove() expects JsonArray (p1) and Integer (p2), flags String (p1)', () => {
        const diags = lintText('res = jsonarrayremove("invalid", 0); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonarrayremove() arg 1');
    });

    test('jsonarraysize() expects JsonArray (p1), flags String (p1)', () => {
        const diags = lintText('res = jsonarraysize("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonarraysize() arg 1');
    });

    test('jsonget() expects Json (p1) and String (p2), flags String (p1)', () => {
        const diags = lintText('s = "not_json"; res = jsonget(s, "key"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonget() arg 1 expecting Json');
    });

    test('jsonput() expects Json (p1) and String (p2), flags String (p1)', () => {
        const diags = lintText('s = "not_json"; jsonput(s, "key", "val"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to jsonput() arg 1 expecting Json');
    });

    test('jsonpathgetsingle() expects String (p2) for JSONPath, flags Integer (p2)', () => {
        const diags = lintText('j = json(); val = jsonpathgetsingle(j, 123, "string"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to jsonpathgetsingle() arg 2 expecting String');
    });

    test('jsonpathgetmultiple() expects String (p2) for JSONPath, flags Integer (p2)', () => {
        const diags = lintText('j = json(); val = jsonpathgetmultiple(j, 123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to jsonpathgetmultiple() arg 2 expecting String');
    });

    test('jsonpathset() expects String (p2) for JSONPath, flags Boolean (p2)', () => {
        const diags = lintText('j = json(); jsonpathset(j, true, "val"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Boolean to jsonpathset() arg 2 expecting String');
    });

    test('jsonpathremove() expects String (p2) for JSONPath, flags Integer (p2)', () => {
        const diags = lintText('j = json(); jsonpathremove(j, 123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to jsonpathremove() arg 2 expecting String');
    });

    test('jsonpathcheck() expects String (p2) for JSONPath, flags Integer (p2)', () => {
        const diags = lintText('j = json(); res = jsonpathcheck(j, 123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to jsonpathcheck() arg 2 expecting String');
    });
});
