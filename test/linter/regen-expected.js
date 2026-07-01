/**
 * Regenerates all test/lint/*.expected.json files with the actual current
 * linter output. Run once after adding new linting rules.
 *
 * Usage: node test/linter/regen-expected.js
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const originalRequire = Module.prototype.require;

const mockVscode = {
    Diagnostic: function(range, msg, severity) {
        this.range = range;
        this.message = msg;
        this.severity = severity;
    },
    DiagnosticSeverity: {
        Warning: 1,
        Error: 2,
        Information: 3,
        Hint: 4
    },
    Range: function(start, end) {
        this.start = start;
        this.end = end;
    },
    Position: function(line, char) {
        this.line = line;
        this.character = char;
        this.translate = function(l, c) {
            return new mockVscode.Position(line + l, char + c);
        };
    },
    workspace: {
        getConfiguration: () => ({
            get: (key, defaultValue) => {
                if (key === 'features.lint') return true;
                if (key === 'features.lintSpelling') return false;
                return defaultValue;
            }
        })
    }
};

Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

const { lintBMLCustom } = require('../../app/lang/lint/lint');

const lintDir = path.join(__dirname, '..', 'lint');
const bmlFiles = fs.readdirSync(lintDir).filter(f => f.endsWith('.bml'));

for (const file of bmlFiles) {
    const inputPath = path.join(lintDir, file);
    const expectedPath = path.join(lintDir, file.replace('.bml', '.expected.json'));
    const bmlText = fs.readFileSync(inputPath, 'utf8');

    const doc = {
        languageId: 'bml',
        getText: () => bmlText,
        positionAt: (idx) => {
            const lines = bmlText.slice(0, idx).split(/\r?\n/);
            return new mockVscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
        uri: { fsPath: inputPath }
    };

    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    lintBMLCustom(doc, collection, mockVscode);

    const output = diagnostics
        .filter(d => d.code !== 'bml-spelling-error')
        .map(d => ({
            line: d.range.start.line,
            severity: d.severity === mockVscode.DiagnosticSeverity.Error ? 'Error' :
                      d.severity === mockVscode.DiagnosticSeverity.Warning ? 'Warning' :
                      d.severity === mockVscode.DiagnosticSeverity.Information ? 'Information' : 'Hint',
            message: d.message,
        }));

    output.sort((a, b) => a.line !== b.line ? a.line - b.line : a.message.localeCompare(b.message));
    fs.writeFileSync(expectedPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`✓ ${file} → ${output.length} diagnostics`);
}
console.log('\nAll expected.json files regenerated.');
