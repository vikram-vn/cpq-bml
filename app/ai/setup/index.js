/**
 * AI setup entry point.
 *
 * File-based scaffolding (writing .claude/, .cursor/, .agents/, etc. into the
 * user's workspace) has been removed. BML skills are delivered dynamically via the MCP server
 * at runtime and global Antigravity synchronization.
 */

/**
 * Pulls "name" and "description" out of a SKILL.md's YAML frontmatter, handling
 * both inline scalars (`description: foo`) and folded block scalars
 * (`description: >-` or `description: |-` followed by indented lines).
 */
function parseSkillFrontmatter(skillMdContent) {
    const match = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { name: null, description: '', body: skillMdContent.trim() };

    const [, frontmatter, body] = match;
    const lines = frontmatter.split(/\r?\n/);
    let name = null;
    let description = '';

    for (let i = 0; i < lines.length; i++) {
        const nameMatch = lines[i].match(/^name:\s*(.+)$/);
        if (nameMatch) name = nameMatch[1].trim();

        const descMatch = lines[i].match(/^description:\s*(.*)$/);
        if (descMatch) {
            const inline = descMatch[1].trim();
            if (inline && !/^[>|][-+]?$/.test(inline)) {
                description = inline.replace(/^["']|["']$/g, '');
            } else {
                const folded = [];
                let j = i + 1;
                while (j < lines.length && /^\s+\S/.test(lines[j])) {
                    folded.push(lines[j].trim());
                    j++;
                }
                description = folded.join(' ').trim();
            }
        }
    }

    return { name, description, body: body.trim() };
}

module.exports = {
    parseSkillFrontmatter,
};
