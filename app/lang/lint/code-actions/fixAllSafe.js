const vscode = require('vscode');

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

function withPreservedStrings(text, transformFn) {
    const stringLiterals = [];
    const noStrings = text.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
        const id = stringLiterals.length;
        stringLiterals.push(match);
        return `__BML_STR_${id}__`;
    });

    let transformed = transformFn(noStrings);

    transformed = transformed.replace(/__BML_STR_(\d+)__/g, (_, id) => {
        return stringLiterals[Number(id)];
    });

    return transformed;
}

/**
 * Creates a bundled "Fix All Safe Style & Naming Issues in File" CodeAction.
 */
function buildFixAllText(document, relevantDiags) {
    let text = document.getText();

    // 1. Identifier renamings
    const renameMap = new Map();
    for (const diag of relevantDiags) {
        const editRange = diag.originalRange ?? diag.range;
        const name = document.getText(editRange);

        if (diag.code === 'bml-variable-camelcase') {
            const newName = toCamelCase(name);
            if (newName && newName !== name) {
                renameMap.set(name, newName);
            }
        } else if (diag.code === 'bml-dict-naming-suffix') {
            const base = toCamelCase(name);
            renameMap.set(name, base.endsWith('Dict') ? base : base + 'Dict');
        } else if (diag.code === 'bml-array-naming-suffix') {
            const base = toCamelCase(name);
            renameMap.set(name, base.endsWith('Array') ? base : base + 'Array');
        } else if (diag.code === 'bml-recordset-naming-suffix') {
            const base = toCamelCase(name);
            renameMap.set(name, base.endsWith('RecordSet') ? base : base + 'RecordSet');
        } else if (diag.code === 'bml-boolean-naming-prefix') {
            renameMap.set(name, formatBooleanName(name));
        }
    }

    for (const [oldName, newName] of renameMap.entries()) {
        const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
        text = text.replace(regex, newName);
    }

    const eol = text.includes('\r\n') ? '\r\n' : '\n';

    // 2. Comment out unused variable statements
    const unusedDiags = relevantDiags.filter(d => d.code === 'bml-unused-variable' || d.code === 'bml-unused-loop-var');
    if (unusedDiags.length > 0) {
        const unusedLineIndices = new Set(unusedDiags.map(d => (d.originalRange ?? d.range).start.line));
        const lines = text.split(/\r?\n/);
        for (const lineIdx of unusedLineIndices) {
            if (lineIdx < lines.length) {
                const line = lines[lineIdx];
                if (!line.trim().startsWith('//')) {
                    const indentMatch = line.match(/^\s*/);
                    const indent = indentMatch ? indentMatch[0] : '';
                    lines[lineIdx] = `${indent}// ${line.trim()}`;
                }
            }
        }
        text = lines.join(eol);
    }

    // 3. String-preserved cleanups (never alters contents inside "quotes")
    text = withPreservedStrings(text, (code) => {
        // Redundant literal type casts
        code = code.replace(/\binteger\s*\(\s*(\d+)\s*\)/g, '$1');
        code = code.replace(/\bfloat\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g, '$1');
        code = code.replace(/\bboolean\s*\(\s*(true|false)\s*\)/g, '$1');
        code = code.replace(/\bstring\s*\(\s*(__BML_STR_\d+__|[a-zA-Z_]\w*)\s*\)/g, '$1');

        // Redundant boolean comparisons
        code = code.replace(/\b([a-zA-Z_]\w*)\s*==\s*true\b/g, '$1');
        code = code.replace(/\b([a-zA-Z_]\w*)\s*==\s*false\b/g, '!$1');
        code = code.replace(/\b([a-zA-Z_]\w*)\s*!=\s*true\b/g, '!$1');
        code = code.replace(/\b([a-zA-Z_]\w*)\s*!=\s*false\b/g, '$1');
        code = code.replace(/\btrue\s*==\s*([a-zA-Z_]\w*)\b/g, '$1');
        code = code.replace(/\bfalse\s*==\s*([a-zA-Z_]\w*)\b/g, '!$1');

        // Canonical type declaration lowercasing
        code = code.replace(/\b(String|Integer|Float|Boolean|Date|Dict|Json|JsonArray)\b(?=\s+[a-zA-Z_]\w*|\s*\[\])/g, (m) => m.toLowerCase());

        // Canonical boolean literal lowercasing
        code = code.replace(/\b(True|TRUE)\b/g, 'true');
        code = code.replace(/\b(False|FALSE)\b/g, 'false');

        // Empty string concatenation cleanups
        code = code.replace(/__BML_STR_EMPTY__\s*\+\s*([a-zA-Z_]\w*)/g, '$1');
        code = code.replace(/([a-zA-Z_]\w*)\s*\+\s*__BML_STR_EMPTY__/g, '$1');

        // Double semicolons
        code = code.replace(/;\s*;+/g, ';');

        return code;
    });

    // 3. Empty blocks
    if (relevantDiags.some(d => d.code === 'bml-empty-block')) {
        text = text.replace(/\{\s*\}/g, '{\n    // TODO: implement\n}');
    }

    // 4. Multi-statement lines
    if (relevantDiags.some(d => d.code === 'bml-multiple-statements-per-line')) {
        const lines = text.split(/\r?\n/);
        const transformedLines = lines.map(line => {
            const rawLine = line.split('//')[0];
            const semicolonCount = (rawLine.match(/;/g) || []).length;
            if (semicolonCount > 1) {
                const indentMatch = line.match(/^\s*/);
                const indent = indentMatch ? indentMatch[0] : '';
                return line
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .map(s => indent + s + ';')
                    .join(eol);
            }
            return line;
        });
        text = transformedLines.join(eol);
    }

    // 5. Trailing commas
    if (relevantDiags.some(d => d.code === 'bml-trailing-comma-error')) {
        text = text.replace(/,\s*([)}])/g, '$1');
    }

    return text;
}

