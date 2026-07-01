const vscode = require('vscode');

/**
 * Type Coercion / Concat Mismatch Checker
 *
 * In BML, string concatenation uses `~` (tilde). Using `+` between a string
 * literal and an integer/float literal (or vice versa) is almost always a
 * mistake — the developer likely meant `~`.
 *
 * Specifically flags expressions of the form:
 *   "string" + variable
 *   "string" + 42
 *   variable + "string"
 *   42 + "string"
 *
 * We run on cleanText (comments blanked, strings preserved) so we can detect
 * string literals.
 *
 * Code: bml-concat-type-mismatch  Severity: Warning
 */
function checkTypeCoercion(cleanText, doc) {
    const diagnostics = [];

    // Pattern: string literal + non-string operand, or non-string + string literal
    // We look for: "..." + something, or something + "..."
    // where "something" is a numeric literal or identifier (not another string)
    const patterns = [
        // "str" + numericLiteral  or  "str" + identifier
        /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\+\s*(\d+(?:\.\d+)?|\b[a-zA-Z_]\w*\b)/g,
        // numericLiteral + "str"  or  identifier + "str"
        /(\d+(?:\.\d+)?|\b[a-zA-Z_]\w*\b)\s*\+\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    ];

    // Keywords and built-ins that commonly appear in legit + contexts
    const skipWords = new Set(['if', 'elif', 'else', 'for', 'return', 'and', 'or', 'not', 'in', 'true', 'false']);

    for (const regex of patterns) {
        let m;
        while ((m = regex.exec(cleanText)) !== null) {
            const lhs = m[1];
            const rhs = m[2];

            // Skip if both sides look like strings
            const lhsIsStr = /^["']/.test(lhs);
            const rhsIsStr = /^["']/.test(rhs);
            if (lhsIsStr && rhsIsStr) continue;

            // Skip keyword tokens
            if (skipWords.has(lhs.toLowerCase()) || skipWords.has(rhs.toLowerCase())) continue;

            // Only flag when one side is clearly a string literal
            if (!lhsIsStr && !rhsIsStr) continue;

            const startPos = doc.positionAt(m.index);
            const endPos = doc.positionAt(m.index + m[0].length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Style Warning: String concatenation using '+' detected. BML uses '~' for string concatenation. If you intended string concat, use '~' instead of '+'.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-concat-type-mismatch';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkTypeCoercion };
