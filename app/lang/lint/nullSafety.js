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
 *   var == ""  /  var <> ""
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

    for (const varName of nullableVars) {
        // Build per-variable guard regex
        const guardPattern = new RegExp(
            `\\bisnull\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\bsizeofarray\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\b${varName}\\s*(?:==|<>|!=)\\s*["']{0,2}\\s*["']{0,2}` +
            `|["']{0,2}\\s*["']{0,2}\\s*(?:==|<>|!=)\\s*\\b${varName}\\b`,
            'i'
        );

        // Regex to find any use of varName that is NOT on the LHS of an assignment
        // and NOT inside a guard expression itself.
        const useRegex = new RegExp(`\\b${varName}\\b`, 'g');

        // Patterns that indicate the current match is PART OF a guard expression
        const insideGuardRe = new RegExp(
            `(?:isnull|sizeofarray)\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`,
            'i'
        );

        let foundUnguarded = false;
        while ((m = useRegex.exec(noStringsText)) !== null) {
            const useIndex = m.index;

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
