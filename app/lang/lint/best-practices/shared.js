const vscode = require('vscode');

// All diagnostics carry a stable .code so they can be targeted individually
// by inline suppression comments (// bml-lint-disable-line <code>) and by
// codeActions.js's quick fixes.
function makeDiagnostic(range, message, severity, code) {
    const diag = new vscode.Diagnostic(range, message, severity);
    diag.code = code;
    return diag;
}

// Finds the index of the ')' that closes the '(' at openParenIndex.
function findMatchingParenEnd(text, openParenIndex) {
    let depth = 1;
    for (let i = openParenIndex + 1; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

// Splits a function call's argument text on top-level commas, respecting
// quoted strings and nested (), [], {} so a comma inside a string literal
// or a nested call isn't mistaken for an argument separator.
function splitTopLevelArgs(argsText) {
    const args = [];
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let current = '';
    for (let i = 0; i < argsText.length; i++) {
        const ch = argsText[i];
        if (ch === '\\' && i + 1 < argsText.length) {
            current += ch + argsText[i + 1];
            i++;
            continue;
        }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;

        if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth--;
            else if (ch === ',' && depth === 0) {
                args.push(current);
                current = '';
                continue;
            }
        }
        current += ch;
    }
    if (current.trim() !== '' || args.length > 0) args.push(current);
    return args.map((a) => a.trim());
}

module.exports = { vscode, makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs };
