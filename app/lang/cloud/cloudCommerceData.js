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

  return varName.includes(q) || label.includes(q) || type.includes(q) || desc.includes(q);
}

async function fetchCommerceData(vscodeInstance, context) {
  const wsRoot = getWorkspaceRoot(vscodeInstance);
  if (!isConfigured(vscodeInstance)) {
    const settings = getSettings(vscodeInstance);
    const process = settings.commerceProcess || 'oraclecpqo';

    let wsAttributes = [];
    let wsLineAttributes = [];
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

    if (wsAttributes.length === 0 && wsLineAttributes.length === 0) {
      return null;
    }

    return {
      process,
      documentList: ['transaction', 'transactionLine'],
      integrations: [],
      transaction: {
        actions: [],
        attributes: wsAttributes,
        libraries: []
      },
      transactionLine: {
        actions: [],
        attributes: wsLineAttributes
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
    let libsRes = null;
    if (d === 'transaction') {
      libsRes = results[idx++];
    }

    data[d] = {
      actions: parseItems(actionsRes),
      attributes: parseItems(attrsRes)
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
