const vscode = require('vscode');
const { splitArgumentsList } = require('@/lang/lint/rules/functionSignature');
const { isCpqLineItemArgs, isPipe, isTilde } = require('@/lang/lint/rules/performance');
const { analyzeCpqReturnAtLines } = require('@/lang/lint/rules/cpqReturnNormalizer');

function extractSbappendCall(text) {
    const regex = /\bsbappend\s*\(/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const openParenIdx = match.index + match[0].length - 1;
        let depth = 1;
        let inSingle = false;
        let inDouble = false;
        let closeParenIdx = -1;

        for (let i = openParenIdx + 1; i < text.length; i++) {
            const ch = text[i];
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === "'" && !inDouble) {
                inSingle = !inSingle;
            } else if (ch === '"' && !inSingle) {
                inDouble = !inDouble;
            } else if (!inSingle && !inDouble) {
                if (ch === '(') depth++;
                else if (ch === ')') {
                    depth--;
                    if (depth === 0) {
                        closeParenIdx = i;
                        break;
                    }
                }
            }
        }

        if (closeParenIdx !== -1) {
            let fullEndIdx = closeParenIdx + 1;
            while (fullEndIdx < text.length && (text[fullEndIdx] === ' ' || text[fullEndIdx] === '\t')) {
                fullEndIdx++;
            }
            if (fullEndIdx < text.length && text[fullEndIdx] === ';') {
                fullEndIdx++;
            }
            return {
                start: match.index,
                end: fullEndIdx,
                argsText: text.substring(openParenIdx + 1, closeParenIdx),
                fullMatch: text.substring(match.index, fullEndIdx)
            };
        }
    }
    return null;
}

function checkCpqPairAtLines(document, lineIdxA, lineIdxB) {
    if (lineIdxA < 0 || lineIdxB >= document.lineCount) return null;
    const lineA = document.lineAt(lineIdxA).text;
    const lineB = document.lineAt(lineIdxB).text;

    const callA = extractSbappendCall(lineA);
    const callB = extractSbappendCall(lineB);
    if (!callA || !callB) return null;

    const argsA = splitArgumentsList(callA.argsText);
    const argsB = splitArgumentsList(callB.argsText);

    const sbA = argsA[0] ? argsA[0].trim() : '';
    const sbB = argsB[0] ? argsB[0].trim() : '';
    if (!sbA || sbA !== sbB) return null;

    // Pattern 1:
    // lineA: sbappend(sb, serviceDocNum, "~extendedNetPrice_l~");
    // lineB: sbappend(sb, string(SVC_FINAL_PRICE_DEFAULT), "|"); OR without pipe: sbappend(sb, string(SVC_FINAL_PRICE_DEFAULT));
    if (argsA.length === 3 && (argsB.length === 2 || argsB.length === 3)) {
        const docNum = argsA[1].trim();
        const varArg = argsA[2].trim();
        const valArg = argsB[1].trim();
        const pipeArg = (argsB.length === 3 && isPipe(argsB[2]))
            ? argsB[2].trim()
            : '"|"';

        // Ensure docNum is not accidentally a delimiter pipe from previous statement
        if (varArg.includes('~') && !isPipe(docNum)) {
            const indentMatch = lineA.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            const combined = `${indent}sbappend(${sbA}, ${docNum}, ${varArg}, ${valArg}, ${pipeArg});`;
            const rangeA = document.lineAt(lineIdxA).range;
            const rangeB = document.lineAt(lineIdxB).range;
            const fullRange = new vscode.Range(rangeA.start, rangeB.end);

            return {
                combined,
                range: fullRange,
                sb: sbA,
                docNum,
                varArg,
                valArg,
                pipeArg
            };
        }
    }

    // Pattern 2:
    // lineA: sbappend(sb, "1~extendedNetPrice_l~");
    // lineB: sbappend(sb, string(SVC_FINAL_PRICE_DEFAULT), "|"); OR without pipe
    if (argsA.length === 2 && (argsB.length === 2 || argsB.length === 3)) {
        const varArg = argsA[1].trim();
        const valArg = argsB[1].trim();
        const pipeArg = (argsB.length === 3 && isPipe(argsB[2]))
            ? argsB[2].trim()
            : '"|"';

        if (varArg.includes('~') && !isPipe(varArg)) {
            const indentMatch = lineA.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            const combined = `${indent}sbappend(${sbA}, ${varArg}, ${valArg}, ${pipeArg});`;
            const rangeA = document.lineAt(lineIdxA).range;
            const rangeB = document.lineAt(lineIdxB).range;
            const fullRange = new vscode.Range(rangeA.start, rangeB.end);

            return {
                combined,
                range: fullRange,
                sb: sbA,
                varArg,
                valArg,
                pipeArg
            };
        }
    }

    return null;
}

