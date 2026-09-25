const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { normalizeToolArgs } = require('@/lang/mcp/toolArgs');
const { getApiContext } = require('@/lang/rest/apiCore');

let cachedAiBundle = null;
function getAiBundle(extensionPath) {
    if (cachedAiBundle) return cachedAiBundle;
    const candidates = [
        path.join(extensionPath, 'dist', 'ai.br'),
        path.join(__dirname, '..', '..', '..', '..', 'dist', 'ai.br'),
        path.join(__dirname, 'ai.br'),
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) {
            try {
                const decomp = zlib.brotliDecompressSync(fs.readFileSync(file)).toString('utf8');
                cachedAiBundle = JSON.parse(decomp);
                return cachedAiBundle;
            } catch (_) {}
        }
    }
    return null;
}

/**
 * Lists all built-in Oracle CPQ and BML AI skills with their metadata.
 */
function listSkills(options = {}) {
    const { context } = normalizeToolArgs(arguments);
    const extensionPath = (context && context.extensionPath) || (getApiContext().context && getApiContext().context.extensionPath) || path.resolve(__dirname, '..', '..', '..', '..');
    const skillsDir = path.join(extensionPath, 'app', 'ai', 'skills');

    if (fs.existsSync(skillsDir)) {
        const skills = [];
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const skillName = entry.name;
            const skillMd = path.join(skillsDir, skillName, 'SKILL.md');
            let description = '';
            if (fs.existsSync(skillMd)) {
                try {
                    const content = fs.readFileSync(skillMd, 'utf8');
                    const descMatch = content.match(/description:\s*(?:>-\s*|\s*)([^\r\n]+)/i);
                    if (descMatch) description = descMatch[1].trim();
                } catch (e) {}
            }
            const refsDir = path.join(skillsDir, skillName, 'references');
            const hasReferences = fs.existsSync(refsDir) && fs.readdirSync(refsDir).length > 0;
            skills.push({
                name: skillName,
                description: description || `Oracle CPQ BigMachines ${skillName} skill`,
                hasReferences,
            });
        }
        return { success: true, skills };
    }

    const bundle = getAiBundle(extensionPath);
    if (bundle) {
        const skillNames = new Set();
        for (const key of Object.keys(bundle)) {
            const m = key.match(/^skills\/([^/]+)\/SKILL\.md$/i);
            if (m) skillNames.add(m[1]);
        }
        const skills = [];
        for (const name of Array.from(skillNames).sort()) {
            const skillMdKey = `skills/${name}/SKILL.md`;
            const content = bundle[skillMdKey] || '';
            const descMatch = content.match(/description:\s*(?:>-\s*|\s*)([^\r\n]+)/i);
            const description = descMatch ? descMatch[1].trim() : `Oracle CPQ BigMachines ${name} skill`;
            const hasReferences = Object.keys(bundle).some(k => k.startsWith(`skills/${name}/references/`));
            skills.push({
                name,
                description,
                hasReferences,
            });
        }
        return { success: true, skills };
    }

    return { success: true, skills: [] };
}

/**
 * Fetches the full instructions and reference documents for a specific CPQ/BML skill.
 */
function getSkill(options = {}) {
    const { context, args } = normalizeToolArgs(arguments);
    const name = (args && args.name) || (typeof arguments[0] === 'string' ? arguments[0] : (arguments[1] && arguments[1].name));
    if (!name || typeof name !== 'string') {
        return { success: false, error: 'Skill name is required (e.g. "bml-language", "bml-pitfalls", "bml-db-access").' };
    }

    const safeName = name.trim().toLowerCase();
    const extensionPath = (context && context.extensionPath) || (getApiContext().context && getApiContext().context.extensionPath) || path.resolve(__dirname, '..', '..', '..', '..');
    const skillDir = path.join(extensionPath, 'app', 'ai', 'skills', safeName);
    const skillMd = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(skillMd)) {
        let content = '';
        try {
            content = fs.readFileSync(skillMd, 'utf8');
        } catch (e) {
            return { success: false, error: `Failed to read SKILL.md: ${e.message}` };
        }
        const descMatch = content.match(/description:\s*(?:>-\s*|\s*)([^\r\n]+)/i);
        const description = descMatch ? descMatch[1].trim() : `Oracle CPQ BigMachines ${safeName} skill`;

        const references = [];
        const refsDir = path.join(skillDir, 'references');
        if (fs.existsSync(refsDir)) {
            try {
                for (const f of fs.readdirSync(refsDir)) {
                    const refPath = path.join(refsDir, f);
                    if (fs.statSync(refPath).isFile()) {
                        references.push({
                            filename: f,
                            content: fs.readFileSync(refPath, 'utf8'),
                        });
                    }
                }
            } catch (e) {}
        }
        return {
            success: true,
            name: safeName,
            description,
            content,
            references,
        };
    }

    const bundle = getAiBundle(extensionPath);
    if (bundle) {
        const skillMdKey = `skills/${safeName}/SKILL.md`;
        if (bundle[skillMdKey]) {
            const content = bundle[skillMdKey];
            const descMatch = content.match(/description:\s*(?:>-\s*|\s*)([^\r\n]+)/i);
            const description = descMatch ? descMatch[1].trim() : `Oracle CPQ BigMachines ${safeName} skill`;
            const prefix = `skills/${safeName}/references/`;
            const references = [];
            for (const [k, v] of Object.entries(bundle)) {
                if (k.startsWith(prefix)) {
                    references.push({
                        filename: path.basename(k),
                        content: v,
                    });
                }
            }
            return {
                success: true,
                name: safeName,
                description,
                content,
                references,
            };
        }
    }

    return { success: false, error: `Skill "${safeName}" not found. Call list_skills to see all available skills.` };
}

module.exports = {
    listSkills,
    getSkill,
    getAiBundle,
};
