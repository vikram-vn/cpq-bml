let vscode;
try {
    vscode = require('vscode');
} catch {
    vscode = {};
}
const { loadJson } = require('../apiDataLoader');
const {
    extractParamName,
    extractParamNamesFromSignature,
    shouldSuppressHint,
    resolveParamNames,
    BML_CURATED_PARAMS
} = require('./paramResolver');
const { inferVariableType } = require('./typeInferrer');

function isInsideCommentOrString(fullText, targetOffset) {
    let inLineComment = false;
    let inBlockComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < targetOffset; i++) {
        const ch = fullText[i];
        const next = i + 1 < fullText.length ? fullText[i + 1] : '';

        if (inLineComment) {
            if (ch === '\n') {
                inLineComment = false;
            }
        } else if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
        } else if (inString) {
            if (ch === stringChar && fullText[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (ch === '/' && next === '/') {
                inLineComment = true;
                i++;
            } else if (ch === '/' && next === '*') {
                inBlockComment = true;
                i++;
            } else if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
            }
        }
    }

    return inLineComment || inBlockComment || inString;
}

/**
 * Provides inline parameter name and variable type labels for BML.
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

            const enableParamHints = config.get('inlayHints.parameterNames.enabled', true);
            const suppressWhenArgumentMatchesName = config.get('inlayHints.suppressWhenArgumentMatchesName', true);
            const minParams = Math.max(1, config.get('inlayHints.minimumParameters', 1));
            const enableVarTypes = config.get('inlayHints.variableTypes.enabled', false);

            const extPath = context ? context.extensionPath : null;
            const bmlApiData = Object.assign(
                {},
                loadJson('bml-functions-api-usage', extPath),
                loadJson('bml-cpq-js-api-usage', extPath),
                loadJson('bml-util-attributes-api-usage', extPath)
            );
            const lowerApiData = {};
            for (const [k, v] of Object.entries(bmlApiData)) {
                lowerApiData[k.toLowerCase()] = v;
            }

            const hints = [];
            const text = document.getText(range);
            const startOffset = document.offsetAt(range.start);
            const fullText = document.getText();

            // 1. Parameter Name Inlay Hints
            if (enableParamHints) {
                const callRegex = /\b([a-zA-Z_][\w.]*)\s*\(/g;
                let match;

                while ((match = callRegex.exec(text)) !== null) {
                    const callStartOffset = startOffset + match.index;
                    if (isInsideCommentOrString(fullText, callStartOffset)) {
                        continue;
                    }

                    const funcName = match[1];
                    const funcLower = funcName.toLowerCase();

                    if (['if', 'elif', 'else', 'for', 'while', 'return'].includes(funcLower)) {
                        continue;
                    }

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

                    const firstArg = fullText.slice(argStarts[0], argEnds[0] !== undefined ? argEnds[0] : argStarts[0]).trim();
                    const effectiveArgCount = (argStarts.length === 1 && firstArg === '') ? 0 : argStarts.length;

                    if (effectiveArgCount < minParams) continue;

                    const paramNames = resolveParamNames(funcLower, effectiveArgCount, lowerApiData);
                    if (!paramNames || paramNames.length < minParams) continue;

                    argStarts.forEach((argOffset, idx) => {
                        if (idx < effectiveArgCount && idx < paramNames.length && paramNames[idx]) {
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
                                    `${paramName}:`,
                                    vscode.InlayHintKind.Parameter
                                );
                                hint.paddingRight = true;

                                const info = lowerApiData[funcLower] || lowerApiData[funcLower.replace(/^(?:util|commerce)\./, '')] || null;
                                const tooltip = new vscode.MarkdownString();
                                tooltip.appendMarkdown(`**Parameter \`${paramName}\`** *(Function \`${funcName}\`)*\n\n`);
                                if (info && info.notes) {
                                    tooltip.appendMarkdown(`${info.notes}\n\n`);
                                }
                                if (info && info.fullSignature) {
                                    tooltip.appendCodeblock(info.fullSignature, 'bml');
                                }
                                hint.tooltip = tooltip;

                                hints.push(hint);
                            }
                        }
                    });
                }
            }

            // 2. Inferred Variable Type Inlay Hints
            if (enableVarTypes) {
                const assignRegex = /^([ \t]*)([a-zA-Z_]\w*)\s*=\s*([^;\r\n]+);/gm;
                let assignMatch;

                while ((assignMatch = assignRegex.exec(text)) !== null) {
                    const varName = assignMatch[2];
                    const rhs = assignMatch[3];
                    const leadingWhitespace = assignMatch[1].length;
                    const varOffset = startOffset + assignMatch.index + leadingWhitespace + varName.length;

                    if (isInsideCommentOrString(fullText, startOffset + assignMatch.index)) {
                        continue;
                    }

                    const inferredType = inferVariableType(rhs, lowerApiData);
                    if (inferredType) {
                        const pos = document.positionAt(varOffset);
                        if (pos.line >= range.start.line && pos.line <= range.end.line) {
                            const hint = new vscode.InlayHint(
                                pos,
                                `: ${inferredType}`,
                                vscode.InlayHintKind.Type
                            );
                            hint.paddingLeft = true;
                            hint.tooltip = new vscode.MarkdownString(`Inferred Variable Type: **\`${inferredType}\`**`);
                            hints.push(hint);
                        }
                    }
                }
            }

            return hints;
        }
    });
}

module.exports = {
    registerInlayHintsProvider,
    extractParamName,
    extractParamNamesFromSignature,
    shouldSuppressHint,
    resolveParamNames,
    inferVariableType,
    isInsideCommentOrString,
    BML_CURATED_PARAMS
};
