'use strict';

const assert = require('assert');
const {
    analyzeScriptContent,
    buildWorkspaceCallGraph,
    computeBlastRadius,
    generateDependencyModel,
    exportToMermaid
} = require('@/lang/graph/dependencyGraphAnalyzer');

suite('Dependency Graph & Blast Radius Analyzer', () => {

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
            outgoing: { functions: [], dataTables: [], externalApis: [] },
            graph: {
                nodes: [
                    { id: 'target_util_calc', label: 'calc', subtitle: 'util.calc', type: 'focal' },
                    { id: 'caller_action', label: 'action', subtitle: 'commerce.action', type: 'caller' }
                ],
                edges: [
                    { source: 'caller_action', target: 'target_util_calc', type: 'blast_radius', label: 'calls' }
                ]
            }
        };

        const mermaid = exportToMermaid(model);
        assert.ok(mermaid.startsWith('flowchart LR'));
        assert.ok(mermaid.includes('caller_action'));
        assert.ok(mermaid.includes('target_util_calc'));
        assert.ok(mermaid.includes('-->|"calls"|'));
    });
});
