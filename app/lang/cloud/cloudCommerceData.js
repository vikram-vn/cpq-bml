'use strict';

const { safeParseJson, extractStringValue } = require('@/lang/cloud/cloudVscodeShim');
const api = require('@/lang/rest/api');
const { getSettings, isConfigured, getWorkspaceRoot } = require('@/lang/rest/config');
const { inspectItemAccordingToPreference } = require('@/lang/cloud/cloudInspectorPanel');

function matchesItem(item, query) {
  if (!item) return false;
  const q = query.toLowerCase();
  const varName = extractStringValue(item.variableName || item.name || item.ruleName, '').toLowerCase();
  const label = extractStringValue(item.label || item.name, '').toLowerCase();
  const type = extractStringValue(item.actionType || item.ruleType || item.dataType || item.type || item.returnType, '').toLowerCase();
  const desc = extractStringValue(item.description, '').toLowerCase();

  if (varName.includes(q) || label.includes(q) || type.includes(q) || desc.includes(q)) {
    return true;
  }

  if (Array.isArray(item.attributes)) {
    return item.attributes.some(attr => matchesItem(attr, query));
  }

  return false;
}

async function fetchCommerceData(vscodeInstance, context) {
  const wsRoot = getWorkspaceRoot(vscodeInstance);
  const fs = require('fs');
  const path = require('path');

  if (!isConfigured(vscodeInstance)) {
    const settings = getSettings(vscodeInstance);
    const process = settings.commerceProcess || 'oraclecpqo';

    let wsAttributes = [];
    let wsLineAttributes = [];
    let wsActions = [];
    let wsLineActions = [];
    let wsArraySets = [];

    try {
      const { loadWorkspaceAttributes } = require('@/lang/rest/commerceAttributes');
      if (wsRoot && typeof loadWorkspaceAttributes === 'function') {
        const wsIndex = loadWorkspaceAttributes(wsRoot, context);
        if (wsIndex && wsIndex.varNameToMeta) {
          for (const attr of wsIndex.varNameToMeta.values()) {
            if (attr.scope === 'Line Item') {
              wsLineAttributes.push(attr);
            } else {
              wsAttributes.push(attr);
            }
          }
        }
      }
    } catch {}

    if (wsRoot) {
      const searchDirs = [
        path.join(wsRoot, 'cpq', 'commerce', process),
        path.join(wsRoot, '.cpq', 'commerce', process),
        path.join(wsRoot, 'cpq', 'commerce'),
        path.join(wsRoot, '.cpq', 'commerce')
      ];

      for (const sDir of searchDirs) {
        if (!fs.existsSync(sDir)) continue;
        const actPath = path.join(sDir, 'actions.min.json');
        if (fs.existsSync(actPath) && wsActions.length === 0) {
          try {
            const raw = JSON.parse(fs.readFileSync(actPath, 'utf8'));
            const list = Array.isArray(raw) ? raw : (raw.actions || raw.items || []);
            for (const a of list) {
              if (a.scope === 'Line Item') wsLineActions.push(a);
              else wsActions.push(a);
            }
          } catch {}
        }
        const arrPath = path.join(sDir, 'arraySets.min.json');
        if (fs.existsSync(arrPath) && wsArraySets.length === 0) {
          try {
            const raw = JSON.parse(fs.readFileSync(arrPath, 'utf8'));
            wsArraySets = Array.isArray(raw) ? raw : (raw.arraySets || raw.items || []);
          } catch {}
        }
      }
    }

    if (wsAttributes.length === 0 && wsLineAttributes.length === 0 && wsActions.length === 0 && wsArraySets.length === 0) {
      return null;
    }

    const wsTxnArraySets = [];
    const wsLineArraySets = [];
    for (const a of wsArraySets) {
      if (a.scope === 'Line Item' || a.document === 'transactionLine' || a.commerceDocument === 'transactionLine') {
        wsLineArraySets.push(a);
      } else {
        wsTxnArraySets.push(a);
      }
    }

    return {
      process,
      documentList: ['transaction', 'transactionLine'],
      integrations: [],
      transaction: {
        actions: wsActions,
        attributes: wsAttributes,
        arraySets: wsTxnArraySets.length > 0 ? wsTxnArraySets : wsArraySets,
        libraries: []
      },
      transactionLine: {
        actions: wsLineActions,
        attributes: wsLineAttributes,
        arraySets: wsLineArraySets.length > 0 ? wsLineArraySets : wsArraySets
      },
      isOffline: true
    };
  }

  const settings = getSettings(vscodeInstance);
  const process = settings.commerceProcess || 'oraclecpqo';

  const parseItems = (settled) => {
    if (settled.status !== 'fulfilled' || !settled.value) return [];
    const val = settled.value;
    if (Array.isArray(val)) return val;
    const body = safeParseJson(val.body !== undefined ? val.body : val);
    return Array.isArray(body) ? body : ((body && body.items) || []);
  };

  let docList = ['transaction', 'transactionLine'];
  try {
    if (typeof api.listCommerceDocuments === 'function') {
      const docRes = await api.listCommerceDocuments(context, vscodeInstance, { process, limit: 50 });
      const docItems = (docRes && docRes.body && docRes.body.items) || (Array.isArray(docRes?.body) ? docRes.body : []);
      if (docItems && docItems.length > 0) {
        const names = docItems.map(d => d.variableName || d.name).filter(Boolean);
        if (names.length > 0) {
          docList = names;
        }
      }
    }
  } catch {}

  const calls = [];
  for (const d of docList) {
    calls.push(api.listCommerceActions(context, vscodeInstance, { process, document: d, limit: 500 }));
    calls.push(api.listCommerceAttributes(context, vscodeInstance, { process, document: d, limit: 1000 }));
    if (typeof api.listCommerceArraySets === 'function') {
      calls.push(api.listCommerceArraySets(context, vscodeInstance, { process, document: d, limit: 100 }));
    }
    if (d === 'transaction') {
      calls.push(api.listLibraryFunctions(context, vscodeInstance, { limit: 1000 }, undefined, { commerceProcess: process, commerceDocument: 'transaction' }));
    }
  }

  let integrationsCallIdx = calls.length;
  if (typeof api.listCommerceIntegrations === 'function') {
    calls.push(api.listCommerceIntegrations(context, vscodeInstance, { process, limit: 100 }));
  }

  const results = await Promise.allSettled(calls);
  const data = {
    process,
    documentList: docList,
    integrations: []
  };

  if (typeof api.listCommerceIntegrations === 'function' && results[integrationsCallIdx]) {
    data.integrations = parseItems(results[integrationsCallIdx]);
  }

  let idx = 0;
  for (const d of docList) {
    const actionsRes = results[idx++];
    const attrsRes = results[idx++];
    let arraySetsRes = null;
    if (typeof api.listCommerceArraySets === 'function') {
      arraySetsRes = results[idx++];
    }
    let libsRes = null;
    if (d === 'transaction') {
      libsRes = results[idx++];
    }

    data[d] = {
      actions: parseItems(actionsRes),
      attributes: parseItems(attrsRes),
      arraySets: arraySetsRes ? parseItems(arraySetsRes) : []
    };

    if (d === 'transaction') {
      data[d].libraries = parseItems(libsRes).map(fn => ({
        ...fn,
        isCommerce: true,
        commerceProcess: process,
        commerceDocument: 'transaction'
      }));
    }
  }

  return data;
}

