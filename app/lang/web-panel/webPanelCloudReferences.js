'use strict';

/**
 * Handles fetching live cloud references for attributes, actions, and libraries
 * from CPQ Cloud API endpoints and local workspace callers.
 */
async function handleFetchCloudReferences(message, context, vscodeInstance, panel) {
  try {
    const apiCommerce = require('@/lang/rest/apiCommerce');
    const apiAttributes = require('@/lang/rest/apiCommerceAttributes');
    const varName = message.variableName || message.entityName;
    const isAction = message.category === 'Action' || message.entityType === 'action' || Boolean(message.actionType);
    const isLibrary = message.category === 'Library' || message.category === 'Function' || (typeof message.category === 'string' && message.category.includes('Library')) || message.entityType === 'library' || message.entityType === 'function';
    const effectiveProc = message.process || message.commerceProcess;
    const effectiveDoc = message.document || message.commerceDocument;

    let items = [];
    let statusCode = 200;

    if (isAction && varName && typeof apiCommerce.getCommerceAction === 'function') {
      const res = await apiCommerce.getCommerceAction(varName, {
        process: effectiveProc,
        document: effectiveDoc,
      });
      statusCode = res?.statusCode || 200;
      const body = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
      const deps = body?.dependencies || {};

      if (Array.isArray(deps.attributes)) {
        for (const a of deps.attributes) {
          items.push({
            name: a,
            variableName: a,
            type: 'Dependent Attribute',
            description: 'Attribute referenced, modified, or validated by this action',
            category: 'Attribute',
            document: effectiveDoc,
          });
        }
      }
      if (Array.isArray(deps.actions)) {
        for (const act of deps.actions) {
          items.push({
            name: act,
            variableName: act,
            type: 'Associated Action',
            description: 'Chained or prerequisite action in process flow',
            category: 'Action',
            document: effectiveDoc,
          });
        }
      }
      if (Array.isArray(deps.groups)) {
        for (const g of deps.groups) {
          items.push({
            name: g,
            variableName: g,
            type: 'Layout Tab / Group',
            description: 'Layout group or panel state affected by action',
            category: 'Layout',
            document: effectiveDoc,
          });
        }
      }
      if (Array.isArray(deps.resources)) {
        for (const r of deps.resources) {
          items.push({
            name: r,
            variableName: r,
            type: 'Resource',
            description: 'Subdocument or resource affected by action',
            category: 'Resource',
            document: effectiveDoc,
          });
        }
      }
    } else if (isLibrary && varName) {
      // 1. Live BML Global Search across Oracle CPQ Cloud
      try {
        const apiRest = require('@/lang/rest/api');
        if (typeof apiRest.searchBmlScripts === 'function') {
          const res = await apiRest.searchBmlScripts({ query: varName, limit: 50 });
          statusCode = res?.statusCode || 200;
          const body = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
          const bmlItems = Array.isArray(body?.items) ? body.items : [];
          for (const it of bmlItems) {
            items.push({
              name: it.path || 'BML Script',
              variableName: it.path,
              type: 'Remote Script (CPQ Cloud)',
              description: it.dateModified ? `Last modified: ${it.dateModified}` : `Referencing ${varName}`,
              category: 'Library',
              document: effectiveDoc,
            });
          }
        }
      } catch (_) {}

      // 2. Local workspace callers from BML call graph
      try {
        const { loadWorkspaceBmlFiles } = require('@/lang/graph/dependencyGraphPanel');
        const { buildWorkspaceCallGraph, computeBlastRadius } = require('@/lang/graph/dependencyGraphAnalyzer');
        const files = await loadWorkspaceBmlFiles();
        const workspaceGraph = buildWorkspaceCallGraph(files);
        const blast = computeBlastRadius(varName.toLowerCase(), workspaceGraph);
        for (const caller of blast.callers) {
          items.push({
            name: caller.name,
            variableName: caller.qualifiedName,
            type: `Workspace Caller (Depth ${caller.depth})`,
            description: `Calls ${varName} on line(s) [${caller.lines ? caller.lines.map(l => l + 1).join(', ') : '1'}]`,
            category: 'Library',
            filePath: caller.filePath,
            line: caller.lines?.[0],
            document: effectiveDoc,
          });
        }
      } catch (_) {}
    } else if (varName && typeof apiAttributes.listCommerceAttributeReferences === 'function') {
      const res = await apiAttributes.listCommerceAttributeReferences(varName, {
        process: effectiveProc,
        document: effectiveDoc,
      });
      statusCode = res?.statusCode || 200;
      const raw = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;

      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.ruleAssocs)) {
          for (const r of raw.ruleAssocs) {
            items.push({
              name: r.label || r.name,
              type: r.type || 'Rule Association',
              description: r.href || 'Rule referencing attribute',
              category: 'Rule',
              document: effectiveDoc,
            });
          }
        }
        if (Array.isArray(raw.libFuncAssocs)) {
          for (const f of raw.libFuncAssocs) {
            items.push({
              name: f.label || f.name,
              type: 'Library Function Association',
              description: f.id ? `Function ID: ${f.id}` : 'Library function referencing attribute',
              category: 'Function',
              document: effectiveDoc,
            });
          }
        }
        if (Array.isArray(raw.integrationAssocs)) {
          for (const i of raw.integrationAssocs) {
            items.push({
              name: i.label || i.name,
              type: 'Integration Association',
              description: i.id ? `Integration ID: ${i.id}` : 'Integration mapping referencing attribute',
              category: 'Integration',
              document: effectiveDoc,
            });
          }
        }
        if (Array.isArray(raw.layoutReferences)) {
          for (const l of raw.layoutReferences) {
            items.push({
              name: l.path || 'Layout Panel',
              type: `Layout (${l.layoutType || 'UI'})`,
              description: l.path || 'UI layout panel/tab',
              category: 'Layout',
              document: effectiveDoc,
            });
          }
        }
      }

      if (items.length === 0) {
        items = Array.isArray(raw) ? raw : (raw?.items || raw?.references || raw?.usages || []);
      }
    }

    panel?.webview?.postMessage({
      command: 'cloudReferencesLoaded',
      variableName: varName,
      references: items,
      statusCode,
      process: effectiveProc,
      document: effectiveDoc,
    });
  } catch (err) {
    panel?.webview?.postMessage({
      command: 'cloudReferencesLoaded',
      variableName: message.variableName || message.entityName,
      references: [],
      error: err.message,
      statusCode: 500,
    });
  }
}

module.exports = {
  handleFetchCloudReferences
};
