const fs = require('fs');
const path = require('path');

// Recursively copies a directory tree, creating target dirs as needed.
function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function registerAiSetup(context) {
    const vscode = require('vscode');

    context.subscriptions.push(
        vscode.commands.registerCommand('cpqBml.ai.setupWorkspaceSkills', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('CPQ-BML: No workspace folder is open.');
                return;
            }
            const root = workspaceFolders[0].uri.fsPath;

            // The shipped skills live inside the extension's install directory.
            const skillsSrc = path.join(context.extensionPath, 'app', 'ai', 'skills');
            const summaryFile = path.join(context.extensionPath, 'app', 'ai', 'bml-skills.md');

            if (!fs.existsSync(skillsSrc)) {
                vscode.window.showErrorMessage(
                    'CPQ-BML: AI skills not found in extension. Please reinstall the extension.',
                );
                return;
            }

            // Discover available skill directories (each has a SKILL.md).
            const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);

            const targets = [
                {
                    label: 'VS Code Agent Skills (.agents/skills/)',
                    detail: 'Works with Copilot Agent mode, Gemini, Claude Code, and all Agent Skills–compatible tools',
                    id: 'agentskills',
                },
                {
                    label: 'GitHub Copilot Instructions (.github/copilot-instructions.md)',
                    detail: 'Always-on instructions for Copilot chat',
                    id: 'copilot',
                },
                {
                    label: 'Claude Code (CLAUDE.md)',
                    detail: 'Project-level instructions for Claude Code',
                    id: 'claude',
                },
            ];

            const picks = await vscode.window.showQuickPick(targets, {
                canPickMany: true,
                placeHolder: 'Select which AI tools to set up BML skills for',
                title: 'CPQ-BML: Setup AI Skills',
            });

            if (!picks || picks.length === 0) return;

            const created = [];
            const skipped = [];

            for (const pick of picks) {
                if (pick.id === 'agentskills') {
                    // Copy each skill directory into .agents/skills/<name>/
                    const destBase = path.join(root, '.agents', 'skills');
                    let anyCreated = false;

                    for (const skillName of skillDirs) {
                        const destDir = path.join(destBase, skillName);
                        if (fs.existsSync(destDir)) {
                            const overwrite = await vscode.window.showWarningMessage(
                                `".agents/skills/${skillName}" already exists. Overwrite?`,
                                'Overwrite',
                                'Skip',
                            );
                            if (overwrite !== 'Overwrite') {
                                skipped.push(`.agents/skills/${skillName}`);
                                continue;
                            }
                        }
                        try {
                            copyDirSync(path.join(skillsSrc, skillName), destDir);
                            anyCreated = true;
                        } catch (e) {
                            vscode.window.showErrorMessage(
                                `CPQ-BML: Failed to copy skill ${skillName}: ${e.message}`,
                            );
                        }
                    }
                    if (anyCreated) created.push(`.agents/skills/ (${skillDirs.length} skills)`);
                } else {
                    // For copilot/claude: write the summary bml-skills.md content
                    const relPath =
                        pick.id === 'copilot'
                            ? path.join('.github', 'copilot-instructions.md')
                            : 'CLAUDE.md';

                    const destPath = path.join(root, relPath);
                    if (fs.existsSync(destPath)) {
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
                        vscode.window.showErrorMessage(
                            `CPQ-BML: Failed to write ${relPath}: ${e.message}`,
                        );
                    }
                }
            }

            const parts = [];
            if (created.length > 0) parts.push(`Created: ${created.join(', ')}`);
            if (skipped.length > 0) parts.push(`Skipped: ${skipped.join(', ')}`);

            if (parts.length > 0) {
                vscode.window.showInformationMessage(`CPQ-BML AI Skills: ${parts.join(' | ')}`);
            }
        }),
    );
}

module.exports = { registerAiSetup };
