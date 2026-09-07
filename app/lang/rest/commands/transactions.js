const api = require("../api");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  isSuccess,
  ensureCredentials,
} = require("./shared");

async function runGetTransactions(
  context,
  vscode,
  resultsTerminal,
  {
    process,
    document,
    q,
    query,
    offset = 25,
    limit = 25,
    fields = "_id,transactionID_t",
    excludeFieldTypes = "yes",
    orderby,
    totalResults = true,
    transport,
  } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  let filterQuery = q || query;
  if (filterQuery === undefined) {
    const input = await vscode.window.showInputBox({
      title: "CPQ-BML: Pull Transactions",
      prompt: "Enter optional filter query or leave blank for default transactions",
      placeHolder: "e.g. {status_t:'CREATED'} or {_customer_t_company_name:'TestCo1'}",
    });
    if (input === undefined) {
      return { success: false, errorMessage: "Pull transactions cancelled." };
    }
    filterQuery = input.trim();
  }

  writeRunHeader(resultsTerminal, "Pull Transactions", filterQuery || "all");
  writeRunningLine(resultsTerminal, "Pull Transactions", filterQuery || "all");
  resultsTerminal.show();

  const startedAt = Date.now();
  const result = await api.getTransactions(
    context,
    vscode,
    {
      process,
      document,
      q: filterQuery,
      offset,
      limit,
      fields,
      excludeFieldTypes,
      orderby,
      totalResults,
    },
    transport,
  );

  if (!isSuccess(result.statusCode)) {
    const message = describeError(result.body);
    writeTerminalMessage(
      resultsTerminal,
      "Pull transactions failed: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    const errorMessage = `CPQ-BML: failed to pull transactions (HTTP ${result.statusCode}). ${message}`;
    vscode.window.showErrorMessage(errorMessage);
    return {
      success: false,
      errorMessage,
      statusCode: result.statusCode,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const body = result.body || {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.map((item) => ({
    _id: item._id !== undefined ? String(item._id) : undefined,
    transactionID_t:
      item.transactionID_t !== undefined
        ? String(item.transactionID_t)
        : (item.transactionId !== undefined ? String(item.transactionId) : undefined),
  }));

  const count = items.length;
  const total = body.totalResults !== undefined ? body.totalResults : count;

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Retrieved ${count} transaction(s) (total: ${total}) (${formatElapsed(startedAt)})\x1b[0m\n`,
  );

  items.forEach((item, idx) => {
    resultsTerminal.writeLine(
      `  \x1b[1;36m[${idx + 1}]\x1b[0m \x1b[33m_id:\x1b[0m ${item._id || "N/A"}  \x1b[32mtransactionID_t:\x1b[0m ${item.transactionID_t || "N/A"}`,
    );
  });

  resultsTerminal.show();

  return {
    success: true,
    count,
    totalResults: total,
    hasMore: !!body.hasMore,
    offset: body.offset !== undefined ? body.offset : offset,
    limit: body.limit !== undefined ? body.limit : limit,
    items,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { runGetTransactions };
