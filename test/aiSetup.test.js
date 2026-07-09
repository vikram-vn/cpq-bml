const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { autoSetupAiSkills, parseSkillFrontmatter } = require('../app/ai/setup/index.js');

suite('parseSkillFrontmatter', () => {
    test('extracts an inline scalar description', () => {
        const { name, description } = parseSkillFrontmatter('---\nname: foo\ndescription: A short description.\n---\nBody text.');
        assert.strictEqual(name, 'foo');
        assert.strictEqual(description, 'A short description.');
    });

    test('extracts a quoted inline scalar description, stripping the quotes', () => {
        const { description } = parseSkillFrontmatter('---\ndescription: "Quoted description."\n---\nBody.');
        assert.strictEqual(description, 'Quoted description.');
    });

    test('extracts a folded block scalar (>-) description spanning multiple indented lines', () => {
        const { description } = parseSkillFrontmatter(
            '---\nname: bml-language\ndescription: >-\n  Core BML language skill. Covers all syntax, data types,\n  BMQL, and coding conventions.\n---\n# Body\n'
        );
        assert.strictEqual(description, 'Core BML language skill. Covers all syntax, data types, BMQL, and coding conventions.');
    });

    test('returns the trimmed body with frontmatter stripped', () => {
        const { body } = parseSkillFrontmatter('---\nname: foo\ndescription: d\n---\n\n# Heading\n\nSome content.\n');
        assert.strictEqual(body, '# Heading\n\nSome content.');
    });

    test('falls back to an empty description and the raw content as body when there is no frontmatter', () => {
        const { name, description, body } = parseSkillFrontmatter('# Just a heading\nNo frontmatter here.');
        assert.strictEqual(name, null);
        assert.strictEqual(description, '');
        assert.strictEqual(body, '# Just a heading\nNo frontmatter here.');
    });

    test('handles a folded block scalar using the | (literal) indicator, not just >-', () => {
        const { description } = parseSkillFrontmatter('---\ndescription: |-\n  Literal style description.\n---\nBody.');
        assert.strictEqual(description, 'Literal style description.');
    });
});

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

        const extension = vscode.extensions.getExtension('vikram-n.cpq-bml');
        assert.ok(extension, 'Extension should be present');

        // Note: this test requires the extension to be activated, or we can just pass a fake context.
        // We will pass a fake context that provides extensionPath and a mock globalStorageUri
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

        // Execute the function
        await autoSetupAiSkills(fakeContext);

        // 0. Verify the .br was decompressed correctly
        assert.ok(fs.existsSync(expectedSkillsSrc), 'Decompressed skills directory should exist in global storage');

        // 1a. Check native Claude Code project skills (.claude/skills/<name>/SKILL.md)
        assert.ok(fs.existsSync(bmlLanguageSkillFile), '.claude/skills/bml-language/SKILL.md should be created');
        const bmlLanguageSkillContent = fs.readFileSync(bmlLanguageSkillFile, 'utf8');
        assert.match(bmlLanguageSkillContent, /^---[\s\S]*name: bml-language[\s\S]*---/, 'SKILL.md should keep its YAML frontmatter intact (unlike the merged CLAUDE.md, which strips it)');
        const bmlLanguageRefsDir = path.join(claudeSkillsDir, 'bml-language', 'references');
        assert.ok(fs.existsSync(bmlLanguageRefsDir) && fs.readdirSync(bmlLanguageRefsDir).length > 0, 'bml-language references/ should be copied alongside SKILL.md');

        // 1b. Check native Codex CLI / Antigravity IDE project skills (.agents/skills/<name>/SKILL.md)
        assert.ok(fs.existsSync(bmlLanguageAgentSkillFile), '.agents/skills/bml-language/SKILL.md should be created');
        assert.match(fs.readFileSync(bmlLanguageAgentSkillFile, 'utf8'), /^---[\s\S]*name: bml-language[\s\S]*---/, 'Codex/Antigravity SKILL.md should keep its YAML frontmatter intact');
        const bmlLanguageAgentRefsDir = path.join(agentsSkillsDir, 'bml-language', 'references');
        assert.ok(fs.existsSync(bmlLanguageAgentRefsDir) && fs.readdirSync(bmlLanguageAgentRefsDir).length > 0, 'bml-language references/ should be copied alongside the .agents/skills SKILL.md too');

        // 1c. Check native Cursor project rules (.cursor/rules/<name>.mdc)
        assert.ok(fs.existsSync(bmlLanguageMdc), '.cursor/rules/bml-language.mdc should be created');
        const mdcContent = fs.readFileSync(bmlLanguageMdc, 'utf8');
        assert.match(mdcContent, /^---\ndescription: >-/, '.mdc should open with a folded description scalar');
        assert.match(mdcContent, /alwaysApply: false/, '.mdc should be an Agent Requested rule, not always-on');
        assert.match(mdcContent, /BML Language Core/, '.mdc body should contain the skill content, not just frontmatter');

        // 1d. Check native Copilot path-scoped instructions (.github/instructions/<name>.instructions.md)
        assert.ok(fs.existsSync(bmlLanguageInstructions), '.github/instructions/bml-language.instructions.md should be created');
        const instructionsContent = fs.readFileSync(bmlLanguageInstructions, 'utf8');
        assert.match(instructionsContent, /^---\napplyTo: '\*\*\/\*\.bml'/, 'instructions file should scope to *.bml via applyTo');
        assert.match(instructionsContent, /BML Language Core/, 'instructions body should contain the skill content, not just frontmatter');

        // 1. Check AgentSkills (skills.json)
        assert.ok(fs.existsSync(skillsJsonPath), '.agents/skills.json should be created');
        const skillsJson = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
        assert.ok(skillsJson.entries, 'skills.json should contain entries');
        assert.ok(skillsJson.entries.some(e => e.path === expectedStorageDir), 'skills.json should point to global storage root directory');

        // 2. Check Claude Code (CLAUDE.md)
        assert.ok(fs.existsSync(claudePath), 'CLAUDE.md should be created');
        const claudeContent = fs.readFileSync(claudePath, 'utf8');
        assert.ok(claudeContent.length > 0, 'CLAUDE.md should not be empty');

        // 3. Check GitHub Copilot (.github/copilot-instructions.md)
        assert.ok(fs.existsSync(copilotPath), 'copilot-instructions.md should be created');
        const copilotContent = fs.readFileSync(copilotPath, 'utf8');
        assert.ok(copilotContent.length > 0, 'copilot-instructions.md should not be empty');

        // 4. Check Cursor (.cursorrules)
        assert.ok(fs.existsSync(cursorPath), '.cursorrules should be created');
        const cursorContent = fs.readFileSync(cursorPath, 'utf8');
        assert.ok(cursorContent.length > 0, '.cursorrules should not be empty');

        // Clean up after test
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

    // Sets up a fresh fake context + mock global storage dir under a unique
    // folder name (so tests never see each other's decompressed skills), and
    // returns the paths every native-target assertion needs, plus a cleanup().
    function setupFakeContext(subDirName) {
        const extension = vscode.extensions.getExtension('vikram-n.cpq-bml');
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
            fs.rmSync(agentsSkillsDir, { recursive: true, force: true });
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

    test('autoSetupAiSkills creates native skill files for every skill, not just one', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, expectedStorageDir, claudeSkillsDir, agentsSkillsDir, cursorRulesDir, copilotInstructionsDir, cleanup } =
            setupFakeContext('mock_global_storage_multi');

        try {
            await autoSetupAiSkills(fakeContext);

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

    test('autoSetupAiSkills handles a skill with no references/ folder without crashing or creating an empty one', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, claudeSkillsDir, cleanup } = setupFakeContext('mock_global_storage_norefs');

        try {
            await autoSetupAiSkills(fakeContext);

            // bml-pitfalls and cpq-mcp-workflow ship with no references/ subfolder
            // (see SKILL_REFERENCES in scripts/build/build_skills.py).
            const pitfallsSkillFile = path.join(claudeSkillsDir, 'bml-pitfalls', 'SKILL.md');
            const pitfallsRefsDir = path.join(claudeSkillsDir, 'bml-pitfalls', 'references');
            assert.ok(fs.existsSync(pitfallsSkillFile), 'bml-pitfalls/SKILL.md should still be created');
            assert.ok(!fs.existsSync(pitfallsRefsDir), 'no references/ dir should be created when the source skill has none');
        } finally {
            cleanup();
        }
    });

    test('autoSetupAiSkills is idempotent - running twice does not throw and does not duplicate the skills.json entry', async function () {
        if (!workspaceRoot) {
            console.warn('Skipping ai setup test because no workspace is open');
            return;
        }
        const { fakeContext, skillsJsonPath, claudeSkillsDir, cleanup } = setupFakeContext('mock_global_storage_idempotent');

        try {
            await autoSetupAiSkills(fakeContext);
            await autoSetupAiSkills(fakeContext);

            const skillsJson = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));
            assert.strictEqual(skillsJson.entries.length, 1, 'skills.json should not accumulate duplicate entries across runs');
            assert.ok(fs.existsSync(path.join(claudeSkillsDir, 'bml-language', 'SKILL.md')), 'native skill files should still be present after a second run');
        } finally {
            cleanup();
        }
    });
});
