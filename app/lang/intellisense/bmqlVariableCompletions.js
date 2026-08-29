let vscode;
try {
    vscode = require('vscode');
} catch {
    vscode = {};
}

const KEYWORDS_AND_TYPES = new Set([
    'if', 'elif', 'else', 'for', 'while', 'return', 'print', 'throwerror',
    'true', 'false', 'null', 'string', 'integer', 'float', 'boolean',
    'date', 'dict', 'json', 'jsonarray', 'recordset', 'stringbuilder', 'bmql'
]);

/**
 * Strips string literals and line comments from code text to prevent false brace counting.
 */
function sanitizeCodeText(text) {
    let code = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (ch === stringChar && text[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (ch === '/' && text[i + 1] === '/') {
                break; // Line comment
            } else if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
            } else {
                code += ch;
            }
        }
    }
    return code;
}

/**
 * Checks if cursor position is to the right of an assignment '=' or 'in' operator where varName is being defined.
 */
function isCursorOnRhsOfCurrentLineDecl(lineText, matchIndex, cursorChar) {
    if (lineText.includes(';')) {
        return false;
    }
    const textFromMatch = lineText.substring(matchIndex);
    const opMatch = textFromMatch.match(/=|\bin\b/);
    if (!opMatch) return false;

    const opEndIndex = matchIndex + opMatch.index + opMatch[0].length;
    return cursorChar >= opEndIndex;
}

/**
 * Scans document for local variable declarations before cursor position,
 * strictly filtering out variables that have fallen out of scope or are currently
 * being defined on the LHS of the active line's assignment statement.
 */
function collectLocalVariables(document, position) {
    let lines;
    if (typeof document.getText === 'function') {
        const textChunk = document.getText(new vscode.Range(0, 0, position.line + 1, 0));
        lines = textChunk.split(/\r?\n/);
    } else if (typeof document.lineAt === 'function') {
        lines = [];
        const limit = typeof document.lineCount === 'number' ? Math.min(position.line + 1, document.lineCount) : position.line + 1;
        for (let i = 0; i < limit; i++) {
            lines.push(document.lineAt(i).text);
        }
    } else {
        lines = [];
    }
    const lineLimit = Math.min(position.line + 1, lines.length);
    let nextBlockId = 0;
    
    const activeBlockStack = [{ id: 0, depth: 0, startLine: 0 }];
    const allVars = [];
    const priorDeclaredVars = new Set();

    const declRegex = /\b(?:String|Integer|Float|Boolean|Date|Json|JsonArray|Dictionary|RecordSet|StringBuilder)\s+([a-zA-Z_]\w*)\b|\bfor\s+([a-zA-Z_]\w*)\s+in\b|\b([a-zA-Z_]\w*)\s*=/g;

    for (let i = 0; i < lineLimit; i++) {
        const isTargetLine = (i === position.line);
        const fullLineText = lines[i] || '';
        const codeText = sanitizeCodeText(fullLineText);

        // Process brace depth changes token by token on the line
        for (let c = 0; c < (isTargetLine ? Math.min(position.character, codeText.length) : codeText.length); c++) {
            const char = codeText[c];
            if (char === '{') {
                nextBlockId++;
                const parentBlock = activeBlockStack[activeBlockStack.length - 1];
                activeBlockStack.push({ id: nextBlockId, depth: parentBlock.depth + 1, startLine: i });
            } else if (char === '}') {
                if (activeBlockStack.length > 1) {
                    activeBlockStack.pop();
                }
            }
        }

        const currentBlock = activeBlockStack[activeBlockStack.length - 1];

        let match;
        declRegex.lastIndex = 0;
        while ((match = declRegex.exec(codeText)) !== null) {
            const varName = match[1] || match[2] || match[3];
            if (varName && !KEYWORDS_AND_TYPES.has(varName.toLowerCase())) {
                const varType = match[1] ? codeText.substring(match.index, codeText.indexOf(varName, match.index)).trim() : null;
                
                // If on target line, do not suggest the variable if the cursor is actively typing the RHS of an incomplete declaration
                if (isTargetLine && !priorDeclaredVars.has(varName)) {
                    if (isCursorOnRhsOfCurrentLineDecl(fullLineText, match.index, position.character)) {
                        continue;
                    }
                }

                allVars.push({
                    name: varName,
                    type: varType,
                    line: i,
                    blockId: currentBlock.id,
                    depth: currentBlock.depth
                });

                if (i < position.line) {
                    priorDeclaredVars.add(varName);
                }
            }
        }
    }

    // Determine set of block IDs that are active at the cursor position
    const activeBlockIdsAtCursor = new Set(activeBlockStack.map(b => b.id));

    // Filter variables to only those whose enclosing block is currently active at cursor
    const activeVars = [];
    const seen = new Set();

    // Iterate backwards so nearest declarations take precedence
    for (let i = allVars.length - 1; i >= 0; i--) {
        const v = allVars[i];
        if (activeBlockIdsAtCursor.has(v.blockId) && !seen.has(v.name)) {
            seen.add(v.name);
            activeVars.push(v);
        }
    }

    return activeVars.reverse();
}

/**
 * Resolves local variable suggestions when typing '$' in BMQL strings or BML script.
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
        
        const lineDistance = Math.abs(position.line - v.line);
        item.sortText = `0_${String(lineDistance).padStart(4, '0')}_${v.name}`;
        
        return item;
    });
}

/**
 * Resolves general local variable suggestions for standard BML code completion.
 * Applies VS Code Locality Bonus sortText ranking based on distance to cursor.
 */
function getLocalVariableCompletions(document, position) {
    const localVars = collectLocalVariables(document, position);
    return localVars.map(v => {
        const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.Variable);
        item.detail = v.type ? `Local ${v.type}` : 'Local Variable';
        item.documentation = new vscode.MarkdownString(`Local variable \`${v.name}\` defined in current scope (line ${v.line + 1}).`);
        item.insertText = v.name;
        
        const lineDistance = Math.abs(position.line - v.line);
        item.sortText = `0_${String(lineDistance).padStart(4, '0')}_${v.name}`;
        
        return item;
    });
}

module.exports = { collectLocalVariables, getBmqlVariableCompletions, getLocalVariableCompletions };
