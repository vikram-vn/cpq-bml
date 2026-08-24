const assert = require('assert');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { lintBMLCustom } = require('../../../app/lang/lint/core/lint');

// Dynamic file-based tests from test/bml-lint directory: each <name>.bml file
// is linted and compared against its <name>.expected.json diagnostics list.
suite('BML Linter Test Suite - file-based fixtures', function() {
    this.timeout(60000);
    const bmlLintDir = path.join(__dirname, '..', 'fixtures');
    if (fs.existsSync(bmlLintDir)) {
        const files = fs.readdirSync(bmlLintDir);
        const inputFiles = files.filter(f => f.endsWith('.bml') && fs.existsSync(path.join(bmlLintDir, `${path.basename(f, '.bml')}.expected.json`)));

        for (const file of inputFiles) {
            const testName = path.basename(file, '.bml');
            test(`BML Linter fileBased.test: ${testName}`, () => {
                const inputPath = path.join(bmlLintDir, file);
                const expectedPath = path.join(bmlLintDir, `${testName}.expected.json`);

                const bmlText = fs.readFileSync(inputPath, 'utf8');
                const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

                const doc = {
                    languageId: 'bml',
                    getText: () => bmlText,
                    positionAt: (idx) => {
                        const lines = bmlText.slice(0, idx).split(/\r?\n/);
                        return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
                    },
                    uri: vscode.Uri.file(inputPath)
                };

                const diagnostics = [];
                const collection = {
                    set: (uri, diags) => {
                        diagnostics.push(...diags);
                    }
                };

                const extPath = path.resolve(__dirname, '../../');
                lintBMLCustom(doc, collection, vscode, extPath);

                const actual = diagnostics
                    .filter(d => d.code !== 'bml-spelling-error')
                    .map(d => ({
                        line: d.range.start.line,
                        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'Error' :
                              d.severity === vscode.DiagnosticSeverity.Warning ? 'Warning' :
                              d.severity === vscode.DiagnosticSeverity.Information ? 'Information' : 'Hint',
                    message: d.message
                }));

                const sortByLineAndMessage = (a, b) => {
                    const aLine = a.line !== undefined ? a.line : 0;
                    const bLine = b.line !== undefined ? b.line : 0;
                    if (aLine !== bLine) return aLine - bLine;
                    return a.message.localeCompare(b.message);
                };

                actual.sort(sortByLineAndMessage);
                if (process.env.UPDATE_SNAPSHOTS === 'true') {
                    fs.writeFileSync(expectedPath, JSON.stringify(actual, null, 2));
                } else {
                    expected.sort(sortByLineAndMessage);
                    assert.deepStrictEqual(actual, expected);
                }
            });
        }
    }
});
