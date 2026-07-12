const pkg = require('../package.json');

// publisher.name is VS Code's extension id format. Every suiteSetup() across
// this test suite needs to grab a handle to "the extension under test" to
// call .activate() on it - deriving the id from package.json instead of
// repeating the literal string 'vikram-n.cpq-bml' in each test file means
// a publisher/name change only has to happen in one place.
function getExtensionId() {
    return `${pkg.publisher}.${pkg.name}`;
}

async function activateExtension(vscode) {
    const ext = vscode.extensions.getExtension(getExtensionId());
    await ext.activate();

    // Always ensure features.lint is enabled for tests to avoid stale state
    const config = vscode.workspace.getConfiguration('cpqBml');
    if (config.get('features.lint') !== true) {
        await config.update('features.lint', true, vscode.ConfigurationTarget.Global);
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return ext;
}

module.exports = { getExtensionId, activateExtension };