function buildCpqLineItemSingleFixes(document, lineIndex) {
    const fixes = [];
    if (lineIndex < 0 || lineIndex >= document.lineCount) return fixes;
    const line = document.lineAt(lineIndex);
    const call = extractSbappendCall(line.text);
    if (!call) return fixes;
    const args = splitArgumentsList(call.argsText);
    const indentMatch = line.text.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    let replacement = null;
    let label = null;

    // Pattern 1: sbappend(sb, docNum, "~var~", val) -> missing pipe
    if (args.length === 4 && args[2].trim().includes('~') && !isPipe(args[1]) && !isPipe(args[3])) {
        const sb = args[0].trim();
        const docNum = args[1].trim();
        const varArg = args[2].trim();
        const valArg = args[3].trim();
        replacement = `${indent}sbappend(${sb}, ${docNum}, ${varArg}, ${valArg}, "|");`;
        label = `Add CPQ delimiter pipe: 'sbappend(${sb}, ${docNum}, ${varArg}, ${valArg}, "|");'`;
    }
    // Pattern 2: sbappend(sb, "1~var~", val) -> missing pipe
    else if (args.length === 3 && args[1].trim().includes('~') && !isPipe(args[1]) && !isPipe(args[2])) {
        const sb = args[0].trim();
        const attrArg = args[1].trim();
        const valArg = args[2].trim();
        replacement = `${indent}sbappend(${sb}, ${attrArg}, ${valArg}, "|");`;
        label = `Add CPQ delimiter pipe: 'sbappend(${sb}, ${attrArg}, ${valArg}, "|");'`;
    }
    // Pattern 3 (dynamic): sbappend(sb, "1~", dynamicVar, "~", val) -> missing pipe
    else if (args.length === 5 && args[1].includes('~') && isTilde(args[3]) && !isPipe(args[4])) {
        const sb = args[0].trim();
        const prefix = args[1].trim();
        const dynamicVar = args[2].trim();
        const tilde = args[3].trim();
        const valArg = args[4].trim();
        replacement = `${indent}sbappend(${sb}, ${prefix}, ${dynamicVar}, ${tilde}, ${valArg}, "|");`;
        label = `Add CPQ delimiter pipe: 'sbappend(${sb}, ${prefix}, ${dynamicVar}, ${tilde}, ${valArg}, "|");'`;
    }

    if (replacement && label) {
        let targetRange = line.range;
        if (line.text !== call.fullMatch) {
            const startPos = new vscode.Position(lineIndex, call.start);
            const endPos = new vscode.Position(lineIndex, call.end);
            targetRange = new vscode.Range(startPos, endPos);
        }

        const action = new vscode.CodeAction(label, vscode.CodeActionKind.QuickFix);
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, targetRange, replacement);
        fixes.push(action);
    }

    return fixes;
}

function buildCpqLineItemCombineFixes(document, lineIndex, diag) {
    const fixes = [];
    let pair = checkCpqPairAtLines(document, lineIndex, lineIndex + 1);
    if (!pair && lineIndex > 0) {
        pair = checkCpqPairAtLines(document, lineIndex - 1, lineIndex);
    }
    if (pair) {
        const title = pair.docNum
            ? `Combine into CPQ line item format: 'sbappend(${pair.sb}, ${pair.docNum}, ${pair.varArg}, ${pair.valArg}, ${pair.pipeArg});'`
            : `Combine into CPQ line item format: 'sbappend(${pair.sb}, ${pair.varArg}, ${pair.valArg}, ${pair.pipeArg});'`;
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, pair.range, pair.combined);
        if (diag) action.diagnostics = [diag];
        fixes.push(action);
    }
    return fixes;
}

