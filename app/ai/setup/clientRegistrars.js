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

// ─── JSON / TOML helpers ───────────────────────────────────────────────────────

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

// ─── Per-client registration & deregistration ──────────────────────────────────

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

module.exports = {
    SERVER_KEY,
    antigravityConfigPath,
    claudeDesktopConfigPath,
    claudeCodeConfigPath,
    chatgptConfigPaths,
    cursorConfigPath,
    cursorWorkspaceConfigPath,
    vscodeWorkspaceConfigPath,
    windsurfConfigPath,
    codexConfigPath,
    readJson,
    writeJson,
    readToml,
    registerAntigravity,
    deregisterAntigravity,
    registerClaudeDesktop,
    deregisterClaudeDesktop,
    registerClaudeCode,
    deregisterClaudeCode,
    registerChatGPT,
    deregisterChatGPT,
    registerCursor,
    deregisterCursor,
    registerCursorWorkspace,
    deregisterCursorWorkspace,
    registerVsCodeWorkspace,
    deregisterVsCodeWorkspace,
    registerWindsurf,
    deregisterWindsurf,
    registerCodex,
    deregisterCodex,
};
