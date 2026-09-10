const assert = require('assert');
const { getMemberAccessFixes } = require('@/lang/lint/code-actions/memberAccessFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Member Access to Canonical BML Function Fixes', function() {
    suite('1. Member Access to Canonical BML Function Fixes', function() {
        test('converts arr.length to sizeofarray(arr) and str.length to len(str)', function() {
            const doc = createMockDoc('len = arr.length;\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 16), "BML Syntax Error: Member access 'arr.length' is not supported", 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            assert.ok(fixes.length >= 2, 'Should offer multiple candidate conversions');
            const fixArray = fixes.find(function(f) { return f.title.includes('sizeofarray(arr)'); });
            const fixStr = fixes.find(function(f) { return f.title.includes('len(arr)'); });
            assert.ok(fixArray, 'Should offer sizeofarray(arr)');
            assert.ok(fixStr, 'Should offer len(arr)');
        });

        test('converts str.toLowerCase() to lower(str) and str.trim() to trim(str)', function() {
            const doc = createMockDoc('s1 = name.toLowerCase();\ns2 = name.trim();\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 5, 0, 23), "Member access", 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc, diag1, diag1.range);
            const fixLower = fixes1.find(function(f) { return f.title.includes('lower(name)'); });
            assert.ok(fixLower, 'Should offer lower(name)');

            const diag2 = new MockDiagnostic(new MockRange(1, 5, 1, 16), "Member access", 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc, diag2, diag2.range);
            const fixTrim = fixes2.find(function(f) { return f.title.includes('trim(name)'); });
            assert.ok(fixTrim, 'Should offer trim(name)');
        });

        test('converts json.get("k") to jsonget(json, "k") and dict.get("k") to get(dict, "k")', function() {
            const doc = createMockDoc('val = myObj.get("sku");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 22), "Member access", 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixJson = fixes.find(function(f) { return f.title.includes('jsonget(myObj, "sku")'); });
            const fixDict = fixes.find(function(f) { return f.title.includes('get(myObj, "sku")'); });
            assert.ok(fixJson, 'Should offer jsonget');
            assert.ok(fixDict, 'Should offer get');
        });

        test('converts json.put("k", v) and dict.put("k", v)', function() {
            const doc = createMockDoc('myObj.put("sku", 123);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 21), "Member access", 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixJson = fixes.find(function(f) { return f.title.includes('jsonput(myObj, "sku", 123)'); });
            const fixDict = fixes.find(function(f) { return f.title.includes('put(myObj, "sku", 123)'); });
            assert.ok(fixJson, 'Should offer jsonput');
            assert.ok(fixDict, 'Should offer put');
        });

        test('converts arr.push(item) to append() and Math.round(x) to round(x)', function() {
            const doc = createMockDoc('items.push("abc");\nval = Math.round(4.5);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 0, 0, 17), "Member access", 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc, diag1, diag1.range);
            const fixPush = fixes1.find(function(f) { return f.title.includes('items = append(items, "abc")'); });
            assert.ok(fixPush, 'Should offer append assignment');

            const diag2 = new MockDiagnostic(new MockRange(1, 6, 1, 21), "Member access", 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc, diag2, diag2.range);
            const fixMath = fixes2.find(function(f) { return f.title.includes('round(4.5)'); });
            assert.ok(fixMath, 'Should offer round(4.5)');
        });
    });

    suite('9. Expanded Member Access to Canonical BML Functions Suite', function() {
        test('converts Date member access to canonical BML functions', function() {
            const doc = createMockDoc('d2 = myDate.addDays(5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 5, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('adddays(myDate, 5)'));
            assert.ok(fix, 'Should offer adddays fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'adddays(myDate, 5)');
        });

        test('converts Date getTime() to getcurrenttimeinmillis()', function() {
            const doc = createMockDoc('ms = myDate.getTime();\n');
            const diag = new MockDiagnostic(new MockRange(0, 5, 0, 21), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('getcurrenttimeinmillis()'));
            assert.ok(fix, 'Should offer getcurrenttimeinmillis fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'getcurrenttimeinmillis()');
        });

        test('converts Integer.parseInt(s) to atoi(s)', function() {
            const doc = createMockDoc('num = Integer.parseInt(strVal);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 30), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('atoi(strVal)'));
            assert.ok(fix, 'Should offer atoi fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'atoi(strVal)');
        });

        test('converts JSON.parse(s) to json(s) and JSON.stringify(o) to jsontostr(o)', function() {
            const doc1 = createMockDoc('j = JSON.parse(rawText);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 4, 0, 23), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc1, diag1, diag1.range);
            const fix1 = fixes1.find(f => f.title.includes('json(rawText)'));
            assert.ok(fix1, 'Should offer json(rawText)');
            assert.strictEqual(fix1.edit._edits[0].newText, 'json(rawText)');

            const doc2 = createMockDoc('s = JSON.stringify(myJson);\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 4, 0, 26), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc2, diag2, diag2.range);
            const fix2 = fixes2.find(f => f.title.includes('jsontostr(myJson)'));
            assert.ok(fix2, 'Should offer jsontostr(myJson)');
            assert.strictEqual(fix2.edit._edits[0].newText, 'jsontostr(myJson)');
        });

        test('converts array pop() to remove(arr, sizeofarray(arr) - 1)', function() {
            const doc = createMockDoc('myArr.pop();\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 11), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('remove(myArr, sizeofarray(myArr) - 1)'));
            assert.ok(fix, 'Should offer pop to remove fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'myArr = remove(myArr, sizeofarray(myArr) - 1)');
        });

        test('converts string strip() to trim(s)', function() {
            const doc = createMockDoc('clean = myStr.strip();\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 21), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('trim(myStr)'));
            assert.ok(fix, 'Should offer trim fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'trim(myStr)');
        });
    });

    suite('10. Extended Mathematical, Utility & Encoding Member Accesses Suite', function() {
        test('converts Math.log(x) to ln(x) for natural log and log(x) for base-10', function() {
            const doc = createMockDoc('val = Math.log(x);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 17), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixLn = fixes.find(f => f.title.includes('ln(x)'));
            const fixLog = fixes.find(f => f.title.includes('log(x)'));
            assert.ok(fixLn, 'Should offer ln(x) fix');
            assert.ok(fixLog, 'Should offer log(x) fix');
            assert.strictEqual(fixLn.edit._edits[0].newText, 'ln(x)');
            assert.strictEqual(fixLog.edit._edits[0].newText, 'log(x)');
        });

        test('converts Math.abs(x) to fabs(x) strictly (BML only supports fabs)', function() {
            const doc = createMockDoc('v = Math.abs(num);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 17), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixFabs = fixes.find(f => f.title.includes('fabs(num)'));
            const fixAbs = fixes.find(f => f.title.includes("Use BML 'abs("));
            assert.ok(fixFabs, 'Should offer fabs(num) fix');
            assert.strictEqual(fixAbs, undefined, 'Should NOT offer abs because BML only supports fabs');
            assert.strictEqual(fixFabs.edit._edits[0].newText, 'fabs(num)');
        });

        test('converts Math.floor(x) to atoi(string(x)) or round(x - 0.5, 0)', function() {
            const doc = createMockDoc('f = Math.floor(num);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 19), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixAtoi = fixes.find(f => f.title.includes('atoi(string(num))'));
            const fixRound = fixes.find(f => f.title.includes('round(num - 0.5, 0)'));
            assert.ok(fixAtoi, 'Should offer atoi(string) fix');
            assert.ok(fixRound, 'Should offer round fix');
            assert.strictEqual(fixAtoi.edit._edits[0].newText, 'atoi(string(num))');
            assert.strictEqual(fixRound.edit._edits[0].newText, 'round(num - 0.5, 0)');
        });

        test('converts UUID.randomUUID() to generateuuid()', function() {
            const doc = createMockDoc('id = UUID.randomUUID();\n');
            const diag = new MockDiagnostic(new MockRange(0, 5, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('generateuuid()'));
            assert.ok(fix, 'Should offer generateuuid fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'generateuuid()');
        });

        test('converts Base64 encode and decode to encodebase64 and decodebase64', function() {
            const doc1 = createMockDoc('enc = Base64.encode(text);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 6, 0, 25), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc1, diag1, diag1.range);
            const fix1 = fixes1.find(f => f.title.includes('encodebase64(text)'));
            assert.ok(fix1, 'Should offer encodebase64 fix');
            assert.strictEqual(fix1.edit._edits[0].newText, 'encodebase64(text)');

            const doc2 = createMockDoc('dec = Base64.decode(b64);\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 6, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc2, diag2, diag2.range);
            const fix2 = fixes2.find(f => f.title.includes('decodebase64(b64)'));
            assert.ok(fix2, 'Should offer decodebase64 fix');
            assert.strictEqual(fix2.edit._edits[0].newText, 'decodebase64(b64)');
        });

        test('converts URLEncoder.encode(s) to makeurlparam(s)', function() {
            const doc = createMockDoc('param = URLEncoder.encode(query);\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 32), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('makeurlparam(query)'));
            assert.ok(fix, 'Should offer makeurlparam fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'makeurlparam(query)');
        });

        test('converts String.format(...) to format(...) and num.formatAsCurrency() to formatascurrency(num)', function() {
            const doc1 = createMockDoc('msg = String.format("Hello %s", name);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 6, 0, 38), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc1, diag1, diag1.range);
            const fix1 = fixes1.find(f => f.title.includes('format("Hello %s", name)'));
            assert.ok(fix1, 'Should offer format fix');
            assert.strictEqual(fix1.edit._edits[0].newText, 'format("Hello %s", name)');

            const doc2 = createMockDoc('c = price.formatAsCurrency();\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 4, 0, 28), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc2, diag2, diag2.range);
            const fix2 = fixes2.find(f => f.title.includes('formatascurrency(price)'));
            assert.ok(fix2, 'Should offer formatascurrency fix');
            assert.strictEqual(fix2.edit._edits[0].newText, 'formatascurrency(price)');
        });
    });

    suite('11. Enterprise CPQ Domain, Session, BOM & Commerce Member Accesses Suite', function() {
        test('converts session.get, session.set, session.remove to usersession functions', function() {
            const docGet = createMockDoc('token = session.get("auth");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 8, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('usersessionget("auth")'));
            assert.ok(fixGet, 'Should offer usersessionget fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'usersessionget("auth")');

            const docSet = createMockDoc('session.set("user", u);\n');
            const diagSet = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSet = getMemberAccessFixes(docSet, diagSet, diagSet.range);
            const fixSet = fixesSet.find(f => f.title.includes('usersessionset("user", u)'));
            assert.ok(fixSet, 'Should offer usersessionset fix');
            assert.strictEqual(fixSet.edit._edits[0].newText, 'usersessionset("user", u)');

            const docRem = createMockDoc('session.remove("user");\n');
            const diagRem = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRem = getMemberAccessFixes(docRem, diagRem, diagRem.range);
            const fixRem = fixesRem.find(f => f.title.includes('usersessionremove("user")'));
            assert.ok(fixRem, 'Should offer usersessionremove fix');
            assert.strictEqual(fixRem.edit._edits[0].newText, 'usersessionremove("user")');
        });

        test('converts global.get, global.set, global.remove to globaldict functions', function() {
            const docGet = createMockDoc('cached = global.get("rate");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 9, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('globaldictget("rate")'));
            assert.ok(fixGet, 'Should offer globaldictget fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'globaldictget("rate")');

            const docSet = createMockDoc('global.set("rate", 1.25);\n');
            const diagSet = new MockDiagnostic(new MockRange(0, 0, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSet = getMemberAccessFixes(docSet, diagSet, diagSet.range);
            const fixSet = fixesSet.find(f => f.title.includes('globaldictset("rate", 1.25)'));
            assert.ok(fixSet, 'Should offer globaldictset fix');
            assert.strictEqual(fixSet.edit._edits[0].newText, 'globaldictset("rate", 1.25)');
        });

        test('converts context.getAttribute and setAttribute to CPQ config functions', function() {
            const docGet = createMockDoc('val = context.getAttribute("lineCount");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 6, 0, 39), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('getconfigattrvalue("lineCount")'));
            assert.ok(fixGet, 'Should offer getconfigattrvalue fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'getconfigattrvalue("lineCount")');

            const docSet = createMockDoc('context.setAttribute("lineCount", 5);\n');
            const diagSet = new MockDiagnostic(new MockRange(0, 0, 0, 36), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSet = getMemberAccessFixes(docSet, diagSet, diagSet.range);
            const fixSet = fixesSet.find(f => f.title.includes('setattributevalue("lineCount", 5)'));
            assert.ok(fixSet, 'Should offer setattributevalue fix');
            assert.strictEqual(fixSet.edit._edits[0].newText, 'setattributevalue("lineCount", 5)');
        });

        test('converts bom operations: bom.get(), bom.apply(), bom.save(), bom.calculateDelta()', function() {
            const doc = createMockDoc('b = bom.get();\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 13), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('getbom()'));
            assert.ok(fix, 'Should offer getbom fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'getbom()');

            const docApply = createMockDoc('bom.apply();\n');
            const diagApply = new MockDiagnostic(new MockRange(0, 0, 0, 11), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesApply = getMemberAccessFixes(docApply, diagApply, diagApply.range);
            const fixApply = fixesApply.find(f => f.title.includes('applybom()'));
            assert.ok(fixApply, 'Should offer applybom fix');
            assert.strictEqual(fixApply.edit._edits[0].newText, 'applybom()');

            const docSave = createMockDoc('bom.save();\n');
            const diagSave = new MockDiagnostic(new MockRange(0, 0, 0, 10), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSave = getMemberAccessFixes(docSave, diagSave, diagSave.range);
            const fixSave = fixesSave.find(f => f.title.includes('savebom()'));
            assert.ok(fixSave, 'Should offer savebom fix');
            assert.strictEqual(fixSave.edit._edits[0].newText, 'savebom()');

            const docDelta = createMockDoc('d = bom.calculateDelta(priorBom);\n');
            const diagDelta = new MockDiagnostic(new MockRange(0, 4, 0, 32), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesDelta = getMemberAccessFixes(docDelta, diagDelta, diagDelta.range);
            const fixDelta = fixesDelta.find(f => f.title.includes('calculatedeltabom(priorBom)'));
            assert.ok(fixDelta, 'Should offer calculatedeltabom fix');
            assert.strictEqual(fixDelta.edit._edits[0].newText, 'calculatedeltabom(priorBom)');
        });

        test('converts transaction and parts methods to canonical commerce functions', function() {
            const docGet = createMockDoc('t = transaction.get();\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 4, 0, 21), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('gettransaction()'));
            assert.ok(fixGet, 'Should offer gettransaction fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'gettransaction()');

            const docAdd = createMockDoc('transaction.add(lines);\n');
            const diagAdd = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesAdd = getMemberAccessFixes(docAdd, diagAdd, diagAdd.range);
            const fixAdd = fixesAdd.find(f => f.title.includes('addtotransaction(lines)'));
            assert.ok(fixAdd, 'Should offer addtotransaction fix');
            assert.strictEqual(fixAdd.edit._edits[0].newText, 'addtotransaction(lines)');

            const docParts = createMockDoc('parts.addToTransaction();\n');
            const diagParts = new MockDiagnostic(new MockRange(0, 0, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesParts = getMemberAccessFixes(docParts, diagParts, diagParts.range);
            const fixParts = fixesParts.find(f => f.title.includes('addpartstotransaction(parts)'));
            assert.ok(fixParts, 'Should offer addpartstotransaction fix');

            const docOld = createMockDoc('prev = status.getOldValue();\n');
            const diagOld = new MockDiagnostic(new MockRange(0, 7, 0, 26), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesOld = getMemberAccessFixes(docOld, diagOld, diagOld.range);
            const fixOld = fixesOld.find(f => f.title.includes('getoldvalue("status")'));
            assert.ok(fixOld, 'Should offer getoldvalue fix');
            assert.strictEqual(fixOld.edit._edits[0].newText, 'getoldvalue("status")');
        });

        test('converts XML member operations: xml.transform, removeNode, appendNode', function() {
            const docTrans = createMockDoc('res = xmlDoc.transform(xslSheet);\n');
            const diagTrans = new MockDiagnostic(new MockRange(0, 6, 0, 33), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesTrans = getMemberAccessFixes(docTrans, diagTrans, diagTrans.range);
            const fixTrans = fixesTrans.find(f => f.title.includes('transformxml(xmlDoc, xslSheet)'));
            assert.ok(fixTrans, 'Should offer transformxml fix');
            assert.strictEqual(fixTrans.edit._edits[0].newText, 'transformxml(xmlDoc, xslSheet)');

            const docRem = createMockDoc('xmlDoc.removeNode("//item");\n');
            const diagRem = new MockDiagnostic(new MockRange(0, 0, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRem = getMemberAccessFixes(docRem, diagRem, diagRem.range);
            const fixRem = fixesRem.find(f => f.title.includes('removexmlnode(xmlDoc, "//item")'));
            assert.ok(fixRem, 'Should offer removexmlnode fix');
            assert.strictEqual(fixRem.edit._edits[0].newText, 'removexmlnode(xmlDoc, "//item")');

            const docApp = createMockDoc('xmlDoc.appendNode("/root", "<node/>");\n');
            const diagApp = new MockDiagnostic(new MockRange(0, 0, 0, 37), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesApp = getMemberAccessFixes(docApp, diagApp, diagApp.range);
            const fixApp = fixesApp.find(f => f.title.includes('appendxmlnode(xmlDoc, "/root", "<node/>")'));
            assert.ok(fixApp, 'Should offer appendxmlnode fix');
            assert.strictEqual(fixApp.edit._edits[0].newText, 'appendxmlnode(xmlDoc, "/root", "<node/>")');
        });
    });
});
