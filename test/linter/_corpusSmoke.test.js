const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/lint');

suite('BML Linter Test Suite - full corpus smoke test (no crashes)', function() {
    this.timeout(15000);
    test('lints every real .bml file in bml/library without throwing', () => {
        const libDir = path.join(__dirname, '..', '..', 'bml', 'library');
        if (!fs.existsSync(libDir)) return;
        const files = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name.endsWith('.bml')) files.push(full);
            }
        };
        walk(libDir);
        assert.ok(files.length > 100, 'expected the real corpus to be present');

        for (const file of files) {
            const bmlText = fs.readFileSync(file, 'utf8');
            const doc = {
                languageId: 'bml',
                getText: () => bmlText,
                positionAt: (idx) => {
                    const lines = bmlText.slice(0, idx).split(/\r?\n/);
                    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
                },
                uri: vscode.Uri.file(file),
            };
            const collection = { set: () => {} };
            assert.doesNotThrow(() => lintBMLCustom(doc, collection, vscode), `linting ${file} should not throw`);
        }
    });
});
