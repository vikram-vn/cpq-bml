function toCamelCase(name) {
    if (!name) return name;
    const parts = name.split('_').filter(p => p.length > 0);
    if (parts.length === 0) return name;
    let result = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        result += part.charAt(0).toUpperCase() + part.slice(1);
    }
    return result;
}

function formatBooleanName(name) {
    const camel = toCamelCase(name);
    if (/^(is|has)[A-Z]/.test(camel)) {
        return camel;
    }
    return 'is' + camel.charAt(0).toUpperCase() + camel.slice(1);
}

function withPreservedStrings(text, transformFn) {
    const stringLiterals = [];
    const noStrings = text.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
        const id = stringLiterals.length;
        stringLiterals.push(match);
        return `__BML_STR_${id}__`;
    });

    let transformed = transformFn(noStrings);

    transformed = transformed.replace(/__BML_STR_(\d+)__/g, (_, id) => {
        return stringLiterals[Number(id)];
    });

    return transformed;
}

function commentOutEmptyConditionalChains(text, eol) {
    const lines = text.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^\s*if\s*\(/.test(line) && !trimmed.startsWith('//')) {
            const chainStartLine = i;
            let chainEndLine = -1;
            let currentLine = i;
            let braceDepth = 0;
            let hasActiveStatements = false;
            let inHeader = true;

            while (currentLine < lines.length) {
                const cLine = lines[currentLine];
                const cTrimmed = cLine.trim();

                const openCount = (cTrimmed.match(/\{/g) || []).length;
                const closeCount = (cTrimmed.match(/\}/g) || []).length;

                if (inHeader) {
                    if (cTrimmed.includes('{')) {
                        inHeader = false;
                        braceDepth += openCount - closeCount;
                    }
                } else {
                    const codePart = cTrimmed.startsWith('//') ? '' : cTrimmed.split('//')[0].trim();
                    const pureCode = codePart
                        .replace(/}\s*elif\s*\([^)]*\)\s*\{/g, '')
                        .replace(/}\s*else\s*\{/g, '')
                        .replace(/[{}\s]/g, '');

                    if (pureCode.length > 0) {
                        hasActiveStatements = true;
                    }

                    braceDepth += openCount - closeCount;
                }

                if (braceDepth <= 0 && !inHeader) {
                    let nextIdx = currentLine + 1;
                    let continuesChain = false;

                    if (/\}\s*(elif|else)\b/.test(cTrimmed)) {
                        continuesChain = true;
                        inHeader = true;
                    } else {
                        while (nextIdx < lines.length) {
                            const nTrimmed = lines[nextIdx].trim();
                            if (nTrimmed.length === 0 || nTrimmed.startsWith('//')) {
                                nextIdx++;
                                continue;
                            }
                            if (/^(elif|else)\b/.test(nTrimmed)) {
                                continuesChain = true;
                            }
                            break;
                        }
                    }

                    if (!continuesChain) {
                        chainEndLine = currentLine;
                        break;
                    }
                }

                currentLine++;
            }

            if (chainEndLine !== -1 && !hasActiveStatements) {
                for (let k = chainStartLine; k <= chainEndLine; k++) {
                    const kTrimmed = lines[k].trim();
                    if (!kTrimmed.startsWith('//')) {
                        const indentMatch = lines[k].match(/^\s*/);
                        const indent = indentMatch ? indentMatch[0] : '';
                        lines[k] = `${indent}// ${kTrimmed}`;
                    }
                }
                i = chainEndLine + 1;
                continue;
            }
        }
        i++;
    }

    return lines.join(eol);
}

