const fs = require('fs');
const path = require('path');
const config = require('../rest/config');
const metadataLib = require('../rest/metadata');

const AI_COPY_SUFFIX = '-AI';

// Pulled functions always land at <pullFolder>/.../<variableName>/<variableName>.bml,
// so finding one by name means walking the pull folder for that directory.
function findLocalBmlPath(vscode, variableName) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return null;
    const settings = config.getSettings(vscode);
    const root = path.join(workspaceFolders[0].uri.fsPath, settings.pullFolder);
    return searchDir(root, variableName, 8);
}

function searchDir(dir, variableName, depthLeft) {
    if (depthLeft <= 0) return null;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return null;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const full = path.join(dir, entry.name);
        if (entry.name === variableName) {
            const candidate = path.join(full, `${variableName}.bml`);
            if (fs.existsSync(candidate)) return candidate;
        }
        const nested = searchDir(full, variableName, depthLeft - 1);
        if (nested) return nested;
    }
    return null;
}

function aiCopyPathFor(canonicalBmlPath, variableName) {
    const canonicalDir = path.dirname(canonicalBmlPath);
    const aiDir = path.join(path.dirname(canonicalDir), `${variableName}${AI_COPY_SUFFIX}`);
    return path.join(aiDir, `${variableName}.bml`);
}

// MCP tools edit the sibling "<variableName>-AI" copy, never the canonical pulled file,
// so the original stays a pristine diff baseline and re-pulling never clobbers AI edits.
function findOrCreateAiCopy(vscode, variableName) {
    const canonicalBmlPath = findLocalBmlPath(vscode, variableName);
    if (!canonicalBmlPath) return null;

    const aiBmlPath = aiCopyPathFor(canonicalBmlPath, variableName);
    if (!fs.existsSync(aiBmlPath)) {
        fs.mkdirSync(path.dirname(aiBmlPath), { recursive: true });
        fs.copyFileSync(canonicalBmlPath, aiBmlPath);

        const canonicalMetaPath = metadataLib.bmlPathToMetaPath(canonicalBmlPath);
        if (fs.existsSync(canonicalMetaPath)) {
            fs.copyFileSync(canonicalMetaPath, metadataLib.bmlPathToMetaPath(aiBmlPath));
        }
    }
    return aiBmlPath;
}

module.exports = { findLocalBmlPath, findOrCreateAiCopy };
