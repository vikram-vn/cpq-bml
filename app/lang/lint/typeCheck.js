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

const {
    TYPE_CONSTRUCTORS,
    FUNCTION_RETURN_TYPES,
    getFunctionReturnTypes,
    getLeftOperandType,
    getRightOperandType,
} = require('./typeCheckOperands');

// Only returns a type when the RHS is unambiguously a single literal/constructed value;
// anything else (calls, concatenation, variable refs) returns null rather than guess.
function inferLiteralType(rhsText) {
    const trimmed = rhsText.trim();
    if (!trimmed) return null;
    const first = trimmed.charCodeAt(0);

    // Fast-path string literal check
    if (first === 34 || first === 39) { // '"' or "'"
        const last = trimmed.charCodeAt(trimmed.length - 1);
        if (last === first && trimmed.length >= 2) {
            if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(trimmed)) return 'String';
        }
        return null;
    }

    // Fast-path boolean literals
    if (trimmed === 'true' || trimmed === 'false' || trimmed === 'True' || trimmed === 'False') return 'Boolean';

    // Fast-path numbers: digits or '-'
    if ((first >= 48 && first <= 57) || first === 45) {
        if (/^-?\d+\.\d+$/.test(trimmed)) return 'Float';
        if (/^-?\d+$/.test(trimmed)) return 'Integer';
    }

    // Typed array literal or bare declaration: string[]{"a","b"}, integer[][]{...}, date[];
    if (trimmed.includes('[')) {
        const arrayMatch = trimmed.match(/^(string|integer|float|boolean|date)((?:\[\])+)\s*(?:\{[\s\S]*\})?$/i);
        if (arrayMatch) {
            return `${arrayMatch[1].toLowerCase()}${arrayMatch[2]}`;
        }
    }

    // Type-named constructor call: dict(...), json(...), jsonarray(...), etc.
    if (trimmed.endsWith(')')) {
        const ctorMatch = trimmed.match(/^([a-zA-Z]+)\s*\(([^()]*)\)$/);
        if (ctorMatch) {
            const ctorType = TYPE_CONSTRUCTORS[ctorMatch[1].toLowerCase()];
            if (ctorType) return ctorType;
        }
    }

    return null;
}

function inferExpressionType(rhsText) {
    const literalType = inferLiteralType(rhsText);
    if (literalType) return literalType;

    const trimmed = rhsText.trim();
    if (trimmed.endsWith(')')) {
        const ctorMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\(([^()]*)\)$/);
        if (ctorMatch) {
            const nameLower = ctorMatch[1].toLowerCase();
            const returnType = FUNCTION_RETURN_TYPES[nameLower];
            if (returnType) return returnType;
        }
    }

    return null;
}

