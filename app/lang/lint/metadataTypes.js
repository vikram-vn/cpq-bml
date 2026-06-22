const fs = require('fs');
const path = require('path');

let returnTypeLabels = null;
let paramTypeLabels = null;

// functionParamDataTypes.json and functionReturnTypes.json are Oracle's own
// lookupCode -> displayLabel tables for CPQ's data-type encoding - the exact
// same encoding used in a function's local -meta.json sidecar
// (parameters[].dataType.{value,displayValue}, returnType.{value,displayValue}).
// They use *different* numbering (e.g. param Boolean = 0, return Boolean = 4),
// so they're loaded and cached separately.
function loadLookupLabels(fileName) {
    const map = new Map();
    try {
        const filePath = path.resolve(__dirname, '../../lookups/bml', fileName);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data && Array.isArray(data.items)) {
                data.items.forEach((item) => {
                    if (typeof item.lookupCode === 'number') {
                        map.set(item.lookupCode, item.displayLabel);
                    }
                });
            }
        }
    } catch (e) {
        // fail soft to an empty map
    }
    return map;
}

function getReturnTypeLabels() {
    if (!returnTypeLabels) returnTypeLabels = loadLookupLabels('functionReturnTypes.json');
    return returnTypeLabels;
}

function getParamTypeLabels() {
    if (!paramTypeLabels) paramTypeLabels = loadLookupLabels('functionParamDataTypes.json');
    return paramTypeLabels;
}

function readLocalMetadata(bmlFilePath) {
    try {
        const metaPath = bmlFilePath.replace(/\.bml$/i, '-meta.json');
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
        return null;
    }
}

// Dictionary-of-anything labels ("Boolean Dictionary", "Dictionary of String
// Dictionaries", ...) are all just a plain dict() at the BML literal-syntax
// level - the element-type detail is a metadata-only concept CPQ enforces
// itself, not something expressible as a distinct BML literal. Typed-array
// labels get their leading type word lowercased to match inferLiteralType's
// own convention (string[], integer[][], ...) so the two compare equal.
function normalizeTypeLabel(label) {
    if (typeof label !== 'string') return label;
    if (label.indexOf('Dictionary') !== -1) return 'Dictionary';
    const arrayMatch = label.match(/^([A-Za-z]+)((?:\[\])+)$/);
    if (arrayMatch) return `${arrayMatch[1].toLowerCase()}${arrayMatch[2]}`;
    return label;
}

// Map<lowercaseParamName, normalizedType> for a document's own declared
// parameters, for typeCheck.js to seed its variable-type tracking with -
// reassigning a parameter to a conflicting literal is exactly as invalid as
// reassigning any other variable, it just starts from a declared type
// instead of a first in-body assignment.
function getDeclaredParameterTypes(bmlFilePath) {
    const result = new Map();
    if (!bmlFilePath) return result;
    const metadata = readLocalMetadata(bmlFilePath);
    if (!metadata || !Array.isArray(metadata.parameters)) return result;
    metadata.parameters.forEach((param) => {
        if (param && param.name && param.dataType && param.dataType.displayValue) {
            result.set(param.name.toLowerCase(), normalizeTypeLabel(param.dataType.displayValue));
        }
    });
    return result;
}

function getAssignmentRhsTextFrom(text, startIndex) {
    // Re-implemented rather than imported to keep this module independently
    // testable; identical balanced-bracket statement-end scan as typeCheck.js.
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
        if (inSingleQuote || inDoubleQuote) continue;
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
        else if (ch === ';' && depth === 0) return { text: text.slice(startIndex, i), endIndex: i };
        else if (ch === '\n' && depth === 0) return null;
    }
    return null;
}

// Validates a document's local -meta.json sidecar (if any) two ways:
// 1. Internal consistency: returnType.value/dataType.value should actually
//    map to their own displayValue per Oracle's lookup tables - a mismatch
//    means the sidecar is corrupted (e.g. hand-edited or desynced by a bug),
//    which would silently send the wrong type to CPQ on the next deploy/debug.
// 2. Cross-check: a `return <literal>;` in the body whose inferred type
//    conflicts with the function's own declared return type - CPQ will
//    reject this at compile/deploy time.
function checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType) {
    const diagnostics = [];
    if (!doc.uri) return diagnostics;
    const metadata = readLocalMetadata(doc.uri.fsPath);
    if (!metadata) return diagnostics;

    const returnLabels = getReturnTypeLabels();
    const paramLabels = getParamTypeLabels();
    const fileStart = new vscode.Range(doc.positionAt(0), doc.positionAt(0));

    if (metadata.returnType && typeof metadata.returnType.value === 'number' && metadata.returnType.displayValue) {
        const expectedLabel = returnLabels.get(metadata.returnType.value);
        if (expectedLabel && expectedLabel !== metadata.returnType.displayValue) {
            const diag = new vscode.Diagnostic(
                fileStart,
                `Metadata inconsistency: returnType.value (${metadata.returnType.value}) does not match returnType.displayValue ('${metadata.returnType.displayValue}') - Oracle's lookup table maps it to '${expectedLabel}'. The local -meta.json sidecar may be corrupted; consider re-pulling.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-metadata-return-type-inconsistent';
            diagnostics.push(diag);
        }

        const expectedType = normalizeTypeLabel(metadata.returnType.displayValue);
        const returnRegex = /\breturn\b\s*/g;
        let match;
        while ((match = returnRegex.exec(cleanText)) !== null) {
            const rhs = getAssignmentRhsTextFrom(cleanText, match.index + match[0].length);
            if (!rhs || !rhs.text.trim()) continue;
            const inferredType = inferLiteralType(rhs.text);
            if (!inferredType || inferredType === expectedType) continue;

            const startPos = doc.positionAt(match.index);
            const endPos = startPos.translate(0, 'return'.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Return type mismatch: this function's metadata declares return type '${metadata.returnType.displayValue}' but this returns a ${inferredType} value - CPQ will not accept this.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-return-type-mismatch';
            diagnostics.push(diag);
        }
    }

    if (Array.isArray(metadata.parameters)) {
        metadata.parameters.forEach((param) => {
            if (!param || !param.dataType || typeof param.dataType.value !== 'number' || !param.dataType.displayValue) return;
            const expectedLabel = paramLabels.get(param.dataType.value);
            if (expectedLabel && expectedLabel !== param.dataType.displayValue) {
                const diag = new vscode.Diagnostic(
                    fileStart,
                    `Metadata inconsistency: parameter '${param.name}'s dataType.value (${param.dataType.value}) does not match dataType.displayValue ('${param.dataType.displayValue}') - Oracle's lookup table maps it to '${expectedLabel}'. The local -meta.json sidecar may be corrupted; consider re-pulling.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = 'bml-metadata-param-type-inconsistent';
                diagnostics.push(diag);
            }
        });
    }

    return diagnostics;
}

module.exports = {
    getReturnTypeLabels,
    getParamTypeLabels,
    readLocalMetadata,
    normalizeTypeLabel,
    getDeclaredParameterTypes,
    checkMetadataTypeConsistency,
};
