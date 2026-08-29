const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - XML Functions', () => {
    test('readxmlsingle() expects String (p1) and String (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); val = readxmlsingle(dt, "//item"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to readxmlsingle() arg 1 expecting XML String');
    });

    test('readxmlmultiple() expects String (p1) and String (p2), flags Integer (p1)', () => {
        const diags = lintText('val = readxmlmultiple(12345, "//item"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to readxmlmultiple() arg 1 expecting XML String');
    });

    test('transformxml() expects String (p1) and String (p2), flags Integer (p2)', () => {
        const diags = lintText('xmlStr = "<a/>"; res = transformxml(xmlStr, 123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to transformxml() arg 2 expecting XSLT String');
    });

    test('removexmlnode() expects String (p1) and String (p2), flags Integer (p1)', () => {
        const diags = lintText('res = removexmlnode(12345, "//item"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to removexmlnode() arg 1 expecting XML String');
    });

    test('appendxmlnode() expects String (p1, p2, p3), flags Float (p3)', () => {
        const diags = lintText('xmlStr = "<a/>"; f = 9.9; res = appendxmlnode(xmlStr, "//a", f); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to appendxmlnode() arg 3 expecting XML node String');
    });
});
