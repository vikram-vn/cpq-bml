const lookup = require('@/lang/mcp/tools/lookup');
const lifecycle = require('@/lang/mcp/tools/lifecycle');
const knowledge = require('@/lang/mcp/tools/knowledge');
const reference = require('@/lang/mcp/tools/reference');
const status = require('@/lang/mcp/tools/status');
const testing = require('@/lang/mcp/tools/testing');
const formatting = require('@/lang/mcp/tools/formatting');
const audit = require('@/lang/mcp/tools/audit');
const bmqlValidator = require('@/lang/mcp/tools/bmqlValidator');
const testTools = require('@/lang/mcp/tools/testTools');
const schemaTools = require('@/lang/mcp/tools/schemaTools');
const commerceActionTools = require('@/lang/mcp/tools/commerceActionTools');

module.exports = {
    ...lookup,
    ...lifecycle,
    ...knowledge,
    ...reference,
    ...status,
    ...testing,
    ...formatting,
    ...audit,
    ...bmqlValidator,
    ...testTools,
    ...schemaTools,
    ...commerceActionTools,
};
