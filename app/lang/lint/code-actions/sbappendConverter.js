'use strict';

const vscode = require('vscode');

/**
 * Converts an HTML/JS template string snippet into BML sbappend() statements.
 */
function convertTextToSbappend(text, sbVarName = 'sb') {
  if (!text || typeof text !== 'string') return '';

  let clean = text.trim();
  // Strip variable declaration like: const html = `...`; or let s = "...";
  clean = clean.replace(/^(?:let|const|var)\s+\w+\s*=\s*/, '');
  if ((clean.startsWith('`') && clean.endsWith('`')) ||
      (clean.startsWith('"') && clean.endsWith('"') && clean.includes('\n'))) {
    clean = clean.slice(1, -1);
  }

  const lines = clean.split(/\r?\n/);
  const outputLines = [];

  for (let line of lines) {
    if (!line.trim()) {
      outputLines.push(`sbappend(${sbVarName}, "\\n");`);
      continue;
    }

    // Parse ${...} tokens
    const parts = [];
    let lastIdx = 0;
    const regex = /\$\{([^}]+)\}/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const literalPart = line.substring(lastIdx, match.index);
      if (literalPart) {
        const escaped = literalPart.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        parts.push(`"${escaped}"`);
      }
      const expr = match[1].trim();
      if (/^[a-zA-Z_]\w*$/.test(expr)) {
        parts.push(`string(${expr})`);
      } else {
        parts.push(`string(${expr})`);
      }
      lastIdx = regex.lastIndex;
    }

    const tailPart = line.substring(lastIdx);
    if (tailPart) {
      const escaped = tailPart.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      parts.push(`"${escaped}"`);
    }

    if (parts.length === 1 && parts[0].startsWith('"') && parts[0].endsWith('"')) {
      outputLines.push(`sbappend(${sbVarName}, ${parts[0]});`);
    } else if (parts.length > 0) {
      outputLines.push(`sbappend(${sbVarName}, ${parts.join(', ')});`);
    }
  }

  return outputLines.join('\n');
}

/**
 * Generates a CodeAction if the selection contains HTML or template strings.
 */
function getSbappendConvertCodeActions(document, range) {
  const actions = [];
  const selectedText = document.getText(range);
  if (!selectedText || !selectedText.trim()) return actions;

  const hasHtml = /<[a-zA-Z\/][^>]*>/.test(selectedText);
  const hasTemplate = /\$\{[^}]+\}/.test(selectedText) || selectedText.includes('`');

  if (hasHtml || hasTemplate) {
    const converted = convertTextToSbappend(selectedText);
    const action = new vscode.CodeAction(
      'Convert selected JS/HTML template to BML sbappend() statements',
      vscode.CodeActionKind.RefactorRewrite
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, range, converted);
    actions.push(action);
  }

  return actions;
}

module.exports = {
  convertTextToSbappend,
  getSbappendConvertCodeActions,
};
