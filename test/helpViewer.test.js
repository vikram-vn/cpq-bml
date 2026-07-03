const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const vscode = require('vscode');
const { openHelpTopic } = require('../app/lang/intellisense/helpViewer');

// Regression guard for the exact bug reported by the user: opening a help
// topic through the real installed extension showed "Help topic not found:
// .../direct-db-access/directDbAccess.md". openHelpTopic() checked only
// fs.existsSync(filePath) (the raw .md) before doing anything else - but
// .vscodeignore excludes the raw .md from the packaged .vsix (only .md.br
// ships), so that check always failed once packaged, even though the
// (separate, correct) renderFile() a few lines later already knew how to
// decompress the .md.br. The early-exit guard just never got past its own
// stale check to reach that code.
function withTempDir(fn) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bml-helpViewer-test-'));
    try {
        return fn(tmpDir);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function fakeContext(tmpDir) {
    return {
        extensionPath: tmpDir,
        extensionUri: vscode.Uri.file(tmpDir),
    };
}

suite('helpViewer - openHelpTopic', () => {
    let originalShowErrorMessage;
    let errorMessages;

    setup(() => {
        errorMessages = [];
        originalShowErrorMessage = vscode.window.showErrorMessage;
        vscode.window.showErrorMessage = (msg) => {
            errorMessages.push(msg);
            return Promise.resolve(undefined);
        };
    });

    teardown(() => {
        vscode.window.showErrorMessage = originalShowErrorMessage;
    });

    test('opens successfully when only the packaged .md.br exists (no raw .md)', () => {
        withTempDir((tmpDir) => {
            const mdPath = path.join(tmpDir, 'topic.md');
            const compressed = zlib.brotliCompressSync(Buffer.from('# Direct DB Access\n\nSome content.\n'));
            fs.writeFileSync(`${mdPath}.br`, compressed);

            openHelpTopic(fakeContext(tmpDir), mdPath, undefined);

            assert.deepStrictEqual(errorMessages, [], 'should not report "Help topic not found" when the .md.br exists');
        });
    });

    test('still reports "Help topic not found" when neither .md nor .md.br exists', () => {
        withTempDir((tmpDir) => {
            const mdPath = path.join(tmpDir, 'missing-topic.md');

            openHelpTopic(fakeContext(tmpDir), mdPath, undefined);

            assert.strictEqual(errorMessages.length, 1);
            assert.match(errorMessages[0], /Help topic not found/);
        });
    });
});
