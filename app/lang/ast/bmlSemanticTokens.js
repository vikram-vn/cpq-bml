/**
 * BML Semantic Tokens Provider
 * Provides rich semantic coloring for BML tokens based on AST classification.
 * Strictly maintains under 500 lines of code.
 */

const vscode = require("vscode");
const { BmlLexer, TokenType } = require("./bmlLexer");

const tokenTypesLegend = [
  "type",
  "function",
  "variable",
  "parameter",
  "property",
  "keyword",
  "string",
  "number",
  "operator",
];

const tokenModifiersLegend = [
  "declaration",
  "documentation",
  "readonly",
  "defaultLibrary",
];

const legend = new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);

const BML_TYPES = new Set([
  "string", "integer", "float", "boolean", "dict", "json", "jsonarray",
  "stringbuilder", "date", "filecontent", "user", "group", "hierarchy"
]);

const BUILTIN_FUNCTIONS = new Set([
  "print", "put", "get", "remove", "keys", "values", "containskey",
  "lower", "upper", "substring", "len", "find", "replace", "split",
  "round", "floor", "ceil", "abs", "sqrt", "power", "formatascurrency",
  "jsonget", "jsonput", "jsonarrayget", "jsonarrayappend",
  "urldata", "urldatabypost", "bmqlexecute", "recordset", "atof", "atoi"
]);

class BmlSemanticTokensProvider {
  provideDocumentSemanticTokens(document) {
    const builder = new vscode.SemanticTokensBuilder(legend);
    const text = document.getText();
    const lexer = new BmlLexer(text);
    const tokens = lexer.tokenize();

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === TokenType.EOF || token.type === TokenType.COMMENT) {
        continue;
      }

      const zeroLine = Math.max(0, token.line - 1);
      const zeroChar = Math.max(0, token.column - 1);
      const length = token.value.length;

      if (token.type === TokenType.KEYWORD) {
        if (BML_TYPES.has(token.value.toLowerCase())) {
          builder.push(zeroLine, zeroChar, length, 0, 0); // "type"
        } else {
          builder.push(zeroLine, zeroChar, length, 5, 0); // "keyword"
        }
      } else if (token.type === TokenType.IDENTIFIER) {
        const next = tokens[i + 1];
        const prev = tokens[i - 1];

        // Function call: identifier followed by "("
        if (next && next.value === "(") {
          const isBuiltin = BUILTIN_FUNCTIONS.has(token.value.toLowerCase());
          const modifier = isBuiltin ? 1 << 3 : 0; // defaultLibrary
          builder.push(zeroLine, zeroChar, length, 1, modifier); // "function"
        }
        // Member property: preceded by "."
        else if (prev && prev.value === ".") {
          builder.push(zeroLine, zeroChar, length, 4, 0); // "property"
        }
        // Variable
        else {
          builder.push(zeroLine, zeroChar, length, 2, 0); // "variable"
        }
      } else if (token.type === TokenType.NUMBER) {
        builder.push(zeroLine, zeroChar, length, 7, 0); // "number"
      } else if (token.type === TokenType.OPERATOR) {
        builder.push(zeroLine, zeroChar, length, 8, 0); // "operator"
      }
    }

    return builder.build();
  }
}

function registerSemanticTokens(context) {
  const provider = new BmlSemanticTokensProvider();
  const selector = [{ language: "bml" }, { pattern: "**/*.util" }];
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend)
  );
}

module.exports = {
  legend,
  tokenTypesLegend,
  tokenModifiersLegend,
  BmlSemanticTokensProvider,
  registerSemanticTokens,
};
