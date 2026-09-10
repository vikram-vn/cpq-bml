const assert = require('assert');
const {
  createDeploymentCenterProvider,
  viewTaskDetailsCommand
} = require('@/lang/cloud/cloudDeploymentCenter');
const api = require('@/lang/rest/api');

const { createCloudMockVscode: createMockVscode } = require('./cloudTestMocks');

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
    assert.strictEqual(ops.length, 3);
    assert.ok(ops[0].label.includes('Deploy Commerce Process'));
    assert.strictEqual(ops[0].commandId, 'cpqBml.rest.deployCommerceProcess');
    assert.strictEqual(ops[1].label, 'Mass Deploy Util Functions');
    assert.strictEqual(ops[2].label, 'Pre-flight Safety Check');

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
