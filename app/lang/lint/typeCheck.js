// Bails out (returns null) on a newline at depth 0 with no semicolon yet, rather than
// guessing across what might be two separate statements.
function getAssignmentRhsText(text, startIndex) {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];

        if (ch === '\\') {
            i++;
            continue;
        }
        if (ch === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (ch === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }
        if (inSingleQuote || inDoubleQuote) continue;

        if (ch === '{' || ch === '(' || ch === '[') {
            depth++;
        } else if (ch === '}' || ch === ')' || ch === ']') {
            depth = Math.max(0, depth - 1);
        } else if (ch === ';' && depth === 0) {
            return { text: text.slice(startIndex, i), endIndex: i };
        } else if (ch === '\n' && depth === 0) {
            return null;
        }
    }
    return null;
}

// Constructor calls whose function name IS the type they build.
const TYPE_CONSTRUCTORS = {
    dict: 'Dictionary',
    json: 'Json',
    jsonarray: 'JsonArray',
    jsonnull: 'JsonNull',
    bytearray: 'ByteArray',
    stringbuilder: 'StringBuilder',
    recordset: 'RecordSet',
};

// Only returns a type when the RHS is unambiguously a single literal/constructed value;
// anything else (calls, concatenation, variable refs) returns null rather than guess.
function inferLiteralType(rhsText) {
    const trimmed = rhsText.trim();

    if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(trimmed)) return 'String';
    if (/^(?:true|false)$/i.test(trimmed)) return 'Boolean';
    if (/^-?\d+\.\d+$/.test(trimmed)) return 'Float';
    if (/^-?\d+$/.test(trimmed)) return 'Integer';

    // Typed array literal or bare declaration: string[]{"a","b"}, integer[][]{...}, date[];
    const arrayMatch = trimmed.match(/^(string|integer|float|boolean|date)((?:\[\])+)\s*(?:\{[\s\S]*\})?$/i);
    if (arrayMatch) {
        return `${arrayMatch[1].toLowerCase()}${arrayMatch[2]}`;
    }

    // Type-named constructor call: dict(...), json(...), jsonarray(...), etc.
    // No nested parens allowed in the args, to stay conservative about what
    // counts as "unambiguous" - dict("a", lookupSomething()) is skipped.
    const ctorMatch = trimmed.match(/^([a-zA-Z]+)\s*\(([^()]*)\)$/);
    if (ctorMatch) {
        const ctorType = TYPE_CONSTRUCTORS[ctorMatch[1].toLowerCase()];
        if (ctorType) return ctorType;
    }

    return null;
}

// BML variables are statically typed by their first assignment; CPQ rejects reassigning
// to a different type later. declaredTypes optionally seeds a variable's type from its
// function-parameter declaration instead of waiting for the first in-body assignment.
function getLeftOperandType(text, index, varTypes) {
    let i = index - 1;
    while (i >= 0 && /\s/.test(text[i])) {
        i--;
    }
    if (i < 0) return null;

    if (text[i] === '"' || text[i] === "'") {
        const quote = text[i];
        let j = i - 1;
        while (j >= 0) {
            if (text[j] === quote && (j === 0 || text[j-1] !== '\\')) {
                return 'String';
            }
            j--;
        }
        return 'String';
    }

    let start = i;
    while (start >= 0 && /[a-zA-Z0-9_.]/.test(text[start])) {
        start--;
    }
    const token = text.slice(start + 1, i + 1);
    if (/^\d+\.\d+$/.test(token)) return 'Float';
    if (/^\d+$/.test(token)) return 'Integer';
    if (/^(?:true|false)$/i.test(token)) return 'Boolean';
    if (token === 'null') return 'Null';

    if (/^[a-zA-Z_]\w*$/.test(token)) {
        const typeInfo = varTypes.get(token);
        if (typeInfo) return typeInfo.type;
        const paramType = varTypes.get(token.toLowerCase());
        if (paramType) return paramType.type;
    }
    return null;
}

function getRightOperandType(text, index, varTypes) {
    let i = index + 1;
    while (i < text.length && /\s/.test(text[i])) {
        i++;
    }
    if (i >= text.length) return null;

    if (text[i] === '"' || text[i] === "'") {
        const quote = text[i];
        let j = i + 1;
        while (j < text.length) {
            if (text[j] === quote && text[j-1] !== '\\') {
                return 'String';
            }
            j++;
        }
        return 'String';
    }

    let end = i;
    while (end < text.length && /[a-zA-Z0-9_.]/.test(text[end])) {
        end++;
    }
    const token = text.slice(i, end);
    if (/^\d+\.\d+$/.test(token)) return 'Float';
    if (/^\d+$/.test(token)) return 'Integer';
    if (/^(?:true|false)$/i.test(token)) return 'Boolean';
    if (token === 'null') return 'Null';

    if (/^[a-zA-Z_]\w*$/.test(token)) {
        const typeInfo = varTypes.get(token);
        if (typeInfo) return typeInfo.type;
        const paramType = varTypes.get(token.toLowerCase());
        if (paramType) return paramType.type;
    }
    return null;
}

function checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredTypes) {
    const diagnostics = [];
    const firstTypeByVar = new Map();

    if (declaredTypes) {
        for (const [paramNameLower, type] of declaredTypes.entries()) {
            firstTypeByVar.set(paramNameLower, { type, line: -1, isParam: true });
        }
    }

    const assignRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    let match;
    
    // First pass: collect variable types
    while ((match = assignRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const matchIndex = match.index;

        let before = matchIndex - 1;
        while (before >= 0 && /\s/.test(cleanText[before])) before--;
        if (before >= 0 && (cleanText[before] === '<' || cleanText[before] === '>' || cleanText[before] === '!')) {
            continue;
        }

        const rhsStart = matchIndex + match[0].length;
        const rhs = getAssignmentRhsText(cleanText, rhsStart);
        if (!rhs) continue;

        const inferredType = inferLiteralType(rhs.text);
        if (!inferredType) continue;

        const lookupKey = declaredTypes && declaredTypes.has(varName.toLowerCase()) ? varName.toLowerCase() : varName;
        if (!firstTypeByVar.has(lookupKey) && !firstTypeByVar.has(varName)) {
            firstTypeByVar.set(varName, { type: inferredType, line: doc.positionAt(matchIndex).line });
        }
    }

    // Second pass: validate assignments
    assignRegex.lastIndex = 0;
    while ((match = assignRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const matchIndex = match.index;

        let before = matchIndex - 1;
        while (before >= 0 && /\s/.test(cleanText[before])) before--;
        if (before >= 0 && (cleanText[before] === '<' || cleanText[before] === '>' || cleanText[before] === '!')) {
            continue;
        }

        const rhsStart = matchIndex + match[0].length;
        const rhs = getAssignmentRhsText(cleanText, rhsStart);
        if (!rhs) continue;

        const inferredType = inferLiteralType(rhs.text);
        if (!inferredType) continue;

        const lookupKey = declaredTypes && declaredTypes.has(varName.toLowerCase()) ? varName.toLowerCase() : varName;
        const prior = firstTypeByVar.get(lookupKey) || firstTypeByVar.get(varName);
        if (prior && prior.line !== doc.positionAt(matchIndex).line && prior.type !== inferredType) {
            const startPos = doc.positionAt(matchIndex);
            const endPos = startPos.translate(0, varName.length);
            const range = new vscode.Range(startPos, endPos);
            const origin = prior.isParam
                ? `was declared as a ${prior.type} parameter`
                : `was first assigned a ${prior.type} value (line ${prior.line + 1})`;
            const diag = new vscode.Diagnostic(
                range,
                `Type mismatch: '${varName}' ${origin} - CPQ will not accept reassigning it to a ${inferredType} value.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-type-mismatch';
            diagnostics.push(diag);
        }
    }

    // Binary expressions type checking
    const { getStringRanges } = require('./strings');
    const stringRanges = getStringRanges(cleanText);
    const isInsideString = (index) => {
        return stringRanges.some(([start, end]) => index >= start && index < end);
    };

    const binaryOpRegex = /([+\-*/])/g;
    while ((match = binaryOpRegex.exec(cleanText)) !== null) {
        const op = match[1];
        const opIndex = match.index;

        if (isInsideString(opIndex)) continue;

        const nextChar = cleanText[opIndex + 1];
        const prevChar = cleanText[opIndex - 1];
        if (op === '+' && (nextChar === '+' || prevChar === '+')) continue;
        if (op === '-' && (nextChar === '-' || prevChar === '-')) continue;
        if (nextChar === '=') continue; // +=, -=, *=, /=

        const leftType = getLeftOperandType(cleanText, opIndex, firstTypeByVar);
        const rightType = getRightOperandType(cleanText, opIndex, firstTypeByVar);

        if (!leftType || !rightType) continue;

        const isNumeric = (type) => ['Integer', 'Float', 'Long', 'Double'].includes(type);

        if (op === '+') {
            const isLeftString = leftType === 'String';
            const isRightString = rightType === 'String';
            const isLeftNumeric = isNumeric(leftType);
            const isRightNumeric = isNumeric(rightType);

            if ((isLeftString && isRightNumeric) || (isLeftNumeric && isRightString)) {
                const startPos = doc.positionAt(opIndex);
                const endPos = doc.positionAt(opIndex + 1);
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `Type mismatch: Cannot combine 'String' and '${isLeftString ? rightType : leftType}' using '+'. Convert ${isLeftString ? 'the number' : 'the other operand'} to String using 'string()' or vice versa.`,
                    vscode.DiagnosticSeverity.Error
                );
                diag.code = 'bml-binary-type-mismatch';
                diagnostics.push(diag);
            }
        } else {
            const isLeftString = leftType === 'String';
            const isRightString = rightType === 'String';

            if (isLeftString || isRightString) {
                const startPos = doc.positionAt(opIndex);
                const endPos = doc.positionAt(opIndex + 1);
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `Type mismatch: Operator '${op}' is not supported for 'String' values.`,
                    vscode.DiagnosticSeverity.Error
                );
                diag.code = 'bml-binary-type-mismatch';
                diagnostics.push(diag);
            }
        }
    }

    return diagnostics;
}

module.exports = { inferLiteralType, checkAssignmentTypeConsistency, getAssignmentRhsText };
