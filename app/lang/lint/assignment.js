const vscode = require('vscode');

// A lone '=' inside an if/elif condition is virtually always a typo for '==' - BML has
// no C-style assignment-expression idiom. Runs on noStringsText so a literal '=' inside
// a string like `if (label == "a=b")` is never mistaken for one.
function checkAssignmentInCondition(noStringsText, conditionRanges, doc) {
    const diagnostics = [];
    // Matches a bare '=' not part of '==', '<=', '>=', '<>' or '!='.
    const assignRegex = /([^=!<>])=(?!=)/g;

    for (const [start, end] of conditionRanges) {
        const segment = noStringsText.slice(start, end);
        assignRegex.lastIndex = 0;
        let match;
        while ((match = assignRegex.exec(segment)) !== null) {
            const absoluteIndex = start + match.index + match[1].length;
            const startPos = doc.positionAt(absoluteIndex);
            const endPos = startPos.translate(0, 1);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                "Assignment '=' inside a condition - did you mean '==' for comparison?",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-assignment-in-condition';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkAssignmentInCondition };
