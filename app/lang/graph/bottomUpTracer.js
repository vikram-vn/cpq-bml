'use strict';

const fs = require('fs');
const path = require('path');
const {
    analyzeScriptContent,
    buildWorkspaceCallGraph,
    computeBlastRadius,
    inferLibraryPrefix
} = require('@/lang/graph/dependencyGraphAnalyzer');

/**
 * Builds a unified multi-entity inverted index conforming to Oracle CPQ's
 * dependencyDetails schema (scratch/swagger.json: #/definitions/dependencyDetails).
 *
 * @param {Array<{filePath: string, content?: string}>} fileList
 * @returns {object} Inverted entity index
 */
function buildWorkspaceEntityIndex(fileList) {
    const attributeIndex = new Map(); // name -> Array<{ filePath, qualifiedName, name, operation, line, hierarchy, hierarchyLabel, parentArraySet }>
    const tableIndex = new Map();     // name -> Array<{ filePath, qualifiedName, name, operation, line, hierarchy, hierarchyLabel }>
    const actionIndex = new Map();    // name -> Array<{ filePath, qualifiedName, name, type, line, hierarchy, hierarchyLabel }>
    const libraryIndex = new Map();   // qualifiedName -> { filePath, qualifiedName, name, prefix, hierarchy, hierarchyLabel, outgoing }
    const arraySetIndex = new Map();  // name -> { variableName, label, description, attributes, hierarchyLabel }

    // Seed array sets from workspace storage if present
    if (fileList && fileList.length > 0 && fileList[0].filePath) {
        let cur = path.dirname(fileList[0].filePath);
        while (cur && cur !== path.dirname(cur)) {
            for (const b of ['cpq', '.cpq']) {
                const arrFile = path.join(cur, b, 'commerce', 'oraclecpqo', 'arraySets.min.json');
                if (fs.existsSync(arrFile) && arraySetIndex.size === 0) {
                    try {
                        const raw = JSON.parse(fs.readFileSync(arrFile, 'utf8'));
                        const list = Array.isArray(raw) ? raw : (raw.arraySets || raw.items || []);
                        for (const a of list) {
                            const k = (a.variableName || a.name || '').toLowerCase();
                            if (k) arraySetIndex.set(k, {
                                variableName: a.variableName || a.name,
                                label: a.label || a.name || a.variableName,
                                description: a.description || '',
                                attributes: a.attributes || [],
                                category: 'Commerce',
                                resourceType: 'Array Set',
                                resourceTypeLabel: 'Line Array Set',
                                hierarchyLabel: `Commerce > Transaction Line > Array Sets > ${a.variableName || a.name}`
                            });
                        }
                    } catch {}
                }
            }
            if (arraySetIndex.size > 0) break;
            cur = path.dirname(cur);
        }
    }

    for (const file of fileList) {
        let content = file.content;
        if (content === undefined) {
            try { content = fs.readFileSync(file.filePath, 'utf8'); } catch { continue; }
        }

        const baseName = path.basename(file.filePath, path.extname(file.filePath));
        const normalized = (file.filePath || '').replace(/\\/g, '/');

        // Load sidecar metadata if available
        let meta = null;
        try {
            const metaPath = path.join(path.dirname(file.filePath), `${baseName}-meta.json`);
            if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (_) {}

        const prefix = inferLibraryPrefix(file.filePath, meta);
        const qualifiedName = `${prefix}.${baseName}`.toLowerCase();
        const proc = meta?.commerceProcess || 'global';
        const doc = meta?.commerceDocument || 'transaction';
        const hierarchy = `${proc}/${doc}/${baseName}`;
        const hierarchyLabel = `${proc} > ${doc} > ${baseName}`;

        const analysis = analyzeScriptContent(content, meta);

        // 1. Index Library
        libraryIndex.set(qualifiedName, {
            filePath: file.filePath,
            qualifiedName,
            name: baseName,
            prefix,
            category: prefix === 'commerce' ? 'Commerce' : 'Global Libraries',
            resourceType: 'Library Function',
            resourceTypeLabel: prefix === 'commerce' ? 'Commerce Library' : 'Global Utility Library',
            hierarchy,
            hierarchyLabel,
            outgoing: analysis
        });

        // 2. Index Attributes (Bottom-Up references)
        for (const attr of analysis.attributes) {
            const key = attr.name.toLowerCase();
            if (!attributeIndex.has(key)) attributeIndex.set(key, []);
            attributeIndex.get(key).push({
                filePath: file.filePath,
                qualifiedName,
                name: baseName,
                attrName: attr.name,
                scope: attr.scope,
                operation: attr.operation,
                line: attr.line,
                hierarchy: `${proc}/${doc}/attributes/${attr.name}`,
                hierarchyLabel: `${proc} > ${doc} > Attributes > ${attr.name}`,
                category: 'Commerce',
                resourceType: 'Attribute',
                resourceTypeLabel: `${attr.scope === 'line' ? 'Line' : 'Transaction'} Attribute`
            });
        }

        // 3. Index Data Tables (BMQL & gettabledata)
        for (const tbl of analysis.dataTables) {
            const key = tbl.name.toLowerCase();
            if (!tableIndex.has(key)) tableIndex.set(key, []);
            tableIndex.get(key).push({
                filePath: file.filePath,
                qualifiedName,
                name: baseName,
                tableName: tbl.name,
                operation: tbl.operation,
                line: tbl.line,
                hierarchy: `dataTables/${tbl.name}`,
                hierarchyLabel: `Data Tables > ${tbl.name}`,
                category: 'Data Tables',
                resourceType: 'Data Table',
                resourceTypeLabel: 'CPQ Data Table'
            });
        }

        // 4. Index Actions
        for (const act of analysis.actions) {
            const key = act.name.toLowerCase();
            if (!actionIndex.has(key)) actionIndex.set(key, []);
            actionIndex.get(key).push({
                filePath: file.filePath,
                qualifiedName,
                name: baseName,
                actionName: act.name,
                type: act.type,
                line: act.line,
                hierarchy: `${proc}/${doc}/actions/${act.name}`,
                hierarchyLabel: `${proc} > ${doc} > Actions > ${act.name}`,
                category: 'Commerce',
                resourceType: 'Action',
                resourceTypeLabel: 'Commerce Action'
            });
        }
    }

    return {
        attributeIndex,
        tableIndex,
        actionIndex,
        libraryIndex,
        arraySetIndex
    };
}

/**
 * Searches across all indexed workspace entities.
 */
function searchWorkspaceEntities(index, query, maxResults = 15) {
    if (!query || !query.trim() || !index) return [];
    const q = query.trim().toLowerCase();
    const results = [];
    const push = (entityType, name, key, rLabel, cat, hLabel, count, sub, icon) => {
        results.push({ entityType, name, key, resourceTypeLabel: rLabel, category: cat, hierarchyLabel: hLabel, referenceCount: count, subtitle: sub, icon });
    };

    // 1. Attributes
    for (const [key, refs] of index.attributeIndex.entries()) {
        if (key.includes(q)) {
            const f = refs[0];
            push('attribute', f.attrName, key, f.resourceTypeLabel, f.category, f.hierarchyLabel, refs.length, `${f.resourceTypeLabel} (${refs.length} ref${refs.length === 1 ? '' : 's'})`, '🏷');
        }
    }

    // 2. Data Tables
    for (const [key, refs] of index.tableIndex.entries()) {
        if (key.includes(q)) {
            const f = refs[0];
            push('table', f.tableName, key, f.resourceTypeLabel, f.category, f.hierarchyLabel, refs.length, `CPQ Data Table (${refs.length} query)`, '🗄');
        }
    }

    // 3. Actions
    for (const [key, refs] of index.actionIndex.entries()) {
        if (key.includes(q)) {
            const f = refs[0];
            push('action', f.actionName, key, f.resourceTypeLabel, f.category, f.hierarchyLabel, refs.length, `Commerce Action (${refs.length} attachment)`, '⚡');
        }
    }

    // 4. Libraries
    for (const [key, lib] of index.libraryIndex.entries()) {
        if (key.includes(q) || lib.name.toLowerCase().includes(q)) {
            results.push({ entityType: 'library', name: lib.name, key, qualifiedName: lib.qualifiedName, filePath: lib.filePath, resourceTypeLabel: lib.resourceTypeLabel, category: lib.category, hierarchyLabel: lib.hierarchyLabel, subtitle: lib.qualifiedName, icon: '📦' });
        }
    }

    // 5. Array Sets
    if (index.arraySetIndex) {
        for (const [key, arr] of index.arraySetIndex.entries()) {
            if (key.includes(q) || (arr.label && arr.label.toLowerCase().includes(q))) {
                push('arraySet', arr.variableName, key, 'Line Array Set', 'Commerce', arr.hierarchyLabel, (arr.attributes || []).length, `Line Array Set (${(arr.attributes || []).length} attrs)`, '▦');
            }
        }
    }

    return results.slice(0, maxResults);
}

/**
 * Generates a Bottom-Up Multi-Hop Dependency Model centered on an Entity
 * (Attribute, Data Table, Action, Library, or Array Set).
 *
 * @param {'attribute'|'table'|'action'|'library'|'arraySet'} entityType
 * @param {string} entityName
 * @param {Array<{filePath: string, content?: string}>} fileList
 * @returns {object} Bottom-up Dependency Graph model
 */
function generateBottomUpModel(entityType, entityName, fileList) {
    const index = buildWorkspaceEntityIndex(fileList);
    const workspaceGraph = buildWorkspaceCallGraph(fileList);

    const normKey = (entityName || '').trim().toLowerCase();
    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();

    // 1. Root Entity Node (Hop 0 - Focal Node)
    let rootNode = null;
    if (entityType === 'attribute') {
        const refs = index.attributeIndex.get(normKey) || [];
        const canonicalName = refs[0]?.attrName || entityName;
        const scope = refs[0]?.scope || (normKey.endsWith('_l') ? 'line' : 'transaction');
        rootNode = {
            id: `entity_attr_${normKey}`,
            label: canonicalName,
            subtitle: `${scope === 'line' ? 'Line' : 'Transaction'} Attribute`,
            type: 'focal',
            entityType: 'attribute',
            category: 'Commerce',
            resourceType: 'Attribute',
            resourceTypeLabel: `${scope === 'line' ? 'Line' : 'Transaction'} Attribute`,
            hierarchyLabel: refs[0]?.hierarchyLabel || `Attributes > ${canonicalName}`
        };
    } else if (entityType === 'table') {
        const refs = index.tableIndex.get(normKey) || [];
        const canonicalName = refs[0]?.tableName || entityName;
        rootNode = {
            id: `entity_table_${normKey}`,
            label: canonicalName,
            subtitle: 'CPQ Data Table',
            type: 'focal',
            entityType: 'table',
            category: 'Data Tables',
            resourceType: 'Data Table',
            resourceTypeLabel: 'CPQ Data Table',
            hierarchyLabel: refs[0]?.hierarchyLabel || `Data Tables > ${canonicalName}`
        };
    } else if (entityType === 'action') {
        const refs = index.actionIndex.get(normKey) || [];
        const canonicalName = refs[0]?.actionName || entityName;
        rootNode = {
            id: `entity_action_${normKey}`,
            label: canonicalName,
            subtitle: 'Commerce Action',
            type: 'focal',
            entityType: 'action',
            category: 'Commerce',
            resourceType: 'Action',
            resourceTypeLabel: 'Commerce Action',
            hierarchyLabel: refs[0]?.hierarchyLabel || `Actions > ${canonicalName}`
        };
    } else if (entityType === 'arraySet') {
        const arrData = index.arraySetIndex?.get(normKey);
        const canonicalName = arrData?.variableName || entityName;
        rootNode = {
            id: `entity_arrayset_${normKey}`,
            label: canonicalName,
            subtitle: `Line Array Set (${(arrData?.attributes || []).length} attributes)`,
            type: 'focal',
            entityType: 'arraySet',
            category: 'Commerce',
            resourceType: 'Array Set',
            resourceTypeLabel: 'Line Array Set',
            hierarchyLabel: arrData?.hierarchyLabel || `Array Sets > ${canonicalName}`
        };
    }

    if (!rootNode) return null;

    seenNodeIds.add(rootNode.id);
    nodes.push(rootNode);

    // 2. Hop 1: Direct Touching BML Scripts / Libraries / Members
    const touchingScripts = [];
    if (entityType === 'attribute') {
        touchingScripts.push(...(index.attributeIndex.get(normKey) || []));
    } else if (entityType === 'table') {
        touchingScripts.push(...(index.tableIndex.get(normKey) || []));
    } else if (entityType === 'action') {
        touchingScripts.push(...(index.actionIndex.get(normKey) || []));
    } else if (entityType === 'arraySet') {
        const arrData = index.arraySetIndex?.get(normKey);
        if (arrData && Array.isArray(arrData.attributes)) {
            for (const member of arrData.attributes) {
                const memKey = (member.variableName || member.name || '').toLowerCase();
                const memId = `entity_attr_${memKey}`;
                if (!seenNodeIds.has(memId)) {
                    seenNodeIds.add(memId);
                    nodes.push({
                        id: memId,
                        label: member.variableName || member.name,
                        subtitle: `${member.dataType || 'String'} Member`,
                        type: 'callee',
                        entityType: 'attribute',
                        hierarchyLabel: `${rootNode.label} > ${member.variableName || member.name}`
                    });
                }
                edges.push({ source: rootNode.id, target: memId, type: 'arrayset_member', label: 'contains' });
                const memberRefs = index.attributeIndex.get(memKey) || [];
                touchingScripts.push(...memberRefs);
            }
        }
    }

    const uniqueScripts = new Map();
    for (const ref of touchingScripts) {
        if (!uniqueScripts.has(ref.qualifiedName)) {
            uniqueScripts.set(ref.qualifiedName, {
                ...ref,
                operations: new Set([ref.operation || 'READ']),
                lines: [ref.line]
            });
        } else {
            const existing = uniqueScripts.get(ref.qualifiedName);
            if (ref.operation) existing.operations.add(ref.operation);
            if (ref.line !== undefined) existing.lines.push(ref.line);
        }
    }

    // 3. Hop 2 & 3: Attached Actions and Upstream Callers
    const connectedActions = [];
    const connectedCallers = [];

    for (const [qName, scriptData] of uniqueScripts.entries()) {
        const scriptId = `script_${qName}`;
        if (!seenNodeIds.has(scriptId)) {
            seenNodeIds.add(scriptId);
            const opsStr = Array.from(scriptData.operations).join('/');
            nodes.push({
                id: scriptId,
                label: scriptData.name,
                subtitle: `${qName} (${opsStr})`,
                type: 'callee',
                filePath: scriptData.filePath,
                lines: scriptData.lines,
                entityType: 'library',
                hierarchyLabel: scriptData.hierarchyLabel
            });
        }

        const edgeLabel = entityType === 'table' ? 'queries' : (Array.from(scriptData.operations).join('/') === 'WRITE' ? 'writes' : 'reads');
        edges.push({
            source: rootNode.id,
            target: scriptId,
            type: 'entity_direct',
            label: edgeLabel
        });

        // Hop 2: Find actions attached to this script
        const libData = index.libraryIndex.get(qName);
        if (libData && libData.outgoing.actions) {
            for (const act of libData.outgoing.actions) {
                const actId = `action_${act.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}`;
                if (!seenNodeIds.has(actId)) {
                    seenNodeIds.add(actId);
                    nodes.push({
                        id: actId,
                        label: act.name,
                        subtitle: act.type || 'Commerce Action',
                        type: 'action',
                        entityType: 'action',
                        line: act.line
                    });
                    connectedActions.push(act);
                }
                edges.push({ source: actId, target: scriptId, type: 'action_trigger', label: 'triggers' });
            }
        }

        // Hop 3: Find upstream callers (Blast radius for this script)
        const blast = computeBlastRadius(qName, workspaceGraph);
        for (const caller of blast.callers) {
            const cId = `caller_${caller.qualifiedName}`;
            if (!seenNodeIds.has(cId)) {
                seenNodeIds.add(cId);
                nodes.push({
                    id: cId,
                    label: caller.name,
                    subtitle: caller.qualifiedName,
                    type: 'caller',
                    depth: caller.depth,
                    filePath: caller.filePath,
                    lines: caller.lines,
                    entityType: 'library'
                });
                connectedCallers.push(caller);
            }
            edges.push({ source: cId, target: scriptId, type: 'blast_radius', label: caller.depth === 1 ? 'calls' : `calls (depth ${caller.depth})` });
        }
    }

    const workspaceSymbols = Array.from(index.libraryIndex.entries()).map(([k, v]) => ({
        qualifiedName: k,
        name: v.name,
        filePath: v.filePath
    }));

    return {
        target: {
            name: rootNode.label,
            qualifiedName: rootNode.id,
            entityType,
            hierarchyLabel: rootNode.hierarchyLabel
        },
        blastRadius: {
            callers: connectedCallers,
            directCount: connectedCallers.filter(c => c.depth === 1).length,
            transitiveCount: connectedCallers.length,
            impactLevel: connectedCallers.length === 0 ? 'Isolated' : (connectedCallers.length <= 2 ? 'Low' : 'Medium')
        },
        workspaceSymbols,
        outgoing: {
            functions: Array.from(uniqueScripts.values()).map(s => ({
                name: s.name,
                qualifiedName: s.qualifiedName,
                filePath: s.filePath
            })),
            actions: connectedActions,
            attributes: entityType === 'attribute' ? [{ name: rootNode.label, scope: rootNode.subtitle }] : [],
            dataTables: entityType === 'table' ? [{ name: rootNode.label }] : [],
            externalApis: []
        },
        graph: { nodes, edges }
    };
}

module.exports = {
    buildWorkspaceEntityIndex,
    searchWorkspaceEntities,
    generateBottomUpModel
};
