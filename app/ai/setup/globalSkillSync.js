/**
 * Syncs BML skills from the extension's app/ai/skills/ directory into the
 * Antigravity IDE's global config skills directory (~/.gemini/config/skills/).
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

/** Resolve the Antigravity global skills directory. */
function getAgyGlobalSkillsDir() {
    return path.join(os.homedir(), '.gemini', 'config', 'skills');
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
 * Removes stale skill dirs in the global config that are no longer present in
 * the extension's skills source (e.g. after a skill is renamed or removed in
 * an extension update). Only removes dirs whose SKILL.md was authored by
 * cpq-bml (detected via the `author: cpq-bml` frontmatter field), so any
 * user-authored skills in the same global dir are never touched.
 */
function pruneStaleSkills(srcSkillsDir, destSkillsDir) {
    if (!fs.existsSync(destSkillsDir)) return;
    const srcNames = new Set(
        fs.readdirSync(srcSkillsDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name)
    );

    for (const entry of fs.readdirSync(destSkillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (srcNames.has(entry.name)) continue;

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
 * Main entry point. Syncs all BML skills from the extension source into the
 * Antigravity global config skills directory. Safe to call on every activation.
 *
 * @param {string} extensionPath - context.extensionPath
 * @returns {{ synced: number, errors: string[] }}
 */
function syncGlobalAgySkills(extensionPath) {
    const srcSkillsDir = path.join(extensionPath, 'app', 'ai', 'skills');
    const destSkillsDir = getAgyGlobalSkillsDir();

    if (!fs.existsSync(srcSkillsDir)) {
        return { synced: 0, errors: ['Source skills dir not found: ' + srcSkillsDir] };
    }

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
        pruneStaleSkills(srcSkillsDir, destSkillsDir);
    } catch (e) {
        // Non-fatal
        errors.push('Prune warning: ' + e.message);
    }

    return { synced, errors };
}

module.exports = { syncGlobalAgySkills, getAgyGlobalSkillsDir };
