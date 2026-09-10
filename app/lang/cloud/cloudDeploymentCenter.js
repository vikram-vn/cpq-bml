const { vscode, safeParseJson } = require('./cloudVscodeShim');

const api = require('@/lang/rest/api');
const { isConfigured, getSettings } = require('@/lang/rest/config');

/**
 * Pure Factory: Creates Deployment Center & Task Monitor TreeDataProvider.
 */
function createDeploymentCenterProvider(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedTasks = null;
  let isLoading = false;
  let lastError = null;

  async function fetchTasks() {
    if (!isConfigured(vscodeInstance)) {
      return { error: 'CPQ credentials are not configured.' };
    }

    try {
      const res = await api.listTasks(context, vscodeInstance, {
        limit: 30,
        orderby: 'dateModified:desc'
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return { error: `HTTP ${res.statusCode}: Tasks endpoint returned status ${res.statusCode}` };
      }

      const parsed = safeParseJson(res.body);
      const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
      return { items };
    } catch (err) {
      return { error: err.message || 'Error fetching deployment tasks' };
    }
  }

  async function getChildren(element) {
    if (!element) {
      // Root level has 2 categories: Quick Actions and Recent Tasks
      return [
        {
          type: 'category',
          id: 'actions',
          label: 'Deployment Operations',
          collapsibleState: vscodeInstance.TreeItemCollapsibleState.Expanded
        },
        {
          type: 'category',
          id: 'tasks',
          label: 'Recent Tasks & Deployments',
          collapsibleState: vscodeInstance.TreeItemCollapsibleState.Expanded
        }
      ];
    }

    if (element.type === 'category' && element.id === 'actions') {
      const settings = getSettings(vscodeInstance);
      const proc = settings.commerceProcess || 'oraclecpqo';
      return [
        {
          type: 'action',
          label: `Deploy Commerce Process (${proc})`,
          description: 'Queue full process deployment',
          commandId: 'cpqBml.rest.deployCommerceProcess',
          icon: 'rocket'
        },
        {
          type: 'action',
          label: 'Mass Deploy Util Functions',
          description: 'Deploy all utility functions',
          commandId: 'cpqBml.rest.massDeployUtils',
          icon: 'zap'
        },
        {
          type: 'action',
          label: 'Flush Server Cache',
          description: 'Clear CPQ server-side cache',
          commandId: 'cpqBml.rest.flushCache',
          icon: 'trash'
        },
        {
          type: 'action',
          label: 'Pre-flight Safety Check',
          description: 'Analyze active file for deployment readiness',
          commandId: 'cpqBml.rest.preflightCheck',
          icon: 'shield'
        }
      ];
    }

    if (element.type === 'category' && element.id === 'tasks') {
      if (cachedTasks === null && !isLoading) {
        isLoading = true;
        const res = await fetchTasks();
        isLoading = false;
        if (res.error) {
          lastError = res.error;
          cachedTasks = [];
        } else {
          lastError = null;
          cachedTasks = res.items || [];
        }
      }

      if (lastError) {
        return [{
          type: 'task-info',
          label: lastError,
          icon: 'info'
        }];
      }

      if (!cachedTasks || cachedTasks.length === 0) {
        return [{
          type: 'task-info',
          label: 'No background tasks found',
          icon: 'info'
        }];
      }

      return cachedTasks.map(task => ({
        type: 'task',
        data: task
      }));
    }

    return [];
  }

  function getTreeItem(element) {
    if (element.type === 'category') {
      const item = new vscodeInstance.TreeItem(element.label, element.collapsibleState);
      item.iconPath = new vscodeInstance.ThemeIcon(element.id === 'actions' ? 'play-circle' : 'history');
      return item;
    }

    if (element.type === 'action') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.iconPath = new vscodeInstance.ThemeIcon(element.icon);
      item.command = {
        command: element.commandId,
        title: element.label
      };
      return item;
    }

    if (element.type === 'task-info') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon(element.icon || 'info');
      return item;
    }

    // Task Item
    const task = element.data;
    const taskTitle = task.name || task.category || task.id || 'Task';
    const status = (task.status || task.detailStatus || 'UNKNOWN').toUpperCase();

    const item = new vscodeInstance.TreeItem(
      String(taskTitle),
      vscodeInstance.TreeItemCollapsibleState.None
    );

    const descParts = [status];
    if (task.percentComplete !== undefined && task.percentComplete !== null) {
      descParts.push(`${task.percentComplete}%`);
    }
    if (task.dateModified || task.startDate) {
      const timeStr = String(task.dateModified || task.startDate).replace('T', ' ').slice(0, 19);
      descParts.push(timeStr);
    }
    item.description = descParts.join(' • ');

    // Tooltip
    const tooltipLines = [
      `Task: ${taskTitle}`,
      `ID: ${task.id || 'N/A'}`,
      `Status: ${status}`,
      task.detailStatus ? `Detail: ${task.detailStatus}` : null,
      task.percentComplete !== undefined ? `Progress: ${task.percentComplete}%` : null,
      task.startDate ? `Started: ${task.startDate}` : null,
      task.dateModified ? `Modified: ${task.dateModified}` : null,
      task.error ? `Error: ${JSON.stringify(task.error)}` : null,
      '---',
      'Click to view full JSON payload'
    ].filter(Boolean);

    item.tooltip = tooltipLines.join('\n');
    item.contextValue = 'cpqDeploymentTask';

    // Status icon color
    if (status.includes('COMPLET') || status.includes('SUCCESS')) {
      item.iconPath = new vscodeInstance.ThemeIcon('check', new vscodeInstance.ThemeColor('testing.iconPassed'));
    } else if (status.includes('PROGRESS') || status.includes('RUN') || status.includes('QUEUE')) {
      item.iconPath = new vscodeInstance.ThemeIcon('sync~spin', new vscodeInstance.ThemeColor('textLink.foreground'));
    } else if (status.includes('FAIL') || status.includes('ERR')) {
      item.iconPath = new vscodeInstance.ThemeIcon('error', new vscodeInstance.ThemeColor('testing.iconFailed'));
    } else {
      item.iconPath = new vscodeInstance.ThemeIcon('history');
    }

    item.command = {
      command: 'cpqBml.cloud.viewTaskDetails',
      title: 'View Task Details',
      arguments: [element]
    };

    return item;
  }

  function refresh() {
    cachedTasks = null;
    lastError = null;
    onDidChangeTreeDataEmitter.fire();
  }

  return {
    onDidChangeTreeData,
    getChildren,
    getTreeItem,
    refresh,
    getCachedTasks: () => cachedTasks
  };
}

