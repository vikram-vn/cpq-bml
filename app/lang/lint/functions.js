const { parseParameterSignature, splitArgumentsList } = require('./functionSignature');
const { levenshtein } = require('./levenshtein');
const { inferLiteralType } = require('./typeCheck');
const { getWorkspaceFunctionsCached } = require('./workspaceFunctions');
const { loadBuiltInFunctionsJson } = require('../intellisense/apiDataLoader');

let builtInFunctions = null;
// Mirrors the grammar's reserved words/storage-type constructors so they're never flagged as unknown functions.
const keywords = new Set([
    'if', 'elif', 'else', 'for', 'in', 'break', 'continue', 'return',
    'true', 'false', 'null', 'and', 'or', 'not',
    'string', 'integer', 'float', 'boolean', 'date', 'json', 'jsonarray',
    'jsonnull', 'jnan', 'bytearray', 'record', 'recordset', 'stringbuilder', 'dictionary', 'dict',
    'bmql',
]);
const deprecated = new Set(['strtodate', 'gettabledata', 'getpartsdata']);

function parseSyntax(syntax) {
    const { min, max } = parseParameterSignature(syntax);
    return { min, max };
}

function loadBuiltInFunctions(extensionPath) {
    if (builtInFunctions) return builtInFunctions;
    builtInFunctions = new Map();
    try {
        const data = loadBuiltInFunctionsJson(extensionPath);
        if (data) {
            Object.keys(data).forEach(name => {
                const item = data[name];
                if (item && item.fullSignature && item.fullSignature.includes('(')) {
                    const nameLower = name.toLowerCase();
                    const overloads = item.fullSignature.split(/\r?\n\s*\(or\)\s*\r?\n/);
                    const parsedOverloads = overloads.map(sig => {
                        return parseParameterSignature(sig);
                    });
                    const first = parsedOverloads[0];
                    builtInFunctions.set(nameLower, {
                        overloads: parsedOverloads,
                        min: first.min,
                        max: first.max,
                        params: first.params,
                        syntax: item.fullSignature,
                        name
                    });
                }
            });
        }
    } catch (e) {
        // Fallback to empty map if file can't be loaded
    }
    return builtInFunctions;
}

function getArgumentsTextAndEnd(text, startIndex) {
    let depth = 1;
    let endIdx = -1;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (char === '\\') {
            if (i + 1 < text.length) i++;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (char === '(') depth++;
            else if (char === ')') depth--;

            if (depth === 0) {
                endIdx = i;
                break;
            }
        }
    }

    if (endIdx !== -1) {
        return {
            text: text.substring(startIndex, endIdx),
            endIndex: endIdx
        };
    }
    return null;
}

function countArguments(argsText) {
    if (!argsText.trim()) {
        return 0;
    }

    // Strip a trailing top-level comma so that `find(x,)` counts as 1 arg, not 2.
    // This lets the arg-count diagnostic still fire alongside bml-trailing-comma-error.
    const stripped = argsText.trimEnd();
    const lastChar = stripped[stripped.length - 1];
    const effectiveArgs = lastChar === ',' ? stripped.slice(0, -1) : stripped;

    let commas = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < effectiveArgs.length; i++) {
        const char = effectiveArgs[i];

        if (char === '\\') {
            if (i + 1 < effectiveArgs.length) i++;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
            else if (char === '[') bracketDepth++;
            else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
            else if (char === '{') braceDepth++;
            else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
            else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
                commas++;
            }
        }
    }

    return commas + 1;
}

function findClosestBuiltInFunction(name, builtIns) {
    const nameLower = name.toLowerCase();
    let best = null;
    let bestDist = Infinity;
    for (const [lower, info] of builtIns.entries()) {
        if (Math.abs(lower.length - nameLower.length) > 3) continue;
        const dist = levenshtein(nameLower, lower);
        if (dist < bestDist) {
            bestDist = dist;
            best = info.name;
        }
    }
    return best && bestDist <= 2 && bestDist > 0 ? best : null;
}

function findClosestWorkspaceFunction(fullName, wsFunctions) {
    const fullNameLower = fullName.toLowerCase();
    let best = null;
    let bestDist = Infinity;
    for (const key of wsFunctions.keys()) {
        if (Math.abs(key.length - fullNameLower.length) > 3) continue;
        const dist = levenshtein(fullNameLower, key);
        if (dist < bestDist) {
            bestDist = dist;
            const target = wsFunctions.get(key);
            best = `${target.namespace}.${target.name}`;
        }
    }
    return best && bestDist <= 2 && bestDist > 0 ? best : null;
}

