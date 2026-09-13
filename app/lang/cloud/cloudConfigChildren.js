'use strict';

const { safeParseJson } = require('@/lang/cloud/cloudVscodeShim');
const api = require('@/lang/rest/api');

/**
 * Loads child tree items for Config Explorer non-root elements.
 */
async function getConfigChildren(element, context, vscodeInstance) {
  if (element.type === 'globalAttributesFolder') {
    try {
      const res = await api.listConfigurationAttributes(context, vscodeInstance, { limit: 1000 });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No global attributes' }];
      }
      return items.map(attr => ({ type: 'attribute', data: attr }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch global attributes' }];
    }
  }

  if (element.type === 'productFamily') {
    const fam = element.familyVarName;
    return [
      { type: 'familyAttributesFolder', productFamily: fam },
      { type: 'productLinesFolder', productFamily: fam }
    ];
  }

  if (element.type === 'familyAttributesFolder') {
    try {
      const res = await api.listProductFamilyAttributes(context, vscodeInstance, { productFamily: element.productFamily });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No family attributes' }];
      }
      return items.map(attr => ({ type: 'attribute', data: attr }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch family attributes' }];
    }
  }

  if (element.type === 'productLinesFolder') {
    try {
      const res = await api.listProductLines(context, vscodeInstance, { productFamily: element.productFamily });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No product lines found' }];
      }
      return items.map(pl => ({
        type: 'productLine',
        data: pl,
        productFamily: element.productFamily,
        lineVarName: pl.variableName || pl.name
      }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch product lines' }];
    }
  }

  if (element.type === 'productLine') {
    return [
      { type: 'lineAttributesFolder', productFamily: element.productFamily, productLine: element.lineVarName },
      { type: 'modelsFolder', productFamily: element.productFamily, productLine: element.lineVarName }
    ];
  }

  if (element.type === 'lineAttributesFolder') {
    try {
      const res = await api.listProductLineAttributes(context, vscodeInstance, {
        productFamily: element.productFamily,
        productLine: element.productLine
      });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No line attributes' }];
      }
      return items.map(attr => ({ type: 'attribute', data: attr }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch line attributes' }];
    }
  }

  if (element.type === 'modelsFolder') {
    try {
      const res = await api.listModels(context, vscodeInstance, {
        productFamily: element.productFamily,
        productLine: element.productLine
      });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No models found' }];
      }
      return items.map(m => ({
        type: 'model',
        data: m,
        productFamily: element.productFamily,
        productLine: element.productLine,
        modelVarName: m.variableName || m.name
      }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch models' }];
    }
  }

  if (element.type === 'model') {
    return [
      { type: 'modelAttributesFolder', productFamily: element.productFamily, productLine: element.productLine, model: element.modelVarName },
      { type: 'modelBomRulesFolder', productFamily: element.productFamily, productLine: element.modelVarName }
    ];
  }

  if (element.type === 'modelAttributesFolder') {
    try {
      const res = await api.listModelAttributes(context, vscodeInstance, {
        productFamily: element.productFamily,
        productLine: element.productLine,
        model: element.model
      });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No model attributes' }];
      }
      return items.map(attr => ({ type: 'attribute', data: attr }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch model attributes' }];
    }
  }

  if (element.type === 'modelBomRulesFolder') {
    try {
      const res = await api.listModelBomMappingRules(context, vscodeInstance, {
        productFamily: element.productFamily,
        productLine: element.productLine,
        model: element.model
      });
      const body = safeParseJson(res.body);
      const items = Array.isArray(body) ? body : ((body && body.items) || []);
      if (items.length === 0) {
        return [{ type: 'empty', label: 'No BOM mapping rules found' }];
      }
      return items.map(r => ({
        type: 'bomRule',
        data: r,
        productFamily: element.productFamily,
        productLine: element.productLine,
        model: element.model
      }));
    } catch {
      return [{ type: 'empty', label: 'Failed to fetch BOM mapping rules' }];
    }
  }

  return [];
}

module.exports = {
  getConfigChildren
};
