/**
 * Syncs BML skills from the extension's app/ai/skills/ directory (or the compressed
 * dist/ai.br bundle in packaged environments) into the Antigravity IDE's global
 * config skills directory (~/.gemini/config/skills/).
 *
 * This gives Antigravity IDE on-demand native skill access (name-matched,
 * progressively loaded) in addition to the MCP instructions payload it already
 * receives when connected to the CPQ-BML MCP server. Zero workspace impact —
 * everything lands in the user's personal global config dir, not the project.
 *
 * Other AI tools (Claude Code, Cursor, Copilot, Codex CLI) receive skills
 * exclusively via the MCP server's instructions field — no files needed.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

/** Resolve the Antigravity global skills directory. */
function getAgyGlobalSkillsDir() {
    return path.join(os.homedir(), '.gemini', 'config', 'skills');
}

/**
 * Resolve the root path of the extension, falling back to global context or dirname.
 */
function resolveExtensionRoot(extensionPath) {
    if (extensionPath && typeof extensionPath === 'string' && fs.existsSync(extensionPath)) {
        return extensionPath;
    }
    try {
        const { getContext } = require('@/extensionContext');
        const ctx = getContext();
        if (ctx && ctx.extensionPath && fs.existsSync(ctx.extensionPath)) {
            return ctx.extensionPath;
        }
    } catch (_) {}

    // Fallbacks relative to __dirname:
    // When running from source: app/ai/setup/globalSkillSync.js -> 3 levels up
    const relRoot = path.resolve(__dirname, '..', '..', '..');
    if (fs.existsSync(relRoot)) {
        return relRoot;
    }
    // When bundled into dist/extension.js: dist/ -> 1 level up
    const distRoot = path.resolve(__dirname, '..');
    if (fs.existsSync(distRoot)) {
        return distRoot;
    }
    return extensionPath || process.cwd();
}

/**
 * Attempt to load the pre-compressed AI skills bundle (dist/ai.br).
 */
function getAiBundle(extensionRoot) {
    if (!extensionRoot) return null;
    const candidates = [
        path.join(extensionRoot, 'dist', 'ai.br'),
        path.join(extensionRoot, 'ai.br'),
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) {
            try {
                const decomp = zlib.brotliDecompressSync(fs.readFileSync(file)).toString('utf8');
                return JSON.parse(decomp);
            } catch (_) {}
        }
    }
    return null;
}

/**
 * Copy a single skill directory (SKILL.md + references/) from src → dest.
 * Only writes when content has actually changed, to avoid unnecessary I/O.
 */
function syncSkillDir(srcSkillDir, destSkillDir) {
    const srcSkillFile = path.join(srcSkillDir, 'SKILL.md');
    if (!fs.existsSync(srcSkillFile)) return false;

    fs.mkdirSync(destSkillDir, { recursive: true });

    // Sync SKILL.md
    const srcContent = fs.readFileSync(srcSkillFile, 'utf8');
    const destSkillFile = path.join(destSkillDir, 'SKILL.md');
    const existingContent = fs.existsSync(destSkillFile) ? fs.readFileSync(destSkillFile, 'utf8') : null;
    if (existingContent !== srcContent) {
        fs.writeFileSync(destSkillFile, srcContent, 'utf8');
    }

    // Sync references/ if present
    const srcRefsDir = path.join(srcSkillDir, 'references');
    if (fs.existsSync(srcRefsDir)) {
        const destRefsDir = path.join(destSkillDir, 'references');
        fs.mkdirSync(destRefsDir, { recursive: true });
        for (const refFile of fs.readdirSync(srcRefsDir)) {
            const srcRef = path.join(srcRefsDir, refFile);
            const destRef = path.join(destRefsDir, refFile);
            const refSrc = fs.readFileSync(srcRef, 'utf8');
            const refDest = fs.existsSync(destRef) ? fs.readFileSync(destRef, 'utf8') : null;
            if (refSrc !== refDest) {
                fs.writeFileSync(destRef, refSrc, 'utf8');
            }
        }
    }

    return true;
}

/**
 * Sync skills from the unpacked dist/ai.br brotli bundle.
 */
