const { vscode, makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('./shared');

/**
 * Documented per-function constraints on literal arguments, found by reading
 * the full body of app/knowledge/BML/*.md (not just the ::: admonitions):
 *
 *   - Arrays.md: "Specifying a negative number (including NaN, which is
 *     equal to -999999) for the array size throws a runtime exception. For
 *     example, arr = float[-9]; throws a RuntimeException." (jNaN is NOT
 *     included in this - it initializes a size-0 array instead, so it's not
 *     flagged.)
 *   - Others.md (logtime): "This parameter has a 128 character limit. If
 *     more than 128 characters are passed into the function, the 129th and
 *     later characters are truncated."
 *   - Others-GlobalDict.md (globaldictset): "The value should be greater
 *     than 0 and less than 525600 minutes (365 days)."
 *   - Json.md: "The string "null" or 'null' ... can't be saved as value in
 *     a JSON object. Instead it will be saved as string null (i.e. without
 *     the double or single quotation marks.)" and "Any string, encircled by
 *     curly { } or square brackets [ ], which is also encircled by single
 *     or double quotation marks can't be saved in this form as a value..."
 *   - Dictionary.md (values): "Double dimensional dictionaries, boolean
 *     dictionaries, and dictionary anytype are not supported by the values
 *     function."
 *
 * All of these only fire on literal arguments - never on variables, whose
 * runtime value/type can't be known from the source text alone.
 *
 * Codes: bml-negative-array-size, bml-logtime-tag-too-long,
 *        bml-globaldict-ttl-out-of-range, bml-jsonput-reserved-literal,
 *        bml-dict-values-unsupported-type
 */

function checkFunctionConstraints(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

    // Negative literal array size: <type>[-N] or <type>[-N][n] / [n][-N]
    const negativeArraySizeRegex = /\b(float|integer|string|boolean|date)\s*\[\s*(-\d+)\s*\]/gi;
    while ((match = negativeArraySizeRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Error: A negative array size ('${match[2]}') always throws a runtime exception. Array sizes must be 0 or positive.`,
            vscode.DiagnosticSeverity.Error,
            'bml-negative-array-size'
        ));
    }

    // logtime(tag, timeElapsed) - tag literal longer than 128 chars is silently truncated
    const logtimeRegex = /\blogtime\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
    while ((match = logtimeRegex.exec(cleanText)) !== null) {
        const literal = match[1];
        const contentLength = literal.length - 2; // exclude the surrounding quotes
        if (contentLength > 128) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Warning: 'logtime()' tag is ${contentLength} characters - only the first 128 are kept, the rest is silently truncated.`,
                vscode.DiagnosticSeverity.Warning,
                'bml-logtime-tag-too-long'
            ));
        }
    }

    // globaldictset(key, value, [minTimeToLive]) - documented range is > 0 and < 525600
    const globalDictSetRegex = /\bglobaldictset\s*\(/g;
    while ((match = globalDictSetRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 3) {
            const ttlArg = args[2].trim();
            if (/^-?\d+$/.test(ttlArg)) {
                const ttl = parseInt(ttlArg, 10);
                if (ttl <= 0 || ttl >= 525600) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: 'globaldictset()' minTimeToLive (${ttl}) is outside the documented range - it should be greater than 0 and less than 525600 minutes (365 days).`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-globaldict-ttl-out-of-range'
                    ));
                }
            }
        }
    }

    // jsonput(jsonId, key, value) - a literal "null"/'null' or a quoted
    // {..}/[..]-wrapped string value is silently stripped of its quotes
    // instead of being saved as written.
    const jsonputRegex = /\bjsonput\s*\(/g;
    while ((match = jsonputRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 3) {
            const valueArg = args[2].trim();
            const literalMatch = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.exec(valueArg);
            if (literalMatch) {
                const inner = literalMatch[1].slice(1, -1);
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                if (inner.toLowerCase() === 'null') {
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: 'jsonput()' with the literal string "null" as the value doesn't save it as-is - it's stored as the reserved JSON null instead. Use jsonnull() if that's intended, or a different string if not.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-jsonput-reserved-literal'
                    ));
                } else if (/^[{[].*[}\]]$/.test(inner)) {
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: 'jsonput()' value '${inner}' is wrapped in brackets - BML silently strips the surrounding quotes when saving it, so it won't be stored as the literal string you wrote.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-jsonput-reserved-literal'
                    ));
                }
            }
        }
    }

    // dict("boolean") / dict("anytype") / dict("...[][]") declarations later
    // passed to values() - not supported by the values() function.
    // Must scan cleanText (comments blanked, strings intact), not noStringsText -
    // the latter blanks the quotes *and* the type-string content too, so
    // dict("boolean") would otherwise be indistinguishable from dict().
    const unsupportedDictVars = new Set();
    const dictDeclRegex = /\b([a-zA-Z_]\w*)\s*=\s*dict\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;
    while ((match = dictDeclRegex.exec(cleanText)) !== null) {
        const typeArg = match[2].slice(1, -1).toLowerCase();
        const isTwoDimensional = /\[\]\[\]$/.test(typeArg);
        if (typeArg === 'boolean' || typeArg === 'anytype' || isTwoDimensional) {
            unsupportedDictVars.add(match[1]);
        }
    }
    if (unsupportedDictVars.size > 0) {
        const valuesCallRegex = new RegExp(`\\bvalues\\s*\\(\\s*(${[...unsupportedDictVars].join('|')})\\s*\\)`, 'g');
        while ((match = valuesCallRegex.exec(noStringsText)) !== null) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'values()' does not support boolean, anytype, or double-dimensional dictionaries - '${match[1]}' was declared as one of these.`,
                vscode.DiagnosticSeverity.Error,
                'bml-dict-values-unsupported-type'
            ));
        }
    }

    // atof(str) / atoi(str) - empty string literal throws a runtime exception
    const atoiAtofRegex = /\b(atoi|atof)\s*\(/g;
    while ((match = atoiAtofRegex.exec(cleanText)) !== null) {
        const funcName = match[1];
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 1) {
            const arg = args[0].trim();
            if (arg === '""' || arg === "''") {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Error: '${funcName}()' throws a runtime exception when passed an empty string.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-atoi-atof-empty-string'
                ));
            } else if (funcName === 'atoi') {
                // Check if the argument is a string literal containing a decimal point (e.g. "123.45")
                const literalMatch = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.exec(arg);
                if (literalMatch) {
                    const inner = literalMatch[1].slice(1, -1);
                    if (inner.includes('.')) {
                        const startPos = doc.positionAt(match.index);
                        const endPos = doc.positionAt(closeParenIndex + 1);
                        diagnostics.push(makeDiagnostic(
                            new vscode.Range(startPos, endPos),
                            `Error: 'atoi()' throws a runtime exception when passed a string representing a decimal number ('${inner}').`,
                            vscode.DiagnosticSeverity.Error,
                            'bml-atoi-decimal-string'
                        ));
                    }
                }
            }
        }
    }

    // replace(str, searchStr, replaceStr) - empty searchStr throws a runtime exception
    const replaceRegex = /\breplace\s*\(/g;
    while ((match = replaceRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 2) {
            const searchStr = args[1].trim();
            if (searchStr === '""' || searchStr === "''") {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Error: 'replace()' throws a runtime exception when searching for an empty string.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-replace-empty-search-string'
                ));
            }
        }
    }

    // dict(dictType) - check if literal type is valid
    const allowedDictTypes = new Set([
        'string', 'integer', 'float', 'date', 'boolean',
        'string[]', 'integer[]', 'float[]', 'date[]',
        'string[][]', 'integer[][]', 'float[][]', 'date[][]',
        'anytype'
    ]);
    const dictRegex = /\bdict\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;
    while ((match = dictRegex.exec(cleanText)) !== null) {
        const typeArg = match[1].slice(1, -1).toLowerCase();
        if (!allowedDictTypes.has(typeArg)) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'dict()' type '${typeArg}' is invalid. Supported types are string, integer, float, date, boolean, and their 1-D / 2-D array suffixes, or 'anytype'.`,
                vscode.DiagnosticSeverity.Error,
                'bml-dict-invalid-type'
            ));
        }
    }

    // acos(x) / asin(x) - check domain [-1, 1]
    const mathDomainRegex = /\b(acos|asin)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
    while ((match = mathDomainRegex.exec(cleanText)) !== null) {
        const funcName = match[1];
        const val = parseFloat(match[2]);
        if (val > 1.0 || val < -1.0) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Warning: '${funcName}()' argument is outside the valid domain [-1, 1] - passing '${match[2]}' will return NaN.`,
                vscode.DiagnosticSeverity.Warning,
                'bml-math-domain-error'
            ));
        }
    }

    // urldata(url, method) - check HTTP methods (GET, DELETE, PATCH, POST, PUT)
    const allowedHttpMethods = new Set(['GET', 'DELETE', 'PATCH', 'POST', 'PUT']);
    const urldataRegex = /\burldata\s*\(/g;
    while ((match = urldataRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 2) {
            const methodArg = args[1].trim();
            const literalMatch = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.exec(methodArg);
            if (literalMatch) {
                const method = literalMatch[1].slice(1, -1);
                if (!allowedHttpMethods.has(method)) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: 'urldata()' HTTP method '${method}' is not supported. Supported methods are: GET, DELETE, PATCH, POST, or PUT.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-urldata-invalid-method'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkFunctionConstraints };
