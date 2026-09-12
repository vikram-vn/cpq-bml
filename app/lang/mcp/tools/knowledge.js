const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { findOrCreateAiCopy } = require('@/lang/mcp/locate');
let _lintBMLCustom = null;
function getLintBMLCustom() {
    if (!_lintBMLCustom) {
        _lintBMLCustom = require('@/lang/lint/core/lint').lintBMLCustom;
    }
    return _lintBMLCustom;
}
const configLib = require('@/lang/rest/config');
const metadataLib = require('@/lang/rest/metadata');
const { computeComplexity } = require('@/lang/metrics/complexity');

// Builds the minimal doc-like object lintBMLCustom() needs, from a file already
// read off disk - the same shape test/linter/fixtures.js uses to lint text
// directly without a real open editor document.
function lintFileText(vscode, extensionPath, bmlPath, text) {
    const lineOffsets = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') lineOffsets.push(i + 1);
    }
    const doc = {
        languageId: 'bml',
        getText: () => text,
        positionAt: (idx) => {
            let low = 0, high = lineOffsets.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (lineOffsets[mid] <= idx) low = mid + 1;
                else high = mid - 1;
            }
            const line = high;
            const character = idx - lineOffsets[line];
            return new vscode.Position(line, character);
        },
        uri: vscode.Uri.file(bmlPath),
    };
    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    const lintFn = getLintBMLCustom();
    lintFn(doc, collection, vscode, extensionPath);
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

// explain_function: Returns structured documentation for a locally pulled BML function.
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
    const baseName = path.basename(bmlPath, '.bml').replace(/-AI$/i, '').replace(/_ai$/i, '');
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

const { diffFunction, computeLineDiff } = require('@/lang/mcp/tools/diff');

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
 * function's AI working copy and returns its diagnostics. No CPQ connection or
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

// Recurses into the pull folder looking for canonical <name>/<name>.bml files - a .bml file
// whose basename matches its parent folder's name exactly. That pattern is unique to canonical
// files: an AI copy is either <name>/<name>_ai.bml (basename carries the _ai suffix) or, under
// the legacy scheme, <name>-AI/<name>.bml (parent folder carries the -AI suffix instead) -
// either way the names don't match, so both copies are skipped automatically.
function collectCanonicalBmlFiles(dir, results, depthLeft) {
    if (depthLeft <= 0) return;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectCanonicalBmlFiles(full, results, depthLeft - 1);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.bml')) {
            if (path.basename(entry.name, '.bml') === path.basename(dir)) {
                results.push(full);
            }
        }
    }
}

/**
 * list_local_functions
 *
 * Enumerates every function already pulled locally (from the configured pull folder), without
 * needing to already know a variableName - useful for getting oriented in a workspace an AI
 * hasn't seen before, instead of guessing names for explain_function/lint_function.
 */
async function listLocalFunctions(context, vscode) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return { success: false, error: 'No workspace folder is open.' };
    }
    const wsRoot = workspaceFolders[0].uri.fsPath;
    const settings = configLib.getSettings(vscode);

    const searchRoots = [
        path.join(wsRoot, 'cpq'),
        path.join(wsRoot, configLib.getCommerceLibrariesFolder(vscode)),
        path.join(wsRoot, configLib.getUtilLibrariesFolder(vscode))
    ];

    try {
        const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && /^cpq-/i.test(entry.name)) {
                searchRoots.push(path.join(wsRoot, entry.name, 'util-libraries'));
            }
        }
    } catch {}

    const legacyRoot = path.join(wsRoot, settings.pullFolder || 'library');
    if (!searchRoots.includes(legacyRoot)) {
        searchRoots.push(legacyRoot);
    }

    const canonicalPaths = [];
    for (const root of searchRoots) {
        if (fs.existsSync(root)) {
            collectCanonicalBmlFiles(root, canonicalPaths, 10);
        }
    }
    const uniqueCanonicalPaths = Array.from(new Set(canonicalPaths));

    const functions = uniqueCanonicalPaths.map((bmlPath) => {
        const variableName = metadataLib.variableNameFromBmlPath(bmlPath);
        const meta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(bmlPath)) || {};
        return {
            variableName,
            name: meta.name || variableName,
            type: meta.commerceDocument ? 'commerce' : 'util',
            commerceProcess: meta.commerceProcess,
            commerceDocument: meta.commerceDocument,
            canonicalPath: bmlPath,
        };
    });

    return { success: true, count: functions.length, functions };
}

/**
 * lint_all_functions
 *
 * Runs lint_function across every locally pulled function and returns an aggregate summary
 * (total error/warning counts, worst offenders) alongside each function's full diagnostics -
 * a workspace-wide health check instead of one function at a time.
 */
