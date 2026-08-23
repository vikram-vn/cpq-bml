const { getCommentRanges } = require('./comments');
const { getConditionRanges } = require('./conditions');
const { getDeclaredVariables, checkVariableDiagnostics } = require('./variables');
const { checkMissingSemicolons } = require('./semicolon');
const { checkAssignmentInCondition } = require('./assignment');
const { checkOperators } = require('./operators');
const { checkPerformance } = require('./performance');
const { checkBestPractices } = require('./best-practices');
const { checkStyle } = require('./style');
const { checkBoundaries } = require('./boundaries');
const { checkFunctionCalls } = require('./functions');
const { checkSystemVariables } = require('./systemVariables');
const { checkAssignmentTypeConsistency, collectVariableTypes, inferLiteralType } = require('./typeCheck');
const { checkMetadataTypeConsistency, getDeclaredParameterTypes } = require('./metadataTypes');
const { checkConstantConditions } = require('./constantConditions');
const { checkUnreachableCode } = require('./unreachable');
const { checkDuplicateConditionBranches, parseConditionalChains } = require('./duplicateBranches');
const { checkMixedOperators } = require('./mixedOperators');
const { checkLonelyIf } = require('./lonelyIf');
const { checkUnusedExpressions } = require('./unusedExpressions');
const { checkUseBeforeDefine } = require('./useBeforeDefine');
const { getStringRanges, checkUnclosedStrings } = require('./strings');
const { computeSuppressions } = require('./suppressions');
const { checkSpelling } = require('../spell-check/spelling');
const { checkNullSafety } = require('./nullSafety');
const { checkInfiniteLoop } = require('./infiniteLoop');
const { checkShadowedVariables } = require('./shadowedVariables');
const { checkCommerceAttributes } = require('./commerceAttributes');



// Preserves \n/\r so line numbers (and thus diagnostic positions) stay correct.
function blankRanges(text, ranges) {
    if (!ranges || ranges.length === 0) return text;
    const buf = Buffer.from(text, 'utf8');
    for (const [start, end] of ranges) {
        for (let i = start; i < end; i++) {
            const b = buf[i];
            if (b !== 10 && b !== 13) {
                buf[i] = 32; // ' '
            }
        }
    }
    return buf.toString('utf8');
}

function lintBMLCustom(doc, diagnosticCollection, vscode, extensionPath) {
    const isBml = doc.languageId === 'bml' || (doc.uri && doc.uri.fsPath && doc.uri.fsPath.endsWith('.bml'));
    if (!isBml) return;

    const text = doc.getText();
    const lines = text.split(/\r?\n/);
    const diagnostics = [];
    const isLintEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.lint', true);
    const isSpellingEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.spelling', true);

    const commentRanges = getCommentRanges(text);
    const conditionRanges = getConditionRanges(text);

    const cleanText = blankRanges(text, commentRanges);

    // noStringsText additionally blanks strings, for checks that must not match inside string literals.
    const stringRanges = getStringRanges(cleanText);
    const noStringsText = blankRanges(cleanText, stringRanges);

    // Fast keyword pre-checks to skip irrelevant checker passes
    const hasConditions = conditionRanges.length > 0 || cleanText.includes('if') || cleanText.includes('elif');
    const hasLoops = noStringsText.includes('for') || noStringsText.includes('while');
    const hasCommerce = cleanText.includes('commerce.') || cleanText.includes('line.') || cleanText.includes('transaction.');

    if (isLintEnabled) {
        const declaredVars = getDeclaredVariables(noStringsText, doc);
        diagnostics.push(...checkVariableDiagnostics(noStringsText, declaredVars, doc, cleanText));

        diagnostics.push(...checkMissingSemicolons(cleanText, noStringsText, conditionRanges));
        if (hasConditions) {
            diagnostics.push(...checkAssignmentInCondition(noStringsText, conditionRanges, doc));
        }
        diagnostics.push(...checkOperators(noStringsText, doc));
        diagnostics.push(...checkPerformance(cleanText, noStringsText, doc));
        const declaredParamTypes = getDeclaredParameterTypes(doc.uri && doc.uri.fsPath);
        const firstTypeByVar = collectVariableTypes(cleanText, doc, declaredParamTypes);

        diagnostics.push(...checkBestPractices(cleanText, noStringsText, doc, firstTypeByVar));
        diagnostics.push(...checkStyle(cleanText, noStringsText, doc, declaredVars, extensionPath, firstTypeByVar));

        diagnostics.push(...checkBoundaries(cleanText, noStringsText, doc));
        diagnostics.push(...checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath, firstTypeByVar));
        diagnostics.push(...checkSystemVariables(noStringsText, doc, vscode, extensionPath));

        diagnostics.push(...checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredParamTypes, extensionPath, noStringsText, firstTypeByVar));
        diagnostics.push(...checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType, extensionPath));
        
        if (hasConditions) {
            diagnostics.push(...checkConstantConditions(cleanText, conditionRanges, doc, vscode));

            // Shared parse so duplicateBranches, lonelyIf, and unreachable don't each re-parse the whole file.
            const conditionalChains = parseConditionalChains(cleanText);
            diagnostics.push(...checkUnreachableCode(noStringsText, doc, vscode, conditionalChains));
            diagnostics.push(...checkDuplicateConditionBranches(conditionalChains, doc, vscode));
            diagnostics.push(...checkLonelyIf(cleanText, conditionalChains, doc, vscode));

            diagnostics.push(...checkMixedOperators(cleanText, conditionRanges, doc, vscode));
        }

        diagnostics.push(...checkUnusedExpressions(cleanText, doc, vscode));
        diagnostics.push(...checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath, cleanText));

        // Phase 1 new checkers
        diagnostics.push(...checkNullSafety(cleanText, noStringsText, doc));
        diagnostics.push(...checkUnclosedStrings(cleanText, doc, vscode));
        
        if (hasLoops) {
            diagnostics.push(...checkInfiniteLoop(noStringsText, doc));
        }
        diagnostics.push(...checkShadowedVariables(noStringsText, doc));
        
        if (hasCommerce) {
            diagnostics.push(...checkCommerceAttributes(cleanText, noStringsText, doc, vscode, extensionPath));
        }
    }

    if (isSpellingEnabled) {
        diagnostics.push(...checkSpelling(text, cleanText, noStringsText, doc, vscode, extensionPath));
    }

    const suppressions = computeSuppressions(text, commentRanges);

    // Expand every Error-severity diagnostic to highlight the full line.
    // This mirrors the established behaviour of bml-trailing-comma-error and means
    // every fatal issue is immediately visible without requiring per-rule changes.
    // originalRange is preserved so code-action providers can still target the precise token.
    for (const d of diagnostics) {
        if (d.severity === vscode.DiagnosticSeverity.Error) {
            const line = d.range.start.line;
            const lineLength = lines[line] ? lines[line].length : 0;
            d.originalRange = d.range;  // save narrow range for code actions
            d.range = new vscode.Range(
                new vscode.Position(line, 0),
                new vscode.Position(line, lineLength)
            );
        }
    }

    const visibleDiagnostics = diagnostics.filter(
        (d) => !suppressions.isSuppressed(d.range.start.line, d.code)
    );

    docDiagnosticCache.set(doc.uri.toString(), {
        version: doc.version,
        diagnostics: visibleDiagnostics
    });

    applyAndSetDiagnostics(doc, visibleDiagnostics, diagnosticCollection, vscode);
}

