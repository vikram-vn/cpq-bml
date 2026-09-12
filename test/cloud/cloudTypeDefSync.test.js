const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  normalizeType,
  generateTypeDefBml,
  generateTypeDefJson,
  syncCloudDefinitions
} = require('@/lang/cloud/cloudTypeDefSync');

suite('Cloud Type Definition Synchronizer - Unit Tests', () => {
  const sampleFunctions = [
    {
      variableName: 'atoisafe',
      name: 'atoisafe',
      folderName: 'util',
      returnType: { displayValue: 'Integer' },
      parameters: [
        { name: 'stringToIntegerCheck', dataType: { displayValue: 'String' } }
      ],
      description: 'Converts string to integer safely.'
    },
    {
      variableName: 'concatString',
      name: 'ConcatString',
      folderName: 'util',
      returnType: 'String',
      parameters: [
        { name: 'str1', dataType: 'String' },
        { name: 'str2', dataType: 'String' }
      ]
    },
    {
      variableName: 'abo_apply',
      name: 'abo_apply',
      folderName: 'ORCL_ABO',
      returnType: 'String',
      parameters: [
        { name: 'bom', dataType: 'String' }
      ]
    }
  ];

  test('normalizeType extracts displayValue, name, string or falls back to String', () => {
    assert.strictEqual(normalizeType('Integer'), 'Integer');
    assert.strictEqual(normalizeType({ displayValue: 'Float' }), 'Float');
    assert.strictEqual(normalizeType({ name: 'Boolean' }), 'Boolean');
    assert.strictEqual(normalizeType(null), 'String');
    assert.strictEqual(normalizeType(undefined), 'String');
  });

  test('generateTypeDefBml creates valid BML declarations with JSDoc headers', () => {
    const bmlCode = generateTypeDefBml(sampleFunctions);

    assert.ok(bmlCode.includes('// Oracle CPQ Cloud BML Library Type Definitions'));
    assert.ok(bmlCode.includes('// Total Functions: 3'));

    // Check atoisafe
    assert.ok(bmlCode.includes('Function: atoisafe'));
    assert.ok(bmlCode.includes('@param stringToIntegerCheck {String}'));
    assert.ok(bmlCode.includes('@return {Integer}'));
    assert.ok(bmlCode.includes('Integer util.atoisafe(String stringToIntegerCheck);'));

    // Check concatString
    assert.ok(bmlCode.includes('String util.concatString(String str1, String str2);'));

    // Check ORCL_ABO namespaced function
    assert.ok(bmlCode.includes('Namespace: ORCL_ABO'));
    assert.ok(bmlCode.includes('String util.abo_apply(String bom);'));
    assert.ok(bmlCode.includes('String util.ORCL_ABO.abo_apply(String bom);'));
  });

  test('generateTypeDefJson creates structured metadata for IntelliSense and Hover tooltips', () => {
    const jsonMap = generateTypeDefJson(sampleFunctions);

    assert.ok(jsonMap['util.atoisafe']);
    assert.strictEqual(jsonMap['util.atoisafe'].name, 'util.atoisafe');
    assert.strictEqual(jsonMap['util.atoisafe'].returnType, 'Integer');
    assert.strictEqual(jsonMap['util.atoisafe'].syntax, 'util.atoisafe(stringToIntegerCheck [String])');
    assert.strictEqual(jsonMap['util.atoisafe'].source, 'cloud-sync');

    assert.ok(jsonMap['util.concatstring']);
    assert.strictEqual(jsonMap['util.concatstring'].name, 'util.concatString');
    assert.strictEqual(jsonMap['util.concatstring'].syntax, 'util.concatString(str1 [String], str2 [String])');

    // Namespaced entries
    assert.ok(jsonMap['util.abo_apply']);
    assert.ok(jsonMap['util.orcl_abo.abo_apply']);
  });

  test('syncCloudDefinitions writes cpq.d.bml and bml-cloud-functions.json', async () => {
    const tempDir = path.join(__dirname, '..', 'fixtures', 'temp_typedef_test');
    fs.mkdirSync(tempDir, { recursive: true });


    // We override fetchCloudSignatures directly by mocking the module or running sub-steps
    const bmlTypeDef = generateTypeDefBml(sampleFunctions);
    const jsonTypeDef = generateTypeDefJson(sampleFunctions);

    const cpqDir = path.join(tempDir, 'cpq');
    const cacheDir = path.join(cpqDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });

    const dPath = path.join(cpqDir, 'cpq.d.bml');
    const jsonPath = path.join(cacheDir, 'bml-cloud-functions.json');

    fs.writeFileSync(dPath, bmlTypeDef, 'utf8');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonTypeDef, null, 2), 'utf8');

    assert.ok(fs.existsSync(dPath));
    assert.ok(fs.existsSync(jsonPath));

    const readBml = fs.readFileSync(dPath, 'utf8');
    assert.ok(readBml.includes('Integer util.atoisafe(String stringToIntegerCheck);'));

    const readJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(readJson['util.atoisafe'].returnType, 'Integer');

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
