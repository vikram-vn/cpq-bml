const fs = require('fs');
const path = require('path');
const config = require('../rest/config');
const metadataLib = require('../rest/metadata');

const AI_COPY_SUFFIX = '-AI';

// Every pull command (util or commerce) writes functions under
// <pullFolder>/.../<variableName>/<variableName>.bml - regardless of the
// folder/commerceProcess/commerceDocument segments above it. So finding a
// function by name alone just means walking the pull folder for a directory
// named <variableName> containing <variableName>.bml.
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

// Given the canonical (pulled) .bml path .../groupDiscount/groupDiscount.bml,
// returns the sibling AI working copy path .../groupDiscount-AI/groupDiscount.bml -
// same filename, just a "-AI" suffixed folder next to the original.
function aiCopyPathFor(canonicalBmlPath, variableName) {
    const canonicalDir = path.dirname(canonicalBmlPath);
    const aiDir = path.join(path.dirname(canonicalDir), `${variableName}${AI_COPY_SUFFIX}`);
    return path.join(aiDir, `${variableName}.bml`);
}

// MCP tools never edit the pulled (canonical) copy directly - they always
// work against a sibling "<variableName>-AI" copy instead, so the original
// pulled file stays untouched as a pristine baseline a human can diff
// against. The AI copy is created once (cloning the canonical .bml and its
// -meta.json sidecar) and left alone on every subsequent call - re-pulling
// refreshes the canonical copy, never the AI copy, so it never clobbers
// in-progress AI edits.
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
