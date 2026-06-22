const { keywords: reservedWords, loadBuiltInFunctions } = require('./functions');
const { loadSystemVariables } = require('./systemVariables');

// ESLint's no-undef / use-before-define, scoped deliberately narrowly: CPQ
// commerce functions are full of implicit bindings (main/sub-document
// attributes referenced as bare identifiers, dependent attributes resolved
// by the platform before the script runs, ...) that this rule has no way to
// see from the file's own text. Applying it there would be guesswork
// dressed up as a diagnostic. Util library functions are self-contained -
// every value they read either comes from a declared parameter or must be
// assigned locally - so this only runs when the document's own metadata
// confirms it's a util function (no commerceDocument field), or when there's
// no local metadata to check at all (a brand-new unsaved file, where "util"
// is the safer default to assume).
function isCommerceFunction(metadata) {
    return !!(metadata && metadata.commerceDocument);
}

// Reads a function's own -meta.json sidecar the same way metadataTypes.js
// does. Duplicated rather than imported to keep this rule's gating logic
// self-contained and independently testable.
function readLocalMetadataForGating(bmlFilePath) {
    if (!bmlFilePath) return null;
    try {
        const fs = require('fs');
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

    const declaredNames = new Set(); // exact-case names with at least one declaration
    const earliestDeclByName = new Map(); // exact-case name -> earliest index
    const declSitesByName = new Map(); // exact-case name -> Set of declaration indices

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

        // Dotted member/attribute access (line.x, transaction.x, dict.get) -
        // not a bare variable read.
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
        if (earliest !== undefined && earliest <= idx) continue; // declared earlier - fine

        if (earliest === undefined) continue; // never assigned anywhere - not this rule's job (would be all-noise without a real symbol table)

        const startPos = doc.positionAt(idx);
        const endPos = startPos.translate(0, name.length);
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            `'${name}' is read here but isn't assigned until later in this file (line ${doc.positionAt(earliest).line + 1}) - this will read an uninitialized value.`,
            vscode.DiagnosticSeverity.Warning
        );
        diag.code = 'bml-use-before-define';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkUseBeforeDefine, isCommerceFunction };
