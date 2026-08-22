const vscode = require('vscode');

/**
 * Finds the range of the string literal at the current cursor position if present.
 */
function getQuotedStringRange(document, position) {
    const lineText = document.lineAt(position).text;
    const col = position.character;

    let quoteChar = null;
    let quoteStart = -1;

    for (let i = col - 1; i >= 0; i--) {
        const ch = lineText[i];
        if (ch === '"' || ch === "'") {
            let backslashCount = 0;
            let j = i - 1;
            while (j >= 0 && lineText[j] === '\\') {
                backslashCount++;
                j--;
            }
            if (backslashCount % 2 === 0) {
                quoteChar = ch;
                quoteStart = i;
                break;
            }
        }
        if (ch === ',' || ch === '(') {
            break;
        }
    }

    if (quoteStart === -1) {
        return { hasQuote: false, range: new vscode.Range(position, position), quoteChar: '"' };
    }

    let quoteEnd = -1;
    for (let i = quoteStart + 1; i < lineText.length; i++) {
        if (lineText[i] === quoteChar) {
            let backslashCount = 0;
            let j = i - 1;
            while (j >= 0 && lineText[j] === '\\') {
                backslashCount++;
                j--;
            }
            if (backslashCount % 2 === 0) {
                quoteEnd = i;
                break;
            }
        }
    }

    if (quoteEnd !== -1) {
        return {
            hasQuote: true,
            range: new vscode.Range(position.line, quoteStart, position.line, quoteEnd + 1),
            quoteChar
        };
    } else {
        return {
            hasQuote: true,
            range: new vscode.Range(position.line, quoteStart, position.line, lineText.length),
            quoteChar
        };
    }
}

/**
 * Helper to build completion items with quote handling.
 */
function buildStringParamItems(items, document, position) {
    const quoteInfo = getQuotedStringRange(document, position);
    const quote = quoteInfo.quoteChar || '"';

    return items.map(entry => {
        const item = new vscode.CompletionItem(entry.name, entry.kind || vscode.CompletionItemKind.Value);
        item.detail = entry.detail || entry.name;
        if (entry.doc) {
            item.documentation = new vscode.MarkdownString(entry.doc);
        }
        item.insertText = `${quote}${entry.insertText || entry.name}${quote}`;
        item.filterText = `${quote}${entry.name}${quote} ${entry.name}`;
        if (quoteInfo.hasQuote) {
            item.range = quoteInfo.range;
        }
        return item;
    });
}

module.exports = {
    getQuotedStringRange,
    buildStringParamItems
};
