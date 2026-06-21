const vscode = require('vscode');
const beautify = require('./bml');
const optionsProvider = require('./options'); // your options.js

// Get full document range
function getFullDocumentRange(document) {
    const lastLine = document.lineCount - 1;
    return new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);
}

// Beautify text with options
async function beautifyText(text, document, formattingOptions) {
    const config = await optionsProvider(document, formattingOptions);
    return beautify(text, config);
}

// Register the beautifier
function registerBeautifier(context) {
    const selector = { language: 'bml', scheme: 'file' };

    // Full document formatting
    const fullDisposable = vscode.languages.registerDocumentFormattingEditProvider(selector, {
        async provideDocumentFormattingEdits(document, options) {
            const fullRange = getFullDocumentRange(document);
            const formatted = await beautifyText(document.getText(), document, options);
            return [vscode.TextEdit.replace(fullRange, formatted)];
        }
    });

    // Selected range formatting
    const rangeDisposable = vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
        async provideDocumentRangeFormattingEdits(document, range, options) {
            const selectedText = document.getText(range);
            const formatted = await beautifyText(selectedText, document, options);
            return [vscode.TextEdit.replace(range, formatted)];
        }
    });

    context.subscriptions.push(fullDisposable, rangeDisposable);
}

module.exports = { registerBeautifier };
