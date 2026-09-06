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

async function runGlobalSearchBml(
  context,
  vscode,
  resultsTerminal,
  {
    query,
    caseSensitive = false,
    offset = 0,
    limit = 100,
    fields,
    orderby,
    totalResults = true,
    transport,
  } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  let searchQuery = query;
  if (!searchQuery) {
    searchQuery = await vscode.window.showInputBox({
      title: "CPQ-BML: Global Search BML Scripts",
      prompt: "Enter text string to search across all remote BML scripts in Oracle CPQ",
      placeHolder: "e.g., bmql, calcDiscount, price_attr",
    });
    if (!searchQuery || !searchQuery.trim()) {
      return { success: false, errorMessage: "Search cancelled or empty." };
    }
  }

  searchQuery = searchQuery.trim();
  writeRunHeader(resultsTerminal, "BML Global Search", searchQuery);
  writeRunningLine(resultsTerminal, "BML Global Search", searchQuery);
  resultsTerminal.show();

  const startedAt = Date.now();
  const result = await api.searchBmlScripts(
    context,
    vscode,
    {
      query: searchQuery,
      caseSensitive,
      offset,
      limit,
      fields,
      orderby,
      totalResults,
    },
    transport,
  );

  if (!isSuccess(result.statusCode)) {
    const message = describeError(result.body);
    writeTerminalMessage(
      resultsTerminal,
      "Search failed: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    const errorMessage = `CPQ-BML: global search failed (HTTP ${result.statusCode}). ${message}`;
    vscode.window.showErrorMessage(errorMessage);
    return {
      success: false,
      errorMessage,
      statusCode: result.statusCode,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const body = result.body || {};
  const items = body.items || [];
  const count = body.count !== undefined ? body.count : items.length;
  const total = body.totalResults !== undefined ? body.totalResults : count;

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Found ${count} match(es) (total: ${total}) (${formatElapsed(startedAt)})\x1b[0m`,
  );

  items.forEach((item, idx) => {
    resultsTerminal.writeLine(`\n\x1b[1;36m[${idx + 1}] Result:\x1b[0m`);
    if (item.locations && item.locations.length > 0) {
      item.locations.forEach((loc) => {
        resultsTerminal.writeLine(
          `  \x1b[33mLocation:\x1b[0m ${loc.type || "Script"} - ${loc.name || loc.variableName || "unnamed"} (${loc.path || "root"})`,
        );
      });
    }
    if (item.scriptText) {
      const preview = item.scriptText
        .split(/\r?\n/)
        .slice(0, 5)
        .map((l) => `    ${l}`)
        .join("\n");
      resultsTerminal.writeLine(`  \x1b[90mScript snippet:\x1b[0m\n${preview}`);
    }
  });

  resultsTerminal.show();
  return {
    success: true,
    query: searchQuery,
    count,
    totalResults: total,
    hasMore: !!body.hasMore,
    offset: body.offset || offset,
    limit: body.limit || limit,
    items,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { runGlobalSearchBml };
