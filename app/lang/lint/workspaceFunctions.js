const fs = require('fs');
const path = require('path');

let cachedWorkspaceFunctions = new Map();
let isInitialized = false;
let watcher = null;

function getWorkspaceFunctions(vscode) {
    const functionsMap = new Map();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return functionsMap;

    for (const folder of folders) {
        const rootPath = folder.uri.fsPath;

        const findMetaFiles = (dir) => {
            let results = [];
            let list;
            try {
                list = fs.readdirSync(dir);
            } catch (err) {
                return results;
            }
            list.forEach((file) => {
                if (file === 'node_modules' || file === '.git' || file === '.vscode-test' || file === 'dist') {
                    return;
                }
                const fullPath = path.join(dir, file);
                let stat;
                try {
                    stat = fs.statSync(fullPath);
                } catch (e) {
                    return;
                }
                if (stat && stat.isDirectory()) {
                    results = results.concat(findMetaFiles(fullPath));
                } else if (file.endsWith('-meta.json')) {
                    results.push(fullPath);
                }
            });
            return results;
        };

        const metaFiles = findMetaFiles(rootPath);
        for (const metaFile of metaFiles) {
            try {
                const content = fs.readFileSync(metaFile, 'utf8');
                const meta = JSON.parse(content);
                if (meta && meta.variableName) {
                    const funcName = meta.variableName;
                    const parameterCount = meta.parameters ? meta.parameters.length : 0;
                    
                    let namespace = 'util';
                    if (meta.commerceDocument || metaFile.replace(/\\/g, '/').includes('/libraries/')) {
                        namespace = 'commerce';
                    }
                    
                    const params = (meta.parameters || []).map(p => {
                        const typeStr = typeof p.dataType === 'string'
                            ? p.dataType
                            : (p.dataType ? (p.dataType.displayValue || p.dataType.displayLabel || '') : '');
                        return {
                            name: p.name,
                            type: typeStr
                        };
                    });

                    functionsMap.set(`${namespace}.${funcName.toLowerCase()}`, {
                        path: metaFile,
                        parameterCount,
                        params,
                        name: funcName,
                        namespace
                    });
                }
            } catch (e) {
                // Ignore parsing errors for individual files
            }
        }
    }
    return functionsMap;
}

function initializeCache(vscode) {
    if (isInitialized) return;
    isInitialized = true;

    cachedWorkspaceFunctions = getWorkspaceFunctions(vscode);

    try {
        watcher = vscode.workspace.createFileSystemWatcher('**/*-meta.json');
        
        const handleMetaChange = (uri) => {
            try {
                const fsPath = uri.fsPath;
                if (fs.existsSync(fsPath)) {
                    const content = fs.readFileSync(fsPath, 'utf8');
                    const meta = JSON.parse(content);
                    if (meta && meta.variableName) {
                        const funcName = meta.variableName;
                        const parameterCount = meta.parameters ? meta.parameters.length : 0;
                        
                        let namespace = 'util';
                        if (meta.commerceDocument || fsPath.replace(/\\/g, '/').includes('/libraries/')) {
                            namespace = 'commerce';
                        }
                        
                        const params = (meta.parameters || []).map(p => {
                            const typeStr = typeof p.dataType === 'string'
                                ? p.dataType
                                : (p.dataType ? (p.dataType.displayValue || p.dataType.displayLabel || '') : '');
                            return {
                                name: p.name,
                                type: typeStr
                            };
                        });

                        cachedWorkspaceFunctions.set(`${namespace}.${funcName.toLowerCase()}`, {
                            path: fsPath,
                            parameterCount,
                            params,
                            name: funcName,
                            namespace
                        });
                    }
                }
            } catch (e) {
                // ignore
            }
        };

        const handleMetaDelete = (uri) => {
            const fsPath = uri.fsPath;
            for (const [key, val] of cachedWorkspaceFunctions.entries()) {
                if (val.path === fsPath) {
                    cachedWorkspaceFunctions.delete(key);
                }
            }
        };

        watcher.onDidCreate(handleMetaChange);
        watcher.onDidChange(handleMetaChange);
        watcher.onDidDelete(handleMetaDelete);

        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            cachedWorkspaceFunctions = getWorkspaceFunctions(vscode);
        });
    } catch (e) {
        // ignore
    }
}

function getWorkspaceFunctionsCached(vscode) {
    initializeCache(vscode);
    return cachedWorkspaceFunctions;
}

module.exports = {
    getWorkspaceFunctionsCached
};
