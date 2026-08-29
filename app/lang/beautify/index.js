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

// Computes the minimal TextEdit required to transform currentText into formatted,
// avoiding whole-document buffer replacement, unnecessary redraws, and save latency.
function computeMinimalEdits(document, formatted, range) {
    const currentText = range ? document.getText(range) : document.getText();
    if (currentText === formatted) {
        return [];
    }

    const baseOffset = range ? document.offsetAt(range.start) : 0;

    // Find common prefix
    let start = 0;
    const minLen = Math.min(currentText.length, formatted.length);
    while (start < minLen && currentText.charCodeAt(start) === formatted.charCodeAt(start)) {
        start++;
    }

    // Find common suffix
    let endCurrent = currentText.length - 1;
    let endFormatted = formatted.length - 1;
    while (
        endCurrent >= start &&
        endFormatted >= start &&
        currentText.charCodeAt(endCurrent) === formatted.charCodeAt(endFormatted)
    ) {
        endCurrent--;
        endFormatted--;
    }

    const startPos = document.positionAt(baseOffset + start);
    const endPos = document.positionAt(baseOffset + endCurrent + 1);
    const replacement = formatted.slice(start, endFormatted + 1);

    return [vscode.TextEdit.replace(new vscode.Range(startPos, endPos), replacement)];
}

// Register the beautifier
function registerBeautifier(context) {
    const selector = 'bml';

    // Full document formatting
    const fullDisposable = vscode.languages.registerDocumentFormattingEditProvider(selector, {
        async provideDocumentFormattingEdits(document, options, token) {
            if (token && token.isCancellationRequested) return [];
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.beautifier', true)) {
                return [];
            }
            const currentText = document.getText();
            const formatted = await beautifyText(currentText, document, options);
            if (token && token.isCancellationRequested) return [];
            return computeMinimalEdits(document, formatted);
        }
    });

    // Selected range formatting
    const rangeDisposable = vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
        async provideDocumentRangeFormattingEdits(document, range, options, token) {
            if (token && token.isCancellationRequested) return [];
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.beautifier', true)) {
                return [];
            }
            const selectedText = document.getText(range);
            const formatted = await beautifyText(selectedText, document, options);
            if (token && token.isCancellationRequested) return [];
            return computeMinimalEdits(document, formatted, range);
        }
    });

    context.subscriptions.push(fullDisposable, rangeDisposable);
}

module.exports = { registerBeautifier, computeMinimalEdits };
