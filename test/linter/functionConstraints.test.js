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

    suite('String functions: atof / atoi / replace empty & decimal constraints', () => {
        test('Flags empty string literals passed to atof() and atoi()', () => {
            const diagnostics = lintText(`
                x = atof("");
                y = atoi('');
                return "";
            `);
            const atofDiag = diagnostics.find(d => d.code === 'bml-atoi-atof-empty-string' && d.message.includes('atof'));
            const atoiDiag = diagnostics.find(d => d.code === 'bml-atoi-atof-empty-string' && d.message.includes('atoi'));
            assert.ok(atofDiag, 'Should flag atof("")');
            assert.ok(atoiDiag, 'Should flag atoi(\'\')');
        });

        test('Does not flag non-empty strings passed to atof() or atoi()', () => {
            const diagnostics = lintText(`
                x = atof("123.45");
                y = atoi('123');
                z = atof(someVar);
                return "";
            `);
            const diags = diagnostics.filter(d => d.code === 'bml-atoi-atof-empty-string');
            assert.strictEqual(diags.length, 0);
        });

        test('Flags decimal string literals passed to atoi()', () => {
            const diagnostics = lintText(`
                x = atoi("123.45");
                y = atoi('12.0');
                return "";
            `);
            const diag1 = diagnostics.find(d => d.code === 'bml-atoi-decimal-string' && d.message.includes('123.45'));
            const diag2 = diagnostics.find(d => d.code === 'bml-atoi-decimal-string' && d.message.includes('12.0'));
            assert.ok(diag1, 'Should flag atoi("123.45")');
            assert.ok(diag2, 'Should flag atoi(\'12.0\')');
        });

        test('Flags empty search string passed to replace()', () => {
            const diagnostics = lintText(`
                x = replace("hello", "", "hi");
                y = replace("hello", '', "hi");
                return "";
            `);
            const diag1 = diagnostics.filter(d => d.code === 'bml-replace-empty-search-string');
            assert.strictEqual(diag1.length, 2, 'Should flag replace search string as empty string');
        });

        test('Does not flag replace with non-empty search string', () => {
            const diagnostics = lintText(`
                x = replace("hello", "e", "i");
                y = replace("hello", someVar, "hi");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-replace-empty-search-string');
            assert.strictEqual(diag, undefined);
        });

        test('Flags invalid dictionary types in dict()', () => {
            const diagnostics = lintText(`
                d1 = dict("string"); // OK
                d2 = dict("anytype"); // OK
                d3 = dict("string[][]"); // OK
                d4 = dict("json"); // Error
                d5 = dict("invalid"); // Error
                return "";
            `);
            const dictDiags = diagnostics.filter(d => d.code === 'bml-dict-invalid-type');
            assert.strictEqual(dictDiags.length, 2, 'Only d4 and d5 should be flagged');
            const diagErr1 = dictDiags.find(d => d.message.includes("type 'json'"));
            const diagErr2 = dictDiags.find(d => d.message.includes("type 'invalid'"));
            assert.ok(diagErr1, 'Should flag json dict type');
            assert.ok(diagErr2, 'Should flag invalid dict type');
        });

        test('Flags out-of-domain arguments passed to acos() and asin()', () => {
            const diagnostics = lintText(`
                x = acos(0.5); // OK
                y = asin(-1.0); // OK
                z = acos(1.01); // Warning
                w = asin(-2.5); // Warning
                return "";
            `);
            const mathDiags = diagnostics.filter(d => d.code === 'bml-math-domain-error');
            assert.strictEqual(mathDiags.length, 2, 'Only z and w should be flagged');
            const errDiag1 = mathDiags.find(d => d.message.includes('1.01'));
            const errDiag2 = mathDiags.find(d => d.message.includes('-2.5'));
            assert.ok(errDiag1, 'Should flag acos(1.01)');
            assert.ok(errDiag2, 'Should flag asin(-2.5)');
        });

        test('Flags invalid HTTP methods passed to urldata()', () => {
            const diagnostics = lintText(`
                r1 = urldata("url", "GET"); // OK
                r2 = urldata("url", "get"); // Error
                r3 = urldata("url", "OPTIONS"); // Error
                return "";
            `);
            const urlDiags = diagnostics.filter(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(urlDiags.length, 2, 'Only r2 and r3 should be flagged');
            const errDiag1 = urlDiags.find(d => d.message.includes("method 'get'"));
            const errDiag2 = urlDiags.find(d => d.message.includes("method 'OPTIONS'"));
            assert.ok(errDiag1, 'Should flag lowercase "get"');
            assert.ok(errDiag2, 'Should flag unsupported "OPTIONS"');
        });
    });
});
