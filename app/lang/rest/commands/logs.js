const path = require("path");
const os = require("os");
const api = require("../client");
const configLib = require("../config");

async function runDownloadLogFile(context, vscode, transport) {
    // 1. Ensure credentials
    const hasCreds = await configLib.ensureCredentials(context, vscode);
    if (!hasCreds) return;

    // 2. Prompt for log file
    const logFiles = [
        { label: "bm.log", description: "General system log" },
        { label: "bm.log1", description: "General system log backup 1" },
        { label: "bm.log2", description: "General system log backup 2" },
        { label: "bm_print.log", description: "BML print statements log" },
        { label: "printserver.log", description: "Print server log" },
        { label: "Custom...", description: "Enter a custom log file path" }
    ];

    const selected = await vscode.window.showQuickPick(logFiles, {
        placeHolder: "Select CPQ log file to download",
        ignoreFocusOut: true
    });
    if (!selected) return;

    let filePath = selected.label;
    if (filePath === "Custom...") {
        const customPath = await vscode.window.showInputBox({
            prompt: "Enter custom log file path (e.g. bm.log)",
            placeHolder: "bm.log",
            ignoreFocusOut: true,
            validateInput: (val) => val && val.trim() ? null : "File path is required"
        });
        if (!customPath) return;
        filePath = customPath.trim();
    }

    // 3. Prompt for saving the file
    let defaultDir = os.homedir();
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        defaultDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    const defaultUri = vscode.Uri.file(path.join(defaultDir, filePath));
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { "Log Files": ["log"], "All Files": ["*"] },
        title: `Save ${filePath} As`
    });
    if (!saveUri) return;

    // 4. Download the log file
    const siteUrl = configLib.getBaseUrl(vscode);
    let authHeader;
    try {
        authHeader = await configLib.getAuthHeader(context, vscode);
    } catch (err) {
        vscode.window.showErrorMessage(`CPQ-BML: ${err.message}`);
        return;
    }

    // Show a progress indicator
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading ${filePath}...`,
        cancellable: false
    }, async () => {
        try {
            const response = await api.request({
                baseUrl: siteUrl,
                path: "/log/logFileTransfer",
                method: "GET",
                query: {
                    file_path: filePath,
                    log_categ: "GENERAL"
                },
                authHeader,
                transport
            });

            if (response.statusCode !== 200) {
                throw new Error(`Server returned HTTP ${response.statusCode}`);
            }

            const content = typeof response.body === "string" 
                ? response.body 
                : JSON.stringify(response.body, null, 2);

            const data = Buffer.from(content, "utf8");
            await vscode.workspace.fs.writeFile(saveUri, data);

            // Open the file in the editor
            const doc = await vscode.workspace.openTextDocument(saveUri);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(`CPQ-BML: Successfully downloaded and opened ${filePath}`);
        } catch (err) {
            vscode.window.showErrorMessage(`CPQ-BML: Failed to download ${filePath} - ${err.message}`);
        }
    });
}

module.exports = { runDownloadLogFile };
