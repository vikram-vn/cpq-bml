const fs = require('fs');
const path = require('path');

// (copyDirSync removed, we now use pointers)

// (Removed registerAiSetup since setup is purely automatic on MCP enable)

// Maps each cpqBml.mcp.aiSkills.<key> setting to the performAiSetup pickIds it
// controls - native skill/rule files plus that tool's legacy merged-file
// target. Codex CLI (OpenAI) and Antigravity IDE (Google) are separate
// vendors/toggles but happen to document the identical .agents/skills/
// convention, so they map to the same pickIds - enabling either one writes
// the same files (deduped via a Set in autoSetupAiSkills).
const AI_SKILLS_TOOL_PICK_IDS = {
    claude: ['claudeSkills', 'claude'],
    cursor: ['cursorRules', 'cursor'],
    copilot: ['copilotInstructions', 'copilot'],
    codex: ['nativeAgentSkills', 'agentskills'],
    antigravity: ['nativeAgentSkills', 'agentskills'],
};

// The native, per-skill directory each toggle family owns outright (safe to
// delete wholesale when disabled - unlike the single merged files like
// CLAUDE.md/.cursorrules/copilot-instructions.md, which are left alone since
// they could plausibly contain content the user wrote by hand, not just what
// we generated). Codex and Antigravity share one directory, so it's only
// removed once *both* are off.
const NATIVE_SKILL_TARGETS = [
    { settingKeys: ['claude'], dir: (root) => path.join(root, '.claude', 'skills') },
    { settingKeys: ['cursor'], dir: (root) => path.join(root, '.cursor', 'rules') },
    { settingKeys: ['copilot'], dir: (root) => path.join(root, '.github', 'instructions') },
    { settingKeys: ['codex', 'antigravity'], dir: (root) => path.join(root, '.agents', 'skills') },
];

// Removes dir, then removes its parent too if that parent is now genuinely
// empty - so disabling a tool doesn't leave a dangling empty ".claude",
// ".cursor", etc. behind. Never force-deletes the parent: rmdirSync only
// succeeds on an empty directory, so anything else living there (e.g. a
// hand-authored ".claude/settings.local.json") is left untouched.
function removeDirAndEmptyParent(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    const parent = path.dirname(dir);
    try {
        if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
            fs.rmdirSync(parent);
        }
    } catch (e) {
        // Not actually empty (race with something else writing to it) or
        // already gone - leave it alone rather than force anything.
    }
}

// Removes our own pointer entry (matching customizationRoot) from
// .agents/skills.json without touching any other entries that may be there,
// and leaves the file alone entirely if it's missing or unparseable.
function removeAgentSkillsPointerEntry(root, customizationRoot) {
    const destFile = path.join(root, '.agents', 'skills.json');
    if (!fs.existsSync(destFile)) return;
    try {
        const currentConfig = JSON.parse(fs.readFileSync(destFile, 'utf8'));
        if (!Array.isArray(currentConfig.entries)) return;
        currentConfig.entries = currentConfig.entries.filter((entry) => entry.path !== customizationRoot);
        fs.writeFileSync(destFile, JSON.stringify(currentConfig, null, 2), 'utf8');
    } catch (e) {
        // Unparseable/unexpected shape - leave it alone rather than guess.
    }
}