async function fetchAttributeMenuItems(attr, element, vscodeInstance, context) {
  if (!isConfigured(vscodeInstance)) return null;
  const isMenu = String(attr.dataType || attr.type || '').toLowerCase().includes('menu');
  if (!isMenu) return null;

  try {
    const varName = attr.variableName || attr.name || attr.id;
    const res = await api.listCommerceAttributeMenuItems(
      context,
      vscodeInstance,
      {
        process: element.process,
        document: element.docName,
        attributeVarName: varName,
        limit: 500
      }
    );
    if (res && res.body) {
      const items = Array.isArray(res.body) ? res.body : (Array.isArray(res.body.items) ? res.body.items : []);
      if (items.length > 0) {
        attr.menuOptions = items;
        return items;
      }
    }
  } catch {}
  return null;
}

async function inspectIntegrationCommand(item, vscodeInstance, context) {
  const itg = item?.data || item;
  if (!itg) {
    vscodeInstance?.window?.showWarningMessage?.('No integration selected.');
    return;
  }
  const varName = extractStringValue(itg.variableName || itg.name, 'integration');
  const process = itg.process || item?.process;

  await vscodeInstance.window.withProgress({
    location: (vscodeInstance.ProgressLocation && vscodeInstance.ProgressLocation.Notification) || 15,
    title: `Fetching CPQ Integration ${varName}...`,
    cancellable: false
  }, async () => {
    let payload = null;
    try {
      if (typeof api.getCommerceIntegration === 'function') {
        const res = await api.getCommerceIntegration(context, vscodeInstance, { process, integrationVarName: varName });
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          payload = safeParseJson(res.body);
        }
      }
    } catch (_) {}

    if (!payload) {
      payload = itg;
    }

    const payloadObj = { ...itg, ...payload, category: 'Integration', commerceProcess: process };
    await inspectItemAccordingToPreference(payloadObj, context, vscodeInstance);
  });
}

module.exports = {
  matchesItem,
  fetchCommerceData,
  fetchAttributeMenuItems,
  inspectIntegrationCommand
};
