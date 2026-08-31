const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { autoSetupAiSkills } = require('../../app/ai/setup/index.js');
const { withAiSkillsConfig, setupFakeContext } = require('./aiSetupHelper.js');

suite('AI Setup Config & Toggling Test Suite', () => {
    let workspaceRoot;

    suiteSetup(() => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            workspaceRoot = workspaceFolders[0].uri.fsPath;
        }
    });

    test('enabling only Cursor in addition to the Claude default does not turn on Copilot', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, claudeSkillsDir, cursorRulesDir, copilotInstructionsDir, cleanup } =
            setupFakeContext('mock_global_storage_cursor_only', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: undefined, cursor: true, copilot: undefined },
                () => autoSetupAiSkills(fakeContext)
            );

            assert.ok(fs.existsSync(path.join(claudeSkillsDir, 'bml-language', 'SKILL.md')), 'Claude Code should still be scaffolded (default on)');
            assert.ok(fs.existsSync(path.join(cursorRulesDir, 'bml-language.mdc')), 'Cursor should be scaffolded once explicitly enabled');
            assert.ok(!fs.existsSync(copilotInstructionsDir), '.github/instructions/ should stay off - only cursor was enabled');
        } finally {
            fs.rmSync(path.join(workspaceRoot, 'CLAUDE.md'), { force: true });
            fs.rmSync(path.join(workspaceRoot, '.cursorrules'), { force: true });
            cleanup();
        }
    });

    test('turning a tool off after it was enabled removes its native folder, leaving other enabled tools untouched', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, claudeSkillsDir, cursorRulesDir, cleanup } = setupFakeContext('mock_global_storage_disable', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: undefined, cursor: true, copilot: undefined },
                () => autoSetupAiSkills(fakeContext)
            );
            assert.ok(fs.existsSync(path.join(cursorRulesDir, 'bml-language.mdc')), 'sanity check: cursor should be scaffolded in round 1');

            await withAiSkillsConfig(
                { claude: undefined, cursor: false, copilot: undefined },
                () => autoSetupAiSkills(fakeContext)
            );

            assert.ok(!fs.existsSync(cursorRulesDir), '.cursor/rules/ should be removed once cursor is turned off');
            assert.ok(!fs.existsSync(path.join(workspaceRoot, '.cursor')), 'the now-empty .cursor/ parent should be removed too, not left dangling');
            assert.ok(fs.existsSync(path.join(claudeSkillsDir, 'bml-language', 'SKILL.md')), '.claude/skills/ should be untouched since claude stayed on');
        } finally {
            fs.rmSync(path.join(workspaceRoot, 'CLAUDE.md'), { force: true });
            fs.rmSync(path.join(workspaceRoot, '.cursorrules'), { force: true });
            cleanup();
        }
    });

    test('turning a tool off also removes its merged single file (CLAUDE.md / .cursorrules / copilot-instructions.md)', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, cleanup } = setupFakeContext('mock_global_storage_merged_file_disable', workspaceRoot);
        const claudeMdPath = path.join(workspaceRoot, 'CLAUDE.md');
        const cursorrulesPath = path.join(workspaceRoot, '.cursorrules');
        const copilotInstructionsPath = path.join(workspaceRoot, '.github', 'copilot-instructions.md');

        try {
            await withAiSkillsConfig(
                { claude: true, cursor: true, copilot: true },
                () => autoSetupAiSkills(fakeContext)
            );
            assert.ok(fs.existsSync(claudeMdPath), 'sanity check: CLAUDE.md should be created in round 1');
            assert.ok(fs.existsSync(cursorrulesPath), 'sanity check: .cursorrules should be created in round 1');
            assert.ok(fs.existsSync(copilotInstructionsPath), 'sanity check: copilot-instructions.md should be created in round 1');

            await withAiSkillsConfig(
                { claude: false, cursor: false, copilot: false },
                () => autoSetupAiSkills(fakeContext)
            );

            assert.ok(!fs.existsSync(claudeMdPath), 'CLAUDE.md should be removed once claude is turned off');
            assert.ok(!fs.existsSync(cursorrulesPath), '.cursorrules should be removed once cursor is turned off');
            assert.ok(!fs.existsSync(copilotInstructionsPath), 'copilot-instructions.md should be removed once copilot is turned off');
            assert.ok(fs.existsSync(workspaceRoot), 'the workspace root itself must never be touched');
        } finally {
            fs.rmSync(claudeMdPath, { force: true });
            fs.rmSync(cursorrulesPath, { force: true });
            fs.rmSync(copilotInstructionsPath, { force: true });
            cleanup();
        }
    });

    test('preserves a non-empty parent dot-folder when disabling a tool - never deletes files it did not create', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, claudeSkillsDir, cleanup } = setupFakeContext('mock_global_storage_preserve_parent', workspaceRoot);
        const claudeDir = path.join(workspaceRoot, '.claude');
        const handAuthoredFile = path.join(claudeDir, 'settings.local.json');

        try {
            await withAiSkillsConfig(
                { claude: true, cursor: undefined, copilot: undefined },
                () => autoSetupAiSkills(fakeContext)
            );
            assert.ok(fs.existsSync(claudeSkillsDir), 'sanity check: .claude/skills/ should be scaffolded in round 1');

            fs.writeFileSync(handAuthoredFile, '{}');

            await withAiSkillsConfig(
                { claude: false, cursor: undefined, copilot: undefined },
                () => autoSetupAiSkills(fakeContext)
            );

            assert.ok(!fs.existsSync(claudeSkillsDir), '.claude/skills/ should still be removed once claude is off');
            assert.ok(fs.existsSync(claudeDir), '.claude/ itself must be preserved - settings.local.json still lives there');
            assert.ok(fs.existsSync(handAuthoredFile), 'the hand-authored file must be untouched');
        } finally {
            fs.rmSync(handAuthoredFile, { force: true });
            fs.rmSync(claudeDir, { recursive: true, force: true });
            cleanup();
        }
    });

    test('Codex/Antigravity (.agents/skills/) are always scaffolded and never removed, regardless of any other tool being toggled', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, expectedStorageDir, agentsSkillsDir, skillsJsonPath, cleanup } = setupFakeContext('mock_global_storage_agents_always_on', workspaceRoot);

        try {
            await withAiSkillsConfig(
                { claude: false, cursor: false, copilot: false },
                () => autoSetupAiSkills(fakeContext)
            );
            assert.ok(fs.existsSync(path.join(agentsSkillsDir, 'bml-language', 'SKILL.md')), '.agents/skills/ should be scaffolded even with every other tool off');
            assert.ok(fs.existsSync(skillsJsonPath), '.agents/skills.json should be created even with every other tool off');
            const skillsJson1 = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
            assert.ok(skillsJson1.entries.some((e) => e.path === expectedStorageDir), 'pointer entry should be present');

            await withAiSkillsConfig(
                { claude: true, cursor: true, copilot: true },
                () => autoSetupAiSkills(fakeContext)
            );
            assert.ok(fs.existsSync(agentsSkillsDir), '.agents/skills/ should still be present after other tools are enabled');
            const skillsJson2 = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
            assert.strictEqual(
                skillsJson2.entries.filter((e) => e.path === expectedStorageDir).length,
                1,
                'pointer entry should not be duplicated across runs'
            );
        } finally {
            fs.rmSync(path.join(workspaceRoot, 'CLAUDE.md'), { force: true });
            fs.rmSync(path.join(workspaceRoot, '.cursorrules'), { force: true });
            fs.rmSync(path.join(workspaceRoot, '.github', 'copilot-instructions.md'), { force: true });
            cleanup();
        }
    });
});
