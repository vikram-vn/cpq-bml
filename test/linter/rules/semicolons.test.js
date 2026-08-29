const assert = require('assert');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - missing semicolons', () => {
    test('Linter does not flag missing semicolons on control flow statements or comments on them', () => {
        const diagnostics = lintText(`
            if (x == 10) // check x
            {
                print(x);
            } else // check else
            {
                print(0);
            }
            for item in list // check for
            {
                print(item);
            }
        `);

        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0, 'Should not flag missing semicolons on control statements with comments');
    });

    test('Linter does not flag missing semicolons on multi-line statements split across lines', () => {
        const diagnostics = lintText(`
            ret = ret + line._document_number + "~estimatePrice_line~" + string(estimatePrice
                //comment
                ) + "|";
            x = 10 +
                20;
            y = func(
                1,
                2
            );
        `);

        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0, 'Should not flag missing semicolons on multi-line statements');
    });

    test('Linter does not false-positive a missing semicolon on a string literal containing "//"', () => {
        // A naive line.split('//')[0] comment-stripper would truncate this line
        // at the "//" inside the URL and lose the real trailing semicolon.
        const diagnostics = lintText('url = "http://example.com";\n');

        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0, 'Should not flag a missing semicolon on a properly terminated line containing a URL');
    });

    test('Linter flags missing semicolons on lines starting with identifiers like "orderId" or "notesField"', () => {
        // A continuation-line check used to skip any line whose trimmed text
        // merely *started with* the letters OR/AND/NOT (matching identifiers like
        // orderId, notesField, androidFlag), silently suppressing real missing
        // semicolon diagnostics on those lines.
        const diagnostics = lintText('orderId = 5\nnotesField = "x"\nandThing = 1\n');

        const semicolonLines = diagnostics
            .filter(d => d.message.includes('Missing semicolon'))
            .map(d => d.range.start.line)
            .sort((a, b) => a - b);
        assert.deepStrictEqual(semicolonLines, [0, 1, 2]);
    });

    test('Linter does not flag missing semicolons on element lines of a multi-line array literal', () => {
        const diagnostics = lintText('returnCol = String[] {\n\t"name",\n\t"value",\n\t"costType"\n};\n');

        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0, 'Should not flag array literal element lines as missing a semicolon');
    });

    test('Linter does not flag missing semicolons on lines continued by a leading "+" on the next line', () => {
        // BML has no unary '+', so this is unambiguously a multi-line expression,
        // a very common pattern in real Commerce return-string-building code.
        const diagnostics = lintText('ret = ret + a + "~x~" + string(y) + "|"\n\t+ b + "|";\n');

        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0, 'Should not flag a line continued by a leading + on the next line');
    });

    test('Linter does not flag missing semicolons on lines continued by a trailing logical operator', () => {
        const diagnostics = lintText(`
            flag = x == 10 AND
                y == 20;
            return flag;
        `);
        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0);
    });

    test('Linter flags missing semicolons on regular return statements without semicolon', () => {
        const diagnostics = lintText(`
            x = 10;
            return x
        `);
        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 1);
        assert.strictEqual(semicolonDiags[0].range.start.line, 2);
    });

    test('Linter flags missing semicolons on closing curly braces of literal block assignments and highlights full line', () => {
        const diagnostics = lintText(`
            listOfSteps = String[] {"start_step",
                "pending_process",
                "cartInProgress"}
        `);
        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 1);
        const diag = semicolonDiags[0];
        assert.strictEqual(diag.range.start.line, 3);
        assert.strictEqual(diag.range.start.character, 0, 'Should start at column 0 to highlight the full line');
    });

    test('Linter does not flag missing semicolons on comments with multi-byte unicode characters (em-dash, smart quotes)', () => {
        const diagnostics = lintText(`
            // apply adjustment — no extendedCost_l override here.
            // desiredFCValue exceeds totalPrice (cost > revenue at desired GM) – no discount applied
            // Store the delta so the first child item’s service receives adjustment.
            finalPrice = 0.0;
            return finalPrice;
        `);
        const semicolonDiags = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semicolonDiags.length, 0, 'Should not flag missing semicolons on comments with unicode characters');
    });
});
