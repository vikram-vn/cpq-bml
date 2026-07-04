const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Regression guard for a real bug: app/knowledge/BML/String.md was moved into
// app/knowledge/BML/string/string.md (to match every other category's
// <category>/<name>.md layout), but its image references were left as
// "images/foo.png" instead of "../images/foo.png" - the correct relative path
// from a nested category folder up to the shared images/ directory. helpViewer.js
// resolves image src attributes relative to the .md file's own directory, so
// every one of those 29 references pointed at a nonexistent
// app/knowledge/BML/string/images/ path: broken images in the rendered doc,
// and the webview waiting on 29 failed vscode-resource loads before settling.
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'app', 'knowledge', 'BML');
const IMAGE_REF_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

function findMarkdownFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findMarkdownFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(full);
        }
    }
    return results;
}

suite('knowledge base - image references', () => {
    test('every ![]() image reference in every .md file resolves to a real file on disk', () => {
        const failures = [];
        for (const mdPath of findMarkdownFiles(KNOWLEDGE_DIR)) {
            const content = fs.readFileSync(mdPath, 'utf8');
            const mdDir = path.dirname(mdPath);
            let match;
            while ((match = IMAGE_REF_RE.exec(content)) !== null) {
                const rel = match[1];
                if (/^https?:\/\//i.test(rel)) continue;
                const abs = path.normalize(path.join(mdDir, rel));
                if (!fs.existsSync(abs)) {
                    failures.push(`${path.relative(KNOWLEDGE_DIR, mdPath)} -> ${rel}`);
                }
            }
        }
        assert.deepStrictEqual(failures, []);
    });
});
