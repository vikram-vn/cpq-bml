const api = require('@/lang/rest/api');
const config = require('@/lang/rest/config');
const { isSuccess, describeError } = require('@/lang/rest/commands/shared');

async function listCommerceDocumentsTool(context, vscode, args = {}, transport) {
  const proc = args.commerceProcess || config.getCommerceProcess(vscode) || 'oraclecpqo';
  try {
    const res = await api.listCommerceDocuments(context, vscode, { process: proc, limit: 100 }, transport);
    if (!isSuccess(res.statusCode)) {
      return {
        success: false,
        error: `Failed to list documents for process '${proc}' (HTTP ${res.statusCode}). ${describeError(res.body)}`,
      };
    }
    const items = (res.body && (res.body.items || res.body.documents)) || [];
    return {
      success: true,
      commerceProcess: proc,
      documents: items.map(d => ({
        variableName: d.variableName || d.name,
        name: d.name || d.variableName,
        description: d.description || '',
      })),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

const { extractStringValue } = require('@/lang/cloud/cloudVscodeShim');

async function listCommerceActionsTool(context, vscode, args = {}, transport) {
  const proc = args.commerceProcess || config.getCommerceProcess(vscode) || 'oraclecpqo';
  const docsToQuery = args.commerceDocument
    ? [args.commerceDocument]
    : ['transaction', 'transactionLine'];

  const allActions = [];
  const errors = [];

  for (const doc of docsToQuery) {
    try {
      const res = await api.listCommerceActions(
        context,
        vscode,
        { process: proc, document: doc, limit: args.limit || 1000, offset: args.offset || 0 },
        transport
      );
      if (isSuccess(res.statusCode)) {
        const body = res.body;
        const items = Array.isArray(body)
          ? body
          : ((body && (body.items || body.actions || body.data)) || []);
        for (const it of items) {
          allActions.push({
            variableName: extractStringValue(it.variableName || it.name, 'action'),
            label: extractStringValue(it.label || it.name || it.variableName, 'Action'),
            type: extractStringValue(it.actionType) || extractStringValue(it.type) || 'Action',
            description: extractStringValue(it.description, ''),
            commerceProcess: proc,
            commerceDocument: doc,
          });
        }
      } else if (args.commerceDocument) {
        errors.push(`Document '${doc}' returned HTTP ${res.statusCode}: ${describeError(res.body)}`);
      }
    } catch (err) {
      errors.push(`Document '${doc}' failed: ${err.message || String(err)}`);
    }
  }

  return {
    success: allActions.length > 0 || errors.length === 0,
    commerceProcess: proc,
    count: allActions.length,
    actions: allActions,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function getCommerceActionTool(context, vscode, args = {}, transport) {
  if (!args.actionVariableName) {
    return { success: false, error: 'actionVariableName is required' };
  }
  const proc = args.commerceProcess || config.getCommerceProcess(vscode) || 'oraclecpqo';
  const doc = args.commerceDocument || config.getCommerceDocument(vscode) || 'transaction';

  try {
    const res = await api.getCommerceAction(
      context,
      vscode,
      args.actionVariableName,
      { process: proc, document: doc },
      transport
    );
    if (!isSuccess(res.statusCode)) {
      return {
        success: false,
        error: `Action '${args.actionVariableName}' not found in ${proc}/${doc} (HTTP ${res.statusCode}). ${describeError(res.body)}`,
      };
    }
    return {
      success: true,
      commerceProcess: proc,
      commerceDocument: doc,
      action: res.body,
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = {
  listCommerceDocumentsTool,
  listCommerceActionsTool,
  getCommerceActionTool,
};
