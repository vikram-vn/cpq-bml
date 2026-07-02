const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - literal misuse (guaranteed-to-fail literal arguments)', () => {
    suite('atoi("") / atof("") (bml-atoi-atof-empty-literal)', () => {
        test('Flags atoi("")', () => {
            const diagnostics = lintText(`
                x = atoi("");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-atoi-atof-empty-literal');
            assert.ok(diag, 'Should flag atoi("")');
        });

        test('Flags atof(\'\')', () => {
            const diagnostics = lintText(`
                x = atof('');
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-atoi-atof-empty-literal');
            assert.ok(diag, "Should flag atof('')");
        });

        test('Does not flag atoi(var) or a non-empty literal', () => {
            const diagnostics = lintText(`
                a = atoi(someVar);
                b = atoi("123");
                return a + b;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-atoi-atof-empty-literal');
            assert.strictEqual(diag, undefined, 'Variables and non-empty literals cannot be checked statically');
        });
    });

    suite('isnumber() with no argument (bml-isnumber-no-args)', () => {
        test('Flags isnumber() with no argument', () => {
            const diagnostics = lintText(`
                x = isnumber();
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-isnumber-no-args');
            assert.ok(diag, 'Should flag isnumber() called with no argument');
        });

        test('Does not flag isnumber("") - it is a valid call that returns false', () => {
            const diagnostics = lintText(`
                x = isnumber("");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-isnumber-no-args');
            assert.strictEqual(diag, undefined, 'isnumber("") is documented to return false, not error');
        });
    });

    suite('replace() with an empty search pattern (bml-replace-empty-pattern)', () => {
        test('Flags replace(str, "", new)', () => {
            const diagnostics = lintText(`
                x = replace("abc", "", "x");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-replace-empty-pattern');
            assert.ok(diag, 'Should flag an empty old/search argument');
        });

        test('Does not flag a normal replace() call', () => {
            const diagnostics = lintText(`
                x = replace("abc", "a", "x");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-replace-empty-pattern');
            assert.strictEqual(diag, undefined);
        });

        test('Does not misparse a comma inside a string argument', () => {
            const diagnostics = lintText(`
                x = replace("a,b,c", ",", "-");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-replace-empty-pattern');
            assert.strictEqual(diag, undefined, 'The search argument is "," not empty - a naive comma split would misparse this');
        });
    });

    suite('string() cast of a string literal (bml-string-cast-of-string)', () => {
        test('Flags string("literal")', () => {
            const diagnostics = lintText(`
                x = string("already a string");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-string-cast-of-string');
            assert.ok(diag, 'Should flag string() called with a string literal');
        });

        test('Does not flag string(variable) - the type is not known statically', () => {
            const diagnostics = lintText(`
                myFloat = 3.14;
                x = string(myFloat);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-string-cast-of-string');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag string(numericLiteral)', () => {
            const diagnostics = lintText(`
                x = string(123.45);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-string-cast-of-string');
            assert.strictEqual(diag, undefined, 'string() of a numeric literal is exactly its documented use');
        });
    });
});
