const fs = require('fs');
const bml_beautify = require('../../beautify/bml');
const optionsProvider = require('../../beautify/options');
const { findOrCreateAiCopy } = require('../locate');

/**
 * format_bml
 *
 * Beautifies the local AI working copy's current file content (reindents, normalizes spacing)
 * using the same formatter behind the editor's own "Format Document" command, and writes the
 * result back to that file - useful right before save_function/validate_function, after the AI
 * has edited the .bml file directly.
 */
async function formatBmlFunction(context, vscode, args) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const bmlPath = findOrCreateAiCopy(vscode, variableName);
    if (!bmlPath) {
        return { success: false, variableName, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    let originalText;
    try {
        originalText = fs.readFileSync(bmlPath, 'utf8');
    } catch (e) {
        return { success: false, variableName, error: `Cannot read file: ${e.message}` };
    }

    const cfg = await optionsProvider({ uri: vscode.Uri.file(bmlPath) }, { tabSize: 4 });
    let formattedText;
    try {
        formattedText = bml_beautify(originalText, cfg);
    } catch (e) {
        return { success: false, variableName, error: `Formatting failed: ${e.message}` };
    }

    const changed = formattedText !== originalText;
    if (changed) {
        fs.writeFileSync(bmlPath, formattedText, 'utf8');
    }

    return { success: true, variableName, filePath: bmlPath, changed, formattedText };
}

module.exports = { formatBmlFunction };
