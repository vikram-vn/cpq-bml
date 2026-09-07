const metadataLib = require("../metadata");
const api = require("../api");
const {
  hasMissingCredentials,
  getCommerceProcess,
  getCommerceDocument,
} = require("../config");
const {
  findLibraryFunctionByVariableName,
  isSuccess,
} = require("./shared");

const pendingFetches = new Set();

async function triggerSmartMetadataFetch(
  context,
  vscode,
  statusBarItem,
  filePath,
  options = {},
) {
  if (!filePath || !filePath.endsWith(".bml")) return;
  if (pendingFetches.has(filePath)) return;
  pendingFetches.add(filePath);

  try {
    const metaPath = metadataLib.bmlPathToMetaPath(filePath);
    const variableName = metadataLib.variableNameFromBmlPath(filePath);

    // 1. Check workspace files: did the user pull or have -meta.json in another folder?
    if (
      vscode &&
      vscode.workspace &&
      typeof vscode.workspace.findFiles === "function"
    ) {
      try {
        const matches = await vscode.workspace.findFiles(
          `**/${variableName}-meta.json`,
          "**/node_modules/**",
          1,
        );
        if (matches && matches.length > 0) {
          const foundMeta = metadataLib.readMetadata(matches[0].fsPath);
          if (foundMeta) {
            try {
              metadataLib.writeMetadata(metaPath, foundMeta);
            } catch (e) {}
            const activePath =
              vscode.window &&
              vscode.window.activeTextEditor &&
              vscode.window.activeTextEditor.document.uri.fsPath;
            if (activePath === filePath) {
              refreshBmlStatus(
                vscode,
                statusBarItem,
                filePath,
                context,
                options,
              );
            }
            return;
          }
        }
      } catch (e) {}
    }

    // 2. If context provided, check CPQ in the background
    if (context) {
      const missing = await hasMissingCredentials(context, vscode);
      if (missing) return;

      const commerceProcess = getCommerceProcess(vscode) || "oraclecpqo";
      const commerceDocument = getCommerceDocument(vscode) || "transaction";
      const transport = options.transport;

      // Check commerce library functions first
      const commerceMatch = await findLibraryFunctionByVariableName(
        context,
        vscode,
        variableName,
        transport,
        { commerceProcess, commerceDocument },
      );
      if (commerceMatch) {
        const result = await api.getLibraryFunction(
          context,
          vscode,
          commerceMatch.variableName,
          transport,
          { commerceProcess, commerceDocument },
        );
        if (isSuccess(result.statusCode)) {
          const { metadata } = metadataLib.splitFunctionResponse(result.body);
          metadata.commerceProcess = commerceProcess;
          metadata.commerceDocument = commerceDocument;
          metadata.variableName =
            metadata.variableName ||
            commerceMatch.variableName ||
            variableName;
          metadata.name =
            metadata.name || commerceMatch.name || metadata.variableName;
          metadata.folderName =
            metadata.folderName || commerceMatch.folderName || "";
          try {
            metadataLib.writeMetadata(metaPath, metadata);
          } catch (e) {}
          const activePath =
            vscode.window &&
            vscode.window.activeTextEditor &&
            vscode.window.activeTextEditor.document.uri.fsPath;
          if (activePath === filePath) {
            refreshBmlStatus(
              vscode,
              statusBarItem,
              filePath,
              context,
              options,
            );
          }
          return;
        }
      }

      // Check utility library functions next
      const utilMatch = await findLibraryFunctionByVariableName(
        context,
        vscode,
        variableName,
        transport,
        undefined,
      );
      if (utilMatch) {
        const result = await api.getLibraryFunction(
          context,
          vscode,
          utilMatch.variableName,
          transport,
          undefined,
        );
        if (isSuccess(result.statusCode)) {
          const { metadata } = metadataLib.splitFunctionResponse(result.body);
          metadata.variableName =
            metadata.variableName || utilMatch.variableName || variableName;
          metadata.name =
            metadata.name || utilMatch.name || metadata.variableName;
          metadata.folderName =
            metadata.folderName || utilMatch.folderName || "";
          try {
            metadataLib.writeMetadata(metaPath, metadata);
          } catch (e) {}
          const activePath =
            vscode.window &&
            vscode.window.activeTextEditor &&
            vscode.window.activeTextEditor.document.uri.fsPath;
          if (activePath === filePath) {
            refreshBmlStatus(
              vscode,
              statusBarItem,
              filePath,
              context,
              options,
            );
          }
          return;
        }
      }
    }
  } catch (err) {
    // Non-blocking background fetch; silently ignore
  } finally {
    pendingFetches.delete(filePath);
  }
}

function refreshBmlStatus(vscode, statusBarItem, filePath, context, options) {
  const hide = () => {
    statusBarItem.hide();
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      false,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      false,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsUtil",
      false,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsCommerce",
      false,
    );
  };

  if (!filePath || !filePath.endsWith(".bml")) {
    hide();
    return;
  }
  let meta = metadataLib.readMetadata(
    metadataLib.bmlPathToMetaPath(filePath),
  );
  if (!meta && filePath.endsWith("_ai.bml")) {
    const canonicalPath = filePath.replace(/_ai\.bml$/i, ".bml");
    meta = metadataLib.readMetadata(
      metadataLib.bmlPathToMetaPath(canonicalPath),
    );
  }

  const inferred = metadataLib.inferCommerceFromPath(filePath);
  const isCommerce = meta ? !!meta.commerceDocument : !!inferred;

  // Track whether the active file is commerce vs util so the Deploy button
  // in the editor title bar can show the right icon and invoke the right command.
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.activeFileIsCommerce",
    isCommerce,
  );
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.activeFileIsUtil",
    !isCommerce,
  );

  // If local metadata is not yet present and cannot be inferred from path,
  // trigger non-blocking smart fetch to discover whether it's commerce vs util.
  if (!meta && !inferred) {
    triggerSmartMetadataFetch(context, vscode, statusBarItem, filePath, options);
  }

  if (isCommerce) {
    const isStandard = meta ? !!meta.isStandardFunction : false;
    const isOverridden = meta ? !!meta.isOverridden : false;

    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      isStandard,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      isOverridden,
    );

    if (isStandard) {
      if (isOverridden) {
        statusBarItem.text = "$(gear) Override";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — standard function with your custom override. Click to remove override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        statusBarItem.command = "cpqBml.rest.removeOverride";
      } else {
        statusBarItem.text = "$(gear) System";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — read-only system function. Click to create an override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        statusBarItem.command = "cpqBml.rest.createOverride";
      }
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  } else {
    const isStandard = meta ? !!meta.isStandardFunction : false;
    const isOverridden = meta ? !!meta.isOverridden : false;

    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      isStandard,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      isOverridden,
    );

    if (isStandard) {
      if (isOverridden) {
        statusBarItem.text = "$(gear) Overridden";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — standard util function with your custom override. Click to remove override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        statusBarItem.command = "cpqBml.rest.removeOverride";
      } else {
        statusBarItem.text = "$(gear) System";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — read-only system function. Click to create an override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        statusBarItem.command = "cpqBml.rest.createOverride";
      }
      statusBarItem.show();
    } else if (meta) {
      statusBarItem.text = "$(gear) Custom";
      statusBarItem.tooltip = `${meta.variableName} — custom BML utility function.`;
      statusBarItem.backgroundColor = undefined;
      statusBarItem.command = undefined;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }
}

module.exports = {
  triggerSmartMetadataFetch,
  refreshBmlStatus,
};
