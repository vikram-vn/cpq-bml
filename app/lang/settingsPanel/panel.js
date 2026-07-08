const { titleForTab } = require('./tabTitles');

function createSettingsPanel(context, vscode) {
    const panel = vscode.window.createWebviewPanel(
        'cpqBmlSettings',
        titleForTab('connection'),
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            retainContextWhenHidden: false,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'app', 'lang', 'settingsPanel', 'webview')
            ]
        }
    );

    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'app', 'images', 'logo.png');
    return panel;
}

module.exports = { createSettingsPanel };
