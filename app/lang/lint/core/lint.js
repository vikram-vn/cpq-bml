const { getCommentRanges } = require('../rules/comments');
const { getConditionRanges } = require('../rules/conditions');
const { getDeclaredVariables, checkVariableDiagnostics } = require('../rules/variables');
const { checkMissingSemicolons } = require('../rules/semicolon');
const { checkAssignmentInCondition } = require('../rules/assignment');
const { checkOperators } = require('../rules/operators');
const { checkPerformance } = require('../rules/performance');
const { checkBestPractices } = require('../categories/best-practices');
const { checkStyle } = require('../rules/style');
const { checkBoundaries } = require('./boundaries');
const { checkFunctionCalls } = require('../rules/functions');
const { checkSystemVariables } = require('../rules/systemVariables');
const { checkAssignmentTypeConsistency, collectVariableTypesAndMismatches, inferLiteralType } = require('../rules/typeCheck');
const { checkMetadataTypeConsistency, getDeclaredParameterTypes } = require('../rules/metadataTypes');
const { checkConstantConditions } = require('../rules/constantConditions');
const { checkUnreachableCode } = require('../rules/unreachable');
const { checkDuplicateConditionBranches, parseConditionalChains } = require('../rules/duplicateBranches');
const { checkMixedOperators } = require('../rules/mixedOperators');
const { checkLonelyIf } = require('../rules/lonelyIf');
const { checkUnusedExpressions } = require('../rules/unusedExpressions');
const { checkUseBeforeDefine } = require('../rules/useBeforeDefine');
const { getStringRanges, checkUnclosedStrings } = require('../rules/strings');
const { computeSuppressions } = require('./suppressions');
const { checkSpelling } = require('../../spell-check/spelling');
const { checkNullSafety } = require('../rules/nullSafety');
const { checkInfiniteLoop } = require('../rules/infiniteLoop');
const { checkShadowedVariables } = require('../rules/shadowedVariables');
const { checkCommerceAttributes } = require('../rules/commerceAttributes');



function blankRanges(text, ranges) {
    if (!ranges || ranges.length === 0) return text;
    let result = '';
    let lastIndex = 0;
    for (let i = 0; i < ranges.length; i++) {
        const [start, end] = ranges[i];
        if (start > lastIndex) {
            result += text.slice(lastIndex, start);
        }
        const slice = text.slice(start, end);
        if (slice.includes('\n') || slice.includes('\r')) {
            result += slice.replace(/[^\r\n]/g, ' ');
        } else {
            result += ' '.repeat(end - start);
        }
        lastIndex = end;
    }
    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}

