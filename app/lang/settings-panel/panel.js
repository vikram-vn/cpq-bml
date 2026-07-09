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
                vscode.Uri.joinPath(context.extensionUri, 'app', 'lang', 'settings-panel', 'web-view')
            ]
        }
    );

    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'app', 'images', 'logo.png');
    return panel;
}

module.exports = { createSettingsPanel };
