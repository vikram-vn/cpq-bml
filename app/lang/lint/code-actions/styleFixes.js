const vscode = require('vscode');

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

function toCamelCase(name) {
    if (!name) return name;
    const parts = name.split('_').filter(p => p.length > 0);
    if (parts.length === 0) return name;
    
    let result = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        result += part.charAt(0).toUpperCase() + part.slice(1);
    }
    return result;
}

function formatBooleanName(name) {
    const camel = toCamelCase(name);
    if (/^(is|has)[A-Z]/.test(camel)) {
        return camel;
    }
    return 'is' + camel.charAt(0).toUpperCase() + camel.slice(1);
}

function getStyleFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-unguarded-print') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const action = new vscode.CodeAction('Comment out print statement', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(lineIndex, indent.length);
        action.edit.insert(document.uri, insertPos, '// ');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-variable-camelcase') {
        const name = document.getText(editRange);
        const newName = toCamelCase(name);
        if (newName && newName !== name) {
            // 1. Line-level Fix: Convert this variable across all occurrences (PREFERRED)
            const action = new vscode.CodeAction(`Convert '${name}' to camelCase '${newName}' (all occurrences)`, vscode.CodeActionKind.QuickFix);
            action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            renameIdentifierInDocument(document, name, newName, action.edit);
            action.diagnostics = [diag];
            fixes.push(action);

            // 2. File-level Fix: Convert all underscore variables to camelCase across entire file
            const fileAction = new vscode.CodeAction('Convert all underscore variables to camelCase in entire file', vscode.CodeActionKind.QuickFix);
            fileAction.edit = new vscode.WorkspaceEdit();
            const text = document.getText();
            const varPattern = /\b([a-z][a-zA-Z0-9_]*_[a-zA-Z0-9_]*)\b/g;
            const distinctVars = new Set();
            let m;
            while ((m = varPattern.exec(text)) !== null) {
                distinctVars.add(m[1]);
            }
            for (const varName of distinctVars) {
                const camel = toCamelCase(varName);
                if (camel && camel !== varName) {
                    renameIdentifierInDocument(document, varName, camel, fileAction.edit);
                }
            }
            fileAction.diagnostics = [diag];
            fixes.push(fileAction);
        }
    }
    else if (diag.code === 'bml-array-naming-suffix' || diag.code === 'bml-dict-naming-suffix' || diag.code === 'bml-recordset-naming-suffix') {
        const name = document.getText(editRange);
        let suffix = 'Array';
        if (diag.code === 'bml-dict-naming-suffix') suffix = 'Dict';
        if (diag.code === 'bml-recordset-naming-suffix') suffix = 'RecordSet';
        const newName = name + suffix;
        const action = new vscode.CodeAction(`Rename '${name}' to '${newName}' (all occurrences)`, vscode.CodeActionKind.QuickFix);
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();
        renameIdentifierInDocument(document, name, newName, action.edit);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-boolean-naming-prefix') {
        const name = document.getText(editRange);
        const newName = formatBooleanName(name);
        const action = new vscode.CodeAction(`Rename '${name}' to '${newName}' (all occurrences)`, vscode.CodeActionKind.QuickFix);
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();
        renameIdentifierInDocument(document, name, newName, action.edit);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-unused-variable' || diag.code === 'bml-unused-loop-var') {
        const varName = document.getText(editRange);
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';

        // 1. Comment out unused variable line
        const commentAction = new vscode.CodeAction(`Comment out unused variable '${varName}' statement`, vscode.CodeActionKind.QuickFix);
        commentAction.edit = new vscode.WorkspaceEdit();
        const commentedLine = `${indent}// ${lineText.trim()}`;
        commentAction.edit.replace(document.uri, document.lineAt(lineIndex).range, commentedLine);
        commentAction.diagnostics = [diag];
        fixes.push(commentAction);

        // 2. Remove unused variable line
        const removeAction = new vscode.CodeAction(`Remove unused variable '${varName}' statement`, vscode.CodeActionKind.QuickFix);
        removeAction.edit = new vscode.WorkspaceEdit();
        const lineRangeWithBreak = document.lineAt(lineIndex).rangeIncludingLineBreak;
        removeAction.edit.delete(document.uri, lineRangeWithBreak);
        removeAction.diagnostics = [diag];
        fixes.push(removeAction);
    }
    else if (diag.code === 'bml-line-too-long') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const splitResult = splitConditionIntoLines(lineText);
        if (splitResult) {
            const action = new vscode.CodeAction('Split condition across multiple lines', vscode.CodeActionKind.QuickFix);
            action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, document.lineAt(lineIndex).range, splitResult);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }

    return fixes;
}

function splitConditionIntoLines(lineText) {
    const match = lineText.match(/^(\s*)(if|elif)\s*\(/i);
    if (!match) return null;

    const baseIndent = match[1];
    const keyword = match[2];
    const condStartIndex = match[0].length;

    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let condEndIndex = -1;

    for (let i = condStartIndex; i < lineText.length; i++) {
        const ch = lineText[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        if (inSingle || inDouble) continue;

        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) {
                condEndIndex = i;
                break;
            }
        }
    }

    if (condEndIndex === -1) return null;

    const condContent = lineText.substring(condStartIndex, condEndIndex);
    const afterCondition = lineText.substring(condEndIndex + 1).trim();

    depth = 0;
    inSingle = false;
    inDouble = false;
    const parts = [];
    let currentPart = '';

    for (let i = 0; i < condContent.length; i++) {
        const ch = condContent[i];
        if (ch === '\\') {
            currentPart += ch + (condContent[i + 1] || '');
            i++;
            continue;
        }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;

        if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

            if (depth === 0) {
                const rest = condContent.substring(i);
                const opMatch = rest.match(/^\b(AND|OR|and|or)\b/);
                if (opMatch && currentPart.trim().length > 0) {
                    parts.push(currentPart.trim());
                    currentPart = opMatch[1] + ' ';
                    i += opMatch[0].length;
                    continue;
                }
            }
        }
        currentPart += ch;
    }

    if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim());
    }

    if (parts.length <= 1) return null;

    const indentUnit = baseIndent.includes('\t') ? '\t' : '    ';
    const continuationIndent = baseIndent + indentUnit;
    const formattedLines = [];

    formattedLines.push(`${baseIndent}${keyword} (${parts[0]}`);
    for (let i = 1; i < parts.length; i++) {
        const isLast = (i === parts.length - 1);
        const closing = isLast ? `)${afterCondition.length > 0 ? ` ${afterCondition}` : ''}` : '';
        formattedLines.push(`${continuationIndent}${parts[i]}${closing}`);
    }

    return formattedLines.join('\n');
}

module.exports = { getStyleFixes, splitConditionIntoLines };
