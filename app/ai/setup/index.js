const fs = require('fs');
const path = require('path');

// (copyDirSync removed, we now use pointers)

// (Removed registerAiSetup since setup is purely automatic on MCP enable)

async function performAiSetup(context, root, pickIds, customizationRoot, skillsSrc, summaryFile, silent = false) {
    const vscode = require('vscode');

    if (!fs.existsSync(skillsSrc)) return;

    const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    const created = [];
    const skipped = [];

    for (const pickId of pickIds) {
        if (pickId === 'agentskills') {
            // Create a pointer file at .agents/skills.json instead of copying files
            const destDir = path.join(root, '.agents');
            const destFile = path.join(destDir, 'skills.json');

            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            try {
                let currentConfig = { entries: [] };
                if (fs.existsSync(destFile)) {
                    try {
                        currentConfig = JSON.parse(fs.readFileSync(destFile, 'utf8'));
                        if (!currentConfig.entries) currentConfig.entries = [];
                    } catch (e) {
                        // If unparseable, start fresh
                    }
                }
                
                // Check if entry already exists
                const alreadyExists = currentConfig.entries.some(entry => entry.path === customizationRoot);
                
                if (!alreadyExists) {
                    currentConfig.entries.push({ path: customizationRoot });
                    fs.writeFileSync(destFile, JSON.stringify(currentConfig, null, 2), 'utf8');
                    created.push('.agents/skills.json');
                } else {
                    skipped.push('.agents/skills.json (already exists)');
                }
            } catch (e) {
                if (!silent) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: Failed to write skills.json: ${e.message}`,
                    );
                }
            }
        } else {
            // For copilot/claude/cursor: write the summary bml-skills.md content
            let relPath;
            if (pickId === 'copilot') {
                relPath = path.join('.github', 'copilot-instructions.md');
            } else if (pickId === 'cursor') {
                relPath = '.cursorrules';
            } else {
                relPath = 'CLAUDE.md';
            }

            const destPath = path.join(root, relPath);
            if (fs.existsSync(destPath) && !silent) {
                const overwrite = await vscode.window.showWarningMessage(
                    `"${relPath}" already exists. Overwrite with BML AI skills?`,
                    'Overwrite',
                    'Skip',
                );
                if (overwrite !== 'Overwrite') {
                    skipped.push(relPath);
                    continue;
                }
            }

            try {
                // For these targets, concatenate all SKILL.md files into one document.
                let content = '';
                if (fs.existsSync(summaryFile)) {
                    content = fs.readFileSync(summaryFile, 'utf8') + '\n\n';
                }
                for (const skillName of skillDirs) {
                    const skillFile = path.join(skillsSrc, skillName, 'SKILL.md');
                    if (fs.existsSync(skillFile)) {
                        let skillContent = fs.readFileSync(skillFile, 'utf8');
                        // Strip YAML frontmatter for the merged document
                        skillContent = skillContent.replace(/^---[\s\S]*?---\s*\n/, '');
                        content += skillContent + '\n\n';
                    }
                }

                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.writeFileSync(destPath, content.trim() + '\n', 'utf8');
                created.push(relPath);
            } catch (e) {
                if (!silent) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: Failed to write ${relPath}: ${e.message}`,
                    );
                }
            }
        }
    }

    const parts = [];
    if (created.length > 0) parts.push(`Created: ${created.join(', ')}`);
    if (skipped.length > 0) parts.push(`Skipped: ${skipped.join(', ')}`);

    if (parts.length > 0 && !silent) {
        vscode.window.showInformationMessage(`CPQ-BML AI Skills: ${parts.join(' | ')}`);
    }
}

async function autoSetupAiSkills(context) {
    const vscode = require('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;
    const root = workspaceFolders[0].uri.fsPath;

    // 1. Determine storage paths
    const extensionVersion = context.extension.packageJSON.version;
    const aiStorageDir = path.join(context.globalStorageUri.fsPath, 'ai_skills_v' + extensionVersion);
    const skillsSrc = path.join(aiStorageDir, 'skills');
    const summaryFile = path.join(aiStorageDir, 'bml-skills.md');

    // 2. Decompress if needed
    if (!fs.existsSync(aiStorageDir)) {
        const brPath = path.join(context.extensionPath, 'dist', 'ai.br');
        if (fs.existsSync(brPath)) {
            const zlib = require('zlib');
            try {
                const brData = fs.readFileSync(brPath);
                const jsonStr = zlib.brotliDecompressSync(brData).toString('utf8');
                const payload = JSON.parse(jsonStr);

                fs.mkdirSync(aiStorageDir, { recursive: true });

                for (const [relPath, content] of Object.entries(payload)) {
                    const dest = path.join(aiStorageDir, relPath);
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    fs.writeFileSync(dest, content, 'utf8');
                }
            } catch (err) {
                console.error('CPQ-BML: Failed to decompress AI skills:', err);
                return;
            }
        } else {
            console.warn('CPQ-BML: dist/ai.br not found in extension.');
            return;
        }
    }

    // 3. Setup skills using extracted files
    await performAiSetup(context, root, ['agentskills', 'claude', 'copilot', 'cursor'], aiStorageDir, skillsSrc, summaryFile, true);
}

module.exports = { autoSetupAiSkills };
