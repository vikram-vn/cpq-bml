let vscode;
try {
    vscode = require('vscode');
} catch {
    vscode = {};
}

/**
 * Walks forward from start of document to cursor to parse active function call and parameter index.
 * Ignores brackets/commas inside strings and comments.
 */
function getActiveFunctionCall(document, position) {
    const startLine = Math.max(0, position.line - 60);
    const text = document.getText(new vscode.Range(new vscode.Position(startLine, 0), position));
    const stack = [];
    const KEYWORDS = new Set(['if', 'elif', 'else', 'for', 'while', 'return']);
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
                i++;
            }
            continue;
        }

        if (char === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                i++;
            }
            i += 2;
            continue;
        }

        if (char === '"') {
            i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++;
            continue;
        }

        if (char === "'") {
            i++;
            while (i < text.length && text[i] !== "'") {
                if (text[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++;
            continue;
        }

        if (char === '(') {
            let endIdx = i;
            let startIdx = i - 1;
            while (startIdx >= 0 && /\s/.test(text[startIdx])) {
                startIdx--;
            }
            let idEnd = startIdx + 1;
            while (startIdx >= 0 && /[\w.]/.test(text[startIdx])) {
                startIdx--;
            }
            const funcName = text.substring(startIdx + 1, idEnd).trim();
            if (/^[a-zA-Z_]/.test(funcName) && !KEYWORDS.has(funcName.toLowerCase())) {
                stack.push({ funcName, paramIndex: 0 });
            } else {
                stack.push({ funcName: '', paramIndex: 0 });
            }
        } else if (char === ')') {
            if (stack.length > 0) {
                stack.pop();
            }
        } else if (char === ',') {
            if (stack.length > 0) {
                stack[stack.length - 1].paramIndex++;
            }
        }

        i++;
    }

    for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].funcName) {
            return stack[j];
        }
    }

    return null;
}

/**
 * Helper to parse ParameterInformation objects from signature string.
 */
function parseParameters(signature) {
    const match = signature.match(/\((.*)\)/);
    if (!match) return [];
    const paramStr = match[1].trim();
    if (!paramStr) return [];
    return paramStr.split(',').map(p => {
        const label = p.replace(/[\[\]]/g, '').trim();
        return new vscode.ParameterInformation(label);
    });
}

module.exports = { getActiveFunctionCall, parseParameters };