function collectVariableTypes(cleanText, doc, declaredTypes) {
    const firstTypeByVar = new Map();

    if (declaredTypes) {
        for (const [paramNameLower, type] of declaredTypes.entries()) {
            firstTypeByVar.set(paramNameLower.toLowerCase(), { type, line: -1, isParam: true });
            firstTypeByVar.set(paramNameLower, { type, line: -1, isParam: true });
        }
    }

    const assignRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    let match;

    while ((match = assignRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const lookupKey = varName.toLowerCase();
        if (firstTypeByVar.has(lookupKey)) {
            continue; // Already collected first type for this variable!
        }

        const matchIndex = match.index;

        let before = matchIndex - 1;
        while (before >= 0 && cleanText.charCodeAt(before) <= 32) before--;
        if (before >= 0 && (cleanText[before] === '<' || cleanText[before] === '>' || cleanText[before] === '!')) {
            continue;
        }

        const rhsStart = matchIndex + match[0].length;
        const rhs = getAssignmentRhsText(cleanText, rhsStart);
        if (!rhs) continue;

        const inferredType = inferExpressionType(rhs.text);
        if (!inferredType) continue;

        const entry = { type: inferredType, line: doc ? doc.positionAt(matchIndex).line : 0 };
        firstTypeByVar.set(lookupKey, entry);
        firstTypeByVar.set(varName, entry);
    }

    return firstTypeByVar;
}

function checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredTypes, extensionPath, noStringsText, precomputedFirstTypes) {
    const diagnostics = [];
    const firstTypeByVar = precomputedFirstTypes || collectVariableTypes(cleanText, doc, declaredTypes);
    const returnTypes = getFunctionReturnTypes(extensionPath);

    // Second pass: validate assignments
    const assignRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    let match;
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

    // Binary expressions type checking - run directly on noStringsText to skip string literal operators
    const textForOps = noStringsText || cleanText;
    const binaryOpRegex = /(==|!=|<>|<=|>=|\+=|-=|\*=|\/=|[-+*/<>])/g;
    while ((match = binaryOpRegex.exec(textForOps)) !== null) {
        const op = match[1];
        const opIndex = match.index;

        const nextChar = cleanText[opIndex + op.length];
        const prevChar = cleanText[opIndex - 1];
        if (op === '+' && (nextChar === '+' || prevChar === '+')) continue;
        if (op === '-' && (nextChar === '-' || prevChar === '-')) continue;

        const leftType = getLeftOperandType(cleanText, opIndex, firstTypeByVar, returnTypes);
        const rightType = getRightOperandType(cleanText, opIndex + op.length - 1, firstTypeByVar, returnTypes);

        if (!leftType || !rightType) continue;

        const isNumeric = (type) => ['Integer', 'Float', 'Long', 'Double', 'integer', 'float', 'long', 'double'].includes(type);
        const isString = (type) => type === 'String' || type === 'string';
        const isNullType = (type) => ['Null', 'JsonNull'].includes(type);

        let mismatch = false;
        let msg = '';

        if (op === '+' || op === '+=') {
            const isLeftStr = isString(leftType);
            const isRightStr = isString(rightType);
            const isLeftNumeric = isNumeric(leftType);
            const isRightNumeric = isNumeric(rightType);

            if (isLeftStr && isRightStr) {
                // valid string concatenation
            } else if (isLeftNumeric && isRightNumeric) {
                // valid numeric addition
            } else {
                mismatch = true;
                if ((isLeftStr && isRightNumeric) || (isLeftNumeric && isRightStr)) {
                    msg = `Type mismatch: Cannot combine 'String' and '${isLeftStr ? rightType : leftType}' using '${op}'. Convert ${isLeftStr ? 'the number' : 'the other operand'} to String using 'string()' or vice versa.`;
                } else {
                    msg = `Type mismatch: Operator '${op}' cannot be applied to '${leftType}' and '${rightType}'.`;
                }
            }
        } else if (op === '-' || op === '*' || op === '/' || op === '-=' || op === '*=' || op === '/=') {
            if (!isNumeric(leftType) || !isNumeric(rightType)) {
                mismatch = true;
                msg = `Type mismatch: Operator '${op}' cannot be applied to '${leftType}' and '${rightType}'. Both operands must be numeric.`;
            }
        } else if (op === '==' || op === '!=' || op === '<>') {
            if (!isNullType(leftType) && !isNullType(rightType)) {
                const isLeftNumeric = isNumeric(leftType);
                const isRightNumeric = isNumeric(rightType);

                if (leftType === rightType || (isString(leftType) && isString(rightType))) {
                    // valid: equality is well-defined for any matching type
                    // (String, Boolean, Dictionary, Json, RecordSet, ...),
                    // not just the primitives singled out below.
                } else if (isLeftNumeric && isRightNumeric) {
                    // valid: numeric widening (Integer vs Float, etc.)
                } else {
                    mismatch = true;
                    msg = `Type mismatch: Cannot compare '${leftType}' and '${rightType}' using '${op}'.`;
                }
            }
        } else if (op === '<' || op === '>' || op === '<=' || op === '>=') {
            const isLeftStr = isString(leftType);
            const isRightStr = isString(rightType);
            const isLeftNumeric = isNumeric(leftType);
            const isRightNumeric = isNumeric(rightType);

            if (isLeftStr && isRightStr) {
                // valid string comparison
            } else if (isLeftNumeric && isRightNumeric) {
                // valid numeric comparison
            } else {
                mismatch = true;
                msg = `Type mismatch: Cannot compare '${leftType}' and '${rightType}' using '${op}'. both operands must be both numeric or both string.`;
            }
        }

        if (mismatch) {
            const startPos = doc.positionAt(opIndex);
            const endPos = doc.positionAt(opIndex + op.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                msg,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-binary-type-mismatch';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { inferLiteralType, inferExpressionType, checkAssignmentTypeConsistency, collectVariableTypes, getAssignmentRhsText };
