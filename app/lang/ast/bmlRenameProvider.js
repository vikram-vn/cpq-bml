/**
 * BML Rename Provider (F2)
 * Provides safe symbol renaming across BML scripts.
 * Strictly maintains under 500 lines of code.
 */

const vscode = require("vscode");
const { BmlLexer, TokenType } = require("./bmlLexer");

class BmlRenameProvider {
  prepareRename(document, position) {
    const range = document.getWordRangeAtPosition(position);
    if (!range) {
      throw new Error("Cannot rename: no symbol found at position.");
    }

    const word = document.getText(range);
    const text = document.getText();
    const lexer = new BmlLexer(text);
    const tokens = lexer.tokenize();

    // Check if word at position is an identifier
    const targetToken = tokens.find(
      (t) =>
        t.line === position.line + 1 &&
        position.character + 1 >= t.column &&
        position.character + 1 <= t.column + t.value.length
    );

    if (!targetToken || targetToken.type !== TokenType.IDENTIFIER) {
      throw new Error("You can only rename variables, parameters, and function symbols.");
    }

    return range;
  }

  provideRenameEdits(document, position, newName) {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return null;

    const oldName = document.getText(range);
    const text = document.getText();
    const lexer = new BmlLexer(text);
    const tokens = lexer.tokenize();

    const workspaceEdit = new vscode.WorkspaceEdit();

    // Find all matching identifier tokens that are exact word matches (not comments or strings)
    for (const token of tokens) {
      if (token.type === TokenType.IDENTIFIER && token.value === oldName) {
        const line = token.line - 1;
        const startChar = token.column - 1;
        const endChar = startChar + token.value.length;
        const targetRange = new vscode.Range(line, startChar, line, endChar);
        workspaceEdit.replace(document.uri, targetRange, newName);
      }
    }

    return workspaceEdit;
  }
}

function registerRenameProvider(context) {
  const provider = new BmlRenameProvider();
  const selector = [{ language: "bml" }, { pattern: "**/*.util" }];
  context.subscriptions.push(
    vscode.languages.registerRenameProvider(selector, provider)
  );
}

module.exports = {
  BmlRenameProvider,
  registerRenameProvider,
};
