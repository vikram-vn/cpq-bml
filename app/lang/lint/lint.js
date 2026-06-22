const { getCommentRanges } = require('./comments');
const { getConditionRanges } = require('./conditions');
const { getDeclaredVariables, checkVariableDiagnostics } = require('./variables');
const { checkMissingSemicolons } = require('./semicolon');
const { checkAssignmentInCondition } = require('./assignment');
const { checkOperators } = require('./operators');
const { checkPerformance } = require('./performance');
const { checkBestPractices } = require('./bestPractices');
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


// Blanks out text[start, end) with spaces while preserving any \n/\r inside the
// range. A naive ' '.repeat(end - start) replacement collapses multi-line block
// comments (very common in this codebase - see app/lang/bml-lint's own corpus
// notes on commented-out dead code) down to a single line, which shifts every
// line number for the rest of the file and misattributes every diagnostic after it.
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
    const diagnostics = [];
    const isLintEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.lint', true);
    const isSpellingEnabled = vscode.workspace.getConfiguration('cpqBml').get('features.spelling', true);

    // 1. Get comments & conditions
    const commentRanges = getCommentRanges(text);
    const conditionRanges = getConditionRanges(text);

    // 2. Remove comments
    const cleanText = blankRanges(text, commentRanges);

    // 3. Remove strings to get a code-only view (avoids matching inside string literals)
    const stringRanges = getStringRanges(cleanText);
    const noStringsText = blankRanges(cleanText, stringRanges);

    if (isLintEnabled) {
        // 4. Variables & Shadowing (run on noStringsText to prevent matching variable names inside query strings)
        // Note: To check usage, we also search on noStringsText so that references inside query strings are not treated as variable usages
        const declaredVars = getDeclaredVariables(noStringsText, doc);
        diagnostics.push(...checkVariableDiagnostics(noStringsText, declaredVars, doc));

        // 5. Semicolon checks (cleanText for code-content checks since string content
        // must stay intact; noStringsText for paren/bracket depth tracking only)
        diagnostics.push(...checkMissingSemicolons(cleanText, noStringsText, conditionRanges));

        // 5b. Assignment '=' inside an if/elif condition (almost always a typo for '==')
        diagnostics.push(...checkAssignmentInCondition(noStringsText, conditionRanges, doc));

        // 6. Operator checks (run on noStringsText to avoid flagging operators inside string literals)
        diagnostics.push(...checkOperators(noStringsText, doc));

        // 7. Performance checks (pass cleanText for BMQL literal parsing, noStringsText for nesting braces)
        diagnostics.push(...checkPerformance(cleanText, noStringsText, doc));

        // 8. Best Practices & Security checks (pass cleanText for SQL Injection, noStringsText for magic numbers)
        diagnostics.push(...checkBestPractices(cleanText, noStringsText, doc));

        // 9. Coding Style & Naming checks
        diagnostics.push(...checkStyle(cleanText, noStringsText, doc, declaredVars));

        // 10. CPQ Application Boundaries & Magic Numbers checks
        diagnostics.push(...checkBoundaries(cleanText, noStringsText, doc));

        // 10b. Function calls & parameter validations
        diagnostics.push(...checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath));

        // 10c. CPQ predefined system variables (_user_*, _site_*, ...): flag
        // assignment to a read-only one, and typo "did you mean" suggestions
        diagnostics.push(...checkSystemVariables(noStringsText, doc, vscode, extensionPath));

        // 10d. Variable type consistency: a variable reassigned to a literal of a
        // different type than its first assignment (e.g. test = 1; ... test = "2";),
        // seeded from the function's own declared parameter types (its -meta.json
        // sidecar) so reassigning a parameter to a conflicting type is caught too.
        const declaredParamTypes = getDeclaredParameterTypes(doc.uri && doc.uri.fsPath);
        diagnostics.push(...checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredParamTypes));

        // 10e. Metadata sidecar type validation: internal value/displayValue
        // consistency against Oracle's own lookup tables, and a `return <literal>;`
        // whose type conflicts with the function's own declared return type.
        diagnostics.push(...checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType, extensionPath));

        // 10f. Always-true/false if/elif conditions and self-comparisons (reuses
        // the conditionRanges already computed in step 1 - getConditionRanges
        // ignores comments/strings internally regardless of which text variant
        // it's run against, so this is equivalent to a fresh call, just cheaper)
        diagnostics.push(...checkConstantConditions(cleanText, conditionRanges, doc, vscode));

        // 10g. Unreachable code after an unconditional return/break/continue/throwerror
        diagnostics.push(...checkUnreachableCode(noStringsText, doc, vscode));

        // 10h/10j. Duplicate if/elif branch conditions, and an else containing
        // nothing but a single if (should be elif) - both share one
        // parseConditionalChains(cleanText) pass instead of each re-parsing the
        // whole file independently (cleanText so two branches comparing against
        // different string literals aren't mistaken for duplicates once those
        // literals are blanked out)
        const conditionalChains = parseConditionalChains(cleanText);
        diagnostics.push(...checkDuplicateConditionBranches(conditionalChains, doc, vscode));
        diagnostics.push(...checkLonelyIf(cleanText, conditionalChains, doc, vscode));

        // 10i. AND/OR mixed without grouping parens in an if/elif condition
        diagnostics.push(...checkMixedOperators(cleanText, conditionRanges, doc, vscode));

        // 10k. A bare comparison statement with no effect (almost always a typo
        // for '=' or a forgotten 'if')
        diagnostics.push(...checkUnusedExpressions(cleanText, doc, vscode));

        // 10l. A variable read before its own later assignment in the same file -
        // util functions only (commerce functions have too many implicit
        // platform bindings to check this safely; see useBeforeDefine.js)
        diagnostics.push(...checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath));
    }

    if (isSpellingEnabled) {
        // 10m. Custom spellchecker for BML
        diagnostics.push(...checkSpelling(text, cleanText, noStringsText, doc, vscode, extensionPath));
    }

    // 11. Apply // bml-lint-disable / -line / -next-line / -file comment directives
    const suppressions = computeSuppressions(text, commentRanges);

    const visibleDiagnostics = diagnostics.filter(
        (d) => !suppressions.isSuppressed(d.range.start.line, d.code)
    );

    diagnosticCollection.set(doc.uri, visibleDiagnostics);
}

module.exports = { lintBMLCustom, getStringRanges };
