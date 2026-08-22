const vscode = require('vscode');

// Null Safety Checker: Flags variables assigned from bmql() / get() / dictget() / jsonget()
// that are used without a preceding null guard or pre-initialized fallback.
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

    const occurrencesByName = new Map();
    const identRegex = /\b[a-zA-Z_]\w*\b/g;
    let identMatch;
    while ((identMatch = identRegex.exec(noStringsText)) !== null) {
        const name = identMatch[0];
        if (!nullableVars.has(name)) continue;
        if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
        occurrencesByName.get(name).push(identMatch.index);
    }

    for (const varName of nullableVars) {
        const prevInitRegex = new RegExp(
            `\\b${varName}\\s*=\\s*(?:\\d+(?:\\.\\d+)?|["'][^"']*["']|true|false|dict\\s*\\(|string\\[|integer\\[|float\\[)`,
            'i'
        );

        const guardPattern = new RegExp(
            `\\bisnull\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\bsizeofarray\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\blen\\s*\\(\\s*${varName}\\s*\\)\\s*(?:==|<>|!=|>|>=)\\s*0\\b` +
            `|\\b${varName}\\s*(?:==|<>|!=)\\s*["']{2}` +
            `|["']{2}\\s*(?:==|<>|!=)\\s*\\b${varName}\\b` +
            `|\\bcontains(?:key)?\\s*\\(`,
            'i'
        );

        const insideGuardRe = new RegExp(
            `(?:isnull|sizeofarray|len|contains|containskey)\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`,
            'i'
        );

        const occurrences = occurrencesByName.get(varName) || [];
        let foundUnguarded = false;
        for (const useIndex of occurrences) {
            if (prevInitRegex.test(noStringsText.slice(0, useIndex))) break;

            const tail = noStringsText.slice(useIndex, useIndex + varName.length + 30);
            if (/^\w+\s*=\s*(?:bmql|get|dictget|jsonget)\s*\(/.test(tail)) continue;

            const after = noStringsText.slice(useIndex + varName.length).trimStart();
            if (after.startsWith('=') && !after.startsWith('==') && !after.startsWith('=>')) continue;

            const windowStart = Math.max(0, useIndex - 15);
            const window = noStringsText.slice(windowStart, useIndex + varName.length + 5);
            if (insideGuardRe.test(window)) continue;

            const contextStart = Math.max(0, useIndex - 4000);
            const context = noStringsText.slice(contextStart, useIndex);
            if (guardPattern.test(context)) continue;

            const argBefore = noStringsText.slice(Math.max(0, useIndex - 20), useIndex).trimEnd();
            const argAfter = noStringsText.slice(useIndex + varName.length, useIndex + varName.length + 20).trimStart();
            if (/[(,]$/.test(argBefore) && /^[,)]/.test(argAfter)) continue;

            const forInBefore = noStringsText.slice(Math.max(0, useIndex - 60), useIndex).trimEnd();
            if (/\bfor\s+\w+\s+in\s*$/.test(forInBefore)) continue;

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
