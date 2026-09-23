'use strict';

const z = require('zod');
const { jsonResult } = require('@/lang/mcp/jsonResult');

function register(server, context, vscode, tools) {
    server.registerTool(
        'get_commerce_document_modify_tab',
        {
            description:
                'Retrieve the Commerce Document Modify Tab options via Oracle CPQ REST API (GET /rest/v19/commerceProcessSetups/{process}/documents/{document}/modifyTab). ' +
                'Returns attribute modify configurations, formulaPresent flags, and overrideModify states.',
            inputSchema: {
                commerceProcess: z.string().optional().describe('Commerce process variable name (defaults to configured process, e.g. oraclecpqo).'),
                commerceDocument: z.string().optional().describe('Commerce document variable name (defaults to configured document, e.g. transaction).'),
            },
        },
        async (args) => jsonResult(await tools.getCommerceDocumentModifyTab(context, vscode, args)),
    );

    server.registerTool(
        'update_commerce_document_modify_tab',
        {
            description:
                'Update Commerce Document Modify Tab options via Oracle CPQ REST API (PATCH /rest/v19/commerceProcessSetups/{process}/documents/{document}/modifyTab). ' +
                'Configures which attributes have overrideModify or useFormula enabled on the document.',
            inputSchema: {
                items: z.array(z.object({
                    attributeVarName: z.string().describe('Attribute variable name.'),
                    useFormula: z.boolean().optional().describe('Enable or disable formula execution for this attribute.'),
                    overrideModify: z.boolean().optional().describe('Override standard modify behavior.'),
                    attributeId: z.number().int().optional().describe('Optional attribute ID.'),
                })).min(1).describe('Array of attribute modify tab updates.'),
                commerceProcess: z.string().optional().describe('Commerce process variable name.'),
                commerceDocument: z.string().optional().describe('Commerce document variable name.'),
            },
        },
        async (args) => jsonResult(await tools.updateCommerceDocumentModifyTab(context, vscode, args)),
    );

    server.registerTool(
        'pull_commerce_action_scripts',
        {
            description:
                'Extract and pull all BML scripts from a Commerce Action: Before Formulas (before-formulas), ' +
                'After Formulas (after-formulas), and Action Scripts (modify). Writes them locally as editable .bml files with metadata sidecars.',
            inputSchema: {
                actionVariableName: z.string().describe('Commerce action variable name (e.g. cleanSave_t, modify_t).'),
                commerceProcess: z.string().optional().describe('Commerce process variable name.'),
                commerceDocument: z.string().optional().describe('Commerce document variable name.'),
            },
        },
        async (args) => jsonResult(await tools.pullCommerceActionScripts(context, vscode, args)),
    );

    server.registerTool(
        'debug_commerce_action_script',
        {
            description:
                'Debug an action\'s Before Formulas, After Formulas, or Action Script against a live CPQ transaction/quote. ' +
                'Executes on the server, returning debug prints, execution logs, and simulated attribute updates.',
            inputSchema: {
                actionVariableName: z.string().describe('Commerce action variable name.'),
                transactionId: z.union([z.string(), z.number()]).describe('Transaction ID or _id to execute the action debug against.'),
                scriptType: z.enum(['before-formulas', 'after-formulas', 'modify']).optional().default('before-formulas').describe('Which action script to debug.'),
                commerceProcess: z.string().optional().describe('Commerce process variable name.'),
                commerceDocument: z.string().optional().describe('Commerce document variable name.'),
            },
        },
        async (args) => jsonResult(await tools.debugCommerceActionScript(context, vscode, args)),
    );

    server.registerTool(
        'pull_commerce_attribute_formula',
        {
            description:
                'Extract and pull an attribute\'s Default Tab formula (default) or Modify Tab formula (modify) into a local .bml file with sidecar metadata for editing and debugging.',
            inputSchema: {
                attributeVariableName: z.string().describe('Commerce attribute variable name.'),
                formulaType: z.enum(['default', 'modify']).optional().default('default').describe('Formula type: "default" for Default Tab formula, "modify" for Modify Tab formula.'),
                commerceProcess: z.string().optional().describe('Commerce process variable name.'),
                commerceDocument: z.string().optional().describe('Commerce document variable name.'),
            },
        },
        async (args) => jsonResult(await tools.pullCommerceAttributeFormula(context, vscode, args)),
    );

    server.registerTool(
        'debug_commerce_attribute_formula',
        {
            description:
                'Debug an attribute\'s Default Tab or Modify Tab formula against a live CPQ transaction ID. ' +
                'Returns debug print statements, evaluated formula return value, and attribute context.',
            inputSchema: {
                attributeVariableName: z.string().describe('Commerce attribute variable name.'),
                transactionId: z.union([z.string(), z.number()]).describe('Transaction ID or _id to execute debug against.'),
                formulaType: z.enum(['default', 'modify']).optional().default('default').describe('Formula type: "default" or "modify".'),
                commerceProcess: z.string().optional().describe('Commerce process variable name.'),
                commerceDocument: z.string().optional().describe('Commerce document variable name.'),
            },
        },
        async (args) => jsonResult(await tools.debugCommerceAttributeFormula(context, vscode, args)),
    );
}

module.exports = {
    register,
};
