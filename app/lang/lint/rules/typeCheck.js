const {
    getAssignmentRhsText,
    inferLiteralType,
    inferExpressionType,
    isTypeReassignmentMismatch
} = require('./typeCheckInference');

const {
    TYPE_CONSTRUCTORS,
    FUNCTION_RETURN_TYPES,
    getFunctionReturnTypes,
    getLeftOperandType,
    getRightOperandType,
} = require('./typeCheckOperands');

function collectVariableTypesAndMismatches(cleanText, doc, declaredTypes, vscode, extensionPath, precomputedDeclaredVars) {
    const diagnostics = [];
    const firstTypeByVar = new Map();
    const returnTypes = getFunctionReturnTypes(extensionPath);

    if (declaredTypes) {
        for (const [paramNameLower, type] of declaredTypes.entries()) {
            firstTypeByVar.set(paramNameLower.toLowerCase(), { type, line: -1, isParam: true });
            firstTypeByVar.set(paramNameLower, { type, line: -1, isParam: true });
        }
    }

    if (precomputedDeclaredVars) {
        for (const [varName, decls] of precomputedDeclaredVars.entries()) {
            for (let i = 0; i < decls.length; i++) {
                const decl = decls[i];
                if (decl.isLoopVar) continue;
                const matchIndex = decl.index;
                const eqIndex = cleanText.indexOf('=', matchIndex + varName.length);
                if (eqIndex === -1) continue;
                const rhs = getAssignmentRhsText(cleanText, eqIndex + 1);
                if (!rhs) continue;

                const inferredType = inferExpressionType(rhs.text, extensionPath, returnTypes);
                if (!inferredType) continue;

                let elementType = null;
                const dictMatch = rhs.text.trim().match(/^dict\s*\(\s*["']([^"']+)["']\s*\)$/i);
                if (dictMatch) {
                    elementType = dictMatch[1].trim();
                }

                const lookupKey = varName.toLowerCase();
                const prior = firstTypeByVar.get(lookupKey) || firstTypeByVar.get(varName);
                if (!prior) {
                    const entry = { type: inferredType, elementType, line: doc ? doc.positionAt(matchIndex).line : 0 };
                    firstTypeByVar.set(lookupKey, entry);
                    firstTypeByVar.set(varName, entry);
                } else if (vscode && doc) {
                    const literalType = inferLiteralType(rhs.text);
                    if (literalType && isTypeReassignmentMismatch(prior.type, literalType)) {
                        const currentLine = doc.positionAt(matchIndex).line;
                        if (prior.line !== currentLine) {
                            const startPos = doc.positionAt(matchIndex);
                            const endPos = startPos.translate(0, varName.length);
                            const range = new vscode.Range(startPos, endPos);
                            const origin = prior.isParam
                                ? `was declared as a ${prior.type} parameter`
                                : `was first assigned a ${prior.type} value (line ${prior.line + 1})`;
                            const diag = new vscode.Diagnostic(
                                range,
                                `Type mismatch: '${varName}' ${origin} - CPQ will not accept reassigning it to a ${literalType} value.`,
                                vscode.DiagnosticSeverity.Error
                            );
                            diag.code = 'bml-type-mismatch';
                            diagnostics.push(diag);
                        }
                    }
                }
            }
        }
        return { firstTypeByVar, diagnostics };
    }

    const assignRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    let match;

    while ((match = assignRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const matchIndex = match.index;

        let before = matchIndex - 1;
        while (before >= 0 && cleanText.charCodeAt(before) <= 32) before--;
        if (before >= 0 && (cleanText[before] === '<' || cleanText[before] === '>' || cleanText[before] === '!')) {
            continue;
        }

        const rhsStart = matchIndex + match[0].length;
        const rhs = getAssignmentRhsText(cleanText, rhsStart);
        if (!rhs) continue;

        const inferredType = inferExpressionType(rhs.text, extensionPath, returnTypes);
        if (!inferredType) continue;

        let elementType = null;
        const dictMatch = rhs.text.trim().match(/^dict\s*\(\s*["']([^"']+)["']\s*\)$/i);
        if (dictMatch) {
            elementType = dictMatch[1].trim();
        }

        const lookupKey = varName.toLowerCase();
        const prior = firstTypeByVar.get(lookupKey) || firstTypeByVar.get(varName);
        if (!prior) {
            const entry = { type: inferredType, elementType, line: doc ? doc.positionAt(matchIndex).line : 0 };
            firstTypeByVar.set(lookupKey, entry);
            firstTypeByVar.set(varName, entry);
        } else if (vscode && doc) {
            const currentLine = doc.positionAt(matchIndex).line;
            const literalType = inferLiteralType(rhs.text);
            if (literalType && prior.line !== currentLine && isTypeReassignmentMismatch(prior.type, literalType)) {
                const startPos = doc.positionAt(matchIndex);
                const endPos = startPos.translate(0, varName.length);
                const range = new vscode.Range(startPos, endPos);
                const origin = prior.isParam
                    ? `was declared as a ${prior.type} parameter`
                    : `was first assigned a ${prior.type} value (line ${prior.line + 1})`;
                const diag = new vscode.Diagnostic(
                    range,
                    `Type mismatch: '${varName}' ${origin} - CPQ will not accept reassigning it to a ${literalType} value.`,
                    vscode.DiagnosticSeverity.Error
                );
                diag.code = 'bml-type-mismatch';
                diagnostics.push(diag);
            }
        }
    }

    return { firstTypeByVar, diagnostics };
}

function collectVariableTypes(cleanText, doc, declaredTypes) {
    return collectVariableTypesAndMismatches(cleanText, doc, declaredTypes, null).firstTypeByVar;
}

function checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredTypes, extensionPath, noStringsText, precomputedFirstTypes, precomputedDiagnostics) {
    let firstTypeByVar = precomputedFirstTypes;
    let diagnostics;
    if (precomputedDiagnostics && precomputedFirstTypes) {
        diagnostics = [...precomputedDiagnostics];
    } else {
        const res = collectVariableTypesAndMismatches(cleanText, doc, declaredTypes, vscode);
        firstTypeByVar = res.firstTypeByVar;
        diagnostics = [...res.diagnostics];
    }
    const returnTypes = getFunctionReturnTypes(extensionPath);

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

        const isNumeric = (type) => {
            if (!type || typeof type !== 'string') return false;
            const lower = type.toLowerCase();
            return ['integer', 'float', 'long', 'double', 'number', 'numeric', 'currency', 'percent'].includes(lower);
        };
        const isString = (type) => {
            if (!type || typeof type !== 'string') return false;
            const lower = type.toLowerCase();
            return lower === 'string' || lower === 'text';
        };
        const isNullType = (type) => ['Null', 'JsonNull', 'null', 'jsonnull'].includes(typeof type === 'string' ? type.toLowerCase() : '');

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
                    // valid: numeric widening / cross-comparison (Integer vs Float vs Number vs Currency etc.)
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

    // Static Dictionary Value Type Checking
    diagnostics.push(...checkDictPutTypeConsistency(cleanText, doc, vscode, firstTypeByVar, extensionPath, returnTypes));

    // Static Array Bounds Checking
    diagnostics.push(...checkArrayBounds(cleanText, noStringsText, doc, vscode));

    return diagnostics;
}

