const api = require('@/lang/rest/api');
const { resolveCommerceTargets } = require('@/lang/cloud/cloudExplorerFiles');
const { safeParseJson } = require('@/lang/cloud/cloudVscodeShim');

async function fetchUtilFunctions(vscodeInstance, context) {
  let allItems = [];
  let offset = 0;
  const limit = 1000;

  for (;;) {
    const { statusCode, body } = await api.listLibraryFunctions(context, vscodeInstance, { offset, limit });
    if (statusCode < 200 || statusCode >= 300) {
      break;
    }

    const parsed = safeParseJson(body);
    const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
    for (const it of items) {
      it.isCommerce = false;
    }
    allItems = allItems.concat(items);

    const hasMore = parsed && (
      parsed.hasMore === true ||
      (parsed.hasMore === undefined && items.length > 0 && parsed.totalResults !== undefined && offset + items.length < parsed.totalResults) ||
      (parsed.hasMore === undefined && items.length === limit)
    );

    if (!hasMore || items.length === 0) break;
    offset += items.length;
  }
  return allItems;
}

async function fetchCommerceFunctions(vscodeInstance, context) {
  let targets = await resolveCommerceTargets(vscodeInstance, context);
  let allItems = [];

  async function queryTarget(target) {
    const commerceProcess = target.process;
    const commerceDocument = target.document;
    const commerceMetadata = { commerceProcess, commerceDocument };
    let offset = 0;
    const limit = 1000;
    const items = [];

    for (;;) {
      const { statusCode, body } = await api.listLibraryFunctions(
        context,
        vscodeInstance,
        { offset, limit },
        undefined,
        commerceMetadata
      );
      if (statusCode < 200 || statusCode >= 300) {
        break;
      }

      const parsed = safeParseJson(body);
      const batch = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
      for (const it of batch) {
        it.isCommerce = true;
        it.commerceProcess = commerceProcess;
        it.commerceDocument = commerceDocument;
      }
      items.push(...batch);

      const hasMore = parsed && (
        parsed.hasMore === true ||
        (parsed.hasMore === undefined && batch.length > 0 && parsed.totalResults !== undefined && offset + batch.length < parsed.totalResults) ||
        (parsed.hasMore === undefined && batch.length === limit)
      );

      if (!hasMore || batch.length === 0) break;
      offset += batch.length;
    }
    return items;
  }

  for (const t of targets) {
    const found = await queryTarget(t);
    allItems.push(...found);
  }

  if (allItems.length === 0 && targets.some(t => t.process === 'oraclecpqo')) {
    const remoteTargets = await resolveCommerceTargets(vscodeInstance, context, true);
    const newTargets = remoteTargets.filter(rt => rt.process !== 'oraclecpqo');
    if (newTargets.length > 0) {
      for (const t of newTargets) {
        const found = await queryTarget(t);
        allItems.push(...found);
      }
    }
  }

  return allItems;
}

async function fetchCommerceActions(vscodeInstance, context) {
  let targets = await resolveCommerceTargets(vscodeInstance, context);
  let allActions = [];

  async function queryActionsForTarget(target) {
    const commerceProcess = target.process;
    const commerceDocument = target.document;
    const actions = [];
    try {
      const res = await api.listCommerceActions(context, vscodeInstance, {
        process: commerceProcess,
        document: commerceDocument,
        limit: 1000
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return actions;
      }

      const parsed = safeParseJson(res.body);

      const items = Array.isArray(parsed)
        ? parsed
        : ((parsed && (parsed.items || parsed.actions || parsed.data)) || []);
      for (const item of items) {
        item.commerceProcess = commerceProcess;
        item.commerceDocument = commerceDocument;
        actions.push(item);
      }
    } catch {}
    return actions;
  }

  for (const target of targets) {
    const found = await queryActionsForTarget(target);
    allActions.push(...found);
  }

  if (allActions.length === 0 && targets.some(t => t.process === 'oraclecpqo')) {
    const remoteTargets = await resolveCommerceTargets(vscodeInstance, context, true);
    const newTargets = remoteTargets.filter(rt => rt.process !== 'oraclecpqo');
    if (newTargets.length > 0) {
      for (const t of newTargets) {
        const found = await queryActionsForTarget(t);
        allActions.push(...found);
      }
    }
  }

  return allActions;
}

module.exports = {
  fetchUtilFunctions,
  fetchCommerceFunctions,
  fetchCommerceActions,
};
