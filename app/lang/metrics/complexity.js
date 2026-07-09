/**
 * Complexity Calculator
 *
 * Computes code quality metrics for a single BML file:
 *  - cyclomaticComplexity: number of decision points + 1
 *  - nestingDepth: maximum brace nesting depth
 *  - lineCount: total non-empty, non-comment lines
 */

function computeComplexity(text) {
    const lines = text.split(/\r?\n/);

    // Strip single-line and block comments for analysis
    let stripped = text;
    // Remove block comments
    stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
    // Remove line comments
    stripped = stripped.replace(/\/\/[^\n]*/g, '');

    // Cyclomatic complexity: count decision keywords
    const decisionRegex = /\b(if|elif|for|and|or)\b/gi;
    let decisionCount = 0;
    let m;
    while ((m = decisionRegex.exec(stripped)) !== null) {
        decisionCount++;
    }
    const cyclomaticComplexity = decisionCount + 1;

    // Maximum nesting depth
    let currentDepth = 0;
    let maxDepth = 0;
    for (const ch of stripped) {
        if (ch === '{') {
            currentDepth++;
            if (currentDepth > maxDepth) maxDepth = currentDepth;
        } else if (ch === '}') {
            currentDepth = Math.max(0, currentDepth - 1);
        }
    }

    // Non-empty, non-comment line count
    let codeLines = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
            codeLines++;
        }
    }

    return {
        cyclomaticComplexity,
        nestingDepth: maxDepth,
        lineCount: lines.length,
        codeLines,
    };
}

module.exports = { computeComplexity };
