const vscode = require('vscode');
const { parseParameters } = require('./signatureHelp');
const { getWorkspaceIndex } = require('./workspaceIndex');
const { loadJson } = require('./apiDataLoader');

function extractParamName(label) {
    if (!label) return '';
    const parts = label.trim().replace(/[\[\]]/g, '').split(/\s+/);
    return parts[parts.length - 1];
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
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return [];
            }
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

                if (!paramNames || paramNames.length <= 1) continue;

                const openParenOffset = startOffset + match.index + match[0].length;

                let i = openParenOffset;
                let parenDepth = 1;
                let inString = false;
                let stringChar = '';
                const argStarts = [openParenOffset];
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
                    } else if (char === ',' && parenDepth === 1) {
                        let nextStart = i + 1;
                        while (nextStart < maxLookahead && /\s/.test(fullText[nextStart])) {
                            nextStart++;
                        }
                        argStarts.push(nextStart);
                    }
                    i++;
                }

                if (argStarts.length > 1) {
                    argStarts.forEach((argOffset, idx) => {
                        if (idx < paramNames.length && paramNames[idx]) {
                            const pos = document.positionAt(argOffset);
                            if (pos.line >= range.start.line && pos.line <= range.end.line) {
                                const hint = new vscode.InlayHint(
                                    pos,
                                    `${paramNames[idx]}: `,
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

module.exports = { registerInlayHintsProvider, extractParamName };
