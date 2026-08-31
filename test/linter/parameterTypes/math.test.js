const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - All Math Functions & Constants', () => {
    test('acos() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = acos(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to acos()');
    });

    test('asin() expects Float, flags Boolean argument', () => {
        const diags = lintText('b = true; x = asin(b); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Boolean to asin()');
    });

    test('atan() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = atan(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to atan()');
    });

    test('ceil() expects Float, flags String argument', () => {
        const diags = lintText('s = "1.5"; x = ceil(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to ceil()');
    });

    test('cos() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = cos(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to cos()');
    });

    test('cosh() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = cosh(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to cosh()');
    });

    test('exp() expects Float, flags String argument', () => {
        const diags = lintText('s = "2.0"; x = exp(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to exp()');
    });

    test('fabs() expects Float, flags String argument', () => {
        const diags = lintText('s = "2.0"; x = fabs(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to fabs()');
    });

    test('fmod() expects Float (p1 & p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); x = fmod(dt, 2.0); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to fmod() arg 1');
    });

    test('hypot() expects Float (p1 & p2), flags String (p1)', () => {
        const diags = lintText('s = "3"; x = hypot(s, 4.0); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to hypot() arg 1');
    });

    test('integer() expects Float, flags String argument', () => {
        const diags = lintText('s = "1.5"; x = integer(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to integer()');
    });

    test('jNaN is a constant, flags invoking jNaN() as a function', () => {
        const diags = lintText('val = jNaN(); return "";');
        const err = diags.find(d => d.code === 'bml-jnan-function-call' || d.code === 'bml-unknown-function');
        assert.ok(err, 'Should flag jNaN() function call');
    });

    test('NaN is a constant, flags invoking NaN() as a function', () => {
        const diags = lintText('val = NaN(); return "";');
        const err = diags.find(d => d.code === 'bml-jnan-function-call' || d.code === 'bml-unknown-function');
        assert.ok(err, 'Should flag NaN() function call');
    });

    test('ln() expects Float, flags String argument', () => {
        const diags = lintText('s = "10"; x = ln(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to ln()');
    });

    test('log() expects Float, flags String argument', () => {
        const diags = lintText('s = "10"; x = log(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to log()');
    });

    test('pow() expects Float (p1 & p2), flags String (p1)', () => {
        const diags = lintText('s = "2"; x = pow(s, 3.0); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to pow() arg 1');
    });

    test('sin() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = sin(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to sin()');
    });

    test('sinh() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = sinh(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to sinh()');
    });

    test('sqrt() expects Float, flags String argument', () => {
        const diags = lintText('s = "16"; x = sqrt(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to sqrt()');
    });

    test('tan() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = tan(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to tan()');
    });

    test('tanh() expects Float, flags String argument', () => {
        const diags = lintText('s = "0.5"; x = tanh(s); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to tanh()');
    });

    test('round() expects Float (p1) and Integer (p2), flags String (p2)', () => {
        const diags = lintText('x = round(3.14159, "two"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to round() arg 2 expecting Integer');
    });

    test('Valid Math operations raise no false positives', () => {
        const diags = lintText(`
            x = acos(0.5);
            y = asin(0.5);
            z = pow(2.0, 3.0);
            r = round(3.14, 2);
            fl = integer(99.9);
            val1 = jNaN;
            val2 = NaN;
            m = fmod(365, 27);
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
    });
});
