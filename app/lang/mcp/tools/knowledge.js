const fs = require('fs');
const path = require('path');
const { findOrCreateAiCopy } = require('../locate');
const { lintBMLCustom } = require('../../lint/lint');
const { computeComplexity } = require('../../metrics/complexity');

// Builds the minimal doc-like object lintBMLCustom() needs, from a file already
// read off disk - the same shape test/linter/fixtures.js uses to lint text
// directly without a real open editor document.
function lintFileText(vscode, extensionPath, bmlPath, text) {
    const doc = {
        languageId: 'bml',
        getText: () => text,
        positionAt: (idx) => {
            const lines = text.slice(0, idx).split(/\r?\n/);
            return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
        uri: vscode.Uri.file(bmlPath),
    };
    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    lintBMLCustom(doc, collection, vscode, extensionPath);
    return diagnostics;
}

function severityLabel(vscode, severity) {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error: return 'Error';
        case vscode.DiagnosticSeverity.Warning: return 'Warning';
        case vscode.DiagnosticSeverity.Information: return 'Information';
        default: return 'Hint';
    }
}

/**
 * explain_function
 *
 * Returns structured documentation for a locally pulled BML function:
 * the docHeader block comment, first 50 code lines, parameter list,
 * and return type sourced from the -meta.json sidecar.
 * Works fully offline — no CPQ REST call required.
 */
