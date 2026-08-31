const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { getExtensionId } = require('../extensionHelper.js');

const AI_SKILLS_KEYS = ['claude', 'cursor', 'copilot'];

// Sets cpqBml.mcp.aiSkills.<key> for each key present in overrides (Global
// scope, matching how the settings webview itself writes these), runs fn(),
// then restores whatever value was there before - including clearing back to
// "unset" (letting package.json's schema default apply) for keys that had no
// override to begin with.
async function withAiSkillsConfig(overrides, fn) {
    const config = vscode.workspace.getConfiguration('cpqBml');
    const previous = {};
    for (const key of AI_SKILLS_KEYS) {
        previous[key] = config.get(`mcp.aiSkills.${key}`);
    }

    try {
        for (const [key, value] of Object.entries(overrides)) {
            await config.update(`mcp.aiSkills.${key}`, value, vscode.ConfigurationTarget.Global);
        }
        await fn();
    } finally {
        for (const key of AI_SKILLS_KEYS) {
            await config.update(`mcp.aiSkills.${key}`, previous[key], vscode.ConfigurationTarget.Global);
        }
    }
}

// Sets up a fresh fake context + mock global storage dir under a unique
// folder name (so tests never see each other's decompressed skills), and
// returns the paths every native-target assertion needs, plus a cleanup().
function setupFakeContext(subDirName, workspaceRoot) {
    const extension = vscode.extensions.getExtension(getExtensionId());
    const mockGlobalStoragePath = path.join(__dirname, subDirName);
    fs.rmSync(mockGlobalStoragePath, { recursive: true, force: true });
    fs.mkdirSync(mockGlobalStoragePath, { recursive: true });

    const fakeContext = {
        extensionPath: extension.extensionPath,
        globalStorageUri: { fsPath: mockGlobalStoragePath },
        extension,
    };
    const expectedStorageDir = path.join(mockGlobalStoragePath, 'ai_skills_v' + extension.packageJSON.version);
    const skillsJsonPath = path.join(workspaceRoot, '.agents', 'skills.json');
    const claudeSkillsDir = path.join(workspaceRoot, '.claude', 'skills');
    const agentsSkillsDir = path.join(workspaceRoot, '.agents', 'skills');
    const cursorRulesDir = path.join(workspaceRoot, '.cursor', 'rules');
    const copilotInstructionsDir = path.join(workspaceRoot, '.github', 'instructions');
    const claudePath = path.join(workspaceRoot, 'CLAUDE.md');
    const copilotPath = path.join(workspaceRoot, '.github', 'copilot-instructions.md');
    const cursorPath = path.join(workspaceRoot, '.cursorrules');

    const cleanup = () => {
        fs.rmSync(claudeSkillsDir, { recursive: true, force: true });
        fs.rmSync(path.join(workspaceRoot, '.agents'), { recursive: true, force: true });
        fs.rmSync(cursorRulesDir, { recursive: true, force: true });
        fs.rmSync(copilotInstructionsDir, { recursive: true, force: true });
        fs.rmSync(claudePath, { force: true });
        fs.rmSync(copilotPath, { force: true });
        fs.rmSync(cursorPath, { force: true });
        fs.rmSync(mockGlobalStoragePath, { recursive: true, force: true });
    };
    // .agents/skills.json's parent (.agents) is shared with .agents/skills/,
    // so clear both before each run to avoid cross-test contamination.
    fs.rmSync(path.join(workspaceRoot, '.agents'), { recursive: true, force: true });

    return { fakeContext, expectedStorageDir, skillsJsonPath, claudeSkillsDir, agentsSkillsDir, cursorRulesDir, copilotInstructionsDir, cleanup };
}

module.exports = {
    AI_SKILLS_KEYS,
    withAiSkillsConfig,
    setupFakeContext
};
