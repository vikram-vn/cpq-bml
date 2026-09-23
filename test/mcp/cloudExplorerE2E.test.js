'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tools = require('@/lang/mcp/tools');
const lookupTools = require('@/lang/mcp/tool-defs/lookupTools');
const cloudExplorerDefs = require('@/lang/mcp/tool-defs/cloudExplorerDefs');
const commerceFormulaDefs = require('@/lang/mcp/tool-defs/commerceFormulaDefs');
const { createFakeVscode } = require('@/test/rest/testHelpers');
const { baseVscodeConfig, makeContext, withTempDir } = require('@/test/rest/commands/fixtures');
const { SchemaIntrospector } = require('@/lang/intellisense/schemaIntrospector');

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

function createE2EServer(context, vscodeInstance) {
    const registeredTools = new Map();
    const fakeServer = {
        registerTool: (name, schema, handler) => {
            registeredTools.set(name, { schema, handler });
        },
    };

    lookupTools.register(fakeServer, context, vscodeInstance, tools);
    cloudExplorerDefs.register(fakeServer, context, vscodeInstance, tools);
    commerceFormulaDefs.register(fakeServer, context, vscodeInstance, tools);

    return {
        hasTool: (name) => registeredTools.has(name),
        callTool: async (name, args) => {
            const entry = registeredTools.get(name);
            if (!entry) throw new Error(`Tool "${name}" not registered`);
            return await entry.handler(args);
        },
    };
}

