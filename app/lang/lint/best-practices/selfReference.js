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
function readOwnFunctionName(bmlFilePath) {
    if (!bmlFilePath) return null;
    try {
        const metaPath = bmlFilePath.replace(/\.bml$/i, '-meta.json');
        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta && meta.variableName) return meta.variableName;
        }
    } catch (e) {
        // fall through to filename-based inference
    }
    // Every function pulled into the workspace names its .bml file after its
    // own variableName - fall back to that when there's no sidecar yet.
    return path.basename(bmlFilePath, '.bml');
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
