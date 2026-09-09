/**
 * BML Schema Introspector & Dynamic Typings
 * Generates dynamic CPQ workspace type definitions (cpq.d.bml) and schema cache.
 * Strictly maintains under 500 lines of code.
 */

let vscode;
try {
  vscode = require("vscode");
} catch {
  vscode = null;
}
const fs = require("fs");
const path = require("path");

class SchemaIntrospector {
  static getCacheDir(workspaceRoot) {
    const cpqDir = path.join(workspaceRoot || process.cwd(), ".cpq");
    if (!fs.existsSync(cpqDir)) {
      fs.mkdirSync(cpqDir, { recursive: true });
    }
    return cpqDir;
  }

  /**
   * Introspects workspace metadata and generates .cpq/schema.json & cpq.d.bml
   */
  static introspectWorkspace(workspaceRoot) {
    const root = workspaceRoot || (vscode && vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd());
    const cpqDir = this.getCacheDir(root);

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

    // Check if offline commerce cache exists in .cpq/metadata
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

    // Save .cpq/schema.json
    fs.writeFileSync(path.join(cpqDir, "schema.json"), JSON.stringify(schema, null, 2), "utf8");

    // Generate cpq.d.bml stub
    const dtsLines = [
      "// Oracle CPQ Dynamic Type Definitions",
      `// Auto-generated on ${schema.updatedAt}`,
      "",
      "// Commerce Header Attributes (_transaction)",
      ...schema.transactionAttributes.map((a) => `// ${a.type} ${a.name}; /* ${a.description} */`),
      "",
      "// Commerce Line Item Attributes (_line_item_list)",
      ...schema.lineItemAttributes.map((a) => `// ${a.type} ${a.name}; /* ${a.description} */`),
      "",
      "// Data Tables",
      ...schema.dataTables.map((dt) => `// Table: ${dt.name} (${dt.columns.join(", ")})`),
    ];

    fs.writeFileSync(path.join(cpqDir, "cpq.d.bml"), dtsLines.join("\n"), "utf8");

    return schema;
  }

  static getCachedAttributes(workspaceRoot) {
    const root = workspaceRoot || (vscode && vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd());
    const schemaPath = path.join(root, ".cpq", "schema.json");

    if (fs.existsSync(schemaPath)) {
      try {
        return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
      } catch {
        // Fallback
      }
    }

    return this.introspectWorkspace(root);
  }
}

function registerSchemaIntrospector(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.introspectSchema", () => {
      const schema = SchemaIntrospector.introspectWorkspace();
      vscode.window.showInformationMessage(
        `CPQ Schema Introspected: ${schema.transactionAttributes.length} transaction attributes, ${schema.lineItemAttributes.length} line item attributes, ${schema.dataTables.length} Data Tables cached.`
      );
    })
  );
}

module.exports = {
  SchemaIntrospector,
  registerSchemaIntrospector,
};
