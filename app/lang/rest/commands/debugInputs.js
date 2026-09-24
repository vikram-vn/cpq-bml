'use strict';

const api = require('@/lang/rest/api');
const configLib = require('@/lang/rest/config');
const metadataLib = require('@/lang/rest/metadata');
const { writeTerminalMessage } = require('@/lang/rest/commands/shared');
const { getExtensionContext } = require('@/extensionContext');

/**
 * Prompts user for debug inputs or reuses cached parameters and transaction IDs.
 */
async function promptDebugInputs({ context, vscode, metadata, options, resultsTerminal, transport } = {}) {
  const extCtx = getExtensionContext();
  context = context || extCtx.context;
  vscode = vscode || extCtx.vscode;
  const isCommerce = !!metadata.commerceDocument;
  const hasInputs =
    (metadata.parameters && metadata.parameters.length > 0) || isCommerce;

  let transactionIds = [];
  const parameterValues = {};
  let useCached = false;

  const forceConfigure = Boolean(
    options && (options.configureInputs || options.newInputs || options.prompt),
  );
  const smartReuse = configLib.getSmartDebugReuseInputs
    ? configLib.getSmartDebugReuseInputs(vscode)
    : true;

  if (options && options.transactionId) {
    transactionIds = [String(options.transactionId)];
    useCached = true;
    if (context && context.workspaceState) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      const cached = context.workspaceState.get(cacheKey) || {};
      cached.transactionId = options.transactionId;
      context.workspaceState.update(cacheKey, cached);
    }
  } else if (hasInputs && context.workspaceState && !forceConfigure) {
    const cacheKey = `debugCache:${metadata.variableName}`;
    const cached = context.workspaceState.get(cacheKey);
    if (cached) {
      const paramsSummary = (metadata.parameters || [])
        .map((p) => {
          const val = cached.parameterValues && cached.parameterValues[p.name];
          return `${p.name}=${val !== undefined ? val : ''}`;
        })
        .join(', ');
      const txSummary = isCommerce
        ? `Transaction(s): ${cached.transactionId || 'None'}`
        : '';
      const summary = [txSummary, paramsSummary].filter(Boolean).join('; ');

      const hasTx = !isCommerce || (cached.transactionId !== undefined && cached.transactionId !== null && String(cached.transactionId).trim() !== '');
      const hasAllParams = !metadata.parameters || metadata.parameters.every((p) => cached.parameterValues && cached.parameterValues[p.name] !== undefined);

      if (smartReuse && hasTx && hasAllParams) {
        useCached = true;
        const rawCachedTx = cached.transactionId;
        if (Array.isArray(rawCachedTx)) {
          transactionIds = rawCachedTx
            .map((t) => String(t).trim())
            .filter(Boolean);
        } else if (typeof rawCachedTx === 'string' && rawCachedTx.includes(',')) {
          transactionIds = rawCachedTx
            .split(/[\s,]+/)
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (
          rawCachedTx !== undefined &&
          rawCachedTx !== null &&
          String(rawCachedTx).trim()
        ) {
          transactionIds = [String(rawCachedTx).trim()];
        }
        Object.assign(parameterValues, cached.parameterValues || {});

        if (vscode.window && typeof vscode.window.setStatusBarMessage === 'function') {
          const txInfo = transactionIds.length > 0 ? ` (txn: ${transactionIds.join(', ')})` : '';
          vscode.window.setStatusBarMessage(`CPQ-BML: Smart Debug reused previous inputs${txInfo}`, 4000);
        }
        const isResultsOnly = Boolean(
          (options && (options.resultsOnly || options.showResultsOnly)) ||
          (typeof configLib.getShowDebugResultsOnly === 'function' && configLib.getShowDebugResultsOnly(vscode))
        );
        if (!isResultsOnly) {
          writeTerminalMessage(
            resultsTerminal,
            '[Smart Debug] ',
            `Reusing previous inputs: ${summary}. (Run "CPQ-BML: Debug Current Function (Configure New Inputs / Transaction...)" to change)`,
            '\x1b[36m',
          );
        }
      } else if (!smartReuse) {
        const picks = [
          {
            label: '$(play) Run with last inputs',
            description: summary,
            id: 'last',
          },
          {
            label: '$(gear) Configure inputs...',
            description: 'Enter new transaction ID(s) and parameter values',
            id: 'new',
          },
        ];

        const selected = await vscode.window.showQuickPick(picks, {
          placeHolder: `Debug "${metadata.variableName}": choose inputs option`,
          ignoreFocusOut: true,
        });

        if (!selected) {
          return {
            cancelled: true,
            result: {
              success: false,
              errorMessage: 'Cancelled: no debug inputs selected.',
            },
          };
        }

        if (selected.id === 'last') {
          useCached = true;
          const rawCachedTx = cached.transactionId;
          if (Array.isArray(rawCachedTx)) {
            transactionIds = rawCachedTx
              .map((t) => String(t).trim())
              .filter(Boolean);
          } else if (typeof rawCachedTx === 'string' && rawCachedTx.includes(',')) {
            transactionIds = rawCachedTx
              .split(/[\s,]+/)
              .map((t) => t.trim())
              .filter(Boolean);
          } else if (
            rawCachedTx !== undefined &&
            rawCachedTx !== null &&
            String(rawCachedTx).trim()
          ) {
            transactionIds = [String(rawCachedTx).trim()];
          }
          Object.assign(parameterValues, cached.parameterValues || {});
        }
      }
    }
  }

  if (!useCached) {
    for (const param of metadata.parameters || []) {
      const typeLabel = param.dataType && param.dataType.displayValue;
      const cacheKey = `debugCache:${metadata.variableName}`;
      const cached = context.workspaceState
        ? context.workspaceState.get(cacheKey)
        : null;
      const prefill =
        cached && cached.parameterValues
          ? cached.parameterValues[param.name]
          : '';

      let value = await vscode.window.showInputBox({
        prompt: `Value for parameter "${param.name}"${typeLabel ? ` (${typeLabel})` : ''}`,
        value: String(prefill !== undefined && prefill !== null ? prefill : ''),
        ignoreFocusOut: true,
      });
      if (value === undefined) {
        return {
          cancelled: true,
          result: {
            success: false,
            errorMessage: `Cancelled: no value given for parameter "${param.name}".`,
          },
        };
      }
      value = metadataLib.normalizeNumericValue(value, param.dataType);
      parameterValues[param.name] = value;
    }

    if (isCommerce) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      const cached = context.workspaceState
        ? context.workspaceState.get(cacheKey)
        : null;
      const prefill =
        cached && cached.transactionId ? String(cached.transactionId) : '';

      const transactionIdStr = await vscode.window.showInputBox({
        prompt:
          'Transaction ID(s) for debugging (e.g. 48420727 or 48420727, 48420728 - 2 to 10 concurrent) - leave blank to pick from CPQ transactions',
        value: prefill,
        ignoreFocusOut: true,
      });
      if (transactionIdStr === undefined) {
        return {
          cancelled: true,
          result: {
            success: false,
            errorMessage: 'Cancelled: no transaction ID given.',
          },
        };
      }

      if (transactionIdStr && transactionIdStr.trim()) {
        transactionIds = transactionIdStr
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (transactionIds.length === 0) {
        try {
          const res = await api.getTransactions(
            {
              process: metadata.commerceProcess,
              document: metadata.commerceDocument,
              limit: 25,
            },
            transport,
          );
          const rawItems = res && res.body
            ? (res.body.items || res.body.records || res.body.results || (Array.isArray(res.body) ? res.body : []))
            : [];
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            const picks = rawItems.map((it) => {
              const quoteNum = it.transactionID_t || it.transactionId || it.quoteNumber || '';
              const dbId = it._id || it.bs_id || it.id || '';
              const label = quoteNum ? `Quote: ${quoteNum}` : `ID: ${dbId}`;
              const desc = dbId && quoteNum
                ? `bs_id: ${dbId} | CPQ ID: ${quoteNum}`
                : (dbId ? `bs_id: ${dbId}` : `CPQ ID: ${quoteNum}`);
              return {
                label,
                description: desc,
                id: String(dbId || quoteNum),
              };
            });
            const picked = await vscode.window.showQuickPick(picks, {
              placeHolder:
                'Select transaction(s) from CPQ to use for debugging (up to 10)',
              ignoreFocusOut: true,
              canPickMany: true,
            });
            if (Array.isArray(picked)) {
              transactionIds = picked.map((it) =>
                String(it.id || it.label || it),
              );
            } else if (picked) {
              transactionIds = [String(picked.id || picked.label || picked)];
            }
          }
        } catch (e) {}
      }

      if (transactionIds.length > 10) {
        if (
          vscode.window &&
          typeof vscode.window.showWarningMessage === 'function'
        ) {
          vscode.window.showWarningMessage(
            `CPQ-BML: Capped at 10 transactions max for concurrent debugging (${transactionIds.length} requested).`,
          );
        }
        transactionIds = transactionIds.slice(0, 10);
      }

      if (transactionIds.length === 0) {
        const errorMessage =
          'CPQ-BML: Transaction ID is required to debug commerce functions.';
        vscode.window.showErrorMessage(errorMessage);
        return { cancelled: true, result: { success: false, errorMessage } };
      }
    }

    if (hasInputs && context.workspaceState) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      await context.workspaceState.update(cacheKey, {
        transactionId: transactionIds.join(', '),
        parameterValues,
      });
    }
  }

  return {
    cancelled: false,
    transactionIds,
    parameterValues,
    isCommerce,
  };
}

module.exports = {
  promptDebugInputs,
};