function commentOutEmptyLoops(text, eol) {
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (/^(?:\/\/|\s*)*(for\s+[a-zA-Z_]\w*\s+in\s+|while\s*\(|for\s*\()/.test(trimmed)) {
            let openBraceLine = -1;
            let closeBraceLine = -1;
            let braceDepth = 0;
            let hasActiveStatements = false;

            for (let j = i; j < lines.length; j++) {
                const jLine = lines[j];
                const jTrimmed = jLine.trim();

                if (openBraceLine === -1) {
                    if (jTrimmed.includes('{')) {
                        openBraceLine = j;
                        braceDepth += (jTrimmed.match(/\{/g) || []).length - (jTrimmed.match(/\}/g) || []).length;
                        if (braceDepth === 0) {
                            closeBraceLine = j;
                            break;
                        }
                    }
                } else {
                    const codePart = jTrimmed.startsWith('//') ? '' : jTrimmed.split('//')[0].trim();
                    const nonBraceCode = codePart.replace(/[{}\s]/g, '');
                    if (nonBraceCode.length > 0) {
                        hasActiveStatements = true;
                    }

                    braceDepth += (jTrimmed.match(/\{/g) || []).length - (jTrimmed.match(/\}/g) || []).length;
                    if (braceDepth <= 0) {
                        closeBraceLine = j;
                        break;
                    }
                }
            }

            if (openBraceLine !== -1 && closeBraceLine !== -1 && !hasActiveStatements) {
                for (let k = i; k <= closeBraceLine; k++) {
                    if (!lines[k].trim().startsWith('//')) {
                        const indentMatch = lines[k].match(/^\s*/);
                        const indent = indentMatch ? indentMatch[0] : '';
                        lines[k] = `${indent}// ${lines[k].trim()}`;
                    }
                }
                i = closeBraceLine;
            }
        }
    }

    return lines.join(eol);
}

function computeTransitiveUnusedVariables(noStringsText, declaredVars, document, cleanText, initialUnusedNames) {
    const unusedVarNames = new Set(initialUnusedNames);

    try {
        const { checkVariableDiagnostics } = require('../rules/variables');
        const fullUnusedDiags = checkVariableDiagnostics(noStringsText, declaredVars, document, cleanText);
        for (const diag of fullUnusedDiags) {
            const name = document.getText(diag.range).trim();
            if (name) unusedVarNames.add(name);
        }
    } catch (e) {
    }

    const lines = noStringsText.split(/\r?\n/);
    const lineOffsets = new Int32Array(lines.length);
    let currOffset = 0;
    for (let l = 0; l < lines.length; l++) {
        lineOffsets[l] = currOffset;
        currOffset += lines[l].length + 1;
    }

    function getLineForOffset(offset) {
        let low = 0, high = lines.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            if (lineOffsets[mid] <= offset) low = mid + 1;
            else high = mid - 1;
        }
        return lines[Math.max(0, high)] || '';
    }

    let addedNew = true;
    let iteration = 0;
    while (addedNew && iteration < 3) {
        addedNew = false;
        iteration++;

        const activeUnusedNames = new Set();
        for (const name of unusedVarNames) {
            activeUnusedNames.add(name);
            activeUnusedNames.add(toCamelCase(name));
        }

        for (const [varName, decls] of declaredVars.entries()) {
            if (unusedVarNames.has(varName)) continue;
            if (/^_/.test(varName)) continue;

            const occurrences = [];
            const regex = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
            let m;
            while ((m = regex.exec(noStringsText)) !== null) {
                occurrences.push(m.index);
            }

            const declIndices = new Set(decls.map(d => d.index));
            const usageIndices = occurrences.filter(idx => !declIndices.has(idx));

            if (usageIndices.length > 0) {
                let allUsagesInUnusedContext = true;

                for (const uIdx of usageIndices) {
                    const targetLine = getLineForOffset(uIdx);
                    const trimmed = targetLine.trim();
                    const assignMatch = trimmed.match(/(?:(?:string|integer|float|boolean|dict|json|jsonarray|date|recordset)\s+)?([a-zA-Z_]\w*)\s*=(?!=)/i);
                    const containerMatch = trimmed.match(/\b(put|append|insert|remove|clear|setattributevalue|getboolean|getint|getfloat|getstring|getmessage|haserror)\s*\(\s*([a-zA-Z_]\w*)/i);

                    let isUnusedContext = false;
                    if (assignMatch && activeUnusedNames.has(assignMatch[1])) {
                        isUnusedContext = true;
                    } else if (containerMatch && (containerMatch[2] === varName || activeUnusedNames.has(containerMatch[2]))) {
                        isUnusedContext = true;
                    }

                    if (!isUnusedContext) {
                        allUsagesInUnusedContext = false;
                        break;
                    }
                }

                if (allUsagesInUnusedContext) {
                    unusedVarNames.add(varName);
                    addedNew = true;
                }
            }
        }
    }

    return unusedVarNames;
}

function commentOutUnusedAssignments(text, unusedVarNames, renameMap, eol) {
    if (!unusedVarNames || unusedVarNames.size === 0) return text;

    const expandedUnusedNames = new Set();
    for (const name of unusedVarNames) {
        expandedUnusedNames.add(name);
        expandedUnusedNames.add(toCamelCase(name));
        if (renameMap && renameMap.has(name)) {
            expandedUnusedNames.add(renameMap.get(name));
        }
    }

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;

        let isUnusedAssignment = false;
        const assignMatch = trimmed.match(/(?:(?:string|integer|float|boolean|dict|json|jsonarray|date|recordset)\s+)?([a-zA-Z_]\w*)\s*=(?!=)/i);
        if (assignMatch) {
            const varName = assignMatch[1];
            if (expandedUnusedNames.has(varName)) {
                isUnusedAssignment = true;
            }
        }

        if (!isUnusedAssignment) {
            const loopMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\b/i);
            if (loopMatch) {
                const loopVar = loopMatch[1];
                if (expandedUnusedNames.has(loopVar)) {
                    isUnusedAssignment = true;
                }
            }
        }

        if (!isUnusedAssignment) {
            const containerMatch = trimmed.match(/\b(put|append|insert|remove|clear|setattributevalue|getboolean|getint|getfloat|getstring|getmessage|haserror)\s*\(\s*([a-zA-Z_]\w*)/i);
            if (containerMatch) {
                const targetVar = containerMatch[2];
                if (expandedUnusedNames.has(targetVar)) {
                    isUnusedAssignment = true;
                }
            }
        }

        if (isUnusedAssignment) {
            const indentMatch = line.match(/^\s*/);
            const indent = indentMatch ? indentMatch[0] : '';
            lines[i] = `${indent}// ${trimmed}`;
        }
    }
    return lines.join(eol);
}

module.exports = {
    toCamelCase,
    formatBooleanName,
    withPreservedStrings,
    commentOutEmptyConditionalChains,
    commentOutEmptyLoops,
    computeTransitiveUnusedVariables,
    commentOutUnusedAssignments
};
