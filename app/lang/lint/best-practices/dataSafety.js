const { vscode, makeDiagnostic } = require('./shared');

/**
 * Runtime-safety checks around type conversion, array access, and numeric
 * literals: unsafe atoi/atof, unchecked split() access, dict() missing a
 * type argument, division by literal zero, direct float equality.
 *
 * Codes: bml-unsafe-atoi-atof, bml-unchecked-split-access,
 *        bml-dict-missing-type, bml-division-by-zero, bml-float-equality
 */
function checkDataSafety(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // isnumber Check before atoi/atof (run on noStringsText)
    const atoiRegex = /\b(atoi|atof)\s*\(\s*([a-zA-Z_]\w*)\s*\)/g;
    let match;
    while ((match = atoiRegex.exec(noStringsText)) !== null) {
        const func = match[1];
        const varName = match[2];
        const startIndex = match.index;
        const contextStart = Math.max(0, startIndex - 2000);
        const contextText = noStringsText.substring(contextStart, startIndex);
        // Real CPQ library code validates numericality a few different ways, not
        // just the literal isnumber(x) call: isnull(x) and trim(x) == ""/<> ""
        // empty-string checks are just as safe a guard before atoi/atof, and are
        // the more common idiom in practice (see e.g. abo_jsonCompare's
        // `if (isnull(string1) or trim(string1) == "") { string1 = dummyNumber; }`
        // pattern before its atof() calls).
        const safeBeforeAtoRegex = new RegExp(
            `\\bisnumber\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\bisnull\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\btrim\\s*\\(\\s*${varName}\\s*\\)\\s*(?:==|<>|!=)\\s*["']{2}` +
            `|\\b${varName}\\s*(?:==|<>|!=)\\s*["']{2}`,
            'i'
        );
        if (!safeBeforeAtoRegex.test(contextText)) {
            const startPos = doc.positionAt(startIndex);
            const endPos = startPos.translate(0, match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Safety Warning: Validate numericality of data with 'isnumber(${varName})' or use a safe wrapper like 'customAtoi'/'customAtof' before calling '${func}'`,
                vscode.DiagnosticSeverity.Warning,
                'bml-unsafe-atoi-atof'
            ));
        }
    }

    // Split Array Size Verification (run on noStringsText)
    const splitVars = new Set();
    const splitRegex = /\b([a-zA-Z_]\w*)\s*=\s*split\s*\(/g;
    let splitMatch;
    while ((splitMatch = splitRegex.exec(noStringsText)) !== null) {
        splitVars.add(splitMatch[1]);
    }

    if (splitVars.size > 0) {
        const arrayAccessRegex = new RegExp(`\\b(${Array.from(splitVars).join('|')})\\s*\\[\\s*([^\\]]+)\\s*\\]`, 'g');
        let accessMatch;
        while ((accessMatch = arrayAccessRegex.exec(noStringsText)) !== null) {
            const varName = accessMatch[1];
            const accessIndex = accessMatch.index;

            const contextStart = Math.max(0, accessIndex - 2000);
            const contextText = noStringsText.substring(contextStart, accessIndex);
            const sizeCheckRegex = new RegExp(`\\bsizeofarray\\s*\\(\\s*${varName}\\s*\\)`, 'i');
            if (!sizeCheckRegex.test(contextText)) {
                const startPos = doc.positionAt(accessIndex);
                const endPos = doc.positionAt(accessIndex + accessMatch[0].length);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Safety Warning: Check the size of the split array '${varName}' using 'sizeofarray()' before accessing elements`,
                    vscode.DiagnosticSeverity.Warning,
                    'bml-unchecked-split-access'
                ));
            }
        }
    }

    // dict() requires a type argument (e.g. dict("string"), dict("anytype")) -
    // dict() with no arguments compiles but throws at runtime. Must run on cleanText
    // (comments blanked, strings left intact) rather than noStringsText - the latter
    // blanks the quotes *and* the type-string content too, so a perfectly valid
    // dict("string") call would otherwise look like an empty dict() call once its
    // argument was blanked away.
    const dictNoArgsRegex = /\bdict\s*\(\s*\)/g;
    while ((match = dictNoArgsRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `'dict()' requires a type argument (e.g. dict("string"), dict("integer[]"), dict("anytype")) - calling it with none will throw at runtime`,
            vscode.DiagnosticSeverity.Error,
            'bml-dict-missing-type'
        ));
    }

    // Division by a literal zero - always a runtime exception in BML, never
    // intentional. Parse the full numeric literal rather than pattern-matching
    // on '0' directly so '/ 0.5' (a perfectly normal divisor) isn't mistaken for
    // '/ 0' just because it starts with the digit zero.
    const divisionRegex = /\/\s*(\d+(?:\.\d+)?)\b/g;
    while ((match = divisionRegex.exec(noStringsText)) !== null) {
        if (parseFloat(match[1]) !== 0) continue;
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Division by literal zero ('${match[1]}') will throw a runtime exception`,
            vscode.DiagnosticSeverity.Error,
            'bml-division-by-zero'
        ));
    }

    // Float Equality Comparison (run on noStringsText)
    const floatCompareRegex = /\b([a-zA-Z_]\w*)\s*(==|!=|<>)\s*(\d+\.\d+)|(\d+\.\d+)\s*(==|!=|<>)\s*\b([a-zA-Z_]\w*)/g;
    while ((match = floatCompareRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Safety Warning: Comparing float values directly with '==' or '!=' can lead to precision errors. Consider using a tolerance threshold.",
            vscode.DiagnosticSeverity.Warning,
            'bml-float-equality'
        ));
    }

    return diagnostics;
}

module.exports = { checkDataSafety };
