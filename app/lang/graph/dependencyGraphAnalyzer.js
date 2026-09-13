'use strict';

const fs = require('fs');
const path = require('path');
const { exportToMermaid } = require('@/lang/graph/mermaidExport');

const SQL_KEYWORDS = new Set(['where', 'set', 'values', 'select', 'join', 'group', 'order', 'inner', 'left', 'right', 'outer', 'having', 'limit']);

/**
 * Extracts outgoing calls, BMQL data tables, attributes, actions, and external APIs from BML script content.
 */
function analyzeScriptContent(content, meta = null, schema = null) {
    const lines = (content || '').split(/\r?\n/);
    const functions = [];
    const dataTables = [];
    const externalApis = [];
    const attributes = [];
    const actions = [];

    const callRegex = /\b(util|commerce)\.([a-zA-Z_]\w*)\b/g;
    const bmqlFromRegex = /\b(?:FROM|INTO|UPDATE)\s+([a-zA-Z_]\w*)\b/gi;
    const gettabledataRegex = /\bgettabledata\s*\(\s*["']([a-zA-Z_]\w*)["']/g;
    const urldataRegex = /\b(?:urldata|urldatabypost)\s*\(\s*(["'][^"']+["']|[a-zA-Z_]\w*)/g;
    const attrTxRegex = /\b([a-zA-Z_]\w*_t)\b/g;
    const attrLineRegex = /\b([a-zA-Z_]\w*_l)\b/g;
    const attrDotRegex = /\b(?:line|row|item)\.([a-zA-Z_]\w*)\b/g;
    const actionCompareRegex = /\b(?:_action_name|_modify_action)\s*==\s*["']([^"']+)["']/g;
    const stdActionRegex = /\b(save_t|submit_t|recalculate_t|modify_t|generateDocument_t|approve_t|reject_t)\b/g;

    const seenFuncs = new Set();
    const seenTables = new Set();
    const seenAttrs = new Set();
    const seenActions = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Function calls (Libraries)
        let match;
        while ((match = callRegex.exec(line)) !== null) {
            const qualifiedName = `${match[1]}.${match[2]}`.toLowerCase();
            if (!seenFuncs.has(`${qualifiedName}:${i}`)) {
                seenFuncs.add(`${qualifiedName}:${i}`);
                functions.push({ prefix: match[1], name: match[2], qualifiedName, line: i });
            }
        }

        // 2. Data Tables (BMQL & gettabledata)
        while ((match = bmqlFromRegex.exec(line)) !== null) {
            const tName = match[1];
            if (!SQL_KEYWORDS.has(tName.toLowerCase()) && !seenTables.has(`${tName.toLowerCase()}:${i}`)) {
                seenTables.add(`${tName.toLowerCase()}:${i}`);
                dataTables.push({ name: tName, operation: 'BMQL', line: i });
            }
        }
        while ((match = gettabledataRegex.exec(line)) !== null) {
            const tName = match[1];
            if (!seenTables.has(`${tName.toLowerCase()}:${i}`)) {
                seenTables.add(`${tName.toLowerCase()}:${i}`);
                dataTables.push({ name: tName, operation: 'gettabledata', line: i });
            }
        }

        // 3. External API calls
        while ((match = urldataRegex.exec(line)) !== null) {
            externalApis.push({ target: match[1].replace(/['"]/g, ''), line: i });
        }

        // 4. Attributes
        while ((match = attrTxRegex.exec(line)) !== null) {
            const a = match[1];
            if (!seenAttrs.has(a.toLowerCase())) {
                seenAttrs.add(a.toLowerCase());
                attributes.push({ name: a, scope: 'transaction', operation: new RegExp(`\\b${a}\\s*=`).test(line) ? 'WRITE' : 'READ', line: i });
            }
        }
        while ((match = attrLineRegex.exec(line)) !== null) {
            const a = match[1];
            if (!seenAttrs.has(a.toLowerCase())) {
                seenAttrs.add(a.toLowerCase());
                attributes.push({ name: a, scope: 'line', operation: new RegExp(`(?:\\b${a}|line\\.${a})\\s*=`).test(line) ? 'WRITE' : 'READ', line: i });
            }
        }
        while ((match = attrDotRegex.exec(line)) !== null) {
            const a = match[1];
            if (!a.endsWith('_l') && !['length', 'size', 'get', 'put'].includes(a.toLowerCase()) && !seenAttrs.has(a.toLowerCase())) {
                seenAttrs.add(a.toLowerCase());
                attributes.push({ name: a, scope: 'line', operation: new RegExp(`\\.${a}\\s*=`).test(line) ? 'WRITE' : 'READ', line: i });
            }
        }

        // 5. Actions
        while ((match = actionCompareRegex.exec(line)) !== null) {
            if (!seenActions.has(match[1].toLowerCase())) {
                seenActions.add(match[1].toLowerCase());
                actions.push({ name: match[1], type: 'Commerce Action', line: i });
            }
        }
        while ((match = stdActionRegex.exec(line)) !== null) {
            if (!seenActions.has(match[1].toLowerCase())) {
                seenActions.add(match[1].toLowerCase());
                actions.push({ name: match[1], type: 'Standard Action', line: i });
            }
        }
    }

    // 6. Meta attributes and action context
    if (meta) {
        const addMetaAttrs = (arr, scope) => {
            if (!Array.isArray(arr)) return;
            for (const item of arr) {
                const n = typeof item === 'string' ? item : item?.name;
                if (n && !seenAttrs.has(n.toLowerCase())) {
                    seenAttrs.add(n.toLowerCase());
                    attributes.push({ name: n, scope, operation: 'READ/WRITE', line: 0 });
                }
            }
        };
        addMetaAttrs(meta.mainDocAttributes, 'transaction');
        addMetaAttrs(meta.subDocAttributes, 'line');
        if (meta.actionName && !seenActions.has(meta.actionName.toLowerCase())) {
            seenActions.add(meta.actionName.toLowerCase());
            actions.push({ name: meta.actionName, type: 'Commerce Action', line: 0 });
        }
        if (meta.commerceDocument && actions.length === 0) {
            actions.push({ name: `${meta.commerceDocument} Action`, type: 'Commerce Pipeline', line: 0 });
        }
    }

    // 7. Schema attributes
    if (schema) {
        const checkSchema = (list, scope) => {
            if (!Array.isArray(list)) return;
            for (const it of list) {
                const n = typeof it === 'string' ? it : it?.name;
                if (n && !seenAttrs.has(n.toLowerCase()) && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(content || '')) {
                    seenAttrs.add(n.toLowerCase());
                    attributes.push({ name: n, scope, operation: 'READ', line: 0 });
                }
            }
        };
        checkSchema(schema.transactionAttributes, 'transaction');
        checkSchema(schema.lineItemAttributes, 'line');
    }

    return { functions, dataTables, externalApis, attributes, actions };
}

/**
 * Builds a full workspace call graph map.
 */
function buildWorkspaceCallGraph(fileList) {
    const graph = new Map();
    for (const file of fileList) {
        let content = file.content;
        if (content === undefined) {
            try { content = fs.readFileSync(file.filePath, 'utf8'); } catch { continue; }
        }
        const baseName = path.basename(file.filePath, path.extname(file.filePath));
        const normalized = file.filePath.replace(/\\/g, '/');
        const prefix = /[\/\\]commerce[\/\\]/i.test(normalized) ? 'commerce' : 'util';
        const qualifiedName = `${prefix}.${baseName}`.toLowerCase();
        graph.set(qualifiedName, {
            filePath: file.filePath,
            qualifiedName,
            name: baseName,
            outgoing: analyzeScriptContent(content)
        });
    }
    return graph;
}

/**
 * Computes Blast Radius for a target function.
 */
function computeBlastRadius(targetQualifiedName, workspaceGraph) {
    const target = (targetQualifiedName || '').toLowerCase();
    const visited = new Set([target]);
    const callers = [];
    let maxDepth = 0;
    const queue = [[target, 1]];

    while (queue.length > 0) {
        const [current, depth] = queue.shift();
        for (const [nodeName, nodeData] of workspaceGraph.entries()) {
            if (nodeName === current) continue;
            const matchingCalls = nodeData.outgoing.functions.filter(f => f.qualifiedName === current);
            if (matchingCalls.length > 0 && !visited.has(nodeName)) {
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

    const transitiveCount = callers.length;
    let impactLevel = 'Isolated';
    if (transitiveCount === 0) impactLevel = 'Isolated';
    else if (transitiveCount <= 2) impactLevel = 'Low';
    else if (transitiveCount <= 6) impactLevel = 'Medium';
    else impactLevel = 'Critical';

    return {
        callers,
        directCount: callers.filter(c => c.depth === 1).length,
        transitiveCount,
        maxDepth,
        impactLevel
    };
}

function loadMetaAndSchema(targetFilePath) {
    let meta = null;
    let schema = null;
    try {
        const baseName = path.basename(targetFilePath, path.extname(targetFilePath));
        const metaPath = path.join(path.dirname(targetFilePath), `${baseName}-meta.json`);
        if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (_) {}

    try {
        let cur = path.dirname(targetFilePath);
        for (let i = 0; i < 5; i++) {
            const sc = path.join(cur, 'schema.json');
            const csc = path.join(cur, 'cpq', 'schema.json');
            if (fs.existsSync(sc)) { schema = JSON.parse(fs.readFileSync(sc, 'utf8')); break; }
            if (fs.existsSync(csc)) { schema = JSON.parse(fs.readFileSync(csc, 'utf8')); break; }
            const parent = path.dirname(cur);
            if (parent === cur) break;
            cur = parent;
        }
    } catch (_) {}

    return { meta, schema };
}

/**
 * Generates the full interactive dependency and blast radius visual model.
 */
function generateDependencyModel(targetFilePath, workspaceFiles, currentFileContent) {
    const baseName = path.basename(targetFilePath, path.extname(targetFilePath));
    const normalized = targetFilePath.replace(/\\/g, '/');
    const prefix = /[\/\\]commerce[\/\\]/i.test(normalized) ? 'commerce' : 'util';
    const targetQualified = `${prefix}.${baseName}`.toLowerCase();

    const { meta: metaJson, schema: schemaJson } = loadMetaAndSchema(targetFilePath);

    const files = [...(workspaceFiles || [])];
    const existingIdx = files.findIndex(f => path.resolve(f.filePath) === path.resolve(targetFilePath));
    if (existingIdx >= 0) {
        if (currentFileContent !== undefined) files[existingIdx] = { filePath: targetFilePath, content: currentFileContent };
    } else {
        files.push({ filePath: targetFilePath, content: currentFileContent });
    }

    const workspaceGraph = buildWorkspaceCallGraph(files);
    const targetEntry = files.find(f => path.resolve(f.filePath) === path.resolve(targetFilePath));
    const effectiveContent = currentFileContent !== undefined ? currentFileContent : (targetEntry?.content || '');
    const targetData = {
        filePath: targetFilePath,
        qualifiedName: targetQualified,
        name: baseName,
        outgoing: analyzeScriptContent(effectiveContent, metaJson, schemaJson)
    };

    const blastRadius = computeBlastRadius(targetQualified, workspaceGraph);
    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();

    // 1. Focal Node
    const focalId = `target_${targetQualified}`;
    seenNodeIds.add(focalId);
    nodes.push({ id: focalId, label: baseName, subtitle: targetQualified, type: 'focal', filePath: targetFilePath, line: 0, risk: blastRadius.impactLevel });

    // 2. Upstream Callers (Libraries)
    for (const c of blastRadius.callers) {
        const cId = `caller_${c.qualifiedName}`;
        if (!seenNodeIds.has(cId)) {
            seenNodeIds.add(cId);
            nodes.push({ id: cId, label: c.name, subtitle: c.qualifiedName, type: 'caller', depth: c.depth, filePath: c.filePath, lines: c.lines });
        }
        edges.push({ source: cId, target: focalId, type: 'blast_radius', label: c.depth === 1 ? 'calls' : `calls (depth ${c.depth})` });
    }

    // 3. Actions
    for (const act of (targetData.outgoing.actions || [])) {
        const actId = `action_${act.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}`;
        if (!seenNodeIds.has(actId)) {
            seenNodeIds.add(actId);
            nodes.push({ id: actId, label: act.name, subtitle: act.type || 'Commerce Action', type: 'action', line: act.line });
        }
        edges.push({ source: actId, target: focalId, type: 'action_trigger', label: 'triggers' });
    }

    // 4. Outgoing Libraries
    for (const fn of targetData.outgoing.functions) {
        const fnId = `callee_${fn.qualifiedName}`;
        if (!seenNodeIds.has(fnId)) {
            seenNodeIds.add(fnId);
            const res = workspaceGraph.get(fn.qualifiedName);
            nodes.push({ id: fnId, label: fn.name, subtitle: fn.qualifiedName, type: 'callee', filePath: res?.filePath || null, line: fn.line });
        }
        edges.push({ source: focalId, target: fnId, type: 'callee_call', label: 'invokes' });
    }

    // 5. Data Tables
    const uniqueTables = new Map();
    for (const t of targetData.outgoing.dataTables) uniqueTables.set(t.name.toLowerCase(), t);
    for (const [, table] of uniqueTables) {
        const tableId = `table_${table.name.toLowerCase()}`;
        if (!seenNodeIds.has(tableId)) {
            seenNodeIds.add(tableId);
            nodes.push({ id: tableId, label: table.name, subtitle: 'CPQ Data Table', type: 'table', line: table.line });
        }
        edges.push({ source: focalId, target: tableId, type: 'data_access', label: 'queries' });
    }

    // 6. Attributes
    const uniqueAttrs = new Map();
    for (const a of (targetData.outgoing.attributes || [])) uniqueAttrs.set(a.name.toLowerCase(), a);
    for (const [, attr] of uniqueAttrs) {
        const attrId = `attr_${attr.name.toLowerCase()}`;
        if (!seenNodeIds.has(attrId)) {
            seenNodeIds.add(attrId);
            nodes.push({ id: attrId, label: attr.name, subtitle: `${attr.scope === 'line' ? 'Line' : 'Transaction'} Attribute (${attr.operation})`, type: 'attribute', scope: attr.scope, operation: attr.operation, line: attr.line });
        }
        edges.push({ source: focalId, target: attrId, type: 'attribute_access', label: attr.operation === 'WRITE' ? 'writes' : 'reads' });
    }

    // 7. External APIs
    for (const api of targetData.outgoing.externalApis) {
        const apiId = `api_${api.target.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!seenNodeIds.has(apiId)) {
            seenNodeIds.add(apiId);
            nodes.push({ id: apiId, label: api.target, subtitle: 'urldata() Endpoint', type: 'api', line: api.line });
        }
        edges.push({ source: focalId, target: apiId, type: 'external_call', label: 'requests' });
    }

    const workspaceSymbols = Array.from(workspaceGraph.entries()).map(([k, v]) => ({
        qualifiedName: k,
        name: v.name,
        filePath: v.filePath
    }));

    return {
        target: { name: baseName, qualifiedName: targetQualified, filePath: targetFilePath },
        blastRadius,
        workspaceSymbols,
        outgoing: {
            functions: targetData.outgoing.functions,
            dataTables: Array.from(uniqueTables.values()),
            attributes: Array.from(uniqueAttrs.values()),
            actions: targetData.outgoing.actions || [],
            externalApis: targetData.outgoing.externalApis
        },
        graph: { nodes, edges }
    };
}

module.exports = {
    analyzeScriptContent,
    buildWorkspaceCallGraph,
    computeBlastRadius,
    generateDependencyModel,
    exportToMermaid
};
