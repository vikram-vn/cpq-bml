/**
 * AI setup entry point.
 *
 * File-based scaffolding (writing .claude/, .cursor/, .agents/, etc. into the
 * user's workspace) has been REMOVED. BML skills are now delivered exclusively
 * via the MCP server at runtime — no workspace clutter, works with every AI
 * coding assistant (Claude Code, Cursor, GitHub Copilot, Codex CLI, Antigravity
 * IDE, etc.) that supports MCP.
 *
 * This module now only re-exports workspace cleaner utilities so that the
 * messageHandler can remove any legacy AI files the user may have on disk
 * from a prior version of the extension.
 */
const { syncFilesExclude, cleanAllAiWorkspaceFiles, removeAgentSkills } = require('./workspaceAiCleaner');

module.exports = {
    syncFilesExclude,
    cleanAllAiWorkspaceFiles,
    removeAgentSkills,
};
