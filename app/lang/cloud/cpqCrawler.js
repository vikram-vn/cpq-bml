const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { getSettings, getWorkspaceRoot, isConfigured } = require('@/lang/rest/config');
const { safeParseJson } = require('./cloudVscodeShim');

function extractItems(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const body = safeParseJson(response.body !== undefined ? response.body : response);
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  if (body && Array.isArray(body.processes)) return body.processes;
  if (body && Array.isArray(body.documents)) return body.documents;
  if (body && Array.isArray(body.productFamilies)) return body.productFamilies;
  if (body && Array.isArray(body.productLines)) return body.productLines;
  if (body && Array.isArray(body.models)) return body.models;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

function normalizeAttr(raw, scope = 'Commerce', docOrFamily = '') {
  if (!raw || typeof raw !== 'object') return raw;
  const varName = raw.variableName || raw.name || raw.id || '';
  let dataType = 'String';
  if (raw.dataType) {
    dataType = typeof raw.dataType === 'object'
      ? (raw.dataType.displayValue || raw.dataType.lookupCode || 'String')
      : String(raw.dataType);
  } else if (raw.type) {
    dataType = typeof raw.type === 'object' ? (raw.type.displayValue || 'String') : String(raw.type);
  } else if (raw.inputTypeCode) {
    dataType = raw.inputTypeCode;
  }

  return {
    name: varName,
    variableName: varName,
    label: raw.label || raw.displayLabel || raw.name || varName,
    type: dataType,
    dataType,
    scope,
    parent: docOrFamily,
    required: Boolean(raw.required),
    defaultValue: raw.defaultValue !== undefined ? raw.defaultValue : null,
    description: raw.description ? String(raw.description).trim() : ''
  };
}

/**
 * Deep crawler that hits the two root CPQ endpoints:
 * 1) /rest/v19/commerceProcesses/ (Commerce)
 * 2) /rest/v19/productFamilies/ (Configuration)
 * and iteratively digs through child documents, actions, attributes, product lines, and models.
 */
async function crawlCpqSchema(context, vscode, options = {}, transport) {
  const wsRoot = getWorkspaceRoot(vscode) || process.cwd();
  const settings = getSettings(vscode);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  const stats = {
    processes: 0,
    documents: 0,
    actions: 0,
    attributes: 0,
    productFamilies: 0,
    productLines: 0,
    models: 0,
    dataTables: 0
  };

  const schema = {
    updatedAt: new Date().toISOString(),
    siteUrl: settings.siteUrl || '',
    commerce: {
      processes: [],
      documents: {}
    },
    configuration: {
      productFamilies: []
    },
    transactionAttributes: [],
    lineItemAttributes: [],
    dataTables: [],
    actions: []
  };

  // -------------------------------------------------------------
  // 1. COMMERCE ROOT: /rest/v19/commerceProcesses
  // -------------------------------------------------------------
  onProgress({ stage: 'commerce', message: 'Discovering Commerce Processes...' });
  let procItems = [];
  try {
    const procRes = await api.listCommerceProcesses(context, vscode, { limit: 100 }, transport);
    procItems = extractItems(procRes);
  } catch (err) {
    console.warn('Could not fetch commerce processes root:', err?.message || err);
  }

  if (procItems.length === 0) {
    const defaultProc = settings.commerceProcess || 'oraclecpqo';
    procItems = [{ variableName: defaultProc, name: defaultProc, label: defaultProc }];
  }

  stats.processes = procItems.length;

  for (const proc of procItems) {
    const procVar = proc.variableName || proc.name || proc.id || 'oraclecpqo';
    const procEntry = {
      variableName: procVar,
      label: proc.label || proc.name || procVar,
      description: proc.description || '',
      documents: []
    };

    onProgress({ stage: 'commerce', message: `Discovering documents for process '${procVar}'...` });
    let docItems = [];
    try {
      const docRes = await api.listCommerceDocuments(context, vscode, { process: procVar, limit: 50 }, transport);
      docItems = extractItems(docRes);
    } catch {}

    if (docItems.length === 0) {
      docItems = [
        { variableName: 'transaction', label: 'Transaction (Header)' },
        { variableName: 'transactionLine', label: 'Transaction Line' }
      ];
    }

    for (const doc of docItems) {
      const docVar = doc.variableName || doc.name || doc.id || 'transaction';
      stats.documents++;
      onProgress({ stage: 'commerce', message: `Crawling actions & attributes for '${procVar}/${docVar}'...` });

      const [actionsRes, attrsRes, libsRes] = await Promise.allSettled([
        api.listCommerceActions(context, vscode, { process: procVar, document: docVar, limit: 1000 }, transport),
        api.listCommerceAttributes(context, vscode, { process: procVar, document: docVar, limit: 1000 }, transport),
        docVar === 'transaction'
          ? api.listLibraryFunctions(context, vscode, { limit: 1000 }, transport, { commerceProcess: procVar, commerceDocument: docVar })
          : Promise.resolve({ items: [] })
      ]);

      const docActions = extractItems(actionsRes.status === 'fulfilled' ? actionsRes.value : null);
      const docRawAttrs = extractItems(attrsRes.status === 'fulfilled' ? attrsRes.value : null);
      const docLibs = extractItems(libsRes.status === 'fulfilled' ? libsRes.value : null);

      stats.actions += docActions.length;
      stats.attributes += docRawAttrs.length;

      const normAttrs = docRawAttrs.map(a => normalizeAttr(a, 'Commerce', docVar));

      if (docVar === 'transaction' || docVar.toLowerCase().includes('header')) {
        schema.transactionAttributes.push(...normAttrs);
      } else {
        schema.lineItemAttributes.push(...normAttrs);
      }

      const prunedActions = docActions.map(act => ({
        variableName: act.variableName || act.name,
        label: act.label || act.name || act.variableName,
        actionType: act.actionType || 'Modify',
        description: act.description ? String(act.description).trim() : '',
        document: docVar,
        process: procVar
      }));

      const prunedLibs = docLibs.map(lib => ({
        name: lib.name || lib.variableName,
        description: lib.description || '',
        returnType: lib.returnType || ''
      }));

      for (const act of prunedActions) {
        schema.actions.push(act);
      }

      const docEntry = {
        variableName: docVar,
        label: doc.label || docVar,
        actions: prunedActions,
        attributes: normAttrs,
        libraries: prunedLibs
      };

      procEntry.documents.push(docEntry);
      schema.commerce.documents[`${procVar}_${docVar}`] = docEntry;
    }

    schema.commerce.processes.push(procEntry);
  }

  // -------------------------------------------------------------
  // 2. CONFIGURATION ROOT: /rest/v19/productFamilies
  // -------------------------------------------------------------
  onProgress({ stage: 'configuration', message: 'Discovering Product Families...' });
  let famItems = [];
  try {
    let famRes = await api.listDirectProductFamilies(context, vscode, { limit: 100 }, transport);
    famItems = extractItems(famRes);
    if (famItems.length === 0) {
      famRes = await api.listProductFamilies(context, vscode, { limit: 100 }, transport);
      famItems = extractItems(famRes);
    }
  } catch (err) {
    console.warn('Could not fetch product families root:', err?.message || err);
  }

  stats.productFamilies = famItems.length;

  for (const pf of famItems) {
    const pfVar = pf.variableName || pf.name || pf.id;
    if (!pfVar) continue;

    onProgress({ stage: 'configuration', message: `Crawling Product Family '${pfVar}'...` });
    const [famAttrsRes, linesRes] = await Promise.allSettled([
      api.listProductFamilyAttributes(context, vscode, { productFamily: pfVar, direct: true, limit: 1000 }, transport)
        .catch(() => api.listProductFamilyAttributes(context, vscode, { productFamily: pfVar, limit: 1000 }, transport)),
      api.listProductLines(context, vscode, { productFamily: pfVar, direct: true, limit: 100 }, transport)
        .catch(() => api.listProductLines(context, vscode, { productFamily: pfVar, limit: 100 }, transport))
    ]);

    const famAttrs = extractItems(famAttrsRes.status === 'fulfilled' ? famAttrsRes.value : null).map(a => normalizeAttr(a, 'Configuration', pfVar));
    const lines = extractItems(linesRes.status === 'fulfilled' ? linesRes.value : null);

    stats.attributes += famAttrs.length;
    stats.productLines += lines.length;

    const pfEntry = {
      variableName: pfVar,
      label: pf.label || pf.name || pfVar,
      description: pf.description || '',
      attributes: famAttrs,
      productLines: []
    };

    for (const pl of lines) {
      const plVar = pl.variableName || pl.name || pl.id;
      if (!plVar) continue;

      onProgress({ stage: 'configuration', message: `Crawling Product Line '${pfVar}/${plVar}'...` });
      const [lineAttrsRes, modelsRes] = await Promise.allSettled([
        api.listProductLineAttributes(context, vscode, { productFamily: pfVar, productLine: plVar, direct: true, limit: 1000 }, transport)
          .catch(() => api.listProductLineAttributes(context, vscode, { productFamily: pfVar, productLine: plVar, limit: 1000 }, transport)),
        api.listModels(context, vscode, { productFamily: pfVar, productLine: plVar, direct: true, limit: 100 }, transport)
          .catch(() => api.listModels(context, vscode, { productFamily: pfVar, productLine: plVar, limit: 100 }, transport))
      ]);

      const lineAttrs = extractItems(lineAttrsRes.status === 'fulfilled' ? lineAttrsRes.value : null).map(a => normalizeAttr(a, 'Configuration', `${pfVar}.${plVar}`));
      const models = extractItems(modelsRes.status === 'fulfilled' ? modelsRes.value : null);

      stats.attributes += lineAttrs.length;
      stats.models += models.length;

      const plEntry = {
        variableName: plVar,
        label: pl.label || pl.name || plVar,
        attributes: lineAttrs,
        models: []
      };

      for (const m of models) {
        const mVar = m.variableName || m.name || m.id;
        if (!mVar) continue;

        onProgress({ stage: 'configuration', message: `Crawling Model '${pfVar}/${plVar}/${mVar}'...` });
        const [modelAttrsRes, bomRes] = await Promise.allSettled([
          api.listModelAttributes(context, vscode, { productFamily: pfVar, productLine: plVar, model: mVar, direct: true, limit: 1000 }, transport)
            .catch(() => api.listModelAttributes(context, vscode, { productFamily: pfVar, productLine: plVar, model: mVar, limit: 100 }, transport)),
          api.listModelBomMappingRules(context, vscode, { productFamily: pfVar, productLine: plVar, model: mVar, limit: 100 }, transport)
        ]);

        const modelAttrs = extractItems(modelAttrsRes.status === 'fulfilled' ? modelAttrsRes.value : null).map(a => normalizeAttr(a, 'Configuration', `${pfVar}.${plVar}.${mVar}`));
        const bomRules = extractItems(bomRes.status === 'fulfilled' ? bomRes.value : null);

        stats.attributes += modelAttrs.length;

        const prunedBom = bomRules.map(b => ({
          variableName: b.variableName || b.name,
          description: b.description || ''
        }));

        plEntry.models.push({
          variableName: mVar,
          label: m.label || m.name || mVar,
          attributes: modelAttrs,
          bomMappingRules: prunedBom
        });
      }

      pfEntry.productLines.push(plEntry);
    }

    schema.configuration.productFamilies.push(pfEntry);
  }

  // -------------------------------------------------------------
  // 3. DATA TABLES (if available)
  // -------------------------------------------------------------
  try {
    const dtRes = await api.listDataTables(context, vscode, { limit: 200 }, transport);
    const tables = extractItems(dtRes);
    stats.dataTables = tables.length;
    schema.dataTables = tables.map(t => ({
      name: t.name || t.variableName,
      description: t.description || '',
      columns: Array.isArray(t.columns) ? t.columns.map(c => c.name || c.variableName || c) : []
    }));
  } catch {}

  // -------------------------------------------------------------
  // 4. WRITE PERSISTENT SCHEMA FILES (Partitioned & Pruned)
  // -------------------------------------------------------------
  let storageDir = null;
  if (options.saveToFile !== false) {
    storageDir = resolveStorageDir(context, vscode, options);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // 1. commerce.json - Pruned Commerce domain data
    const commercePayload = {
      updatedAt: schema.updatedAt,
      siteUrl: schema.siteUrl,
      processes: schema.commerce.processes,
      documents: schema.commerce.documents,
      actions: schema.actions,
      transactionAttributes: schema.transactionAttributes,
      lineItemAttributes: schema.lineItemAttributes
    };
    fs.writeFileSync(
      path.join(storageDir, 'commerce.json'),
      JSON.stringify(commercePayload, null, 2),
      'utf8'
    );

    // 2. config.json - Pruned Configuration domain data
    const configPayload = {
      updatedAt: schema.updatedAt,
      siteUrl: schema.siteUrl,
      productFamilies: schema.configuration.productFamilies
    };
    fs.writeFileSync(
      path.join(storageDir, 'config.json'),
      JSON.stringify(configPayload, null, 2),
      'utf8'
    );

    // 3. datatables.json - Data table definitions
    const dtPayload = {
      updatedAt: schema.updatedAt,
      siteUrl: schema.siteUrl,
      dataTables: schema.dataTables
    };
    fs.writeFileSync(
      path.join(storageDir, 'datatables.json'),
      JSON.stringify(dtPayload, null, 2),
      'utf8'
    );

    // 4. metadata.json - Flattened low-latency dictionary for autocomplete
    const metaPayload = {
      updatedAt: schema.updatedAt,
      siteUrl: schema.siteUrl,
      attributes: [...schema.transactionAttributes, ...schema.lineItemAttributes],
      actions: schema.actions,
      dataTables: schema.dataTables,
      productFamilies: schema.configuration.productFamilies
    };
    fs.writeFileSync(
      path.join(storageDir, 'metadata.json'),
      JSON.stringify(metaPayload, null, 2),
      'utf8'
    );

    // 5. schema.json - Unified pruned schema graph
    fs.writeFileSync(
      path.join(storageDir, 'schema.json'),
      JSON.stringify(schema, null, 2),
      'utf8'
    );

    // 6. cpq.d.bml - Dynamic type definitions
    const dtsLines = [
      '// Oracle CPQ Dynamic Type Definitions',
      `// Auto-generated by CPQ Crawler on ${schema.updatedAt}`,
      `// Site: ${schema.siteUrl}`,
      '',
      '// Commerce Header Attributes (_transaction)',
      ...schema.transactionAttributes.map(a => `// ${a.type} ${a.name}; /* ${a.label || a.description || ''} */`),
      '',
      '// Commerce Line Item Attributes (_line_item_list)',
      ...schema.lineItemAttributes.map(a => `// ${a.type} ${a.name}; /* ${a.label || a.description || ''} */`),
      '',
      '// Data Tables',
      ...schema.dataTables.map(dt => `// Table: ${dt.name} (${(dt.columns || []).join(', ')})`)
    ];
    fs.writeFileSync(
      path.join(storageDir, 'cpq.d.bml'),
      dtsLines.join('\n'),
      'utf8'
    );
  }

  return {
    ok: true,
    schema,
    stats,
    storageDir
  };
}

function resolveStorageDir(context, vscode, options = {}) {
  if (options.outputDir) {
    return options.outputDir;
  }
  if (context && context.globalStorageUri && context.globalStorageUri.fsPath) {
    return path.join(context.globalStorageUri.fsPath, 'schema');
  }
  if (context && context.storageUri && context.storageUri.fsPath) {
    return path.join(context.storageUri.fsPath, 'schema');
  }
  if (context && context.globalStoragePath) {
    return path.join(context.globalStoragePath, 'schema');
  }
  const wsRoot = getWorkspaceRoot(vscode);
  if (options.useWorkspaceDir && wsRoot) {
    return path.join(wsRoot, '.cpq');
  }
  if (wsRoot && fs.existsSync(path.join(wsRoot, '.cpq'))) {
    return path.join(wsRoot, '.cpq');
  }
  if (wsRoot) {
    return path.join(wsRoot, '.cpq');
  }
  const os = require('os');
  return path.join(os.homedir(), '.cpq');
}

module.exports = {
  crawlCpqSchema,
  extractItems,
  normalizeAttr,
  resolveStorageDir
};
