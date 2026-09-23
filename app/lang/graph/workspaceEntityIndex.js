'use strict';

const fs = require('fs');
const path = require('path');
const {
    analyzeScriptContent,
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

module.exports = {
    buildWorkspaceEntityIndex,
    searchWorkspaceEntities
};
