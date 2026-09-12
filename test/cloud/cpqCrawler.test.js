const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { crawlCpqSchema } = require('@/lang/cloud/cpqCrawler');
const { SchemaIntrospector } = require('@/lang/intellisense/schemaIntrospector');

suite('CPQ Recursive Metadata Crawler - Unit Tests', () => {
  let tmpDir;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-crawler-test-'));
  });

  teardown(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('crawlCpqSchema hits commerceProcesses and productFamilies roots and compiles .cpq/schema.json', async () => {
    const requestedPaths = [];

    const mockTransport = async (opts) => {
      requestedPaths.push(opts.path);
      const cleanPath = opts.path.split('?')[0];

      // 1. Commerce Root
      if (cleanPath.endsWith('/commerceProcesses')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'oraclecpqo', label: 'Oracle CPQ Standard Process' }
            ]
          }
        };
      }

      // 2. Documents under process
      if (cleanPath.endsWith('/commerceProcesses/oraclecpqo/documents')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'transaction', label: 'Transaction Header' },
              { variableName: 'transactionLine', label: 'Transaction Line' }
            ]
          }
        };
      }

      // 3. Actions under document
      if (cleanPath.includes('/actionDefs')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'cleanSave_t', label: 'Clean Save', actionType: 'Modify' }
            ]
          }
        };
      }

      // 4. Attributes under document
      if (cleanPath.includes('/commerceProcesses/oraclecpqo/documents/') && cleanPath.endsWith('/attributes')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'customer_t', label: 'Customer', dataType: 'String', required: true }
            ]
          }
        };
      }

      // 5. Config Product Families Root
      if (cleanPath.endsWith('/productFamilies')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'servers', label: 'Servers Family' }
            ]
          }
        };
      }

      // 6. Product Family Attributes
      if (cleanPath.includes('/productFamilies/servers/attributes')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'form_factor', label: 'Form Factor', dataType: 'Text' }
            ]
          }
        };
      }

      // 7. Product Lines under Family
      if (cleanPath.includes('/productFamilies/servers/productLines')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'rack_servers', label: 'Rack Servers' }
            ]
          }
        };
      }

      // 8. Product Line Attributes
      if (cleanPath.includes('/productFamilies/servers/productLines/rack_servers/attributes')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'rack_units', label: 'Rack Units', dataType: 'Integer' }
            ]
          }
        };
      }

      // 9. Models under Line
      if (cleanPath.includes('/productFamilies/servers/productLines/rack_servers/models')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'poweredge_r750', label: 'PowerEdge R750' }
            ]
          }
        };
      }

      // 10. Model Attributes
      if (cleanPath.includes('/models/poweredge_r750/attributes')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'cpu_sockets', label: 'CPU Sockets', dataType: 'Integer' }
            ]
          }
        };
      }

      // 11. BOM Mapping Rules
      if (cleanPath.includes('/bomMappingRules')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'bom_rule_1', label: 'BOM Rule 1' }
            ]
          }
        };
      }

      // 12. Data Tables
      if (cleanPath.endsWith('/dataTables')) {
        return {
          statusCode: 200,
          body: {
            items: [
              { name: 'Server_Catalog_DT', columns: [{ variableName: 'sku' }] }
            ]
          }
        };
      }

      return { statusCode: 200, body: { items: [] } };
    };

    const { createFakeVscode, createFakeContext } = require('@/test/rest/testHelpers');

    const fakeVsc = createFakeVscode({
      config: {
        'connection.siteUrl': 'https://cpq-10124.bigmachines.com',
        'connection.username': 'admin',
        'rest.commerceProcess': 'oraclecpqo',
        'rest.commerceDocument': 'transaction'
      },
      workspaceFolders: [{ uri: { fsPath: tmpDir } }]
    });

    const fakeCtx = createFakeContext({
      'cpqBml.connection.password': 'secret'
    });

    const progressEvents = [];
    const res = await crawlCpqSchema(
      fakeCtx,
      fakeVsc,
      {
        onProgress: (p) => progressEvents.push(p),
        saveToFile: true
      },
      mockTransport
    );

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.stats.processes, 1);
    assert.strictEqual(res.stats.documents, 2);
    assert.strictEqual(res.stats.productFamilies, 1);
    assert.strictEqual(res.stats.productLines, 1);
    assert.strictEqual(res.stats.models, 1);

    // Verify root endpoints were hit
    assert.ok(requestedPaths.some(p => p.includes('/commerceProcesses')), 'Should have hit /commerceProcesses root');
    assert.ok(requestedPaths.some(p => p.includes('/productFamilies')), 'Should have hit /productFamilies root');

    // Verify partitioned files were generated
    const commercePath = path.join(tmpDir, '.cpq', 'commerce.json');
    const configPath = path.join(tmpDir, '.cpq', 'config.json');
    const dtPath = path.join(tmpDir, '.cpq', 'datatables.json');
    const schemaPath = path.join(tmpDir, '.cpq', 'schema.json');
    const metaPath = path.join(tmpDir, '.cpq', 'metadata.json');
    const dtsPath = path.join(tmpDir, '.cpq', 'cpq.d.bml');

    assert.ok(fs.existsSync(commercePath), 'commerce.json must exist');
    assert.ok(fs.existsSync(configPath), 'config.json must exist');
    assert.ok(fs.existsSync(dtPath), 'datatables.json must exist');
    assert.ok(fs.existsSync(schemaPath), 'schema.json must exist');
    assert.ok(fs.existsSync(metaPath), 'metadata.json must exist');
    assert.ok(fs.existsSync(dtsPath), 'cpq.d.bml must exist');

    const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.strictEqual(schemaJson.commerce.processes.length, 1);
    assert.strictEqual(schemaJson.configuration.productFamilies.length, 1);
    assert.ok(schemaJson.transactionAttributes.some(a => a.name === 'customer_t'));

    const commerceJson = JSON.parse(fs.readFileSync(commercePath, 'utf8'));
    assert.strictEqual(commerceJson.processes.length, 1);
    assert.strictEqual(commerceJson.actions.length, 2);

    const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(configJson.productFamilies.length, 1);
  });

  test('crawlCpqSchema supports outputDir to save schema in backend storage outside workspace', async () => {
    const backendStorageDir = path.join(tmpDir, 'backend-global-storage', 'schema');
    const mockTransport = async (opts) => {
      const cleanPath = opts.path.split('?')[0];
      if (cleanPath.endsWith('/commerceProcesses')) {
        return { statusCode: 200, body: { items: [{ variableName: 'p1', label: 'P1' }] } };
      }
      if (cleanPath.endsWith('/productFamilies')) {
        return { statusCode: 200, body: { items: [] } };
      }
      return { statusCode: 200, body: { items: [] } };
    };

    const res = await crawlCpqSchema(
      {},
      { workspace: { workspaceFolders: [{ uri: { fsPath: tmpDir } }] } },
      { outputDir: backendStorageDir, saveToFile: true },
      mockTransport
    );

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.storageDir, backendStorageDir);
    assert.ok(fs.existsSync(path.join(backendStorageDir, 'commerce.json')));
    assert.ok(fs.existsSync(path.join(backendStorageDir, 'config.json')));
    assert.ok(fs.existsSync(path.join(backendStorageDir, 'datatables.json')));
  });
});
