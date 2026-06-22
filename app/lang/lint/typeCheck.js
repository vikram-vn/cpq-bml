// Scans forward from just after `=` to find the RHS of a single statement,
// tracking ([{ nesting depth so a typed-array literal's `{...}` initializer
// or a constructor call's `(...)` arguments don't get cut short. Bails out
// (returns null) on a newline at depth 0 with no semicolon yet, rather than
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

// Constructor calls whose function name IS the type they build (dict() makes
// a Dictionary, jsonarray() makes a JsonArray, ...) - this is direct
// construction by name, not fuzzy return-type inference from common.json.
const TYPE_CONSTRUCTORS = {
    dict: 'Dictionary',
    json: 'Json',
    jsonarray: 'JsonArray',
    jsonnull: 'JsonNull',
    bytearray: 'ByteArray',
    stringbuilder: 'StringBuilder',
    recordset: 'RecordSet',
};

// Conservative literal-type inference: only returns a type when the RHS is
// unambiguously a single literal/constructed value of that type, with
// nothing else in the statement. Anything else (general function calls,
// concatenation, variable references, member/attribute access) returns null
// and is skipped - this is a regex-based linter with no real type inference,
// and a wrong guess here would be a false positive, which is far worse than
// missing a real bug.
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

// BML variables are statically typed by their first assignment - CPQ's own
// compiler rejects reassigning a variable to a value of a different type
// later in the same script. Tracks the first inferable type seen per
// variable name (file-flat, same scoping model as variables.js's shadowing
// check) and flags any later assignment whose inferred type differs.
//
// declaredTypes (optional) seeds a variable's type from its function-parameter
// declaration (see metadataTypes.js's getDeclaredParameterTypes) instead of
// waiting for the first in-body assignment - reassigning a parameter to a
// conflicting literal is exactly as invalid as reassigning any other variable.
function checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredTypes) {
    const diagnostics = [];
    const firstTypeByVar = new Map(); // varName -> { type, line } (line === -1 means "declared as a parameter")

    if (declaredTypes) {
        for (const [paramNameLower, type] of declaredTypes.entries()) {
            firstTypeByVar.set(paramNameLower, { type, line: -1, isParam: true });
        }
    }

    const assignRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    let match;
    while ((match = assignRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const matchIndex = match.index;

        // Exclude comparison operators that could be mistaken for assignment
        // from behind (<=, >=, !=) - same guard as variables.js.
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
        const prior = firstTypeByVar.get(lookupKey);
        if (!prior) {
            firstTypeByVar.set(varName, { type: inferredType, line: doc.positionAt(matchIndex).line });
            continue;
        }

        if (prior.type !== inferredType) {
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

    return diagnostics;
}

module.exports = { inferLiteralType, checkAssignmentTypeConsistency, getAssignmentRhsText };
