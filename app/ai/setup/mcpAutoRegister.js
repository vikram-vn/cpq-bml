/**
 * Auto-registers the CPQ-BML MCP server into the global and workspace config files
 * of every supported AI coding assistant and desktop application, ensuring seamless
 * integration without manual configuration.
 *
 * Supported tools and their config file paths:
 *  - Google Gemini & Antigravity IDE : %USERPROFILE%\.gemini\config\mcp_config.json
 *  - Claude Desktop                  : %APPDATA%\Claude\claude_desktop_config.json (macOS: ~/Library/Application Support/Claude)
 *  - Claude Code CLI                 : %USERPROFILE%\.claude.json
 *  - ChatGPT Desktop & OpenAI        : %APPDATA%\ChatGPT\mcp.json, %USERPROFILE%\.chatgpt\mcp.json
 *  - Cursor IDE (Global)             : %APPDATA%\Cursor\mcp.json (macOS/Linux: ~/.cursor/mcp.json)
 *  - Cursor IDE (Workspace)          : <workspaceRoot>/.cursor/mcp.json
 *  - VS Code & Copilot (Workspace)   : <workspaceRoot>/.vscode/mcp.json
 *  - Windsurf                        : %USERPROFILE%\.codeium\windsurf\mcp_config.json
 *  - Codex CLI                       : %USERPROFILE%\.codex\config.toml (TOML)
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

function claudeDesktopConfigPath() {
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'Claude', 'claude_desktop_config.json');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    }
    return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function claudeCodeConfigPath() {
    return path.join(os.homedir(), '.claude.json');
}

function chatgptConfigPaths() {
    const paths = [];
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        paths.push(path.join(appData, 'ChatGPT', 'mcp.json'));
        paths.push(path.join(os.homedir(), '.chatgpt', 'mcp.json'));
    } else if (process.platform === 'darwin') {
        paths.push(path.join(os.homedir(), 'Library', 'Application Support', 'ChatGPT', 'mcp.json'));
        paths.push(path.join(os.homedir(), '.chatgpt', 'mcp.json'));
    } else {
        paths.push(path.join(os.homedir(), '.config', 'ChatGPT', 'mcp.json'));
        paths.push(path.join(os.homedir(), '.chatgpt', 'mcp.json'));
    }
    return paths;
}

function cursorConfigPath() {
    const appData = process.env.APPDATA || path.join(os.homedir(), '.config');
    return process.platform === 'win32'
        ? path.join(appData, 'Cursor', 'mcp.json')
        : path.join(os.homedir(), '.cursor', 'mcp.json');
}

function cursorWorkspaceConfigPath(workspaceRoot) {
    return workspaceRoot ? path.join(workspaceRoot, '.cursor', 'mcp.json') : null;
}

function vscodeWorkspaceConfigPath(workspaceRoot) {
    return workspaceRoot ? path.join(workspaceRoot, '.vscode', 'mcp.json') : null;
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
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    } catch (e) {
        console.warn(`CPQ-BML: Failed to write config to ${filePath}:`, e.message);
    }
}

// ─── TOML minimal helpers ─────────────────────────────────────────────────────

function readToml(filePath) {
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

function upsertTomlMcpServer(tomlText, serverKey, url) {
    const sectionHeader = `[mcp_servers.${serverKey}]`;
    const block = `\n${sectionHeader}\nurl = "${url}"\n`;

    const headerIdx = tomlText.indexOf(sectionHeader);
    if (headerIdx !== -1) {
        const afterHeader = headerIdx + sectionHeader.length;
        const nextSection = tomlText.indexOf('\n[', afterHeader);
        const blockEnd = nextSection !== -1 ? nextSection : tomlText.length;
        return tomlText.slice(0, headerIdx).trimEnd() + block + tomlText.slice(blockEnd);
    }

    return (tomlText.trimEnd() || '') + block;
}

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
 * Antigravity IDE & Google Gemini — uses { mcpServers: { cpq-bml: { serverUrl: "..." } } }
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
 * Claude Desktop — uses { mcpServers: { cpq-bml: { url: "..." } } }
 */
function registerClaudeDesktop(url) {
    const p = claudeDesktopConfigPath();
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { url };
    writeJson(p, cfg);
}

