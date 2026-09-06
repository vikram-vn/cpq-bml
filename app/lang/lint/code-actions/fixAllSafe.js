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

const { getDeclaredVariables } = require('../rules/variables');
const { getCommentRanges } = require('../rules/comments');
const { getStringRanges } = require('../rules/strings');

function blankRangesFast(text, ranges) {
    if (!ranges || ranges.length === 0) return text;
    let res = '';
    let last = 0;
    for (let i = 0; i < ranges.length; i++) {
        const [start, end] = ranges[i];
        if (start > last) res += text.slice(last, start);
        const chunk = text.slice(start, end);
        res += chunk.replace(/[^\r\n]/g, ' ');
        last = end;
    }
    if (last < text.length) res += text.slice(last);
    return res;
}

/**
 * Creates a bundled "Fix All Safe Style & Naming Issues in File" CodeAction.
 */
function buildFixAllText(document, relevantDiags, initialAst, isCategory = false) {
    let text = document.getText();
    if (!relevantDiags || relevantDiags.length === 0) return text;

    let astContext = initialAst || null;
    function getAst() {
        if (astContext) return astContext;
        const commentRanges = getCommentRanges(text);
        const cleanText = blankRangesFast(text, commentRanges);
        const stringRanges = getStringRanges(cleanText);
        const noStringsText = blankRangesFast(cleanText, stringRanges);
        const declaredVars = getDeclaredVariables(noStringsText, document);
        astContext = { commentRanges, cleanText, stringRanges, noStringsText, declaredVars };
        return astContext;
    }

    const hasMagic = relevantDiags.some(d => d.code === 'bml-magic-number');
    const hasCamel = relevantDiags.some(d => d.code === 'bml-variable-camelcase');
    const hasDictSuffix = relevantDiags.some(d => d.code === 'bml-dict-naming-suffix');
    const hasArraySuffix = relevantDiags.some(d => d.code === 'bml-array-naming-suffix');
    const hasRecordSetSuffix = relevantDiags.some(d => d.code === 'bml-recordset-naming-suffix');
    const hasBoolPrefix = relevantDiags.some(d => d.code === 'bml-boolean-naming-prefix');
    const hasNaming = hasCamel || hasDictSuffix || hasArraySuffix || hasRecordSetSuffix || hasBoolPrefix;

    // 1. Identifier renamings (Constants take priority over camelCase)
    const renameMap = new Map();
    const constantVars = new Set();

    if (hasMagic) {
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
    }

    if (hasNaming) {
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
        try {
            const { declaredVars } = getAst();
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

    if (renameMap.size > 0) {
        const sortedKeys = Array.from(renameMap.keys()).sort((a, b) => b.length - a.length);
        const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'));
        const combinedRegex = new RegExp(`\\b(${escapedKeys.join('|')})\\b`, 'g');
        text = text.replace(combinedRegex, (match) => renameMap.get(match) || match);
    }

    const eol = text.includes('\r\n') ? '\r\n' : '\n';

    // 2. Cascading Unused Variable & Empty Block Cleanups
    const unusedDiags = relevantDiags.filter(d => d.code === 'bml-unused-variable' || d.code === 'bml-unused-loop-var');
    if (unusedDiags.length > 0) {
        const initialUnusedNames = new Set();
        for (const diag of unusedDiags) {
            const editRange = diag.originalRange ?? diag.range;
            const name = document.getText(editRange).trim();
            if (name) initialUnusedNames.add(name);
        }

        let currentUnusedNames = new Set(initialUnusedNames);
        try {
            const { noStringsText, declaredVars, cleanText } = getAst();
            currentUnusedNames = computeTransitiveUnusedVariables(noStringsText, declaredVars, document, cleanText, initialUnusedNames);
        } catch (e) {
            // Fallback gracefully
        }

        if (currentUnusedNames.size > 0) {
            text = commentOutUnusedAssignments(text, currentUnusedNames, renameMap, eol);
        }

        if (text.includes('if') || text.includes('for') || text.includes('while')) {
            text = commentOutEmptyConditionalChains(text, eol);
            text = commentOutEmptyLoops(text, eol);
        }
    }

    // 3. String-preserved cleanups (never alters contents inside "quotes")
    const hasCastDiag = relevantDiags.some(d => d.code === 'bml-string-cast-of-string');
    if (!isCategory || hasCastDiag) {
        text = withPreservedStrings(text, (code) => {
            code = code.replace(/\binteger\s*\(\s*(\d+)\s*\)/g, '$1');
            code = code.replace(/\bfloat\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g, '$1');
            code = code.replace(/\bboolean\s*\(\s*(true|false)\s*\)/g, '$1');
            code = code.replace(/\bstring\s*\(\s*(__BML_STR_\d+__)\s*\)/g, '$1');
            code = code.replace(/\b([a-zA-Z_]\w*)\s*==\s*true\b/g, '$1');
            code = code.replace(/\b([a-zA-Z_]\w*)\s*==\s*false\b/g, 'NOT($1)');
            code = code.replace(/\b([a-zA-Z_]\w*)\s*!=\s*true\b/g, 'NOT($1)');
            code = code.replace(/\b([a-zA-Z_]\w*)\s*!=\s*false\b/g, '$1');
            code = code.replace(/\btrue\s*==\s*([a-zA-Z_]\w*)\b/g, '$1');
            code = code.replace(/\bfalse\s*==\s*([a-zA-Z_]\w*)\b/g, 'NOT($1)');
            code = code.replace(/\b(String|Integer|Float|Boolean|Date|Dict|Json|JsonArray)\b(?=\s+[a-zA-Z_]\w*|\s*\[\])/g, (m) => m.toLowerCase());
            code = code.replace(/\b(True|TRUE)\b/g, 'true');
            code = code.replace(/\b(False|FALSE)\b/g, 'false');
            code = code.replace(/__BML_STR_EMPTY__\s*\+\s*([a-zA-Z_]\w*)/g, '$1');
            code = code.replace(/([a-zA-Z_]\w*)\s*\+\s*__BML_STR_EMPTY__/g, '$1');
            code = code.replace(/;\s*;+/g, ';');
            return code;
        });
    }

    // 4. Empty blocks
    if (relevantDiags.some(d => d.code === 'bml-empty-block')) {
        text = text.replace(/\{\s*\}/g, '{\n    // TODO: implement\n}');
    }

    // 5. Multi-statement lines
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

    // 6. Trailing commas
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

    const baseText = document.getText();
    const commentRanges = getCommentRanges(baseText);
    const cleanText = blankRangesFast(baseText, commentRanges);
    const stringRanges = getStringRanges(cleanText);
    const noStringsText = blankRangesFast(cleanText, stringRanges);
    const declaredVars = getDeclaredVariables(noStringsText, document);
    const sharedAst = { commentRanges, cleanText, stringRanges, noStringsText, declaredVars };

    const actions = [];
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(baseText.length)
    );

    // 1. Master Fix-All Action (Available in QuickFix & RefactorRewrite)
    const masterTitle = `Fix All Safe Style & Naming Issues in File (${relevantDiags.length} issue${relevantDiags.length > 1 ? 's' : ''})`;
    const masterText = buildFixAllText(document, relevantDiags, sharedAst, false);
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

    function addCategoryAction(categoryDiags, titleGenerator) {
        if (!categoryDiags || categoryDiags.length === 0) return;
        const text = (categoryDiags.length === relevantDiags.length)
            ? masterText
            : buildFixAllText(document, categoryDiags, sharedAst, true);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, text);
        const action = new vscode.CodeAction(titleGenerator(categoryDiags.length), vscode.CodeActionKind.RefactorRewrite);
        action.edit = edit;
        action.diagnostics = categoryDiags;
        actions.push(action);
    }

    // 2. Category: Variable camelCase
    addCategoryAction(
        relevantDiags.filter(d => d.code === 'bml-variable-camelcase'),
        (count) => `Convert all variables to camelCase (${count} issue${count > 1 ? 's' : ''})`
    );

    // 3. Category: CPQ Type Suffixes & Prefixes
    addCategoryAction(
        relevantDiags.filter(d => 
            d.code === 'bml-dict-naming-suffix' || 
            d.code === 'bml-array-naming-suffix' || 
            d.code === 'bml-recordset-naming-suffix' || 
            d.code === 'bml-boolean-naming-prefix'
        ),
        (count) => `Apply CPQ type naming conventions (Dict, Array, is/has) (${count} issue${count > 1 ? 's' : ''})`
    );

    // 4. Category: Direct Magic Number Constants
    addCategoryAction(
        relevantDiags.filter(d => d.code === 'bml-magic-number'),
        (count) => `Convert direct magic number variables to named constants (${count} issue${count > 1 ? 's' : ''})`
    );

    // 5. Category: Syntax & Formatting
    addCategoryAction(
        relevantDiags.filter(d => 
            d.code === 'bml-multiple-statements-per-line' || 
            d.code === 'bml-empty-block' || 
            d.code === 'bml-trailing-comma-error'
        ),
        (count) => `Format multi-statement lines & fill empty blocks (${count} issue${count > 1 ? 's' : ''})`
    );

    // 6. Category: Unused Variables
    addCategoryAction(
        relevantDiags.filter(d => d.code === 'bml-unused-variable' || d.code === 'bml-unused-loop-var'),
        (count) => `Comment out all unused variable statements (${count} issue${count > 1 ? 's' : ''})`
    );

    // 7. Category: Redundant Casts & Expression Simplification
    addCategoryAction(
        relevantDiags.filter(d => d.code === 'bml-string-cast-of-string'),
        (count) => `Simplify redundant string casts & boolean expressions (${count} issue${count > 1 ? 's' : ''})`
    );

    return actions;
}

module.exports = { getFixAllSafeAction, buildFixAllText };