/**
 * Creates bundled "Fix All Safe Style & Naming Issues in File" and category-level CodeActions for QuickFix and Refactor.
 */
function getFixAllSafeAction(document, diagnostics) {
    const safeDiagCodes = new Set([
        'bml-variable-camelcase',
        'bml-dict-naming-suffix',
        'bml-array-naming-suffix',
        'bml-recordset-naming-suffix',
        'bml-boolean-naming-prefix',
        'bml-unused-variable',
        'bml-unused-loop-var',
        'bml-string-cast-of-string',
        'bml-multiple-statements-per-line',
        'bml-empty-block',
        'bml-trailing-comma-error'
    ]);

    const relevantDiags = diagnostics.filter(d => safeDiagCodes.has(d.code));
    if (relevantDiags.length === 0) {
        return [];
    }

    const actions = [];
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
    );

    // 1. Master Fix-All Action (Available in QuickFix & RefactorRewrite)
    const masterTitle = `Fix All Safe Style & Naming Issues in File (${relevantDiags.length} issue${relevantDiags.length > 1 ? 's' : ''})`;
    const masterText = buildFixAllText(document, relevantDiags);
    const masterEdit = new vscode.WorkspaceEdit();
    masterEdit.replace(document.uri, fullRange, masterText);

    const masterQuickFix = new vscode.CodeAction(masterTitle, vscode.CodeActionKind.QuickFix);
    masterQuickFix.edit = masterEdit;
    masterQuickFix.diagnostics = relevantDiags;
    actions.push(masterQuickFix);

    const masterRefactor = new vscode.CodeAction(masterTitle, vscode.CodeActionKind.RefactorRewrite);
    masterRefactor.edit = masterEdit;
    masterRefactor.diagnostics = relevantDiags;
    actions.push(masterRefactor);

    // 2. Category: Variable camelCase
    const camelDiags = relevantDiags.filter(d => d.code === 'bml-variable-camelcase');
    if (camelDiags.length > 0) {
        const camelTitle = `Convert all variables to camelCase (${camelDiags.length} issue${camelDiags.length > 1 ? 's' : ''})`;
        const camelText = buildFixAllText(document, camelDiags);
        const camelEdit = new vscode.WorkspaceEdit();
        camelEdit.replace(document.uri, fullRange, camelText);
        const camelAction = new vscode.CodeAction(camelTitle, vscode.CodeActionKind.RefactorRewrite);
        camelAction.edit = camelEdit;
        camelAction.diagnostics = camelDiags;
        actions.push(camelAction);
    }

    // 3. Category: CPQ Type Suffixes & Prefixes (Dict, Array, RecordSet, is/has)
    const typeDiags = relevantDiags.filter(d => 
        d.code === 'bml-dict-naming-suffix' || 
        d.code === 'bml-array-naming-suffix' || 
        d.code === 'bml-recordset-naming-suffix' || 
        d.code === 'bml-boolean-naming-prefix'
    );
    if (typeDiags.length > 0) {
        const typeTitle = `Apply CPQ type naming conventions (Dict, Array, is/has) (${typeDiags.length} issue${typeDiags.length > 1 ? 's' : ''})`;
        const typeText = buildFixAllText(document, typeDiags);
        const typeEdit = new vscode.WorkspaceEdit();
        typeEdit.replace(document.uri, fullRange, typeText);
        const typeAction = new vscode.CodeAction(typeTitle, vscode.CodeActionKind.RefactorRewrite);
        typeAction.edit = typeEdit;
        typeAction.diagnostics = typeDiags;
        actions.push(typeAction);
    }

    // 4. Category: Syntax & Formatting (Multi-statement lines, Empty blocks, Trailing commas)
    const syntaxDiags = relevantDiags.filter(d => 
        d.code === 'bml-multiple-statements-per-line' || 
        d.code === 'bml-empty-block' || 
        d.code === 'bml-trailing-comma-error'
    );
    if (syntaxDiags.length > 0) {
        const syntaxTitle = `Format multi-statement lines & fill empty blocks (${syntaxDiags.length} issue${syntaxDiags.length > 1 ? 's' : ''})`;
        const syntaxText = buildFixAllText(document, syntaxDiags);
        const syntaxEdit = new vscode.WorkspaceEdit();
        syntaxEdit.replace(document.uri, fullRange, syntaxText);
        const syntaxAction = new vscode.CodeAction(syntaxTitle, vscode.CodeActionKind.RefactorRewrite);
        syntaxAction.edit = syntaxEdit;
        syntaxAction.diagnostics = syntaxDiags;
        actions.push(syntaxAction);
    }

    // 5. Category: Unused Variables
    const unusedDiags = relevantDiags.filter(d => d.code === 'bml-unused-variable' || d.code === 'bml-unused-loop-var');
    if (unusedDiags.length > 0) {
        const unusedTitle = `Comment out all unused variable statements (${unusedDiags.length} issue${unusedDiags.length > 1 ? 's' : ''})`;
        const unusedText = buildFixAllText(document, unusedDiags);
        const unusedEdit = new vscode.WorkspaceEdit();
        unusedEdit.replace(document.uri, fullRange, unusedText);
        const unusedAction = new vscode.CodeAction(unusedTitle, vscode.CodeActionKind.RefactorRewrite);
        unusedAction.edit = unusedEdit;
        unusedAction.diagnostics = unusedDiags;
        actions.push(unusedAction);
    }

    // 6. Category: Redundant Casts & Expression Simplification
    const castDiags = relevantDiags.filter(d => d.code === 'bml-string-cast-of-string');
    if (castDiags.length > 0) {
        const castTitle = `Simplify redundant string casts & boolean expressions (${castDiags.length} issue${castDiags.length > 1 ? 's' : ''})`;
        const castText = buildFixAllText(document, castDiags);
        const castEdit = new vscode.WorkspaceEdit();
        castEdit.replace(document.uri, fullRange, castText);
        const castAction = new vscode.CodeAction(castTitle, vscode.CodeActionKind.RefactorRewrite);
        castAction.edit = castEdit;
        castAction.diagnostics = castDiags;
        actions.push(castAction);
    }

    return actions;
}

module.exports = { getFixAllSafeAction };