function deregisterClaudeDesktop() {
    const p = claudeDesktopConfigPath();
    if (!fs.existsSync(p)) return;
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * Claude Code CLI — uses { mcpServers: { cpq-bml: { type: "http", url: "..." } } }
 */
function registerClaudeCode(url) {
    const p = claudeCodeConfigPath();
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { type: 'http', url };
    writeJson(p, cfg);
}

function deregisterClaudeCode() {
    const p = claudeCodeConfigPath();
    if (!fs.existsSync(p)) return;
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * ChatGPT Desktop & OpenAI Developer MCP — uses { mcpServers: { cpq-bml: { url: "..." } } }
 */
function registerChatGPT(url) {
    for (const p of chatgptConfigPaths()) {
        const dir = path.dirname(p);
        if (fs.existsSync(dir) || p.includes('ChatGPT') || p.includes('.chatgpt')) {
            const cfg = readJson(p);
            if (!cfg.mcpServers) cfg.mcpServers = {};
            cfg.mcpServers[SERVER_KEY] = { url };
            writeJson(p, cfg);
        }
    }
}

function deregisterChatGPT() {
    for (const p of chatgptConfigPaths()) {
        if (fs.existsSync(p)) {
            const cfg = readJson(p);
            if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
                delete cfg.mcpServers[SERVER_KEY];
                writeJson(p, cfg);
            }
        }
    }
}

/**
 * Cursor Global — uses { mcpServers: { cpq-bml: { url: "..." } } }
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
    if (!fs.existsSync(p)) return;
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * Cursor Workspace — writes to <workspaceRoot>/.cursor/mcp.json
 */
function registerCursorWorkspace(url, workspaceRoot) {
    const p = cursorWorkspaceConfigPath(workspaceRoot);
    if (!p) return;
    const cfg = readJson(p);
    if (!cfg.mcpServers) cfg.mcpServers = {};
    cfg.mcpServers[SERVER_KEY] = { url };
    writeJson(p, cfg);
}

function deregisterCursorWorkspace(workspaceRoot) {
    const p = cursorWorkspaceConfigPath(workspaceRoot);
    if (!p || !fs.existsSync(p)) return;
    const cfg = readJson(p);
    if (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]) {
        delete cfg.mcpServers[SERVER_KEY];
        writeJson(p, cfg);
    }
}

/**
 * VS Code & Copilot Workspace — writes to <workspaceRoot>/.vscode/mcp.json
 */
function registerVsCodeWorkspace(url, workspaceRoot) {
    const p = vscodeWorkspaceConfigPath(workspaceRoot);
    if (!p) return;
    const cfg = readJson(p);
    if (!cfg.servers && !cfg.mcpServers) {
        cfg.servers = {};
    }
    const target = cfg.servers || cfg.mcpServers;
    target[SERVER_KEY] = {
        type: 'http',
        url,
    };
    writeJson(p, cfg);
}

function deregisterVsCodeWorkspace(workspaceRoot) {
    const p = vscodeWorkspaceConfigPath(workspaceRoot);
    if (!p || !fs.existsSync(p)) return;
    const cfg = readJson(p);
    if (cfg.servers && cfg.servers[SERVER_KEY]) {
        delete cfg.servers[SERVER_KEY];
        writeJson(p, cfg);
    }
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
    if (!fs.existsSync(p)) return;
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
 * Registers the CPQ-BML MCP server across all supported AI desktop apps and IDEs.
 * Safe to call repeatedly — idempotent, updates URL cleanly.
 *
 * @param {number} port - The MCP server port (default 47821)
 * @param {string} [workspaceRoot] - Optional workspace root for project-level configs
 * @returns {{ registered: string[], errors: {tool: string, error: string}[] }}
 */
function registerMcpWithAllTools(port, workspaceRoot) {
    const url = `http://127.0.0.1:${port}/mcp`;
    const registered = [];
    const errors = [];

    const registrations = [
        { name: 'Google Gemini & Antigravity IDE', fn: () => registerAntigravity(url) },
        { name: 'Claude Desktop', fn: () => registerClaudeDesktop(url) },
        { name: 'Claude Code', fn: () => registerClaudeCode(url) },
        { name: 'ChatGPT Desktop', fn: () => registerChatGPT(url) },
        { name: 'Cursor (Global)', fn: () => registerCursor(url) },
        { name: 'Windsurf', fn: () => registerWindsurf(url) },
        { name: 'Codex CLI', fn: () => registerCodex(url) },
    ];

    if (workspaceRoot) {
        registrations.push({ name: 'Cursor (Workspace)', fn: () => registerCursorWorkspace(url, workspaceRoot) });
        registrations.push({ name: 'VS Code & Copilot (Workspace)', fn: () => registerVsCodeWorkspace(url, workspaceRoot) });
    }

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
 * Removes the CPQ-BML MCP server entry from all AI tool configs when stopped.
 *
 * @param {string} [workspaceRoot] - Optional workspace root to clean project configs
 * @returns {{ deregistered: string[], errors: {tool: string, error: string}[] }}
 */
function deregisterMcpFromAllTools(workspaceRoot) {
    const deregistered = [];
    const errors = [];

    const deregistrations = [
        { name: 'Google Gemini & Antigravity IDE', fn: deregisterAntigravity },
        { name: 'Claude Desktop', fn: deregisterClaudeDesktop },
        { name: 'Claude Code', fn: deregisterClaudeCode },
        { name: 'ChatGPT Desktop', fn: deregisterChatGPT },
        { name: 'Cursor (Global)', fn: deregisterCursor },
        { name: 'Windsurf', fn: deregisterWindsurf },
        { name: 'Codex CLI', fn: deregisterCodex },
    ];

    if (workspaceRoot) {
        deregistrations.push({ name: 'Cursor (Workspace)', fn: () => deregisterCursorWorkspace(workspaceRoot) });
        deregistrations.push({ name: 'VS Code & Copilot (Workspace)', fn: () => deregisterVsCodeWorkspace(workspaceRoot) });
    }

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

module.exports = {
    registerMcpWithAllTools,
    deregisterMcpFromAllTools,
    antigravityConfigPath,
    claudeDesktopConfigPath,
    claudeCodeConfigPath,
    chatgptConfigPaths,
    cursorConfigPath,
    cursorWorkspaceConfigPath,
    vscodeWorkspaceConfigPath,
    windsurfConfigPath,
    codexConfigPath,
};
