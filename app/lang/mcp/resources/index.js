const fs = require('fs');
const path = require('path');
const { getWorkspaceRoot } = require('../../rest/commerceAttributes');

function registerResources(server, _context, vscode) {
    if (!server || typeof server.registerResource !== 'function') return;

    // 1. cpq://attributes/commerce
    try {
        server.registerResource(
            'commerce-attributes',
            'cpq://attributes/commerce',
            {
                title: 'Commerce Attributes Cache',
                description: 'Cached Oracle CPQ Commerce document and line item attributes, data types, and menu options (.cpq/commerce.attributes.min.json).',
                mimeType: 'application/json',
            },
            async (uri) => {
                const wsRoot = getWorkspaceRoot(vscode);
                let text = '{}';
                if (wsRoot) {
                    const filePath = path.join(wsRoot, '.cpq', 'commerce.attributes.min.json');
                    if (fs.existsSync(filePath)) {
                        text = fs.readFileSync(filePath, 'utf8');
                    }
                }
                return {
                    contents: [
                        {
                            uri: uri.href,
                            mimeType: 'application/json',
                            text,
                        },
                    ],
                };
            }
        );
    } catch (e) {}

    // 2. cpq://attributes/configuration
    try {
        server.registerResource(
            'config-attributes',
            'cpq://attributes/configuration',
            {
                title: 'Configuration Attributes Cache',
                description: 'Cached Oracle CPQ Product Families, Product Lines, Models, and Configuration Attributes (.cpq/config.attributes.min.json).',
                mimeType: 'application/json',
            },
            async (uri) => {
                const wsRoot = getWorkspaceRoot(vscode);
                let text = '{}';
                if (wsRoot) {
                    const filePath = path.join(wsRoot, '.cpq', 'config.attributes.min.json');
                    if (fs.existsSync(filePath)) {
                        text = fs.readFileSync(filePath, 'utf8');
                    }
                }
                return {
                    contents: [
                        {
                            uri: uri.href,
                            mimeType: 'application/json',
                            text,
                        },
                    ],
                };
            }
        );
    } catch (e) {}

    // 3. cpq://datatables/list
    try {
        server.registerResource(
            'datatables-list',
            'cpq://datatables/list',
            {
                title: 'Data Tables Cache',
                description: 'Available Oracle CPQ Data Tables with schema definitions for BMQL queries.',
                mimeType: 'application/json',
            },
            async (uri) => {
                const wsRoot = getWorkspaceRoot(vscode);
                let tables = [];
                if (wsRoot) {
                    const dtPath = path.join(wsRoot, '.cpq', 'datatables.json');
                    if (fs.existsSync(dtPath)) {
                        try {
                            tables = JSON.parse(fs.readFileSync(dtPath, 'utf8'));
                        } catch {}
                    }
                }
                return {
                    contents: [
                        {
                            uri: uri.href,
                            mimeType: 'application/json',
                            text: JSON.stringify(tables, null, 2),
                        },
                    ],
                };
            }
        );
    } catch (e) {}
}

module.exports = { registerResources };
