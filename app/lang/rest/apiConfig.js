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
async function listProductFamilies(
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
  { productFamily, offset = 0, limit = 100, q, fields = "variableName,label,name", signal } = {},
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

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models
async function listModels(
  context,
  vscode,
  { productFamily, productLine, offset = 0, limit = 100, q, fields = "variableName,label,name", signal } = {},
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
      listModels,
    },
  );
}

module.exports = {
  formatConfigurationAttribute,
  listConfigurationAttributes,
  listProductFamilies,
  listProductFamilyAttributes,
  listProductLines,
  listModels,
  listModelAttributes,
  syncConfigurationAttributes,
};