function buildSbappendSplitFixes(document, range, diag) {
    const fixes = [];
    const text = document.getText(range);
    const call = extractSbappendCall(text);
    if (!call) return fixes;

    const args = splitArgumentsList(call.argsText);
    if (args.length <= 3) return fixes;

    // Do not split canonical CPQ line item format: sbappend(sb, docNum, "~var~", val, "|");
    if (isCpqLineItemArgs(args)) return fixes;

    const sbVar = args[0].trim();
    const items = args.slice(1);

    const lineIndex = range.start.line;
    const lineText = document.lineAt(lineIndex).text;
    const indentMatch = lineText.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    const hasCpqPattern = items.some(it => it.includes('~'));
    const chunkSize = hasCpqPattern && items.length >= 4 ? 4 : 2;

    const pairedStatements = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        pairedStatements.push(`sbappend(${sbVar}, ${chunk.map(c => c.trim()).join(', ')});`);
    }
    if (pairedStatements.length <= 1) return fixes;
    const pairedReplacement = pairedStatements.join('\n' + indent);

    // Precise range replacement
    let targetRange = range;
    if (text !== call.fullMatch) {
        const startPos = new vscode.Position(lineIndex, range.start.character + call.start);
        const endPos = new vscode.Position(lineIndex, range.start.character + call.end);
        targetRange = new vscode.Range(startPos, endPos);
    }

    const pairedAction = new vscode.CodeAction(
        chunkSize === 4 ? "Split into CPQ line item 'sbappend' statements" : "Split 'sbappend' into paired statements",
        vscode.CodeActionKind.QuickFix
    );
    pairedAction.isPreferred = true;
    pairedAction.edit = new vscode.WorkspaceEdit();
    pairedAction.edit.replace(document.uri, targetRange, pairedReplacement);
    if (diag) pairedAction.diagnostics = [diag];
    fixes.push(pairedAction);

    return fixes;
}

function createSbappendSplitActions(document, range) {
    const actions = [];
    if (!range || !document) return actions;
    const lineIndex = range.start.line;
    const line = document.lineAt(lineIndex);
    const lineText = line.text;
    if (!lineText.includes('sbappend')) return actions;

    // Intelligent CPQ return normalization
    const normalizerResult = analyzeCpqReturnAtLines(document, lineIndex);
    if (normalizerResult) {
        const title = `Convert to canonical CPQ return format: '${normalizerResult.replacement.trim()}'`;
        const normAction = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        normAction.isPreferred = true;
        normAction.edit = new vscode.WorkspaceEdit();
        normAction.edit.replace(document.uri, normalizerResult.range, normalizerResult.replacement);
        actions.push(normAction);
    }

    // Check CPQ line item combination across adjacent lines
    const combineFixes = buildCpqLineItemCombineFixes(document, lineIndex);
    actions.push(...combineFixes);

    // Check single-line CPQ line item missing delimiter pipe
    const singleFixes = buildCpqLineItemSingleFixes(document, lineIndex);
    actions.push(...singleFixes);

    const call = extractSbappendCall(lineText);
    if (!call) return actions;

    const matchRange = new vscode.Range(lineIndex, call.start, lineIndex, call.end);
    const hasIntersection = (typeof range.intersection === 'function')
        ? (range.intersection(matchRange) || (range.isEmpty && range.start.character >= call.start && range.start.character <= call.end))
        : (range.start && range.end && !(range.end.character < call.start || range.start.character > call.end));
    if (hasIntersection) {
        actions.push(...buildSbappendSplitFixes(document, matchRange));
    }
    return actions;
}

function getPerformanceFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-string-concat-in-loop') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Convert to StringBuilder ('sbappend(sb, ...)')", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        
        // e.g. str = str + val or str += val
        const m = text.match(/([a-zA-Z_]\w*)\s*=\s*\1\s*\+\s*(.+)/);
        if (m) {
            const varName = m[1];
            const addedExpr = m[2].trim();
            const replacement = `sbappend(${varName}_sb, ${addedExpr});`;
            action.edit.replace(document.uri, editRange, replacement);

            const fullDocText = document.getText();
            if (!fullDocText.includes(`${varName}_sb`)) {
                const lineIndex = editRange.start.line;
                const lineText = document.lineAt(lineIndex).text;
                const indentMatch = lineText.match(/^\s*/);
                const indent = indentMatch ? indentMatch[0] : '';
                action.edit.insert(document.uri, new vscode.Position(lineIndex, 0), `${indent}${varName}_sb = stringbuilder();\n`);
            }

            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-bmql-in-loop') {
        const action = new vscode.CodeAction("Add comment marker to batch query outside loop", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indent = lineText.match(/^\s*/)[0];
        const lineStartPos = new vscode.Position(lineIndex, 0);
        action.edit.insert(document.uri, lineStartPos, `${indent}// OPTIMIZATION: batch BMQL query outside of loop to prevent N+1 queries\n`);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-production-print-statement') {
        // Fix 1: Comment out print statement
        const lineIndex = editRange.start.line;
        const line = document.lineAt(lineIndex);
        const lineText = line.text;
        
        const commentAction = new vscode.CodeAction("Comment out print statement before go-live", vscode.CodeActionKind.QuickFix);
        commentAction.edit = new vscode.WorkspaceEdit();
        const indentMatch = lineText.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const nonIndent = lineText.slice(indent.length);
        commentAction.edit.replace(document.uri, line.range, `${indent}// ${nonIndent}`);
        commentAction.diagnostics = [diag];
        fixes.push(commentAction);

        // Fix 2: Remove line entirely
        const removeAction = new vscode.CodeAction("Remove print statement", vscode.CodeActionKind.QuickFix);
        removeAction.edit = new vscode.WorkspaceEdit();
        const deleteRange = line.rangeIncludingLineBreak;
        removeAction.edit.delete(document.uri, deleteRange);
        removeAction.diagnostics = [diag];
        fixes.push(removeAction);
    }
    else if (diag.code === 'bml-hardcoded-sitename') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Replace hardcoded domain with '_system_site_name'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        // Replace "https://mysite.bigmachines.com/..." with "\"https://\" + _system_site_name + \".bigmachines.com/...\"" or _system_site_name
        const replaced = text.replace(/([a-zA-Z0-9_-]+)(?:\.bigmachines\.com|\.oraclecloud\.com|\.cpq\.oracle\.com)/g, '" + _system_site_name + "');
        // Clean up empty string joins e.g. "" + _system_site_name + ""
        const cleaned = replaced.replace(/^""\s*\+\s*/, '').replace(/\s*\+\s*""$/, '');
        action.edit.replace(document.uri, editRange, cleaned);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-sbappend-cpq-split') {
        const lineIndex = editRange.start.line;
        const normalizerResult = analyzeCpqReturnAtLines(document, lineIndex);
        if (normalizerResult) {
            const title = `Convert to canonical CPQ return format: '${normalizerResult.replacement.trim()}'`;
            const normAction = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
            normAction.isPreferred = true;
            normAction.edit = new vscode.WorkspaceEdit();
            normAction.edit.replace(document.uri, normalizerResult.range, normalizerResult.replacement);
            normAction.diagnostics = [diag];
            fixes.push(normAction);
        }
        fixes.push(...buildCpqLineItemCombineFixes(document, lineIndex, diag));
    }
    else if (diag.code === 'bml-sbappend-multiple-args') {
        const lineIndex = editRange.start.line;
        const normalizerResult = analyzeCpqReturnAtLines(document, lineIndex);
        if (normalizerResult) {
            const title = `Convert to canonical CPQ return format: '${normalizerResult.replacement.trim()}'`;
            const normAction = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
            normAction.isPreferred = true;
            normAction.edit = new vscode.WorkspaceEdit();
            normAction.edit.replace(document.uri, normalizerResult.range, normalizerResult.replacement);
            normAction.diagnostics = [diag];
            fixes.push(normAction);
        }
        fixes.push(...buildSbappendSplitFixes(document, editRange, diag));
    }

    return fixes;
}

module.exports = {
    getPerformanceFixes,
    createSbappendSplitActions,
    buildSbappendSplitFixes,
    extractSbappendCall
};

