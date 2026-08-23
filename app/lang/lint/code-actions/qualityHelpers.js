const vscode = require('vscode');

function toUpperSnakeCase(ident) {
    return ident
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toUpperCase();
}

function inferConstantCandidateName(lineText, charPos, val) {
    const valStr = String(val);
    const safeValFallback = 'CONST_' + valStr.replace(/[^0-9]/g, '_');
    const prefix = lineText.substring(0, charPos);
    const suffix = lineText.substring(charPos + valStr.length);

    const assignMatch = prefix.match(/(?:(?:string|integer|float|boolean|dict|json|jsonarray|date)\s+)?([a-zA-Z_]\w*)\s*=\s*[+-]?\s*$/i);
    if (assignMatch) {
        const varName = assignMatch[1];
        const upper = toUpperSnakeCase(varName);
        if (upper.endsWith('_DEFAULT') || upper.endsWith('_CONST') || upper.endsWith('_LIMIT') || upper.endsWith('_RATE')) {
            return upper;
        }
        return `${upper}_DEFAULT`;
    }

    const compMatch = prefix.match(/([a-zA-Z_]\w*)\s*(>|>=|<|<=|==|!=)\s*$/);
    if (compMatch) {
        const varName = compMatch[1];
        const op = compMatch[2];
        const upper = toUpperSnakeCase(varName);
        if (op === '>' || op === '>=') {
            return `${upper}_LIMIT`;
        } else if (op === '<' || op === '<=') {
            return `${upper}_MIN_LIMIT`;
        } else {
            return `${upper}_TARGET`;
        }
    }

    const rightCompMatch = suffix.match(/^\s*(>|>=|<|<=|==|!=)\s*([a-zA-Z_]\w*)/);
    if (rightCompMatch) {
        const op = rightCompMatch[1];
        const varName = rightCompMatch[2];
        const upper = toUpperSnakeCase(varName);
        if (op === '<' || op === '<=') {
            return `${upper}_LIMIT`;
        } else if (op === '>' || op === '>=') {
            return `${upper}_MIN_LIMIT`;
        } else {
            return `${upper}_TARGET`;
        }
    }

    return safeValFallback;
}

function renameIdentifierInDocument(document, oldName, newName, edit) {
    const text = document.getText();
    const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + oldName.length);
        edit.replace(document.uri, new vscode.Range(startPos, endPos), newName);
    }
}

function renameLiteralNumberInDocument(document, val, newName, edit) {
    const text = document.getText();
    const regex = new RegExp(`(?<![a-zA-Z0-9_.])\\b${val.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b(?![a-zA-Z0-9_.])`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + val.length);
        edit.replace(document.uri, new vscode.Range(startPos, endPos), newName);
    }
}

module.exports = {
    toUpperSnakeCase,
    inferConstantCandidateName,
    renameIdentifierInDocument,
    renameLiteralNumberInDocument
};
