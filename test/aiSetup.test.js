const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { autoSetupAiSkills } = require('../app/ai/setup/index.js');

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

        // Clean up before test just in case
        if (fs.existsSync(skillsJsonPath)) fs.unlinkSync(skillsJsonPath);
        if (fs.existsSync(claudePath)) fs.unlinkSync(claudePath);
        if (fs.existsSync(copilotPath)) fs.unlinkSync(copilotPath);
        if (fs.existsSync(cursorPath)) fs.unlinkSync(cursorPath);
        if (fs.existsSync(expectedStorageDir)) fs.rmSync(expectedStorageDir, { recursive: true, force: true });

        // Execute the function
        await autoSetupAiSkills(fakeContext);

        // 0. Verify the .br was decompressed correctly
        assert.ok(fs.existsSync(expectedSkillsSrc), 'Decompressed skills directory should exist in global storage');

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
        fs.rmSync(mockGlobalStoragePath, { recursive: true, force: true });
    });
});
