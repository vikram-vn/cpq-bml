const { call, getEffectiveRestVersion } = require('@/lang/rest/apiCore');

// GET /rest/<version>/parts
async function listParts(
  context,
  vscode,
  {
    offset = 0,
    limit = 100,
    q,
    orderby,
    orderBy,
    fields,
    signal
  } = {},
  transport
) {
  const version = getEffectiveRestVersion(vscode, 19);
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;
  const sort = orderby || orderBy;
  if (sort) queryParams.orderby = sort;
  if (fields) queryParams.fields = fields;

  const res = await call(
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

  // Auto-recovery: if CPQ rejects the sort parameter with 400 Bad Request, retry without orderby
  if (res && res.statusCode === 400 && queryParams.orderby) {
    const errorBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    if (/unsupported param.*order/i.test(errorBody)) {
      const fallbackQuery = { ...queryParams };
      delete fallbackQuery.orderby;
      return call(
        context,
        vscode,
        {
          path: `/rest/${version}/parts`,
          method: 'GET',
          query: fallbackQuery,
          signal
        },
        transport
      );
    }
  }

  return res;
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
