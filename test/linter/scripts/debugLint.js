// Debug: see exactly what diagnostics lintText produces for the failing test inputs
// Run: node test/linter/debugLint.js
process.env.VSCODE_CWD = __dirname;
const vscode = require('vscode');
const { lintBMLCustom } = require('../../../app/lang/lint/lint');

function lintText(bmlText, filePath = '/mock/test.bml') {
    const doc = {
        languageId: 'bml',
        getText: () => bmlText,
        positionAt: (idx) => {
            const lines = bmlText.slice(0, idx).split(/\r?\n/);
            return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
        uri: vscode.Uri.file(filePath)
    };
    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    lintBMLCustom(doc, collection, vscode);
    return diagnostics;
}

const t1 = `
            /* bml-lint-disable-next-line */
            x = 10 / 0;
        `;

const t2 = `
            // Bml-Lint-Disable-Next-Line
            x = 10 / 0;
        `;

console.log('=== Test 1: block comment ===');
const d1 = lintText(t1);
d1.forEach(d => console.log(`  line=${d.range.start.line} code=${d.code} msg=${d.message.slice(0,80)}`));

console.log('\n=== Test 2: mixed case ===');
const d2 = lintText(t2);
d2.forEach(d => console.log(`  line=${d.range.start.line} code=${d.code} msg=${d.message.slice(0,80)}`));
