/**
 * Ultra-fast programmatic build runner for CPQ-BML extension.
 * Eliminates all subshell and python process overhead by executing esbuild
 * and asset minification/compression natively inside a single Node.js process.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { performance } = require('perf_hooks');

const ROOT = path.join(__dirname, '..', '..');
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

async function compileExtension() {
    const t0 = performance.now();

    // 1. Parallel esbuild tasks (extension + webview)
    const buildExt = esbuild.build({
        entryPoints: [path.join(ROOT, 'extension.js')],
        outfile: path.join(ROOT, 'dist', 'extension.js'),
        bundle: true,
        external: ['vscode'],
        format: 'cjs',
        platform: 'node',
        nodePaths: [path.join(ROOT, 'node_modules')],
        minify: isProduction,
        legalComments: isProduction ? 'none' : 'inline',
        define: isProduction ? { 'process.env.NODE_ENV': '"production"' } : undefined
    });

    const buildWebview = esbuild.build({
        entryPoints: [path.join(ROOT, 'app', 'lang', 'settings-panel', 'web-view', 'src', 'index.jsx')],
        outfile: path.join(ROOT, 'app', 'lang', 'settings-panel', 'web-view', 'dist', 'main.js'),
        bundle: true,
        format: 'iife',
        platform: 'browser',
        jsx: 'automatic',
        nodePaths: [path.join(ROOT, 'node_modules')],
        minify: isProduction,
        legalComments: isProduction ? 'none' : 'inline',
        define: isProduction ? { 'process.env.NODE_ENV': '"production"' } : undefined
    });

    // 2. Dictionaries (.txt -> .txt.br)
    const spellCheckDir = path.join(ROOT, 'app', 'lang', 'spell-check');
    const dictFiles = ['bml-words.txt', 'english-words.txt'];
    for (const file of dictFiles) {
        const srcPath = path.join(spellCheckDir, file);
        const outPath = srcPath + '.br';
        if (!fs.existsSync(outPath) || fs.statSync(outPath).mtimeMs < fs.statSync(srcPath).mtimeMs) {
            const data = fs.readFileSync(srcPath);
            const compressed = zlib.brotliCompressSync(data, {
                params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 }
            });
            fs.writeFileSync(outPath, compressed);
        }
    }

    // 3. CSS minification (.css -> .min.css)
    const cssDir = path.join(ROOT, 'app', 'lang', 'settings-panel', 'web-view', 'css');
    const cssFiles = ['main.css', 'layout.css', 'components.css'];
    for (const file of cssFiles) {
        const srcPath = path.join(cssDir, file);
        const outPath = path.join(cssDir, file.replace('.css', '.min.css'));
        if (!fs.existsSync(outPath) || fs.statSync(outPath).mtimeMs < fs.statSync(srcPath).mtimeMs) {
            const src = fs.readFileSync(srcPath, 'utf8');
            const minified = src
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\s+/g, ' ')
                .replace(/\s*([{}:;,])\s*/g, '$1')
                .trim();
            fs.writeFileSync(outPath, minified, 'utf8');
        }
    }

    // 4. JSON minification (.json -> .min.json)
    const intellisenseDir = path.join(ROOT, 'app', 'lang', 'intellisense');
    const jsonFiles = [
        path.join(ROOT, 'themes', 'dark-default.json'),
        path.join(ROOT, 'themes', 'dark.json'),
        path.join(ROOT, 'themes', 'light-default.json'),
        path.join(ROOT, 'themes', 'light.json'),
        path.join(ROOT, 'themes', 'bml-icons.json'),
        path.join(ROOT, 'app', 'lang', 'syntaxes', 'bml.tmLanguage.json'),
        path.join(ROOT, 'app', 'lang', 'syntaxes', 'xslt.tmLanguage.json'),
        path.join(intellisenseDir, 'bml-functions-api-usage.json'),
        path.join(intellisenseDir, 'bml-attributes-api-usage.json'),
        path.join(intellisenseDir, 'bml-cpq-js-api-usage.json'),
        path.join(intellisenseDir, 'bml-util-attributes-api-usage.json'),
        path.join(intellisenseDir, 'bml-variables-api-usage.json'),
        path.join(intellisenseDir, 'custom-snippets.json'),
        path.join(intellisenseDir, 'function-param-data-types.json'),
        path.join(intellisenseDir, 'function-return-types.json'),
        path.join(intellisenseDir, 'best-practice-advisories.json'),
        path.join(intellisenseDir, 'keyword-hovers.json'),
        path.join(intellisenseDir, 'category-labels.json'),
        path.join(intellisenseDir, 'curated-params.json'),
    ];

    for (const srcPath of jsonFiles) {
        const outPath = srcPath.replace('.json', '.min.json');
        if (!fs.existsSync(outPath) || fs.statSync(outPath).mtimeMs < fs.statSync(srcPath).mtimeMs) {
            const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
            fs.writeFileSync(outPath, JSON.stringify(data), 'utf8');
        }
    }

    // 5. AI Skills Compression (knowledge -> dist/ai.br)
    const aiDestFile = path.join(ROOT, 'dist', 'ai.br');
    const srcKnowledgeDir = path.join(ROOT, 'knowledge', 'BML');
    let aiUpToDate = fs.existsSync(aiDestFile);
    if (aiUpToDate) {
        const aiMtime = fs.statSync(aiDestFile).mtimeMs;
        if (fs.existsSync(srcKnowledgeDir)) {
            const checkDir = (dir) => {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) checkDir(fullPath);
                    else if (fs.statSync(fullPath).mtimeMs > aiMtime) aiUpToDate = false;
                }
            };
            checkDir(srcKnowledgeDir);
        }
    }

    if (!aiUpToDate) {
        const payload = {};
        const collectFiles = (dir, baseDir) => {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) collectFiles(fullPath, baseDir);
                else if (entry.isFile()) {
                    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                    payload[relPath] = fs.readFileSync(fullPath, 'utf8');
                }
            }
        };

        const aiDir = path.join(ROOT, 'app', 'ai');
        const skillsDir = path.join(aiDir, 'skills');
        if (fs.existsSync(skillsDir)) collectFiles(skillsDir, aiDir);

        const summaryFile = path.join(aiDir, 'bml-skills.md');
        if (fs.existsSync(summaryFile)) {
            payload['bml-skills.md'] = fs.readFileSync(summaryFile, 'utf8');
        }

        fs.mkdirSync(path.dirname(aiDestFile), { recursive: true });
        const jsonBuffer = Buffer.from(JSON.stringify(payload));
        const compressed = zlib.brotliCompressSync(jsonBuffer, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 }
        });
        fs.writeFileSync(aiDestFile, compressed);
    }

    // Await both esbuild tasks
    await Promise.all([buildExt, buildWebview]);

    const t1 = performance.now();
    console.log(`Compile finished in ${(t1 - t0).toFixed(1)}ms`);
}

compileExtension().catch((err) => {
    console.error('Compile error:', err);
    process.exit(1);
});
