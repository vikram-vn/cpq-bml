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

            const callRegex = /\b([a-zA-Z_][\w.]*)\s*\(/g;
            let match;

            while ((match = callRegex.exec(text)) !== null) {
                const funcName = match[1];
                const funcLower = funcName.toLowerCase();

                if (['if', 'elif', 'else', 'for', 'while', 'return'].includes(funcLower)) {
                    continue;
                }

                let paramNames = [];
                const info = bmlApiData[funcLower];
                if (info && (info.fullSignature || info.syntax)) {
                    const parsed = parseParameters(info.fullSignature || info.syntax);
                    paramNames = parsed.map(p => extractParamName(typeof p.label === 'string' ? p.label : p.label[0]));
                } else {
                    const wsIndex = getWorkspaceIndex();
                    const wsInfo = wsIndex.get(funcLower);
                    if (wsInfo && wsInfo.parameters) {
                        paramNames = wsInfo.parameters.map(p => p.name);
                    }
                }

                if (!paramNames || paramNames.length <= 1) continue;

                const openParenOffset = startOffset + match.index + match[0].length;

                let i = openParenOffset;
                let parenDepth = 1;
                let inString = false;
                let stringChar = '';
                const argStarts = [openParenOffset];

                const fullText = document.getText();
                while (i < fullText.length && parenDepth > 0) {
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
                        while (nextStart < fullText.length && /\s/.test(fullText[nextStart])) {
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