suite('MCP Cloud Explorer & Commerce E2E Test Suite', () => {
    teardown(() => {
        SchemaIntrospector.clearCache();
    });

    test('E2E: get_datatable_schema returns normalized schema with primary keys', () =>
        withTempDir(async (tmpDir) => {
            const vsc = vscodeRootedAt(tmpDir);
            const ctx = makeContext();
            const e2e = createE2EServer(ctx, vsc);

            const dtPayload = {
                items: [
                    { name: 'region_code', type: 'String', key: true, description: 'Region Identifier' },
                    { name: 'multiplier', type: 'Float', key: false, description: 'Regional Multiplier' },
                ],
            };

            const transport = async (opts) => {
                if (opts.path.includes('/datatables/Region_Multiplier_DT/fields')) {
                    return jsonResponse(200, dtPayload);
                }
                return jsonResponse(404, {});
            };

            // Call tool handler through full MCP jsonResult wrapper
            const rawRes = await tools.getDataTableSchema(ctx, vsc, { tableName: 'Region_Multiplier_DT' }, transport);
            assert.strictEqual(rawRes.success, true);
            assert.strictEqual(rawRes.columns.length, 2);
            assert.strictEqual(rawRes.columns[0].name, 'region_code');
            assert.strictEqual(rawRes.columns[0].isPrimaryKey, true);
            assert.strictEqual(rawRes.columns[1].name, 'multiplier');
            assert.strictEqual(rawRes.columns[1].isPrimaryKey, false);
        }));

    test('E2E: get_datatable_rows queries records with limit, offset, and filter', () =>
        withTempDir(async (tmpDir) => {
            const vsc = vscodeRootedAt(tmpDir);
            const ctx = makeContext();
            const e2e = createE2EServer(ctx, vsc);

            let capturedPath = '';
            const rowsPayload = {
                items: [
                    { _id: '1', region_code: 'US_EAST', multiplier: 1.15 },
                ],
                totalResults: 1,
                hasMore: false,
            };

            const transport = async (opts) => {
                if (opts.path.includes('customRegion_Multiplier_DT')) {
                    capturedPath = opts.path;
                    return jsonResponse(200, rowsPayload);
                }
                return jsonResponse(404, {});
            };

            const rawRes = await tools.getDataTableRows(ctx, vsc, {
                tableName: 'Region_Multiplier_DT',
                limit: 10,
                offset: 0,
                q: "{region_code:{$eq:'US_EAST'}}",
            }, transport);

            assert.strictEqual(rawRes.success, true);
            assert.strictEqual(rawRes.count, 1);
            assert.strictEqual(rawRes.rows[0].region_code, 'US_EAST');
            assert.ok(capturedPath.includes('limit=10'));
            assert.ok(capturedPath.includes('US_EAST'));
        }));

    test('E2E: get_commerce_document_modify_tab fetches document modify tab options', () =>
        withTempDir(async (tmpDir) => {
            const vsc = vscodeRootedAt(tmpDir);
            const ctx = makeContext();

            const modifyPayload = {
                items: [
                    { attributeId: 1001, attributeVarName: 'discount_t', useFormula: true, overrideModify: false, formulaPresent: true },
                    { attributeId: 1002, attributeVarName: 'tax_t', useFormula: false, overrideModify: true, formulaPresent: false },
                ],
            };

            const transport = async (opts) => {
                if (opts.path.includes('/modifyTab')) {
                    return jsonResponse(200, modifyPayload);
                }
                return jsonResponse(404, {});
            };

            const rawRes = await tools.getCommerceDocumentModifyTab(ctx, vsc, {
                commerceProcess: 'oraclecpqo',
                commerceDocument: 'transaction',
            }, transport);

            assert.strictEqual(rawRes.success, true);
            assert.strictEqual(rawRes.count, 2);
            assert.strictEqual(rawRes.items[0].attributeVarName, 'discount_t');
            assert.strictEqual(rawRes.items[0].useFormula, true);
        }));

    test('E2E: update_commerce_document_modify_tab updates modify options via PATCH', () =>
        withTempDir(async (tmpDir) => {
            const vsc = vscodeRootedAt(tmpDir);
            const ctx = makeContext();

            let sentMethod = '';
            let sentBody = null;

            const transport = async (opts) => {
                sentMethod = opts.method;
                sentBody = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
                return jsonResponse(200, { items: (sentBody && sentBody.items) || sentBody });
            };

            const updates = [
                { attributeVarName: 'discount_t', useFormula: true, overrideModify: true },
            ];

            const rawRes = await tools.updateCommerceDocumentModifyTab(ctx, vsc, {
                items: updates,
                commerceProcess: 'oraclecpqo',
                commerceDocument: 'transaction',
            }, transport);

            assert.strictEqual(rawRes.success, true);
            assert.strictEqual(rawRes.updatedCount, 1);
            assert.strictEqual(sentMethod, 'PATCH');
            assert.deepStrictEqual(sentBody.items[0].attributeVarName, 'discount_t');
        }));

    test('E2E: pull_commerce_action_scripts extracts before, after, and modify formulas', () =>
        withTempDir(async (tmpDir) => {
            const vsc = vscodeRootedAt(tmpDir);
            const ctx = makeContext();

            const actionPayload = {
                variableName: 'cleanSave_t',
                name: 'Clean Save',
                beforeFormulas: 'print("Before Formula Execution");',
                afterFormulas: 'print("After Formula Execution");',
                modifyScript: 'return "Success";',
            };

            const transport = async (opts) => {
                if (opts.path.includes('/actionDefs/cleanSave_t')) {
                    return jsonResponse(200, actionPayload);
                }
                return jsonResponse(404, {});
            };

            const rawRes = await tools.pullCommerceActionScripts(ctx, vsc, {
                actionVariableName: 'cleanSave_t',
                commerceProcess: 'oraclecpqo',
                commerceDocument: 'transaction',
            }, transport);

            assert.strictEqual(rawRes.success, true);
            assert.strictEqual(rawRes.scriptsCount, 3);
            assert.ok(rawRes.scripts.some(s => s.type === 'before-formulas'));
            assert.ok(rawRes.scripts.some(s => s.type === 'after-formulas'));
            assert.ok(rawRes.scripts.some(s => s.type === 'modify'));

            // Verify files written to workspace
            const actionDir = path.join(tmpDir, 'cpq', 'commerce', 'oraclecpqo', 'actions', 'transaction', 'cleanSave_t');
            assert.ok(fs.existsSync(path.join(actionDir, 'cleanSave_t_before-formulas.bml')));
            assert.ok(fs.existsSync(path.join(actionDir, 'cleanSave_t_after-formulas.bml')));
            assert.ok(fs.existsSync(path.join(actionDir, 'cleanSave_t_modify.bml')));
        }));

    test('E2E: pull_commerce_attribute_formula extracts default and modify tab formulas', () =>
        withTempDir(async (tmpDir) => {
            const vsc = vscodeRootedAt(tmpDir);
            const ctx = makeContext();

            const attrPayload = {
                variableName: 'discount_pct',
                name: 'Discount Percentage',
                defaultFormula: 'return 10.0;',
                modifyFormula: 'return 15.0;',
            };

            const transport = async (opts) => {
                if (opts.path.includes('/attributes/discount_pct')) {
                    return jsonResponse(200, attrPayload);
                }
                return jsonResponse(404, {});
            };

            const defaultRes = await tools.pullCommerceAttributeFormula(ctx, vsc, {
                attributeVariableName: 'discount_pct',
                formulaType: 'default',
            }, transport);

            assert.strictEqual(defaultRes.success, true);
            assert.strictEqual(defaultRes.formulaType, 'default');
            assert.ok(defaultRes.code.includes('10.0'));

            const modifyRes = await tools.pullCommerceAttributeFormula(ctx, vsc, {
                attributeVariableName: 'discount_pct',
                formulaType: 'modify',
            }, transport);

            assert.strictEqual(modifyRes.success, true);
            assert.strictEqual(modifyRes.formulaType, 'modify');
            assert.ok(modifyRes.code.includes('15.0'));
        }));

    test('E2E: server registration verifies all new tools are present', () => {
        const vsc = vscodeRootedAt(process.cwd());
        const ctx = makeContext();
        const e2e = createE2EServer(ctx, vsc);

        assert.ok(e2e.hasTool('get_datatable_schema'));
        assert.ok(e2e.hasTool('get_datatable_rows'));
        assert.ok(e2e.hasTool('get_cloud_explorer_overview'));
        assert.ok(e2e.hasTool('list_commerce_processes'));
        assert.ok(e2e.hasTool('list_configuration_hierarchy'));
        assert.ok(e2e.hasTool('list_configuration_attributes'));
        assert.ok(e2e.hasTool('list_deployment_tasks'));
        assert.ok(e2e.hasTool('get_transaction_data'));
        assert.ok(e2e.hasTool('introspect_cpq_schema'));
        assert.ok(e2e.hasTool('get_commerce_document_modify_tab'));
        assert.ok(e2e.hasTool('update_commerce_document_modify_tab'));
        assert.ok(e2e.hasTool('pull_commerce_action_scripts'));
        assert.ok(e2e.hasTool('debug_commerce_action_script'));
        assert.ok(e2e.hasTool('pull_commerce_attribute_formula'));
        assert.ok(e2e.hasTool('debug_commerce_attribute_formula'));
    });
});
