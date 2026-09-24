const metadataLib = require("@/lang/rest/metadata");
const api = require("@/lang/rest/api");
const {
  hasMissingCredentials,
  getCommerceProcess,
  getCommerceDocument,
} = require("@/lang/rest/config");
const {
  findLibraryFunctionByVariableName,
  isSuccess,
} = require("@/lang/rest/commands/shared");

const { getExtensionContext, setExtensionContext, isContextOrVscode } = require("@/extensionContext");

const pendingFetches = new Set();

async function triggerSmartMetadataFetch(
  statusBarItemOrContext,
  filePathOrVscode,
  optionsOrStatusBar,
  maybeFilePath,
  maybeOptions,
) {
  let statusBarItem = statusBarItemOrContext;
  let filePath = filePathOrVscode;
  let options = optionsOrStatusBar || {};
  if (
    statusBarItemOrContext === null ||
    statusBarItemOrContext === undefined ||
    isContextOrVscode(statusBarItemOrContext) ||
    (filePathOrVscode && (filePathOrVscode.commands || filePathOrVscode.window))
  ) {
    if (statusBarItemOrContext || filePathOrVscode) {
      setExtensionContext(statusBarItemOrContext, filePathOrVscode);
    }
    statusBarItem = optionsOrStatusBar;
    filePath = maybeFilePath;
    options = maybeOptions || {};
  }
  const { vscode } = getExtensionContext();

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
              vscode &&
              vscode.window &&
              vscode.window.activeTextEditor &&
              vscode.window.activeTextEditor.document.uri.fsPath;
            if (activePath === filePath) {
              refreshBmlStatus(statusBarItem, filePath, options);
            }
            return;
          }
        }
      } catch (e) {}
    }

    // 2. Check CPQ in the background if credentials exist
    const missing = await hasMissingCredentials();
    if (!missing) {
      const commerceProcess = getCommerceProcess() || "oraclecpqo";
      const commerceDocument = getCommerceDocument() || "transaction";
      const transport = options.transport;

      // Check commerce library functions first
      const commerceMatch = await findLibraryFunctionByVariableName(
        variableName,
        transport,
        { commerceProcess, commerceDocument },
      );
      if (commerceMatch) {
        const result = await api.getLibraryFunction(
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
            vscode &&
            vscode.window &&
            vscode.window.activeTextEditor &&
            vscode.window.activeTextEditor.document.uri.fsPath;
          if (activePath === filePath) {
            refreshBmlStatus(statusBarItem, filePath, options);
          }
          return;
        }
      }

      // Check utility library functions next
      const utilMatch = await findLibraryFunctionByVariableName(
        variableName,
        transport,
        undefined,
      );
      if (utilMatch) {
        const result = await api.getLibraryFunction(
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
            vscode &&
            vscode.window &&
            vscode.window.activeTextEditor &&
            vscode.window.activeTextEditor.document.uri.fsPath;
          if (activePath === filePath) {
            refreshBmlStatus(statusBarItem, filePath, options);
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

function refreshBmlStatus(
  statusBarItemOrVscode,
  filePathOrStatusBar,
  optionsOrFilePath,
  maybeContext,
  maybeOptions,
) {
  let statusBarItem = statusBarItemOrVscode;
  let filePath = filePathOrStatusBar;
  let options = optionsOrFilePath || {};

  if (
    statusBarItemOrVscode &&
    (statusBarItemOrVscode.commands || statusBarItemOrVscode.window)
  ) {
    if (maybeContext) {
      setExtensionContext(maybeContext, statusBarItemOrVscode);
    } else {
      setExtensionContext(null, statusBarItemOrVscode);
    }
    statusBarItem = filePathOrStatusBar;
    filePath = optionsOrFilePath;
    options = maybeOptions || {};
  }

  const { vscode } = getExtensionContext();

  const hide = () => {
    if (statusBarItem && statusBarItem.hide) {
      statusBarItem.hide();
    }
    if (vscode && vscode.commands) {
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
    }
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
  if (vscode && vscode.commands) {
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
  }

  // If local metadata is not yet present and cannot be inferred from path,
  // trigger non-blocking smart fetch to discover whether it's commerce vs util.
  if (!meta && !inferred) {
    triggerSmartMetadataFetch(statusBarItem, filePath, options);
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