/**
 * Views task details by opening a formatted JSON document.
 */
async function viewTaskDetailsCommand(item, vscodeInstance = vscode, context) {
  const task = item?.data || item;
  if (!task) {
    vscodeInstance.window.showWarningMessage('No task selected.');
    return;
  }

  const taskId = task.id;
  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Fetching details for task '${taskId || task.name}'...`,
    cancellable: false
  }, async () => {
    try {
      let data = task;
      if (taskId) {
        const res = await api.getTask(context, vscodeInstance, taskId);
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          data = safeParseJson(res.body, task);
        }
      }

      const formatted = JSON.stringify(data, null, 2);
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: formatted,
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(doc);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to view task: ${err.message}`);
    }
  });
}

function registerCloudDeploymentCenter(context, vscodeInstance = vscode) {
  const treeDataProvider = createDeploymentCenterProvider(vscodeInstance, context);

  const treeView = vscodeInstance.window.registerTreeDataProvider(
    'cpqBml.deploymentCenter',
    treeDataProvider
  );

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.refreshDeploymentCenter', () => {
    treeDataProvider.refresh();
  });

  const viewCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.viewTaskDetails', (item) => {
    return viewTaskDetailsCommand(item, vscodeInstance, context);
  });

  context.subscriptions.push(treeView, refreshCmd, viewCmd);

  return { treeDataProvider, treeView };
}

module.exports = {
  createDeploymentCenterProvider,
  viewTaskDetailsCommand,
  registerCloudDeploymentCenter
};
