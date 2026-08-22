const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - Direct DB Access Functions', () => {
    test('getboolean() expects Record (p1) and String (p2), flags String (p1)', () => {
        const diags = lintText('s = "not_record"; res = getboolean(s, "is_active"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to getboolean() arg 1 expecting Record');
    });

    test('getfloat() expects Record (p1) and String (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = getfloat(dt, "price"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to getfloat() arg 1 expecting Record');
    });

    test('getint() expects Record (p1) and String (p2), flags Float (p1)', () => {
        const diags = lintText('f = 12.34; res = getint(f, "qty"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to getint() arg 1 expecting Record');
    });

    test('getmessage() expects RecordSet (p1), flags String (p1)', () => {
        const diags = lintText('s = "not_recordset"; msg = getmessage(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to getmessage() arg 1 expecting RecordSet');
    });

    test('getpartsdata() expects String[] (p1), flags non-array String (p1)', () => {
        const diags = lintText('s = "PART_123"; res = getpartsdata(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing non-array String to getpartsdata() arg 1 expecting String[]');
    });

    test('gettabledata() expects String (p1), flags Integer (p1)', () => {
        const diags = lintText('res = gettabledata(12345); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to gettabledata() arg 1 expecting String table name');
    });

    test('gettransaction() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = gettransaction(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to gettransaction() arg 1 expecting String bsId');
    });

    test('haserror() expects RecordSet (p1), flags Integer (p1)', () => {
        const diags = lintText('res = haserror(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to haserror() arg 1 expecting RecordSet');
    });

    test('recordset() takes no arguments, flags unexpected argument count', () => {
        const diags = lintText('res = recordset("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-count');
        assert.ok(err, 'Should flag passing argument to recordset()');
    });
});