const docDiagnosticCache = new Map();

function applyAndSetDiagnostics(doc, rawDiagnostics, diagnosticCollection, vscode) {
    if (!rawDiagnostics || rawDiagnostics.length === 0) {
        diagnosticCollection.set(doc.uri, []);
        return;
    }

    // Find visible ranges if this document is currently open in an active editor
    let visibleRanges = [];
    if (vscode && vscode.window && Array.isArray(vscode.window.visibleTextEditors)) {
        const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document && e.document.uri && e.document.uri.toString() === doc.uri.toString()
        );
        if (editor && Array.isArray(editor.visibleRanges) && editor.visibleRanges.length > 0) {
            visibleRanges = editor.visibleRanges;
        }
    }

    const isNearVisible = (d) => {
        if (visibleRanges.length === 0) return true;
        const line = d.range.start.line;
        return visibleRanges.some(
            (vr) => line >= Math.max(0, vr.start.line - 50) && line <= vr.end.line + 50
        );
    };

    // Sort diagnostics: items in or near visible viewport come first, then natural document order
    const sorted = [...rawDiagnostics].sort((a, b) => {
        const aVisible = isNearVisible(a) ? 1 : 0;
        const bVisible = isNearVisible(b) ? 1 : 0;
        if (aVisible !== bVisible) {
            return bVisible - aVisible;
        }
        if (a.range.start.line !== b.range.start.line) {
            return a.range.start.line - b.range.start.line;
        }
        return a.range.start.character - b.range.start.character;
    });

    const MAX_DIAGNOSTICS_PER_FILE = 500;
    const finalDiagnostics = (sorted.length > MAX_DIAGNOSTICS_PER_FILE && visibleRanges.length > 0)
        ? sorted.slice(0, MAX_DIAGNOSTICS_PER_FILE)
        : sorted;

    diagnosticCollection.set(doc.uri, finalDiagnostics);
}

function reorderVisibleDiagnostics(doc, diagnosticCollection, vscode) {
    if (!doc || !diagnosticCollection) return false;
    const cached = docDiagnosticCache.get(doc.uri.toString());
    if (!cached || (doc.version !== undefined && cached.version !== doc.version)) {
        return false;
    }
    applyAndSetDiagnostics(doc, cached.diagnostics, diagnosticCollection, vscode);
    return true;
}

module.exports = { lintBMLCustom, reorderVisibleDiagnostics, getStringRanges };