function normalizeType(type) {
    if (!type) return null;
    const match = type.match(/^([A-Za-z]+)((?:\[\])*)$/);
    if (!match) return type.toLowerCase();
    return `${match[1].toLowerCase()}${match[2]}`;
}

// Integer literals are accepted for a Float parameter (numeric widening); everything else must match.
function argumentTypeCompatible(expectedType, actualType) {
    if (!expectedType || !actualType) return true;
    if (Array.isArray(expectedType)) {
        return expectedType.some(exp => argumentTypeCompatible(exp, actualType));
    }
    const expected = normalizeType(expectedType);
    const actual = normalizeType(actualType);
    if (expected === actual) return true;
    if (expected === 'float' && actual === 'integer') return true;
    if (expected === 'long' && actual === 'integer') return true;
    if (expected === 'float' && actual === 'long') return true;
    if (expected === 'numeric' && (actual === 'integer' || actual === 'float' || actual === 'long')) return true;
    if (expected === 'array' && actual.endsWith('[]')) return true;
    if (expected === 'singlearray' && actual.endsWith('[]') && !actual.endsWith('[][]')) return true;
    if (expected === 'doublearray' && actual.endsWith('[][]')) return true;
    if (expected === 'dictionary' && actual === 'dict') return true;
    if (expected === 'dict' && actual === 'dictionary') return true;
    return false;
}

function checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath) {
    const diagnostics = [];
    const builtIns = loadBuiltInFunctions(extensionPath);
    const wsFunctions = getWorkspaceFunctionsCached(vscode);

    // Matches namespaced or bare function calls: [util/commerce.[folder.]]name(
    // The middle "folder" segment covers Oracle CPQ's util library folders/
    // platform namespaces, e.g. util._ORCL_ABO.abo_initializeContext(...).
    const funcCallRegex = /\b(?:(util|commerce)\.(?:([a-zA-Z_]\w*)\.)?)?([a-zA-Z_]\w*)\s*\(/g;
    let match;

    while ((match = funcCallRegex.exec(noStringsText)) !== null) {
        const namespace = match[1];
        const midSegment = match[2];
        const funcName = match[3];
        const funcNameLower = funcName.toLowerCase();

        if (!namespace) {
            let idx = match.index - 1;
            while (idx >= 0 && /\s/.test(noStringsText[idx])) {
                idx--;
            }
            if (idx >= 0 && noStringsText[idx] === '.') {
                continue; // Skip member method calls that aren't util or commerce
            }
        }

        if (!namespace && keywords.has(funcNameLower)) {
            continue; // Skip keywords like if, for, return, dict etc
        }

        const matchStart = match.index;
        const prefix = namespace ? `${namespace}.${midSegment ? `${midSegment}.` : ''}` : '';
        const displayNamespace = midSegment ? `${namespace}.${midSegment}` : namespace;
        const callLength = prefix.length + funcName.length;
        const callStartOffset = matchStart;
        const startPos = doc.positionAt(callStartOffset);
        const endPos = doc.positionAt(callStartOffset + callLength);

        // Find matching closing parenthesis and extract arguments
        const argsStartOffset = matchStart + match[0].length;
        const argsResult = getArgumentsTextAndEnd(noStringsText, argsStartOffset);
        if (!argsResult) continue; // Unbalanced call, syntax error

        // Extract clean arguments text (retaining string literals for correct comma and length counting)
        const argsCleanText = cleanText.substring(argsStartOffset, argsResult.endIndex);
        const argCount = countArguments(argsCleanText);

        if (namespace) {
            // Namespaced call (util.foo, commerce.foo, or util.folder.foo)
            const cacheKey = midSegment
                ? `${namespace.toLowerCase()}.${midSegment.toLowerCase()}.${funcNameLower}`
                : `${namespace.toLowerCase()}.${funcNameLower}`;
            const targetFunc = wsFunctions.get(cacheKey);

            if (!targetFunc) {
                // Oracle-provided platform utilities (ABO, web services, OSC, etc.)
                // are called this way but never appear in a pulled workspace -
                // recognized by name prefix regardless of which namespace/folder
                // segment precedes them.
                const isPlatformFunc = namespace.toLowerCase() === "util" && (
                    funcNameLower.startsWith("abo_") ||
                    funcNameLower.startsWith("ws") ||
                    funcNameLower.startsWith("osc_") ||
                    funcNameLower.startsWith("orcl_") ||
                    funcNameLower === "getbasicauthcredentials"
                );

                if (isPlatformFunc) {
                    continue;
                }

                // Warning/Info: function not found in workspace
                const suggestion = findClosestWorkspaceFunction(`${displayNamespace}.${funcName}`, wsFunctions);
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    suggestion
                        ? `Function '${displayNamespace}.${funcName}' not found in the workspace library. Did you mean '${suggestion}'?`
                        : `Function '${displayNamespace}.${funcName}' not found in the workspace library.`,
                    vscode.DiagnosticSeverity.Information
                );
                diag.code = 'bml-function-not-found-workspace';
                diagnostics.push(diag);
            } else {
                if (argCount !== targetFunc.parameterCount) {
                    const diag = new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Function '${displayNamespace}.${targetFunc.name}' expects ${targetFunc.parameterCount} argument(s), but got ${argCount}.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diag.code = 'bml-function-arg-count';
                    diagnostics.push(diag);
                }

                if (targetFunc.params) {
                    const args = splitArgumentsList(argsCleanText);
                    for (let i = 0; i < args.length && i < targetFunc.params.length; i++) {
                        const expectedType = targetFunc.params[i].type;
                        if (!expectedType) continue;
                        const actualType = inferLiteralType(args[i]);
                        if (!actualType) continue;
                        if (!argumentTypeCompatible(expectedType, actualType)) {
                            const diag = new vscode.Diagnostic(
                                new vscode.Range(startPos, endPos),
                                `Argument ${i + 1} to '${displayNamespace}.${targetFunc.name}' should be ${expectedType}, but got a ${actualType} value.`,
                                vscode.DiagnosticSeverity.Error
                            );
                            diag.code = 'bml-function-arg-type';
                            diagnostics.push(diag);
                        }
                    }
                }
            }
        } else {
            // Bare call
            if (deprecated.has(funcNameLower)) {
                continue; // Skip deprecated functions to avoid double-flagging and baseline mismatches
            }

            const builtIn = builtIns.get(funcNameLower);
            if (builtIn) {
                const overloads = builtIn.overloads || [{ min: builtIn.min, max: builtIn.max, params: builtIn.params }];
                const countMatches = overloads.filter(ov => argCount >= ov.min && argCount <= ov.max);

                if (countMatches.length === 0) {
                    const expectedRanges = overloads.map(ov => ov.min === ov.max ? `${ov.min}` : `${ov.min} to ${ov.max}`);
                    const expectedMsg = Array.from(new Set(expectedRanges)).join(' or ');
                    const diag = new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Built-in function '${builtIn.name}' expects ${expectedMsg} argument(s), but got ${argCount}.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diag.code = 'bml-function-arg-count';
                    diagnostics.push(diag);
                } else {
                    const typeMatches = [];
                    const typeErrors = [];
                    const args = splitArgumentsList(argsCleanText);

                    for (const ov of countMatches) {
                        if (!ov.params) {
                            typeMatches.push(ov);
                            continue;
                        }

                        let match = true;
                        const errors = [];
                        for (let i = 0; i < args.length && i < ov.params.length; i++) {
                            const expectedType = ov.params[i].type;
                            if (!expectedType) continue;
                            const actualType = inferLiteralType(args[i]);
                            if (!actualType) continue;
                            if (!argumentTypeCompatible(expectedType, actualType)) {
                                match = false;
                                errors.push({ index: i, expected: expectedType, actual: actualType });
                            }
                        }
                        if (match) {
                            typeMatches.push(ov);
                        } else {
                            typeErrors.push({ overload: ov, errors });
                        }
                    }

                    if (typeMatches.length === 0 && typeErrors.length > 0) {
                        // Report type error for the first overload that matches the count
                        const bestError = typeErrors[0];
                        for (const err of bestError.errors) {
                            const expectedStr = Array.isArray(err.expected) ? err.expected.join(' or ') : err.expected;
                            const diag = new vscode.Diagnostic(
                                new vscode.Range(startPos, endPos),
                                `Argument ${err.index + 1} to '${builtIn.name}' should be ${expectedStr}, but got a ${err.actual} value.`,
                                vscode.DiagnosticSeverity.Error
                            );
                            diag.code = 'bml-function-arg-type';
                            diagnostics.push(diag);
                        }
                    }
                }
            } else {
                // Unknown bare function call
                const suggestion = findClosestBuiltInFunction(funcName, builtIns);
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    suggestion
                        ? `Unknown built-in function or variable '${funcName}' - did you mean '${suggestion}'?`
                        : `Unknown built-in function or variable '${funcName}'.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = 'bml-unknown-function';
                diagnostics.push(diag);
            }
        }
    }

    return diagnostics;
}

module.exports = {
    checkFunctionCalls,
    parseSyntax,
    countArguments,
    getWorkspaceFunctionsCached,
    keywords,
    loadBuiltInFunctions,
    findClosestBuiltInFunction,
};
