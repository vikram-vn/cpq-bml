const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../typeCheck');
const vscode = require('vscode');

function checkJson(cleanText, noStringsText, doc) {
    const diagnostics = [];
    if (!cleanText.includes('json')) return diagnostics;
    let match;

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

    // jsonget(jsonId, key, valueType) / jsonpathgetsingle(jsonId, path, valueType)
    // - the 3-arg form with no 4th defaultValue throws if the key/path is
    // missing AND valueType is Integer/Float/Boolean (per Json.md - both
    // functions document the identical condition, word for word). The 2-arg
    // form and String/JSON/JSONArray valueTypes return null safely instead;
    // only the numeric/boolean 3-arg form is a throw risk.
    for (const funcName of ['jsonget', 'jsonpathgetsingle']) {
        const throwRiskRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
        while ((match = throwRiskRegex.exec(cleanText)) !== null) {
            const openParenIndex = match.index + match[0].length - 1;
            const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
            if (closeParenIndex === -1) continue;
            const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
            if (args.length === 3) {
                const valueTypeArg = args[2].trim();
                const typeMatch = /^["'](integer|float|boolean)["']$/i.exec(valueTypeArg);
                if (typeMatch) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: '${funcName}()' with valueType '${typeMatch[1]}' and no defaultValue throws if the key is missing or the value can't be converted. Add a 4th defaultValue argument to avoid a runtime exception.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-json-get-throws-without-default'
                    ));
                }
            }
        }
    }

    // json() / jsonarray() / jsonnull() call validations
    const jsonFuncs = [
        { name: 'json', min: 0, max: 1, paramType: 'String' },
        { name: 'jsonarray', min: 0, max: 1, paramType: 'String' },
        { name: 'jsonnull', min: 0, max: 0 }
    ];

    for (const jf of jsonFuncs) {
        const regex = new RegExp(`\\b${jf.name}\\s*\\(`, 'g');
        while ((match = regex.exec(cleanText)) !== null) {
            const openParenIndex = match.index + match[0].length - 1;
            const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
            if (closeParenIndex === -1) continue;
            const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

            if (args.length < jf.min || args.length > jf.max) {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Error: '${jf.name}()' expects ${jf.min === jf.max ? jf.min : jf.min + ' to ' + jf.max} arguments, but got ${args.length}.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-function-arg-count'
                ));
            } else if (jf.paramType && args.length === 1) {
                const actual = inferExpressionType(args[0]);
                if (actual && actual !== jf.paramType) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 1 to '${jf.name}' should be ${jf.paramType}, but got ${actual}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkJson };
