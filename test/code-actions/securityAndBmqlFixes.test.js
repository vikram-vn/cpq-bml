const assert = require('assert');
const { getSecurityFixes } = require('@/lang/lint/code-actions/securityFixes');
const { getBmqlFixes } = require('@/lang/lint/code-actions/bmqlFixes');
const { getApiFixes } = require('@/lang/lint/code-actions/apiFixes');
const { getSuppressionFixes } = require('@/lang/lint/code-actions/suppressionFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Security, BMQL, API & Linter Suppression Quick Fixes Suite', function() {
    suite('Security Quick Fixes', function() {
        test('replaces hardcoded credentials and secrets with system variables', function() {
            const doc = createMockDoc('pwd = "secretPass123";\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 21), 'Hardcoded secret', 1, 'bml-hardcoded-secret');
            const fixes = getSecurityFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 2);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '_BM_USER_TOKEN');
            assert.strictEqual(fixes[1].edit._edits[0].newText, '_system_user_token');
        });

        test('extracts hardcoded URL to dynamic config lookup', function() {
            const doc = createMockDoc('url = "https://api.partner.com/v1";\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 34), 'Hardcoded URL', 1, 'bml-hardcoded-url');
            const fixes = getSecurityFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.ok(fixes[0].title.includes('Extract URL to dynamic configuration'));
            const replaceEdit = fixes[0].edit._edits.find(e => e.newText === 'endpointUrl');
            assert.ok(replaceEdit, 'Should replace literal with endpointUrl');
        });

        test('masks logged sensitive variables with [REDACTED]', function() {
            const doc = createMockDoc('print(ssnToken);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 14), 'Logging sensitive variable', 1, 'bml-log-sensitive-data');
            const fixes = getSecurityFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '"[REDACTED]"');
        });
    });

    suite('BMQL Advanced Quick Fixes', function() {
        test('replaces SELECT * with explicit column list placeholder', function() {
            const doc = createMockDoc('res = bmql("SELECT * FROM items");\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 20), 'BMQL SELECT * not recommended', 1, 'bml-bmql-select-star');
            const fixes = getBmqlFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'SELECT col1, col2');
        });

        test('appends safety WHERE clause to unbounded DELETE or mutation', function() {
            const doc = createMockDoc('res = bmql("DELETE FROM cache_table");\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 36), 'Unbounded delete', 1, 'bml-bmql-unbounded-delete');
            const fixes = getBmqlFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.ok(fixes[0].title.includes('safety WHERE clause'));
            assert.strictEqual(fixes[0].edit._edits[0].newText, '"DELETE FROM cache_table WHERE _document_number = $doc_num"');
        });

        test('converts dynamic string concatenation in BMQL to parameter substitution', function() {
            const doc = createMockDoc('q = "SELECT x FROM t WHERE y = \'" + myVar + "\'";\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 47), 'BMQL injection risk', 1, 'bml-bmql-injection-risk');
            const fixes = getBmqlFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.ok(fixes[0].title.includes('$variable substitution'));
            assert.ok(fixes[0].edit._edits[0].newText.includes('$myVar'));
        });
    });

    suite('API & TTL Quick Fixes', function() {
        test('truncates logtime tag exceeding 128 characters', function() {
            const longTag = '"' + 'a'.repeat(140) + '"';
            const doc = createMockDoc(`logtime(${longTag});\n`);
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 8 + longTag.length), 'Tag too long', 1, 'bml-logtime-tag-too-long');
            const fixes = getApiFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText.length, 130); // 128 chars + 2 quotes
        });

        test('clamps globaldict TTL to 3600 (1 hour)', function() {
            const doc = createMockDoc('globaldictset("k", "v", 9999999);\n');
            const diag = new MockDiagnostic(new MockRange(0, 24, 0, 31), 'TTL out of range', 1, 'bml-globaldict-ttl-out-of-range');
            const fixes = getApiFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '3600');
        });
    });

    suite('Linter Directive Suppression Quick Fixes', function() {
        test('generates disable for line, next-line, and entire-file comments', function() {
            const doc = createMockDoc('x = 10;\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 6), 'Unused variable', 1, 'bml-unused-variable');
            const fixes = getSuppressionFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 3);
            assert.ok(fixes[0].title.includes("Disable 'bml-unused-variable' for this line"));
            assert.ok(fixes[1].title.includes("Disable 'bml-unused-variable' for next line"));
            assert.ok(fixes[2].title.includes("Disable 'bml-unused-variable' for entire file"));
        });
    });
});
