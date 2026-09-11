const { call, getEffectiveRestVersion } = require("@/lang/rest/apiCore");
const {
  formatConfigurationAttribute,
  syncConfigurationAttributes: syncConfigImpl,
} = require("@/lang/rest/apiConfigSync");

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/attributes
async function listConfigurationAttributes(
  context,
  vscode,
  {
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups
async function listAllProductFamilySetups(
  context,
  vscode,
  { offset = 0, limit = 100, q, fields = "variableName,label", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies
async function listProductFamilies(
  context,
  vscode,
  { allProductFamilies = "_allProductFamilies", offset = 0, limit = 100, q, fields = "variableName,label,name", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/${allProductFamilies}/productFamilies`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/attributes
async function listProductFamilyAttributes(
  context,
  vscode,
  {
    productFamily = "defaultFamily",
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines
async function listProductLines(
  context,
  vscode,
  { productFamily, offset = 0, limit = 100, q, fields = "variableName,label", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/attributes
async function listProductLineAttributes(
  context,
  vscode,
  {
    productFamily,
    productLine,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models
async function listModels(
  context,
  vscode,
  { productFamily, productLine, offset = 0, limit = 100, q, fields = "variableName,label", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/attributes
async function listModelAttributes(
  context,
  vscode,
  {
    productFamily,
    productLine,
    model,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/rules
async function listProductFamilyRules(
  context,
  vscode,
  { productFamily, offset = 0, limit = 1000, q, signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/rules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/rules
async function listProductLineRules(
  context,
  vscode,
  { productFamily, productLine, offset = 0, limit = 1000, q, signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/rules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/rules
async function listModelRules(
  context,
  vscode,
  { productFamily, productLine, model, offset = 0, limit = 1000, q, signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/rules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/bomMappingRules
async function listModelBomMappingRules(
  context,
  vscode,
  {
    productFamily,
    productLine,
    model,
    offset = 0,
    limit = 1000,
    q,
    fields,
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/bomMappingRules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// Pulls and caches remote configuration attributes into .cpq/config.attributes.min.json
async function syncConfigurationAttributes(
  context,
  vscode,
  options = {},
  transport,
) {
  return syncConfigImpl(
    context,
    vscode,
    options,
    transport,
    {
      listConfigurationAttributes,
      listProductFamilies,
      listProductFamilyAttributes,
      listProductLines,
      listProductLineAttributes,
      listModels,
      listModelAttributes,
    },
  );
}

module.exports = {
  formatConfigurationAttribute,
  listAllProductFamilySetups,
  listConfigurationAttributes,
  listProductFamilies,
  listProductFamilyAttributes,
  listProductFamilyRules,
  listProductLines,
  listProductLineAttributes,
  listProductLineRules,
  listModels,
  listModelAttributes,
  listModelRules,
  listModelBomMappingRules,
  syncConfigurationAttributes,
};

