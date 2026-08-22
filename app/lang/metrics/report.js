const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { computeComplexity } = require('./complexity');

// Collects metrics and diagnostic counts for all *.bml files in the workspace.
async function buildWorkspaceReport(diagnosticCollection) {
    const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
    const files = [];

    for (const uri of uris) {
        let text;
        try { text = fs.readFileSync(uri.fsPath, 'utf8'); } catch { continue; }

        const metrics = computeComplexity(text);

        // Get diagnostic counts from the active diagnostic collection
        const diags = diagnosticCollection ? (diagnosticCollection.get(uri) || []) : [];
        const errorCount = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
        const warningCount = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
        const infoCount = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Information).length;

        // Group diagnostics by code/category
        const byCode = {};
        for (const d of diags) {
            const key = d.code || 'uncategorized';
            byCode[key] = (byCode[key] || 0) + 1;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        let relPath = uri.fsPath;
        for (const folder of workspaceFolders) {
            if (uri.fsPath.startsWith(folder.uri.fsPath)) {
                relPath = path.relative(folder.uri.fsPath, uri.fsPath);
                break;
            }
        }

        files.push({
            path: uri.fsPath,
            relativePath: relPath.replace(/\\/g, '/'),
            metrics,
            errorCount,
            warningCount,
            infoCount,
            byCode,
        });
    }

    // Sort: most errors first, then by complexity
    files.sort((a, b) => {
        if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
        return b.metrics.cyclomaticComplexity - a.metrics.cyclomaticComplexity;
    });

    return files;
}

module.exports = { buildWorkspaceReport };
