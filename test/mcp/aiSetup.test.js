const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { autoSetupAiSkills } = require('../../app/ai/setup/index.js');
const { getExtensionId } = require('../extensionHelper.js');
const { withAiSkillsConfig, setupFakeContext } = require('./aiSetupHelper.js');

suite('AI Setup Integration Test Suite', () => {
    let workspaceRoot;

    suiteSetup(() => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            workspaceRoot = workspaceFolders[0].uri.fsPath;
        }
    });

    test('autoSetupAiSkills scaffolds all required target files', async () => {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }

        const extension = vscode.extensions.getExtension(getExtensionId());
        assert.ok(extension, 'Extension should be present');

        const mockGlobalStoragePath = path.join(__dirname, 'mock_global_storage');
        if (!fs.existsSync(mockGlobalStoragePath)) {
            fs.mkdirSync(mockGlobalStoragePath, { recursive: true });
        }

        const fakeContext = {
            extensionPath: extension.extensionPath,
            globalStorageUri: { fsPath: mockGlobalStoragePath },
            extension: extension
        };

        const extensionVersion = extension.packageJSON.version;
        const expectedStorageDir = path.join(mockGlobalStoragePath, 'ai_skills_v' + extensionVersion);
        const expectedSkillsSrc = path.join(expectedStorageDir, 'skills');

        // Paths to expect
        const agentsDir = path.join(workspaceRoot, '.agents');
        const skillsJsonPath = path.join(agentsDir, 'skills.json');
        const claudePath = path.join(workspaceRoot, 'CLAUDE.md');
        const copilotPath = path.join(workspaceRoot, '.github', 'copilot-instructions.md');
        const cursorPath = path.join(workspaceRoot, '.cursorrules');
        const claudeSkillsDir = path.join(workspaceRoot, '.claude', 'skills');
        const bmlLanguageSkillFile = path.join(claudeSkillsDir, 'bml-language', 'SKILL.md');
        const agentsSkillsDir = path.join(workspaceRoot, '.agents', 'skills');
        const bmlLanguageAgentSkillFile = path.join(agentsSkillsDir, 'bml-language', 'SKILL.md');
        const cursorRulesDir = path.join(workspaceRoot, '.cursor', 'rules');
        const bmlLanguageMdc = path.join(cursorRulesDir, 'bml-language.mdc');
        const copilotInstructionsDir = path.join(workspaceRoot, '.github', 'instructions');
        const bmlLanguageInstructions = path.join(copilotInstructionsDir, 'bml-language.instructions.md');

        // Clean up before test just in case
        if (fs.existsSync(skillsJsonPath)) fs.unlinkSync(skillsJsonPath);
        if (fs.existsSync(claudePath)) fs.unlinkSync(claudePath);
        if (fs.existsSync(copilotPath)) fs.unlinkSync(copilotPath);
        if (fs.existsSync(cursorPath)) fs.unlinkSync(cursorPath);
        if (fs.existsSync(claudeSkillsDir)) fs.rmSync(claudeSkillsDir, { recursive: true, force: true });
        if (fs.existsSync(agentsSkillsDir)) fs.rmSync(agentsSkillsDir, { recursive: true, force: true });
        if (fs.existsSync(cursorRulesDir)) fs.rmSync(cursorRulesDir, { recursive: true, force: true });
        if (fs.existsSync(copilotInstructionsDir)) fs.rmSync(copilotInstructionsDir, { recursive: true, force: true });
        if (fs.existsSync(expectedStorageDir)) fs.rmSync(expectedStorageDir, { recursive: true, force: true });

        await withAiSkillsConfig(
            { claude: true, cursor: true, copilot: true },
            () => autoSetupAiSkills(fakeContext)
        );

        assert.ok(fs.existsSync(expectedSkillsSrc), 'Decompressed skills directory should exist in global storage');

        // 1a. Check native Claude Code project skills
        assert.ok(fs.existsSync(bmlLanguageSkillFile), '.claude/skills/bml-language/SKILL.md should be created');
        const bmlLanguageSkillContent = fs.readFileSync(bmlLanguageSkillFile, 'utf8');
        assert.match(bmlLanguageSkillContent, /^---[\s\S]*name: bml-language[\s\S]*---/, 'SKILL.md should keep its YAML frontmatter intact');
        const bmlLanguageRefsDir = path.join(claudeSkillsDir, 'bml-language', 'references');
        assert.ok(fs.existsSync(bmlLanguageRefsDir) && fs.readdirSync(bmlLanguageRefsDir).length > 0, 'bml-language references/ should be copied');

        // 1b. Check native Codex CLI / Antigravity IDE project skills
        assert.ok(fs.existsSync(bmlLanguageAgentSkillFile), '.agents/skills/bml-language/SKILL.md should be created');
        assert.match(fs.readFileSync(bmlLanguageAgentSkillFile, 'utf8'), /^---[\s\S]*name: bml-language[\s\S]*---/, 'Codex/Antigravity SKILL.md should keep frontmatter');
        const bmlLanguageAgentRefsDir = path.join(agentsSkillsDir, 'bml-language', 'references');
        assert.ok(fs.existsSync(bmlLanguageAgentRefsDir) && fs.readdirSync(bmlLanguageAgentRefsDir).length > 0, 'bml-language references/ should be copied to .agents/skills');

        // 1c. Check native Cursor project rules
        assert.ok(fs.existsSync(bmlLanguageMdc), '.cursor/rules/bml-language.mdc should be created');
        const mdcContent = fs.readFileSync(bmlLanguageMdc, 'utf8');
        assert.match(mdcContent, /^---\ndescription: >-/, '.mdc should open with a folded description scalar');
        assert.match(mdcContent, /alwaysApply: false/, '.mdc should be an Agent Requested rule');
        assert.match(mdcContent, /BML Language Core/, '.mdc body should contain skill content');

        // 1d. Check native Copilot instructions
        assert.ok(fs.existsSync(bmlLanguageInstructions), '.github/instructions/bml-language.instructions.md should be created');
        const instructionsContent = fs.readFileSync(bmlLanguageInstructions, 'utf8');
        assert.match(instructionsContent, /^---\napplyTo: '\*\*\/\*\.bml'/, 'instructions file should scope to *.bml');
        assert.match(instructionsContent, /BML Language Core/, 'instructions body should contain skill content');

        // AgentSkills
        assert.ok(fs.existsSync(skillsJsonPath), '.agents/skills.json should be created');
        const skillsJson = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
        assert.ok(skillsJson.entries, 'skills.json should contain entries');
        assert.ok(skillsJson.entries.some(e => e.path === expectedStorageDir), 'skills.json should point to storage');

        // Single files
        assert.ok(fs.existsSync(claudePath), 'CLAUDE.md should be created');
        assert.ok(fs.existsSync(copilotPath), 'copilot-instructions.md should be created');
        assert.ok(fs.existsSync(cursorPath), '.cursorrules should be created');

        // Cleanup
        fs.unlinkSync(skillsJsonPath);
        fs.unlinkSync(claudePath);
        fs.unlinkSync(copilotPath);
        fs.unlinkSync(cursorPath);
        fs.rmSync(claudeSkillsDir, { recursive: true, force: true });
        fs.rmSync(agentsSkillsDir, { recursive: true, force: true });
        fs.rmSync(cursorRulesDir, { recursive: true, force: true });
        fs.rmSync(copilotInstructionsDir, { recursive: true, force: true });
        fs.rmSync(mockGlobalStoragePath, { recursive: true, force: true });
    });

    test('autoSetupAiSkills creates native skill files for every skill, not just one', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, expectedStorageDir, claudeSkillsDir, agentsSkillsDir, cursorRulesDir, copilotInstructionsDir, cleanup } =
            setupFakeContext('mock_global_storage_multi', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: true, cursor: true, copilot: true },
                () => autoSetupAiSkills(fakeContext)
            );

            const skillNames = fs.readdirSync(path.join(expectedStorageDir, 'skills'), { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            assert.ok(skillNames.length >= 8, `expected at least 8 skills, found ${skillNames.length}`);

            for (const name of skillNames) {
                assert.ok(fs.existsSync(path.join(claudeSkillsDir, name, 'SKILL.md')), `.claude/skills/${name}/SKILL.md missing`);
                assert.ok(fs.existsSync(path.join(agentsSkillsDir, name, 'SKILL.md')), `.agents/skills/${name}/SKILL.md missing`);
                assert.ok(fs.existsSync(path.join(cursorRulesDir, `${name}.mdc`)), `.cursor/rules/${name}.mdc missing`);
                assert.ok(fs.existsSync(path.join(copilotInstructionsDir, `${name}.instructions.md`)), `.github/instructions/${name}.instructions.md missing`);
            }
        } finally {
            cleanup();
        }
    });

    test('autoSetupAiSkills handles a skill with no references/ folder without crashing', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, claudeSkillsDir, cleanup } = setupFakeContext('mock_global_storage_norefs', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: true, cursor: false, copilot: false },
                () => autoSetupAiSkills(fakeContext)
            );

            const pitfallsSkillFile = path.join(claudeSkillsDir, 'bml-pitfalls', 'SKILL.md');
            const pitfallsRefsDir = path.join(claudeSkillsDir, 'bml-pitfalls', 'references');
            assert.ok(fs.existsSync(pitfallsSkillFile), 'bml-pitfalls/SKILL.md should still be created');
            assert.ok(!fs.existsSync(pitfallsRefsDir), 'no references/ dir should be created when source has none');
        } finally {
            cleanup();
        }
    });

    test('autoSetupAiSkills is idempotent - running twice does not throw and does not duplicate skills.json entry', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, skillsJsonPath, claudeSkillsDir, cleanup } = setupFakeContext('mock_global_storage_idempotent', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: true, cursor: false, copilot: false },
                async () => {
                    await autoSetupAiSkills(fakeContext);
                    await autoSetupAiSkills(fakeContext);
                }
            );

            const skillsJson = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
            assert.strictEqual(skillsJson.entries.length, 1, 'skills.json should not accumulate duplicate entries across runs');
            assert.ok(fs.existsSync(path.join(claudeSkillsDir, 'bml-language', 'SKILL.md')), 'native skill files should still be present');
        } finally {
            cleanup();
        }
    });

    test('defaults to Claude Code + the always-on Codex/Antigravity family when no aiSkills settings configured', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, claudeSkillsDir, agentsSkillsDir, cursorRulesDir, copilotInstructionsDir, skillsJsonPath, cleanup } =
            setupFakeContext('mock_global_storage_defaults', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: undefined, cursor: undefined, copilot: undefined },
                () => autoSetupAiSkills(fakeContext)
            );

            assert.ok(fs.existsSync(path.join(claudeSkillsDir, 'bml-language', 'SKILL.md')), 'Claude Code should be scaffolded by default');
            assert.ok(fs.existsSync(path.join(agentsSkillsDir, 'bml-language', 'SKILL.md')), '.agents/skills/ should always be scaffolded');
            assert.ok(fs.existsSync(skillsJsonPath), '.agents/skills.json should always be created');
            assert.ok(!fs.existsSync(cursorRulesDir), '.cursor/rules/ should not be created when cursor off');
            assert.ok(!fs.existsSync(copilotInstructionsDir), '.github/instructions/ should not be created when copilot off');
            assert.ok(fs.existsSync(path.join(workspaceRoot, 'CLAUDE.md')), 'CLAUDE.md should still be created by default');
        } finally {
            fs.rmSync(path.join(workspaceRoot, 'CLAUDE.md'), { force: true });
            cleanup();
        }
    });
});
