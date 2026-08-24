function getStringRanges(text) {
    const stringRanges = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let start = -1;
    const len = text.length;

    for (let i = 0; i < len; i++) {
        const char = text.charCodeAt(i);
        if (char === 92) { // '\\'
            i++; // skip escaped char
            continue;
        }
        if (char === 39 && !inDoubleQuote) { // "'"
            if (!inSingleQuote) {
                inSingleQuote = true;
                start = i;
            } else {
                inSingleQuote = false;
                stringRanges.push([start, i + 1]);
            }
        } else if (char === 34 && !inSingleQuote) { // '"'
            if (!inDoubleQuote) {
                inDoubleQuote = true;
                start = i;
            } else {
                inDoubleQuote = false;
                stringRanges.push([start, i + 1]);
            }
        }
    }
    return stringRanges;
}

function checkUnclosedStrings(cleanText, doc, vscode) {
    const diagnostics = [];
    const lines = cleanText.split(/\r?\n/);
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const lineText = lines[lineIndex];
        if (!lineText.includes('"') && !lineText.includes("'")) {
            continue;
        }
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let startCharIndex = -1;

        for (let i = 0; i < lineText.length; i++) {
            const char = lineText[i];
            if (char === '\\') {
                i++; // skip escaped char
                continue;
            }
            if (char === "'" && !inDoubleQuote) {
                if (!inSingleQuote) {
                    inSingleQuote = true;
                    startCharIndex = i;
                } else {
                    inSingleQuote = false;
                }
            } else if (char === '"' && !inSingleQuote) {
                if (!inDoubleQuote) {
                    inDoubleQuote = true;
                    startCharIndex = i;
                } else {
                    inDoubleQuote = false;
                }
            }
        }

        if (inDoubleQuote) {
            const startPos = new vscode.Position(lineIndex, startCharIndex);
            const endPos = new vscode.Position(lineIndex, lineText.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                "BML Syntax Error: Unclosed double-quoted string literal.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-unclosed-string';
            diagnostics.push(diag);
        } else if (inSingleQuote) {
            const startPos = new vscode.Position(lineIndex, startCharIndex);
            const endPos = new vscode.Position(lineIndex, lineText.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                "BML Syntax Error: Unclosed single-quoted string literal.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-unclosed-string';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { getStringRanges, checkUnclosedStrings };
