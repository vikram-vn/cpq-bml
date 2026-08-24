const vscode = require('vscode');
const { inferConstantCandidateName } = require('./qualityHelpers');
const {
    toCamelCase,
    formatBooleanName,
    withPreservedStrings,
    commentOutEmptyConditionalChains,
    commentOutEmptyLoops,
    computeTransitiveUnusedVariables,
    commentOutUnusedAssignments
} = require('./cascadingCleanup');

/**
 * Creates a bundled "Fix All Safe Style & Naming Issues in File" CodeAction.
 */
function buildFixAllText(document, relevantDiags) {
    let text = document.getText();

    // 1. Identifier renamings (Constants take priority over camelCase)
    const renameMap = new Map();
    const constantVars = new Set();

    for (const diag of relevantDiags) {
        if (diag.code === 'bml-magic-number') {
            const editRange = diag.originalRange ?? diag.range;
            const val = document.getText(editRange);
            const lineText = document.lineAt(editRange.start.line).text;
            const prefix = lineText.substring(0, editRange.start.character);
            const suffix = lineText.substring(editRange.start.character + val.length);
            const directAssignMatch = prefix.match(/(?:(?:string|integer|float|boolean|dict|json|jsonarray|date)\s+)?([a-zA-Z_]\w*)\s*=\s*$/i);
            const isPureAssignment = directAssignMatch && (/^[\s;]*$/.test(suffix));
            if (isPureAssignment) {
                const varName = directAssignMatch[1];
                const constName = inferConstantCandidateName(lineText, editRange.start.character, val);
                renameMap.set(varName, constName);
                constantVars.add(varName);
            }
        }
    }

    for (const diag of relevantDiags) {
        const editRange = diag.originalRange ?? diag.range;
        const name = document.getText(editRange);
        if (constantVars.has(name)) continue;

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

    // Scan all declared variables across the entire document to ensure 100% file-level coverage
    if (relevantDiags.some(d => d.code === 'bml-variable-camelcase' || d.code === 'bml-dict-naming-suffix' || d.code === 'bml-array-naming-suffix' || d.code === 'bml-recordset-naming-suffix' || d.code === 'bml-boolean-naming-prefix')) {
        try {
            const { getDeclaredVariables } = require('../rules/variables');
            const { getCommentRanges } = require('../rules/comments');
            const { getStringRanges } = require('../rules/strings');

            const commentRanges = getCommentRanges(text);
            const buf = Buffer.from(text, 'utf8');
            for (const [start, end] of commentRanges) {
                for (let i = start; i < end; i++) {
                    if (buf[i] !== 10 && buf[i] !== 13) buf[i] = 32;
                }
            }
            const cleanText = buf.toString('utf8');
            const stringRanges = getStringRanges(cleanText);
            for (const [start, end] of stringRanges) {
                for (let i = start; i < end; i++) {
                    if (buf[i] !== 10 && buf[i] !== 13) buf[i] = 32;
                }
            }
            const noStringsText = buf.toString('utf8');

            const declaredVars = getDeclaredVariables(noStringsText, document);
            for (const [varName] of declaredVars.entries()) {
                if (constantVars.has(varName)) continue;
                if (/^[A-Z0-9_]+$/.test(varName)) continue; // skip ALL_CAPS constants
                if (/^_/.test(varName)) continue; // skip system variables

                if (!/^[a-z][a-zA-Z0-9]*$/.test(varName)) {
                    const newName = toCamelCase(varName);
                    if (newName && newName !== varName) {
                        renameMap.set(varName, newName);
                    }
                }
            }
        } catch (e) {
            // fallback gracefully
        }
    }

    for (const [oldName, newName] of renameMap.entries()) {
        const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
        text = text.replace(regex, newName);
    }

    const eol = text.includes('\r\n') ? '\r\n' : '\n';

    // 2. Multi-pass Cascading Unused Variable & Empty Block Cleanups
    const unusedDiags = relevantDiags.filter(d => d.code === 'bml-unused-variable' || d.code === 'bml-unused-loop-var');
    const initialUnusedNames = new Set();

    for (const diag of unusedDiags) {
        const editRange = diag.originalRange ?? diag.range;
        const name = document.getText(editRange).trim();
        if (name) initialUnusedNames.add(name);
    }

    let globalChanged = true;
    let globalPass = 0;
    while (globalChanged && globalPass < 5) {
        const passStartText = text;
        globalPass++;

        let currentUnusedNames = new Set(initialUnusedNames);

        try {
            const { getDeclaredVariables } = require('../rules/variables');
            const { getCommentRanges } = require('../rules/comments');
            const { getStringRanges } = require('../rules/strings');

            const commentRanges = getCommentRanges(text);
            const buf = Buffer.from(text, 'utf8');
            for (const [start, end] of commentRanges) {
                for (let i = start; i < end; i++) {
                    if (buf[i] !== 10 && buf[i] !== 13) buf[i] = 32;
                }
            }
            const cleanText = buf.toString('utf8');
            const stringRanges = getStringRanges(cleanText);
            for (const [start, end] of stringRanges) {
                for (let i = start; i < end; i++) {
                    if (buf[i] !== 10 && buf[i] !== 13) buf[i] = 32;
                }
            }
            const noStringsText = buf.toString('utf8');
            const declaredVars = getDeclaredVariables(noStringsText, document);

            currentUnusedNames = computeTransitiveUnusedVariables(noStringsText, declaredVars, document, cleanText, initialUnusedNames);
        } catch (e) {
            // Fallback gracefully
        }

        if (currentUnusedNames.size > 0) {
            text = commentOutUnusedAssignments(text, currentUnusedNames, renameMap, eol);
        }

        let blockChanged = true;
        let collapseIter = 0;
        while (blockChanged && collapseIter < 5) {
            const prevBlockText = text;
            text = commentOutEmptyConditionalChains(text, eol);
            text = commentOutEmptyLoops(text, eol);
            blockChanged = text !== prevBlockText;
            collapseIter++;
        }

        globalChanged = text !== passStartText;
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
        'bml-magic-number',
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

    // 4. Category: Direct Magic Number Constants
    const magicDiags = relevantDiags.filter(d => d.code === 'bml-magic-number');
    if (magicDiags.length > 0) {
        const magicTitle = `Convert direct magic number variables to named constants (${magicDiags.length} issue${magicDiags.length > 1 ? 's' : ''})`;
        const magicText = buildFixAllText(document, magicDiags);
        const magicEdit = new vscode.WorkspaceEdit();
        magicEdit.replace(document.uri, fullRange, magicText);
        const magicAction = new vscode.CodeAction(magicTitle, vscode.CodeActionKind.RefactorRewrite);
        magicAction.edit = magicEdit;
        magicAction.diagnostics = magicDiags;
        actions.push(magicAction);
    }

    // 5. Category: Syntax & Formatting (Multi-statement lines, Empty blocks, Trailing commas)
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

    // 6. Category: Unused Variables
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

    // 7. Category: Redundant Casts & Expression Simplification
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
