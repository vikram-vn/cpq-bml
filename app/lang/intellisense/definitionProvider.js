const vscode = require('vscode');
const { resolveCallAtPosition, getWorkspaceIndex } = require('./workspaceIndex');

const BML_TYPES = new Set([
  'string', 'integer', 'float', 'boolean', 'date', 'dict',
  'jsonarray', 'jsonobject', 'stringbuilder', 'recordset'
]);

function findLocalDefinition(document, word, currentLine) {
  if (!word || /^(if|else|elif|while|for|return|break|continue|true|false|null|bmql)$/i.test(word)) {
    return null;
  }
  const wordRegex = new RegExp(`\\b(?:(string|integer|float|boolean|date|dict|jsonarray|jsonobject|stringbuilder|recordset)\\s+)?(${word})\\b`, 'i');

  // Search from current line backwards to find the declaration
  for (let i = currentLine; i >= 0; i--) {
    const text = document.lineAt(i).text;
    const match = wordRegex.exec(text);
    if (match) {
      const isAssignment = new RegExp(`\\b${word}\\s*=[^=]`).test(text);
      const hasType = match[1] && BML_TYPES.has(match[1].toLowerCase());
      if (hasType || isAssignment) {
        const col = text.indexOf(word);
        return new vscode.Location(document.uri, new vscode.Position(i, Math.max(0, col)));
      }
    }
  }
  return null;
}

function createDefinitionProvider() {
  return {
    provideDefinition(document, position, token) {
      if (token && token.isCancellationRequested) return null;
      if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
        return null;
      }

      // 1. Cross-file util.* / commerce.* calls
      const call = resolveCallAtPosition(document, position);
      if (call) {
        const entry = getWorkspaceIndex().get(call.qualifiedName);
        if (entry) {
          const uri = vscode.Uri.file(entry.filePath);
          return new vscode.Location(uri, new vscode.Position(entry.line, 0));
        }
      }

      // 2. Local variable / parameter declaration
      const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
      if (wordRange) {
        const word = document.getText(wordRange);
        return findLocalDefinition(document, word, position.line);
      }

      return null;
    }
  };
}

module.exports = { createDefinitionProvider, findLocalDefinition };
