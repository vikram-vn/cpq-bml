const { call, getEffectiveRestVersion, normalizeArgs } = require('@/lang/rest/apiCore');

// GET /rest/<version>/parts
async function listParts(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    offset = 0,
    limit = 100,
    q,
    orderby,
    orderBy,
    fields,
    signal
  } = opts;

  const version = getEffectiveRestVersion(null, 19);
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;
  const sort = orderby || orderBy;
  if (sort) queryParams.orderby = sort;
  if (fields) queryParams.fields = fields;

  const res = await call(
    {
      path: "/parts",
      method: 'GET',
      query: queryParams,
      signal
    },
    tr
  );

  // Auto-recovery: if CPQ rejects the sort parameter with 400 Bad Request, retry without orderby
  if (res && res.statusCode === 400 && queryParams.orderby) {
    const errorBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    if (/unsupported param.*order/i.test(errorBody)) {
      const fallbackQuery = { ...queryParams };
      delete fallbackQuery.orderby;
      return call(
        {
          path: "/parts",
          method: 'GET',
          query: fallbackQuery,
          signal
        },
        tr
      );
    }
  }

  return res;
}

// GET /rest/<version>/parts/<id>
async function getPart(id, options = {}, transport) {
  const [partId, opts = {}, tr] = normalizeArgs(arguments);
  if (!partId) {
    throw new Error('Part id / partNumber is required.');
  }

  const { fields, signal } = opts;
  const queryParams = {};
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: `/parts/${encodeURIComponent(String(partId).trim())}`,
      method: 'GET',
      query: queryParams,
      signal
    },
    tr
  );
}

// POST /rest/<version>/parts/actions/search
async function searchParts(searchCriteria = {}, transport) {
  const [criteria = {}, tr] = normalizeArgs(arguments);

  return call(
    {
      path: "/parts/actions/search",
      method: 'POST',
      body: criteria || {}
    },
    tr
  );
}

module.exports = {
  listParts,
  getPart,
  searchParts
};
