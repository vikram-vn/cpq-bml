const assert = require('assert');
const { lintText } = require('../linter/fixtures');

suite('BML Linter Test Suite - Custom Spellchecker - CPQ/BML domain vocabulary', () => {
    test('Does not flag BML control-flow keywords or built-in type names', () => {
        const diagnostics = lintText(`
            // if elif else for in break continue return
            x = dict();
            y = json();
            z = jsonarray();
            sb = stringbuilder();
            arr = bytearray();
            rs = recordset();
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag CPQ system variables split into their real-word parts', () => {
        const diagnostics = lintText(`
            userName = _user_name;
            siteUrl = _site_url;
            companyName = _company_name;
            currentDate = _current_date;
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag BM_* constants (treated as all-uppercase acronyms)', () => {
        const diagnostics = lintText(`
            status = BM_REASON_STATUS_APPROVED;
            val = BM_UNCHANGED_NUM;
            token = BM_PARTNER_SECURITY_TOKEN;
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag common short identifier abbreviations (attr, ctx, cfg, idx, subdoc, rollup)', () => {
        const diagnostics = lintText(`
            configAttrInfo = getconfigattrvalue(line, "attr_name");
            ctx = dict();
            cfg = config();
            idx = 0;
            subdocRollup = system_rollup_subdoc(transaction);
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag common compound tech words (username, timezone, configurator, metadata, ...)', () => {
        const diagnostics = lintText(`
            username = _user_name;
            timezone = _user_timezone;
            configurator = "ABO";
            metadata = json();
            hostname = "localhost";
            workflow = "approval";
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag a real BML "Function Name" doc-header comment block with camelCase identifiers', () => {
        // Regression test: doc-header blocks are a widespread convention in
        // real BML library code (e.g. bml/library/ORCL_ABO/abo_getOneAssetState)
        // and routinely name camelCase functions/parameters by bare name in
        // the comment text itself. Before the fix, the comment-checking path
        // never split a camelCase run the way identifier-checking already
        // did, so the whole compound name was checked (and flagged) as one
        // giant unrecognized "word".
        const diagnostics = lintText(`
            // Function Name : abo_getOneAssetState
            // Description : Retrieves the asset state for a given configBom
            // Inputs : configBom, assetKey
            // Return : Dictionary
            return dict();
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Flags a genuine typo even when it appears inside a camelCase run in a comment', () => {
        // The doc-header camelCase-splitting fix must not become a loophole
        // that hides real typos buried inside a compound identifier mention.
        const diagnostics = lintText(`
            // Description : Computes the calclateTotal for the order
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.some(e => e.message.includes('calclate')), 'Should flag the misspelled "calclate" piece');
    });
});
