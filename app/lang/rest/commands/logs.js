const path = require("path");
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

    // 3. Determine workspace directory and target log path
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("CPQ-BML: No workspace folder open. Cannot download logs.");
        return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
    const systemLogsUri = vscode.Uri.joinPath(workspaceRoot, "logs", "system-logs");

    try {
        await vscode.workspace.fs.createDirectory(systemLogsUri);
    } catch (err) {
        // ignore
    }

    const filename = path.basename(filePath);
    const saveUri = vscode.Uri.joinPath(systemLogsUri, filename);

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
            const version = configLib.getRestVersion(vscode);
            const authResponse = await api.request({
                baseUrl: siteUrl,
                path: `/rest/${version}/currentUser`,
                method: "GET",
                authHeader,
                includeHeaders: true,
                transport
            });

            const extraHeaders = {};
            if (authResponse.headers && authResponse.headers["set-cookie"]) {
                const cookies = Array.isArray(authResponse.headers["set-cookie"])
                    ? authResponse.headers["set-cookie"]
                    : [authResponse.headers["set-cookie"]];
                const jsessionCookie = cookies.find(c => c.startsWith("JSESSIONID="));
                if (jsessionCookie) {
                    extraHeaders.Cookie = jsessionCookie.split(";")[0];
                }
            }

            // /log/logFileTransfer is a UI servlet, NOT a REST endpoint: it
            // serves the raw log as a file download and expects a browser-like
            // request against an authenticated UI session (the JSESSIONID
            // harvested above), not JSON content negotiation.
            const response = await api.request({
                baseUrl: siteUrl,
                path: "/log/logFileTransfer",
                method: "GET",
                query: {
                    file_path: filePath,
                    log_categ: "GENERAL"
                },
                authHeader,
                headers: { Accept: "*/*", ...extraHeaders },
                includeHeaders: true,
                transport
            });

            // The servlet never 401s - an unauthenticated UI session gets a
            // 302 redirect to the login page (or a 200 whose body IS the login
            // page), so surface that specifically instead of a generic error.
            if (response.statusCode === 301 || response.statusCode === 302) {
                throw new Error(
                    `Redirected to ${(response.headers && response.headers.location) || "login"} - ` +
                    "the log servlet requires an authenticated UI session, which this site did not grant from the REST login. " +
                    "Check that the configured user has Admin access to Error Logs."
                );
            }
            if (response.statusCode !== 200) {
                throw new Error(`Server returned HTTP ${response.statusCode}`);
            }
            const bodyText = typeof response.body === "string" ? response.body : "";
            if (bodyText && /<(html|form)[\s>]/i.test(bodyText.slice(0, 2000)) && /login/i.test(bodyText.slice(0, 2000))) {
                throw new Error(
                    "The server answered with its login page instead of the log file - " +
                    "the UI session was not accepted. Check that the configured user has Admin access to Error Logs."
                );
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
