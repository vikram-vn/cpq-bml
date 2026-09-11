const assert = require('assert');
const { createConfigExplorer, registerConfigExplorer } = require('@/lang/cloud/cloudConfigExplorer');
const api = require('@/lang/rest/api');
const { createCloudMockVscode } = require('./cloudTestMocks');

suite('CPQ Configuration Explorer - Unit Tests', () => {
  let origListGlobalAttrs, origListFamilies, origListFamilyAttrs, origListFamilyRules;
  let origListLines, origListLineAttrs, origListLineRules, origListModels, origListModelAttrs, origListBomRules, origListModelRules;

  setup(() => {
    origListGlobalAttrs = api.listConfigurationAttributes;
    origListFamilies = api.listProductFamilies;
    origListFamilyAttrs = api.listProductFamilyAttributes;
    origListFamilyRules = api.listProductFamilyRules;
    origListLines = api.listProductLines;
    origListLineAttrs = api.listProductLineAttributes;
    origListLineRules = api.listProductLineRules;
    origListModels = api.listModels;
    origListModelAttrs = api.listModelAttributes;
    origListBomRules = api.listModelBomMappingRules;
    origListModelRules = api.listModelRules;

    api.listConfigurationAttributes = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: '_config_currency', label: 'User Currency', dataType: 'String' }
          ]
        }
      };
    };

    api.listProductFamilies = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'telecom_family', label: 'Telecom Products', name: 'telecom_family' },
            { variableName: 'hardware_family', label: 'Hardware Products', name: 'hardware_family' }
          ]
        }
      };
    };

    api.listProductFamilyAttributes = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'networkType', label: 'Network Type', dataType: 'String' }
          ]
        }
      };
    };

    api.listProductFamilyRules = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'famCompatibilityRule', name: 'Family Compatibility Rule', ruleType: 'Validation' }
          ]
        }
      };
    };

    api.listProductLines = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'broadband_line', label: 'Broadband Line', name: 'broadband_line' }
          ]
        }
      };
    };

    api.listProductLineAttributes = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'connection_speed', label: 'Connection Speed', dataType: 'String' }
          ]
        }
      };
    };

    api.listProductLineRules = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'lineConstraintRule', name: 'Line Constraint Rule', ruleType: 'Constraint' }
          ]
        }
      };
    };

    api.listModels = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'router_x1', label: 'Router X1 Enterprise', name: 'router_x1' },
            { variableName: 'modem_v2', label: 'Modem V2', name: 'modem_v2' }
          ]
        }
      };
    };

    api.listModelAttributes = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'bandwidth_mbps', label: 'Bandwidth (Mbps)', dataType: 'Integer' }
          ]
        }
      };
    };

    api.listModelBomMappingRules = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'bom_router_parts', label: 'Router Parts BOM Rule', bomVariableName: 'routerBOM', ruleType: { displayValue: 'BOM' } }
          ]
        }
      };
    };

    api.listModelRules = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'modelPricingRule', name: 'Model Pricing Recommendation', ruleType: 'Recommendation' }
          ]
        }
      };
    };
  });

  teardown(() => {
    api.listConfigurationAttributes = origListGlobalAttrs;
    api.listProductFamilies = origListFamilies;
    api.listProductFamilyAttributes = origListFamilyAttrs;
    api.listProductFamilyRules = origListFamilyRules;
    api.listProductLines = origListLines;
    api.listProductLineAttributes = origListLineAttrs;
    api.listProductLineRules = origListLineRules;
    api.listModels = origListModels;
    api.listModelAttributes = origListModelAttrs;
    api.listModelBomMappingRules = origListBomRules;
    api.listModelRules = origListModelRules;
  });

  test('createConfigExplorer builds complete Swagger product family, line, model, attribute, and rule hierarchy', async () => {
    const mockVscode = createCloudMockVscode({
      workspace: {
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://test.bigmachines.com' : ''
        })
      }
    });

    const explorer = createConfigExplorer(mockVscode, {});

    // Root level: Global Attributes + Product Families
    const rootItems = await explorer.getChildren();
    assert.strictEqual(rootItems.length, 3);
    assert.strictEqual(rootItems[0].type, 'globalAttributesFolder');
    assert.strictEqual(rootItems[1].type, 'productFamily');
    assert.strictEqual(rootItems[1].familyVarName, 'telecom_family');

    // Inspect Global Attributes
    const globalAttrs = await explorer.getChildren(rootItems[0]);
    assert.strictEqual(globalAttrs.length, 1);
    assert.strictEqual(globalAttrs[0].data.variableName, '_config_currency');
    const globalAttrItem = explorer.getTreeItem(globalAttrs[0]);
    assert.strictEqual(globalAttrItem.label, '_config_currency');

    const famItem = explorer.getTreeItem(rootItems[1]);
    assert.strictEqual(famItem.label, 'Telecom Products');
    assert.strictEqual(famItem.description, 'telecom_family');

    // Under Product Family: Attributes, Rules, Product Lines
    const familyFolders = await explorer.getChildren(rootItems[1]);
    assert.strictEqual(familyFolders.length, 3);
    assert.strictEqual(familyFolders[0].type, 'familyAttributesFolder');
    assert.strictEqual(familyFolders[1].type, 'familyRulesFolder');
    assert.strictEqual(familyFolders[2].type, 'productLinesFolder');

    // Inspect Family Attributes
    const famAttrs = await explorer.getChildren(familyFolders[0]);
    assert.strictEqual(famAttrs.length, 1);
    assert.strictEqual(famAttrs[0].data.variableName, 'networkType');
    const famAttrItem = explorer.getTreeItem(famAttrs[0]);
    assert.strictEqual(famAttrItem.label, 'networkType');

    // Inspect Family Rules
    const famRules = await explorer.getChildren(familyFolders[1]);
    assert.strictEqual(famRules.length, 1);
    assert.strictEqual(famRules[0].data.name, 'Family Compatibility Rule');
    const famRuleItem = explorer.getTreeItem(famRules[0]);
    assert.strictEqual(famRuleItem.label, 'Family Compatibility Rule');
    assert.ok(famRuleItem.description.includes('[Validation]'));

    // Inspect Product Lines under Family
    const lines = await explorer.getChildren(familyFolders[2]);
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].type, 'productLine');
    assert.strictEqual(lines[0].lineVarName, 'broadband_line');

    const lineItem = explorer.getTreeItem(lines[0]);
    assert.strictEqual(lineItem.label, 'Broadband Line');

    // Under Product Line: Attributes, Rules, Models
    const lineFolders = await explorer.getChildren(lines[0]);
    assert.strictEqual(lineFolders.length, 3);
    assert.strictEqual(lineFolders[0].type, 'lineAttributesFolder');
    assert.strictEqual(lineFolders[1].type, 'lineRulesFolder');
    assert.strictEqual(lineFolders[2].type, 'modelsFolder');

    // Inspect Line Attributes
    const lineAttrs = await explorer.getChildren(lineFolders[0]);
    assert.strictEqual(lineAttrs.length, 1);
    assert.strictEqual(lineAttrs[0].data.variableName, 'connection_speed');
    const lineAttrItem = explorer.getTreeItem(lineAttrs[0]);
    assert.strictEqual(lineAttrItem.label, 'connection_speed');

    // Inspect Line Rules
    const lineRules = await explorer.getChildren(lineFolders[1]);
    assert.strictEqual(lineRules.length, 1);
    assert.strictEqual(lineRules[0].data.name, 'Line Constraint Rule');
    const lineRuleItem = explorer.getTreeItem(lineRules[0]);
    assert.strictEqual(lineRuleItem.label, 'Line Constraint Rule');
    assert.ok(lineRuleItem.description.includes('[Constraint]'));

    // Inspect Models under Product Line
    const models = await explorer.getChildren(lineFolders[2]);
    assert.strictEqual(models.length, 2);
    assert.strictEqual(models[0].type, 'model');
    assert.strictEqual(models[0].modelVarName, 'router_x1');
    assert.strictEqual(models[1].type, 'model');
    assert.strictEqual(models[1].modelVarName, 'modem_v2');

    const modelItem = explorer.getTreeItem(models[0]);
    assert.strictEqual(modelItem.label, 'Router X1 Enterprise');

    // Under Model: Attributes, BOM Rules, Rules
    const modelFolders = await explorer.getChildren(models[0]);
    assert.strictEqual(modelFolders.length, 3);
    assert.strictEqual(modelFolders[0].type, 'modelAttributesFolder');
    assert.strictEqual(modelFolders[1].type, 'modelBomRulesFolder');
    assert.strictEqual(modelFolders[2].type, 'modelRulesFolder');

    // Model Attributes
    const modelAttrs = await explorer.getChildren(modelFolders[0]);
    assert.strictEqual(modelAttrs.length, 1);
    assert.strictEqual(modelAttrs[0].data.variableName, 'bandwidth_mbps');
    const modelAttrItem = explorer.getTreeItem(modelAttrs[0]);
    assert.strictEqual(modelAttrItem.label, 'bandwidth_mbps');
    assert.strictEqual(modelAttrItem.description, '(Integer)');

    // Model BOM Mapping Rules
    const modelBomRules = await explorer.getChildren(modelFolders[1]);
    assert.strictEqual(modelBomRules.length, 1);
    assert.strictEqual(modelBomRules[0].data.variableName, 'bom_router_parts');
    const bomRuleItem = explorer.getTreeItem(modelBomRules[0]);
    assert.strictEqual(bomRuleItem.label, 'Router Parts BOM Rule');
    assert.ok(bomRuleItem.description.includes('[BOM]'));
    assert.ok(bomRuleItem.tooltip.includes('Target BOM: routerBOM'));

    // Model Rules
    const modelRules = await explorer.getChildren(modelFolders[2]);
    assert.strictEqual(modelRules.length, 1);
    assert.strictEqual(modelRules[0].data.name, 'Model Pricing Recommendation');
    const modelRuleItem = explorer.getTreeItem(modelRules[0]);
    assert.strictEqual(modelRuleItem.label, 'Model Pricing Recommendation');
    assert.ok(modelRuleItem.description.includes('[Recommendation]'));
  });

  test('registerConfigExplorer registers tree data provider and refresh command', () => {
    const mockContext = { subscriptions: [] };
    const mockVscode = createCloudMockVscode();

    const registered = registerConfigExplorer(mockContext, mockVscode);
    assert.ok(registered.treeDataProvider);
    assert.ok(registered.treeView);
    assert.strictEqual(mockContext.subscriptions.length, 2);
  });
});
