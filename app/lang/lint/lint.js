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
const { checkAssignmentTypeConsistency, inferLiteralType } = require('./typeCheck');
const { checkMetadataTypeConsistency, getDeclaredParameterTypes } = require('./metadataTypes');
const { checkConstantConditions } = require('./constantConditions');
const { checkUnreachableCode } = require('./unreachable');
const { checkDuplicateConditionBranches, parseConditionalChains } = require('./duplicateBranches');
const { checkMixedOperators } = require('./mixedOperators');
const { checkLonelyIf } = require('./lonelyIf');
const { checkUnusedExpressions } = require('./unusedExpressions');
const { checkUseBeforeDefine } = require('./useBeforeDefine');
const { getStringRanges } = require('./strings');
const { computeSuppressions } = require('./suppressions');
const { checkSpelling } = require('../spellCheck/spelling');
const { checkNullSafety } = require('./nullSafety');
const { checkInfiniteLoop } = require('./infiniteLoop');
const { checkShadowedVariables } = require('./shadowedVariables');



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
        diagnostics.push(...checkVariableDiagnostics(noStringsText, declaredVars, doc));

        diagnostics.push(...checkMissingSemicolons(cleanText, noStringsText, conditionRanges));
        diagnostics.push(...checkAssignmentInCondition(noStringsText, conditionRanges, doc));
        diagnostics.push(...checkOperators(noStringsText, doc));
        diagnostics.push(...checkPerformance(cleanText, noStringsText, doc));
        diagnostics.push(...checkBestPractices(cleanText, noStringsText, doc));
        diagnostics.push(...checkStyle(cleanText, noStringsText, doc, declaredVars));
        diagnostics.push(...checkBoundaries(cleanText, noStringsText, doc));
        diagnostics.push(...checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath));
        diagnostics.push(...checkSystemVariables(noStringsText, doc, vscode, extensionPath));

        const declaredParamTypes = getDeclaredParameterTypes(doc.uri && doc.uri.fsPath);
        diagnostics.push(...checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredParamTypes));
        diagnostics.push(...checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType, extensionPath));
        diagnostics.push(...checkConstantConditions(cleanText, conditionRanges, doc, vscode));

        // Shared parse so duplicateBranches, lonelyIf, and unreachable don't each re-parse the whole file.
        const conditionalChains = parseConditionalChains(cleanText);
        diagnostics.push(...checkUnreachableCode(noStringsText, doc, vscode, conditionalChains));
        diagnostics.push(...checkDuplicateConditionBranches(conditionalChains, doc, vscode));
        diagnostics.push(...checkLonelyIf(cleanText, conditionalChains, doc, vscode));

        diagnostics.push(...checkMixedOperators(cleanText, conditionRanges, doc, vscode));
        diagnostics.push(...checkUnusedExpressions(cleanText, doc, vscode));
        diagnostics.push(...checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath));

        // Phase 1 new checkers
        diagnostics.push(...checkNullSafety(cleanText, noStringsText, doc));
        diagnostics.push(...checkInfiniteLoop(noStringsText, doc));
        diagnostics.push(...checkShadowedVariables(noStringsText, doc));

        // File length limit: flag files over 500 lines.
        // Long files are hard to review and maintain; split into smaller BML functions.
        const totalLines = lines.length;
        const FILE_LINE_LIMIT = 500;
        if (totalLines > FILE_LINE_LIMIT) {
            const limitLine = FILE_LINE_LIMIT; // 0-indexed: line 500 is the 501st line
            const diag = new vscode.Diagnostic(
                new vscode.Range(
                    new vscode.Position(limitLine, 0),
                    new vscode.Position(limitLine, lines[limitLine] ? lines[limitLine].length : 0)
                ),
                `File is too long: ${totalLines} lines. BML files must not exceed ${FILE_LINE_LIMIT} lines. Split into smaller functions.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-file-too-long';
            diagnostics.push(diag);
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

    diagnosticCollection.set(doc.uri, visibleDiagnostics);
}

module.exports = { lintBMLCustom, getStringRanges };
