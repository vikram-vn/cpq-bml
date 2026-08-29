const fs = require('fs');
const path = require('path');
const { vscode, makeDiagnostic } = require('./shared');

/**
 * Util/Commerce Library functions cannot self-reference: per
 * app/knowledge/BML/Library_Functions.md, "Recursive calling of the same
 * Util and Commerce Library functions will fail and result in a compilation
 * error when called at any point in the reference chain." Detects a
 * function calling itself by name via util.<name>(...) / commerce.<name>(...)
 * (optionally through a folder segment, e.g. util.<folder>.<name>(...)).
 *
 * Code: bml-self-reference
 */
// This check runs on every debounced keystroke, so avoid hitting disk every
// time - a function's own -meta.json sidecar essentially never changes
// mid-edit. Cache by file path, keyed on the sidecar's mtime (a cheap
// fs.statSync) so a real change (e.g. re-pulling metadata) still invalidates
// the cache without needing a file watcher wired through this deeply-nested
// check.
const ownNameCache = new Map(); // bmlFilePath -> { metaMtimeMs, ownName }

function readOwnFunctionName(bmlFilePath) {
    if (!bmlFilePath) return null;
    const metaPath = bmlFilePath.replace(/\.bml$/i, '-meta.json');

    let metaMtimeMs = null;
    try {
        metaMtimeMs = fs.statSync(metaPath).mtimeMs;
    } catch (e) {
        // no sidecar yet - fall through to filename-based inference below
    }

    const cached = ownNameCache.get(bmlFilePath);
    if (cached && cached.metaMtimeMs === metaMtimeMs) {
        return cached.ownName;
    }

    let ownName = null;
    if (metaMtimeMs !== null) {
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta && meta.variableName) ownName = meta.variableName;
        } catch (e) {
            // fall through to filename-based inference
        }
    }
    if (!ownName) {
        // Every function pulled into the workspace names its .bml file after
        // its own variableName - fall back to that when there's no sidecar yet.
        ownName = path.basename(bmlFilePath, '.bml');
    }

    ownNameCache.set(bmlFilePath, { metaMtimeMs, ownName });
    return ownName;
}

function checkSelfReference(cleanText, noStringsText, doc) {
    const diagnostics = [];
    const bmlFilePath = doc.uri && doc.uri.fsPath;
    const ownName = readOwnFunctionName(bmlFilePath);
    if (!ownName) return diagnostics;

    const selfCallRegex = new RegExp(`\\b(util|commerce)\\.(?:\\w+\\.)?(${ownName})\\s*\\(`, 'gi');
    let match;
    while ((match = selfCallRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length - 1); // exclude the trailing '('
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Compile Error: Util and Commerce Library functions cannot self-reference. This call to '${match[1]}.${match[2]}' recursively calls the function it's defined in, which will fail to compile.`,
            vscode.DiagnosticSeverity.Error,
            'bml-self-reference'
        ));
    }

    return diagnostics;
}

module.exports = { checkSelfReference };
