const { parseParameterSignature, splitArgumentsList } = require('./functionSignature');
const { levenshtein } = require('./levenshtein');
const { inferLiteralType, inferExpressionType } = require('./typeCheck');
const { getWorkspaceFunctionsCached } = require('./workspaceFunctions');
const { loadBuiltInFunctionsJson, loadCpqJsApiJson } = require('../intellisense/apiDataLoader');
const { getFunctionReturnTypes } = require('./typeCheckOperands');

function inferArgumentType(argText, firstTypeByVar, returnTypes) {
    if (!argText) return null;
    const trimmed = argText.trim();
    if (!trimmed) return null;

    const lit = inferLiteralType(trimmed);
    if (lit) return lit;

    if (/^[a-zA-Z_]\w*$/.test(trimmed)) {
        const keyLower = trimmed.toLowerCase();
        if (firstTypeByVar) {
            const entry = firstTypeByVar.get(keyLower) || firstTypeByVar.get(trimmed);
            if (entry && entry.type) return entry.type;
        }
        if (/^(true|false)$/i.test(trimmed)) return 'Boolean';
        if (/^null$/i.test(trimmed)) return 'Null';
    }

    return inferExpressionType(trimmed);
}

let builtInFunctions = null;
const controlKeywords = new Set([
    'if', 'elif', 'else', 'for', 'in', 'break', 'continue', 'return',
    'true', 'false', 'null', 'and', 'or', 'not', 'bmql'
]);
const keywords = new Set([
    ...controlKeywords,
    'string', 'integer', 'float', 'boolean', 'date', 'json', 'jsonarray',
    'jsonnull', 'jnan', 'bytearray', 'record', 'recordset', 'stringbuilder', 'dictionary', 'dict'
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
    for (let i = startIndex; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode === 40) depth++; // '('
        else if (charCode === 41) { // ')'
            depth--;
            if (depth === 0) {
                return {
                    text: text.substring(startIndex, i),
                    endIndex: i
                };
            }
        }
    }
    return null;
}

function countArguments(argsText) {
    if (!argsText || !argsText.trim()) return 0;
    const args = splitArgumentsList(argsText);
    return args.filter(a => a.trim().length > 0).length;
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
    let clean = type.toLowerCase().trim();
    if (clean.startsWith('dict<') || clean.startsWith('dictionary<')) {
        clean = clean.startsWith('dict<') ? 'dict' : 'dictionary';
    }
    const match = clean.match(/^([a-z_]\w*)((?:\[\])*)$/);
    if (!match) return clean;
    return `${match[1]}${match[2]}`;
}

// Integer literals are accepted for a Float parameter (numeric widening); everything else must match.
function argumentTypeCompatible(expectedType, actualType) {
    if (!expectedType || !actualType) return true;
    if (Array.isArray(expectedType)) {
        return expectedType.some(exp => argumentTypeCompatible(exp, actualType));
    }
    const expected = normalizeType(expectedType);
    const actual = normalizeType(actualType);
    if (expected === 'any' || expected === 'anytype' || expected === 'object' || expected === 'valuetype') return true;
    if (actual === 'any' || actual === 'anytype' || actual === 'object') return true;
    if (expected === actual) return true;
    if (expected === 'float' && actual === 'integer') return true;
    if (expected === 'long' && actual === 'integer') return true;
    if (expected === 'float' && actual === 'long') return true;
    if ((expected === 'numeric' || expected === 'number') && (actual === 'integer' || actual === 'float' || actual === 'long')) return true;
    if (expected === 'array' && actual.endsWith('[]')) return true;
    if (expected === 'singlearray' && actual.endsWith('[]') && !actual.endsWith('[][]')) return true;
    if (expected === 'doublearray' && actual.endsWith('[][]')) return true;
    if ((expected === 'dictionary' || expected === 'dict') && (actual === 'dict' || actual === 'dictionary')) return true;
    if (expected === 'function' && (actual === 'string' || actual === 'function')) return true;
    return false;
}

function checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath, firstTypeByVar) {
    const diagnostics = [];
    const builtIns = loadBuiltInFunctions(extensionPath);
    const wsFunctions = getWorkspaceFunctionsCached(vscode);
    const returnTypes = getFunctionReturnTypes(extensionPath);

    // Matches namespaced or bare function calls: [util/commerce/CPQJS.[folder.]]name(
    // The middle "folder" segment covers Oracle CPQ's util library folders/
    // platform namespaces, e.g. util._ORCL_ABO.abo_initializeContext(...).
    const funcCallRegex = /\b(?:(util|commerce|CPQJS)\.(?:([a-zA-Z_]\w*)\.)?)?([a-zA-Z_]\w*)\s*\(/g;
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
            continue; // Skip keywords like if, for, return, dict, string, date etc
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

        // Extract clean arguments text
        const argsCleanText = cleanText.substring(argsStartOffset, argsResult.endIndex);
        const argCount = countArguments(argsCleanText);

        if (namespace && namespace.toUpperCase() === 'CPQJS') {
            const cpqJsData = loadCpqJsApiJson(extensionPath);
            const cpqKey = `CPQJS.${funcName}`;
            const target = cpqJsData[cpqKey] || cpqJsData[funcName];
            if (target && target.syntax) {
                const parsed = parseParameterSignature(target.syntax);
                const countMatches = (argCount >= parsed.min && argCount <= parsed.max);
                if (!countMatches) {
                    const diag = new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Function '${cpqKey}' expects ${parsed.min} argument(s), but got ${argCount}.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diag.code = 'bml-function-arg-count';
                    diagnostics.push(diag);
                }
                if (parsed.params) {
                    const args = splitArgumentsList(argsCleanText);
                    for (let i = 0; i < Math.min(args.length, parsed.params.length); i++) {
                        const param = parsed.params[i];
                        if (param && param.type) {
                            const actual = inferArgumentType(args[i], firstTypeByVar, returnTypes);
                            if (actual && !argumentTypeCompatible(param.type, actual)) {
                                const diag = new vscode.Diagnostic(
                                    new vscode.Range(startPos, endPos),
                                    `Argument ${i + 1} to '${cpqKey}' should be ${Array.isArray(param.type) ? param.type.join(' or ') : param.type}, but got a ${actual} value.`,
                                    vscode.DiagnosticSeverity.Error
                                );
                                diag.code = 'bml-function-arg-type';
                                diagnostics.push(diag);
                            }
                        }
                    }
                }
            }
            continue;
        }

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
                        const actualType = inferArgumentType(args[i], firstTypeByVar, returnTypes);
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
                }

                const targetOverloads = countMatches.length > 0 ? countMatches : overloads;
                const typeMatches = [];
                const typeErrors = [];
                const args = splitArgumentsList(argsCleanText);

                for (const ov of targetOverloads) {
                        if (!ov.params) {
                            typeMatches.push(ov);
                            continue;
                        }

                        let match = true;
                        const errors = [];
                        for (let i = 0; i < args.length && i < ov.params.length; i++) {
                            const expectedType = ov.params[i].type;
                            if (!expectedType) continue;
                            const actualType = inferArgumentType(args[i], firstTypeByVar, returnTypes);
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
