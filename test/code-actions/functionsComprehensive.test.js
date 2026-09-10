const assert = require('assert');
const { getMemberAccessFixes } = require('@/lang/lint/code-actions/memberAccessFixes');
const { getQualityFixes } = require('@/lang/lint/code-actions/qualityFixes');
const { getStringArrayFixes } = require('@/lang/lint/code-actions/stringArrayFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Comprehensive BML Built-in Function Quick Fixes Suite', function() {
    suite('12. Invalid Built-in Function Names to Canonical BML Quick Fixes Suite', function() {
        test('autocorrects abs() to fabs() (BML only supports fabs)', function() {
            const doc = createMockDoc('val = abs(-5.5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 9), "Unknown built-in function or variable 'abs' - did you mean 'fabs'?", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fix = fixes.find(f => f.title.includes("'fabs'"));
            assert.ok(fix, 'Should offer fabs replacement');
            assert.strictEqual(fix.edit._edits[0].newText, 'fabs');
        });

        test('autocorrects now() and today() to getdate()', function() {
            const docNow = createMockDoc('cur = now();\n');
            const diagNow = new MockDiagnostic(new MockRange(0, 6, 0, 9), "Unknown built-in function or variable 'now'", 1, 'bml-unknown-function');
            const fixesNow = getQualityFixes(docNow, diagNow, diagNow.range, '');
            const fixNow = fixesNow.find(f => f.title.includes("'getdate'"));
            assert.ok(fixNow, 'Should offer getdate replacement for now()');
            assert.strictEqual(fixNow.edit._edits[0].newText, 'getdate');

            const docToday = createMockDoc('d = today();\n');
            const diagToday = new MockDiagnostic(new MockRange(0, 4, 0, 9), "Unknown built-in function or variable 'today'", 1, 'bml-unknown-function');
            const fixesToday = getQualityFixes(docToday, diagToday, diagToday.range, '');
            const fixToday = fixesToday.find(f => f.title.includes("'getdate'"));
            assert.ok(fixToday, 'Should offer getdate replacement for today()');
            assert.strictEqual(fixToday.edit._edits[0].newText, 'getdate');
        });

        test('autocorrects log10() to log()', function() {
            const doc = createMockDoc('l = log10(100);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 9), "Unknown built-in function or variable 'log10'", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fix = fixes.find(f => f.title.includes("'log'"));
            assert.ok(fix, 'Should offer log replacement for log10()');
            assert.strictEqual(fix.edit._edits[0].newText, 'log');
        });

        test('autocorrects length() to len() or sizeofarray()', function() {
            const doc = createMockDoc('n = length(item);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 10), "Unknown built-in function or variable 'length'", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fixLen = fixes.find(f => f.title.includes("'len'"));
            const fixArr = fixes.find(f => f.title.includes("'sizeofarray'"));
            assert.ok(fixLen, 'Should offer len replacement');
            assert.ok(fixArr, 'Should offer sizeofarray replacement');
            assert.strictEqual(fixLen.edit._edits[0].newText, 'len');
            assert.strictEqual(fixArr.edit._edits[0].newText, 'sizeofarray');
        });

        test('autocorrects indexof() to find() or findinarray()', function() {
            const doc = createMockDoc('idx = indexof(data, "sub");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 13), "Unknown built-in function or variable 'indexof'", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fixFind = fixes.find(f => f.title.includes("'find'"));
            const fixArr = fixes.find(f => f.title.includes("'findinarray'"));
            assert.ok(fixFind, 'Should offer find replacement');
            assert.ok(fixArr, 'Should offer findinarray replacement');
            assert.strictEqual(fixFind.edit._edits[0].newText, 'find');
            assert.strictEqual(fixArr.edit._edits[0].newText, 'findinarray');
        });

        test('autocorrects btoa() and atob() to encodebase64() and decodebase64()', function() {
            const docBtoa = createMockDoc('enc = btoa(str);\n');
            const diagBtoa = new MockDiagnostic(new MockRange(0, 6, 0, 10), "Unknown built-in function or variable 'btoa'", 1, 'bml-unknown-function');
            const fixesBtoa = getQualityFixes(docBtoa, diagBtoa, diagBtoa.range, '');
            const fixBtoa = fixesBtoa.find(f => f.title.includes("'encodebase64'"));
            assert.ok(fixBtoa, 'Should offer encodebase64 replacement');
            assert.strictEqual(fixBtoa.edit._edits[0].newText, 'encodebase64');

            const docAtob = createMockDoc('dec = atob(enc);\n');
            const diagAtob = new MockDiagnostic(new MockRange(0, 6, 0, 10), "Unknown built-in function or variable 'atob'", 1, 'bml-unknown-function');
            const fixesAtob = getQualityFixes(docAtob, diagAtob, diagAtob.range, '');
            const fixAtob = fixesAtob.find(f => f.title.includes("'decodebase64'"));
            assert.ok(fixAtob, 'Should offer decodebase64 replacement');
            assert.strictEqual(fixAtob.edit._edits[0].newText, 'decodebase64');
        });
    });

    suite('13. Comprehensive Math Functions Quick Fixes Suite', function() {
        test('converts Math.sqrt and Math.pow to canonical BML sqrt and pow', function() {
            const docSqrt = createMockDoc('r = Math.sqrt(val);\n');
            const diagSqrt = new MockDiagnostic(new MockRange(0, 4, 0, 18), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSqrt = getMemberAccessFixes(docSqrt, diagSqrt, diagSqrt.range);
            const fixSqrt = fixesSqrt.find(f => f.title.includes('sqrt(val)'));
            assert.ok(fixSqrt, 'Should offer sqrt fix');
            assert.strictEqual(fixSqrt.edit._edits[0].newText, 'sqrt(val)');

            const docPow = createMockDoc('p = Math.pow(base, exp);\n');
            const diagPow = new MockDiagnostic(new MockRange(0, 4, 0, 23), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesPow = getMemberAccessFixes(docPow, diagPow, diagPow.range);
            const fixPow = fixesPow.find(f => f.title.includes('pow(base, exp)'));
            assert.ok(fixPow, 'Should offer pow fix');
            assert.strictEqual(fixPow.edit._edits[0].newText, 'pow(base, exp)');
        });

        test('converts Math.ceil, Math.fmod, Math.hypot, and Math.exp', function() {
            const docCeil = createMockDoc('c = Math.ceil(x);\n');
            const diagCeil = new MockDiagnostic(new MockRange(0, 4, 0, 16), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesCeil = getMemberAccessFixes(docCeil, diagCeil, diagCeil.range);
            assert.strictEqual(fixesCeil[0].edit._edits[0].newText, 'ceil(x)');

            const docFmod = createMockDoc('m = Math.fmod(a, b);\n');
            const diagFmod = new MockDiagnostic(new MockRange(0, 4, 0, 19), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesFmod = getMemberAccessFixes(docFmod, diagFmod, diagFmod.range);
            assert.strictEqual(fixesFmod[0].edit._edits[0].newText, 'fmod(a, b)');

            const docHypot = createMockDoc('h = Math.hypot(x, y);\n');
            const diagHypot = new MockDiagnostic(new MockRange(0, 4, 0, 20), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesHypot = getMemberAccessFixes(docHypot, diagHypot, diagHypot.range);
            assert.strictEqual(fixesHypot[0].edit._edits[0].newText, 'hypot(x, y)');

            const docExp = createMockDoc('e = Math.exp(x);\n');
            const diagExp = new MockDiagnostic(new MockRange(0, 4, 0, 15), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesExp = getMemberAccessFixes(docExp, diagExp, diagExp.range);
            assert.strictEqual(fixesExp[0].edit._edits[0].newText, 'exp(x)');
        });

        test('converts trigonometric Math functions: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh', function() {
            const trig = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh'];
            trig.forEach(fn => {
                const doc = createMockDoc(`v = Math.${fn}(angle);\n`);
                const diag = new MockDiagnostic(new MockRange(0, 4, 0, 9 + fn.length + 7), 'Invalid member access', 0, 'bml-invalid-member-access');
                const fixes = getMemberAccessFixes(doc, diag, diag.range);
                const fix = fixes.find(f => f.title.includes(`${fn}(angle)`));
                assert.ok(fix, `Should offer ${fn} fix`);
                assert.strictEqual(fix.edit._edits[0].newText, `${fn}(angle)`);
            });
        });

        test('converts Math.min and Math.max to canonical BML built-ins', function() {
            const docMin = createMockDoc('m = Math.min(a, b);\n');
            const diagMin = new MockDiagnostic(new MockRange(0, 4, 0, 18), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesMin = getMemberAccessFixes(docMin, diagMin, diagMin.range);
            assert.strictEqual(fixesMin[0].edit._edits[0].newText, 'min(a, b)');

            const docMax = createMockDoc('m = Math.max(a, b);\n');
            const diagMax = new MockDiagnostic(new MockRange(0, 4, 0, 18), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesMax = getMemberAccessFixes(docMax, diagMax, diagMax.range);
            assert.strictEqual(fixesMax[0].edit._edits[0].newText, 'max(a, b)');
        });
    });

    suite('14. Comprehensive String & Array Functions Quick Fixes Suite', function() {
        test('converts str.split, str.replace, and str.replaceAll', function() {
            const docSplit = createMockDoc('parts = text.split(",");\n');
            const diagSplit = new MockDiagnostic(new MockRange(0, 8, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSplit = getMemberAccessFixes(docSplit, diagSplit, diagSplit.range);
            assert.strictEqual(fixesSplit[0].edit._edits[0].newText, 'split(text, ",")');

            const docRepl = createMockDoc('clean = text.replace("old", "new");\n');
            const diagRepl = new MockDiagnostic(new MockRange(0, 8, 0, 35), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRepl = getMemberAccessFixes(docRepl, diagRepl, diagRepl.range);
            assert.strictEqual(fixesRepl[0].edit._edits[0].newText, 'replace(text, "old", "new")');
        });

        test('converts str.startsWith and str.endsWith', function() {
            const docStart = createMockDoc('if (s.startsWith("prefix")) {\n');
            const diagStart = new MockDiagnostic(new MockRange(0, 4, 0, 26), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesStart = getMemberAccessFixes(docStart, diagStart, diagStart.range);
            assert.strictEqual(fixesStart[0].edit._edits[0].newText, 'startswith(s, "prefix")');

            const docEnd = createMockDoc('if (s.endsWith("suffix")) {\n');
            const diagEnd = new MockDiagnostic(new MockRange(0, 4, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesEnd = getMemberAccessFixes(docEnd, diagEnd, diagEnd.range);
            assert.strictEqual(fixesEnd[0].edit._edits[0].newText, 'endswith(s, "suffix")');
        });

        test('converts str.substring, str.substr, and str.charAt', function() {
            const docSub = createMockDoc('sub = s.substring(2, 5);\n');
            const diagSub = new MockDiagnostic(new MockRange(0, 6, 0, 23), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSub = getMemberAccessFixes(docSub, diagSub, diagSub.range);
            assert.strictEqual(fixesSub[0].edit._edits[0].newText, 'substring(s, 2, 5)');

            const docChar = createMockDoc('ch = s.charAt(3);\n');
            const diagChar = new MockDiagnostic(new MockRange(0, 5, 0, 16), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesChar = getMemberAccessFixes(docChar, diagChar, diagChar.range);
            assert.strictEqual(fixesChar[0].edit._edits[0].newText, 'substring(s, 3, 3 + 1)');
        });

        test('converts array slice, reverse, findinarray, and sort descending', function() {
            const docSlice = createMockDoc('subArr = arr.slice(1, 3);\n');
            const diagSlice = new MockDiagnostic(new MockRange(0, 9, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSlice = getMemberAccessFixes(docSlice, diagSlice, diagSlice.range);
            assert.strictEqual(fixesSlice[0].edit._edits[0].newText, 'slice(arr, 1, 3)');

            const docRev = createMockDoc('arr.reverse();\n');
            const diagRev = new MockDiagnostic(new MockRange(0, 0, 0, 13), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRev = getMemberAccessFixes(docRev, diagRev, diagRev.range);
            assert.strictEqual(fixesRev[0].edit._edits[0].newText, 'arr = reverse(arr)');

            const docFind = createMockDoc('idx = arr.indexOf("item");\n');
            const diagFind = new MockDiagnostic(new MockRange(0, 6, 0, 25), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesFind = getMemberAccessFixes(docFind, diagFind, diagFind.range);
            const fixArr = fixesFind.find(f => f.title.includes('findinarray'));
            assert.ok(fixArr, 'Should offer findinarray fix');
            assert.strictEqual(fixArr.edit._edits[0].newText, 'findinarray(arr, "item")');

            const docSort = createMockDoc('sort(myArr, "descending");\n');
            const diagSort = new MockDiagnostic(new MockRange(0, 12, 0, 24), 'Invalid sort order', 0, 'bml-sort-invalid-order');
            const fixesSort = getStringArrayFixes(docSort, diagSort, diagSort.range);
            assert.strictEqual(fixesSort[0].edit._edits[0].newText, '"desc"');
        });

        test('converts sizeofarray(arr) > 0 to not(isempty(arr))', function() {
            const doc = createMockDoc('if (sizeofarray(lines) > 0) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 26), 'Use isempty', 1, 'bml-sizeofarray-zero-check');
            const fixes = getStringArrayFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'not(isempty(lines))');
        });
    });

    suite('15. Comprehensive Dictionary & JSON Functions Quick Fixes Suite', function() {
        test('converts dictionary operations: get, put, remove, containsKey, keys, values, clear, size', function() {
            const docGet = createMockDoc('v = myDict.get("k");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 4, 0, 19), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes("'get(myDict, \"k\")'"));
            assert.ok(fixGet, 'Should offer get fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'get(myDict, "k")');

            const docPut = createMockDoc('myDict.put("k", "v");\n');
            const diagPut = new MockDiagnostic(new MockRange(0, 0, 0, 20), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesPut = getMemberAccessFixes(docPut, diagPut, diagPut.range);
            const fixPut = fixesPut.find(f => f.title.includes("'put(myDict, \"k\", \"v\")'"));
            assert.ok(fixPut, 'Should offer put fix');
            assert.strictEqual(fixPut.edit._edits[0].newText, 'put(myDict, "k", "v")');

            const docRem = createMockDoc('myDict.remove("k");\n');
            const diagRem = new MockDiagnostic(new MockRange(0, 0, 0, 18), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRem = getMemberAccessFixes(docRem, diagRem, diagRem.range);
            const fixRem = fixesRem.find(f => f.title.includes("'remove(myDict, \"k\")'"));
            assert.ok(fixRem, 'Should offer remove fix');
            assert.strictEqual(fixRem.edit._edits[0].newText, 'remove(myDict, "k")');

            const docHas = createMockDoc('if (myDict.containsKey("k")) {\n');
            const diagHas = new MockDiagnostic(new MockRange(0, 4, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesHas = getMemberAccessFixes(docHas, diagHas, diagHas.range);
            assert.strictEqual(fixesHas[0].edit._edits[0].newText, 'containskey(myDict, "k")');

            const docKeys = createMockDoc('kArr = myDict.keys();\n');
            const diagKeys = new MockDiagnostic(new MockRange(0, 7, 0, 20), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesKeys = getMemberAccessFixes(docKeys, diagKeys, diagKeys.range);
            const fixKeys = fixesKeys.find(f => f.title.includes("'keys(myDict)'"));
            assert.ok(fixKeys, 'Should offer keys fix');
            assert.strictEqual(fixKeys.edit._edits[0].newText, 'keys(myDict)');

            const docVals = createMockDoc('vArr = myDict.values();\n');
            const diagVals = new MockDiagnostic(new MockRange(0, 7, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesVals = getMemberAccessFixes(docVals, diagVals, diagVals.range);
            assert.strictEqual(fixesVals[0].edit._edits[0].newText, 'values(myDict)');

            const docClr = createMockDoc('myDict.clear();\n');
            const diagClr = new MockDiagnostic(new MockRange(0, 0, 0, 14), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesClr = getMemberAccessFixes(docClr, diagClr, diagClr.range);
            assert.strictEqual(fixesClr[0].edit._edits[0].newText, 'clear(myDict)');

            const docSz = createMockDoc('s = myDict.size();\n');
            const diagSz = new MockDiagnostic(new MockRange(0, 4, 0, 17), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSz = getMemberAccessFixes(docSz, diagSz, diagSz.range);
            const fixSz = fixesSz.find(f => f.title.includes("'size(myDict)'"));
            assert.ok(fixSz, 'Should offer size fix');
            assert.strictEqual(fixSz.edit._edits[0].newText, 'size(myDict)');
        });

        test('converts JSONArray operations: append, get, size, remove, copy, toString', function() {
            const docApp = createMockDoc('myJsonArr.append(item);\n');
            const diagApp = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesApp = getMemberAccessFixes(docApp, diagApp, diagApp.range);
            const fixApp = fixesApp.find(f => f.title.includes('jsonarrayappend'));
            assert.ok(fixApp, 'Should offer jsonarrayappend fix');
            assert.strictEqual(fixApp.edit._edits[0].newText, 'jsonarrayappend(myJsonArr, item)');

            const docGet = createMockDoc('elem = myJsonArr.get(0);\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 7, 0, 23), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('jsonarrayget'));
            assert.ok(fixGet, 'Should offer jsonarrayget fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'jsonarrayget(myJsonArr, 0)');

            const docSz = createMockDoc('len = myJsonArr.size();\n');
            const diagSz = new MockDiagnostic(new MockRange(0, 6, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSz = getMemberAccessFixes(docSz, diagSz, diagSz.range);
            const fixSz = fixesSz.find(f => f.title.includes('jsonarraysize'));
            assert.ok(fixSz, 'Should offer jsonarraysize fix');
            assert.strictEqual(fixSz.edit._edits[0].newText, 'jsonarraysize(myJsonArr)');

            const docRem = createMockDoc('myJsonArr.remove(1);\n');
            const diagRem = new MockDiagnostic(new MockRange(0, 0, 0, 19), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRem = getMemberAccessFixes(docRem, diagRem, diagRem.range);
            const fixRem = fixesRem.find(f => f.title.includes('jsonarrayremove'));
            assert.ok(fixRem, 'Should offer jsonarrayremove fix');
            assert.strictEqual(fixRem.edit._edits[0].newText, 'jsonarrayremove(myJsonArr, 1)');

            const docCp = createMockDoc('copyArr = myJsonArr.clone();\n');
            const diagCp = new MockDiagnostic(new MockRange(0, 10, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesCp = getMemberAccessFixes(docCp, diagCp, diagCp.range);
            const fixCp = fixesCp.find(f => f.title.includes('jsonarraycopy'));
            assert.ok(fixCp, 'Should offer jsonarraycopy fix');
            assert.strictEqual(fixCp.edit._edits[0].newText, 'jsonarraycopy(myJsonArr)');

            const docStr = createMockDoc('str = myJsonArr.toString();\n');
            const diagStr = new MockDiagnostic(new MockRange(0, 6, 0, 26), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesStr = getMemberAccessFixes(docStr, diagStr, diagStr.range);
            const fixStr = fixesStr.find(f => f.title.includes('jsonarraytostr'));
            assert.ok(fixStr, 'Should offer jsonarraytostr fix');
            assert.strictEqual(fixStr.edit._edits[0].newText, 'jsonarraytostr(myJsonArr)');
        });
    });

    suite('16. Comprehensive Date, System & Utility Functions Quick Fixes Suite', function() {
        test('converts Date methods: addMonths, minusDays, isLeap, isWeekend, format', function() {
            const docM = createMockDoc('d2 = myDate.addMonths(3);\n');
            const diagM = new MockDiagnostic(new MockRange(0, 5, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesM = getMemberAccessFixes(docM, diagM, diagM.range);
            assert.strictEqual(fixesM[0].edit._edits[0].newText, 'addmonths(myDate, 3)');

            const docD = createMockDoc('d3 = myDate.minusDays(7);\n');
            const diagD = new MockDiagnostic(new MockRange(0, 5, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesD = getMemberAccessFixes(docD, diagD, diagD.range);
            assert.strictEqual(fixesD[0].edit._edits[0].newText, 'minusdays(myDate, 7)');

            const docL = createMockDoc('if (myDate.isLeap()) {\n');
            const diagL = new MockDiagnostic(new MockRange(0, 4, 0, 20), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesL = getMemberAccessFixes(docL, diagL, diagL.range);
            assert.strictEqual(fixesL[0].edit._edits[0].newText, 'isleap(myDate)');

            const docW = createMockDoc('if (myDate.isWeekend()) {\n');
            const diagW = new MockDiagnostic(new MockRange(0, 4, 0, 23), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesW = getMemberAccessFixes(docW, diagW, diagW.range);
            assert.strictEqual(fixesW[0].edit._edits[0].newText, 'isweekend(myDate)');

            const docF = createMockDoc('s = myDate.format("yyyy-MM-dd");\n');
            const diagF = new MockDiagnostic(new MockRange(0, 4, 0, 31), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesF = getMemberAccessFixes(docF, diagF, diagF.range);
            assert.strictEqual(fixesF[0].edit._edits[0].newText, 'datetostr(myDate, "yyyy-MM-dd")');
        });

        test('replaces deprecated database functions gettabledata and getpartsdata with bmql', function() {
            const docTable = createMockDoc('row = gettabledata("Prices", "item");\n');
            const diagTable = new MockDiagnostic(new MockRange(0, 6, 0, 19), 'Deprecated function', 1, 'bml-gettabledata-fix');
            const fixesTable = getQualityFixes(docTable, diagTable, diagTable.range, '');
            assert.strictEqual(fixesTable[0].edit._edits[0].newText, 'bmql');

            const docParts = createMockDoc('p = getpartsdata("sku123");\n');
            const diagParts = new MockDiagnostic(new MockRange(0, 4, 0, 16), 'Deprecated function', 1, 'bml-getpartsdata-fix');
            const fixesParts = getQualityFixes(docParts, diagParts, diagParts.range, '');
            assert.strictEqual(fixesParts[0].edit._edits[0].newText, 'bmql');
        });

        test('converts console.log and System.out.println to print', function() {
            const docConsole = createMockDoc('console.log("Debug message");\n');
            const diagConsole = new MockDiagnostic(new MockRange(0, 0, 0, 29), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesConsole = getMemberAccessFixes(docConsole, diagConsole, diagConsole.range);
            assert.strictEqual(fixesConsole[0].edit._edits[0].newText, 'print("Debug message")');

            const docSystem = createMockDoc('System.out.println("Message");\n');
            const diagSystem = new MockDiagnostic(new MockRange(0, 0, 0, 29), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSystem = getMemberAccessFixes(docSystem, diagSystem, diagSystem.range);
            assert.strictEqual(fixesSystem[0].edit._edits[0].newText, 'print("Message")');
        });
    });
});
