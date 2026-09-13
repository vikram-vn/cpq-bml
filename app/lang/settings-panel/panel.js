const { titleForTab } = require('@/lang/settings-panel/tabTitles');

function createSettingsPanel(context, vscode) {
    const panel = vscode.window.createWebviewPanel(
        'cpqBmlSettings',
        titleForTab('connection'),
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            retainContextWhenHidden: false,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'app', 'lang', 'web-panel')
            ]
        }
    );

    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'app', 'icons', 'logo.svg');
    return panel;
}

module.exports = { createSettingsPanel };
