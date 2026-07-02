const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - documented per-function constraints', () => {
    suite('Negative array size (bml-negative-array-size)', () => {
        test('Flags a literal negative array size', () => {
            const diagnostics = lintText(`
                arr = float[-9];
                return arr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-negative-array-size');
            assert.ok(diag, 'Should flag float[-9]');
        });

        test('Does not flag a positive array size', () => {
            const diagnostics = lintText(`
                arr = float[9];
                return arr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-negative-array-size');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag jNaN as an array size - it initializes a size-0 array, not an exception', () => {
            const diagnostics = lintText(`
                arr = float[jNaN];
                return arr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-negative-array-size');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag a variable used as the array size', () => {
            const diagnostics = lintText(`
                arr = float[n];
                return arr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-negative-array-size');
            assert.strictEqual(diag, undefined, 'A variable size cannot be checked statically');
        });
    });

    suite('logtime() tag length (bml-logtime-tag-too-long)', () => {
        test('Flags a tag literal over 128 characters', () => {
            const longTag = 'a'.repeat(150);
            const diagnostics = lintText(`
                logtime("${longTag}", 100);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-logtime-tag-too-long');
            assert.ok(diag, 'Should flag a 150-character tag');
        });

        test('Does not flag a short tag', () => {
            const diagnostics = lintText(`
                logtime("short tag", 100);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-logtime-tag-too-long');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('globaldictset() minTimeToLive range (bml-globaldict-ttl-out-of-range)', () => {
        test('Flags minTimeToLive of 0', () => {
            const diagnostics = lintText(`
                x = globaldictset("k", "v", 0);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-globaldict-ttl-out-of-range');
            assert.ok(diag, 'Should flag minTimeToLive <= 0');
        });

        test('Flags minTimeToLive above 525600', () => {
            const diagnostics = lintText(`
                x = globaldictset("k", "v", 600000);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-globaldict-ttl-out-of-range');
            assert.ok(diag, 'Should flag minTimeToLive >= 525600');
        });

        test('Does not flag a valid minTimeToLive', () => {
            const diagnostics = lintText(`
                x = globaldictset("k", "v", 1440);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-globaldict-ttl-out-of-range');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag globaldictset() without a minTimeToLive argument', () => {
            const diagnostics = lintText(`
                x = globaldictset("k", "v");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-globaldict-ttl-out-of-range');
            assert.strictEqual(diag, undefined, 'minTimeToLive is optional - defaults to 1440');
        });
    });

    suite('jsonput() reserved/silently-mangled literal values (bml-jsonput-reserved-literal)', () => {
        test('Flags the literal string "null" as the value', () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "null");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.ok(diag, 'Should flag jsonput with a literal "null" value');
        });

        test('Flags a value wrapped in curly braces', () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "{foo}");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.ok(diag, 'Should flag a brace-wrapped literal value');
        });

        test('Does not flag a normal string value', () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", "hello world");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag a variable value', () => {
            const diagnostics = lintText(`
                x = jsonput(obj, "key", someVar);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-jsonput-reserved-literal');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('values() on an unsupported dictionary type (bml-dict-values-unsupported-type)', () => {
        test('Flags values() on a boolean dictionary', () => {
            const diagnostics = lintText(`
                d = dict("boolean");
                v = values(d);
                return v;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-values-unsupported-type');
            assert.ok(diag, 'Should flag values() on a boolean dictionary');
        });

        test('Flags values() on an anytype dictionary', () => {
            const diagnostics = lintText(`
                d = dict("anytype");
                v = values(d);
                return v;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-values-unsupported-type');
            assert.ok(diag, 'Should flag values() on an anytype dictionary');
        });

        test('Flags values() on a double-dimensional dictionary', () => {
            const diagnostics = lintText(`
                d = dict("integer[][]");
                v = values(d);
                return v;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-values-unsupported-type');
            assert.ok(diag, 'Should flag values() on a 2-D dictionary');
        });

        test('Does not flag values() on a supported dictionary type', () => {
            const diagnostics = lintText(`
                d = dict("string");
                v = values(d);
                return v;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-values-unsupported-type');
            assert.strictEqual(diag, undefined);
        });
    });
});
