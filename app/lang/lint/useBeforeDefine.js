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

function checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath) {
    const diagnostics = [];

    const metadata = readLocalMetadataForGating(doc.uri && doc.uri.fsPath);
    if (isCommerceFunction(metadata)) return diagnostics;

    const systemVars = loadSystemVariables(extensionPath);
    const builtIns = loadBuiltInFunctions(extensionPath);

    const declaredNames = new Set();
    const earliestDeclByName = new Map();
    const declSitesByName = new Map();

    declaredVars.forEach((decls, varName) => {
        declaredNames.add(varName);
        earliestDeclByName.set(varName, Math.min(...decls.map((d) => d.index)));
        declSitesByName.set(varName, new Set(decls.map((d) => d.index)));
    });

    const identRegex = /\b([a-zA-Z_]\w*)\b/g;
    let match;
    while ((match = identRegex.exec(noStringsText)) !== null) {
        const name = match[1];
        const nameLower = name.toLowerCase();
        const idx = match.index;

        if (reservedWords.has(nameLower) || systemVars.has(nameLower) || builtIns.has(nameLower)) continue;

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
        if (earliest === undefined) continue;

        const startPos = doc.positionAt(idx);
        const endPos = startPos.translate(0, name.length);
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            `'${name}' is read here but isn't assigned until later in this file (line ${doc.positionAt(earliest).line + 1}) - this will read an uninitialized value.`,
            vscode.DiagnosticSeverity.Warning
        );
        diag.code = 'bml-useBeforeDefine';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkUseBeforeDefine, isCommerceFunction };
