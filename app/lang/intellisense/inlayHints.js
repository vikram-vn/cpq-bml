const vscode = require('vscode');
const { parseParameters } = require('./signatureHelp');
const { getWorkspaceIndex } = require('./workspaceIndex');
const { loadJson } = require('./apiDataLoader');

function extractParamName(label) {
    if (!label) return '';
    const parts = label.trim().replace(/[\[\]]/g, '').split(/\s+/);
    return parts[parts.length - 1];
}

function shouldSuppressHint(paramName, argText, suppressWhenMatch) {
    if (!suppressWhenMatch || !paramName || !argText) return false;
    const cleanParam = paramName.trim().toLowerCase().replace(/^[_\$]+|[_\$]+$/g, '');
    const cleanArg = argText.trim().replace(/^['"]|['"]$/g, '').toLowerCase().replace(/^[_\$]+|[_\$]+$/g, '');
    if (!cleanParam || !cleanArg) return false;
    return cleanParam === cleanArg;
}

/**
 * Provides inline parameter name labels for BML function calls.
 */
const paramNamesCache = new Map();

/**
 * Provides inline parameter name labels for BML function calls.
 */
function registerInlayHintsProvider(context) {
    return vscode.languages.registerInlayHintsProvider('bml', {
        provideInlayHints(document, range) {
            const config = vscode.workspace.getConfiguration('cpqBml');
            if (!config.get('features.intellisense', true)) {
                return [];
            }
            if (!config.get('inlayHints.enabled', true)) {
                return [];
            }

            const suppressWhenArgumentMatchesName = config.get('inlayHints.suppressWhenArgumentMatchesName', true);
            const minParams = Math.max(1, config.get('inlayHints.minimumParameters', 2));

            const bmlApiData = loadJson('bml-functions-api-usage', context.extensionPath);
            const hints = [];
            const text = document.getText(range);
            const startOffset = document.offsetAt(range.start);
            const fullText = document.getText();

            const callRegex = /\b([a-zA-Z_][\w.]*)\s*\(/g;
            let match;

            while ((match = callRegex.exec(text)) !== null) {
                const funcName = match[1];
                const funcLower = funcName.toLowerCase();

                if (['if', 'elif', 'else', 'for', 'while', 'return'].includes(funcLower)) {
                    continue;
                }

                let paramNames;
                if (paramNamesCache.has(funcLower)) {
                    paramNames = paramNamesCache.get(funcLower);
                } else {
                    const info = bmlApiData[funcLower];
                    if (info && (info.fullSignature || info.syntax)) {
                        const parsed = parseParameters(info.fullSignature || info.syntax);
                        paramNames = parsed.map(p => extractParamName(typeof p.label === 'string' ? p.label : p.label[0]));
                    } else {
                        const wsIndex = getWorkspaceIndex();
                        const wsInfo = wsIndex.get(funcLower);
                        if (wsInfo && wsInfo.parameters) {
                            paramNames = wsInfo.parameters.map(p => p.name);
                        } else {
                            paramNames = [];
                        }
                    }
                    if (paramNamesCache.size < 2000) {
                        paramNamesCache.set(funcLower, paramNames);
                    }
                }

                if (!paramNames || paramNames.length < minParams) continue;

                const openParenOffset = startOffset + match.index + match[0].length;

                let i = openParenOffset;
                let parenDepth = 1;
                let inString = false;
                let stringChar = '';
                const argStarts = [openParenOffset];
                const argEnds = [];
                const maxLookahead = Math.min(fullText.length, openParenOffset + 2000);

                while (i < maxLookahead && parenDepth > 0) {
                    const char = fullText[i];

                    if (inString) {
                        if (char === stringChar && fullText[i - 1] !== '\\') {
                            inString = false;
                        }
                    } else if (char === '"' || char === "'") {
                        inString = true;
                        stringChar = char;
                    } else if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                        if (parenDepth === 0) {
                            argEnds.push(i);
                        }
                    } else if (char === ',' && parenDepth === 1) {
                        argEnds.push(i);
                        let nextStart = i + 1;
                        while (nextStart < maxLookahead && /\s/.test(fullText[nextStart])) {
                            nextStart++;
                        }
                        argStarts.push(nextStart);
                    }
                    i++;
                }

                if (argStarts.length >= minParams) {
                    argStarts.forEach((argOffset, idx) => {
                        if (idx < paramNames.length && paramNames[idx]) {
                            const paramName = paramNames[idx];
                            const argEnd = argEnds[idx] !== undefined ? argEnds[idx] : argOffset;
                            const argText = fullText.slice(argOffset, argEnd).trim();

                            if (shouldSuppressHint(paramName, argText, suppressWhenArgumentMatchesName)) {
                                return;
                            }

                            const pos = document.positionAt(argOffset);
                            if (pos.line >= range.start.line && pos.line <= range.end.line) {
                                const hint = new vscode.InlayHint(
                                    pos,
                                    `${paramName}: `,
                                    vscode.InlayHintKind.Parameter
                                );
                                hint.paddingRight = true;
                                hints.push(hint);
                            }
                        }
                    });
                }
            }

            return hints;
        }
    });
}

module.exports = { registerInlayHintsProvider, extractParamName, shouldSuppressHint };
