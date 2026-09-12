let vscode;
try {
  vscode = require("vscode");
} catch {
  vscode = null;
}
const fs = require("fs");
const path = require("path");

const { isConfigured } = require("@/lang/rest/config");
const { crawlCpqSchema } = require("@/lang/cloud/cpqCrawler");

let _inMemorySchemaCache = null;
let _inMemoryCommerceCache = null;
let _inMemoryConfigCache = null;

function getCacheDir(contextOrRoot, maybeRoot) {
  let context = null;
  let workspaceRoot = null;

  if (contextOrRoot && typeof contextOrRoot === "object" && (contextOrRoot.globalStorageUri || contextOrRoot.storageUri || contextOrRoot.extensionPath)) {
    context = contextOrRoot;
    workspaceRoot = maybeRoot;
  } else if (typeof contextOrRoot === "string") {
    workspaceRoot = contextOrRoot;
    if (maybeRoot && typeof maybeRoot === "object") context = maybeRoot;
  }

  // 1. VS Code Extension backend globalStorageUri (clean user workspace)
  if (context && context.globalStorageUri && context.globalStorageUri.fsPath) {
    const p = path.join(context.globalStorageUri.fsPath, "schema");
    if (fs.existsSync(p)) return p;
  }
  if (context && context.storageUri && context.storageUri.fsPath) {
    const p = path.join(context.storageUri.fsPath, "schema");
    if (fs.existsSync(p)) return p;
  }
  if (context && context.globalStoragePath) {
    const p = path.join(context.globalStoragePath, "schema");
    if (fs.existsSync(p)) return p;
  }

  // 2. User home backend cache ~/.cpq
  const os = require("os");
  const homeCpq = path.join(os.homedir(), ".cpq");
  if (fs.existsSync(homeCpq)) return homeCpq;

  // 3. Workspace .cpq folder (fallback or if project already has .cpq)
  const root = workspaceRoot || (vscode && vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd());
  const wsCpq = path.join(root, ".cpq");
  if (fs.existsSync(wsCpq)) return wsCpq;

  // Prefer context globalStorageUri if available
  if (context && context.globalStorageUri && context.globalStorageUri.fsPath) {
    const p = path.join(context.globalStorageUri.fsPath, "schema");
    fs.mkdirSync(p, { recursive: true });
    return p;
  }

  if (!fs.existsSync(wsCpq)) {
    fs.mkdirSync(wsCpq, { recursive: true });
  }
  return wsCpq;
}

/**
 * Introspects workspace metadata and generates schema & cpq.d.bml
 */
function introspectWorkspace(workspaceRoot, context) {
  const cpqDir = getCacheDir(context, workspaceRoot);

  // Standard Commerce & Config Attributes fallback
  const schema = {
    updatedAt: new Date().toISOString(),
    transactionAttributes: [
      { name: "_transaction_currency", type: "String", description: "Base currency code (e.g. USD)" },
      { name: "_customer_id", type: "String", description: "Account customer identification" },
      { name: "_status", type: "String", description: "Current transaction step status" },
      { name: "_total_amount", type: "Float", description: "Gross total transaction amount" },
    ],
    lineItemAttributes: [
      { name: "_document_number", type: "Integer", description: "Sequence number of line item" },
      { name: "_part_number", type: "String", description: "Part number identifier" },
      { name: "_price_quantity", type: "Float", description: "Item quantity" },
      { name: "_unit_price", type: "Float", description: "Unit price before discount" },
    ],
    dataTables: [
      { name: "Pricing_Rules_DT", columns: ["tier", "region", "discount_pct"] },
      { name: "Product_Catalog_DT", columns: ["part_number", "family", "lead_time_days"] },
    ],
  };

  // Check if offline commerce cache exists in metadata.json
  const metaPath = path.join(cpqDir, "metadata.json");
  if (fs.existsSync(metaPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (cached.attributes) {
        schema.transactionAttributes.push(...cached.attributes);
      }
    } catch {
      // Ignored
    }
  }

  // Save schema.json
  fs.writeFileSync(path.join(cpqDir, "schema.json"), JSON.stringify(schema, null, 2), "utf8");

  // Generate cpq.d.bml stub
  const dtsLines = [
    "// Oracle CPQ Dynamic Type Definitions",
    `// Auto-generated on ${schema.updatedAt}`,
    "",
    "// Commerce Header Attributes (_transaction)",
    ...schema.transactionAttributes.map((a) => `// ${a.type} ${a.name}; /* ${a.description || ''} */`),
    "",
    "// Commerce Line Item Attributes (_line_item_list)",
    ...schema.lineItemAttributes.map((a) => `// ${a.type} ${a.name}; /* ${a.description || ''} */`),
    "",
    "// Data Tables",
    ...schema.dataTables.map((dt) => `// Table: ${dt.name} (${(dt.columns || []).join(", ")})`),
  ];

  fs.writeFileSync(path.join(cpqDir, "cpq.d.bml"), dtsLines.join("\n"), "utf8");

  _inMemorySchemaCache = schema;
  return schema;
}

