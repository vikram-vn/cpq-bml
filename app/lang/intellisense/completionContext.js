const vscode = require('vscode');

/**
 * Adapts completion items based on line context.
 * If an opening parenthesis '(' follows the cursor (e.g. `(json, "key");`),
 * function/method completion items will ONLY insert the method name, preventing
 * duplicated parentheses and placeholder syntax holders from overwriting or colliding
 * with existing code.
 *
 * Example:
 * (json, "key"); -> typing 'json' before '(' and picking 'jsonget' produces:
 * jsonget(json, "key");
 * instead of jsonget(jsonIdentifier, key)(json, "key");
 */
function adaptCompletionsForLineContext(items, document, position) {
    if (!items || !Array.isArray(items) || items.length === 0) return items;

    const lineText = document.lineAt(position).text;
    const lineSuffix = lineText.substring(position.character);
    const parenMatch = lineSuffix.match(/^(\s*)\(/);

    if (!parenMatch) {
        return items;
    }

    const trailingSpacesCount = parenMatch[1].length;
    const wordRange = document.getWordRangeAtPosition(position);

    return items.map((item) => {
        let snippetVal = null;
        if (item.insertText instanceof vscode.SnippetString) {
            snippetVal = item.insertText.value;
        } else if (typeof item.insertText === 'string') {
            snippetVal = item.insertText;
        }

        const hasParenInInsert = snippetVal && snippetVal.includes('(');
        const isFunctionLike = item.kind === vscode.CompletionItemKind.Function ||
                               item.kind === vscode.CompletionItemKind.Method ||
                               item.kind === vscode.CompletionItemKind.Snippet ||
                               hasParenInInsert;

        if (!isFunctionLike) {
            return item;
        }

        // Extract pure method name without parameters or parentheses
        let methodName = null;
        if (snippetVal) {
            const m = snippetVal.match(/^([a-zA-Z_][\w.]*)\s*\(/);
            if (m) methodName = m[1];
        }
        if (!methodName) {
            const rawLabel = typeof item.label === 'string' ? item.label : (item.label && item.label.label) || '';
            const m = rawLabel.match(/^([a-zA-Z_][\w.]*)/);
            methodName = m ? m[1] : rawLabel;
        }

        if (!methodName) return item;

        // If the line prefix before the current word already ends with a dot (e.g. CPQJS. or util.),
        // ensure we only insert the member name after the dot to avoid duplicating the namespace prefix.
        const linePrefix = lineText.substring(0, position.character);
        const dotMatch = linePrefix.match(/([a-zA-Z_][\w.]*)\.\s*[\w_]*$/);
        if (dotMatch && methodName.includes('.')) {
            const prefix = dotMatch[1].toLowerCase();
            if (methodName.toLowerCase().startsWith(prefix + '.')) {
                methodName = methodName.substring(prefix.length + 1);
            }
        }

        // Clone item to avoid mutating shared cached completion items
        const clone = Object.assign(new vscode.CompletionItem(item.label, item.kind), item);
        clone.insertText = methodName;

        if (trailingSpacesCount > 0 && wordRange) {
            clone.range = new vscode.Range(wordRange.start, position.translate(0, trailingSpacesCount));
        }

        return clone;
    });
}

module.exports = { adaptCompletionsForLineContext };
