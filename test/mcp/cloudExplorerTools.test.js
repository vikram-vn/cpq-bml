'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tools = require('@/lang/mcp/tools');
const { createFakeVscode } = require('@/test/rest/testHelpers');
const { baseVscodeConfig, makeContext, withTempDir } = require('@/test/rest/commands/fixtures');

function vscodeRootedAt(tmpDir, overrides) {
    return createFakeVscode({
        config: baseVscodeConfig(overrides),
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
    });
}

const JSON_HEADERS = { 'content-type': 'application/json' };
function jsonResponse(statusCode, body) {
    return { statusCode, headers: JSON_HEADERS, text: JSON.stringify(body) };
}

const { SchemaIntrospector } = require('@/lang/intellisense/schemaIntrospector');

suite('MCP tools - Cloud Explorer & Data Tables', () => {
    teardown(() => {
        SchemaIntrospector.clearCache();
    });

    suite('getDataTableSchema', () => {
        test('retrieves and normalizes columns from live CPQ REST endpoint', () =>
            withTempDir(async (tmpDir) => {
                const schemaPayload = {
                    items: [
                        { name: 'part_number', type: 'String', label: 'Part Number', isPrimaryKey: true, description: 'Unique part ID' },
                        { name: 'lead_time_days', type: 'Integer', label: 'Lead Time', isPrimaryKey: false, description: 'Days to ship' },
                    ],
                };

                let requestedPath = '';
                const transport = async (opts) => {
                    requestedPath = opts.path;
                    return jsonResponse(200, schemaPayload);
                };

                const result = await tools.getDataTableSchema(makeContext(), vscodeRootedAt(tmpDir), { tableName: 'Parts_Catalog_DT' }, transport);

                assert.strictEqual(result.success, true);
                assert.strictEqual(result.tableName, 'Parts_Catalog_DT');
                assert.ok(requestedPath.includes('/datatables/Parts_Catalog_DT/fields'));
                assert.strictEqual(result.columns.length, 2);
                assert.deepStrictEqual(result.columns[0], {
                    name: 'part_number',
                    type: 'String',
                    label: 'Part Number',
                    isPrimaryKey: true,
                    description: 'Unique part ID',
                });
                assert.deepStrictEqual(result.columns[1], {
                    name: 'lead_time_days',
                    type: 'Integer',
                    label: 'Lead Time',
                    isPrimaryKey: false,
                    description: 'Days to ship',
                });
            }));

        test('falls back gracefully to workspace schema when remote returns 404', () =>
            withTempDir(async (tmpDir) => {
                const cpqDir = path.join(tmpDir, 'cpq');
                fs.mkdirSync(cpqDir, { recursive: true });
                const schema = {
                    dataTables: [
                        { name: 'Pricing_Rules_DT', columns: ['tier', 'region', 'discount_pct'] },
                    ],
                };
                fs.writeFileSync(path.join(cpqDir, 'schema.json'), JSON.stringify(schema));

                const transport = async () => jsonResponse(404, { error: 'Not Found' });

                const result = await tools.getDataTableSchema(makeContext(), vscodeRootedAt(tmpDir), { tableName: 'Pricing_Rules_DT' }, transport);

                assert.strictEqual(result.success, true);
                assert.strictEqual(result.tableName, 'Pricing_Rules_DT');
                assert.strictEqual(result.source, 'workspace_cache');
                assert.strictEqual(result.columns.length, 3);
                assert.strictEqual(result.columns[0].name, 'tier');
                assert.strictEqual(result.columns[1].name, 'region');
                assert.strictEqual(result.columns[2].name, 'discount_pct');
            }));

        test('returns error when tableName parameter is missing', async () => {
            const result = await tools.getDataTableSchema(makeContext(), vscodeRootedAt(process.cwd()), {});
            assert.strictEqual(result.success, false);
            assert.ok(result.error.includes('tableName parameter is required'));
        });
    });

    suite('getDataTableRows', () => {
        test('retrieves rows from custom data table endpoint', () =>
            withTempDir(async (tmpDir) => {
                const rowsPayload = {
                    items: [
                        { _id: '1', tier: 'Gold', discount_pct: 15.0 },
                        { _id: '2', tier: 'Silver', discount_pct: 10.0 },
                    ],
                    totalResults: 2,
                    hasMore: false,
                };

                let requestedPath = '';
                const transport = async (opts) => {
                    requestedPath = opts.path;
                    return jsonResponse(200, rowsPayload);
                };

                const result = await tools.getDataTableRows(makeContext(), vscodeRootedAt(tmpDir), { tableName: 'Pricing_Rules_DT', limit: 10 }, transport);

                assert.strictEqual(result.success, true);
                assert.strictEqual(result.count, 2);
                assert.strictEqual(result.totalResults, 2);
                assert.strictEqual(result.hasMore, false);
                assert.ok(requestedPath.includes('customPricing_Rules_DT'));
                assert.strictEqual(result.rows[0].tier, 'Gold');
            }));

        test('reports error on server failure', () =>
            withTempDir(async (tmpDir) => {
                const transport = async () => jsonResponse(500, { detail: 'Internal DB Error' });
                const result = await tools.getDataTableRows(makeContext(), vscodeRootedAt(tmpDir), { tableName: 'Pricing_Rules_DT' }, transport);
                assert.strictEqual(result.success, false);
                assert.ok(result.error.includes('500'));
            }));
    });

    suite('listCommerceProcesses', () => {
        test('lists processes from CPQ REST API', () =>
            withTempDir(async (tmpDir) => {
                const payload = {
                    items: [
                        { variableName: 'oraclecpqo', label: 'Oracle CPQ Standard', description: 'Standard sales process' },
                    ],
                };
                const transport = async () => jsonResponse(200, payload);

                const result = await tools.listCommerceProcesses(makeContext(), vscodeRootedAt(tmpDir), {}, transport);
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.count, 1);
                assert.strictEqual(result.processes[0].variableName, 'oraclecpqo');
            }));

        test('falls back to workspace directory when unconfigured or offline', () =>
            withTempDir(async (tmpDir) => {
                const procDir = path.join(tmpDir, 'cpq', 'commerce', 'customProcess');
                fs.mkdirSync(procDir, { recursive: true });

                const vsc = createFakeVscode({
                    config: baseVscodeConfig({ host: '' }),
                    workspaceFolders: [{ uri: { fsPath: tmpDir } }],
                });

                const result = await tools.listCommerceProcesses(makeContext(), vsc, {});
                assert.strictEqual(result.success, true);
                assert.ok(result.processes.some(p => p.variableName === 'customProcess'));
            }));
    });

    suite('listConfigurationHierarchy', () => {
        test('returns nested families, product lines, and models', () =>
            withTempDir(async (tmpDir) => {
                const transport = async (opts) => {
                    if (opts.path.includes('/models')) {
                        return jsonResponse(200, { items: [{ variableName: 'r740', name: 'PowerEdge R740' }] });
                    }
                    if (opts.path.includes('/productLines')) {
                        return jsonResponse(200, { items: [{ variableName: 'servers', name: 'Rack Servers' }] });
                    }
                    if (opts.path.includes('/productFamilies')) {
                        return jsonResponse(200, { items: [{ variableName: 'hardware', name: 'Hardware Family' }] });
                    }
                    return jsonResponse(404, {});
                };

                const result = await tools.listConfigurationHierarchy(makeContext(), vscodeRootedAt(tmpDir), {}, transport);

                assert.strictEqual(result.success, true);
                assert.strictEqual(result.count, 1);
                assert.strictEqual(result.families[0].variableName, 'hardware');
                assert.strictEqual(result.families[0].productLines.length, 1);
                assert.strictEqual(result.families[0].productLines[0].variableName, 'servers');
                assert.strictEqual(result.families[0].productLines[0].models[0].variableName, 'r740');
            }));
    });

    suite('listConfigurationAttributes', () => {
        test('lists attributes by family and line scope', () =>
            withTempDir(async (tmpDir) => {
                const payload = {
                    items: [
                        { variableName: 'cpu_cores', label: 'CPU Cores', dataType: 'Integer', description: 'Total CPU cores' },
                    ],
                };
                const transport = async () => jsonResponse(200, payload);

                const result = await tools.listConfigurationAttributes(
                    makeContext(),
                    vscodeRootedAt(tmpDir),
                    { productFamily: 'hardware', productLine: 'servers' },
                    transport,
                );

                assert.strictEqual(result.success, true);
                assert.strictEqual(result.count, 1);
                assert.strictEqual(result.attributes[0].variableName, 'cpu_cores');
                assert.strictEqual(result.attributes[0].dataType, 'Integer');
            }));
    });

    suite('listDeploymentTasks', () => {
        test('retrieves recent deployment center tasks', () =>
            withTempDir(async (tmpDir) => {
                const payload = {
                    items: [
                        { id: '101', name: 'Deploy Commerce oraclecpqo', status: 'Completed', percentComplete: 100 },
                    ],
                    totalResults: 1,
                };
                const transport = async () => jsonResponse(200, payload);

                const result = await tools.listDeploymentTasks(makeContext(), vscodeRootedAt(tmpDir), {}, transport);
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.count, 1);
                assert.strictEqual(result.tasks[0].id, '101');
                assert.strictEqual(result.tasks[0].status, 'Completed');
            }));
    });

    suite('getTransactionData', () => {
        test('retrieves transaction payload by transactionId', () =>
            withTempDir(async (tmpDir) => {
                const payload = {
                    _id: '12345',
                    transactionID_t: 'TXN-2026-001',
                    _customer_t_company_name: 'Acme Corp',
                    _total_amount: 50000.0,
                };
                const transport = async () => jsonResponse(200, payload);

                const result = await tools.getTransactionData(makeContext(), vscodeRootedAt(tmpDir), { transactionId: '12345' }, transport);
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.transactionId, '12345');
                assert.strictEqual(result.transaction.transactionID_t, 'TXN-2026-001');
            }));
    });

    suite('getCloudExplorerOverview', () => {
        test('returns overview for datatables section', () =>
            withTempDir(async (tmpDir) => {
                const transport = async (opts) => {
                    if (opts.path.includes('/datatables')) {
                        return jsonResponse(200, { items: [{ name: 'Pricing_DT' }] });
                    }
                    return jsonResponse(200, {});
                };

                const result = await tools.getCloudExplorerOverview(makeContext(), vscodeRootedAt(tmpDir), { section: 'datatables' }, transport);
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.section, 'datatables');
                assert.ok(result.overview.dataTables);
            }));
    });

    suite('MCP Server Registration', () => {
        test('registers all cloud explorer tools into McpServer', () => {
            const registered = [];
            const fakeServer = {
                registerTool: (name, schema, handler) => {
                    registered.push({ name, schema, handler });
                },
            };
            const cloudExplorerDefs = require('@/lang/mcp/tool-defs/cloudExplorerDefs');
            cloudExplorerDefs.register(fakeServer, makeContext(), vscodeRootedAt(process.cwd()), tools);

            const names = registered.map(r => r.name);
            assert.ok(names.includes('get_cloud_explorer_overview'));
            assert.ok(names.includes('list_commerce_processes'));
            assert.ok(names.includes('list_configuration_hierarchy'));
            assert.ok(names.includes('list_configuration_attributes'));
            assert.ok(names.includes('list_deployment_tasks'));
            assert.ok(names.includes('get_transaction_data'));
            assert.ok(names.includes('introspect_cpq_schema'));
        });

        test('registers get_datatable_rows into McpServer via lookupTools', () => {
            const registered = [];
            const fakeServer = {
                registerTool: (name, schema, handler) => {
                    registered.push({ name, schema, handler });
                },
            };
            const lookupTools = require('@/lang/mcp/tool-defs/lookupTools');
            lookupTools.register(fakeServer, makeContext(), vscodeRootedAt(process.cwd()), tools);

            const names = registered.map(r => r.name);
            assert.ok(names.includes('get_datatable_schema'));
            assert.ok(names.includes('get_datatable_rows'));
        });
    });
});