async function lintAllFunctions(context, vscode) {
    const listing = await listLocalFunctions(context, vscode);
    if (!listing.success) return listing;

    const results = [];
    for (const fn of listing.functions) {
        const lintResult = await lintFunction(context, vscode, { variableName: fn.variableName });
        if (!lintResult.success) {
            results.push({ variableName: fn.variableName, success: false, error: lintResult.error });
            continue;
        }
        const errorCount = lintResult.diagnostics.filter((d) => d.severity === 'Error').length;
        const warningCount = lintResult.diagnostics.filter((d) => d.severity === 'Warning').length;
        results.push({
            variableName: fn.variableName,
            success: true,
            errorCount,
            warningCount,
            diagnostics: lintResult.diagnostics,
        });
    }

    const totalErrors = results.reduce((sum, r) => sum + (r.errorCount || 0), 0);
    const totalWarnings = results.reduce((sum, r) => sum + (r.warningCount || 0), 0);
    const worstOffenders = results
        .filter((r) => (r.errorCount || 0) + (r.warningCount || 0) > 0)
        .sort((a, b) => (b.errorCount + b.warningCount) - (a.errorCount + a.warningCount))
        .slice(0, 10)
        .map((r) => ({ variableName: r.variableName, errorCount: r.errorCount, warningCount: r.warningCount }));

    return {
        success: totalErrors === 0,
        functionCount: results.length,
        totalErrors,
        totalWarnings,
        worstOffenders,
        results,
    };
}

/**
 * Lists all built-in Oracle CPQ and BML AI skills with their metadata.
 */
function listSkills(context) {
    const extensionPath = context && context.extensionPath ? context.extensionPath : path.resolve(__dirname, '..', '..', '..', '..');
    const skillsDir = path.join(extensionPath, 'app', 'ai', 'skills');
    if (!fs.existsSync(skillsDir)) {
        return { success: true, skills: [] };
    }
    const skills = [];
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillName = entry.name;
        const skillMd = path.join(skillsDir, skillName, 'SKILL.md');
        let description = '';
        if (fs.existsSync(skillMd)) {
            try {
                const content = fs.readFileSync(skillMd, 'utf8');
                const descMatch = content.match(/description:\s*(?:>-\s*|\s*)([^\r\n]+)/i);
                if (descMatch) description = descMatch[1].trim();
            } catch (e) {}
        }
        const refsDir = path.join(skillsDir, skillName, 'references');
        const hasReferences = fs.existsSync(refsDir) && fs.readdirSync(refsDir).length > 0;
        skills.push({
            name: skillName,
            description: description || `Oracle CPQ BigMachines ${skillName} skill`,
            hasReferences,
        });
    }
    return { success: true, skills };
}

/**
 * Fetches the full instructions and reference documents for a specific CPQ/BML skill.
 */
function getSkill(context, { name } = {}) {
    if (!name || typeof name !== 'string') {
        return { success: false, error: 'Skill name is required (e.g. "bml-language", "bml-pitfalls", "cpq-domain", "cpq-rest-api")' };
    }
    const safeName = name.trim().toLowerCase();
    const extensionPath = context && context.extensionPath ? context.extensionPath : path.resolve(__dirname, '..', '..', '..', '..');
    const skillDir = path.join(extensionPath, 'app', 'ai', 'skills', safeName);
    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
        return { success: false, error: `Skill "${safeName}" not found. Call list_skills to see all available skills.` };
    }
    let content = '';
    let description = '';
    try {
        content = fs.readFileSync(skillMd, 'utf8');
        const descMatch = content.match(/description:\s*(?:>-\s*|\s*)([^\r\n]+)/i);
        if (descMatch) description = descMatch[1].trim();
    } catch (err) {
        return { success: false, error: `Failed to read skill ${safeName}: ${err.message}` };
    }
    const references = [];
    const refsDir = path.join(skillDir, 'references');
    if (fs.existsSync(refsDir)) {
        try {
            for (const f of fs.readdirSync(refsDir)) {
                const refPath = path.join(refsDir, f);
                if (fs.statSync(refPath).isFile()) {
                    references.push({
                        filename: f,
                        content: fs.readFileSync(refPath, 'utf8'),
                    });
                }
            }
        } catch (e) {}
    }
    return {
        success: true,
        name: safeName,
        description,
        content,
        references,
    };
}

module.exports = {
    explainFunction,
    diffFunction,
    searchFunctions,
    lintFunction,
    getFunctionMetrics,
    listLocalFunctions,
    lintAllFunctions,
    computeLineDiff,
    listSkills,
    getSkill,
};
