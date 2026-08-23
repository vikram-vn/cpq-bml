const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - rules (functions & syntax)', function() {
    this.timeout(15000);

    test('Linter flags built-in functions called with incorrect argument count', () => {
        const diagnostics = lintText(`
            x = atof("5.0"); // OK
            y = atof("5.0", "extra"); // Error: expects 1, got 2
            z = getdate(); // OK
            w = getdate(recordRow, "created_date"); // OK (Record field overload)
            return "";
        `);

        const okDiag1 = diagnostics.find(d => d.message.includes("function 'atof'") && d.range.start.line === 1);
        assert.strictEqual(okDiag1, undefined, 'atof("5.0") is correct');

        const errDiag1 = diagnostics.find(d => d.message.includes("function 'atof' expects 1 argument") && d.range.start.line === 2);
        assert.ok(errDiag1, 'Should flag atof with 2 arguments');

        const okDiag2 = diagnostics.find(d => d.message.includes("function 'getdate'") && d.range.start.line === 4);
        assert.strictEqual(okDiag2, undefined, 'getdate(recordRow, "created_date") is correct');
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

    test('Linter flags empty blocks and very long statements', () => {
        const diagnostics = lintText(`
            x = 10;
            if (x == 10) {
            }
            list = string[]{};
            y = 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1;
        `);

        const emptyBlockDiag = diagnostics.find(d => d.message.includes('Empty block detected'));
        assert.ok(emptyBlockDiag, 'Should flag empty block');
        assert.strictEqual(emptyBlockDiag.severity, require('vscode').DiagnosticSeverity.Error);

        // Should not flag the empty array initializer list = string[]{}
        const arrayInitDiag = diagnostics.find(d => d.range.start.line === 4 && d.message.includes('Empty block detected'));
        assert.strictEqual(arrayInitDiag, undefined, 'Should not flag empty array initializer');

        const longLineDiag = diagnostics.find(d => d.message.includes('Line exceeds 200 characters'));
        assert.ok(longLineDiag, 'Should flag very long statement');
        assert.strictEqual(longLineDiag.severity, require('vscode').DiagnosticSeverity.Warning);
    });

    test('Linter flags SELECT * in BMQL, hardcoded URLs, and float comparison', () => {
        const diagnostics = lintText(`
            r = bmql("SELECT * FROM myTable");
            url = "https://example.com/api";
            if (f == 1.5) {
                print(url);
            }
        `);

        assert.ok(diagnostics.find(d => d.message.includes("SELECT *")), 'Should flag SELECT *');
        assert.ok(diagnostics.find(d => d.message.includes("Hardcoded URL")), 'Should flag hardcoded URL');
        assert.ok(diagnostics.find(d => d.message.includes("Comparing float values")), 'Should flag float comparison');
    });

    test('Linter allows urldata, urldatabypost, and urldatabyget as non-deprecated', () => {
        const diagnostics = lintText(`
            res1 = urldata("http://test.com", "GET", dict("string"));
            res2 = urldatabypost("http://test.com", "body", "headers");
            res3 = urldatabyget("http://test.com", "headers", "error");
            print(res1);
            print(res2);
            print(res3);
            return "";
        `);

        const dep = diagnostics.filter(d => d.message.includes("Deprecated function") && (d.message.includes("urldata") || d.message.includes("urldatabypost") || d.message.includes("urldatabyget")));
        assert.strictEqual(dep.length, 0, 'urldata functions should not be flagged as deprecated');
    });

    test('Linter flags legacy functions gettabledata and getpartsdata as deprecated', () => {
        const diagnostics = lintText(`
            res1 = gettabledata("my_table", "my_column", "my_value");
            res2 = getpartsdata(string[]{"part1"});
            print(res1);
            print(res2);
            return "";
        `);

        const gettabledataDiag = diagnostics.find(d => d.message.includes("gettabledata") && d.message.includes("Use 'bmql' instead"));
        const getpartsdataDiag = diagnostics.find(d => d.message.includes("getpartsdata") && d.message.includes("Use 'bmql' instead"));
        assert.ok(gettabledataDiag, 'Should flag gettabledata as deprecated');
        assert.ok(getpartsdataDiag, 'Should flag getpartsdata as deprecated');
    });

    test('Linter does not flag compiler-required dummy, temp, or trigger_ variables as unused', () => {
        const diagnostics = lintText(`
            dummy = util.someFunc();
            temp = util.anotherFunc();
            trigger_save = util.wsUpdateTransactionSave();
            unused = 123; // exact name 'unused' is ignored
            return "";
        `);

        const unusedDiags = diagnostics.filter(d => d.message.includes("Unused variable"));
        assert.strictEqual(unusedDiags.length, 0, 'Should not flag dummy, temp, trigger_, or unused variables as unused');
    });

    test('Linter flags actual unused variables', () => {
        const diagnostics = lintText(`
            realUnused = 123;
            return "";
        `);

        const unusedDiag = diagnostics.find(d => d.message.includes("Unused variable: realUnused"));
        assert.ok(unusedDiag, 'Should flag realUnused as unused');
    });

    test('Linter flags special character 0x1c which can corrupt CPQ deployments', () => {
        const diagnostics = lintText(`
            x = "\x1chelo";
            return x;
        `);

        const corruptDiag = diagnostics.find(d => d.message.includes("corrupting special character (0x1c)"));
        assert.ok(corruptDiag, 'Should flag the 0x1c special character');
    });

    test('Linter edge cases: SELECT * and URLs in comments/strings, float compare in comments, division by 0.0', () => {
        const diagnostics = lintText(`
            // SELECT * FROM myTable
            // https://example.com/api
            // if (f == 1.5) { }
            // z = 10 / 0;

            s1 = "SELECT * FROM myTable";
            s2 = "not a url";
            s3 = "if (f == 1.5) { }";
            s4 = "z = 10 / 0;";

            // Valid w3.org URL in code (should be ignored)
            schema = "http://www.w3.org/2001/XMLSchema-instance";

            // Protocol only (should be ignored)
            proto = "https://";

            // Division by 0.0 (should be flagged)
            badDiv1 = 10 / 0.0;
            badDiv2 = 5 / 0.00;

            print(s1); print(s2); print(s3); print(s4); print(schema); print(proto);
            print(badDiv1); print(badDiv2);
            return "";
        `);

        // Comments and plain string literals should NOT trigger SELECT *, URL, float compare, or division by zero warnings
        const selectStarDiag = diagnostics.find(d => d.message.includes("SELECT *"));
        assert.strictEqual(selectStarDiag, undefined, 'Should not flag SELECT * in comments/strings');

        const urlDiag = diagnostics.find(d => d.message.includes("Hardcoded URL") && !d.message.includes("schema") && !d.message.includes("proto"));
        assert.strictEqual(urlDiag, undefined, 'Should not flag hardcoded URLs in comments/strings or w3.org/protocol-only strings');

        const floatDiag = diagnostics.find(d => d.message.includes("Comparing float values"));
        assert.strictEqual(floatDiag, undefined, 'Should not flag float comparisons in comments/strings');

        // Division by 0.0 and 0.00 should be flagged
        const divDiags = diagnostics.filter(d => d.message.includes("Division by literal zero"));
        assert.strictEqual(divDiags.length, 2, 'Should flag division by 0.0 and 0.00');
    });

    test('Linter flags BML syntax errors: array element assignment, break/continue outside loops, invalid member access', () => {
        const diagnostics = lintText(`
            arr = string[]{"a"};
            arr[0] = "b"; // Error

            for x in arr {
                if (x == "a") {
                    break; // OK
                }
            }

            break; // Error
            continue; // Error

            // Invalid member accesses
            arr.length; // Error
            myDict = dict("string");
            myDict.size(); // Error
            myJson = json();
            myJson.get("key"); // Error

            // Valid Record field access (should NOT be flagged)
            print(line.itemInstanceId_l); // OK
            return "";
        `);

        const arrayAssignDiag = diagnostics.find(d => d.message.includes("Array element assignment"));
        assert.ok(arrayAssignDiag, 'Should flag array element assignment');
        assert.strictEqual(arrayAssignDiag.severity, require('vscode').DiagnosticSeverity.Error);

        const breakDiags = diagnostics.filter(d => d.message.includes("'break' statement is only allowed"));
        assert.strictEqual(breakDiags.length, 1, 'Should flag one break statement outside loop');
        assert.strictEqual(breakDiags[0].severity, require('vscode').DiagnosticSeverity.Error);

        const continueDiags = diagnostics.filter(d => d.message.includes("'continue' statement is only allowed"));
        assert.strictEqual(continueDiags.length, 1, 'Should flag one continue statement outside loop');
        assert.strictEqual(continueDiags[0].severity, require('vscode').DiagnosticSeverity.Error);

        const lengthDiag = diagnostics.find(d => d.message.includes("Member access or method call ('arr.length')"));
        assert.ok(lengthDiag, 'Should flag arr.length');
        assert.strictEqual(lengthDiag.severity, require('vscode').DiagnosticSeverity.Error);

        const sizeDiag = diagnostics.find(d => d.message.includes("Member access or method call ('myDict.size(')"));
        assert.ok(sizeDiag, 'Should flag myDict.size()');
        assert.strictEqual(sizeDiag.severity, require('vscode').DiagnosticSeverity.Error);

        const getDiag = diagnostics.find(d => d.message.includes("Member access or method call ('myJson.get(')"));
        assert.ok(getDiag, 'Should flag myJson.get()');
        assert.strictEqual(getDiag.severity, require('vscode').DiagnosticSeverity.Error);

        const recordDiag = diagnostics.find(d => d.message.includes("line.itemInstanceId_l"));
        assert.strictEqual(recordDiag, undefined, 'Should NOT flag valid Record field access line.itemInstanceId_l');
    });

    test('Linter flags both trailing comma and too-few-arguments when a call is left mid-edit, e.g. find(arr,)', () => {
        // A trailing comma right after the only argument usually means the author
        // started typing a second argument and never finished - the missing-argument
        // diagnostic is the more important signal and must not be swallowed by the
        // generic trailing-comma syntax error.
        const diagnostics = lintText(`
            elif (listOfSteps[currStepPos] == "orderedBeingFulfilled" AND find(_system_valid_stages,) >= 0) {
                x = 1;
            }
            return "";
        `);

        const commaDiag = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
        assert.ok(commaDiag, 'Should still flag the trailing comma');
        assert.strictEqual(commaDiag.severity, require('vscode').DiagnosticSeverity.Error);

        const argCountDiag = diagnostics.find(d => d.code === 'bml-function-arg-count' && d.message.includes("'find'"));
        assert.ok(argCountDiag, "Should also flag find() as missing arguments, not just the trailing comma");
        assert.ok(argCountDiag.message.includes('expects 2 to 4 argument(s), but got 1'));
        assert.strictEqual(argCountDiag.severity, require('vscode').DiagnosticSeverity.Error);
    });

    test('Linter smart magic number exemptions for safe contexts', () => {
        const diagnostics = lintText(`
            // Safe contexts that should NOT be flagged as magic numbers
            strPart = substring(rawStr, 0, 5);
            nextDate = adddays(orderDate, 7);
            arrItem = items[0];
            idxItem = items[i + 1];
            if (statusCode == 200) {
                print("OK");
            }
            if (status != 404) {
                print("Found");
            }
            secVal = msVal / 1000;
            if (find(haystack, "needle") == -1) {
                print("not found");
            }

            // Raw magic numbers that SHOULD be flagged
            mRate_03 = 47.25;
            discountFactor = 0.85;
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        const magicMessages = magicDiags.map(d => d.message);

        // Verify that 47.25 and 0.85 are flagged
        assert.ok(magicMessages.some(m => m.includes("'47.25'")), "Should flag raw business number 47.25");
        assert.ok(magicMessages.some(m => m.includes("'0.85'")), "Should flag raw factor 0.85");

        // Verify that safe context numbers are NOT flagged
        assert.ok(!magicMessages.some(m => m.includes("'5'")), "Should NOT flag substring length 5");
        assert.ok(!magicMessages.some(m => m.includes("'7'")), "Should NOT flag adddays offset 7");
        assert.ok(!magicMessages.some(m => m.includes("'200'")), "Should NOT flag HTTP status 200");
        assert.ok(!magicMessages.some(m => m.includes("'404'")), "Should NOT flag HTTP status 404");
        assert.ok(!magicMessages.some(m => m.includes("'1000'")), "Should NOT flag time multiplier 1000");
    });
});