function syncSkillsFromBundle(bundle, destSkillsDir) {
    const errors = [];
    let synced = 0;
    const skillsMap = new Map();

    for (const [key, content] of Object.entries(bundle)) {
        const match = key.match(/^skills\/([^/]+)\/(.+)$/);
        if (!match) continue;
        const [, skillName, subPath] = match;
        if (!skillsMap.has(skillName)) {
            skillsMap.set(skillName, []);
        }
        skillsMap.get(skillName).push({ subPath, content });
    }

    fs.mkdirSync(destSkillsDir, { recursive: true });

    for (const [skillName, files] of skillsMap.entries()) {
        try {
            const skillDir = path.join(destSkillsDir, skillName);
            for (const { subPath, content } of files) {
                const targetFile = path.join(skillDir, ...subPath.split('/'));
                fs.mkdirSync(path.dirname(targetFile), { recursive: true });
                const existing = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : null;
                if (existing !== content) {
                    fs.writeFileSync(targetFile, content, 'utf8');
                }
            }
            synced++;
        } catch (err) {
            errors.push(`${skillName}: ${err.message}`);
        }
    }

    // Remove skills that no longer exist
    try {
        pruneStaleSkills(new Set(skillsMap.keys()), destSkillsDir);
    } catch (e) {
        errors.push('Prune warning: ' + e.message);
    }

    return { synced, errors };
}

/**
 * Sync skills from a raw filesystem directory.
 */
function syncSkillsFromDir(srcSkillsDir, destSkillsDir) {
    const errors = [];
    let synced = 0;

    let skillDirs;
    try {
        skillDirs = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name);
    } catch (e) {
        return { synced: 0, errors: ['Failed to read source skills dir: ' + e.message] };
    }

    for (const skillName of skillDirs) {
        try {
            const ok = syncSkillDir(
                path.join(srcSkillsDir, skillName),
                path.join(destSkillsDir, skillName)
            );
            if (ok) synced++;
        } catch (e) {
            errors.push(`${skillName}: ${e.message}`);
        }
    }

    // Remove skills that no longer exist in the extension
    try {
        pruneStaleSkills(new Set(skillDirs), destSkillsDir);
    } catch (e) {
        errors.push('Prune warning: ' + e.message);
    }

    return { synced, errors };
}

/**
 * Removes stale skill dirs in the global config that are no longer present in
 * the extension's skills source (e.g. after a skill is renamed or removed in
 * an extension update). Only removes dirs whose SKILL.md was authored by
 * cpq-bml (detected via the `author: cpq-bml` frontmatter field), so any
 * user-authored skills in the same global dir are never touched.
 */
function pruneStaleSkills(knownSkillNames, destSkillsDir) {
    if (!fs.existsSync(destSkillsDir)) return;
    const validNames = new Set(knownSkillNames);

    for (const entry of fs.readdirSync(destSkillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (validNames.has(entry.name)) continue;

        // Only remove if the skill was written by us
        const skillFile = path.join(destSkillsDir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
            const content = fs.readFileSync(skillFile, 'utf8');
            if (!content.includes('author: cpq-bml')) continue; // not ours - leave it
        }
        try {
            fs.rmSync(path.join(destSkillsDir, entry.name), { recursive: true, force: true });
        } catch (e) {
            // Non-fatal - stale skill stays
        }
    }
}

/**
 * Main entry point. Syncs all BML skills from the extension source or dist/ai.br
 * into the Antigravity global config skills directory. Safe to call on every activation.
 *
 * @param {string} [extensionPath] - context.extensionPath (optional; auto-resolves if omitted)
 * @returns {{ synced: number, errors: string[] }}
 */
function syncGlobalAgySkills(extensionPath) {
    const rootPath = resolveExtensionRoot(extensionPath);
    const srcSkillsDir = path.join(rootPath, 'app', 'ai', 'skills');
    const destSkillsDir = getAgyGlobalSkillsDir();

    // 1. Prefer raw source directory if it exists
    if (fs.existsSync(srcSkillsDir)) {
        return syncSkillsFromDir(srcSkillsDir, destSkillsDir);
    }

    // 2. Fall back to compressed dist/ai.br bundle (packaged VSIX environment)
    const bundle = getAiBundle(rootPath);
    if (bundle) {
        return syncSkillsFromBundle(bundle, destSkillsDir);
    }

    return {
        synced: 0,
        errors: [`BML skills source not found: neither "${srcSkillsDir}" nor "dist/ai.br" could be located`],
    };
}

module.exports = { syncGlobalAgySkills, getAgyGlobalSkillsDir, resolveExtensionRoot };

