const fs = require('fs');
const { keywords: reservedWords, loadBuiltInFunctions } = require('./functions');
const { loadSystemVariables } = require('./systemVariables');

// Commerce functions have implicit platform bindings (document attributes, etc.)
// this rule can't see from the file's text, so it only runs for util functions.
function isCommerceFunction(metadata) {
    return !!(metadata && metadata.commerceDocument);
}

// Duplicated from metadataTypes.js to keep this rule's gating logic independently testable.
function readLocalMetadataForGating(bmlFilePath) {
    if (!bmlFilePath) return null;
    try {
        const metaPath = bmlFilePath.replace(/\.bml$/i, '-meta.json');
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
        return null;
    }
}

function checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath, cleanText = noStringsText) {
    const diagnostics = [];

    const systemVars = loadSystemVariables(extensionPath);
    const builtIns = loadBuiltInFunctions(extensionPath);

    const isIgnoredSymbol = (nameLower) => {
        if (reservedWords.has(nameLower) || systemVars.has(nameLower) || builtIns.has(nameLower)) return true;
        if (nameLower === 'commerce' || nameLower === 'util' || nameLower === 'transaction' || nameLower === 'line' || nameLower === 'cpqjs' || nameLower === 'cpqjsready' || nameLower === 'nan' || nameLower === 'jnan') return true;
        if (nameLower.startsWith('_') || nameLower.startsWith('bm_') || nameLower.startsWith('_c_') || nameLower.startsWith('_t_') || nameLower.startsWith('_l_')) return true;
        if (nameLower.endsWith('_c') || nameLower.endsWith('_t') || nameLower.endsWith('_l')) return true;
        return false;
    };

    const declaredNames = new Set();
    const earliestDeclByName = new Map();
    const declSitesByName = new Map();

    declaredVars.forEach((decls, varName) => {
        declaredNames.add(varName);
        earliestDeclByName.set(varName, Math.min(...decls.map((d) => d.index)));
        declSitesByName.set(varName, new Set(decls.map((d) => d.index)));
    });

    const metadata = readLocalMetadataForGating(doc.uri && doc.uri.fsPath);
    const isCommerce = isCommerceFunction(metadata);

    // 1. Bare code identifier references in noStringsText
    const identRegex = /\b([a-zA-Z_]\w*)\b/g;
    let match;
    while ((match = identRegex.exec(noStringsText)) !== null) {
        const name = match[1];
        const nameLower = name.toLowerCase();
        const idx = match.index;

        if (isIgnoredSymbol(nameLower)) continue;

        // Dotted member/attribute access, not a bare variable read.
        let before = idx - 1;
        while (before >= 0 && /\s/.test(noStringsText[before])) before--;
        if (before >= 0 && noStringsText[before] === '.') continue;

        // Function-call name, not a variable read.
        let after = idx + name.length;
        while (after < noStringsText.length && /\s/.test(noStringsText[after])) after++;
        if (noStringsText[after] === '(') continue;

        // This occurrence is itself a declaration site, not a use.
        const sites = declSitesByName.get(name);
        if (sites && sites.has(idx)) continue;

        const earliest = earliestDeclByName.get(name);
        if (earliest !== undefined && earliest <= idx) continue;

        if (earliest !== undefined && earliest > idx) {
            if (isCommerce) continue;
            const startPos = doc.positionAt(idx);
            const endPos = startPos.translate(0, name.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `'${name}' is read here but isn't assigned until later in this file (line ${doc.positionAt(earliest).line + 1}) - this will read an uninitialized value.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-useBeforeDefine';
            diagnostics.push(diag);
        } else if (earliest === undefined) {
            if (isCommerce) continue;
            const startPos = doc.positionAt(idx);
            const endPos = startPos.translate(0, name.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `'${name}' is read here but is never defined in this function.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-undeclared-variable';
            diagnostics.push(diag);
        }
    }

    // 2. BMQL dynamic variable references ($varName) inside string literals in cleanText
    if (cleanText) {
        const bmqlVarRegex = /\$([a-zA-Z_]\w*)\b/g;
        let bmqlMatch;
        while ((bmqlMatch = bmqlVarRegex.exec(cleanText)) !== null) {
            const name = bmqlMatch[1];
            const nameLower = name.toLowerCase();
            const idx = bmqlMatch.index + 1; // position after '$'

            if (isIgnoredSymbol(nameLower)) continue;

            const earliest = earliestDeclByName.get(name);
            if (earliest !== undefined && earliest <= idx) continue;

            const startPos = doc.positionAt(idx);
            const endPos = startPos.translate(0, name.length);

            if (earliest !== undefined && earliest > idx) {
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `'${name}' is referenced in BMQL query as '$${name}' here, but isn't assigned until later in this file (line ${doc.positionAt(earliest).line + 1}).`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = 'bml-useBeforeDefine';
                diagnostics.push(diag);
            } else if (earliest === undefined) {
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `'${name}' is referenced in BMQL query as '$${name}' here, but variable '${name}' is never defined in this function.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = 'bml-undeclared-variable';
                diagnostics.push(diag);
            }
        }
    }

    return diagnostics;
}

module.exports = { checkUseBeforeDefine, isCommerceFunction };
