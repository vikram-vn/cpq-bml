const fs = require('fs');
const path = require('path');
const { getWorkspaceRoot } = require('@/lang/rest/commerceAttributes');

function registerResources(server, _context, vscode) {
    if (!server || typeof server.registerResource !== 'function') return;

    // 1. cpq://attributes/commerce
    try {
        server.registerResource(
            'commerce-attributes',
            'cpq://attributes/commerce',
            {
                title: 'Commerce Attributes Cache',
                description: 'Cached Oracle CPQ Commerce document and line item attributes, data types, and menu options (cpq/commerce/<process>/attributes.min.json).',
                mimeType: 'application/json',
            },
            async (uri) => {
                const wsRoot = getWorkspaceRoot(vscode);
                let text = '{}';
                if (wsRoot) {
                    const commDir = path.join(wsRoot, 'cpq', 'commerce');
                    if (fs.existsSync(commDir)) {
                        const processes = {};
                        try {
                            for (const entry of fs.readdirSync(commDir, { withFileTypes: true })) {
                                if (entry.isDirectory()) {
                                    const p = path.join(commDir, entry.name, 'attributes.min.json');
                                    if (fs.existsSync(p)) {
                                        processes[entry.name] = JSON.parse(fs.readFileSync(p, 'utf8'));
                                    }
                                }
                            }
                        } catch {}
                        if (Object.keys(processes).length > 0) {
                            text = JSON.stringify(processes, null, 2);
                        }
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
                description: 'Cached Oracle CPQ Product Families, Product Lines, Models, and Configuration Attributes (cpq/config/<productFamily>/attributes.min.json).',
                mimeType: 'application/json',
            },
            async (uri) => {
                const wsRoot = getWorkspaceRoot(vscode);
                let text = '{}';
                if (wsRoot) {
                    const cfgDir = path.join(wsRoot, 'cpq', 'config');
                    if (fs.existsSync(cfgDir)) {
                        const configData = { families: {}, general: null };
                        try {
                            for (const entry of fs.readdirSync(cfgDir, { withFileTypes: true })) {
                                if (entry.isDirectory()) {
                                    const p = path.join(cfgDir, entry.name, 'attributes.min.json');
                                    if (fs.existsSync(p)) {
                                        configData.families[entry.name] = JSON.parse(fs.readFileSync(p, 'utf8'));
                                    }
                                } else if (entry.isFile() && entry.name.endsWith('.min.json')) {
                                    const p = path.join(cfgDir, entry.name);
                                    configData.general = JSON.parse(fs.readFileSync(p, 'utf8'));
                                }
                            }
                        } catch {}
                        if (Object.keys(configData.families).length > 0 || configData.general) {
                            text = JSON.stringify(configData, null, 2);
                        }
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

    // 3. cpq://variables/system
    try {
        server.registerResource(
            'system-variables',
            'cpq://variables/system',
            {
                title: 'System Variables Cache',
                description: 'Cached Oracle CPQ System Variables and system attributes (cpq/system/variables.min.json).',
                mimeType: 'application/json',
            },
            async (uri) => {
                const wsRoot = getWorkspaceRoot(vscode);
                let text = '{}';
                if (wsRoot) {
                    const sysFile = path.join(wsRoot, 'cpq', 'system', 'variables.min.json');
                    if (fs.existsSync(sysFile)) {
                        try {
                            text = fs.readFileSync(sysFile, 'utf8');
                        } catch {}
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
                    const dtPath = path.join(wsRoot, 'cpq', 'datatables.json');
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
