const fs = require('fs');
const path = require('path');
const { parseParameterSignature, splitArgumentsList } = require('./functionSignature');
const { levenshtein } = require('./levenshtein');
const { inferLiteralType } = require('./typeCheck');

let builtInFunctions = null;
// Mirrors the grammar's reserved words/storage-type constructors so they're never flagged as unknown functions.
const keywords = new Set([
    'if', 'elif', 'else', 'for', 'in', 'break', 'continue', 'return',
    'true', 'false', 'null', 'and', 'or', 'not',
    'string', 'integer', 'float', 'boolean', 'date', 'json', 'jsonarray',
    'jsonnull', 'bytearray', 'record', 'recordset', 'stringbuilder', 'dictionary', 'dict',
    'bmql',
]);
const deprecated = new Set(['strtodate', 'gettabledata', 'getpartsdata']);

function parseSyntax(syntax) {
    const { min, max } = parseParameterSignature(syntax);
    return { min, max };
}

// extensionPath anchors the path correctly once bundled by esbuild, where __dirname resolves to dist/.
function loadBuiltInFunctions(extensionPath) {
    if (builtInFunctions) return builtInFunctions;
    builtInFunctions = new Map();
    try {
        const apiUsagePath = extensionPath
            ? path.join(extensionPath, 'app', 'lang', 'intellisense', 'bml_functions_api_usage.json')
            : path.resolve(__dirname, '../intellisense/bml_functions_api_usage.json');
        if (fs.existsSync(apiUsagePath)) {
            const content = fs.readFileSync(apiUsagePath, 'utf8');
            const data = JSON.parse(content);
            if (data) {
                Object.keys(data).forEach(name => {
                    const item = data[name];
                    if (item && item.fullSignature && item.fullSignature.includes('(')) {
                        const nameLower = name.toLowerCase();
                        const { min, max, params } = parseParameterSignature(item.fullSignature);
                        builtInFunctions.set(nameLower, { min, max, params, syntax: item.fullSignature, name });
                    }
                });
            }
        }
    } catch (e) {
        // Fallback to empty map if file can't be loaded
    }
    return builtInFunctions;
}

let cachedWorkspaceFunctions = new Map();
let lastScannedTime = 0;

function getWorkspaceFunctions(vscode) {
    const functionsMap = new Map();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return functionsMap;

    for (const folder of folders) {
        const rootPath = folder.uri.fsPath;

        const findMetaFiles = (dir) => {
            let results = [];
            let list;
            try {
                list = fs.readdirSync(dir);
            } catch (err) {
                return results;
            }
            list.forEach((file) => {
                if (file === 'node_modules' || file === '.git' || file === '.vscode-test' || file === 'dist') {
                    return;
                }
                const fullPath = path.join(dir, file);
                let stat;
                try {
                    stat = fs.statSync(fullPath);
                } catch (e) {
                    return;
                }
                if (stat && stat.isDirectory()) {
                    results = results.concat(findMetaFiles(fullPath));
                } else if (file.endsWith('-meta.json')) {
                    results.push(fullPath);
                }
            });
            return results;
        };

        const metaFiles = findMetaFiles(rootPath);
        for (const metaFile of metaFiles) {
            try {
                const content = fs.readFileSync(metaFile, 'utf8');
                const meta = JSON.parse(content);
                if (meta && meta.variableName) {
                    const funcName = meta.variableName;
                    const parameterCount = meta.parameters ? meta.parameters.length : 0;
                    
                    let namespace = 'util';
                    if (meta.commerceDocument || metaFile.replace(/\\/g, '/').includes('/libraries/')) {
                        namespace = 'commerce';
                    }
                    
                    functionsMap.set(`${namespace}.${funcName.toLowerCase()}`, {
                        path: metaFile,
                        parameterCount,
                        name: funcName,
                        namespace
                    });
                }
            } catch (e) {
                // Ignore parsing errors for individual files
            }
        }
    }
    return functionsMap;
}

let isInitialized = false;
let watcher = null;

function initializeCache(vscode) {
    if (isInitialized) return;
    isInitialized = true;

    // Initial scan
    cachedWorkspaceFunctions = getWorkspaceFunctions(vscode);

    try {
        // Watch for metadata file changes anywhere in the workspace
        watcher = vscode.workspace.createFileSystemWatcher('**/*-meta.json');
        
        const handleMetaChange = (uri) => {
            try {
                const fsPath = uri.fsPath;
                if (fs.existsSync(fsPath)) {
                    const content = fs.readFileSync(fsPath, 'utf8');
                    const meta = JSON.parse(content);
                    if (meta && meta.variableName) {
                        const funcName = meta.variableName;
                        const parameterCount = meta.parameters ? meta.parameters.length : 0;
                        
                        let namespace = 'util';
                        if (meta.commerceDocument || fsPath.replace(/\\/g, '/').includes('/libraries/')) {
                            namespace = 'commerce';
                        }
                        
                        cachedWorkspaceFunctions.set(`${namespace}.${funcName.toLowerCase()}`, {
                            path: fsPath,
                            parameterCount,
                            name: funcName,
                            namespace
                        });
                    }
                }
            } catch (e) {
                // ignore parsing or read errors
            }
        };

        const handleMetaDelete = (uri) => {
            const fsPath = uri.fsPath;
            for (const [key, val] of cachedWorkspaceFunctions.entries()) {
                if (val.path === fsPath) {
                    cachedWorkspaceFunctions.delete(key);
                }
            }
        };

        watcher.onDidCreate(handleMetaChange);
        watcher.onDidChange(handleMetaChange);
        watcher.onDidDelete(handleMetaDelete);

        // Re-scan when workspace folders change
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            cachedWorkspaceFunctions = getWorkspaceFunctions(vscode);
        });
    } catch (e) {
        // Fallback if watcher registration fails
    }
}

