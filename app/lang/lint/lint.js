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
const { getStringRanges } = require('./strings');
const { computeSuppressions } = require('./suppressions');

// Blanks out text[start, end) with spaces while preserving any \n/\r inside the
// range. A naive ' '.repeat(end - start) replacement collapses multi-line block
// comments (very common in this codebase - see app/lang/bml-lint's own corpus
// notes on commented-out dead code) down to a single line, which shifts every
// line number for the rest of the file and misattributes every diagnostic after it.
function blank(text, start, end) {
    let result = '';
    for (let i = start; i < end; i++) {
        const ch = text[i];
        result += (ch === '\n' || ch === '\r') ? ch : ' ';
    }
    return result;
}

function lintBMLCustom(doc, diagnosticCollection, vscode) {
    if (doc.languageId !== 'bml') return;

    const text = doc.getText();
    const diagnostics = [];

    // 1. Get comments & conditions
    const commentRanges = getCommentRanges(text);
    const conditionRanges = getConditionRanges(text);

    // 2. Remove comments
    let cleanText = text;
    commentRanges.sort((a, b) => b[0] - a[0]);
    for (const [start, end] of commentRanges) {
        cleanText = cleanText.slice(0, start) + blank(cleanText, start, end) + cleanText.slice(end);
    }

    // 3. Remove strings to get a code-only view (avoids matching inside string literals)
    const stringRanges = getStringRanges(cleanText);
    let noStringsText = cleanText;
    stringRanges.sort((a, b) => b[0] - a[0]);
    for (const [start, end] of stringRanges) {
        noStringsText = noStringsText.slice(0, start) + blank(noStringsText, start, end) + noStringsText.slice(end);
    }

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
    diagnostics.push(...checkFunctionCalls(cleanText, noStringsText, doc, vscode));

    // 11. Apply // bml-lint-disable / -line / -next-line / -file comment directives
    const suppressions = computeSuppressions(text, commentRanges);
    const visibleDiagnostics = diagnostics.filter(
        (d) => !suppressions.isSuppressed(d.range.start.line, d.code)
    );

    diagnosticCollection.set(doc.uri, visibleDiagnostics);
}

module.exports = { lintBMLCustom, getStringRanges };
