const fs = require('fs');
const path = require('path');

let builtInFunctions = null;
const keywords = new Set(['if', 'elif', 'for', 'else', 'return', 'and', 'or', 'not', 'bmql', 'dict', 'json', 'jsonarray']);
const deprecated = new Set(['strtodate', 'gettabledata', 'getpartsdata']);

function parseSyntax(syntax) {
    const match = syntax.match(/\(([^)]*)\)/);
    if (!match) return { min: 0, max: 0 };
    const paramsText = match[1].trim();
    if (!paramsText) return { min: 0, max: 0 };

    let requiredCount = 0;
    let totalCount = 0;
    let inOptional = false;

    const parts = paramsText.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        
        // Clean array brackets like String[] so they aren't mistaken for optional parameter brackets like [String param]
        const cleanPart = trimmed.replace(/\[\s*\]/g, '');
        
        totalCount++;
        if (cleanPart.includes('[') || inOptional) {
            inOptional = true;
        }
        if (!inOptional) {
            requiredCount++;
        }
    }
    return { min: requiredCount, max: totalCount };
}

function loadBuiltInFunctions() {
    if (builtInFunctions) return builtInFunctions;
    builtInFunctions = new Map();
    try {
        const commonJsonPath = path.resolve(__dirname, '../../lookups/bml/common.json');
        if (fs.existsSync(commonJsonPath)) {
            const content = fs.readFileSync(commonJsonPath, 'utf8');
            const data = JSON.parse(content);
            if (data && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    if (item.name && item.syntax && item.syntax.includes('(')) {
                        const nameLower = item.name.toLowerCase();
                        const { min, max } = parseSyntax(item.syntax);
                        builtInFunctions.set(nameLower, { min, max, syntax: item.syntax, name: item.name });
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

    const pullFolder = vscode.workspace.getConfiguration('cpqBml').get('rest.pullFolder', 'library');

    for (const folder of folders) {
        const rootPath = folder.uri.fsPath;
        const libraryPath = path.join(rootPath, 'bml', pullFolder);
        if (!fs.existsSync(libraryPath)) continue;

        const findMetaFiles = (dir) => {
            let results = [];
            let list;
            try {
                list = fs.readdirSync(dir);
            } catch (err) {
                return results;
            }
            list.forEach((file) => {
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

        const metaFiles = findMetaFiles(libraryPath);
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

function getWorkspaceFunctionsCached(vscode) {
    const now = Date.now();
    if (now - lastScannedTime > 5000) {
        cachedWorkspaceFunctions = getWorkspaceFunctions(vscode);
        lastScannedTime = now;
    }
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

function checkFunctionCalls(cleanText, noStringsText, doc, vscode) {
    const diagnostics = [];
    const builtIns = loadBuiltInFunctions();
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
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Function '${namespace}.${funcName}' not found in the workspace library.`,
                        vscode.DiagnosticSeverity.Information
                    )
                );
            } else {
                if (argCount !== targetFunc.parameterCount) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            new vscode.Range(startPos, endPos),
                            `Function '${namespace}.${targetFunc.name}' expects ${targetFunc.parameterCount} argument(s), but got ${argCount}.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
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
                    diagnostics.push(
                        new vscode.Diagnostic(
                            new vscode.Range(startPos, endPos),
                            `Built-in function '${builtIn.name}' expects ${expectedMsg} argument(s), but got ${argCount}.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            } else {
                // Unknown bare function call
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Unknown built-in function or variable '${funcName}'.`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }
    }

    return diagnostics;
}

module.exports = { checkFunctionCalls, parseSyntax, countArguments };