function lintBMLCustom(doc, diagnosticCollection, vscode, extensionPath) {
    const isBml = doc.languageId === 'bml' || (doc.uri && doc.uri.fsPath && doc.uri.fsPath.endsWith('.bml'));
    if (!isBml) return;

    const text = doc.getText();
    const diagnostics = [];
    const isLintEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.lint', true);
    const isSpellingEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.spelling', true);

    const commentRanges = getCommentRanges(text);
    const cleanText = blankRanges(text, commentRanges);

    const conditionRanges = getConditionRanges(cleanText);

    // noStringsText additionally blanks strings, for checks that must not match inside string literals.
    const stringRanges = getStringRanges(cleanText);
    const noStringsText = blankRanges(cleanText, stringRanges);

    // Fast keyword pre-checks to skip irrelevant checker passes
    const hasConditions = conditionRanges.length > 0 || cleanText.includes('if') || cleanText.includes('elif');
    const hasLoops = noStringsText.includes('for') || noStringsText.includes('while');
    const hasCommerce = cleanText.includes('commerce') || cleanText.includes('line') || cleanText.includes('transaction') || cleanText.includes('_l') || cleanText.includes('_t');
    const hasFunctionCalls = cleanText.includes('(');
    const hasBrackets = cleanText.includes('[');
    const hasSystemVars = noStringsText.includes('_');
    const hasOperators = cleanText.includes('+') || cleanText.includes('-') || cleanText.includes('*') || cleanText.includes('/') || cleanText.includes('==') || cleanText.includes('!=') || cleanText.includes('>') || cleanText.includes('<');

    if (isLintEnabled) {
        const declaredVars = getDeclaredVariables(noStringsText, doc);
        diagnostics.push(...checkVariableDiagnostics(noStringsText, declaredVars, doc, cleanText, vscode));

        diagnostics.push(...checkMissingSemicolons(cleanText, noStringsText, conditionRanges));
        if (hasConditions) {
            diagnostics.push(...checkAssignmentInCondition(noStringsText, conditionRanges, doc));
        }
        diagnostics.push(...checkOperators(noStringsText, doc));
        diagnostics.push(...checkPerformance(cleanText, noStringsText, doc));
        const declaredParamTypes = getDeclaredParameterTypes(doc.uri && doc.uri.fsPath);
        const { firstTypeByVar, diagnostics: assignmentMismatches } = collectVariableTypesAndMismatches(cleanText, doc, declaredParamTypes, vscode, extensionPath, declaredVars);

        diagnostics.push(...checkBestPractices(cleanText, noStringsText, doc, firstTypeByVar));
        diagnostics.push(...checkStyle(cleanText, noStringsText, doc, declaredVars, extensionPath, firstTypeByVar));

        diagnostics.push(...checkBoundaries(cleanText, noStringsText, doc));
        if (hasFunctionCalls) {
            diagnostics.push(...checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath, firstTypeByVar));
        }
        if (hasSystemVars) {
            diagnostics.push(...checkSystemVariables(noStringsText, doc, vscode, extensionPath));
        }

        diagnostics.push(...checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredParamTypes, extensionPath, noStringsText, firstTypeByVar, assignmentMismatches));
        diagnostics.push(...checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType, extensionPath));
        
        const conditionalChains = hasConditions ? parseConditionalChains(cleanText) : [];
        if (hasConditions) {
            diagnostics.push(...checkConstantConditions(cleanText, conditionRanges, doc, vscode));
            diagnostics.push(...checkDuplicateConditionBranches(conditionalChains, doc, vscode));
            diagnostics.push(...checkLonelyIf(cleanText, conditionalChains, doc, vscode));
            diagnostics.push(...checkMixedOperators(cleanText, conditionRanges, doc, vscode));
        }

        if (noStringsText.includes('return') || noStringsText.includes('throwerror') || noStringsText.includes('break') || noStringsText.includes('continue')) {
            diagnostics.push(...checkUnreachableCode(noStringsText, doc, vscode, conditionalChains));
        }

        diagnostics.push(...checkUnusedExpressions(cleanText, doc, vscode));
        diagnostics.push(...checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath, cleanText));

        // Phase 1 new checkers
        diagnostics.push(...checkNullSafety(cleanText, noStringsText, doc));
        if (cleanText.includes('"') || cleanText.includes("'")) {
            diagnostics.push(...checkUnclosedStrings(cleanText, doc, vscode));
        }
        
        if (hasLoops) {
            diagnostics.push(...checkInfiniteLoop(noStringsText, doc));
            diagnostics.push(...checkShadowedVariables(noStringsText, doc, declaredVars));
        }
        
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
    let linesCache = null;
    for (let i = 0; i < diagnostics.length; i++) {
        const d = diagnostics[i];
        if (d.severity === vscode.DiagnosticSeverity.Error) {
            const line = d.range.start.line;
            let lineLength = 0;
            if (doc && typeof doc.lineAt === 'function') {
                try {
                    lineLength = doc.lineAt(line).text.length;
                } catch (e) {
                    if (!linesCache) linesCache = text.split(/\r?\n/);
                    lineLength = linesCache[line] ? linesCache[line].length : 0;
                }
            } else {
                if (!linesCache) linesCache = text.split(/\r?\n/);
                lineLength = linesCache[line] ? linesCache[line].length : 0;
            }
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

