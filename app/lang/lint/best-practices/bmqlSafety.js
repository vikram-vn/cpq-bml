const { vscode, makeDiagnostic } = require('./shared');

/**
 * BMQL query safety and performance checks.
 *
 * Codes: bml-bmql-injection-risk, bml-bmql-select-star,
 *        bml-bmql-unbounded-mutation, bml-bmql-unbounded-delete,
 *        bml-bmql-select-truncated, bml-bmql-unbounded-select
 */
function checkBmqlSafety(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // SQL Injection and SELECT * in BMQL (run on cleanText since we need string literals intact)
    const bmqlRegex = /\bbmql\s*\(/gi;
    let match;
    while ((match = bmqlRegex.exec(cleanText)) !== null) {
        const startIdx = match.index;
        let depth = 1;
        let endIdx = -1;
        for (let i = startIdx + match[0].length; i < cleanText.length; i++) {
            if (cleanText[i] === '(') depth++;
            else if (cleanText[i] === ')') depth--;
            if (depth === 0) {
                endIdx = i;
                break;
            }
        }

        if (endIdx !== -1) {
            const argsText = cleanText.slice(startIdx + match[0].length, endIdx);
            let inSingleQuote = false;
            let inDoubleQuote = false;
            let hasDynamicConcat = false;
            let queryLiteralText = '';

            for (let j = 0; j < argsText.length; j++) {
                const char = argsText[j];
                if (char === "'" && !inDoubleQuote) {
                    inSingleQuote = !inSingleQuote;
                } else if (char === '"' && !inSingleQuote) {
                    inDoubleQuote = !inDoubleQuote;
                } else if (char === '+' && !inSingleQuote && !inDoubleQuote) {
                    hasDynamicConcat = true;
                }

                if (inSingleQuote || inDoubleQuote) {
                    queryLiteralText += char;
                }
            }

            const startPos = doc.positionAt(startIdx);
            const endPos = doc.positionAt(endIdx + 1);
            const range = new vscode.Range(startPos, endPos);

            if (hasDynamicConcat) {
                diagnostics.push(makeDiagnostic(
                    range,
                    'Security Warning: Dynamic query concatenation detected in BMQL. Use $variable syntax instead to prevent SQL injection',
                    vscode.DiagnosticSeverity.Error,
                    'bml-bmql-injection-risk'
                ));
            }

            if (/\bselect\s+\*/i.test(queryLiteralText)) {
                diagnostics.push(makeDiagnostic(
                    range,
                    "Commerce Best Practice: Avoid using 'SELECT *' in BMQL. Explicitly list the required columns to optimize performance and reduce memory usage.",
                    vscode.DiagnosticSeverity.Warning,
                    'bml-bmql-select-star'
                ));
            }

            // Per the BMQL docs:
            //  - "Executing a MODIFY/UPDATE statement without a WHERE clause
            //    will modify/update all of the data in the Live Data Table"
            //    (capped at 1,000 records processed).
            //  - "Executing a DELETE statement without a WHERE clause will
            //    clear all of the data in the Live Data Table" (no cap
            //    mentioned for DELETE - it clears everything, unbounded).
            // Both are explicitly called out as warning-level risks, not just
            // a style nit.
            const hasWhere = /\bwhere\b/i.test(queryLiteralText);
            const mutationMatch = /\b(update|modify)\b/i.exec(queryLiteralText);
            const deleteMatch = /\bdelete\b/i.test(queryLiteralText);
            if (mutationMatch && !hasWhere) {
                diagnostics.push(makeDiagnostic(
                    range,
                    `Safety Warning: BMQL ${mutationMatch[1].toUpperCase()} has no WHERE clause - this will ${mutationMatch[1].toLowerCase() === 'update' ? 'update' : 'modify'} every record in the table (up to 1,000). Add a WHERE clause unless that's intentional.`,
                    vscode.DiagnosticSeverity.Warning,
                    'bml-bmql-unbounded-mutation'
                ));
            } else if (deleteMatch && !hasWhere) {
                diagnostics.push(makeDiagnostic(
                    range,
                    "Safety Warning: BMQL DELETE has no WHERE clause - this will clear all of the data in the table. Add a WHERE clause unless that's intentional.",
                    vscode.DiagnosticSeverity.Warning,
                    'bml-bmql-unbounded-delete'
                ));
            } else if (/\bselect\b/i.test(queryLiteralText) && !hasWhere) {
                const usesDistinctOrOrderBy = /\bdistinct\b|\border\s+by\b/i.test(queryLiteralText);
                if (usesDistinctOrOrderBy) {
                    // A SELECT using DISTINCT or ORDER BY is *also* capped at
                    // 1,000 records per the docs - unlike a plain SELECT, so a
                    // missing WHERE here risks silently dropping matching rows
                    // rather than just being slow.
                    diagnostics.push(makeDiagnostic(
                        range,
                        'Safety Warning: BMQL SELECT uses DISTINCT/ORDER BY with no WHERE clause - the result set is capped at 1,000 records, so matching rows beyond that limit are silently dropped. Add a WHERE clause to narrow the results.',
                        vscode.DiagnosticSeverity.Warning,
                        'bml-bmql-select-truncated'
                    ));
                } else {
                    // A plain SELECT is NOT capped at 1,000 by BMQL - so a missing
                    // WHERE here risks an unbounded, slow result set rather than
                    // truncation. Lower severity: a performance suggestion, not a
                    // correctness risk.
                    diagnostics.push(makeDiagnostic(
                        range,
                        'Performance Info: BMQL SELECT has no WHERE clause and will return every matching record with no limit. Add a WHERE clause if you only need a subset.',
                        vscode.DiagnosticSeverity.Information,
                        'bml-bmql-unbounded-select'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkBmqlSafety };
