const fs = require('fs');
const path = require('path');

let cachedWorkspaceFunctions = new Map();
let isInitialized = false;
let watcher = null;

/**
 * Build the wsFunctions cache key + entry for a single -meta.json.
 *
 * A meta's folderName groups related util library functions together
 * (Oracle CPQ "Util Library Folders" / platform namespaces like ORCL_ABO);
 * calls into a grouped function use three-part syntax:
 * util.<FolderName>.<functionName>(...). folderName is always present
 * (defaulting to "util"/"commerce" for ungrouped functions), so it's only
 * treated as a namespace segment when it names an actual folder - otherwise
 * this collapses back to the plain two-part util.<name>/commerce.<name> key.
 */
function buildFunctionEntry(meta, metaFilePath) {
    if (!meta || !meta.variableName) return null;
    const funcName = meta.variableName;
    const parameterCount = meta.parameters ? meta.parameters.length : 0;

    let namespace = 'util';
    if (meta.commerceDocument || metaFilePath.replace(/\\/g, '/').includes('/libraries/')) {
        namespace = 'commerce';
    }

    const folder = (meta.folderName || '').trim().toLowerCase();
    const namespaceSegment = (folder && folder !== 'util' && folder !== 'commerce') ? folder : null;
    const fullNamespace = namespaceSegment ? `${namespace}.${namespaceSegment}` : namespace;

    const params = (meta.parameters || []).map(p => {
        const typeStr = typeof p.dataType === 'string'
            ? p.dataType
            : (p.dataType ? (p.dataType.displayValue || p.dataType.displayLabel || '') : '');
        return { name: p.name, type: typeStr };
    });

    return {
        key: `${fullNamespace}.${funcName.toLowerCase()}`,
        entry: {
            path: metaFilePath,
            parameterCount,
            params,
            name: funcName,
            namespace: fullNamespace,
        },
    };
}

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
                const built = buildFunctionEntry(meta, metaFile);
                if (built) {
                    functionsMap.set(built.key, built.entry);
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
                    const built = buildFunctionEntry(meta, fsPath);
                    if (built) {
                        cachedWorkspaceFunctions.set(built.key, built.entry);
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
