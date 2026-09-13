'use strict';

const fs = require('fs');
const path = require('path');
const { extractStringValue, formatNameAndVarName } = require('@/lang/cloud/cloudVscodeShim');
const { findLocalFunctionFile } = require('@/lang/cloud/cloudExplorerFiles');

/**
 * Builds a VS Code TreeItem for any Cloud Explorer element.
 */
function buildCloudTreeItem(element, vscodeInstance, filterQuery, getRoot) {
  if (element.type === 'filterInfo') {
    const item = new vscodeInstance.TreeItem(
      `Filter: "${element.query}" (${element.totalMatches} match${element.totalMatches === 1 ? '' : 'es'})`,
      vscodeInstance.TreeItemCollapsibleState.None
    );
    item.description = 'Click to clear';
    item.tooltip = `Active search filter: "${element.query}"\nFound ${element.totalMatches} matching item(s)\nClick to clear filter`;
    item.iconPath = new vscodeInstance.ThemeIcon('filter');
    item.contextValue = 'cpqCloudFilterInfo';
    item.command = {
      command: 'cpqBml.cloud.clearFilter',
      title: 'Clear Cloud Explorer Filter'
    };
    return item;
  }

  if (element.type === 'category') {
    const isFiltered = Boolean(filterQuery);
    const label = element.isFiltered ? element.label : `${element.label} (${element.count})`;
    const item = new vscodeInstance.TreeItem(
      label,
      isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
    );
    if (element.category === 'actions') {
      item.contextValue = 'cpqCloudCategoryActions';
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-event');
    } else if (element.category === 'commerce') {
      item.contextValue = 'cpqCloudCategoryCommerce';
      item.iconPath = new vscodeInstance.ThemeIcon('briefcase');
    } else {
      item.contextValue = 'cpqCloudCategoryUtil';
      item.iconPath = new vscodeInstance.ThemeIcon('library');
    }
    return item;
  }

  if (element.type === 'folder') {
    const isFiltered = Boolean(filterQuery);
    const item = new vscodeInstance.TreeItem(
      `${element.folderName} (${element.count})`,
      isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
    );
    item.contextValue = element.isCommerce ? 'cpqCloudCommerceFolder' : 'cpqCloudFolder';
    item.iconPath = new vscodeInstance.ThemeIcon('folder');
    return item;
  }

  if (element.type === 'empty') {
    const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
    item.iconPath = new vscodeInstance.ThemeIcon('info');
    if (element.command) {
      item.command = element.command;
      item.tooltip = element.tooltip || 'Click to switch active Commerce Process / Document';
    }
    return item;
  }

  if (element.type === 'actionFolder') {
    const isFiltered = Boolean(filterQuery);
    const docLabel = element.docName === 'transaction'
      ? 'Transaction (Header)'
      : (element.docName === 'transactionLine' ? 'Transaction Line (Sub-document)' : element.docName);
    const item = new vscodeInstance.TreeItem(
      `${docLabel} (${element.count})`,
      isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Expanded
    );
    item.iconPath = new vscodeInstance.ThemeIcon('symbol-event');
    item.tooltip = `Commerce Actions for document '${element.docName}'`;
    return item;
  }

  if (element.type === 'action') {
    const action = element.data;
    const varName = extractStringValue(action.variableName || action.name, 'action');
    const label = extractStringValue(action.label || action.name || varName, varName);
    const displayLabel = formatNameAndVarName(label, varName);
    const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);

    const actionType =
      extractStringValue(action.actionType) ||
      extractStringValue(action.type) ||
      'Action';
    item.description = `[${actionType}]`;
    const desc = extractStringValue(action.description, '');
    item.tooltip = [
      `Commerce Action: ${label}`,
      `Variable Name: ${varName}`,
      `Action Type: ${actionType}`,
      desc ? `Description: ${desc}` : null,
      `Document: ${action.commerceProcess}/${action.commerceDocument || 'transaction'}`,
      '---',
      'Click to view action definition'
    ].filter(Boolean).join('\n');

    item.iconPath = new vscodeInstance.ThemeIcon('zap', new vscodeInstance.ThemeColor('symbolIcon.eventForeground'));
    item.contextValue = 'cpqCloudCommerceAction';
    item.command = {
      command: 'cpqBml.cloud.openCommerceAction',
      title: 'View Action Definition',
      arguments: [element]
    };
    return item;
  }

  // Function item
  const fn = element.data;
  const varName = extractStringValue(fn.variableName || fn.name, 'function');
  const wsRoot = getRoot();
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceMetadata = isCommerce
    ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument }
    : null;
  const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName, commerceMetadata, vscodeInstance);

  const name = extractStringValue(fn.name || varName, varName);
  const displayLabel = formatNameAndVarName(name, varName);
  const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);

  const badges = [];
  const hasStagedTimestamps = Boolean(
    fn.lastModified && fn.lastDeployed && new Date(fn.lastModified) > new Date(fn.lastDeployed)
  );
  const hasDeployedTimestamps = Boolean(
    fn.lastDeployed && (!fn.lastModified || new Date(fn.lastDeployed) >= new Date(fn.lastModified))
  );

  const isStaged = fn.deploymentStatus === 'STAGING' ||
                   fn.deploymentStatus === 'CHANGED' ||
                   fn.status === 'staged' ||
                   fn.isStaged === true ||
                   hasStagedTimestamps;
  const isDeployed = fn.deploymentStatus === 'DEPLOYED' ||
                     fn.status === 'active' ||
                     hasDeployedTimestamps ||
                     (!isStaged && fn.deploymentStatus !== undefined);

  if (isStaged) {
    badges.push('[Staging]');
  } else if (isDeployed) {
    badges.push('[Deployed]');
  }

  if (fn.isOverridden) {
    badges.push('[Overridden]');
  } else if (fn.isStandardFunction) {
    badges.push('[Standard]');
  }

  let isLocallyModified = false;
  if (localPath) {
    try {
      const localStat = fs.statSync(localPath);
      const metaPath = localPath.replace(/\.bml$/, '-meta.json');
      if (fs.existsSync(metaPath)) {
        const metaStat = fs.statSync(metaPath);
        if (localStat.mtimeMs > metaStat.mtimeMs + 1000) {
          isLocallyModified = true;
        }
      }
    } catch {}
  }

  if (localPath) {
    if (isLocallyModified) {
      badges.push('● Modified');
    } else {
      badges.push('✓ Synced');
    }
  } else {
    badges.push('☁ Cloud');
  }

  const returnType = extractStringValue(fn.returnType, '');
  if (returnType) {
    badges.push(`-> ${returnType}`);
  }

  item.description = badges.join(' ');
  item.contextValue = localPath
    ? (isLocallyModified ? 'cpqCloudFunctionModified' : 'cpqCloudFunctionSynced')
    : 'cpqCloudFunctionRemote';

  const deployStatusText = isStaged ? 'Staging (Pending Deployment)' : (isDeployed ? 'Deployed' : 'Unknown');
  const funcTypeText = fn.isOverridden
    ? 'Standard Function (Overridden)'
    : (fn.isStandardFunction ? 'Standard Function' : 'Custom Library Function');

  if (localPath) {
    const procDoc = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util Library';
    item.tooltip = [
      `${varName} [${deployStatusText}]`,
      `Status: ${isLocallyModified ? 'Modified locally (pending deploy)' : 'In-sync with Cloud'}`,
      `Type: ${funcTypeText}`,
      `Environment: ${procDoc}`,
      `Local File: ${path.basename(localPath)}`,
      `Folder: ${fn.folderName || 'Global'}`,
      `Return: ${returnType || 'void'}`,
      '---',
      'Click to open local file in editor'
    ].join('\n');

    if (isLocallyModified) {
      item.iconPath = new vscodeInstance.ThemeIcon('diff-modified', new vscodeInstance.ThemeColor('gitDecoration.modifiedResourceForeground'));
    } else if (isStaged) {
      item.iconPath = new vscodeInstance.ThemeIcon('beaker', new vscodeInstance.ThemeColor('problemsWarningIcon.foreground'));
    } else if (fn.isOverridden) {
      item.iconPath = new vscodeInstance.ThemeIcon('diff-modified', new vscodeInstance.ThemeColor('symbolIcon.eventForeground'));
    } else {
      item.iconPath = new vscodeInstance.ThemeIcon('check', new vscodeInstance.ThemeColor('testing.iconPassed'));
    }

    item.command = {
      command: 'vscode.open',
      title: 'Open Local Function',
      arguments: [vscodeInstance.Uri.file(localPath)]
    };
  } else {
    const procDoc = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util Library';
    item.tooltip = [
      `${varName} [Cloud Only - ${deployStatusText}]`,
      `Type: ${funcTypeText}`,
      `Environment: ${procDoc}`,
      `Folder: ${fn.folderName || 'Global'}`,
      `Return: ${fn.returnType || 'void'}`,
      '---',
      'Double-click to download and open'
    ].join('\n');

    if (isStaged) {
      item.iconPath = new vscodeInstance.ThemeIcon('cloud', new vscodeInstance.ThemeColor('problemsWarningIcon.foreground'));
    } else {
      item.iconPath = new vscodeInstance.ThemeIcon('cloud-download', new vscodeInstance.ThemeColor('textLink.foreground'));
    }

    item.command = {
      command: 'cpqBml.cloud.pullFunction',
      title: 'Download and Open Function',
      arguments: [element]
    };
  }

  return item;
}

module.exports = {
  buildCloudTreeItem,
};
