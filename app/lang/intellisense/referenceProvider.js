const vscode = require('vscode');
const fs = require('fs');
const { resolveCallAtPosition } = require('@/lang/intellisense/workspaceIndex');

const BML_KEYWORDS = new Set([
  'if', 'else', 'elif', 'while', 'for', 'return', 'break', 'continue',
  'true', 'false', 'null', 'bmql', 'select', 'from', 'where', 'and', 'or',
  'string', 'integer', 'float', 'boolean', 'date', 'dict', 'jsonarray',
  'jsonobject', 'stringbuilder', 'recordset'
]);

function createReferenceProvider() {
  return {
    async provideReferences(document, position, contextOptions, token) {
      if (token && token.isCancellationRequested) return [];
      if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
        return [];
      }

      // 1. Cross-file util.* / commerce.* references
      const call = resolveCallAtPosition(document, position);
      if (call) {
        const pattern = new RegExp(`\\b${call.prefix}\\.${call.name}\\b`, 'g');
        const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
        const locations = [];
        for (const uri of uris) {
          if (token && token.isCancellationRequested) return [];
          let text;
          try { text = fs.readFileSync(uri.fsPath, 'utf8'); } catch { continue; }
          const lines = text.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            let m;
            pattern.lastIndex = 0;
            while ((m = pattern.exec(lines[i])) !== null) {
              locations.push(new vscode.Location(
                uri,
                new vscode.Range(i, m.index, i, m.index + m[0].length)
              ));
            }
          }
        }
        return locations;
      }

      // 2. Local variable / symbol references in active document
      const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
      if (!wordRange) return [];
      const word = document.getText(wordRange);
      if (BML_KEYWORDS.has(word.toLowerCase())) return [];

      const pattern = new RegExp(`\\b${word}\\b`, 'g');
      const locations = [];
      const lineCount = document.lineCount;
      for (let i = 0; i < lineCount; i++) {
        const lineText = document.lineAt(i).text;
        let m;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(lineText)) !== null) {
          locations.push(new vscode.Location(
            document.uri,
            new vscode.Range(i, m.index, i, m.index + m[0].length)
          ));
        }
      }
      return locations;
    }
  };
}

module.exports = { createReferenceProvider };
