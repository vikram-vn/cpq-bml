'use strict';

const fs = require('fs');
const path = require('path');
const {
    analyzeScriptContent,
    buildWorkspaceCallGraph,
    computeBlastRadius,
    inferLibraryPrefix
} = require('@/lang/graph/dependencyGraphAnalyzer');

const {
    buildWorkspaceEntityIndex,
    searchWorkspaceEntities
} = require('@/lang/graph/workspaceEntityIndex');

/**
 * Generates a Bottom-Up Multi-Hop Dependency Model centered on an Entity
 * (Attribute, Data Table, Action, Library, or Array Set).
 *
 * @param {'attribute'|'table'|'action'|'library'|'arraySet'} entityType
 * @param {string} entityName
 * @param {Array<{filePath: string, content?: string}>} fileList
 * @param {Array<object>} [cloudReferences]
 * @returns {object} Bottom-up Dependency Graph model
 */
function generateBottomUpModel(entityType, entityName, fileList, cloudReferences = []) {
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
    } else if (entityType === 'library' || entityType === 'function') {
        let libData = index.libraryIndex.get(normKey);
        if (!libData) {
            for (const [qName, d] of index.libraryIndex.entries()) {
                if (d.name.toLowerCase() === normKey || qName.endsWith(`.${normKey}`)) {
                    libData = d;
                    break;
                }
            }
        }
        const canonicalName = libData?.name || entityName;
        const qName = libData?.qualifiedName || normKey;
        rootNode = {
            id: `entity_lib_${qName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
            label: canonicalName,
            qualifiedName: qName,
            subtitle: `${libData?.resourceTypeLabel || 'BML Library Function'} (${qName})`,
            type: 'focal',
            entityType: 'library',
            category: libData?.category || 'Commerce',
            resourceType: 'Library Function',
            resourceTypeLabel: libData?.resourceTypeLabel || 'BML Library Function',
            hierarchyLabel: libData?.hierarchyLabel || `Libraries > ${canonicalName}`,
            filePath: libData?.filePath
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
    } else if (entityType === 'library' || entityType === 'function') {
        const targetQName = rootNode.qualifiedName || normKey;
        const blast = computeBlastRadius(targetQName, workspaceGraph);
        for (const caller of blast.callers) {
            touchingScripts.push({
                qualifiedName: caller.qualifiedName,
                name: caller.name,
                filePath: caller.filePath,
                operation: 'CALLS',
                line: caller.lines?.[0] || 0,
                hierarchyLabel: `Workspace Callers > ${caller.name}`
            });
        }
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

        const edgeLabel = entityType === 'table' ? 'queries' : (entityType === 'library' || entityType === 'function' ? 'called by' : (Array.from(scriptData.operations).join('/') === 'WRITE' ? 'writes' : 'reads'));
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

    // Hop 4: Server-Side Cloud Usages & References (from Oracle CPQ REST API /references)
    const connectedCloudRefs = [];
    if (Array.isArray(cloudReferences) && cloudReferences.length > 0) {
        for (const ref of cloudReferences) {
            const refName = ref.name || ref.label || ref.variableName || ref.id || 'Cloud Usage';
            const refType = ref.type || ref.ruleType || ref.actionType || 'Cloud Reference';
            const refDesc = ref.description || '';
            const refId = `cloud_ref_${String(refName).toLowerCase().replace(/[^a-z0-9_]/gi, '_')}`;

            if (!seenNodeIds.has(refId)) {
                seenNodeIds.add(refId);
                nodes.push({
                    id: refId,
                    label: refName,
                    subtitle: `${refType} (CPQ Cloud)`,
                    type: 'cloud_reference',
                    entityType: refType.toLowerCase().includes('rule') ? 'rule' : (refType.toLowerCase().includes('action') ? 'action' : 'integration'),
                    description: refDesc,
                    category: ref.category || 'Commerce'
                });
                connectedCloudRefs.push({
                    name: refName,
                    type: refType,
                    description: refDesc,
                    document: ref.document || ref.commerceDocument,
                    process: ref.process || ref.commerceProcess
                });
            }

            edges.push({
                source: rootNode.id,
                target: refId,
                type: 'cloud_usage',
                label: 'referenced in'
            });
        }
    }

    const totalImpact = connectedCallers.length + connectedCloudRefs.length;
    let impactLevel = 'Isolated';
    if (totalImpact === 0) impactLevel = 'Isolated';
    else if (totalImpact <= 2) impactLevel = 'Low';
    else if (totalImpact <= 6) impactLevel = 'Medium';
    else impactLevel = 'Critical';

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
            cloudReferences: connectedCloudRefs,
            directCount: connectedCallers.filter(c => c.depth === 1).length + connectedCloudRefs.length,
            transitiveCount: totalImpact,
            impactLevel
        },
        workspaceSymbols,
        outgoing: {
            functions: Array.from(uniqueScripts.values()).map(s => ({
                name: s.name,
                qualifiedName: s.qualifiedName,
                filePath: s.filePath
            })),
            actions: connectedActions,
            cloudReferences: connectedCloudRefs,
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
