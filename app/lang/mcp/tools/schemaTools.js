/**
 * MCP Schema Tools
 * Exposes dynamic workspace schema and attribute introspection to AI agents.
 * Strictly maintains under 500 lines of code.
 */

const { SchemaIntrospector } = require("../../intellisense/schemaIntrospector");

const introspectCpqSchemaTool = {
  name: "introspect_cpq_schema",
  description: "Introspects active CPQ schema, returning Commerce Header attributes, Line Item attributes, and Data Tables.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    const schema = SchemaIntrospector.getCachedAttributes();
    return {
      content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
    };
  },
};

module.exports = {
  introspectCpqSchemaTool,
};
