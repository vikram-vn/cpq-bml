const { vscode } = require('./cloudVscodeShim');
const { generateAttributeSnippet } = require('./cloudSnippets');

/**
 * Formats an attribute for dropping based on domain.
 */
function formatAttributeDrop(varName, domain = 'commerce') {
  if (!varName) return '';
  if (domain === 'config') {
    return `getconfigattr("${varName}")`;
  }
  if (domain === 'line') {
    return `docNum + "|${varName}|" + ${varName}Val + "|"`;
  }
  if (domain === 'datatable') {
    return `"${varName}"`;
  }
  return `get(transaction, "${varName}")`;
}

/**
 * Pure Factory: Creates a TreeDragAndDropController for Cloud Explorer tree views.
 */
function createCloudDragAndDropController(vscodeInstance = vscode, defaultDomain = 'commerce') {
  return {
    dragMimeTypes: [
      'application/vnd.code.tree.cpqBmlExplorer',
      'text/plain',
      'text/uri-list',
    ],
    dropMimeTypes: [],
    handleDrag(source, treeDataTransfer, token) {
      const items = Array.isArray(source) ? source : Array.from(source || []);
      if (!items || items.length === 0) return;

      const formattedTexts = [];
      const payload = [];

      const config = vscodeInstance?.workspace?.getConfiguration?.('cpqBml');
      const formatSetting = config?.get?.('editor.dragAndDropFormat') || 'variableName';

      for (const item of items) {
        const data = item?.data || item;
        const varName = data?.variableName || data?.name || data?.id || (typeof data === 'string' ? data : '');
        if (!varName) continue;

        let domain = defaultDomain;
        if (item?.type === 'column' || item?.contextValue === 'cpqCloudDataTableColumn') {
          domain = 'datatable';
        } else if (item?.contextValue === 'cpqCommerceAttribute') {
          domain = (item?.document === 'transactionLine' || item?.section === 'transactionLine') ? 'line' : 'commerce';
        } else if (item?.contextValue === 'cpqConfigAttribute') {
          domain = 'config';
        }

        let textToInsert = varName;
        if (formatSetting === 'accessorSnippet') {
          textToInsert = formatAttributeDrop(varName, domain);
        } else if (formatSetting === 'stringLiteral') {
          textToInsert = `"${varName}"`;
        } else {
          textToInsert = varName;
        }

        formattedTexts.push(textToInsert);
        payload.push({
          type: item?.type || item?.contextValue || 'attribute',
          variableName: varName,
          label: data?.label || data?.name || varName,
          dataType: data?.dataType || data?.type || 'String',
          domain,
          text: textToInsert,
        });
      }

      if (formattedTexts.length === 0) return;

      const fullText = formattedTexts.join(', ');
      const DataTransferItemClass = vscodeInstance?.DataTransferItem;

      if (DataTransferItemClass) {
        treeDataTransfer.set('text/plain', new DataTransferItemClass(fullText));
        treeDataTransfer.set(
          'application/vnd.code.tree.cpqBmlExplorer',
          new DataTransferItemClass(JSON.stringify(payload))
        );
      } else {
        treeDataTransfer.set('text/plain', {
          value: fullText,
          asString: async () => fullText,
        });
        treeDataTransfer.set('application/vnd.code.tree.cpqBmlExplorer', {
          value: JSON.stringify(payload),
          asString: async () => JSON.stringify(payload),
        });
      }
    },
    handleDrop(target, sources, token) {
      // Tree view drop target - no-op (drag source to editor)
    },
  };
}

/**
 * Registers VS Code DocumentDropEditProvider for BML files to handle dropping attributes.
 */
function registerBmlDropEditProvider(context, vscodeInstance = vscode) {
  if (
    !vscodeInstance?.languages ||
    typeof vscodeInstance.languages.registerDocumentDropEditProvider !== 'function'
  ) {
    return;
  }

  const dropEditProvider = {
    async provideDocumentDropEdits(document, position, dataTransfer, token) {
      let payload = null;
      const customItem = dataTransfer.get('application/vnd.code.tree.cpqBmlExplorer');
      if (customItem) {
        try {
          const raw = typeof customItem.asString === 'function' ? await customItem.asString() : customItem.value;
          payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {}
      }

      const plainItem = dataTransfer.get('text/plain');
      let plainText = '';
      if (plainItem) {
        plainText = typeof plainItem.asString === 'function' ? await plainItem.asString() : plainItem.value;
      }

      if (!payload && !plainText) return undefined;

      const config = vscodeInstance?.workspace?.getConfiguration?.('cpqBml');
      const formatSetting = config?.get?.('editor.dragAndDropFormat') || 'variableName';

      let textToInsert = plainText;
      if (Array.isArray(payload) && payload.length > 0) {
        const pieces = payload.map((p) => {
          if (formatSetting === 'accessorSnippet') {
            return formatAttributeDrop(p.variableName, p.domain);
          }
          if (formatSetting === 'stringLiteral') {
            return `"${p.variableName}"`;
          }
          return p.variableName;
        });
        textToInsert = pieces.join(', ');
      }

      if (!textToInsert) return undefined;

      const SnippetString = vscodeInstance.SnippetString;
      const snippet = SnippetString ? new SnippetString(textToInsert) : textToInsert;

      const DocumentDropEdit = vscodeInstance.DocumentDropEdit;
      if (DocumentDropEdit) {
        return new DocumentDropEdit(snippet);
      }
      return { insertText: snippet };
    },
  };

  const disposable = vscodeInstance.languages.registerDocumentDropEditProvider(
    { language: 'bml' },
    dropEditProvider
  );
  if (context?.subscriptions) {
    context.subscriptions.push(disposable);
  }
  return disposable;
}

module.exports = {
  formatAttributeDrop,
  createCloudDragAndDropController,
  registerBmlDropEditProvider,
};
