const fs = require('fs');
const path = require('path');
const metadataLib = require('@/lang/rest/metadata');

function generateDefaultValueForType(type) {
  const t = (type || 'string').toLowerCase();
  if (t === 'integer' || t === 'int') return 10;
  if (t === 'float' || t === 'double') return 99.95;
  if (t === 'boolean' || t === 'bool') return true;
  if (t === 'string') return 'sample_input';
  if (t === 'date') return '2026-01-01';
  if (t.includes('[]') || t.includes('array')) return ['item1', 'item2'];
  if (t === 'dict' || t === 'dictionary') return { key1: 'value1' };
  if (t === 'json' || t === 'jsonobject') return { status: 'success' };
  return 'sample_value';
}

function generateZeroValueForType(type) {
  const t = (type || 'string').toLowerCase();
  if (t === 'integer' || t === 'int') return 0;
  if (t === 'float' || t === 'double') return 0.0;
  if (t === 'boolean' || t === 'bool') return false;
  if (t === 'string') return '';
  if (t === 'date') return '1970-01-01';
  if (t.includes('[]') || t.includes('array')) return [];
  if (t === 'dict' || t === 'dictionary') return {};
  if (t === 'json' || t === 'jsonobject') return {};
  return '';
}

/**
 * Automatically synthesizes a .bmltest.json fixture for the given BML function.
 */
function synthesizeTestFixture(filePath, metadata) {
  const funcName = metadata?.variableName || path.basename(filePath, path.extname(filePath));
  const params = metadata?.parameters || [];
  const returnType = metadata?.returnType || 'String';

  const validInputs = {};
  const boundaryInputs = {};
  const emptyInputs = {};

  for (const p of params) {
    const pName = p.name || p.variableName || 'param';
    const pType = p.type || p.dataType || 'String';
    validInputs[pName] = generateDefaultValueForType(pType);
    boundaryInputs[pName] = generateZeroValueForType(pType);
    emptyInputs[pName] = pType.toLowerCase().includes('string') ? '' : generateZeroValueForType(pType);
  }

  const expectedVal = generateDefaultValueForType(returnType);

  const fixture = {
    $schema: 'https://raw.githubusercontent.com/vikram-vn/cpq-bml/main/schemas/bmltest.schema.json',
    targetFunction: funcName,
    description: `Automated test suite for CPQ BML function: ${funcName}`,
    testCases: [
      {
        name: 'Happy Path - Valid Inputs',
        description: 'Verifies normal execution with standard inputs',
        inputs: validInputs,
        expectedReturn: expectedVal
      },
      {
        name: 'Boundary Case - Zero / Min Inputs',
        description: 'Verifies handling of zero, min, or default edge values',
        inputs: boundaryInputs
      },
      {
        name: 'Empty Values / Edge Case',
        description: 'Verifies behavior when inputs are blank or empty collections',
        inputs: emptyInputs
      }
    ]
  };

  return fixture;
}

async function generateUnitTestsCommand(vscodeInstance) {
  if (!vscodeInstance || !vscodeInstance.window) return;

  const editor = vscodeInstance.window.activeTextEditor;
  if (!editor || !editor.document.fileName.endsWith('.bml')) {
    vscodeInstance.window.showErrorMessage('CPQ-BML: Open a .bml file to generate unit tests.');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const metaPath = metadataLib.bmlPathToMetaPath(filePath);
  const metadata = metadataLib.readMetadata(metaPath) || {
    variableName: metadataLib.variableNameFromBmlPath(filePath)
  };

  const fixture = synthesizeTestFixture(filePath, metadata);
  const testFilePath = filePath.replace(/\.bml$/i, '.bmltest.json');

  if (fs.existsSync(testFilePath)) {
    const overwrite = await vscodeInstance.window.showWarningMessage(
      `Test fixture already exists: ${path.basename(testFilePath)}. Overwrite?`,
      'Overwrite',
      'Cancel'
    );
    if (overwrite !== 'Overwrite') return;
  }

  fs.writeFileSync(testFilePath, JSON.stringify(fixture, null, 2), 'utf8');

  vscodeInstance.window.showInformationMessage(
    `Generated test fixture: ${path.basename(testFilePath)} with 3 test cases.`
  );

  const doc = await vscodeInstance.workspace.openTextDocument(testFilePath);
  await vscodeInstance.window.showTextDocument(doc);
}

module.exports = {
  synthesizeTestFixture,
  generateUnitTestsCommand
};
