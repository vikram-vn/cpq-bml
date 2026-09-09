const fs = require('fs');
const path = require('path');
const os = require('os');
const {
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
} = require('./clientRegistrars');

function getMcpPortFromSettings(fallbackPort = 47821) {
    try {
        const vscode = require('vscode');
        if (vscode && vscode.workspace && typeof vscode.workspace.getConfiguration === 'function') {
            const cfg = vscode.workspace.getConfiguration('cpqBml');
            return cfg.get('mcp.port', fallbackPort) || fallbackPort;
        }
    } catch {
        // standalone or test environment without vscode runtime
    }
    return fallbackPort;
}

/**
 * Checks whether a tool's configuration path or application directory is available on the machine.
 * If not installed or directory not present, the tool is skipped.
 */
function isToolAvailable(toolKey, workspaceRoot, forceAll = false) {
    if (forceAll) return true;
    switch (toolKey) {
        case 'antigravity':
            return fs.existsSync(antigravityConfigPath()) ||
                   fs.existsSync(path.dirname(antigravityConfigPath())) ||
                   fs.existsSync(path.join(os.homedir(), '.gemini'));
        case 'claudeDesktop':
            return fs.existsSync(claudeDesktopConfigPath()) ||
                   fs.existsSync(path.dirname(claudeDesktopConfigPath()));
        case 'claudeCode':
            return fs.existsSync(claudeCodeConfigPath()) ||
                   fs.existsSync(path.join(os.homedir(), '.claude'));
        case 'chatgpt':
            return chatgptConfigPaths().some(p => fs.existsSync(p) || fs.existsSync(path.dirname(p)));
        case 'cursor':
            return fs.existsSync(cursorConfigPath()) ||
                   fs.existsSync(path.dirname(cursorConfigPath())) ||
                   fs.existsSync(path.join(os.homedir(), '.cursor'));
        case 'cursorWs':
            return !!workspaceRoot && (
                fs.existsSync(path.join(workspaceRoot, '.cursor')) ||
                fs.existsSync(path.join(workspaceRoot, '.cursor', 'mcp.json'))
            );
        case 'vscodeWs':
            return !!workspaceRoot && (
                fs.existsSync(path.join(workspaceRoot, '.vscode')) ||
                fs.existsSync(path.join(workspaceRoot, '.vscode', 'mcp.json'))
            );
        case 'windsurf':
            return fs.existsSync(windsurfConfigPath()) ||
                   fs.existsSync(path.dirname(windsurfConfigPath())) ||
                   fs.existsSync(path.join(os.homedir(), '.codeium'));
        case 'codex':
            return fs.existsSync(codexConfigPath()) ||
                   fs.existsSync(path.dirname(codexConfigPath())) ||
                   fs.existsSync(path.join(os.homedir(), '.codex'));
        default:
            return false;
    }
}

/**
 * Registers the CPQ-BML MCP server across all supported AI desktop apps and IDEs.
 * Safe to call repeatedly — idempotent, updates URL cleanly.
 * If tool paths/directories are not available on this machine, they are skipped.
 *
 * @param {number} [port] - The MCP server port (defaults to port from settings, or 47821)
 * @param {string} [workspaceRoot] - Optional workspace root for project-level configs
 * @param {object} [options] - Optional settings ({ forceAll: boolean })
 * @returns {{ registered: string[], skipped: string[], errors: {tool: string, error: string}[] }}
 */
function registerMcpWithAllTools(port, workspaceRoot, options = {}) {
    const actualPort = port || getMcpPortFromSettings();
    const url = `http://127.0.0.1:${actualPort}/mcp`;
    const registered = [];
    const skipped = [];
    const errors = [];
    const forceAll = !!(options && options.forceAll);

    const registrations = [
        { key: 'antigravity', name: 'Google Gemini & Antigravity IDE', fn: () => registerAntigravity(url) },
        { key: 'claudeDesktop', name: 'Claude Desktop', fn: () => registerClaudeDesktop(url) },
        { key: 'claudeCode', name: 'Claude Code', fn: () => registerClaudeCode(url) },
        { key: 'chatgpt', name: 'ChatGPT Desktop', fn: () => registerChatGPT(url) },
        { key: 'cursor', name: 'Cursor (Global)', fn: () => registerCursor(url) },
        { key: 'windsurf', name: 'Windsurf', fn: () => registerWindsurf(url) },
        { key: 'codex', name: 'Codex CLI', fn: () => registerCodex(url) },
    ];

    if (workspaceRoot) {
        registrations.push({ key: 'cursorWs', name: 'Cursor (Workspace)', fn: () => registerCursorWorkspace(url, workspaceRoot) });
        registrations.push({ key: 'vscodeWs', name: 'VS Code & Copilot (Workspace)', fn: () => registerVsCodeWorkspace(url, workspaceRoot) });
    }

    for (const { key, name, fn } of registrations) {
        if (!isToolAvailable(key, workspaceRoot, forceAll)) {
            skipped.push(name);
            continue;
        }
        try {
            fn();
            registered.push(name);
        } catch (e) {
            errors.push({ tool: name, error: e.message });
        }
    }

    return { registered, skipped, errors };
}

