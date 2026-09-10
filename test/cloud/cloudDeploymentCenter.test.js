const assert = require('assert');
const {
  createDeploymentCenterProvider,
  viewTaskDetailsCommand
} = require('@/lang/cloud/cloudDeploymentCenter');
const api = require('@/lang/rest/api');

function createMockVscode(overrides = {}) {
  const treeItemFn = function (label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.description = '';
    this.tooltip = '';
    this.iconPath = null;
    this.contextValue = '';
    this.command = null;
  };

  const eventEmitterFn = function () {
    this.fired = 0;
    this.event = function (cb) {
      return { dispose: function () {} };
    };
    this.fire = function () {
      this.fired++;
    }.bind(this);
  };

  const themeIconFn = function (id, color) {
    this.id = id;
    this.color = color;
  };

  const themeColorFn = function (id) {
    this.id = id;
  };

  let openedDoc = null;
  let shownDoc = null;
  let infoMsg = null;
  let errorMsg = null;

  const mock = {
    TreeItem: treeItemFn,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: eventEmitterFn,
    ThemeIcon: themeIconFn,
    ThemeColor: themeColorFn,
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
      getConfiguration: function () {
        return {
          get: function (key, def) {
            if (key === 'connection.siteUrl') return 'https://test.bigmachines.com';
            if (key === 'connection.username') return 'testuser';
            return def;
          }
        };
      },
      openTextDocument: async function (target) {
        openedDoc = target;
        return target;
      }
    },
    window: {
      registerTreeDataProvider: function () {
        return { dispose: function () {} };
      },
      showInformationMessage: function (msg) {
        infoMsg = msg;
      },
      showErrorMessage: function (msg) {
        errorMsg = msg;
      },
      showWarningMessage: function (msg) {},
      showTextDocument: async function (doc) {
        shownDoc = doc;
        return doc;
      },
      withProgress: async function (opt, task) {
        return task({ report: function () {} });
      }
    },
    commands: {
      registerCommand: function () {
        return { dispose: function () {} };
      }
    },
    Uri: {
      file: function (f) {
        return { fsPath: f, scheme: 'file' };
      }
    },
    getOpenedDoc: function () { return openedDoc; },
    getShownDoc: function () { return shownDoc; },
    getInfoMsg: function () { return infoMsg; },
    getErrorMsg: function () { return errorMsg; }
  };

  if (overrides) {
    Object.assign(mock, overrides);
  }
  return mock;
}

suite('CPQ Deployment Center & Task Monitor - Unit Tests', () => {
  const origListTasks = api.listTasks;
  const origGetTask = api.getTask;

  setup(() => {
    api.listTasks = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            {
              id: 'task-101',
              name: 'Deploy Process oraclecpqo',
              status: 'COMPLETED',
              percentComplete: 100,
              startDate: '2026-09-10T09:00:00Z',
              dateModified: '2026-09-10T09:02:15Z'
            },
            {
              id: 'task-102',
              name: 'Mass Deploy Util Functions',
              status: 'IN_PROGRESS',
              percentComplete: 45,
              startDate: '2026-09-10T09:10:00Z'
            },
            {
              id: 'task-103',
              name: 'Data Table Sync',
              status: 'FAILED',
              percentComplete: 10,
              error: 'Table locked by concurrent user'
            }
          ]
        }
      };
    };

    api.getTask = async function (context, vscodeInstance, id) {
      return {
        statusCode: 200,
        body: {
          id: id,
          name: `Task ${id}`,
          status: 'COMPLETED',
          logs: ['Step 1 passed', 'Step 2 passed']
        }
      };
    };
  });

  teardown(() => {
    api.listTasks = origListTasks;
    api.getTask = origGetTask;
  });

  test('createDeploymentCenterProvider returns operations category and recent tasks', async () => {
    const mockVscode = createMockVscode();
    const provider = createDeploymentCenterProvider(mockVscode, {});

    const rootNodes = await provider.getChildren();
    assert.strictEqual(rootNodes.length, 2);
    assert.strictEqual(rootNodes[0].id, 'actions');
    assert.strictEqual(rootNodes[1].id, 'tasks');

    // Test operations category children
    const ops = await provider.getChildren(rootNodes[0]);
    assert.strictEqual(ops.length, 4);
    assert.ok(ops[0].label.includes('Deploy Commerce Process'));
    assert.strictEqual(ops[0].commandId, 'cpqBml.rest.deployCommerceProcess');
    assert.strictEqual(ops[1].label, 'Mass Deploy Util Functions');
    assert.strictEqual(ops[2].label, 'Flush Server Cache');
    assert.strictEqual(ops[3].label, 'Pre-flight Safety Check');

    // Test task items
    const tasks = await provider.getChildren(rootNodes[1]);
    assert.strictEqual(tasks.length, 3);
    assert.strictEqual(tasks[0].data.id, 'task-101');
    assert.strictEqual(tasks[1].data.id, 'task-102');
    assert.strictEqual(tasks[2].data.id, 'task-103');
  });

  test('getTreeItem formats task items with appropriate status indicators', async () => {
    const mockVscode = createMockVscode();
    const provider = createDeploymentCenterProvider(mockVscode, {});

    const rootNodes = await provider.getChildren();
    const tasks = await provider.getChildren(rootNodes[1]);

    const completedItem = provider.getTreeItem(tasks[0]);
    assert.strictEqual(completedItem.label, 'Deploy Process oraclecpqo');
    assert.ok(completedItem.description.includes('COMPLETED'));
    assert.ok(completedItem.description.includes('100%'));
    assert.strictEqual(completedItem.iconPath.id, 'check');
    assert.strictEqual(completedItem.contextValue, 'cpqDeploymentTask');

    const inProgressItem = provider.getTreeItem(tasks[1]);
    assert.ok(inProgressItem.description.includes('IN_PROGRESS'));
    assert.strictEqual(inProgressItem.iconPath.id, 'sync~spin');

    const failedItem = provider.getTreeItem(tasks[2]);
    assert.ok(failedItem.description.includes('FAILED'));
    assert.strictEqual(failedItem.iconPath.id, 'error');
  });

  test('viewTaskDetailsCommand fetches task and opens JSON view', async () => {
    const mockVscode = createMockVscode();
    const item = {
      data: {
        id: 'task-101',
        name: 'Deploy Process oraclecpqo'
      }
    };

    await viewTaskDetailsCommand(item, mockVscode, {});
    const opened = mockVscode.getOpenedDoc();
    assert.ok(opened);
    assert.strictEqual(opened.language, 'json');
    assert.ok(opened.content.includes('task-101'));
    assert.ok(opened.content.includes('Step 1 passed'));
  });

  test('handles empty tasks list gracefully', async () => {
    api.listTasks = async function () {
      return { statusCode: 200, body: { items: [] } };
    };

    const mockVscode = createMockVscode();
    const provider = createDeploymentCenterProvider(mockVscode, {});

    const rootNodes = await provider.getChildren();
    const taskChildren = await provider.getChildren(rootNodes[1]);

    assert.strictEqual(taskChildren.length, 1);
    assert.strictEqual(taskChildren[0].type, 'task-info');
    assert.ok(taskChildren[0].label.includes('No background tasks found'));
  });
});
