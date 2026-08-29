const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { formatXml } = require('../../app/lang/xslt/formatter');
const { lintXslt } = require('../../app/lang/xslt/xsltLinter');

suite('XSLT 10-Fixture Comprehensive Validation Test Suite', () => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.xsl') || f.endsWith('.xslt'));

    test('All 10 XSLT test fixture files exist', () => {
        assert.strictEqual(fixtureFiles.length, 10, 'Should have exactly 10 XSLT test fixture files');
    });

    fixtureFiles.forEach((file) => {
        test(`Validate & Format XSLT Fixture: ${file}`, () => {
            const filePath = path.join(fixturesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            const mockDoc = {
                getText() {
                    return content;
                },
                positionAt(offset) {
                    const prefix = content.substring(0, offset);
                    const lines = prefix.split('\n');
                    const line = lines.length - 1;
                    const character = lines[lines.length - 1].length;
                    return new vscode.Position(line, character);
                },
                uri: vscode.Uri.file(filePath)
            };

            // 1. Validate XSLT Linter static diagnostics (No errors)
            const diags = lintXslt(mockDoc);
            const errors = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            assert.strictEqual(errors.length, 0, `Fixture ${file} should have 0 Linter errors. Got: ${errors.map(e => e.message).join('; ')}`);

            // 2. Format XSLT using inuris quote-aware formatter engine
            const formatted = formatXml(content, '  ');
            assert.ok(formatted.length > 0, `Formatted output for ${file} should not be empty`);
            assert.ok(formatted.includes('<xsl:'), `Formatted output for ${file} should retain xsl tags`);

            // 3. Re-format formatted output (Idempotency check: formatting formatted code should yield identical output)
            const reformatted = formatXml(formatted, '  ');
            assert.strictEqual(reformatted, formatted, `Formatting ${file} should be idempotent`);
        });
    });
});
