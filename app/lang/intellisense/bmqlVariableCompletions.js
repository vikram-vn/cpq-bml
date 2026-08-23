const vscode = require('vscode');

/**
 * Scans document for local variable declarations before position.
 */
function collectLocalVariables(document, position) {
    const vars = [];
    const seen = new Set();
    const lineLimit = Math.min(position.line, document.lineCount);

    const declRegex = /\b(?:String|Integer|Float|Boolean|Date|Json|JsonArray|Dictionary|RecordSet|StringBuilder)\s+([a-zA-Z_]\w*)\b|\b([a-zA-Z_]\w*)\s*=/g;

    for (let i = 0; i < lineLimit; i++) {
        const text = document.lineAt(i).text;
        const commentIdx = text.indexOf('//');
        const codeText = commentIdx !== -1 ? text.substring(0, commentIdx) : text;

        let match;
        while ((match = declRegex.exec(codeText)) !== null) {
            const varName = match[1] || match[2];
            if (varName && !seen.has(varName) && !['if', 'elif', 'else', 'for', 'while', 'return', 'print'].includes(varName)) {
                seen.add(varName);
                vars.push({ name: varName, line: i });
            }
        }
    }
    return vars;
}

/**
 * Resolves local variable suggestions when typing '$' in BMQL strings or BML script.
 * Applies VS Code Locality Bonus sortText ranking based on distance to cursor.
 */
function getBmqlVariableCompletions(document, position) {
    const lineText = document.lineAt(position.line).text;
    const prefix = lineText.substring(0, position.character);

    if (!/\$([a-zA-Z_]\w*)?$/.test(prefix)) return [];

    const localVars = collectLocalVariables(document, position);
    return localVars.map(v => {
        const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.Variable);
        item.detail = `BMQL Substitution Variable ($${v.name})`;
        item.documentation = new vscode.MarkdownString(`Substitutes \`$${v.name}\` into the BMQL query string.`);
        item.insertText = v.name;
        
        // Locality Bonus: Sort variables closest to the cursor line first
        const lineDistance = Math.abs(position.line - v.line);
        item.sortText = `0_${String(lineDistance).padStart(4, '0')}_${v.name}`;
        
        return item;
    });
}

module.exports = { collectLocalVariables, getBmqlVariableCompletions };
