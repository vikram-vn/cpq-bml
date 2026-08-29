// options.js
const fs = require('fs');
const path = require('path');
let vscode = null;
try {
  vscode = require('vscode');
} catch (e) {
  // Running outside VS Code – ignore
}

const configCache = new Map();

module.exports = async function optionsProvider(document, formattingOptions) {
    // Load workspace config if present
    let workspaceConfig = {};
    let config = {
        indent_size: 4,
        indent_char: ' ',
        max_preserve_newlines: 2,
        preserve_newlines: true,
        end_with_newline: true,
        space_in_empty_paren: true,
        enforce_semicolons: false,
        // Add any other js-beautify options you need
    };
    // Determine workspace folder only if VS Code API is available
    let workspaceFolder = null;
    if (vscode && vscode.workspace && document && document.uri) {
        try {
            workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        } catch (e) {
            // ignore errors when running outside VS Code
        }
    }
    if (workspaceFolder) {
        const folderPath = workspaceFolder.uri.fsPath;
        const now = Date.now();
        const cached = configCache.get(folderPath);
        if (cached && (now - cached.timestamp < 3000)) {
            workspaceConfig = cached.config;
        } else {
            const configPath = path.join(folderPath, '.bmlbeautifyrc');
            try {
                if (fs.existsSync(configPath)) {
                    workspaceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                }
            } catch (e) {
                // ignore parsing / reading errors
            }
            configCache.set(folderPath, { config: workspaceConfig, timestamp: now });
        }
    }
    // Merge user config over defaults
    config = Object.assign({}, config, workspaceConfig);
    // Apply editor formatting options if available
    if (formattingOptions) {
        config.indent_size = formattingOptions.tabSize || config.indent_size;
    }
    return config;
};
