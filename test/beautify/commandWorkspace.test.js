const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectBmlFiles, collectFolders } = require('../../app/lang/beautify/commandWorkspace');

suite('BML Workspace Beautifier Command Helpers', () => {
    test('collectBmlFiles ignores node_modules, .git, and dist folders', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beautify-test-'));
        try {
            // Create target BML files
            const rootFile = path.join(tmpDir, 'root.bml');
            fs.writeFileSync(rootFile, 'x=1;');

            const subDir = path.join(tmpDir, 'sub');
            fs.mkdirSync(subDir);
            const subFile = path.join(subDir, 'sub.bml');
            fs.writeFileSync(subFile, 'y=2;');

            // Create ignored folders and BML files inside them
            const gitDir = path.join(tmpDir, '.git');
            fs.mkdirSync(gitDir);
            fs.writeFileSync(path.join(gitDir, 'ignored.bml'), 'z=3;');

            const nmDir = path.join(tmpDir, 'node_modules');
            fs.mkdirSync(nmDir);
            fs.writeFileSync(path.join(nmDir, 'ignored.bml'), 'z=4;');

            const bmlFiles = await collectBmlFiles(tmpDir);

            // Assert that only rootFile and subFile are collected
            assert.strictEqual(bmlFiles.length, 2);
            assert.ok(bmlFiles.includes(rootFile));
            assert.ok(bmlFiles.includes(subFile));
            assert.ok(!bmlFiles.includes(path.join(gitDir, 'ignored.bml')));
            assert.ok(!bmlFiles.includes(path.join(nmDir, 'ignored.bml')));
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('collectFolders collects nested subdirectories excluding ignored folders', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beautify-folders-test-'));
        try {
            const subDir1 = path.join(tmpDir, 'sub1');
            fs.mkdirSync(subDir1);
            const subDir2 = path.join(subDir1, 'sub2');
            fs.mkdirSync(subDir2);

            const gitDir = path.join(tmpDir, '.git');
            fs.mkdirSync(gitDir);

            const folders = await collectFolders(tmpDir);

            assert.strictEqual(folders.length, 2);
            assert.ok(folders.includes(subDir1));
            assert.ok(folders.includes(subDir2));
            assert.ok(!folders.includes(gitDir));
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
