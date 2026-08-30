const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Regression guard for a real bug: index.js (completion/hover data),
// systemVariables.js, and metadataTypes.js all used to read
// app/lang/intellisense/*.json directly with fs.readFileSync, bypassing
// apiDataLoader.js entirely. That worked fine in dev/tests, where both the
// pretty .json and generated .min.json sit side by side on disk - but
// .vscodeignore excludes the pretty .json from the packaged .vsix (only
// .min.json ships), so the real installed extension silently loaded {} for
// every category: no autocompletion, no hover, no system variable
// recognition. Only a scenario where the pretty .json is genuinely absent
// (as it is once packaged) reproduces the failure - every other test in this
// repo runs against the full source tree where both files exist.
function withTempDir(fn) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bml-apiDataLoader-test-'));
    try {
        return fn(tmpDir);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function writeTree(tmpDir, files) {
    const dir = path.join(tmpDir, 'app', 'lang', 'intellisense');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), content);
    }
}

suite('apiDataLoader', () => {
    // Each test needs its own baseName - loadJson() caches by baseName for the
    // process lifetime, so a shared name across tests would just return the
    // first test's cached result.
    let counter = 0;
    function freshBaseName() {
        return `test_fixture_${counter++}`;
    }

    function loadFresh() {
        delete require.cache[require.resolve('../../app/lang/intellisense/apiDataLoader')];
        return require('../../app/lang/intellisense/apiDataLoader');
    }

    test('loads correctly from only a .min.json file (the real packaged/.vsix scenario)', () => {
        withTempDir((tmpDir) => {
            const baseName = freshBaseName();
            const payload = { atof: { syntax: 'atof(str)' } };
            writeTree(tmpDir, { [`${baseName}.min.json`]: JSON.stringify(payload) });

            const { loadJson } = loadFresh();
            const data = loadJson(baseName, tmpDir);
            assert.deepStrictEqual(data, payload);
        });
    });

    test('falls back to the pretty .json file when no .min.json is present (dev/test runs without a build step)', () => {
        withTempDir((tmpDir) => {
            const baseName = freshBaseName();
            const payload = { _user_name: { dataType: 'String' } };
            writeTree(tmpDir, { [`${baseName}.json`]: JSON.stringify(payload) });

            const { loadJson } = loadFresh();
            const data = loadJson(baseName, tmpDir);
            assert.deepStrictEqual(data, payload);
        });
    });

    test('prefers .min.json over a stale pretty .json when both are present', () => {
        withTempDir((tmpDir) => {
            const baseName = freshBaseName();
            const fresh = { fnName: { syntax: 'fresh' } };
            const stale = { fnName: { syntax: 'stale' } };
            writeTree(tmpDir, {
                [`${baseName}.min.json`]: JSON.stringify(fresh),
                [`${baseName}.json`]: JSON.stringify(stale),
            });

            const { loadJson } = loadFresh();
            const data = loadJson(baseName, tmpDir);
            assert.deepStrictEqual(data, fresh);
        });
    });

    test('returns an empty object (not a throw) when neither file exists', () => {
        withTempDir((tmpDir) => {
            const baseName = freshBaseName();
            writeTree(tmpDir, {});

            const { loadJson } = loadFresh();
            const data = loadJson(baseName, tmpDir);
            assert.deepStrictEqual(data, {});
        });
    });

    test('invalidateCache() forces the next loadJson() call to re-read from disk', () => {
        withTempDir((tmpDir) => {
            const baseName = freshBaseName();
            const first = { v: 1 };
            const second = { v: 2 };
            writeTree(tmpDir, { [`${baseName}.json`]: JSON.stringify(first) });

            const apiDataLoader = loadFresh();
            assert.deepStrictEqual(apiDataLoader.loadJson(baseName, tmpDir), first);

            writeTree(tmpDir, { [`${baseName}.json`]: JSON.stringify(second) });
            // Without invalidation the cached `first` value would still be returned.
            assert.deepStrictEqual(apiDataLoader.loadJson(baseName, tmpDir), first);

            apiDataLoader.invalidateCache();
            assert.deepStrictEqual(apiDataLoader.loadJson(baseName, tmpDir), second);
        });
    });

    test('named loaders retrieve real JSON catalogs correctly', () => {
        const {
            loadBuiltInFunctionsJson,
            loadBuiltInAttributesJson,
            loadCpqJsApiJson,
            loadUtilAttributesJson,
            loadVariablesJson,
            loadCustomSnippetsJson,
            loadFunctionParamDataTypesJson,
            loadFunctionReturnTypesJson,
            loadBestPracticeAdvisoriesJson,
            loadKeywordHoversJson,
            loadCategoryLabelsJson,
            loadCuratedParamsJson
        } = loadFresh();

        const funcs = loadBuiltInFunctionsJson();
        assert.ok(funcs && typeof funcs === 'object' && funcs.atof);

        const attrs = loadBuiltInAttributesJson();
        assert.ok(attrs && typeof attrs === 'object');

        const cpqjs = loadCpqJsApiJson();
        assert.ok(cpqjs && typeof cpqjs === 'object' && cpqjs['CPQJS.actionExists']);

        const utilAttrs = loadUtilAttributesJson();
        assert.ok(utilAttrs && typeof utilAttrs === 'object');

        const vars = loadVariablesJson();
        assert.ok(vars && typeof vars === 'object' && vars._user_name);

        const snippets = loadCustomSnippetsJson();
        assert.ok(snippets && typeof snippets === 'object' && snippets.if);

        const paramTypes = loadFunctionParamDataTypesJson();
        assert.ok(paramTypes && typeof paramTypes === 'object');

        const returnTypes = loadFunctionReturnTypesJson();
        assert.ok(returnTypes && typeof returnTypes === 'object');

        const advisories = loadBestPracticeAdvisoriesJson();
        assert.ok(advisories && typeof advisories === 'object' && advisories.bmql);

        const keywordHovers = loadKeywordHoversJson();
        assert.ok(keywordHovers && typeof keywordHovers === 'object' && keywordHovers.if);

        const categories = loadCategoryLabelsJson();
        assert.ok(categories && typeof categories === 'object' && categories.categories);

        const curatedParams = loadCuratedParamsJson();
        assert.ok(curatedParams && typeof curatedParams === 'object' && curatedParams.put);
        assert.deepStrictEqual(curatedParams.put, ['dictionaryIdentifier', 'key', 'value']);
    });
});
