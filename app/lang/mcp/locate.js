const fs = require('fs');
const path = require('path');
const config = require('@/lang/rest/config');
const metadataLib = require('@/lang/rest/metadata');
const foldersLib = require('@/lang/rest/folders');

const AI_FILE_SUFFIX = '_ai';
const LEGACY_AI_FOLDER_SUFFIX = '-AI';

// Pulled functions land at cpq-<instanceName>/util-libraries or cpq/commerce-libraries
// (or legacy <pullFolder>/.../<variableName>/<variableName>.bml),
// so finding one by name means walking the standardized folders and fallbacks.
function findLocalBmlPath(vscode, variableName) {
    if (typeof vscode === 'string') {
        variableName = vscode;
        vscode = undefined;
    }
    const v = (vscode && vscode.workspace) ? vscode : (config.getConfigContext()?.vscode || (() => { try { return require('vscode'); } catch (_) { return null; } })());
    const workspaceFolders = v?.workspace?.workspaceFolders;
    const wsRoot = (workspaceFolders && workspaceFolders.length > 0) ? workspaceFolders[0].uri.fsPath : process.cwd();
    const settings = config.getSettings(v);

    const searchRoots = [
        path.join(wsRoot, 'cpq'),
        path.join(wsRoot, config.getCommerceLibrariesFolder(v)),
        path.join(wsRoot, config.getUtilLibrariesFolder(v))
    ];

    try {
        const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && /^cpq-/i.test(entry.name)) {
                searchRoots.push(path.join(wsRoot, entry.name, 'util-libraries'));
                searchRoots.push(path.join(wsRoot, entry.name));
            }
        }
    } catch {}

    const legacyRoot = path.join(wsRoot, settings.pullFolder || 'library');
    if (!searchRoots.includes(legacyRoot)) {
        searchRoots.push(legacyRoot);
    }

    for (const root of searchRoots) {
        if (fs.existsSync(root)) {
            const found = searchDir(root, variableName, 8);
            if (found) return found;
        }
    }
    return null;
}

function searchDir(dir, variableName, depthLeft) {
    if (depthLeft <= 0 || typeof variableName !== 'string') return null;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return null;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'backup' || entry.name.endsWith(LEGACY_AI_FOLDER_SUFFIX)) continue;
        const full = path.join(dir, entry.name);
        if (entry.name === variableName || entry.name.toLowerCase() === variableName.toLowerCase()) {
            let candidate = path.join(full, `${variableName}.bml`);
            if (fs.existsSync(candidate)) return candidate;
            candidate = path.join(full, `${entry.name}.bml`);
            if (fs.existsSync(candidate)) return candidate;
        }
        const nested = searchDir(full, variableName, depthLeft - 1);
        if (nested) return nested;
    }
    return null;
}

// AI copy sits right next to the canonical file, e.g. concatString/concatString_ai.bml
// alongside concatString/concatString.bml - no separate folder needed.
function aiCopyPathFor(canonicalBmlPath, variableName) {
    return path.join(path.dirname(canonicalBmlPath), `${variableName}${AI_FILE_SUFFIX}.bml`);
}

// Older pulls kept the AI copy in a sibling "<variableName>-AI" folder instead. Recognized
// so in-progress edits made there before this change aren't orphaned or double-copied.
function legacyAiCopyPathFor(canonicalBmlPath, variableName) {
    const canonicalDir = path.dirname(canonicalBmlPath);
    const legacyDir = path.join(path.dirname(canonicalDir), `${variableName}${LEGACY_AI_FOLDER_SUFFIX}`);
    return path.join(legacyDir, `${variableName}.bml`);
}

function getMirrorPath(wsRoot, filePath, targetScope) {
    const rel = path.relative(wsRoot, filePath);
    const matchModify = rel.match(/^(cpq[/\\][^/\\]+)[/\\](?:modify|modified)[/\\](.*)$/i);
    if (matchModify) {
        return path.join(wsRoot, matchModify[1], targetScope, matchModify[2]);
    }
    const matchRoot = rel.match(/^(cpq[/\\][^/\\]+)[/\\](?!backup|modify|modified)(.*)$/i);
    if (matchRoot) {
        return path.join(wsRoot, matchRoot[1], targetScope, matchRoot[2]);
    }
    return null;
}