async function explainFunction(context, vscode, args) {
    const { variableName } = args || {};
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const bmlPath = findOrCreateAiCopy(vscode, variableName, { createIfMissing: false });
    if (!bmlPath) {
        return { success: false, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    let text;
    try { text = fs.readFileSync(bmlPath, 'utf8'); } catch (e) {
        return { success: false, error: `Cannot read file: ${e.message}` };
    }

    // Extract docHeader block comment
    const blockMatch = text.match(/\/\*[\s\S]*?(?:Function Name:|Description:)[\s\S]*?\*\//i);
    const docHeader = blockMatch
        ? blockMatch[0].replace(/^\/\*+\s*/m, '').replace(/\s*\*+\/$/m, '').replace(/^\s*\*\s?/gm, '').trim()
        : '';

    // First 50 non-comment, non-empty lines as code preview
    const codeLines = text.split(/\r?\n/)
        .filter(l => { const t = l.trim(); return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); })
        .slice(0, 50)
        .join('\n');

    // Read sidecar
    const baseName = path.basename(bmlPath, '.bml').replace(/-AI$/, '');
    const metaPath = path.join(path.dirname(bmlPath), baseName + '-meta.json');
    let parameters = [], returnType = '';
    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        parameters = (meta.params || meta.parameters || []).map(p => ({
            name: p.name || p.variableName || '',
            dataType: p.dataType || p.type || '',
        }));
        returnType = meta.returnType || meta.returnDataType || '';
    } catch { /* sidecar optional */ }

    return {
        success: true,
        variableName,
        filePath: bmlPath,
        docHeader,
        codePreview: codeLines,
        parameters,
        returnType,
    };
}

/**
 * diff_function
 *
 * Compares the local AI copy of a function against its remote CPQ version.
 * Pulls the remote content into memory (does NOT overwrite local files),
 * then returns a line-by-line unified diff.
 */
async function diffFunction(context, vscode, args) {
    const { variableName, type = 'util' } = args || {};
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const bmlPath = findOrCreateAiCopy(vscode, variableName, { createIfMissing: false });
    if (!bmlPath) {
        return { success: false, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    let localText;
    try { localText = fs.readFileSync(bmlPath, 'utf8'); } catch (e) {
        return { success: false, error: `Cannot read local file: ${e.message}` };
    }

    // Fetch remote content
    let remoteText;
    try {
        const api = require('../../rest/api');
        const cfg = vscode.workspace.getConfiguration('cpqBml');
        const baseUrl = cfg.get('connection.siteUrl', '');
        if (!baseUrl) return { success: false, error: 'No CPQ site URL configured.' };

        if (type === 'util') {
            const resp = await api.getUtilFunction(context, vscode, variableName);
            remoteText = resp && resp.scriptText ? resp.scriptText : '';
        } else {
            return { success: false, error: 'diff_function currently supports util functions only.' };
        }
    } catch (e) {
        return { success: false, error: `Failed to fetch remote: ${e.message}` };
    }

    // Compute line diff
    const localLines = localText.split(/\r?\n/);
    const remoteLines = remoteText.split(/\r?\n/);
    const diffLines = computeLineDiff(remoteLines, localLines);

    const added = diffLines.filter(l => l.startsWith('+')).length;
    const removed = diffLines.filter(l => l.startsWith('-')).length;
    const unchanged = diffLines.filter(l => l.startsWith(' ')).length;

    return {
        success: true,
        variableName,
        added,
        removed,
        unchanged,
        diffText: diffLines.join('\n'),
    };
}

/**
 * Naive line-by-line diff (LCS-based).
 * Returns lines prefixed with '+', '-', or ' '.
 */
function computeLineDiff(oldLines, newLines) {
    // Build LCS table
    const m = oldLines.length, n = newLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = oldLines[i - 1] === newLines[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    // Backtrack
    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.unshift(' ' + oldLines[i - 1]); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift('+' + newLines[j - 1]); j--;
        } else {
            result.unshift('-' + oldLines[i - 1]); i--;
        }
    }
    return result;
}

/**
 * search_functions
 *
 * Full-text search across all locally pulled *.bml files.
 * Returns matches sorted by match count descending.
 */
async function searchFunctions(context, vscode, args) {
    const { query, type = 'both' } = args || {};
    if (!query) return { success: false, error: 'query is required.' };

    const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
    const results = [];
    const queryLower = query.toLowerCase();

    for (const uri of uris) {
        const filePath = uri.fsPath;
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Filter by type
        if (type === 'util' && !/\/library\/|\/util\//i.test(normalizedPath)) continue;
        if (type === 'commerce' && !/\/commerce\//i.test(normalizedPath)) continue;

        let text;
        try { text = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

        const lines = text.split(/\r?\n/);
        let matchCount = 0;
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
                matchCount++;
                matches.push({ lineNumber: i + 1, line: lines[i].trim() });
            }
        }

        if (matchCount > 0) {
            const baseName = path.basename(filePath, '.bml');
            results.push({
                variableName: baseName,
                filePath,
                matchCount,
                matches: matches.slice(0, 10), // cap at 10 sample lines
            });
        }
    }

    results.sort((a, b) => b.matchCount - a.matchCount);

    return {
        success: true,
        query,
        totalFiles: results.length,
        results,
    };
}

/**
 * lint_function
 *
 * Runs the extension's own local BML linter against a locally pulled
 * function's "-AI" copy and returns its diagnostics. No CPQ connection or
 * round trip to Oracle's compiler needed - much faster than
 * validate_function for iterating on a fix, though validate_function is
 * still the authoritative check before saving/deploying.
 */
async function lintFunction(context, vscode, args) {
    const { variableName } = args || {};
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const bmlPath = findOrCreateAiCopy(vscode, variableName);
    if (!bmlPath) {
        return { success: false, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    let text;
    try { text = fs.readFileSync(bmlPath, 'utf8'); } catch (e) {
        return { success: false, error: `Cannot read file: ${e.message}` };
    }

    const diagnostics = lintFileText(vscode, context.extensionPath, bmlPath, text);
    return {
        success: true,
        variableName,
        filePath: bmlPath,
        diagnosticCount: diagnostics.length,
        diagnostics: diagnostics.map((d) => ({
            line: d.range.start.line + 1, // 1-indexed - easier for a human/AI to map back to the file
            severity: severityLabel(vscode, d.severity),
            code: d.code,
            message: d.message,
        })),
    };
}

/**
 * get_function_metrics
 *
 * Code-quality metrics for a locally pulled function: cyclomatic
 * complexity, max nesting depth, line counts, plus a diagnostic-count
 * summary from the same linter lint_function uses. Mirrors what the
 * "CPQ-BML: Open Code Metrics Report" webview shows, scoped to one function.
 */
async function getFunctionMetrics(context, vscode, args) {
    const { variableName } = args || {};
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const bmlPath = findOrCreateAiCopy(vscode, variableName);
    if (!bmlPath) {
        return { success: false, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    let text;
    try { text = fs.readFileSync(bmlPath, 'utf8'); } catch (e) {
        return { success: false, error: `Cannot read file: ${e.message}` };
    }

    const metrics = computeComplexity(text);
    const diagnostics = lintFileText(vscode, context.extensionPath, bmlPath, text);

    const byCode = {};
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    for (const d of diagnostics) {
        const key = d.code || 'uncategorized';
        byCode[key] = (byCode[key] || 0) + 1;
        if (d.severity === vscode.DiagnosticSeverity.Error) errorCount++;
        else if (d.severity === vscode.DiagnosticSeverity.Warning) warningCount++;
        else if (d.severity === vscode.DiagnosticSeverity.Information) infoCount++;
    }

    return {
        success: true,
        variableName,
        filePath: bmlPath,
        metrics,
        errorCount,
        warningCount,
        infoCount,
        byCode,
    };
}

module.exports = { explainFunction, diffFunction, searchFunctions, lintFunction, getFunctionMetrics };
