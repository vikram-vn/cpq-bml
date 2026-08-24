const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Math Specific & Edge Tests', () => {
    suite('Single-operand Math functions (abs, ceil, floor, round, sqrt, exp, log, ln, sin, cos, tan)', () => {
        test('abs(-5.5) / ceil(4.2) / floor(4.9) / sqrt(16.0) - valid 1 arg', () => {
            const diags = lintText('a = abs(-5.5); c = ceil(4.2); f = floor(4.9); s = sqrt(16.0); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sin(0.0) / cos(0.0) / tan(0.0) / exp(1.0) / log(10.0) - valid 1 arg', () => {
            const diags = lintText('sn = sin(0.0); cs = cos(0.0); tn = tan(0.0); e = exp(1.0); lg = log(10.0); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('sqrt() with 0 args flags bml-function-arg-count', () => {
            const diags = lintText('s = sqrt(); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('sqrt(16.0, 2.0) with 2 args flags bml-function-arg-count', () => {
            const diags = lintText('s = sqrt(16.0, 2.0); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });
    });

    suite('Double-operand Math functions (pow, fmod, atan2, hypot)', () => {
        test('pow(2.0, 3.0) / fmod(10.0, 3.0) / hypot(3.0, 4.0) - valid 2 args', () => {
            const diags = lintText('p = pow(2.0, 3.0); fm = fmod(10.0, 3.0); h = hypot(3.0, 4.0); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('pow(2.0) with 1 arg flags bml-function-arg-count', () => {
            const diags = lintText('p = pow(2.0); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('pow(2.0, 3.0, 4.0) with 3 args flags bml-function-arg-count', () => {
            const diags = lintText('p = pow(2.0, 3.0, 4.0); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });
    });

    suite('round() precision argument', () => {
        test('round(4.567, 2) - 2 args with precision → no error', () => {
            const diags = lintText('r = round(4.567, 2); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('round(4.567) - 1 arg flags bml-function-arg-count', () => {
            const diags = lintText('r = round(4.567); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });

        test('round(4.567, 2, "excess") - 3 args → flags bml-function-arg-count', () => {
            const diags = lintText('r = round(4.567, 2, "excess"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });
    });
});
