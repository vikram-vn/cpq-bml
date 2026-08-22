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
    const chars = text.split('');
    for (const [start, end] of ranges) {
        for (let i = start; i < end; i++) {
            const ch = chars[i];
            if (ch !== '\n' && ch !== '\r') {
                chars[i] = ' ';
            }
        }
    }
    return chars.join('');
}

function lintBMLCustom(doc, diagnosticCollection, vscode, extensionPath) {
    if (doc.languageId !== 'bml') return;

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

    if (isLintEnabled) {
        const declaredVars = getDeclaredVariables(noStringsText, doc);
        diagnostics.push(...checkVariableDiagnostics(noStringsText, declaredVars, doc, cleanText));

        diagnostics.push(...checkMissingSemicolons(cleanText, noStringsText, conditionRanges));
        diagnostics.push(...checkAssignmentInCondition(noStringsText, conditionRanges, doc));
        diagnostics.push(...checkOperators(noStringsText, doc));
        diagnostics.push(...checkPerformance(cleanText, noStringsText, doc));
        diagnostics.push(...checkBestPractices(cleanText, noStringsText, doc));
        diagnostics.push(...checkStyle(cleanText, noStringsText, doc, declaredVars, extensionPath));
        const declaredParamTypes = getDeclaredParameterTypes(doc.uri && doc.uri.fsPath);
        const firstTypeByVar = collectVariableTypes(cleanText, doc, declaredParamTypes);

        diagnostics.push(...checkBoundaries(cleanText, noStringsText, doc));
        diagnostics.push(...checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath, firstTypeByVar));
        diagnostics.push(...checkSystemVariables(noStringsText, doc, vscode, extensionPath));

        diagnostics.push(...checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredParamTypes, extensionPath));
        diagnostics.push(...checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType, extensionPath));
        diagnostics.push(...checkConstantConditions(cleanText, conditionRanges, doc, vscode));

        // Shared parse so duplicateBranches, lonelyIf, and unreachable don't each re-parse the whole file.
        const conditionalChains = parseConditionalChains(cleanText);
        diagnostics.push(...checkUnreachableCode(noStringsText, doc, vscode, conditionalChains));
        diagnostics.push(...checkDuplicateConditionBranches(conditionalChains, doc, vscode));
        diagnostics.push(...checkLonelyIf(cleanText, conditionalChains, doc, vscode));

        diagnostics.push(...checkMixedOperators(cleanText, conditionRanges, doc, vscode));
        diagnostics.push(...checkUnusedExpressions(cleanText, doc, vscode));
        diagnostics.push(...checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath, cleanText));

        // Phase 1 new checkers
        diagnostics.push(...checkNullSafety(cleanText, noStringsText, doc));
        diagnostics.push(...checkUnclosedStrings(cleanText, doc, vscode));
        diagnostics.push(...checkInfiniteLoop(noStringsText, doc));
        diagnostics.push(...checkShadowedVariables(noStringsText, doc));
        diagnostics.push(...checkCommerceAttributes(cleanText, noStringsText, doc, vscode, extensionPath));
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

    diagnosticCollection.set(doc.uri, visibleDiagnostics);
}

module.exports = { lintBMLCustom, getStringRanges };
