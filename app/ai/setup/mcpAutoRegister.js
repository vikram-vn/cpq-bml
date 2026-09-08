/**
 * Auto-registers the CPQ-BML MCP server into the global config files of every
 * supported AI coding assistant, so users never have to configure it manually.
 *
 * Supported tools and their global config file paths (Windows):
 *  - Antigravity IDE  : %USERPROFILE%\.gemini\config\mcp_config.json
 *  - Claude Code      : %USERPROFILE%\.claude.json
 *  - Cursor           : %APPDATA%\Cursor\mcp.json
 *  - Windsurf         : %USERPROFILE%\.codeium\windsurf\mcp_config.json
 *  - Codex CLI        : %USERPROFILE%\.codex\config.toml  (TOML, not JSON)
 *
 * GitHub Copilot (VS Code) is handled separately via vscode.lm.registerMcpServerProvider
 * in app/lang/mcp/index.js — no file needed.
 *
 * Registration is idempotent: re-running at a different port updates the URL.
 * De-registration removes only the cpq-bml entry, leaving all other servers intact.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_KEY = 'cpq-bml';

// ─── Path resolvers ────────────────────────────────────────────────────────────

function antigravityConfigPath() {
    return path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
}

function claudeConfigPath() {
    return path.join(os.homedir(), '.claude.json');
}

function cursorConfigPath() {
    // Cursor stores global mcp.json in %APPDATA%\Cursor on Windows, ~/.cursor on mac/linux
    const appData = process.env.APPDATA || path.join(os.homedir(), '.config');
    return process.platform === 'win32'
        ? path.join(appData, 'Cursor', 'mcp.json')
        : path.join(os.homedir(), '.cursor', 'mcp.json');
}

function windsurfConfigPath() {
    return path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
}

function codexConfigPath() {
    return path.join(os.homedir(), '.codex', 'config.toml');
}

// ─── JSON helpers ──────────────────────────────────────────────────────────────

function readJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return {};
    }
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ─── TOML minimal helpers (no external dep) ────────────────────────────────────

/**
 * Reads config.toml and returns its raw text (or '').
 * We use simple text manipulation for TOML to avoid adding a dependency.
 */
