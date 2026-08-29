const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../../rules/typeCheck');
const vscode = require('vscode');

function checkOthers(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

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

    // generatehmacmessage(message, key, [algorithm]) - per Others.md, the
    // algorithm argument is case-sensitive and only SHA256/SHA384/SHA512/
    // SHA1/MD5 are valid (no hyphens, despite the surrounding prose using
    // "SHA-256" style); anything else errors at runtime.
    const validHmacAlgorithms = new Set(['SHA256', 'SHA384', 'SHA512', 'SHA1', 'MD5']);
    const hmacRegex = /\bgeneratehmacmessage\s*\(/g;
    while ((match = hmacRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length === 3) {
            const algoArg = args[2].trim();
            const literalMatch = /^(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')$/.exec(algoArg);
            if (literalMatch) {
                const algo = literalMatch[1] !== undefined ? literalMatch[1] : literalMatch[2];
                if (!validHmacAlgorithms.has(algo)) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: 'generatehmacmessage()' algorithm '${algo}' is not valid. Values are case-sensitive; use exactly one of SHA256, SHA384, SHA512, SHA1, or MD5.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-hmac-invalid-algorithm'
                    ));
                }
            }
        }
    }

    // stringbuilder() call validation
    const stringbuilderRegex = /\bstringbuilder\s*\(/g;
    while ((match = stringbuilderRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length > 3) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'stringbuilder()' expects 0 to 3 arguments, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        } else {
            // Type checking for overloads
            if (args.length >= 1) {
                const actual1 = inferExpressionType(args[0]);
                if (actual1 && actual1 !== 'String' && actual1 !== 'string[]') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 1 to 'stringbuilder' should be String or String[], but got ${actual1}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
            if (args.length >= 2) {
                const actual2 = inferExpressionType(args[1]);
                if (actual2 && actual2 !== 'String') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 2 to 'stringbuilder' should be String, but got ${actual2}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
            if (args.length === 3) {
                const actual3 = inferExpressionType(args[2]);
                if (actual3 && actual3 !== 'Boolean') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 3 to 'stringbuilder' should be Boolean, but got ${actual3}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkOthers };
