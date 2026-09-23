const { call, getEffectiveRestVersion, normalizeArgs } = require("@/lang/rest/apiCore");
const {
  formatConfigurationAttribute,
  syncConfigurationAttributes: syncConfigImpl,
} = require("@/lang/rest/apiConfigSync");

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/attributes
async function listConfigurationAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = opts;

  const version = getEffectiveRestVersion(null, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: "/allProductFamilySetups/_allProductFamilies/attributes",
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups
async function listAllProductFamilySetups(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 100, q, fields = "variableName,label", signal } = opts;

  const version = getEffectiveRestVersion(null, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: "/allProductFamilySetups",
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies or /rest/<version>/productFamilies
async function listProductFamilies(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    allProductFamilies = "_allProductFamilies",
    direct = false,
    offset = 0,
    limit = 100,
    q,
    fields = "variableName,label,name",
    signal
  } = opts;

  const version = getEffectiveRestVersion(null, direct ? 19 : 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const path = (direct || allProductFamilies === null)
    ? "/productFamilies"
    : `/allProductFamilySetups/${allProductFamilies}/productFamilies`;

  const res = await call(
    {
      path,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );

  if (!direct && allProductFamilies !== null && res && res.statusCode === 404) {
    return listProductFamilies({ allProductFamilies: null, direct: true, offset, limit, q, fields, signal }, tr);
  }
  return res;
}

// Direct root endpoint: GET /rest/<version>/productFamilies
async function listDirectProductFamilies(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  return listProductFamilies({ ...opts, direct: true }, tr);
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/attributes or direct /productFamilies/{family}/attributes
async function listProductFamilyAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    productFamily = "defaultFamily",
    direct = false,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = opts;

  const version = getEffectiveRestVersion(null, direct ? 19 : 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const path = direct
    ? `/productFamilies/${productFamily}/attributes`
    : `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/attributes`;

  return call(
    {
      path,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines or direct /productFamilies/{family}/productLines
async function listProductLines(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    productFamily,
    direct = false,
    offset = 0,
    limit = 100,
    q,
    fields = "variableName,label",
    signal
  } = opts;

  const version = getEffectiveRestVersion(null, direct ? 19 : 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const path = direct
    ? `/productFamilies/${productFamily}/productLines`
    : `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines`;

  const res = await call(
    {
      path,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );

  if (!direct && res && res.statusCode === 404) {
    return listProductLines({ productFamily, direct: true, offset, limit, q, fields, signal }, tr);
  }
  return res;
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/attributes or direct
async function listProductLineAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    productFamily,
    productLine,
    direct = false,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = opts;

  const version = getEffectiveRestVersion(null, direct ? 19 : 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const path = direct
    ? `/productFamilies/${productFamily}/productLines/${productLine}/attributes`
    : `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/attributes`;

  return call(
    {
      path,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models or direct
async function listModels(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    productFamily,
    productLine,
    direct = false,
    offset = 0,
    limit = 100,
    q,
    fields = "variableName,label",
    signal
  } = opts;

  const version = getEffectiveRestVersion(null, direct ? 19 : 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const path = direct
    ? `/productFamilies/${productFamily}/productLines/${productLine}/models`
    : `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models`;

  const res = await call(
    {
      path,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );

  if (!direct && res && res.statusCode === 404) {
    return listModels({ productFamily, productLine, direct: true, offset, limit, q, fields, signal }, tr);
  }
  return res;
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/attributes or direct
async function listModelAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    productFamily,
    productLine,
    model,
    direct = false,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = opts;

  const version = getEffectiveRestVersion(null, direct ? 19 : 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const path = direct
    ? `/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/attributes`
    : `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/attributes`;

  return call(
    {
      path,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/rules
async function listProductFamilyRules(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { productFamily, offset = 0, limit = 1000, q, signal } = opts;

  const version = getEffectiveRestVersion(null, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;

  return call(
    {
      path: `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/rules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/rules
async function listProductLineRules(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { productFamily, productLine, offset = 0, limit = 1000, q, signal } = opts;

  const version = getEffectiveRestVersion(null, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;

  return call(
    {
      path: `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/rules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/rules
async function listModelRules(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { productFamily, productLine, model, offset = 0, limit = 1000, q, signal } = opts;

  const version = getEffectiveRestVersion(null, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;

  return call(
    {
      path: `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/rules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/bomMappingRules
async function listModelBomMappingRules(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    productFamily,
    productLine,
    model,
    offset = 0,
    limit = 1000,
    q,
    fields,
    signal,
  } = opts;

  const version = getEffectiveRestVersion(null, 18);
  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: `/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/bomMappingRules`,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// Pulls and caches remote configuration attributes into cpq/config/<productFamily>/attributes.min.json
async function syncConfigurationAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  return syncConfigImpl(
    null,
    null,
    opts,
    tr,
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
  listDirectProductFamilies,
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
