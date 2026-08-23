const { vscode, makeDiagnostic, splitTopLevelArgs } = require('./shared');

/**
 * BMQL query safety and performance checks.
 *
 * Codes: bml-bmql-injection-risk, bml-bmql-select-star,
 *        bml-bmql-unbounded-mutation, bml-bmql-unbounded-delete,
 *        bml-bmql-select-truncated, bml-bmql-unbounded-select,
 *        bml-bmql-full-substitution, bml-bmql-join-system-table,
 *        bml-bmql-mutation-error-unchecked
 */
function checkBmqlSafety(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let loopRanges = null;

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
            } else {
                // "Full Substitution" - passing a bare variable as the whole
                // query string, e.g. bmql(queryStringVar) - is called out in
                // DynamicBMQLVariables.md as an explicit anti-pattern distinct
                // from + concatenation: no quotes/+ appear at all, so the
                // hasDynamicConcat scan above can't see it.
                const firstArg = (splitTopLevelArgs(argsText)[0] || '').trim();
                if (/^[A-Za-z_]\w*$/.test(firstArg)) {
                    diagnostics.push(makeDiagnostic(
                        range,
                        `Security Warning: Passing the bare variable '${firstArg}' directly as the whole bmql() query ("Full Substitution") is a documented anti-pattern. Use $variable syntax inside a query string literal instead (e.g. bmql("SELECT * FROM t WHERE id = $id", dict)) to prevent SQL injection.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-bmql-full-substitution'
                    ));
                }
            }

            if (/(?<!\$)\bselect\s+\*/i.test(queryLiteralText)) {
                diagnostics.push(makeDiagnostic(
                    range,
                    "Commerce Best Practice: Avoid using 'SELECT *' in BMQL. Explicitly list the required columns to optimize performance and reduce memory usage.",
                    vscode.DiagnosticSeverity.Warning,
                    'bml-bmql-select-star'
                ));
            }

            // Per BMQL.md's Notes: "JOIN clauses are only supported for
            // customer-defined tables... if you have a query using a JOIN
            // clause for the system-defined _parts table, you will receive
            // an error message." System tables are conventionally prefixed
            // with an underscore.
            const joinSystemTableMatch = /\bjoin\s+(_\w+)/i.exec(queryLiteralText);
            if (joinSystemTableMatch) {
                diagnostics.push(makeDiagnostic(
                    range,
                    `Error: BMQL JOIN against system-defined table '${joinSystemTableMatch[1]}' is not supported and will error at runtime - JOIN only works with customer-defined tables.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-bmql-join-system-table'
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
            const hasWhere = /(?<!\$)\bwhere\b/i.test(queryLiteralText);
            const mutationMatch = /(?<!\$)\b(update|modify)\b/i.exec(queryLiteralText);
            const deleteMatch = /(?<!\$)\bdelete\b/i.test(queryLiteralText);
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
            } else if (/(?<!\$)\bselect\b/i.test(queryLiteralText) && !hasWhere) {
                const usesDistinctOrOrderBy = /(?<!\$)\bdistinct\b|(?<!\$)\border\s+by\b/i.test(queryLiteralText);
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

            // Per BMQL.md: INSERT/UPDATE/MODIFY can add a "records_error"
            // entry to the result even when no exception is thrown (e.g. a
            // duplicate natural key blocks a row) - DELETE has no such entry
            // documented. Flag when the result variable is never checked for
            // it anywhere in the file.
            const mutationErrorMatch = /(?<!\$)\b(insert|update|modify)\b/i.exec(queryLiteralText);
            if (mutationErrorMatch) {
                const beforeCall = cleanText.slice(Math.max(0, startIdx - 60), startIdx);
                const assignMatch = /([A-Za-z_]\w*)\s*=\s*$/.exec(beforeCall);
                if (assignMatch) {
                    const varName = assignMatch[1];
                    const errorCheckPattern = new RegExp(`\\bget\\s*\\(\\s*${varName}\\s*,\\s*["']records_error["']\\s*\\)`, 'i');
                    if (!errorCheckPattern.test(cleanText)) {
                        diagnostics.push(makeDiagnostic(
                            range,
                            `Safety Warning: BMQL ${mutationErrorMatch[1].toUpperCase()} can add a "records_error" entry to '${varName}' even when no exception is thrown (e.g. a duplicate key blocks a row). Check get(${varName}, "records_error") to catch partial failures.`,
                            vscode.DiagnosticSeverity.Warning,
                            'bml-bmql-mutation-error-unchecked'
                        ));
                    }
                }
            }

            // Detect BMQL queries inside a for-loop body (N+1 query problem)
            if (!loopRanges) {
                loopRanges = [];
                const forLoopRegex = /\bfor\b[^{]*\{/g;
                let forMatch;
                while ((forMatch = forLoopRegex.exec(cleanText)) !== null) {
                    const blockStart = forMatch.index + forMatch[0].length - 1;
                    let depth = 1;
                    let blockEnd = -1;
                    for (let i = blockStart + 1; i < cleanText.length; i++) {
                        if (cleanText[i] === '{') depth++;
                        else if (cleanText[i] === '}') {
                            depth--;
                            if (depth === 0) {
                                blockEnd = i;
                                break;
                            }
                        }
                    }
                    if (blockEnd !== -1) {
                        loopRanges.push([blockStart, blockEnd]);
                    }
                }
            }

            const insideLoop = loopRanges.some(([bStart, bEnd]) => startIdx > bStart && startIdx < bEnd);

            if (insideLoop) {
                diagnostics.push(makeDiagnostic(
                    range,
                    'Performance Warning: BMQL query inside a loop detected (N+1 query problem). Batch queries outside the loop to avoid database round-trip overhead.',
                    vscode.DiagnosticSeverity.Warning,
                    'bml-bmql-in-loop'
                ));
            }
        }
    }

    return diagnostics;
}

module.exports = { checkBmqlSafety };
