const { vscode, safeParseJson } = require("@/lang/cloud/cloudVscodeShim");

const fs = require("fs");
const path = require("path");
const api = require("@/lang/rest/api");
const { isConfigured, getSettings } = require("@/lang/rest/config");
const {
  extractMatchingSnippet,
  detectActiveProcess,
  consolidateCloudResults,
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
} = require("@/lang/cloud/cloudSearchHelpers");
const { handleSearchSelection } = require("@/lang/cloud/cloudSearchActions");


/**
 * Interactive Global BML Search runner across entire CPQ system.
 */
async function runGlobalBmlSearch(
  context,
  vscodeInstance = vscode,
  prefilledQuery,
) {
  let query =
    typeof prefilledQuery === "string" && prefilledQuery.trim()
      ? prefilledQuery.trim()
      : "";
  if (!query && vscodeInstance.window && vscodeInstance.window.activeTextEditor) {
    const editor = vscodeInstance.window.activeTextEditor;
    const document = editor.document;
    const selection = editor.selection;
    if (
      selection &&
      !selection.isEmpty &&
      typeof document.getText === "function"
    ) {
      const selText = document.getText(selection).trim();
      if (selText) {
        query = selText;
      }
    }
  }

  if (!query) {
    let initialValue = "";
    if (vscodeInstance.window && vscodeInstance.window.activeTextEditor) {
      const editor = vscodeInstance.window.activeTextEditor;
      const document = editor.document;
      const selection = editor.selection;
      if (
        selection &&
        typeof document.getWordRangeAtPosition === "function" &&
        typeof document.getText === "function"
      ) {
        const wordRange = document.getWordRangeAtPosition(selection.active);
        if (wordRange) {
          initialValue = document.getText(wordRange).trim();
        }
      }
    }

    query = await vscodeInstance.window.showInputBox({
      title: "Global Search Across CPQ System",
      prompt:
        "Search BML scripts, data tables, and transactions across entire CPQ system",
      placeHolder: "e.g. calculateDiscount, urldata, myCustomUtil...",
      value: initialValue,
      valueSelection: initialValue ? [0, initialValue.length] : undefined,
      ignoreFocusOut: true,
    });
  }

  if (!query || !query.trim()) {
    return;
  }
  query = query.trim();

  const folders = vscodeInstance.workspace.workspaceFolders;
  const workspaceRoot =
    folders && folders.length > 0 ? folders[0].uri.fsPath : null;

  await vscodeInstance.window.withProgress(
    {
      location: 15,
      title: `Searching CPQ system for "${query}"...`,
      cancellable: false,
    },
    async (progress) => {
      let cloudResults = [];
      let dataTableResults = [];
      let transactionResults = [];
      let cloudAvailable = false;

      if (isConfigured(vscodeInstance)) {
        progress.report({
          message:
            "Querying CPQ Cloud 26A+ Search API, Data Tables & Transactions...",
        });

        const searchPromises = [
          // 1. Search BML Scripts & Actions
          (async () => {
            try {
              const res = await api.searchBmlScripts(context, vscodeInstance, {
                query,
                limit: 100,
              });

              if (res.statusCode >= 200 && res.statusCode < 300) {
                cloudAvailable = true;
                const parsed = safeParseJson(res.body);
                const items = Array.isArray(parsed)
                  ? parsed
                  : (parsed && parsed.items) || [];
                cloudResults = items.map((it) => {
                  let name = it.name || it.variableName || it.scriptName;
                  let type = it.componentType || it.scriptType;
                  let proc = it.commerceProcess || "";
                  let doc = it.commerceDocument || "";

                  if (it.path && typeof it.path === "string") {
                    const parts = it.path.includes(" : ")
                      ? it.path.split(" : ")
                      : it.path.split("/");
                    if (!name) name = parts[parts.length - 1];
                    if (!type) type = parts[0];
                    if (!proc && parts.length > 2) proc = parts[1];
                    if (!doc && parts.length > 3) doc = parts[2];
                  }
                  if (!name) name = "Script";
                  if (!type) type = "Cloud Script";

                  const { lineNum, snippet } = extractMatchingSnippet(
                    it.scriptText,
                    query,
                    it.snippet,
                  );

                  return {
                    category: "script",
                    name,
                    type,
                    process: proc,
                    document: doc,
                    snippet,
                    matchedLine: lineNum,
                    scriptText: it.scriptText,
                    source: "CPQ Cloud",
                    path: it.path,
                    raw: it,
                  };
                });
              }
            } catch {
              // Ignore script search error
            }
          })(),

          // 2. Search CPQ Data Tables
          (async () => {
            try {
              const dtRes = await api.listDataTables(context, vscodeInstance, {
                limit: 500,
              });
              if (dtRes && dtRes.statusCode >= 200 && dtRes.statusCode < 300) {
                const parsed = safeParseJson(dtRes.body);
                const items = Array.isArray(parsed)
                  ? parsed
                  : (parsed && parsed.items) || [];
                const lower = query.toLowerCase();
                dataTableResults = items
                  .filter((it) => {
                    const name = String(
                      it.name || it.variableName || it.tableName || "",
                    ).toLowerCase();
                    const label = String(
                      it.label || it.description || "",
                    ).toLowerCase();
                    const desc = String(it.description || "").toLowerCase();
                    return (
                      name.includes(lower) ||
                      label.includes(lower) ||
                      desc.includes(lower)
                    );
                  })
                  .map((it) => ({
                    category: "datatable",
                    name: it.name || it.variableName || it.tableName,
                    label: it.label || it.name,
                    description: it.description || "",
                    source: "CPQ Data Tables",
                    raw: it,
                  }));
              }
            } catch {
              // Ignore datatable search error
            }
          })(),

          // 3. Search Transactions
          (async () => {
            try {
              const txRes = await api.getTransactions(context, vscodeInstance, {
                limit: 50,
                fields:
                  "_id,transactionID_t,status_t,customer_t,transactionName_t",
              });
              if (txRes && txRes.statusCode >= 200 && txRes.statusCode < 300) {
                const parsed = safeParseJson(txRes.body);
                const items = Array.isArray(parsed)
                  ? parsed
                  : (parsed && parsed.items) || [];
                const lower = query.toLowerCase();
                transactionResults = items
                  .filter((it) => {
                    const id = String(
                      it.transactionID_t || it._id || "",
                    ).toLowerCase();
                    const cust = String(it.customer_t || "").toLowerCase();
                    const name = String(
                      it.transactionName_t || "",
                    ).toLowerCase();
                    const status = String(it.status_t || "").toLowerCase();
                    return (
                      id.includes(lower) ||
                      cust.includes(lower) ||
                      name.includes(lower) ||
                      status.includes(lower)
                    );
                  })
                  .map((it) => ({
                    category: "transaction",
                    name: it.transactionID_t || it._id,
                    id: it._id,
                    transactionID_t: it.transactionID_t,
                    customer: it.customer_t,
                    status: it.status_t,
                    source: "Recent Transactions",
                    raw: it,
                  }));
              }
            } catch {
              // Ignore transaction search error
            }
          })(),
        ];

        await Promise.allSettled(searchPromises);
      }

      // Local workspace search
      progress.report({ message: "Searching local BML workspace..." });
      const localResults = workspaceRoot
        ? searchLocalWorkspaceBml(workspaceRoot, query)
        : [];

      // Detect active process to prioritize relevant scripts
      const activeProcess = detectActiveProcess(vscodeInstance);
      const consolidatedCloudResults = consolidateCloudResults(
        cloudResults,
        activeProcess,
      );

      // Combine results for quick pick
      const quickPickItems = [];

      // 1. Add Local Results (workspace first for highest relevance)
      if (localResults.length > 0) {
        quickPickItems.push({
          label: `Local Workspace Matches (${localResults.length})`,
          kind: -1, // Separator
        });

        for (const item of localResults) {
          quickPickItems.push({
            label: `$(file-code) ${path.basename(item.file)}:${item.line}`,
            description: item.relPath,
            detail: item.lineText,
            data: item,
          });
        }
      }

      // 2. Add Cloud Script Results (deduplicated across commerce processes)
      if (consolidatedCloudResults.length > 0) {
        const procNote = activeProcess ? ` [Active: ${activeProcess}]` : "";
        quickPickItems.push({
          label: `Cloud Matches (${consolidatedCloudResults.length})${procNote}`,
          kind: -1, // Separator
        });

        for (const item of consolidatedCloudResults) {
          let desc = `[${item.type}]`;
          if (item.process) {
            desc += ` ${item.process}${item.document ? "/" + item.document : ""}`;
          }
          if (item.otherProcesses && item.otherProcesses.length > 0) {
            desc += ` (+${item.otherProcesses.length} other process${item.otherProcesses.length > 1 ? "es" : ""})`;
          }

          let detail = item.snippet;
          if (item.otherProcesses && item.otherProcesses.length > 0) {
            const othersList =
              item.otherProcesses.slice(0, 3).join(", ") +
              (item.otherProcesses.length > 3 ? "..." : "");
            if (detail) {
              detail += `  •  Also in: ${othersList}`;
            } else {
              detail = `Also in: ${othersList}`;
            }
          }
          if (!detail) {
            detail = "Click to view full BML script";
          }

          quickPickItems.push({
            label: `$(cloud) ${item.name}`,
            description: desc,
            detail,
            data: item,
          });
        }
      }

      // 3. Add Data Table Results
      if (dataTableResults.length > 0) {
        quickPickItems.push({
          label: `Data Table Matches (${dataTableResults.length})`,
          kind: -1, // Separator
        });

        for (const item of dataTableResults) {
          quickPickItems.push({
            label: `$(database) ${item.name}`,
            description: item.label !== item.name ? item.label : "Data Table",
            detail:
              item.description ||
              "Click to query table in BMQL Live Console or export CSV",
            data: item,
          });
        }
      }

      // 4. Add Transaction Results
      if (transactionResults.length > 0) {
        quickPickItems.push({
          label: `Transaction Matches (${transactionResults.length})`,
          kind: -1, // Separator
        });

        for (const item of transactionResults) {
          quickPickItems.push({
            label: `$(history) ${item.name}`,
            description: item.status ? `[${item.status}]` : "Transaction",
            detail: item.customer
              ? `Customer: ${item.customer}`
              : "Click to inspect transaction details",
            data: item,
          });
        }
      }

      if (quickPickItems.length === 0) {
        vscodeInstance.window.showInformationMessage(
          `No matches found for "${query}" across CPQ system.`,
        );
        return;
      }

      const totalMatches =
        consolidatedCloudResults.length +
        dataTableResults.length +
        transactionResults.length +
        localResults.length;

      // Show interactive quick pick
      const selected = await vscodeInstance.window.showQuickPick(
        quickPickItems,
        {
          placeHolder: `Found ${totalMatches} match(es) across scripts, data tables, transactions & local workspace for "${query}"`,
          matchOnDescription: true,
          matchOnDetail: true,
        },
      );

      if (!selected || !selected.data) return;
      await handleSearchSelection(selected.data, vscodeInstance);
    },

  );
}

function registerCloudGlobalSearch(context, vscodeInstance = vscode) {
  const searchCmd = vscodeInstance.commands.registerCommand(
    "cpqBml.cloud.globalSearch",
    (prefilled) => {
      return runGlobalBmlSearch(
        context,
        vscodeInstance,
        typeof prefilled === "string" ? prefilled : undefined,
      );
    },
  );

  context.subscriptions.push(searchCmd);
  return { searchCmd };
}

module.exports = {
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
  extractMatchingSnippet,
  detectActiveProcess,
  consolidateCloudResults,
  runGlobalBmlSearch,
  registerCloudGlobalSearch,
};
