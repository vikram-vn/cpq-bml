/**
 * BML Code Complexity & Metrics Engine
 */

function computeComplexity(code) {
  if (typeof code !== 'string') {
    return { cyclomaticComplexity: 1, lineCount: 0 };
  }

  const lines = code.split(/\r\n|\r|\n/);
  const lineCount = code.length === 0 ? 0 : lines.length;

  let cyclomaticComplexity = 1;

  // Decision keywords and operators in BML
  // if, elif, for, while, case, &&, ||, AND, OR, ?
  const decisionRegex = /\b(if|elif|for|while|case)\b|&&|\|\||\bAND\b|\bOR\b|\?/gi;

  for (const line of lines) {
    // Strip comments to avoid false positives
    const commentIdx = line.indexOf('//');
    const content = commentIdx !== -1 ? line.substring(0, commentIdx) : line;

    const matches = content.match(decisionRegex);
    if (matches) {
      cyclomaticComplexity += matches.length;
    }
  }

  return {
    cyclomaticComplexity,
    lineCount,
  };
}

module.exports = {
  computeComplexity,
};
