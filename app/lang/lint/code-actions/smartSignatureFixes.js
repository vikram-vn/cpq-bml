const vscode = require('vscode');
const { splitArgumentsList } = require('@/lang/lint/rules/functionSignature');
const {
    getBmlFunctions,
    getWorkspaceFunctionInfo,
    inferLhsExpectedType,
    synthesizeSmartParameterValues,
    synthesizeCanonicalCallCompletions,
    extractSemanticOptions,
    extractEnumOptionsFromDoc
} = require('@/lang/lint/code-actions/smartSignatureSynthesis');

/**
 * Knowledge-Driven Smart Signature Quick Fixes:
 * - Dynamically loads parameter schemas and documentation from bml-functions-api-usage.json
 * - Parses enumerated options and defaults directly from parameter descriptions and docs
 * - Connects parameters to modular intellisense knowledge domains (delimiters, http methods, timezones, etc.)
 * - In-scope document variable discovery (headers, errorDict, payload, etc.)
 * - Synthesizes canonical multi-parameter calls from syntax and custom-snippets.json
 * - LHS-aware and context-driven value type ranking
 * - Dynamic excess argument removal and safe script-level batch fixing
 * - Expression-preserving type conversion for bml-function-arg-type
 */

function getSmartSignatureFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag) return fixes;

    function addFix(title, range, replacement, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, range, replacement);
        action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    // 1. Argument Count Mismatches (bml-function-arg-count)
    if (diag.code === 'bml-function-arg-count') {
        const lineText = document.lineAt(editRange.start.line).text;
        const openParen = lineText.indexOf('(', editRange.start.character);
        if (openParen === -1) return fixes;

        let depth = 0;
        let closeParen = -1;
        for (let i = openParen; i < lineText.length; i++) {
            if (lineText[i] === '(') depth++;
            else if (lineText[i] === ')') {
                depth--;
                if (depth === 0) { closeParen = i; break; }
            }
        }
        if (closeParen === -1) return fixes;

        const argsContent = lineText.substring(openParen + 1, closeParen).trim();
        const args = splitArgumentsList(argsContent);
        const funcNameMatch = lineText.substring(0, openParen).match(/((?:[a-zA-Z_]\w*\.)*[a-zA-Z_]\w*)\s*$/);
        const fullFuncName = funcNameMatch ? funcNameMatch[1] : '';
        const funcNameLower = fullFuncName.toLowerCase();
        const parts = funcNameLower.split('.');
        const baseNameLower = parts[parts.length - 1];

        // Check LHS variable type inference
        const inferredLhsType = inferLhsExpectedType(document, editRange.start.line, editRange.start.character);

        // Load knowledge for this function dynamically
        const bmlFunctions = getBmlFunctions();
        const funcMeta = bmlFunctions[funcNameLower] ||
            bmlFunctions[baseNameLower] ||
            getWorkspaceFunctionInfo(funcNameLower);

        let formalParams = funcMeta ? (funcMeta.parameters || funcMeta.params || []) : [];

        // Dynamic Overload Resolution: if message or fullSignature contains additional parameters
        if (funcMeta && funcMeta.fullSignature && funcMeta.fullSignature.includes('(or)')) {
            const overloads = funcMeta.fullSignature.split(/\s*\(or\)\s*/i);
            for (const ov of overloads) {
                const ovInner = ov.replace(/^[^(]*\(/, '').replace(/\)[^)]*$/, '');
                const ovParts = splitArgumentsList(ovInner);
                if (ovParts.length > formalParams.length) {
                    const lastPart = ovParts[ovParts.length - 1].trim();
                    const words = lastPart.split(/\s+/);
                    formalParams = [...formalParams, { name: words[1] || 'valueType', type: words[0] || 'String' }];
                }
            }
        }
        if (diag.message && /valueType|anytype/i.test(diag.message) && !formalParams.some(p => /valueType/i.test(p.name))) {
            formalParams = [...formalParams, { name: 'valueType', type: 'String' }];
        }

        // Dynamic Excess Argument Removal
        const maxMatch = diag.message && diag.message.match(/expects\s+(?:at most\s+)?(\d+)\s+argument/i);
        if (maxMatch) {
            const maxExpected = parseInt(maxMatch[1], 10);
            if (args.length > maxExpected && maxExpected >= 0) {
                const keptArgs = args.slice(0, maxExpected).join(', ');
                const rangeToReplace = new vscode.Range(editRange.start.line, openParen + 1, editRange.start.line, closeParen);
                addFix(`Remove excess argument(s)`, rangeToReplace, keptArgs, true);
                return fixes;
            }
        }

        // Check missing parameters to synthesize
        const currentArgCount = argsContent ? args.length : 0;
        if (formalParams.length > currentArgCount) {
            const missingParam = formalParams[currentArgCount];
            if (missingParam) {
                const candidates = synthesizeSmartParameterValues(
                    missingParam,
                    currentArgCount,
                    args,
                    inferredLhsType,
                    document,
                    baseNameLower,
                    funcMeta
                );
                const rangeToReplace = new vscode.Range(editRange.start.line, openParen + 1, editRange.start.line, closeParen);

                candidates.forEach(c => {
                    const separator = currentArgCount > 0 ? ', ' : '';
                    const newText = `${argsContent}${separator}${c.text}`;
                    const label = c.title || `Supply '${c.text}' for ${missingParam.name}`;
                    addFix(label, rangeToReplace, newText, c.preferred);
                });
            }
        }

        // Canonical multi-parameter completions from knowledge
        const canonicalCompletions = synthesizeCanonicalCallCompletions(funcMeta, args, document);
        if (canonicalCompletions.length > 0) {
            const rangeToReplace = new vscode.Range(editRange.start.line, openParen + 1, editRange.start.line, closeParen);
            const hasPreferred = fixes.some(f => f.isPreferred);
            canonicalCompletions.forEach(c => {
                const isPref = !hasPreferred && c.preferred;
                addFix(c.title, rangeToReplace, c.text, isPref);
            });
        }

        // Fallback for missing parameters without formal metadata
        if (formalParams.length === 0 && canonicalCompletions.length === 0) {
            const types = ['string', 'integer', 'float', 'boolean', 'json'];
            const preferred = inferredLhsType && types.includes(inferredLhsType) ? inferredLhsType : 'string';
            const rangeToReplace = new vscode.Range(editRange.start.line, openParen + 1, editRange.start.line, closeParen);
            const separator = currentArgCount > 0 ? ', ' : '';

            types.forEach(t => {
                addFix(`Add "${t}" parameter`, rangeToReplace, `${argsContent}${separator}"${t}"`, t === preferred);
            });
        }
    }

    // 2. Argument Type Mismatch (bml-function-arg-type)
    if (diag.code === 'bml-function-arg-type') {
        const msg = diag.message;
        const match = msg.match(/Argument\s+(\d+)\s+to\s+['"]([^'"]+)['"]\s+should be\s+([^,]+),\s+but got a\s+([^ ]+)\s+value/i);
        if (!match) return fixes;

        const argIndex = parseInt(match[1], 10) - 1;
        const expectedTypeRaw = match[3].trim();
        const actualType = match[4].trim();

        const lineText = document.lineAt(editRange.start.line).text;
        const callStartChar = editRange.start.character;
        let openParenIdx = lineText.indexOf('(', callStartChar);
        if (openParenIdx === -1) {
            openParenIdx = lineText.lastIndexOf('(', callStartChar);
        } else if (openParenIdx > callStartChar) {
            const beforeParen = lineText.lastIndexOf('(', callStartChar);
            if (beforeParen !== -1) {
                // If callStartChar is followed by an identifier rather than '(', prefer the enclosing paren
                const between = lineText.substring(beforeParen + 1, callStartChar).trim();
                if (!between.includes(')')) {
                    openParenIdx = beforeParen;
                }
            }
        }
        if (openParenIdx === -1) return fixes;

        let depth = 0;
        let closeParenIdx = -1;
        for (let i = openParenIdx; i < lineText.length; i++) {
            if (lineText[i] === '(') depth++;
            else if (lineText[i] === ')') {
                depth--;
                if (depth === 0) { closeParenIdx = i; break; }
            }
        }
        if (closeParenIdx === -1) return fixes;

        const argsText = lineText.substring(openParenIdx + 1, closeParenIdx);
        const args = splitArgumentsList(argsText);
        if (argIndex < 0 || argIndex >= args.length) return fixes;

        const targetArg = args[argIndex].trim();
        if (!targetArg) return fixes;

        let searchStart = 0;
        for (let i = 0; i < argIndex; i++) {
            const partIdx = argsText.indexOf(args[i], searchStart);
            if (partIdx !== -1) searchStart = partIdx + args[i].length;
        }
        const argOffset = argsText.indexOf(targetArg, searchStart);
        if (argOffset === -1) return fixes;

        const argStartChar = openParenIdx + 1 + argOffset;
        const argEndChar = argStartChar + targetArg.length;
        const argRange = new vscode.Range(editRange.start.line, argStartChar, editRange.start.line, argEndChar);

        const expLower = expectedTypeRaw.toLowerCase();
        const actLower = actualType.toLowerCase();

        const needsParens = /[+\-*/%<>=!&|]/.test(targetArg) && !targetArg.startsWith('(');
        const wrappedTarget = needsParens ? `(${targetArg})` : targetArg;

        // String expected
        if (expLower.includes('string') && !expLower.includes('[]')) {
            if (actLower.includes('date')) {
                addFix(`Format Date to String using 'datetostr(${targetArg}, "yyyy-MM-dd")'`, argRange, `datetostr(${targetArg}, "yyyy-MM-dd")`, true);
            } else if (actLower.includes('stringbuilder')) {
                addFix(`Convert with 'sbtostring(${targetArg})'`, argRange, `sbtostring(${targetArg})`, true);
            } else if (actLower.includes('jsonarray')) {
                addFix(`Convert with 'jsonarraytostr(${targetArg})'`, argRange, `jsonarraytostr(${targetArg})`, true);
            } else if (actLower.includes('json')) {
                addFix(`Convert with 'jsontostr(${targetArg})'`, argRange, `jsontostr(${targetArg})`, true);
            } else if (actLower.includes('array') || actLower.endsWith('[]')) {
                addFix(`Join array with 'join(${targetArg}, ",")'`, argRange, `join(${targetArg}, ",")`, true);
            } else {
                addFix(`Convert to String using 'string(${wrappedTarget})'`, argRange, `string(${wrappedTarget})`, true);
            }
        }
        // Integer expected
        else if (expLower.includes('integer') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse Integer using 'atoi(${targetArg})'`, argRange, `atoi(${targetArg})`, true);
            } else if (actLower.includes('float')) {
                addFix(`Round to Integer using 'round(${wrappedTarget}, 0)'`, argRange, `round(${wrappedTarget}, 0)`, true);
                addFix(`Cast to Integer using 'integer(${wrappedTarget})'`, argRange, `integer(${wrappedTarget})`);
            } else {
                addFix(`Convert to Integer using 'integer(${wrappedTarget})'`, argRange, `integer(${wrappedTarget})`, true);
            }
        }
        // Float expected
        else if (expLower.includes('float') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse Float using 'atof(${targetArg})'`, argRange, `atof(${targetArg})`, true);
            } else {
                addFix(`Convert to Float using 'float(${wrappedTarget})'`, argRange, `float(${wrappedTarget})`, true);
            }
        }
        // Date expected
        else if (expLower.includes('date') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse Date using 'strtojavadate(${targetArg}, "yyyy-MM-dd")'`, argRange, `strtojavadate(${targetArg}, "yyyy-MM-dd")`, true);
            }
        }
        // Json expected
        else if (expLower.includes('json') && !expLower.includes('array') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse JSON object using 'json(${targetArg})'`, argRange, `json(${targetArg})`, true);
            }
        }
        // JsonArray expected
        else if (expLower.includes('jsonarray') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse JSON Array using 'jsonarray(${targetArg})'`, argRange, `jsonarray(${targetArg})`, true);
            }
        }
        // Boolean expected
        else if (expLower.includes('boolean') && !expLower.includes('[]')) {
            addFix(`Convert to Boolean using 'boolean(${wrappedTarget})'`, argRange, `boolean(${wrappedTarget})`, true);
        }
        // Array expected (e.g. String[])
        else if (expLower.includes('string[]')) {
            if (actLower.includes('string')) {
                addFix(`Split String into Array: 'split(${targetArg}, ",")'`, argRange, `split(${targetArg}, ",")`, true);
                addFix(`Wrap in String[] literal: 'String[]{ ${targetArg} }'`, argRange, `String[]{ ${targetArg} }`);
            }
        }
    }

    return fixes;
}

/**
 * Script-level batch quick fixes for safe signature corrections (e.g. removing excess arguments file-wide).
 */
function getBatchSignatureFixes(document, diagnostics) {
    const actions = [];
    if (!diagnostics || diagnostics.length === 0) return actions;

    // 1. Batch Excess Argument Removal
    const excessDiags = diagnostics.filter(d => d.code === 'bml-function-arg-count' && /expects\s+(?:at most\s+)?(\d+)\s+argument/i.test(d.message || ''));
    if (excessDiags.length > 0) {
        const fullEdit = new vscode.WorkspaceEdit();
        let editCount = 0;

    excessDiags.forEach(diag => {
        const editRange = diag.originalRange ?? diag.range;
        const lineText = document.lineAt(editRange.start.line).text;
        const openParen = lineText.indexOf('(', editRange.start.character);
        if (openParen === -1) return;

        let depth = 0;
        let closeParen = -1;
        for (let i = openParen; i < lineText.length; i++) {
            if (lineText[i] === '(') depth++;
            else if (lineText[i] === ')') {
                depth--;
                if (depth === 0) { closeParen = i; break; }
            }
        }
        if (closeParen === -1) return;

        const maxMatch = diag.message.match(/expects\s+(?:at most\s+)?(\d+)\s+argument/i);
        if (!maxMatch) return;
        const maxExpected = parseInt(maxMatch[1], 10);
        const argsContent = lineText.substring(openParen + 1, closeParen).trim();
        const args = splitArgumentsList(argsContent);
        if (args.length > maxExpected && maxExpected >= 0) {
            const keptArgs = args.slice(0, maxExpected).join(', ');
            const replaceRange = new vscode.Range(editRange.start.line, openParen + 1, editRange.start.line, closeParen);
            fullEdit.replace(document.uri, replaceRange, keptArgs);
            editCount++;
        }
    });

        if (editCount > 0) {
            const action = new vscode.CodeAction(`Fix all excess argument errors in file (${editCount} issue${editCount > 1 ? 's' : ''})`, vscode.CodeActionKind.QuickFix);
            action.edit = fullEdit;
            action.diagnostics = excessDiags;
            actions.push(action);
        }
    }

    // 2. Batch Unknown/Deprecated Built-in Function Name Replacement
    const UNAMBIGUOUS_BUILTINS = new Map([
        ['abs', 'fabs'],
        ['now', 'getdate'],
        ['today', 'getdate'],
        ['log10', 'log'],
        ['btoa', 'encodebase64'],
        ['atob', 'decodebase64']
    ]);

    const unknownDiags = diagnostics.filter(d => {
        if (d.code !== 'bml-unknown-function') return false;
        const editRange = d.originalRange ?? d.range;
        const word = document.getText(editRange).trim().toLowerCase();
        return UNAMBIGUOUS_BUILTINS.has(word);
    });

    if (unknownDiags.length > 0) {
        const fnEdit = new vscode.WorkspaceEdit();
        unknownDiags.forEach(diag => {
            const editRange = diag.originalRange ?? diag.range;
            const word = document.getText(editRange).trim().toLowerCase();
            const replacement = UNAMBIGUOUS_BUILTINS.get(word);
            if (replacement) {
                fnEdit.replace(document.uri, editRange, replacement);
            }
        });
        const fnAction = new vscode.CodeAction(
            `Fix all unknown/deprecated built-in function names in file (${unknownDiags.length} issue${unknownDiags.length > 1 ? 's' : ''})`,
            vscode.CodeActionKind.QuickFix
        );
        fnAction.edit = fnEdit;
        fnAction.diagnostics = unknownDiags;
        actions.push(fnAction);
    }

    return actions;
}

module.exports = {
    getSmartSignatureFixes,
    getBatchSignatureFixes,
    inferLhsExpectedType,
    synthesizeSmartParameterValues,
    extractEnumOptionsFromDoc,
    getBmlFunctions
};
