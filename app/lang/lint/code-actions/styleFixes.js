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

        // 1. Condition split (if / elif)
        const condSplit = splitConditionIntoLines(lineText);
        if (condSplit) {
            const action = new vscode.CodeAction('Split condition across multiple lines', vscode.CodeActionKind.QuickFix);
            action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, document.lineAt(lineIndex).range, condSplit);
            action.diagnostics = [diag];
            fixes.push(action);
        }

        // 2. String concatenation split (+)
        const concatSplit = splitConcatenationIntoLines(lineText);
        if (concatSplit) {
            const action = new vscode.CodeAction('Split string concatenation across multiple lines', vscode.CodeActionKind.QuickFix);
            if (!condSplit) action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, document.lineAt(lineIndex).range, concatSplit);
            action.diagnostics = [diag];
            fixes.push(action);
        }

        // 3. Long string literal split (chunking long strings)
        const stringSplit = splitLongStringLiteral(lineText);
        if (stringSplit && stringSplit !== concatSplit) {
            const action = new vscode.CodeAction('Split long string literal across multiple lines', vscode.CodeActionKind.QuickFix);
            if (!condSplit && !concatSplit) action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, document.lineAt(lineIndex).range, stringSplit);
            action.diagnostics = [diag];
            fixes.push(action);
        }

        // 4. Function arguments split (,)
        const argsSplit = splitFunctionArgumentsIntoLines(lineText);
        if (argsSplit && argsSplit !== concatSplit && argsSplit !== stringSplit) {
            const action = new vscode.CodeAction('Split arguments across multiple lines', vscode.CodeActionKind.QuickFix);
            if (!condSplit && !concatSplit && !stringSplit) action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, document.lineAt(lineIndex).range, argsSplit);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }

    return fixes;
}

const {
    findStringLiterals,
    chunkStringContent,
    splitLongStringLiteral,
    splitConcatenationIntoLines,
    splitFunctionArgumentsIntoLines,
    splitConditionIntoLines
} = require('./styleSplitters');

module.exports = {
    getStyleFixes,
    splitConditionIntoLines,
    splitConcatenationIntoLines,
    splitLongStringLiteral,
    splitFunctionArgumentsIntoLines,
    findStringLiterals,
    chunkStringContent
};
