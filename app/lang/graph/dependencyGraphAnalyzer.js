'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Extracts outgoing calls, BMQL data tables, and attributes from BML script content.
 * @param {string} content 
 * @returns {{ functions: Array<{prefix: string, name: string, qualifiedName: string, line: number}>, dataTables: Array<{name: string, operation: string, line: number}>, externalApis: Array<{target: string, line: number}> }}
 */
function analyzeScriptContent(content) {
    const lines = (content || '').split(/\r?\n/);
    const functions = [];
    const dataTables = [];
    const externalApis = [];

    const callRegex = /\b(util|commerce)\.([a-zA-Z_]\w*)\b/g;
    const bmqlFromRegex = /\b(?:FROM|INTO|UPDATE)\s+([a-zA-Z_]\w*)\b/gi;
    const urldataRegex = /\burldata\s*\(\s*(["'][^"']+["']|[a-zA-Z_]\w*)/g;

    const seenFuncs = new Set();
    const seenTables = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Function calls
        let match;
        while ((match = callRegex.exec(line)) !== null) {
            const prefix = match[1];
            const name = match[2];
            const qualifiedName = `${prefix}.${name}`.toLowerCase();
            if (!seenFuncs.has(`${qualifiedName}:${i}`)) {
                seenFuncs.add(`${qualifiedName}:${i}`);
                functions.push({ prefix, name, qualifiedName, line: i });
            }
        }

        // 2. BMQL Data Tables
        let tableMatch;
        while ((tableMatch = bmqlFromRegex.exec(line)) !== null) {
            const tableName = tableMatch[1];
            // Filter out SQL keywords
            if (!['where', 'set', 'values', 'select', 'join', 'group', 'order'].includes(tableName.toLowerCase())) {
                const key = `${tableName.toLowerCase()}:${i}`;
                if (!seenTables.has(key)) {
                    seenTables.add(key);
                    dataTables.push({ name: tableName, operation: 'BMQL', line: i });
                }
            }
        }

        // 3. External API calls (urldata)
        let apiMatch;
        while ((apiMatch = urldataRegex.exec(line)) !== null) {
            externalApis.push({ target: apiMatch[1].replace(/['"]/g, ''), line: i });
        }
    }

    return { functions, dataTables, externalApis };
}

/**
 * Builds a full workspace call graph map.
 * @param {Array<{filePath: string, content?: string}>} fileList 
 * @returns {Map<string, {filePath: string, qualifiedName: string, name: string, outgoing: ReturnType<typeof analyzeScriptContent>}>}
 */
function buildWorkspaceCallGraph(fileList) {
    const graph = new Map();

    for (const file of fileList) {
        let content = file.content;
        if (content === undefined) {
            try {
                content = fs.readFileSync(file.filePath, 'utf8');
            } catch {
                continue;
            }
        }

        const baseName = path.basename(file.filePath, path.extname(file.filePath));
        const normalized = file.filePath.replace(/\\/g, '/');
        const prefix = /[\/\\]commerce[\/\\]/i.test(normalized) ? 'commerce' : 'util';
        const qualifiedName = `${prefix}.${baseName}`.toLowerCase();

        const outgoing = analyzeScriptContent(content);
        graph.set(qualifiedName, {
            filePath: file.filePath,
            qualifiedName,
            name: baseName,
            outgoing
        });
    }

    return graph;
}

/**
 * Computes Blast Radius (upstream impact) for a target function.
 * @param {string} targetQualifiedName e.g. "util.calculatetax"
 * @param {Map<string, {filePath: string, qualifiedName: string, name: string, outgoing: ReturnType<typeof analyzeScriptContent>}>} workspaceGraph 
 * @returns {{ callers: Array<{qualifiedName: string, name: string, filePath: string, lines: number[], depth: number}>, directCount: number, transitiveCount: number, maxDepth: number, impactLevel: 'Isolated' | 'Low' | 'Medium' | 'Critical' }}
 */
function computeBlastRadius(targetQualifiedName, workspaceGraph) {
    const target = (targetQualifiedName || '').toLowerCase();
    const visited = new Set([target]);
    const callers = [];
    let maxDepth = 0;

    // BFS Queue: [currentQualifiedName, currentDepth]
    const queue = [[target, 1]];

    while (queue.length > 0) {
        const [current, depth] = queue.shift();

        for (const [nodeName, nodeData] of workspaceGraph.entries()) {
            if (nodeName === current) continue;

            const matchingCalls = nodeData.outgoing.functions.filter(f => f.qualifiedName === current);
            if (matchingCalls.length > 0) {
                if (!visited.has(nodeName)) {
                    visited.add(nodeName);
                    maxDepth = Math.max(maxDepth, depth);
                    callers.push({
                        qualifiedName: nodeName,
                        name: nodeData.name,
                        filePath: nodeData.filePath,
                        lines: matchingCalls.map(m => m.line),
                        depth
                    });
                    queue.push([nodeName, depth + 1]);
                }
            }
        }
    }

    const directCount = callers.filter(c => c.depth === 1).length;
    const transitiveCount = callers.length;

    let impactLevel = 'Isolated';
    if (transitiveCount === 0) {
        impactLevel = 'Isolated';
    } else if (transitiveCount <= 2) {
        impactLevel = 'Low';
    } else if (transitiveCount <= 6) {
        impactLevel = 'Medium';
    } else {
        impactLevel = 'Critical';
    }

    return {
        callers,
        directCount,
        transitiveCount,
        maxDepth,
        impactLevel
    };
}

/**
 * Generates the full interactive dependency and blast radius visual model.
 * @param {string} targetFilePath 
 * @param {Array<{filePath: string, content?: string}>} workspaceFiles 
 * @param {string} [currentFileContent] 
 * @returns {object}
 */
function generateDependencyModel(targetFilePath, workspaceFiles, currentFileContent) {
    const baseName = path.basename(targetFilePath, path.extname(targetFilePath));
    const normalized = targetFilePath.replace(/\\/g, '/');
    const prefix = /[\/\\]commerce[\/\\]/i.test(normalized) ? 'commerce' : 'util';
    const targetQualified = `${prefix}.${baseName}`.toLowerCase();

    // Ensure the target file is included in workspaceFiles
    const files = [...(workspaceFiles || [])];
    const existingIdx = files.findIndex(f => path.resolve(f.filePath) === path.resolve(targetFilePath));
    if (existingIdx >= 0) {
        if (currentFileContent !== undefined) {
            files[existingIdx] = { filePath: targetFilePath, content: currentFileContent };
        }
    } else {
        files.push({ filePath: targetFilePath, content: currentFileContent });
    }

    const workspaceGraph = buildWorkspaceCallGraph(files);
    const targetData = workspaceGraph.get(targetQualified) || {
        filePath: targetFilePath,
        qualifiedName: targetQualified,
        name: baseName,
        outgoing: analyzeScriptContent(currentFileContent || '')
    };

    const blastRadius = computeBlastRadius(targetQualified, workspaceGraph);

    // Build visual nodes and edges
    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();

    // 1. Focal Node
    const focalId = `target_${targetQualified}`;
    seenNodeIds.add(focalId);
    nodes.push({
        id: focalId,
        label: baseName,
        subtitle: targetQualified,
        type: 'focal',
        filePath: targetFilePath,
        line: 0,
        risk: blastRadius.impactLevel
    });

    // 2. Upstream Callers (Blast Radius)
    for (const caller of blastRadius.callers) {
        const callerId = `caller_${caller.qualifiedName}`;
        if (!seenNodeIds.has(callerId)) {
            seenNodeIds.add(callerId);
            nodes.push({
                id: callerId,
                label: caller.name,
                subtitle: caller.qualifiedName,
                type: 'caller',
                depth: caller.depth,
                filePath: caller.filePath,
                lines: caller.lines
            });
        }

        // Edge from caller -> target
        edges.push({
            source: callerId,
            target: focalId,
            type: 'blast_radius',
            label: caller.depth === 1 ? 'calls' : `calls (depth ${caller.depth})`
        });
    }

    // 3. Outgoing Functions
    for (const fn of targetData.outgoing.functions) {
        const fnId = `callee_${fn.qualifiedName}`;
        if (!seenNodeIds.has(fnId)) {
            seenNodeIds.add(fnId);
            const resolved = workspaceGraph.get(fn.qualifiedName);
            nodes.push({
                id: fnId,
                label: fn.name,
                subtitle: fn.qualifiedName,
                type: 'callee',
                filePath: resolved ? resolved.filePath : null,
                line: fn.line
            });
        }

        edges.push({
            source: focalId,
            target: fnId,
            type: 'callee_call',
            label: 'invokes'
        });
    }

    // 4. Data Tables
    const uniqueTables = new Map();
    for (const t of targetData.outgoing.dataTables) {
        uniqueTables.set(t.name.toLowerCase(), t);
    }
    for (const [, table] of uniqueTables.entries()) {
        const tableId = `table_${table.name.toLowerCase()}`;
        if (!seenNodeIds.has(tableId)) {
            seenNodeIds.add(tableId);
            nodes.push({
                id: tableId,
                label: table.name,
                subtitle: 'CPQ Data Table',
                type: 'table',
                line: table.line
            });
        }

        edges.push({
            source: focalId,
            target: tableId,
            type: 'data_access',
            label: 'queries'
        });
    }

    // 5. External APIs
    for (const api of targetData.outgoing.externalApis) {
        const apiId = `api_${api.target.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!seenNodeIds.has(apiId)) {
            seenNodeIds.add(apiId);
            nodes.push({
                id: apiId,
                label: api.target,
                subtitle: 'urldata() Endpoint',
                type: 'api',
                line: api.line
            });
        }

        edges.push({
            source: focalId,
            target: apiId,
            type: 'external_call',
            label: 'requests'
        });
    }

    return {
        target: {
            name: baseName,
            qualifiedName: targetQualified,
            filePath: targetFilePath
        },
        blastRadius,
        outgoing: {
            functions: targetData.outgoing.functions,
            dataTables: Array.from(uniqueTables.values()),
            externalApis: targetData.outgoing.externalApis
        },
        graph: {
            nodes,
            edges
        }
    };
}

/**
 * Exports dependency graph to Mermaid flowchart syntax.
 * @param {ReturnType<typeof generateDependencyModel>} model 
 * @returns {string}
 */
function exportToMermaid(model) {
    const lines = ['flowchart LR'];
    lines.push('    %% Styling classes');
    lines.push('    classDef focal fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;');
    lines.push('    classDef caller fill:#dc2626,stroke:#b91c1c,stroke-width:2px,color:#fff;');
    lines.push('    classDef callee fill:#0891b2,stroke:#0e7490,stroke-width:2px,color:#fff;');
    lines.push('    classDef table fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff;');
    lines.push('    classDef api fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff;');
    lines.push('');

    const nodeSanitize = (id) => id.replace(/[^a-zA-Z0-9_]/g, '_');

    for (const node of model.graph.nodes) {
        const safeId = nodeSanitize(node.id);
        const label = `${node.label}["${node.label}\\n(${node.subtitle})"]:::${node.type}`;
        lines.push(`    ${safeId}${label.slice(node.label.length)}`);
    }

    lines.push('');
    for (const edge of model.graph.edges) {
        const src = nodeSanitize(edge.source);
        const tgt = nodeSanitize(edge.target);
        lines.push(`    ${src} -->|"${edge.label}"| ${tgt}`);
    }

    return lines.join('\n');
}

module.exports = {
    analyzeScriptContent,
    buildWorkspaceCallGraph,
    computeBlastRadius,
    generateDependencyModel,
    exportToMermaid
};
