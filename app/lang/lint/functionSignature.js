// Parses a fullSignature string (e.g. "String substring(String str, Integer
// start, [Integer end])") into { min, max, params }. Handles both
// individually-bracketed optionals and Oracle's cascading nested-optional
// tail ("datetostr(Date date [, String dateFormat [, String timeZone]])").
// Signatures with a "(or" polymorphic-union type, or an unbalanced paren
// (put's doc text), are deliberately left unparsed - { params: null } -
// rather than guessing a wrong shape.

function findOuterParamsText(signature) {
    const closeIdx = signature.lastIndexOf(')');
    if (closeIdx === -1) return null;

    let depth = 0;
    for (let i = closeIdx; i >= 0; i--) {
        const ch = signature[i];
        if (ch === ')') depth++;
        else if (ch === '(') {
            depth--;
            if (depth === 0) return signature.slice(i + 1, closeIdx);
        }
    }
    return null; // unbalanced - caller treats as unparseable
}

function parseUnionTypes(typeStr) {
    if (!typeStr) return [];
    const types = [];
    const matches = typeStr.match(/[A-Za-z_]\w*(?:\[\])*/g);
    if (matches) {
        for (const m of matches) {
            if (m.toLowerCase() !== 'or') {
                types.push(m);
            }
        }
    }
    return types;
}

function extractTypeAndName(chunkText) {
    // Replace array brackets with a placeholder to preserve them
    let clean = chunkText.replace(/\[\s*\]/g, '__ARRAY__');
    // Remove optional-group brackets
    clean = clean.replace(/[\[\]]/g, '');
    // Restore array brackets
    clean = clean.replace(/__ARRAY__/g, '[]');
    clean = clean.trim();
    if (!clean) return null;
    
    const lastParenIdx = clean.lastIndexOf(')');
    if (lastParenIdx !== -1 && lastParenIdx < clean.length - 1) {
        const typePart = clean.substring(0, lastParenIdx + 1).trim();
        const namePart = clean.substring(lastParenIdx + 1).trim();
        return { type: typePart, name: namePart };
    }
    
    const lastSpaceIdx = clean.lastIndexOf(' ');
    if (lastSpaceIdx === -1) {
        return { type: null, name: clean };
    }
    
    const typePart = clean.substring(0, lastSpaceIdx).trim();
    const namePart = clean.substring(lastSpaceIdx + 1).trim();
    return { type: typePart, name: namePart };
}

// Some variadic functions (e.g. sbappend) describe a repeating group using a cascading bracket
// missing the comma a well-formed optional tail has, so a single chunk ends up containing two
// "Type name" pairs - a reliable signal to skip validation rather than enforce a wrong shape.
function hasGluedParameterPairs(paramsText) {
    const TYPE_NAME_PATTERN = '([A-Za-z_]\\w*(?:\\s*\\[\\s*\\])*)\\s+([A-Za-z_]\\w*)';
    const globalMatcher = new RegExp(TYPE_NAME_PATTERN, 'g');
    return paramsText.split(',').some((chunk) => {
        const matches = chunk.match(globalMatcher);
        if (!matches) return false;
        const realMatches = matches.filter(m => {
            const parts = m.trim().split(/\s+/);
            return parts.length === 2 && 
                   parts[0].toLowerCase() !== 'or' && 
                   parts[1].toLowerCase() !== 'or';
        });
        return realMatches.length > 1;
    });
}

function splitParameters(paramsText) {
    if (!paramsText) return [];
    const chunks = [];
    let start = 0;
    let parenDepth = 0;
    for (let i = 0; i < paramsText.length; i++) {
        const ch = paramsText[i];
        if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === ',' && parenDepth === 0) {
            chunks.push(paramsText.slice(start, i));
            start = i + 1;
        }
    }
    chunks.push(paramsText.slice(start));
    return chunks;
}

function parseParameterSignature(fullSignature) {
    if (!fullSignature || !fullSignature.includes('(')) {
        return { min: 0, max: Infinity, params: null };
    }

    const paramsText = findOuterParamsText(fullSignature);
    if (paramsText === null) {
        return { min: 0, max: Infinity, params: null };
    }
    if (!paramsText.trim()) {
        return { min: 0, max: 0, params: [] };
    }
    if (hasGluedParameterPairs(paramsText)) {
        return { min: 0, max: Infinity, params: null };
    }

    const chunks = splitParameters(paramsText);
    const params = [];
    let depth = 0;

    for (const chunk of chunks) {
        const depthBeforeChunk = depth;
        for (const ch of chunk) {
            if (ch === '[') depth++;
            else if (ch === ']') depth = Math.max(0, depth - 1);
        }

        const trimmed = chunk.trim();
        const opensOwnOptionalGroup = /^\[(?!\])/.test(trimmed);
        const optional = depthBeforeChunk > 0 || opensOwnOptionalGroup;

        const typeAndName = extractTypeAndName(chunk);
        let type = null;
        if (typeAndName && typeAndName.type) {
            const parsedTypes = parseUnionTypes(typeAndName.type);
            if (parsedTypes.length === 1) {
                type = parsedTypes[0];
            } else if (parsedTypes.length > 1) {
                type = parsedTypes;
            }
        }
        params.push({ type, optional });
    }

    const min = params.filter((p) => !p.optional).length;
    const max = params.length;
    return { min, max, params };
}

// Same traversal rules as functions.js's countArguments, but returns the argument slices themselves.
function splitArgumentsList(argsText) {
    if (!argsText.trim()) return [];

    const parts = [];
    let start = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < argsText.length; i++) {
        const char = argsText[i];

        if (char === '\\') {
            if (i + 1 < argsText.length) i++;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
            else if (char === '[') bracketDepth++;
            else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
            else if (char === '{') braceDepth++;
            else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
            else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
                parts.push(argsText.slice(start, i));
                start = i + 1;
            }
        }
    }
    parts.push(argsText.slice(start));
    return parts.map((p) => p.trim());
}

module.exports = { parseParameterSignature, splitArgumentsList, findOuterParamsText };