function getWorkspaceFunctionsCached(vscode) {
    initializeCache(vscode);
    return cachedWorkspaceFunctions;
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

    let commas = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < argsText.length; i++) {
        const char = argsText[i];

        if (char === '\\') {
            if (i + 1 < argsText.length) i++;
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

function normalizeType(type) {
    if (!type) return null;
    const match = type.match(/^([A-Za-z]+)((?:\[\])*)$/);
    if (!match) return type.toLowerCase();
    return `${match[1].toLowerCase()}${match[2]}`;
}

// Integer literals are accepted for a Float parameter (numeric widening); everything else must match.
function argumentTypeCompatible(expectedType, actualType) {
    if (!expectedType || !actualType) return true;
    const expected = normalizeType(expectedType);
    const actual = normalizeType(actualType);
    if (expected === actual) return true;
    if (expected === 'float' && actual === 'integer') return true;
    return false;
}

function checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath) {
    const diagnostics = [];
    const builtIns = loadBuiltInFunctions(extensionPath);
    const wsFunctions = getWorkspaceFunctionsCached(vscode);

    // Matches namespaced or bare function calls: [util/commerce.]name(
    const funcCallRegex = /\b(?:(util|commerce)\.)?([a-zA-Z_]\w*)\s*\(/g;
    let match;

    while ((match = funcCallRegex.exec(noStringsText)) !== null) {
        const namespace = match[1];
        const funcName = match[2];
        const funcNameLower = funcName.toLowerCase();
        
        if (!namespace && keywords.has(funcNameLower)) {
            continue; // Skip keywords like if, for, return, dict etc
        }

        const matchStart = match.index;
        const callStartOffset = matchStart + match[0].indexOf(funcName);
        const startPos = doc.positionAt(callStartOffset);
        const endPos = doc.positionAt(callStartOffset + funcName.length);

        // Find matching closing parenthesis and extract arguments
        const argsStartOffset = matchStart + match[0].length;
        const argsResult = getArgumentsTextAndEnd(noStringsText, argsStartOffset);
        if (!argsResult) continue; // Unbalanced call, syntax error

        // Extract clean arguments text (retaining string literals for correct comma and length counting)
        const argsCleanText = cleanText.substring(argsStartOffset, argsResult.endIndex);
        const argCount = countArguments(argsCleanText);

        if (namespace) {
            // Namespaced call (util.foo or commerce.foo)
            const cacheKey = `${namespace.toLowerCase()}.${funcNameLower}`;
            const targetFunc = wsFunctions.get(cacheKey);

            if (!targetFunc) {
                // Warning/Info: function not found in workspace
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `Function '${namespace}.${funcName}' not found in the workspace library.`,
                    vscode.DiagnosticSeverity.Information
                );
                diag.code = 'bml-function-not-found-workspace';
                diagnostics.push(diag);
            } else {
                if (argCount !== targetFunc.parameterCount) {
                    const diag = new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Function '${namespace}.${targetFunc.name}' expects ${targetFunc.parameterCount} argument(s), but got ${argCount}.`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diag.code = 'bml-function-arg-count';
                    diagnostics.push(diag);
                }
            }
        } else {
            // Bare call
            if (deprecated.has(funcNameLower)) {
                continue; // Skip deprecated functions to avoid double-flagging and baseline mismatches
            }

            const builtIn = builtIns.get(funcNameLower);
            if (builtIn) {
                if (argCount < builtIn.min || argCount > builtIn.max) {
                    let expectedMsg = '';
                    if (builtIn.min === builtIn.max) {
                        expectedMsg = `${builtIn.min}`;
                    } else {
                        expectedMsg = `${builtIn.min} to ${builtIn.max}`;
                    }
                    const diag = new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Built-in function '${builtIn.name}' expects ${expectedMsg} argument(s), but got ${argCount}.`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diag.code = 'bml-function-arg-count';
                    diagnostics.push(diag);
                }

                if (builtIn.params) {
                    const args = splitArgumentsList(argsCleanText);
                    for (let i = 0; i < args.length && i < builtIn.params.length; i++) {
                        const expectedType = builtIn.params[i].type;
                        if (!expectedType) continue;
                        const actualType = inferLiteralType(args[i]);
                        if (!actualType) continue;
                        if (!argumentTypeCompatible(expectedType, actualType)) {
                            const diag = new vscode.Diagnostic(
                                new vscode.Range(startPos, endPos),
                                `Argument ${i + 1} to '${builtIn.name}' should be ${expectedType}, but got a ${actualType} value.`,
                                vscode.DiagnosticSeverity.Warning
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