// Pulls "name" and "description" out of a SKILL.md's YAML frontmatter, handling
// both inline scalars (`description: foo`) and folded block scalars
// (`description: >-` followed by indented lines) - the only two styles the
// generated SKILL.md templates use. Not a general YAML parser.
function parseSkillFrontmatter(skillMdContent) {
    const match = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { name: null, description: '', body: skillMdContent.trim() };

    const [, frontmatter, body] = match;
    const lines = frontmatter.split(/\r?\n/);
    let name = null;
    let description = '';

    for (let i = 0; i < lines.length; i++) {
        const nameMatch = lines[i].match(/^name:\s*(.+)$/);
        if (nameMatch) name = nameMatch[1].trim();

        const descMatch = lines[i].match(/^description:\s*(.*)$/);
        if (descMatch) {
            const inline = descMatch[1].trim();
            if (inline && !/^[>|][-+]?$/.test(inline)) {
                description = inline.replace(/^["']|["']$/g, '');
            } else {
                const folded = [];
                let j = i + 1;
                while (j < lines.length && /^\s+\S/.test(lines[j])) {
                    folded.push(lines[j].trim());
                    j++;
                }
                description = folded.join(' ').trim();
            }
        }
    }

    return { name, description, body: body.trim() };
}

// Copies each skill's SKILL.md (+ references/) as-is into destSkillsDir/<name>/.
// Shared by the native '.claude/skills' and '.agents/skills' targets, which use
// an identical on-disk convention.
function copySkillDirsNative(destSkillsDir, skillsSrc, skillDirs) {
    fs.mkdirSync(destSkillsDir, { recursive: true });
    for (const skillName of skillDirs) {
        const srcSkillDir = path.join(skillsSrc, skillName);
        const srcSkillFile = path.join(srcSkillDir, 'SKILL.md');
        if (!fs.existsSync(srcSkillFile)) continue;

        const destSkillDir = path.join(destSkillsDir, skillName);
        fs.mkdirSync(destSkillDir, { recursive: true });
        fs.copyFileSync(srcSkillFile, path.join(destSkillDir, 'SKILL.md'));

        const srcRefsDir = path.join(srcSkillDir, 'references');
        if (fs.existsSync(srcRefsDir)) {
            const destRefsDir = path.join(destSkillDir, 'references');
            fs.mkdirSync(destRefsDir, { recursive: true });
            for (const refFile of fs.readdirSync(srcRefsDir)) {
                fs.copyFileSync(path.join(srcRefsDir, refFile), path.join(destRefsDir, refFile));
            }
        }
    }
}

// Writes one .cursor/rules/<name>.mdc per skill - Cursor's native project rules
// format (the root .cursorrules file is reportedly ignored in Agent mode as of
// 2026). description-only + alwaysApply:false makes each an "Agent Requested"
// rule, so Cursor decides relevance the same way Claude/Codex/Antigravity do
// for their native skills, rather than always-on or path-glob-triggered.
function writeCursorRuleFiles(root, skillsSrc, skillDirs) {
    const destDir = path.join(root, '.cursor', 'rules');
    fs.mkdirSync(destDir, { recursive: true });
    for (const skillName of skillDirs) {
        const srcSkillFile = path.join(skillsSrc, skillName, 'SKILL.md');
        if (!fs.existsSync(srcSkillFile)) continue;
        const { description, body } = parseSkillFrontmatter(fs.readFileSync(srcSkillFile, 'utf8'));

        const mdc = `---\ndescription: >-\n  ${description || skillName}\nalwaysApply: false\n---\n\n${body}\n`;
        fs.writeFileSync(path.join(destDir, `${skillName}.mdc`), mdc, 'utf8');
    }
}

// Writes one .github/instructions/<name>.instructions.md per skill - Copilot's
// native path-scoped instructions format (supported in VS Code Chat, the cloud
// coding agent, code review, JetBrains, and Copilot CLI). Every BML skill here
// is scoped to *.bml files since that's the entire premise of this extension.
function writeCopilotInstructionFiles(root, skillsSrc, skillDirs) {
    const destDir = path.join(root, '.github', 'instructions');
    fs.mkdirSync(destDir, { recursive: true });
    for (const skillName of skillDirs) {
        const srcSkillFile = path.join(skillsSrc, skillName, 'SKILL.md');
        if (!fs.existsSync(srcSkillFile)) continue;
        const { description, body } = parseSkillFrontmatter(fs.readFileSync(srcSkillFile, 'utf8'));

        const instructions = `---\napplyTo: '**/*.bml'\ndescription: >-\n  ${description || skillName}\n---\n\n${body}\n`;
        fs.writeFileSync(path.join(destDir, `${skillName}.instructions.md`), instructions, 'utf8');
    }
}

async function performAiSetup(context, root, pickIds, customizationRoot, skillsSrc, summaryFile, silent = false) {
    const vscode = require('vscode');

    if (!fs.existsSync(skillsSrc)) return;

    const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    const created = [];
    const skipped = [];

    for (const pickId of pickIds) {
        if (pickId === 'claudeSkills') {
            // Native Claude Code project skills: .claude/skills/<name>/SKILL.md
            // (+ references/), discovered and loaded on demand by Claude Code
            // itself - unlike the 'claude' branch below, which only writes a
            // single always-loaded CLAUDE.md summary.
            try {
                copySkillDirsNative(path.join(root, '.claude', 'skills'), skillsSrc, skillDirs);
                created.push('.claude/skills/');
            } catch (e) {
                console.error('CPQ-BML: Failed to write .claude/skills/:', e);
                if (!silent) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: Failed to write .claude/skills/: ${e.message}`,
                    );
                }
            }
        } else if (pickId === 'nativeAgentSkills') {
            // Native Codex CLI + Antigravity IDE project skills. Both tools
            // independently document the exact same convention -
            // .agents/skills/<name>/SKILL.md (+ references/) - scanned from cwd
            // up to the repo root, loaded on demand by description match. This
            // is a real skill directory, unlike the 'agentskills' pointer-file
            // branch below (kept for whatever else may read that pointer, but
            // it does not match either tool's documented format).
            try {
                copySkillDirsNative(path.join(root, '.agents', 'skills'), skillsSrc, skillDirs);
                created.push('.agents/skills/');
            } catch (e) {
                console.error('CPQ-BML: Failed to write .agents/skills/:', e);
                if (!silent) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: Failed to write .agents/skills/: ${e.message}`,
                    );
                }
            }
        } else if (pickId === 'cursorRules') {
            // Native Cursor project rules: .cursor/rules/<name>.mdc, one per
            // skill - unlike the 'cursor' branch below, which only writes the
            // legacy root .cursorrules file (reportedly ignored in Agent mode).
            try {
                writeCursorRuleFiles(root, skillsSrc, skillDirs);
                created.push('.cursor/rules/');
            } catch (e) {
                console.error('CPQ-BML: Failed to write .cursor/rules/:', e);
                if (!silent) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: Failed to write .cursor/rules/: ${e.message}`,
                    );
                }
            }
        } else if (pickId === 'copilotInstructions') {
            // Native Copilot path-scoped instructions: one
            // .github/instructions/<name>.instructions.md per skill, applied to
            // *.bml files - unlike the 'copilot' branch below, which only
            // writes the single repo-wide copilot-instructions.md summary.
            try {
                writeCopilotInstructionFiles(root, skillsSrc, skillDirs);
                created.push('.github/instructions/');
            } catch (e) {
                console.error('CPQ-BML: Failed to write .github/instructions/:', e);
                if (!silent) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: Failed to write .github/instructions/: ${e.message}`,
                    );
                }
            }
        } else if (pickId === 'agentskills') {
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

    // 3. Scaffold whichever tools are enabled under cpqBml.mcp.aiSkills.*
    // (Claude on by default, the rest opt-in - see package.json for defaults),
    // and remove the native directory for any tool that's off, so the
    // workspace always reflects exactly the current toggle state.
    const cpqConfig = vscode.workspace.getConfiguration('cpqBml');
    const enabled = {};
    for (const settingKey of Object.keys(AI_SKILLS_TOOL_PICK_IDS)) {
        enabled[settingKey] = cpqConfig.get(`mcp.aiSkills.${settingKey}`, settingKey === 'claude');
    }

    const pickIds = new Set();
    for (const [settingKey, ids] of Object.entries(AI_SKILLS_TOOL_PICK_IDS)) {
        if (enabled[settingKey]) ids.forEach((id) => pickIds.add(id));
    }
    console.log('CPQ-BML: autoSetupAiSkills - root:', root, 'enabled:', enabled, 'pickIds:', [...pickIds]);
    if (pickIds.size > 0) {
        await performAiSetup(context, root, [...pickIds], aiStorageDir, skillsSrc, summaryFile, true);
    }

    for (const target of NATIVE_SKILL_TARGETS) {
        if (!target.settingKeys.some((k) => enabled[k])) {
            const dir = target.dir(root);
            try {
                removeDirAndEmptyParent(dir);
            } catch (e) {
                console.error(`CPQ-BML: Failed to remove ${dir}:`, e);
            }
        }
    }
    if (!enabled.codex && !enabled.antigravity) {
        try {
            removeAgentSkillsPointerEntry(root, aiStorageDir);
        } catch (e) {
            console.error('CPQ-BML: Failed to clear .agents/skills.json pointer entry:', e);
        }
    }
}

module.exports = { autoSetupAiSkills, parseSkillFrontmatter };