function getCachedAttributes(workspaceRoot, context) {
  if (_inMemorySchemaCache) return _inMemorySchemaCache;

  const dir = getCacheDir(context, workspaceRoot);

  for (const f of ["metadata.json", "schema.json", "commerce.json"]) {
    const targetPath = path.join(dir, f);
    if (fs.existsSync(targetPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(targetPath, "utf8"));
        _inMemorySchemaCache = parsed;
        return parsed;
      } catch {
        // Fallback
      }
    }
  }

  return introspectWorkspace(workspaceRoot, context);
}

function getCommerceSchema(context, workspaceRoot) {
  if (_inMemoryCommerceCache) return _inMemoryCommerceCache;
  const dir = getCacheDir(context, workspaceRoot);
  const p = path.join(dir, "commerce.json");
  if (fs.existsSync(p)) {
    try {
      _inMemoryCommerceCache = JSON.parse(fs.readFileSync(p, "utf8"));
      return _inMemoryCommerceCache;
    } catch {}
  }
  return null;
}

function getConfigSchema(context, workspaceRoot) {
  if (_inMemoryConfigCache) return _inMemoryConfigCache;
  const dir = getCacheDir(context, workspaceRoot);
  const p = path.join(dir, "config.json");
  if (fs.existsSync(p)) {
    try {
      _inMemoryConfigCache = JSON.parse(fs.readFileSync(p, "utf8"));
      return _inMemoryConfigCache;
    } catch {}
  }
  return null;
}

function getDataTablesSchema(context, workspaceRoot) {
  const dir = getCacheDir(context, workspaceRoot);
  const p = path.join(dir, "datatables.json");
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {}
  }
  return null;
}

function clearCache() {
  _inMemorySchemaCache = null;
  _inMemoryCommerceCache = null;
  _inMemoryConfigCache = null;
}

async function crawlLive(context, vscodeInstance, options = {}) {
  clearCache();
  return crawlCpqSchema(context, vscodeInstance, options);
}

function registerSchemaIntrospector(context, vscodeInstance = vscode) {
  if (!vscodeInstance || !vscodeInstance.commands) return;

  vscodeInstance.subscriptions?.push?.(
    vscodeInstance.commands.registerCommand("cpqBml.introspectSchema", async () => {
      if (isConfigured(vscodeInstance) && vscodeInstance.window && vscodeInstance.window.withProgress) {
        try {
          const res = await vscodeInstance.window.withProgress(
            {
              location: 15, // Notification
              title: "Crawling Oracle CPQ Metadata (Commerce & Configuration)...",
              cancellable: false,
            },
            async (progress) => {
              return crawlLive(context, vscodeInstance, {
                onProgress: (p) => {
                  progress.report({ message: p.message });
                },
              });
            }
          );

          if (res && res.ok) {
            clearCache();
            vscodeInstance.window.showInformationMessage(
              `CPQ Schema Crawled: ${res.stats.processes} processes, ${res.stats.documents} documents, ${res.stats.actions} actions, ${res.stats.productFamilies} product families, ${res.stats.attributes} attributes saved in backend storage.`
            );
            return res.schema;
          }
        } catch (err) {
          console.warn("Live crawl error, falling back to local workspace introspection:", err);
        }
      }

      const schema = introspectWorkspace(undefined, context);
      vscodeInstance.window?.showInformationMessage?.(
        `CPQ Schema Introspected: ${schema.transactionAttributes.length} transaction attributes, ${schema.lineItemAttributes.length} line item attributes, ${schema.dataTables.length} Data Tables cached in backend storage.`
      );
      return schema;
    })
  );
}

const SchemaIntrospector = {
  getCacheDir,
  introspectWorkspace,
  getCachedAttributes,
  getCommerceSchema,
  getConfigSchema,
  getDataTablesSchema,
  clearCache,
  crawlLive,
};

module.exports = {
  getCacheDir,
  introspectWorkspace,
  getCachedAttributes,
  getCommerceSchema,
  getConfigSchema,
  getDataTablesSchema,
  clearCache,
  crawlLive,
  registerSchemaIntrospector,
  SchemaIntrospector,
};
