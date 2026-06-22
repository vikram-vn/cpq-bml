const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - rules', function() {
    this.timeout(15000);
    test('Linter flags unused variables and shadowing', () => {
        const diagnostics = lintText(`
            unusedVar = "hello";
            x = 10;
            list = string[]{"a", "b"};
            for x in list {
                print(x);
            }
        `);

        const unusedDiag = diagnostics.find(d => d.message.includes('Unused variable: unusedVar'));
        assert.ok(unusedDiag, 'Should flag unusedVar as unused');

        const shadowDiag = diagnostics.find(d => d.message.includes('shadows a variable in an outer scope'));
        assert.ok(shadowDiag, 'Should flag shadowing of variable x');
    });

    test('Linter flags BMQL inside loops and repeated BMQL queries', () => {
        const diagnostics = lintText(`
            list = string[]{"a", "b"};
            for item in list {
                row = bmql("select id from table1");
            }
            r1 = bmql("select desc from table2");
            r2 = bmql("select desc from table2");
        `);

        const loopDiag = diagnostics.find(d => d.message.includes('BMQL query inside loop'));
        assert.ok(loopDiag, 'Should flag BMQL inside loop');

        const repeatedDiag = diagnostics.find(d => d.message.includes('Repeated identical BMQL query'));
        assert.ok(repeatedDiag, 'Should flag repeated BMQL queries');
    });

    test('Linter flags SQL injection risk and deprecated functions', () => {
        const diagnostics = lintText(`
            val = "part123";
            dbResult = bmql("select col1 from table where col2 = " + val);
            oldDate = strtodate("2026-06-20", "%Y-%m-%d");
            magic = 999;
            nanVal = NaN;
        `);

        const sqlDiag = diagnostics.find(d => d.message.includes('SQL injection'));
        assert.ok(sqlDiag, 'Should flag SQL injection danger in bmql query');

        const dateDiag = diagnostics.find(d => d.message.includes('strtodate'));
        assert.ok(dateDiag, 'Should flag strtodate as deprecated');

        const nanDiag = diagnostics.find(d => d.message.includes('constant \'NaN\''));
        assert.ok(nanDiag, 'Should flag NaN as deprecated');

        const magicDiag = diagnostics.find(d => d.message.includes('Magic number \'999\''));
        assert.ok(magicDiag, 'Should flag magic number 999');
    });

    test('Linter flags BML script size warning when script exceeds 64KB', () => {
        const diagnostics = lintText('// ' + 'a'.repeat(66000));

        const lenDiag = diagnostics.find(d => d.message.includes('exceeds the 64KB limit'));
        assert.ok(lenDiag, 'Should flag script size exceeding 64KB');
    });

    test('Linter attributes diagnostics to the correct line after a multi-line block comment', () => {
        // lint.js blanks out comments/strings with ' '.repeat(end - start) before
        // running the rule checks - if that collapses the \n characters inside a
        // multi-line /* ... */ comment, every line after it shifts and all
        // subsequent diagnostics land on the wrong line.
        const diagnostics = lintText('a = 1;\n/* this is\na multi\nline comment */\nmagic = 999\n');

        // "magic = 999" is on line 4 (0-indexed) of the source.
        const missingSemiDiag = diagnostics.find(d => d.message.includes('Missing semicolon'));
        assert.ok(missingSemiDiag, 'Should flag the missing semicolon on "magic = 999"');
        assert.strictEqual(missingSemiDiag.range.start.line, 4);

        const magicNumDiag = diagnostics.find(d => d.message.includes("Magic number '999'"));
        assert.ok(magicNumDiag, 'Should flag 999 as a magic number');
        assert.strictEqual(magicNumDiag.range.start.line, 4);
    });

    test('Linter flags JS strict inequality operator !==', () => {
        const diagnostics = lintText(`
            if (x !== 10) {
                print(x);
            }
        `);

        const opDiag = diagnostics.find(d => d.message.includes('Use <> in BML') && d.range.start.line === 1);
        assert.ok(opDiag, 'Should flag !== operator as invalid');
    });

    test('Linter recommends == (not =) for the JS strict equality operator ===', () => {
        // The quick-fix for '===' replaces it with '==' (codeActions.js), so the
        // diagnostic message must say the same thing rather than telling the user
        // to use the assignment operator '=', which would change the statement's
        // meaning if they followed the advice literally.
        const diagnostics = lintText('if (x === 10) {\n    print(x);\n}\n');

        const opDiag = diagnostics.find(d => d.range.start.line === 0 && d.message.includes('=='));
        assert.ok(opDiag, 'Should flag === and recommend ==');
        assert.strictEqual(opDiag.message, 'Use == in BML');
    });

    test('Linter allows "} elif (...) {" on one line, matching the beautifier\'s collapse brace style', () => {
        // BML's default brace_style ('collapse') treats elif exactly like else -
        // app/lang/beautify/bml/beautifier.js's HUGS_PREVIOUS_BLOCK includes both.
        // Flagging '} elif (...) {' as a style violation would contradict the
        // beautifier's own recommended output and was a false-positive flood
        // across real CPQ library code's elif chains.
        const diagnostics = lintText(`
            if (x == 1) {
                print(x);
            } elif (x == 2) {
                print(x);
            } else {
                print(x);
            }
            return "";
        `);

        const braceDiag = diagnostics.find(d => d.message.includes('Curly brackets should always close'));
        assert.strictEqual(braceDiag, undefined, 'Should not flag "} elif (...) {" as a brace style violation');
    });

    test('Linter softens an unused for-loop variable to an informational notice, distinct from a forgotten assignment', () => {
        const diagnostics = lintText(`
            count = 0;
            for i in someArray {
                count = count + 1;
            }
            print(count);
            return "";
        `);

        const loopDiag = diagnostics.find(d => d.code === 'bml-unused-loop-var');
        assert.ok(loopDiag, 'Should flag the unused loop variable with the dedicated code');
        assert.strictEqual(loopDiag.severity, require('vscode').DiagnosticSeverity.Information);
        assert.ok(loopDiag.message.includes("'i'"));

        const warningDiag = diagnostics.find(d => d.message === 'Unused variable: i');
        assert.strictEqual(warningDiag, undefined, 'Should not also flag it as a plain Warning-level unused variable');
    });

    test('Linter recognizes isnull()/empty-string checks as valid numericality validation before atof/atoi', () => {
        const diagnostics = lintText(`
            value = jsonget(obj, "field");
            if (isnull(value) or trim(value) == "") {
                value = "0";
            }
            n = atof(value);
            print(n);
            return "";
        `);

        const safetyDiag = diagnostics.find(d => d.message.includes("Validate numericality"));
        assert.strictEqual(safetyDiag, undefined, 'isnull()/trim()=="" should count as having validated the value already');
    });

    test('Linter flags a bare "=" inside an if condition as a likely typo for "=="', () => {
        const diagnostics = lintText('if (x = 5) {\n    print(x);\n}\nreturn x;\n');

        const diag = diagnostics.find(d => d.code === 'bml-assignment-in-condition');
        assert.ok(diag, 'Should flag the assignment inside the condition');
        assert.strictEqual(diag.severity, require('vscode').DiagnosticSeverity.Error);
    });

    test('Linter does not flag "=" inside a string literal within a condition as an assignment typo', () => {
        const diagnostics = lintText('if (label == "a=b") {\n    print(label);\n}\nreturn label;\n');

        const diag = diagnostics.find(d => d.code === 'bml-assignment-in-condition');
        assert.strictEqual(diag, undefined, 'A "=" inside a string literal must not be mistaken for an assignment');
    });

    test('Linter does not flag ==, <=, >=, or <> as an assignment typo', () => {
        const diagnostics = lintText('if (x == 1 or x <= 2 or x >= 3 or x <> 4) {\n    print(x);\n}\nreturn x;\n');

        const diag = diagnostics.find(d => d.code === 'bml-assignment-in-condition');
        assert.strictEqual(diag, undefined, 'Comparison operators must not be mistaken for a bare assignment');
    });

    test('Linter flags dict() called with no type argument, but not a properly-typed dict("string")', () => {
        const badDiagnostics = lintText('x = dict();\nreturn x;\n');
        const badDiag = badDiagnostics.find(d => d.code === 'bml-dict-missing-type');
        assert.ok(badDiag, 'Should flag dict() with no arguments');
        assert.strictEqual(badDiag.severity, require('vscode').DiagnosticSeverity.Error);

        const goodDiagnostics = lintText('x = dict("string");\nreturn x;\n');
        const goodDiag = goodDiagnostics.find(d => d.code === 'bml-dict-missing-type');
        assert.strictEqual(goodDiag, undefined, 'dict("string") must not be mistaken for dict() once strings are blanked');
    });

    test('Linter flags division by a literal zero, but not by a non-zero literal like 0.5', () => {
        const zeroDiagnostics = lintText('z = 10 / 0;\nreturn z;\n');
        assert.ok(zeroDiagnostics.find(d => d.message.includes('Division by literal zero')), 'Should flag division by 0');

        const halfDiagnostics = lintText('z = 10 / 0.5;\nreturn z;\n');
        assert.strictEqual(halfDiagnostics.find(d => d.message.includes('Division by literal zero')), undefined, 'Division by 0.5 is not division by zero');
    });

    test('Linter comment range utility ignores comments inside strings', () => {
        const bmlText = `
            url = "http://example.com";
            // real comment here
        `;
        const { getCommentRanges } = require('../../app/lang/lint/comments');
        const commentRanges = getCommentRanges(bmlText);

        assert.strictEqual(commentRanges.length, 1);
        const commentText = bmlText.substring(commentRanges[0][0], commentRanges[0][1]);
        assert.strictEqual(commentText, '// real comment here');
    });

    test('Linter flags built-in functions called with incorrect argument count', () => {
        const diagnostics = lintText(`
            x = atof("5.0"); // OK
            y = atof("5.0", "extra"); // Error: expects 1, got 2
            z = getdate(); // OK
            w = getdate(true, false); // Error: expects 0 to 1, got 2
            return "";
        `);

        const okDiag1 = diagnostics.find(d => d.message.includes("function 'atof'") && d.range.start.line === 1);
        assert.strictEqual(okDiag1, undefined, 'atof("5.0") is correct');

        const errDiag1 = diagnostics.find(d => d.message.includes("function 'atof' expects 1 argument") && d.range.start.line === 2);
        assert.ok(errDiag1, 'Should flag atof with 2 arguments');

        const errDiag2 = diagnostics.find(d => d.message.includes("function 'getdate' expects 0 to 1 argument") && d.range.start.line === 4);
        assert.ok(errDiag2, 'Should flag getdate with 2 arguments');
    });

    test('Linter flags unknown bare function calls', () => {
        const diagnostics = lintText(`
            res = nonExistentFunc(1, 2);
            return "";
        `);

        const unknownDiag = diagnostics.find(d => d.message.includes("Unknown built-in function or variable 'nonExistentFunc'"));
        assert.ok(unknownDiag, 'Should flag unknown function nonExistentFunc');
    });

    test('Linter checks workspace utility functions and flags parameter mismatches', () => {
        // Since workspace scans are run, it will detect local metadata files like getFileData-meta.json (if workspace is open during test)
        // or it will report 'not found in workspace' as an Information diagnostic.
        // Let's test both the 'not found' and the validation for getFileData.
        const diagnostics = lintText(`
            // getFileData expects 2 arguments
            res1 = util.getFileData("44103915", "City"); // OK
            res2 = util.getFileData("44103915"); // Warning: expects 2, got 1
            res3 = util.nonExistentUtilFunction(1); // Information: not found
            return "";
        `);

        const okDiag = diagnostics.find(d => d.message.includes("getFileData") && d.range.start.line === 2 && d.severity === require('vscode').DiagnosticSeverity.Warning);
        assert.strictEqual(okDiag, undefined, 'getFileData with 2 arguments should be OK');

        // Check if workspace is loaded/resolved in tests. If yes, it flags count mismatch:
        const hasWorkspace = diagnostics.some(d => d.message.includes("getFileData") && d.message.includes("expects 2"));
        if (hasWorkspace) {
            const errDiag = diagnostics.find(d => d.message.includes("getFileData") && d.message.includes("expects 2") && d.range.start.line === 3);
            assert.ok(errDiag, 'Should flag getFileData with 1 argument');
        }

        const notFoundDiag = diagnostics.find(d => d.message.includes("nonExistentUtilFunction") && d.message.includes("not found") && d.range.start.line === 4);
        assert.ok(notFoundDiag, 'Should flag nonExistentUtilFunction as not found');
        assert.strictEqual(notFoundDiag.severity, require('vscode').DiagnosticSeverity.Information);
    });

    test('Linter does not flag storage-type constructor calls as unknown functions', () => {
        // String/Integer/Json/etc are recognized via common.json already; Float/Boolean/
        // Date/Record are valid BML storage types (see bml.tmLanguage.json's "types"
        // patterns) with no common.json entry of their own, so they must be in the
        // keywords skip-set in functions.js or they'd be misreported as unknown.
        const diagnostics = lintText(`
            a = Float(value);
            b = Boolean(flag);
            c = Date(str);
            d = Record();
            e = Dictionary();
            return "";
        `);

        const unknownDiags = diagnostics.filter(d => d.message.includes('Unknown built-in function or variable'));
        assert.deepStrictEqual(unknownDiags, [], 'Storage-type constructor calls should never be flagged as unknown');
    });
});
