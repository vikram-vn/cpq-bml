'use strict';

const assert = require('assert');
const path = require('path');
const {
    stripComments,
    inferLibraryPrefix,
    analyzeScriptContent,
    buildWorkspaceCallGraph,
    computeBlastRadius,
    generateDependencyModel,
    exportToMermaid
} = require('@/lang/graph/dependencyGraphAnalyzer');

const {
    buildWorkspaceEntityIndex,
    searchWorkspaceEntities,
    generateBottomUpModel
} = require('@/lang/graph/bottomUpTracer');

const { getHtml } = require('@/lang/graph/dependencyGraphPanel');

suite('Dependency Graph & Blast Radius Analyzer', () => {

    test('getHtml injects initialModel, CSP, nonce, and script/style URIs', () => {
        const mockContext = {
            extensionPath: path.resolve(__dirname, '..', '..')
        };
        const mockWebview = {
            cspSource: 'vscode-webview:',
            asWebviewUri: (uri) => uri
        };
        const sampleModel = {
            target: { name: 'invokeWebService', qualifiedName: 'util.invokewebservice', filePath: '/test.bml' },
            blastRadius: { callers: [], directCount: 0, transitiveCount: 0, maxDepth: 0, impactLevel: 'Isolated' },
            outgoing: { functions: [], dataTables: [{ name: 'INT_SYSTEM_DETAILS', operation: 'BMQL', line: 1 }], externalApis: [] },
            graph: { nodes: [], edges: [] }
        };

        const html = getHtml(mockContext, mockWebview, sampleModel);

        assert.ok(html.includes('Content-Security-Policy'), 'Must have CSP meta tag');
        assert.ok(html.includes('window.__INITIAL_GRAPH_MODEL__ = {'), 'Must inject initialModel JSON');
        assert.ok(html.includes('"invokeWebService"'), 'Must contain target name');
        assert.ok(html.includes('"INT_SYSTEM_DETAILS"'), 'Must contain BMQL data table');
        assert.ok(html.includes('dist/web-panel/main.js'), 'Must point to main.js');
        assert.ok(html.includes('dist/web-panel/main.css'), 'Must point to main.css');
        assert.ok(!html.includes('{{nonce}}'), 'Nonce template token must be replaced');
        assert.ok(!html.includes('{{csp}}'), 'CSP template token must be replaced');
    });

    test('getHtml handles null initialModel gracefully', () => {
        const mockContext = {
            extensionPath: path.resolve(__dirname, '..', '..')
        };
        const mockWebview = {
            cspSource: 'vscode-webview:',
            asWebviewUri: (uri) => uri
        };

        const html = getHtml(mockContext, mockWebview, null);

        assert.ok(html.includes('window.__INITIAL_GRAPH_MODEL__ = null;'), 'Must inject null for empty model');
    });

    test('showDependencyGraph creates webview panel and populates initial html with model', async () => {
        const targetBml = '/workspace/commerce-libraries/invokeWebService/invokeWebService.bml';
        const mockContext = {
            extensionPath: path.resolve(__dirname, '..', '..'),
            extensionUri: { fsPath: path.resolve(__dirname, '..', '..'), scheme: 'file' },
            subscriptions: []
        };

        const { showDependencyGraph } = require('@/lang/graph/dependencyGraphPanel');
        await showDependencyGraph(mockContext, { fsPath: targetBml });
    });

    test('analyzeScriptContent extracts util/commerce calls, BMQL tables, and urldata', () => {
        const script = `
            tax = util.pricing.calculateTax(subtotal, state);
            rate = commerce.getApprovalRate(profile);
            recordset = bmql("SELECT part_number, price FROM parts_table WHERE active = 1");
            res = urldata("https://api.taxservice.com/v1/rates", "GET", headers);
        `;

        const result = analyzeScriptContent(script);

        assert.strictEqual(result.functions.length, 2);
        assert.strictEqual(result.functions[0].name, 'pricing');
        assert.strictEqual(result.functions[0].qualifiedName, 'util.pricing');
        assert.strictEqual(result.functions[1].name, 'getApprovalRate');
        assert.strictEqual(result.functions[1].qualifiedName, 'commerce.getapprovalrate');

        assert.strictEqual(result.dataTables.length, 1);
        assert.strictEqual(result.dataTables[0].name, 'parts_table');

        assert.strictEqual(result.externalApis.length, 1);
        assert.strictEqual(result.externalApis[0].target, 'https://api.taxservice.com/v1/rates');
    });

    test('computeBlastRadius correctly identifies direct and transitive callers with cycle safety', () => {
        // Mock workspace call graph
        // A calls Target
        // B calls A (so B is transitive caller of Target)
        // C calls B (depth 3)
        // Target calls A (cyclic relationship)
        const mockGraph = new Map([
            ['util.target', {
                filePath: '/workspace/target.bml',
                qualifiedName: 'util.target',
                name: 'target',
                outgoing: {
                    functions: [{ prefix: 'util', name: 'a', qualifiedName: 'util.a', line: 5 }],
                    dataTables: [],
                    externalApis: []
                }
            }],
            ['util.a', {
                filePath: '/workspace/a.bml',
                qualifiedName: 'util.a',
                name: 'a',
                outgoing: {
                    functions: [{ prefix: 'util', name: 'target', qualifiedName: 'util.target', line: 10 }],
                    dataTables: [],
                    externalApis: []
                }
            }],
            ['util.b', {
                filePath: '/workspace/b.bml',
                qualifiedName: 'util.b',
                name: 'b',
                outgoing: {
                    functions: [{ prefix: 'util', name: 'a', qualifiedName: 'util.a', line: 15 }],
                    dataTables: [],
                    externalApis: []
                }
            }],
            ['commerce.c', {
                filePath: '/workspace/commerce/c.bml',
                qualifiedName: 'commerce.c',
                name: 'c',
                outgoing: {
                    functions: [{ prefix: 'util', name: 'b', qualifiedName: 'util.b', line: 20 }],
                    dataTables: [],
                    externalApis: []
                }
            }]
        ]);

        const blast = computeBlastRadius('util.target', mockGraph);

        assert.strictEqual(blast.directCount, 1, 'Should have 1 direct caller (util.a)');
        assert.strictEqual(blast.transitiveCount, 3, 'Should have 3 total callers in blast radius (a, b, c)');
        assert.strictEqual(blast.maxDepth, 3, 'Max depth should reach 3');
        assert.strictEqual(blast.impactLevel, 'Medium');

        const callerNames = blast.callers.map(c => c.name);
        assert.ok(callerNames.includes('a'));
        assert.ok(callerNames.includes('b'));
        assert.ok(callerNames.includes('c'));
    });

    test('generateDependencyModel builds complete visual nodes and edges', () => {
        const files = [
            {
                filePath: '/cpq/util/calc.bml',
                content: `
                    res = util.helper();
                    rs = bmql("SELECT x FROM rates_table");
                `
            },
            {
                filePath: '/cpq/commerce/action.bml',
                content: `
                    val = util.calc();
                `
            }
        ];

        const model = generateDependencyModel('/cpq/util/calc.bml', files);

        assert.strictEqual(model.target.name, 'calc');
        assert.strictEqual(model.target.qualifiedName, 'util.calc');
        assert.strictEqual(model.blastRadius.directCount, 1);
        assert.strictEqual(model.blastRadius.callers[0].name, 'action');

        // Check visual nodes
        const nodeTypes = model.graph.nodes.map(n => n.type);
        assert.ok(nodeTypes.includes('focal'));
        assert.ok(nodeTypes.includes('caller'));
        assert.ok(nodeTypes.includes('callee'));
        assert.ok(nodeTypes.includes('table'));

        // Check visual edges
        const edgeTypes = model.graph.edges.map(e => e.type);
        assert.ok(edgeTypes.includes('blast_radius'));
        assert.ok(edgeTypes.includes('callee_call'));
        assert.ok(edgeTypes.includes('data_access'));
    });

    test('exportToMermaid produces valid flowchart syntax', () => {
        const model = {
            target: { name: 'calc', qualifiedName: 'util.calc', filePath: '/test.bml' },
            blastRadius: { callers: [], directCount: 0, transitiveCount: 0, maxDepth: 0, impactLevel: 'Isolated' },
            outgoing: { functions: [], dataTables: [], externalApis: [], attributes: [], actions: [] },
            graph: {
                nodes: [
                    { id: 'target_util_calc', label: 'calc', subtitle: 'util.calc', type: 'focal' },
                    { id: 'caller_action', label: 'action', subtitle: 'commerce.action', type: 'caller' },
                    { id: 'attr_status_t', label: 'status_t', subtitle: 'Transaction Attribute', type: 'attribute' },
                    { id: 'action_save', label: 'save_t', subtitle: 'Commerce Action', type: 'action' }
                ],
                edges: [
                    { source: 'caller_action', target: 'target_util_calc', type: 'blast_radius', label: 'calls' },
                    { source: 'target_util_calc', target: 'attr_status_t', type: 'attribute_access', label: 'reads' },
                    { source: 'action_save', target: 'target_util_calc', type: 'action_trigger', label: 'triggers' }
                ]
            }
        };

        const mermaid = exportToMermaid(model);
        assert.ok(mermaid.startsWith('flowchart LR'));
        assert.ok(mermaid.includes('caller_action'));
        assert.ok(mermaid.includes('target_util_calc'));
        assert.ok(mermaid.includes('attr_status_t'));
        assert.ok(mermaid.includes('action_save'));
        assert.ok(mermaid.includes('-->|"calls"|'));
    });

    test('analyzeScriptContent extracts attributes, actions, datatables, and libraries', () => {
        const script = `
            status = status_t;
            line_status = line.status_l;
            val = line.unit_price;
            totalAmount_t = 500.0;
            if (_action_name == "SubmitOrder") {
                util.notification.send();
            }
            save_t;
            recordset = bmql("SELECT part FROM catalog_dt");
        `;
        const meta = {
            mainDocAttributes: [{ name: 'custom_t' }],
            subDocAttributes: [{ name: 'custom_l' }],
            actionName: 'ApproveQuote'
        };

        const result = analyzeScriptContent(script, meta);

        // Attributes
        const attrNames = result.attributes.map(a => a.name);
        assert.ok(attrNames.includes('status_t'));
        assert.ok(attrNames.includes('status_l'));
        assert.ok(attrNames.includes('unit_price'));
        assert.ok(attrNames.includes('totalAmount_t'));
        assert.ok(attrNames.includes('custom_t'));
        assert.ok(attrNames.includes('custom_l'));

        // Actions
        const actNames = result.actions.map(a => a.name);
        assert.ok(actNames.includes('SubmitOrder'));
        assert.ok(actNames.includes('save_t'));
        assert.ok(actNames.includes('ApproveQuote'));

        // Data Tables
        assert.strictEqual(result.dataTables[0].name, 'catalog_dt');

        // Functions / Libraries
        assert.strictEqual(result.functions[0].qualifiedName, 'util.notification');
    });

    test('generateDependencyModel generates nodes and workspaceSymbols for attributes and actions', () => {
        const files = [
            {
                filePath: '/cpq/commerce/transactionStatus.bml',
                content: `
                    status = status_t;
                    line_status = line.status_l;
                    rs = bmql("SELECT x FROM rates_dt");
                    util.helper();
                `
            },
            {
                filePath: '/cpq/util/helper.bml',
                content: `return 1;`
            }
        ];

        const model = generateDependencyModel('/cpq/commerce/transactionStatus.bml', files);

        const nodeTypes = model.graph.nodes.map(n => n.type);
        assert.ok(nodeTypes.includes('focal'));
        assert.ok(nodeTypes.includes('attribute'));
        assert.ok(nodeTypes.includes('table'));
        assert.ok(nodeTypes.includes('callee'));

        assert.ok(Array.isArray(model.workspaceSymbols));
        assert.strictEqual(model.workspaceSymbols.length, 2);
    });

    test('stripComments strips line and block comments without breaking code alignment', () => {
        const code = `
            // This is a comment from status_t
            status = status_t; /* block comment from other_t */
            rs = bmql("SELECT x FROM table_1");
        `;
        const stripped = stripComments(code);
        assert.ok(!stripped.includes('// This is a comment'));
        assert.ok(!stripped.includes('/* block comment'));
        assert.ok(stripped.includes('status = status_t;'));
        assert.ok(stripped.includes('rs = bmql("SELECT x FROM table_1");'));
    });

    test('inferLibraryPrefix correctly identifies commerce-libraries vs util-libraries', () => {
        assert.strictEqual(
            inferLibraryPrefix('/workspace/oraclecpqo/commerce-libraries/transactionStatus/transactionStatus.bml'),
            'commerce'
        );
        assert.strictEqual(
            inferLibraryPrefix('/workspace/util-libraries/util/atofsafe/atofsafe.bml'),
            'util'
        );
        assert.strictEqual(
            inferLibraryPrefix('/workspace/custom/foo.bml', { commerceProcess: 'oraclecpqo' }),
            'commerce'
        );
    });

    test('transactionStatus accurately extracts only status_t and status_l, with 0 false tables and 0 fake actions', () => {
        const filePath = '/workspace/oraclecpqo/commerce-libraries/transactionStatus/transactionStatus.bml';
        const content = `
            // transactionStatus
            // status_t is transaction status
            status = status_t;
            line_status = status_l;
            return status;
        `;
        const model = generateDependencyModel(filePath, [{ filePath, content }], content);

        // Focal node
        assert.strictEqual(model.target.name, 'transactionStatus');
        assert.strictEqual(model.target.qualifiedName, 'commerce.transactionstatus');

        // Data Tables must be 0 (no false positive from comment "from status_t")
        assert.strictEqual(model.outgoing.dataTables.length, 0);

        // Actions must be 0 (no fake "transaction Action" fabricated)
        assert.strictEqual(model.outgoing.actions.length, 0);

        // Attributes must be status_t (transaction) and status_l (line)
        const attrNames = model.outgoing.attributes.map(a => a.name);
        assert.ok(attrNames.includes('status_t'));
        assert.ok(attrNames.includes('status_l'));
        assert.strictEqual(model.outgoing.attributes.length, 2);
    });

    test('buildWorkspaceEntityIndex accurately indexes attributes, data tables, and libraries', () => {
        const fileStatus = {
            filePath: '/workspace/oraclecpqo/commerce-libraries/transactionStatus/transactionStatus.bml',
            content: `
                // transactionStatus
                status = status_t;
                line_status = status_l;
                return status;
            `
        };
        const fileWs = {
            filePath: '/workspace/oraclecpqo/commerce-libraries/invokeWebService/invokeWebService.bml',
            content: 'rs = bmql("SELECT username, endpoint FROM INT_SYSTEM_DETAILS WHERE active = 1");'
        };
        const index = buildWorkspaceEntityIndex([fileStatus, fileWs]);

        assert.ok(index.attributeIndex.has('status_t'));
        assert.ok(index.attributeIndex.has('status_l'));
        assert.ok(index.tableIndex.has('int_system_details'));
        assert.ok(index.libraryIndex.has('commerce.transactionstatus'));
        assert.ok(index.libraryIndex.has('commerce.invokewebservice'));

        // Verify canonical schema details
        const statusEntry = index.attributeIndex.get('status_t')[0];
        assert.strictEqual(statusEntry.category, 'Commerce');
        assert.strictEqual(statusEntry.resourceType, 'Attribute');
        assert.ok(statusEntry.hierarchyLabel.includes('status_t'));
    });

    test('searchWorkspaceEntities categorizes attributes, tables, actions, and libraries', () => {
        const fileStatus = {
            filePath: '/workspace/oraclecpqo/commerce-libraries/transactionStatus/transactionStatus.bml',
            content: `
                // transactionStatus
                status = status_t;
                line_status = status_l;
                return status;
            `
        };
        const fileWs = {
            filePath: '/workspace/oraclecpqo/commerce-libraries/invokeWebService/invokeWebService.bml',
            content: 'rs = bmql("SELECT username, endpoint FROM INT_SYSTEM_DETAILS WHERE active = 1");'
        };
        const index = buildWorkspaceEntityIndex([fileStatus, fileWs]);

        const statusResults = searchWorkspaceEntities(index, 'status');
        const types = statusResults.map(r => r.entityType);
        assert.ok(types.includes('attribute'));
        assert.ok(types.includes('library'));

        const tableResults = searchWorkspaceEntities(index, 'int_system');
        assert.strictEqual(tableResults[0].entityType, 'table');
        assert.strictEqual(tableResults[0].name, 'INT_SYSTEM_DETAILS');
    });

    test('generateBottomUpModel generates multi-hop graph for attribute and data table', () => {
        const fileStatus = {
            filePath: '/workspace/oraclecpqo/commerce-libraries/transactionStatus/transactionStatus.bml',
            content: `
                // transactionStatus
                status = status_t;
                line_status = status_l;
                return status;
            `
        };
        const fileWs = {
            filePath: '/workspace/oraclecpqo/commerce-libraries/invokeWebService/invokeWebService.bml',
            content: 'rs = bmql("SELECT username, endpoint FROM INT_SYSTEM_DETAILS WHERE active = 1");'
        };
        const files = [fileStatus, fileWs];

        // 1. Bottom-up model for attribute status_t
        const attrModel = generateBottomUpModel('attribute', 'status_t', files);
        assert.strictEqual(attrModel.target.name, 'status_t');
        assert.strictEqual(attrModel.target.entityType, 'attribute');
        assert.strictEqual(attrModel.graph.nodes[0].id, 'entity_attr_status_t');

        // Touching script should be transactionStatus
        const scriptNode = attrModel.graph.nodes.find(n => n.id === 'script_commerce.transactionstatus');
        assert.ok(scriptNode);
        assert.strictEqual(scriptNode.label, 'transactionStatus');

        // Edge should be 'reads'
        const edge = attrModel.graph.edges.find(e => e.source === 'entity_attr_status_t' && e.target === 'script_commerce.transactionstatus');
        assert.ok(edge);
        assert.strictEqual(edge.label, 'reads');

        // 2. Bottom-up model for data table INT_SYSTEM_DETAILS
        const tableModel = generateBottomUpModel('table', 'INT_SYSTEM_DETAILS', files);
        assert.strictEqual(tableModel.target.name, 'INT_SYSTEM_DETAILS');
        assert.strictEqual(tableModel.target.entityType, 'table');
        const wsScriptNode = tableModel.graph.nodes.find(n => n.id === 'script_commerce.invokewebservice');
        assert.ok(wsScriptNode);

        // 3. Bottom-up model for Array Set
        const arraySetModel = generateBottomUpModel('arraySet', '_chargeSet', files);
        assert.strictEqual(arraySetModel.target.name, '_chargeSet');
        assert.strictEqual(arraySetModel.target.entityType, 'arraySet');
        assert.strictEqual(arraySetModel.graph.nodes[0].id, 'entity_arrayset__chargeset');
        assert.strictEqual(arraySetModel.graph.nodes[0].resourceType, 'Array Set');
    });
});

