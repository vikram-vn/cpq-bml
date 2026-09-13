const assert = require('assert');
const { createCommerceExplorer, inspectIntegrationCommand } = require('@/lang/cloud/cloudCommerceExplorer');
const { createPartsProvider, inspectPartCommand, copyPartNumberCommand, insertPartNumberCommand } = require('@/lang/cloud/cloudParts');
const apiCommerce = require('@/lang/rest/apiCommerce');
const apiParts = require('@/lang/rest/apiParts');
const api = require('@/lang/rest/api');
const { createCloudMockVscode: createMockVscode } = require('./cloudTestMocks');
const { createFakeVscode, createFakeContext } = require('@/test/rest/testHelpers');

const SECRET_PASSWORD = 'cpqBml.connection.password';

function baseConfig(extra = {}) {
  return {
    'connection.siteUrl': 'https://sitename.bigmachines.com',
    'connection.username': 'alice',
    ...extra,
  };
}

function fakeContext() {
  return createFakeContext({ [SECRET_PASSWORD]: 'secret' });
}

suite('CPQ Cloud Integrations & Parts - Unit Tests', () => {
  let mockVscode;
  let fakeVsc;
  let fakeCtx;

  const origListCommerceProcesses = api.listCommerceProcesses;
  const origListCommerceDocuments = api.listCommerceDocuments;
  const origListCommerceActions = api.listCommerceActions;
  const origListCommerceAttributes = api.listCommerceAttributes;
  const origListLibraryFunctions = api.listLibraryFunctions;
  const origListCommerceIntegrations = api.listCommerceIntegrations;
  const origGetCommerceIntegration = api.getCommerceIntegration;
  const origListParts = api.listParts;
  const origGetPart = api.getPart;

  setup(() => {
    mockVscode = createMockVscode();
    fakeVsc = createFakeVscode({ config: baseConfig() });
    fakeCtx = fakeContext();
  });

  teardown(() => {
    api.listCommerceProcesses = origListCommerceProcesses;
    api.listCommerceDocuments = origListCommerceDocuments;
    api.listCommerceActions = origListCommerceActions;
    api.listCommerceAttributes = origListCommerceAttributes;
    api.listLibraryFunctions = origListLibraryFunctions;
    api.listCommerceIntegrations = origListCommerceIntegrations;
    api.getCommerceIntegration = origGetCommerceIntegration;
    api.listParts = origListParts;
    api.getPart = origGetPart;
  });

  suite('Commerce Process Integrations REST API', () => {
    test('listCommerceIntegrations dispatches request to integrations endpoint', async () => {
      let dispatchedPath = null;
      const customTransport = async (options) => {
        dispatchedPath = options.path;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({
            items: [
              {
                id: 1,
                name: 'Salesforce Quote Sync',
                variableName: 'sf_quote_sync',
                integrationType: 'Salesforce',
                description: 'Sync quote headers and line items'
              }
            ]
          })
        };
      };

      const res = await apiCommerce.listCommerceIntegrations(fakeCtx, fakeVsc, { process: 'oraclecpqo' }, customTransport);
      assert.ok(res);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(dispatchedPath.includes('/integrations'));
      assert.ok(dispatchedPath.includes('oraclecpqo'));
    });

    test('getCommerceIntegration retrieves single integration detail', async () => {
      let requestedPath = null;
      const customTransport = async (options) => {
        requestedPath = options.path;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({
            variableName: 'sf_quote_sync',
            name: 'Salesforce Quote Sync',
            endpointUrl: 'https://salesforce.example.com/api'
          })
        };
      };

      const res = await apiCommerce.getCommerceIntegration(fakeCtx, fakeVsc, { process: 'oraclecpqo', integrationVarName: 'sf_quote_sync' }, customTransport);
      assert.ok(res);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(requestedPath.includes('sf_quote_sync'));
    });
  });

  suite('Commerce Explorer - Process Integrations Tree', () => {
    test('fetches integrations and renders processIntegrations node when present', async () => {
      api.listCommerceProcesses = async () => ({
        statusCode: 200,
        body: { items: [{ variableName: 'oraclecpqo', label: 'Oracle CPQ Standard' }] }
      });
      api.listCommerceDocuments = async () => ({
        statusCode: 200,
        body: { items: [{ variableName: 'transaction' }] }
      });
      api.listCommerceActions = async () => ({ statusCode: 200, body: { items: [] } });
      api.listCommerceAttributes = async () => ({ statusCode: 200, body: { items: [] } });
      api.listLibraryFunctions = async () => ({ statusCode: 200, body: { items: [] } });
      api.listCommerceIntegrations = async () => ({
        statusCode: 200,
        body: {
          items: [
            {
              variableName: 'salesforce_sync',
              name: 'Salesforce Integration',
              integrationType: 'Salesforce',
              description: 'Partner quote export'
            }
          ]
        }
      });

      const provider = createCommerceExplorer(mockVscode, {});
      const rootNodes = await provider.getChildren();

      // Should include processHeader, documents, and processIntegrations
      assert.ok(rootNodes.some(n => n.type === 'processHeader'));
      assert.ok(rootNodes.some(n => n.type === 'document'));

      const itgNode = rootNodes.find(n => n.type === 'processIntegrations');
      assert.ok(itgNode);
      assert.strictEqual(itgNode.count, 1);

      // Verify TreeItem representation
      const treeItem = provider.getTreeItem(itgNode);
      assert.ok(treeItem.label.includes('Integrations (1)'));
      assert.strictEqual(treeItem.contextValue, 'cpqCommerceSection_integrations');

      // Expand processIntegrations
      const children = await provider.getChildren(itgNode);
      assert.strictEqual(children.length, 1);
      assert.strictEqual(children[0].type, 'integration');

      const childTreeItem = provider.getTreeItem(children[0]);
      assert.ok(childTreeItem.label.includes('Salesforce Integration'));
      assert.ok(childTreeItem.description.includes('Salesforce'));
      assert.strictEqual(childTreeItem.command.command, 'cpqBml.cloud.inspectIntegration');
    });

    test('inspectIntegrationCommand opens integration payload as JSON', async () => {
      let openedDocOpts = null;
      mockVscode.workspace.openTextDocument = async (opts) => {
        openedDocOpts = opts;
        return opts;
      };

      const mockItem = {
        data: {
          variableName: 'ec_sync',
          name: 'Engagement Cloud Sync',
          integrationType: 'REST'
        },
        process: 'oraclecpqo'
      };

      await inspectIntegrationCommand(mockItem, mockVscode, {});
      assert.ok(openedDocOpts);
      assert.strictEqual(openedDocOpts.language, 'json');
      assert.ok(openedDocOpts.content.includes('ec_sync'));
      assert.ok(openedDocOpts.content.includes('Engagement Cloud Sync'));
    });
  });

  suite('Parts REST API Layer', () => {
    test('listParts queries parts endpoint with query parameters', async () => {
      let dispatchedPath = null;
      const customTransport = async (options) => {
        dispatchedPath = options.path;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({
            items: [
              {
                partNumber: 'PART-001',
                description: 'Titanium Fastener',
                price: 45.5,
                currency: 'USD',
                status: 'Active'
              }
            ]
          })
        };
      };

      const res = await apiParts.listParts(fakeCtx, fakeVsc, { limit: 50, q: "status eq 'Active'" }, customTransport);
      assert.ok(res);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(dispatchedPath.includes('/parts'));
    });

    test('getPart retrieves single part by partNumber', async () => {
      let requestedPath = null;
      const customTransport = async (options) => {
        requestedPath = options.path;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({
            partNumber: 'PART-001',
            price: 45.5
          })
        };
      };

      const res = await apiParts.getPart(fakeCtx, fakeVsc, 'PART-001', {}, customTransport);
      assert.ok(res);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(requestedPath.includes('PART-001'));
    });
  });

  suite('CloudParts Explorer Provider', () => {
    test('createPartsProvider returns parts list and formats tree items', async () => {
      api.listParts = async () => ({
        statusCode: 200,
        body: {
          items: [
            {
              partNumber: 'SRV-1000',
              description: 'Rack Server 2U',
              price: 3200,
              currency: 'USD',
              status: 'Active',
              units: 'Each'
            },
            {
              partNumber: 'CBL-005',
              description: 'Optical Cable 5m',
              price: 75,
              currency: 'USD',
              status: 'Active',
              units: 'Each'
            }
          ]
        }
      });

      const provider = createPartsProvider(mockVscode, {});
      const rootNodes = await provider.getChildren();

      assert.strictEqual(rootNodes.length, 2);
      assert.strictEqual(rootNodes[0].type, 'part');
      assert.strictEqual(rootNodes[0].part.partNumber, 'SRV-1000');

      const treeItem = provider.getTreeItem(rootNodes[0]);
      assert.strictEqual(treeItem.label, 'SRV-1000');
      assert.ok(treeItem.description.includes('3200'));
      assert.ok(treeItem.description.includes('Active'));
      assert.strictEqual(treeItem.contextValue, 'cpqCloudPart');
      assert.strictEqual(treeItem.command.command, 'cpqBml.parts.inspectPart');
    });

    test('supports filtering and clearing filter', async () => {
      api.listParts = async () => ({
        statusCode: 200,
        body: {
          items: [
            { partNumber: 'SRV-1000', description: 'Rack Server' },
            { partNumber: 'CBL-005', description: 'Cable' }
          ]
        }
      });

      const provider = createPartsProvider(mockVscode, {});
      provider.setFilter('Cable');

      const filteredNodes = await provider.getChildren();
      // Should have filterInfo node + matching part
      assert.strictEqual(filteredNodes.length, 2);
      assert.strictEqual(filteredNodes[0].type, 'filterInfo');
      assert.strictEqual(filteredNodes[1].part.partNumber, 'CBL-005');

      provider.clearFilter();
      const resetNodes = await provider.getChildren();
      assert.strictEqual(resetNodes.length, 2);
    });

    test('inspectPartCommand fetches and displays part in JSON document', async () => {
      let openedContent = null;
      mockVscode.workspace.openTextDocument = async (opts) => {
        openedContent = opts.content;
        return opts;
      };

      const partItem = {
        part: {
          partNumber: 'CBL-005',
          price: 75,
          description: 'Optical Cable'
        }
      };

      await inspectPartCommand(partItem, mockVscode, {});
      assert.ok(openedContent);
      assert.ok(openedContent.includes('CBL-005'));
      assert.ok(openedContent.includes('Optical Cable'));
    });

    test('copyPartNumberCommand copies part number to clipboard', async () => {
      const partItem = {
        part: {
          partNumber: 'SRV-1000'
        }
      };

      await copyPartNumberCommand(partItem, mockVscode);
      assert.strictEqual(mockVscode.getClipboardText(), 'SRV-1000');
    });

    test('insertPartNumberCommand inserts part number into editor', async () => {
      let insertedText = '';
      const customMockVscode = {
        ...mockVscode,
        window: {
          ...mockVscode.window,
          activeTextEditor: {
            selection: { active: {} },
            edit: async (cb) => {
              cb({
                insert: (pos, txt) => { insertedText = txt; }
              });
            }
          }
        }
      };

      const partItem = {
        part: {
          partNumber: 'SRV-1000'
        }
      };

      await insertPartNumberCommand(partItem, customMockVscode);
      assert.strictEqual(insertedText, 'SRV-1000');
    });
  });
});