// Creates a pristine backup in cpq/<site>/backup/...
// before the AI modifies the function for the first time.
function createFirstTimeBackup(vscode, canonicalBmlPath, variableName) {
    try {
        const v = (vscode && vscode.workspace) ? vscode : (config.getConfigContext()?.vscode || (() => { try { return require('vscode'); } catch (_) { return null; } })());
        const workspaceFolders = v?.workspace?.workspaceFolders;
        const wsRoot = (workspaceFolders && workspaceFolders.length > 0) ? workspaceFolders[0].uri.fsPath : process.cwd();

        let backupBmlPath = getMirrorPath(wsRoot, canonicalBmlPath, 'backup');
        if (!backupBmlPath) {
            const inferred = metadataLib.inferCommerceFromPath(canonicalBmlPath);
            const type = inferred ? 'process' : 'util';
            const proc = inferred ? inferred.commerceProcess : '';
            const relBackupDir = foldersLib.getBackupFolder(v, type, proc, config.getBaseUrl);
            backupBmlPath = path.join(wsRoot, relBackupDir, variableName, `${variableName}.bml`);
        }

        const backupDir = path.dirname(backupBmlPath);
        fs.mkdirSync(backupDir, { recursive: true });

        if (!fs.existsSync(backupBmlPath)) {
            fs.copyFileSync(canonicalBmlPath, backupBmlPath);
            const canonicalMetaPath = metadataLib.bmlPathToMetaPath(canonicalBmlPath);
            if (fs.existsSync(canonicalMetaPath)) {
                fs.copyFileSync(canonicalMetaPath, metadataLib.bmlPathToMetaPath(backupBmlPath));
            }
        }
        return backupBmlPath;
    } catch (e) {
        return null;
    }
}

// MCP tools edit the AI working copy, never the canonical pulled file, so the original
// stays a pristine diff baseline and re-pulling never clobbers AI edits.
function findOrCreateAiCopy(vscode, variableName, options) {
    if (typeof vscode === 'string') {
        if (typeof variableName === 'object' && variableName !== null) {
            options = variableName;
        }
        variableName = vscode;
        vscode = undefined;
    }
    const canonicalBmlPath = findLocalBmlPath(vscode, variableName);
    if (!canonicalBmlPath) return null;

    const legacyAiPath = legacyAiCopyPathFor(canonicalBmlPath, variableName);
    if (fs.existsSync(legacyAiPath)) return legacyAiPath;

    const aiBmlPath = aiCopyPathFor(canonicalBmlPath, variableName);
    if (fs.existsSync(aiBmlPath)) return aiBmlPath;

    if (options && options.createIfMissing === false) {
        return fs.existsSync(canonicalBmlPath) ? canonicalBmlPath : null;
    }

    createFirstTimeBackup(vscode, canonicalBmlPath, variableName);
    fs.copyFileSync(canonicalBmlPath, aiBmlPath);

    const canonicalMetaPath = metadataLib.bmlPathToMetaPath(canonicalBmlPath);
    if (fs.existsSync(canonicalMetaPath)) {
        fs.copyFileSync(canonicalMetaPath, metadataLib.bmlPathToMetaPath(aiBmlPath));
    }
    return aiBmlPath;
}

// Discards the AI working copy (whichever scheme it currently lives under - new same-folder
// _ai.bml or a legacy -AI sibling folder) and its meta.json sidecar, then recreates a fresh copy
// from canonical. Used when in-progress AI edits need a clean restart. Recreation always lands
// on the new same-folder scheme, even if the discarded copy was a legacy one.
function resetAiCopy(vscode, variableName) {
    if (typeof vscode === 'string' && !variableName) {
        variableName = vscode;
        vscode = undefined;
    }
    const canonicalBmlPath = findLocalBmlPath(vscode, variableName);
    if (!canonicalBmlPath) return null;

    for (const aiPath of [legacyAiCopyPathFor(canonicalBmlPath, variableName), aiCopyPathFor(canonicalBmlPath, variableName)]) {
        if (fs.existsSync(aiPath)) {
            fs.unlinkSync(aiPath);
            const metaPath = metadataLib.bmlPathToMetaPath(aiPath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        }
    }

    return findOrCreateAiCopy(vscode, variableName);
}

module.exports = { findLocalBmlPath, findOrCreateAiCopy, resetAiCopy, createFirstTimeBackup, getMirrorPath };
