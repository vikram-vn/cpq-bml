const vscode = require('vscode');

/**
 * Null Safety Checker
 *
 * Flags variables that receive the result of a bmql() / get() / dictget() /
 * jsonget() call and are then used without a preceding null guard.
 *
 * Guard patterns recognised (anywhere before the first unguarded use):
 *   isnull(var)
 *   sizeofarray(var)  [> 0 or similar]
 *   len(var) == 0 / > 0 / etc.
 *   var == ""  /  var <> ""
 *
 * A use that simply passes the variable straight through as a function-call
 * argument (e.g. append(arr, var), someFunc(a, var)) is NOT flagged: a survey
 * of real CPQ library code found this is the overwhelming majority (~84%) of
 * otherwise-unguarded uses, and it's clearly this codebase's normal, accepted
 * style - BML function calls generally don't throw on a null/empty argument.
 * Uses inside an expression (concatenation, comparisons, etc.) are still
 * flagged.
 *
 * Code: bml-null-check-required  Severity: Warning
 */
function checkNullSafety(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Find variables assigned from nullable sources (strings blanked so we don't
    // match inside string literals).
    const nullableAssignRegex = /\b([a-zA-Z_]\w*)\s*=\s*(?:bmql|get|dictget|jsonget)\s*\(/g;
    const nullableVars = new Set();
    let m;
    while ((m = nullableAssignRegex.exec(noStringsText)) !== null) {
        nullableVars.add(m[1]);
    }

    if (nullableVars.size === 0) return diagnostics;

    // Used to compile a fresh \bvarName\b RegExp and rescan the whole file
    // once PER nullable variable (O(vars x file length) - on a large file
    // with many bmql/get/dictget assignments, that's the full text re-walked
    // many times). One single pass instead, recording every identifier
    // occurrence's index by name; each variable below then just iterates its
    // own precomputed occurrence list. Mirrors the same optimization already
    // applied to variables.js's usage check.
    const occurrencesByName = new Map();
    const identRegex = /\b[a-zA-Z_]\w*\b/g;
    let identMatch;
    while ((identMatch = identRegex.exec(noStringsText)) !== null) {
        const name = identMatch[0];
        if (!nullableVars.has(name)) continue; // only tracking names we'll actually look up below
        if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
        occurrencesByName.get(name).push(identMatch.index);
    }

    for (const varName of nullableVars) {
        // Build per-variable guard regex. Real CPQ library code guards
        // bmql/get/dictget results with len(x) comparisons just as often as
        // isnull()/sizeofarray() - e.g. `if (len(error) > 0)` or
        // `if (len(fusionUsername) == 0 OR ...)` - so that idiom counts too.
        const guardPattern = new RegExp(
            `\\bisnull\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\bsizeofarray\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\blen\\s*\\(\\s*${varName}\\s*\\)\\s*(?:==|<>|!=|>|>=)\\s*0\\b` +
            `|\\b${varName}\\s*(?:==|<>|!=)\\s*["']{2}` +
            `|["']{2}\\s*(?:==|<>|!=)\\s*\\b${varName}\\b`,
            'i'
        );

        // Patterns that indicate the current match is PART OF a guard expression
        const insideGuardRe = new RegExp(
            `(?:isnull|sizeofarray|len)\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`,
            'i'
        );

        const occurrences = occurrencesByName.get(varName) || [];
        let foundUnguarded = false;
        for (const useIndex of occurrences) {
            // Skip the actual assignment (followed by = and the nullable source call)
            const tail = noStringsText.slice(useIndex, useIndex + varName.length + 30);
            if (/^\w+\s*=\s*(?:bmql|get|dictget|jsonget)\s*\(/.test(tail)) continue;

            // Skip plain LHS assignments (var = something)
            const after = noStringsText.slice(useIndex + varName.length).trimStart();
            if (after.startsWith('=') && !after.startsWith('==') && !after.startsWith('=>')) continue;

            // Skip if this match is inside a guard call (isnull(var), sizeofarray(var))
            // Look at a small window around the match
            const windowStart = Math.max(0, useIndex - 15);
            const window = noStringsText.slice(windowStart, useIndex + varName.length + 5);
            if (insideGuardRe.test(window)) continue;

            // Check whether a guard appeared anywhere before this use
            const contextStart = Math.max(0, useIndex - 4000);
            const context = noStringsText.slice(contextStart, useIndex);
            if (guardPattern.test(context)) continue;

            // Skip a bare pass-through as a call argument, e.g. append(arr, varName)
            // or someFunc(a, varName) - see doc comment above.
            const argBefore = noStringsText.slice(Math.max(0, useIndex - 20), useIndex).trimEnd();
            const argAfter = noStringsText.slice(useIndex + varName.length, useIndex + varName.length + 20).trimStart();
            if (/[(,]$/.test(argBefore) && /^[,)]/.test(argAfter)) continue;

            // Unguarded use found
            const startPos = doc.positionAt(useIndex);
            const endPos = startPos.translate(0, varName.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Safety Warning: '${varName}' may be null (result of bmql/get/dictget). ` +
                `Check with isnull(${varName}) or sizeofarray(${varName}) > 0 before use.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-null-check-required';
            diagnostics.push(diag);
            foundUnguarded = true;
            break; // one diagnostic per variable is enough
        }
    }

    return diagnostics;
}

module.exports = { checkNullSafety };