function extractPutCalls(cleanText) {
    const calls = [];
    const putStartRegex = /\bput\s*\(/g;
    let match;
    while ((match = putStartRegex.exec(cleanText)) !== null) {
        const startIndex = match.index;
        let i = startIndex + match[0].length;
        let parenDepth = 1;
        let inSingle = false;
        let inDouble = false;
        const argChunks = [];
        let currentArg = '';

        while (i < cleanText.length && parenDepth > 0) {
            const ch = cleanText[i];
            if (ch === '\\') {
                currentArg += ch + (cleanText[i + 1] || '');
                i += 2;
                continue;
            }
            if (ch === '"' && !inSingle) inDouble = !inDouble;
            else if (ch === "'" && !inDouble) inSingle = !inSingle;

            if (!inDouble && !inSingle) {
                if (ch === '(') parenDepth++;
                else if (ch === ')') {
                    parenDepth--;
                    if (parenDepth === 0) {
                        argChunks.push(currentArg.trim());
                        break;
                    }
                } else if (ch === ',' && parenDepth === 1) {
                    argChunks.push(currentArg.trim());
                    currentArg = '';
                    i++;
                    continue;
                }
            }
            currentArg += ch;
            i++;
        }

        if (argChunks.length === 3) {
            calls.push({
                startIndex,
                endIndex: i + 1,
                dictVar: argChunks[0],
                keyExpr: argChunks[1],
                valExpr: argChunks[2]
            });
        }
    }
    return calls;
}

function checkDictPutTypeConsistency(cleanText, doc, vscode, firstTypeByVar, extensionPath, returnTypes) {
    const diagnostics = [];
    if (!firstTypeByVar || !doc || !vscode || !cleanText.includes('put')) return diagnostics;

    const calls = extractPutCalls(cleanText);
    for (let c = 0; c < calls.length; c++) {
        const call = calls[c];
        const dictVarName = call.dictVar;
        const valExpr = call.valExpr;
        const callIndex = call.startIndex;

        const dictEntry = firstTypeByVar.get(dictVarName.toLowerCase()) || firstTypeByVar.get(dictVarName);
        if (!dictEntry || !dictEntry.elementType) continue;

        const expectedElem = dictEntry.elementType.toLowerCase();
        if (expectedElem === 'anytype' || expectedElem === 'dictionary' || expectedElem === 'dict' || expectedElem === 'dict<anytype>') continue;

        let valType = inferLiteralType(valExpr);
        if (!valType) {
            valType = inferExpressionType(valExpr, extensionPath, returnTypes);
        }
        if (!valType && /^[a-zA-Z_]\w*$/.test(valExpr)) {
            const valVarEntry = firstTypeByVar.get(valExpr.toLowerCase()) || firstTypeByVar.get(valExpr);
            if (valVarEntry && valVarEntry.type) {
                valType = valVarEntry.type;
            }
        }
        if (!valType) continue;

        const valTypeLower = valType.toLowerCase();
        let compatible = false;

        if (expectedElem === 'string' || expectedElem === 'text') {
            compatible = valTypeLower === 'string' || valTypeLower === 'text';
        } else if (expectedElem === 'integer') {
            compatible = valTypeLower === 'integer';
        } else if (expectedElem === 'float' || expectedElem === 'number' || expectedElem === 'numeric' || expectedElem === 'double' || expectedElem === 'currency' || expectedElem === 'percent') {
            compatible = ['float', 'integer', 'number', 'numeric', 'double', 'currency', 'percent', 'long'].includes(valTypeLower);
        } else if (expectedElem === 'boolean') {
            compatible = valTypeLower === 'boolean';
        } else if (expectedElem === 'date') {
            compatible = valTypeLower === 'date';
        } else if (expectedElem === 'json') {
            compatible = valTypeLower === 'json';
        } else if (expectedElem === 'jsonarray') {
            compatible = valTypeLower === 'jsonarray';
        } else if (expectedElem === 'bytearray') {
            compatible = valTypeLower === 'bytearray';
        } else if (expectedElem.endsWith('[]')) {
            compatible = valTypeLower === expectedElem;
        } else {
            compatible = true;
        }

        if (!compatible) {
            const startPos = doc.positionAt(callIndex);
            const endPos = doc.positionAt(call.endIndex);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Type mismatch: Cannot insert '${valType}' value into '${dictVarName}' declared as dict("${dictEntry.elementType}"). Expected '${dictEntry.elementType}'.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-dict-put-type-mismatch';
            diagnostics.push(diag);
        }
    }
    return diagnostics;
}

function checkArrayBounds(cleanText, noStringsText, doc, vscode) {
    const diagnostics = [];
    if (!doc || !vscode) return diagnostics;

    const TYPE_KEYWORDS = new Set(['string', 'integer', 'float', 'boolean', 'date', 'dict', 'dictionary', 'json', 'jsonarray', 'bytearray']);
    const arraySizes = new Map();

    // 1. Sized constructor: arr = type[size];
    const sizedCtorRegex = /\b([a-zA-Z_]\w*)\s*=\s*(?:string|integer|float|boolean|date|dict|dictionary|json|jsonarray|bytearray)\[\s*(\d+)\s*\]\s*;/g;
    let match;
    while ((match = sizedCtorRegex.exec(noStringsText)) !== null) {
        const varName = match[1].toLowerCase();
        const size = parseInt(match[2], 10);
        arraySizes.set(varName, { size, line: doc.positionAt(match.index).line, originalName: match[1] });
    }

    // 2. Literal initializer: arr = string[]{"a", "b", "c"};
    const literalInitRegex = /\b([a-zA-Z_]\w*)\s*=\s*(?:string|integer|float|boolean|date|dict|dictionary|json|jsonarray|bytearray)\[\s*\]\s*\{([^}]+)\}\s*;/g;
    while ((match = literalInitRegex.exec(cleanText)) !== null) {
        const varName = match[1].toLowerCase();
        const elements = match[2].split(',');
        const size = elements.length;
        arraySizes.set(varName, { size, line: doc.positionAt(match.index).line, originalName: match[1] });
    }

    if (arraySizes.size === 0) return diagnostics;

    // 3. Check constant index accesses: arr[5]
    const indexAccessRegex = /\b([a-zA-Z_]\w*)\[\s*(\d+)\s*\]/g;
    while ((match = indexAccessRegex.exec(noStringsText)) !== null) {
        const varName = match[1].toLowerCase();
        if (TYPE_KEYWORDS.has(varName)) continue;
        const indexVal = parseInt(match[2], 10);
        const arrayInfo = arraySizes.get(varName);
        if (arrayInfo && indexVal >= arrayInfo.size) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Index out of bounds: Index ${indexVal} exceeds declared array size of ${arrayInfo.size} for '${match[1]}'.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-array-bounds-error';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = {
    inferLiteralType,
    inferExpressionType,
    checkAssignmentTypeConsistency,
    collectVariableTypes,
    collectVariableTypesAndMismatches,
    getAssignmentRhsText,
    checkDictPutTypeConsistency,
    checkArrayBounds
};
