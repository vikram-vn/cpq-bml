const { vscode, makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('./shared');

/**
 * Calls that are guaranteed to throw or fail to compile regardless of
 * runtime data, per app/knowledge/BML/String.md:
 *   - atoi("") / atof("") - "An empty string will throw an exception error."
 *   - isnumber() with no argument - "a compile time error is thrown."
 *   - replace(str, "", new) - "Replacing with any empty string throws an
 *     exception" (the empty 'old'/search argument, specifically).
 *   - string("literal") - "will throw a compile time error if a string is
 *     passed in as a parameter" (string() casts Float/Integer/Boolean only).
 *
 * These only fire on literal arguments (not variables, whose runtime value
 * can't be known statically), so they're zero-false-positive by construction.
 *
 * Codes: bml-atoi-atof-empty-literal, bml-isnumber-no-args,
 *        bml-replace-empty-pattern, bml-string-cast-of-string
 */

const EMPTY_STRING_LITERAL = /^(?:""|'')$/;

function checkLiteralMisuse(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // atoi("") / atof("")
    const atoEmptyRegex = /\b(atoi|atof)\s*\(\s*("")|\b(atoi|atof)\s*\(\s*('')/g;
    let match;
    while ((match = atoEmptyRegex.exec(cleanText)) !== null) {
        const func = match[1] || match[3];
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Error: '${func}("")' always throws an exception - an empty string cannot be parsed as a number.`,
            vscode.DiagnosticSeverity.Error,
            'bml-atoi-atof-empty-literal'
        ));
    }

    // isnumber() with no argument at all (isnumber("") is valid - returns false)
    const isnumberNoArgsRegex = /\bisnumber\s*\(\s*\)/g;
    while ((match = isnumberNoArgsRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Error: 'isnumber()' requires a string argument - calling it with none is a compile time error.",
            vscode.DiagnosticSeverity.Error,
            'bml-isnumber-no-args'
        ));
    }

    // replace(str, old, new, [n]) - throws when 'old' (the search argument) is a literal empty string
    const replaceCallRegex = /\breplace\s*\(/g;
    while ((match = replaceCallRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const argsText = cleanText.slice(openParenIndex + 1, closeParenIndex);
        const args = splitTopLevelArgs(argsText);
        if (args.length >= 2 && EMPTY_STRING_LITERAL.test(args[1])) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                "Error: 'replace()' always throws when the 'old' (search) argument is an empty string.",
                vscode.DiagnosticSeverity.Error,
                'bml-replace-empty-pattern'
            ));
        }
    }

    // string("literal") - string() casts Float/Integer/Boolean to String; passing
    // an actual string literal is a compile time error.
    const stringCastRegex = /\bstring\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;
    while ((match = stringCastRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Error: 'string()' converts a Float, Integer, or Boolean to text - passing a string literal is a compile time error (the value is already a string).",
            vscode.DiagnosticSeverity.Error,
            'bml-string-cast-of-string'
        ));
    }

    return diagnostics;
}

module.exports = { checkLiteralMisuse };
