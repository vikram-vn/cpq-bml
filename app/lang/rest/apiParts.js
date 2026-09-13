const { call, getEffectiveRestVersion } = require('@/lang/rest/apiCore');

// GET /rest/<version>/parts
async function listParts(
  context,
  vscode,
  {
    offset = 0,
    limit = 100,
    q,
    orderBy = 'dateModified:desc',
    fields = 'partNumber,description,price,currency,status,units,dateModified',
    signal
  } = {},
  transport
) {
  const version = getEffectiveRestVersion(vscode, 19);
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;
  if (orderBy) queryParams.orderBy = orderBy;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/parts`,
      method: 'GET',
      query: queryParams,
      signal
    },
    transport
  );
}

// GET /rest/<version>/parts/<id>
async function getPart(context, vscode, id, { fields, signal } = {}, transport) {
  if (!id) {
    throw new Error('Part id / partNumber is required.');
  }

  const version = getEffectiveRestVersion(vscode, 19);
  const queryParams = {};
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/parts/${encodeURIComponent(String(id).trim())}`,
      method: 'GET',
      query: queryParams,
      signal
    },
    transport
  );
}

// POST /rest/<version>/parts/actions/search
async function searchParts(context, vscode, searchCriteria = {}, transport) {
  const version = getEffectiveRestVersion(vscode, 19);

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/parts/actions/search`,
      method: 'POST',
      body: searchCriteria || {}
    },
    transport
  );
}

module.exports = {
  listParts,
  getPart,
  searchParts
};
