'use strict';

const z = require('zod');
const { jsonResult } = require('@/lang/mcp/jsonResult');

function register(server, toolsOrContext, maybeVscode, maybeTools) {
  const tools = maybeTools || toolsOrContext;

  server.registerTool(
    'list_migration_resources',
    {
      description:
        'List all 13 migration resource categories and their child items directly from Oracle CPQ (GET /rest/v19/migrationResources). ' +
        'Includes Util Libraries, Commerce processes, Data Tables, Configuration families, Documents, etc. Uses active configuration.',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('Optional filter by category code (e.g. UTIL_LIBRARY, COMMERCE, DATA_TABLE).'),
      },
    },
    async (args) => jsonResult(await tools.listMigrationResources(args))
  );

  server.registerTool(
    'list_migration_packages',
    {
      description:
        'List all migration packages defined on the target Oracle CPQ instance (GET /rest/v19/migrationPackages). Uses active configuration.',
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional().default(100).describe('Max results to return.'),
        offset: z.number().int().min(0).optional().default(0).describe('Pagination offset.'),
      },
    },
    async (args) => jsonResult(await tools.listMigrationPackages(args))
  );

  server.registerTool(
    'get_migration_package_contents',
    {
      description:
        'Retrieve the contents of a specific migration package from Oracle CPQ (GET /rest/v19/migrationPackages/{identifier}/contents).',
      inputSchema: {
        identifier: z.string().describe('The unique identifier of the migration package (e.g. cPQ_BUILD1_v1).'),
        category: z.string().optional().describe('Optional category filter within the package.'),
      },
    },
    async (args) => jsonResult(await tools.getMigrationPackageContents(args))
  );

  server.registerTool(
    'sync_migration_structure',
    {
      description:
        'Introspects CPQ Migration resources via REST and generates the matching user space folder structure under /cpq/<siteName>/ ' +
        'with zero hardcoding, pulling credentials and base URL directly from active configuration.',
      inputSchema: {},
    },
    async (args) => jsonResult(await tools.syncMigrationStructure(args))
  );
}

module.exports = { register };
