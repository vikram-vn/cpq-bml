const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { formatAsJsDoc } = require('../app/lang/intellisense/docFormatting');

// Regression guard for a real bug: formatAsJsDoc() only appended the "Read
// Offline Help" hover link when fs.existsSync() found the raw .md file. That
// worked in dev/test, where the raw .md sits next to the generated .md.br -
// but .vscodeignore excludes the raw .md from the packaged .vsix (only
// .md.br ships), so the real installed extension's fs.existsSync() check
// always failed and the offline docs link silently never appeared, even
// though helpViewer.js could render the .md.br file just fine once opened.
function withTempDir(fn) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bml-docFormatting-test-'));
    try {
        return fn(tmpDir);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function writeKnowledgeFile(tmpDir, relPath, content, { compressed } = {}) {
    const abs = path.join(tmpDir, 'app', 'knowledge', 'BML', relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (compressed) {
        fs.writeFileSync(`${abs}.br`, zlib.brotliCompressSync(Buffer.from(content)));
    } else {
        fs.writeFileSync(abs, content);
    }
}

const FN_INFO = { category: 'function', name: 'atof', syntax: 'atof(str)', functionCategory: 'string' };

suite('docFormatting - offline help link', () => {
    test('shows the Read Offline Help link when only the packaged .md.br exists', () => {
        withTempDir((tmpDir) => {
            writeKnowledgeFile(tmpDir, 'string/string.md', '# String\n', { compressed: true });
            const md = formatAsJsDoc(FN_INFO, { extensionPath: tmpDir });
            assert.match(md.value, /Read Offline Help/);
        });
    });

    test('shows the Read Offline Help link when only the raw .md exists (dev/test runs)', () => {
        withTempDir((tmpDir) => {
            writeKnowledgeFile(tmpDir, 'string/string.md', '# String\n');
            const md = formatAsJsDoc(FN_INFO, { extensionPath: tmpDir });
            assert.match(md.value, /Read Offline Help/);
        });
    });

    test('omits the link when neither the .md nor .md.br exists', () => {
        withTempDir((tmpDir) => {
            const md = formatAsJsDoc(FN_INFO, { extensionPath: tmpDir });
            assert.doesNotMatch(md.value, /Read Offline Help/);
        });
    });

    test('shows the Read Offline Help link for one real function from every documented category', () => {
        // Regression guard: every functionCategory value that actually appears in
        // bml_functions_api_usage.json (except "logical", which covers control-flow
        // keyword docs like "if..."/"if...else" that have no dedicated reference page)
        // must resolve to a real, existing knowledge-base file.
        const repoRoot = path.join(__dirname, '..');
        const funcsPath = path.join(repoRoot, 'app', 'lang', 'intellisense', 'bml_functions_api_usage.json');
        const funcs = JSON.parse(fs.readFileSync(funcsPath, 'utf8'));
        const seen = new Set();
        for (const [name, entry] of Object.entries(funcs)) {
            const cat = entry.functionCategory;
            if (!cat || cat === 'logical' || seen.has(cat)) continue;
            seen.add(cat);
            const info = { category: 'function', name, syntax: entry.syntax || name, functionCategory: cat };
            const md = formatAsJsDoc(info, { extensionPath: repoRoot });
            assert.match(md.value, /Read Offline Help/, `category "${cat}" (e.g. "${name}") should show the offline help link`);
        }
    });
});
