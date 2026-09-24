'use strict';

const z = require('zod');
const { jsonResult } = require('@/lang/mcp/jsonResult');
const { introspectCpqSchemaTool } = require('@/lang/mcp/tools/schemaTools');

function register(server, context, vscode, tools) {
    server.registerTool(
        'get_cloud_explorer_overview',
        {
            description:
                'Get a unified overview snapshot of all 7 sections of the CPQ Cloud Explorer: ' +
                'Util Libraries, Commerce processes & documents, Configuration hierarchy, CPQ Data Tables, ' +
                'Recent Transactions/Quotes, Parts Site Catalog, and Deployment Center tasks. ' +
                'Enables full environmental awareness in a single query.',
            inputSchema: {
                section: z
                    .enum(['all', 'util', 'commerce', 'config', 'datatables', 'transactions', 'parts', 'deployment'])
                    .optional()
                    .default('all')
                    .describe('Optional section filter (default "all" for full overview).'),
            },
        },
        async (args) => jsonResult(await tools.getCloudExplorerOverview(args)),
    );

    server.registerTool(
        'list_commerce_processes',
        {
            description:
                'List all Commerce Processes in the Oracle CPQ instance (GET /rest/v19/commerceProcesses). ' +
                'Returns process variable names, labels, and document hierarchies (e.g. oraclecpqo).',
            inputSchema: {
                limit: z.number().int().min(1).max(500).optional().default(100).describe('Max results to return.'),
                offset: z.number().int().min(0).optional().default(0).describe('Pagination offset.'),
            },
        },
        async (args) => jsonResult(await tools.listCommerceProcesses(args)),
    );

    server.registerTool(
        'list_configuration_hierarchy',
        {
            description:
                'List the Configuration hierarchy (Product Families -> Product Lines -> Models) in Oracle CPQ. ' +
                'Useful for discovering configuration models, product family scopes, and model variable names for BML rules.',
            inputSchema: {
                productFamily: z
                    .string()
                    .optional()
                    .describe('Optional product family variable name to restrict inspection to a single family.'),
            },
        },
        async (args) => jsonResult(await tools.listConfigurationHierarchy(args)),
    );

    server.registerTool(
        'list_configuration_attributes',
        {
            description:
                'List Configuration Attributes at global, product family, or product line scope. ' +
                'Returns variable names, data types, descriptions, and dropdown menu options.',
            inputSchema: {
                productFamily: z.string().optional().describe('Product Family variable name.'),
                productLine: z.string().optional().describe('Product Line variable name (requires productFamily).'),
            },
        },
        async (args) => jsonResult(await tools.listConfigurationAttributes(args)),
    );

    server.registerTool(
        'list_deployment_tasks',
        {
            description:
                'List recent background migration, deployment, and admin tasks from the CPQ Deployment Center (GET /rest/v17/tasks). ' +
                'Returns status, percent completion, task category, and status messages.',
            inputSchema: {
                limit: z.number().int().min(1).max(100).optional().default(30).describe('Max tasks to return (default 30).'),
                offset: z.number().int().min(0).optional().default(0).describe('Pagination offset.'),
                orderby: z.string().optional().default('dateModified:desc').describe('Sort order, e.g. dateModified:desc.'),
                q: z.string().optional().describe('Optional query filter for task category or status.'),
            },
        },
        async (args) => jsonResult(await tools.listDeploymentTasks(args)),
    );

    server.registerTool(
        'get_transaction_data',
        {
            description:
                'Retrieve full data payload (header attributes, line items, arrays) for a specific CPQ Transaction/Quote by ID. ' +
                'Essential for quote data inspection and debugging commerce BML rules against real transactions.',
            inputSchema: {
                transactionId: z.union([z.string(), z.number()]).describe('Transaction ID or _id to inspect.'),
                commerceProcess: z.string().optional().describe('Commerce process name (defaults to configured process, e.g. oraclecpqo).'),
                commerceDocument: z.string().optional().describe('Commerce document name (defaults to configured document, e.g. transaction).'),
            },
        },
        async (args) => jsonResult(await tools.getTransactionData(args)),
    );

    server.registerTool(
        'introspect_cpq_schema',
        {
            description:
                'Introspects active CPQ schema, returning Commerce Header attributes, Line Item attributes, and Data Tables from workspace cache.',
            inputSchema: {},
        },
        async () => {
            return await introspectCpqSchemaTool.handler();
        },
    );
}

module.exports = {
    register,
};