/**
 * Removes the CPQ-BML MCP server entry from all AI tool configs when stopped.
 * Only touches files that actually exist.
 *
 * @param {string} [workspaceRoot] - Optional workspace root to clean project configs
 * @returns {{ deregistered: string[], errors: {tool: string, error: string}[] }}
 */
function deregisterMcpFromAllTools(workspaceRoot) {
    const deregistered = [];
    const errors = [];

    const deregistrations = [
        { name: 'Google Gemini & Antigravity IDE', path: antigravityConfigPath(), fn: deregisterAntigravity },
        { name: 'Claude Desktop', path: claudeDesktopConfigPath(), fn: deregisterClaudeDesktop },
        { name: 'Claude Code', path: claudeCodeConfigPath(), fn: deregisterClaudeCode },
        { name: 'ChatGPT Desktop', paths: chatgptConfigPaths(), fn: deregisterChatGPT },
        { name: 'Cursor (Global)', path: cursorConfigPath(), fn: deregisterCursor },
        { name: 'Windsurf', path: windsurfConfigPath(), fn: deregisterWindsurf },
        { name: 'Codex CLI', path: codexConfigPath(), fn: deregisterCodex },
    ];

    if (workspaceRoot) {
        deregistrations.push({ name: 'Cursor (Workspace)', path: cursorWorkspaceConfigPath(workspaceRoot), fn: () => deregisterCursorWorkspace(workspaceRoot) });
        deregistrations.push({ name: 'VS Code & Copilot (Workspace)', path: vscodeWorkspaceConfigPath(workspaceRoot), fn: () => deregisterVsCodeWorkspace(workspaceRoot) });
    }

    for (const item of deregistrations) {
        const fileExists = item.paths ? item.paths.some(p => fs.existsSync(p)) : (item.path && fs.existsSync(item.path));
        if (!fileExists) continue;

        try {
            item.fn();
            deregistered.push(item.name);
        } catch (e) {
            errors.push({ tool: item.name, error: e.message });
        }
    }

    return { deregistered, errors };
}

function isToolRegistered(toolKey, workspaceRoot) {
    try {
        switch (toolKey) {
            case 'antigravity': {
                const cfg = readJson(antigravityConfigPath());
                return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
            }
            case 'claudeDesktop': {
                const cfg = readJson(claudeDesktopConfigPath());
                return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
            }
            case 'claudeCode': {
                const cfg = readJson(claudeCodeConfigPath());
                return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
            }
            case 'chatgpt': {
                return chatgptConfigPaths().some(p => {
                    const cfg = readJson(p);
                    return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
                });
            }
            case 'cursor': {
                const cfg = readJson(cursorConfigPath());
                return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
            }
            case 'cursorWs': {
                const p = cursorWorkspaceConfigPath(workspaceRoot);
                if (!p) return false;
                const cfg = readJson(p);
                return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
            }
            case 'vscodeWs': {
                const p = vscodeWorkspaceConfigPath(workspaceRoot);
                if (!p) return false;
                const cfg = readJson(p);
                return !!((cfg.servers && cfg.servers[SERVER_KEY]) || (cfg.mcpServers && cfg.mcpServers[SERVER_KEY]));
            }
            case 'windsurf': {
                const cfg = readJson(windsurfConfigPath());
                return !!(cfg.mcpServers && cfg.mcpServers[SERVER_KEY]);
            }
            case 'codex': {
                const raw = readToml(codexConfigPath());
                return raw.includes(`[mcp_servers.${SERVER_KEY}]`);
            }
            default:
                return false;
        }
    } catch {
        return false;
    }
}

/**
 * Returns the status of all supported AI assistants on this machine.
 *
 * @param {string} [workspaceRoot]
 * @returns {Array<{ key: string, name: string, installed: boolean, registered: boolean, configPath: string }>}
 */
function getAiToolsStatus(workspaceRoot) {
    const tools = [
        { key: 'antigravity', name: 'Google Gemini & Antigravity IDE', path: antigravityConfigPath() },
        { key: 'claudeDesktop', name: 'Claude Desktop', path: claudeDesktopConfigPath() },
        { key: 'claudeCode', name: 'Claude Code', path: claudeCodeConfigPath() },
        { key: 'chatgpt', name: 'ChatGPT Desktop', path: chatgptConfigPaths()[0] },
        { key: 'cursor', name: 'Cursor (Global)', path: cursorConfigPath() },
        { key: 'windsurf', name: 'Windsurf', path: windsurfConfigPath() },
        { key: 'codex', name: 'Codex CLI', path: codexConfigPath() },
    ];

    if (workspaceRoot) {
        tools.push({ key: 'cursorWs', name: 'Cursor (Workspace)', path: cursorWorkspaceConfigPath(workspaceRoot) });
        tools.push({ key: 'vscodeWs', name: 'VS Code & Copilot (Workspace)', path: vscodeWorkspaceConfigPath(workspaceRoot) });
    }

    return tools.map((t) => ({
        key: t.key,
        name: t.name,
        installed: isToolAvailable(t.key, workspaceRoot, false),
        registered: isToolRegistered(t.key, workspaceRoot),
        configPath: t.path || '',
    }));
}

module.exports = {
    registerMcpWithAllTools,
    deregisterMcpFromAllTools,
    getMcpPortFromSettings,
    isToolAvailable,
    isToolRegistered,
    getAiToolsStatus,
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
