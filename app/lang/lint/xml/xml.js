const { makeDiagnostic, findMatchingParenEnd } = require('../best-practices/shared');
const vscode = require('vscode');

// Per XML.md: both functions report failures via a fixed sentinel key in the
// returned BMLDictionary instead of throwing.
const XML_SENTINEL_ERROR_KEYS = {
    readxmlmultiple: 'BM_READXMLMULTIPLE_ERROR',
    readxmlsingle: 'BM_READXMLSINGLE_ERROR',
};

/**
 * Code: bml-readxml-error-key-unchecked  Severity: Warning
 */
function checkXml(cleanText, noStringsText, doc) {
    const diagnostics = [];

    for (const [funcName, errorKey] of Object.entries(XML_SENTINEL_ERROR_KEYS)) {
        const assignRegex = new RegExp(`\\b([A-Za-z_]\\w*)\\s*=\\s*${funcName}\\s*\\(`, 'gi');
        let match;
        while ((match = assignRegex.exec(cleanText)) !== null) {
            const varName = match[1];
            const openParenIndex = match.index + match[0].length - 1;
            const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
            if (closeParenIndex === -1) continue;

            const errorCheckPattern = new RegExp(`\\b(?:get|containskey)\\s*\\(\\s*${varName}\\s*,\\s*["']${errorKey}["']\\s*\\)`, 'i');
            if (errorCheckPattern.test(cleanText)) continue;

            // Only flag when the result is actually consumed (e.g. to read an
            // xpath value back out) - an otherwise-unused result is already
            // covered by bml-unused-variable and doesn't need an error-key
            // check of its own.
            const usedPattern = new RegExp(`\\bget\\s*\\(\\s*${varName}\\s*,`, 'i');
            if (!usedPattern.test(cleanText)) continue;

            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Safety Warning: '${varName}' (${funcName}() result) is never checked for the "${errorKey}" error key. ${funcName}() reports failures via this dictionary entry instead of throwing, per XML.md - check containskey(${varName}, "${errorKey}") before using the result.`,
                vscode.DiagnosticSeverity.Warning,
                'bml-readxml-error-key-unchecked'
            ));
        }
    }

    return diagnostics;
}

module.exports = { checkXml };
