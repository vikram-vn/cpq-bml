const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { formatAsJsDoc } = require('../app/lang/intellisense/docFormatting');

// Regression guard for a real bug: formatAsJsDoc() only appended the "Open
// Full Page" hover link when fs.existsSync() found the raw .md file. That
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
    test('shows the Open Full Page link when only the packaged .md.br exists', () => {
        withTempDir((tmpDir) => {
            writeKnowledgeFile(tmpDir, 'string/string.md', '# String\n', { compressed: true });
            const md = formatAsJsDoc(FN_INFO, { extensionPath: tmpDir });
            assert.match(md.value, /Open Full Page/);
        });
    });

    test('shows the Open Full Page link when only the raw .md exists (dev/test runs)', () => {
        withTempDir((tmpDir) => {
            writeKnowledgeFile(tmpDir, 'string/string.md', '# String\n');
            const md = formatAsJsDoc(FN_INFO, { extensionPath: tmpDir });
            assert.match(md.value, /Open Full Page/);
        });
    });

    test('omits the link when neither the .md nor .md.br exists', () => {
        withTempDir((tmpDir) => {
            const md = formatAsJsDoc(FN_INFO, { extensionPath: tmpDir });
            assert.doesNotMatch(md.value, /Open Full Page/);
        });
    });

    test('shows the Open Full Page link for one real function from every documented category', () => {
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
            assert.match(md.value, /Open Full Page/, `category "${cat}" (e.g. "${name}") should show the offline help link`);
        }
    });
});

suite('docFormatting - inline doc excerpt (no separate webview tab needed)', () => {
    // The user asked for something faster than opening a separate webview tab
    // for the common case of just wanting to read the docs: instead of only a
    // link, formatAsJsDoc() now reads the (already-decompressed) markdown
    // source directly, extracts the "## <functionName>" section, and inlines
    // a hover-safe version of it right in the tooltip - instant, since the
    // hover was already about to render regardless.
    test('inlines the real "## atoi" section from string.md, sanitized for hover display', () => {
        const repoRoot = path.join(__dirname, '..');
        const info = { category: 'function', name: 'atoi', syntax: 'atoi(str)', functionCategory: 'string' };
        const md = formatAsJsDoc(info, { extensionPath: repoRoot });

        // Real prose from the atoi section, not just the atof section above it or
        // the atof/atoi shared images section below it.
        assert.match(md.value, /converts text that represents a number into an integer/i);
        // Redundant with the code block already shown at the top of the hover.
        assert.doesNotMatch(md.value, /\*\*Syntax:\*\*/);
        // Local file images aren't reliably renderable in a hover tooltip.
        assert.doesNotMatch(md.value, /!\[/);
        // ":::warning ... :::" is markdown-it-container syntax, not standard markdown -
        // left as-is it would show up as literal "::: " text in the hover.
        assert.doesNotMatch(md.value, /:::/);
    });

    test('falls back to just the link (no inline excerpt) for a doc with no matching "## <name>" heading', () => {
        // bmql.md is a prose guide (Overview/Basics/SELECT/...), not a per-function
        // reference - "bmql" itself never appears as its own "## bmql" heading.
        const repoRoot = path.join(__dirname, '..');
        const info = { category: 'function', name: 'bmql', syntax: 'bmql(sqlQuery)', functionCategory: 'direct_db_access' };
        const md = formatAsJsDoc(info, { extensionPath: repoRoot });

        assert.match(md.value, /Open Full Page/);
        assert.doesNotMatch(md.value, /\n---\n\n#/); // no appended section heading
    });

    test('does not break the existing JSON-driven notes/examples rendering', () => {
        // decodebase64 has both a real bml_functions_api_usage.json "examples" entry
        // AND a "## decodebase64" section in string.md - the inline excerpt must be
        // purely additive, appended after the existing content, not a replacement.
        const repoRoot = path.join(__dirname, '..');
        const info = {
            category: 'function',
            name: 'decodebase64',
            syntax: 'decodebase64(str)',
            functionCategory: 'string',
            notes: 'Takes an encoded Base64 string and returns it as a plain text string',
            examples: ['1. decodebase64("YWJj") returns "abc".'],
        };
        const md = formatAsJsDoc(info, { extensionPath: repoRoot });

        assert.match(md.value, /\*\*Usage Notes?:\*\*/);
        assert.match(md.value, /decodebase64\("YWJj"\)/);
        assert.match(md.value, /returns "abc"/);
        assert.match(md.value, /Return Type/i); // only present in the inlined .md excerpt
    });
});