function readToml(filePath) {
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

/**
 * Upserts a [mcp_servers.cpq-bml] section in the TOML text.
 * We inject or replace the entire cpq-bml table block.
 */
function upsertTomlMcpServer(tomlText, serverKey, url) {
    const sectionHeader = `[mcp_servers.${serverKey}]`;
    const block = `\n${sectionHeader}\nurl = "${url}"\n`;

    // If section already present, replace it
    const headerIdx = tomlText.indexOf(sectionHeader);
    if (headerIdx !== -1) {
        // Find end of this table block (next [section] or EOF)
        const afterHeader = headerIdx + sectionHeader.length;
        const nextSection = tomlText.indexOf('\n[', afterHeader);
        const blockEnd = nextSection !== -1 ? nextSection : tomlText.length;
        return tomlText.slice(0, headerIdx).trimEnd() + block + tomlText.slice(blockEnd);
    }

    // Otherwise append
    return (tomlText.trimEnd() || '') + block;
}

/**
 * Removes the [mcp_servers.cpq-bml] section from TOML text.
 */
function removeTomlMcpServer(tomlText, serverKey) {
    const sectionHeader = `[mcp_servers.${serverKey}]`;
    const headerIdx = tomlText.indexOf(sectionHeader);
    if (headerIdx === -1) return tomlText;

    const afterHeader = headerIdx + sectionHeader.length;
    const nextSection = tomlText.indexOf('\n[', afterHeader);
    const blockEnd = nextSection !== -1 ? nextSection : tomlText.length;
    return (tomlText.slice(0, headerIdx).trimEnd() + tomlText.slice(blockEnd)).trimStart();
}

// ─── Per-tool registration ────────────────────────────────────────────────────

/**
 * Antigravity IDE — uses { mcpServers: { cpq-bml: { serverUrl: "..." } } }
 */
function registerAntigravity(url) {
    const p = antigravityConfigPath();
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { serverUrl: url };
    writeJson(p, cfg);
}

function deregisterAntigravity() {
    const p = antigravityConfigPath();
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * Claude Code — uses { mcpServers: { cpq-bml: { type: "http", url: "..." } } }
 */
function registerClaude(url) {
    const p = claudeConfigPath();
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { type: 'http', url };
    writeJson(p, cfg);
}

function deregisterClaude() {
    const p = claudeConfigPath();
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * Cursor — uses { mcpServers: { cpq-bml: { url: "..." } } }
 */
function registerCursor(url) {
    const p = cursorConfigPath();
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { url };
    writeJson(p, cfg);
}

function deregisterCursor() {
    const p = cursorConfigPath();
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * Windsurf — uses { mcpServers: { cpq-bml: { serverType: "streamableHttp", url: "..." } } }
 */
function registerWindsurf(url) {
    const p = windsurfConfigPath();
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { serverType: 'streamableHttp', url };
    writeJson(p, cfg);
}

function deregisterWindsurf() {
    const p = windsurfConfigPath();
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * Codex CLI — uses TOML: [mcp_servers.cpq-bml] / url = "..."
 */
function registerCodex(url) {
    const p = codexConfigPath();
    const raw = readToml(p);
    const updated = upsertTomlMcpServer(raw, SERVER_KEY, url);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, updated, 'utf8');
}

function deregisterCodex() {
    const p = codexConfigPath();
    if (!fs.existsSync(p)) return;
    const raw = readToml(p);
    const updated = removeTomlMcpServer(raw, SERVER_KEY);
    fs.writeFileSync(p, updated, 'utf8');
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Registers the CPQ-BML MCP server in all supported AI tool global configs.
 * Safe to call repeatedly — idempotent, only updates the cpq-bml entry.
 *
 * @param {number} port - The MCP server port (default 47821)
 * @returns {{ registered: string[], errors: {tool: string, error: string}[] }}
 */
function registerMcpWithAllTools(port) {
    const url = `http://127.0.0.1:${port}/mcp`;
    const registered = [];
    const errors = [];

    const registrations = [
        { name: 'Antigravity IDE', fn: () => registerAntigravity(url) },
        { name: 'Claude Code', fn: () => registerClaude(url) },
        { name: 'Cursor', fn: () => registerCursor(url) },
        { name: 'Windsurf', fn: () => registerWindsurf(url) },
        { name: 'Codex CLI', fn: () => registerCodex(url) },
    ];

    for (const { name, fn } of registrations) {
        try {
            fn();
            registered.push(name);
        } catch (e) {
            errors.push({ tool: name, error: e.message });
        }
    }

    return { registered, errors };
}

/**
 * Removes the CPQ-BML MCP server entry from all supported AI tool global configs.
 * Called when the MCP server is disabled. Leaves all other servers intact.
 *
 * @returns {{ deregistered: string[], errors: {tool: string, error: string}[] }}
 */
function deregisterMcpFromAllTools() {
    const deregistered = [];
    const errors = [];

    const deregistrations = [
        { name: 'Antigravity IDE', fn: deregisterAntigravity },
        { name: 'Claude Code', fn: deregisterClaude },
        { name: 'Cursor', fn: deregisterCursor },
        { name: 'Windsurf', fn: deregisterWindsurf },
        { name: 'Codex CLI', fn: deregisterCodex },
    ];

    for (const { name, fn } of deregistrations) {
        try {
            fn();
            deregistered.push(name);
        } catch (e) {
            errors.push({ tool: name, error: e.message });
        }
    }

    return { deregistered, errors };
}

module.exports = { registerMcpWithAllTools, deregisterMcpFromAllTools };
