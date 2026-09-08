const fs = require('fs');
const path = require('path');

const AI_EXCLUDE_GLOBS = [
    '**/.agents',
    '**/.claude',
    '**/.cursor',
    '**/.cursorrules',
    '**/CLAUDE.md',
    '**/.github/instructions',
    '**/.github/copilot-instructions.md',
];

/**
 * Synchronizes VS Code's files.exclude setting to show or hide AI tool configuration
 * files and directories in the explorer.
 *
 * @param {object} vscode The VS Code API object
 * @param {boolean} hide Whether AI files should be hidden (true) or visible (false)
 */
async function syncFilesExclude(vscode, hide) {
    if (!vscode || !vscode.workspace) return;
    try {
        const config = vscode.workspace.getConfiguration('files');
        const currentExclude = Object.assign({}, config.get('exclude') || {});
        let changed = false;

        for (const pattern of AI_EXCLUDE_GLOBS) {
            if (hide) {
                if (currentExclude[pattern] !== true) {
                    currentExclude[pattern] = true;
                    changed = true;
                }
            } else {
                if (currentExclude[pattern] === true) {
                    delete currentExclude[pattern];
                    changed = true;
                }
            }
        }

        if (changed) {
            const target = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                ? (vscode.ConfigurationTarget && vscode.ConfigurationTarget.Workspace) || 2
                : (vscode.ConfigurationTarget && vscode.ConfigurationTarget.Global) || 1;
            await config.update('exclude', currentExclude, target);
        }
    } catch (err) {
        console.warn('CPQ-BML: Failed to sync files.exclude for AI tool files:', err);
    }
}

/**
 * Removes all scaffolded AI skill/instruction directories and files from the workspace root.
 *
 * @param {string} root Workspace root directory path
 * @returns {string[]} List of cleaned items
 */
function cleanAllAiWorkspaceFiles(root) {
    if (!root || !fs.existsSync(root)) return [];
    const removed = [];

    const dirsToDelete = [
        path.join(root, '.agents'),
        path.join(root, '.claude'),
        path.join(root, '.cursor'),
        path.join(root, '.github', 'instructions'),
    ];

    const filesToDelete = [
        path.join(root, 'CLAUDE.md'),
        path.join(root, '.cursorrules'),
        path.join(root, '.github', 'copilot-instructions.md'),
    ];

    for (const dir of dirsToDelete) {
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
                removed.push(path.basename(dir) + '/');
            } catch (e) {
                console.warn(`CPQ-BML: Failed to remove ${dir}:`, e);
            }
        }
    }

    for (const file of filesToDelete) {
        if (fs.existsSync(file)) {
            try {
                fs.rmSync(file, { force: true });
                removed.push(path.basename(file));
            } catch (e) {
                console.warn(`CPQ-BML: Failed to remove ${file}:`, e);
            }
        }
    }

    // Clean up parent .github if empty
    const gh = path.join(root, '.github');
    try {
        if (fs.existsSync(gh) && fs.readdirSync(gh).length === 0) {
            fs.rmdirSync(gh);
        }
    } catch (e) {}

    return removed;
}

/**
 * Removes .agents/skills/ and .agents/skills.json, and cleans up .agents if empty.
 *
 * @param {string} root Workspace root directory
 */
function removeAgentSkills(root) {
    if (!root) return;
    const skillsDir = path.join(root, '.agents', 'skills');
    const skillsJson = path.join(root, '.agents', 'skills.json');
    const agentsDir = path.join(root, '.agents');

    if (fs.existsSync(skillsDir)) {
        try { fs.rmSync(skillsDir, { recursive: true, force: true }); } catch (e) {}
    }
    if (fs.existsSync(skillsJson)) {
        try { fs.rmSync(skillsJson, { force: true }); } catch (e) {}
    }
    try {
        if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length === 0) {
            fs.rmdirSync(agentsDir);
        }
    } catch (e) {}
}

module.exports = {
    AI_EXCLUDE_GLOBS,
    syncFilesExclude,
    cleanAllAiWorkspaceFiles,
    removeAgentSkills,
};
