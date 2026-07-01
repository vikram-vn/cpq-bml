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

    test('Does not flag common short identifier abbreviations (attr, ctx, cfg, idx, subdoc)', () => {
        const diagnostics = lintText(`
            configAttrInfo = getconfigattrvalue(line, "attr_name");
            ctx = dict();
            cfg = config();
            idx = 0;
            subdocStatus = "in_subdoc";
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

    test('Does not flag a real BML "Function Name" docHeader comment block with camelCase identifiers', () => {
        // Regression test: docHeader blocks are a widespread convention in
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

    test('Does not flag common CPQ/integration abbreviations found across the real corpus', () => {
        // Confirmed via real bml/library usage before allowlisting (not guessed):
        // grp/txn/trx (transaction), yyyy (date format), xlsx (Excel export),
        // xmlns/xsd/xpath (XML/XSD), oauth (auth protocol), soapenv/faultstring
        // (SOAP), bigmachines/oraclecpqo (CPQ's own product/namespace names),
        // anytype (a real BML dict<anytype> type), sizeof (programming term),
        // reconfig/upfront (standard compound words).
        const diagnostics = lintText(`
            grp = "A"; txn = "B"; trx = "C"; yyyy = "D"; xlsx = "E";
            xmlns = "F"; oauth = "G"; adf = "H"; dtl = "I"; msgs = "J";
            hier = "K"; calcs = "L"; vals = "M"; proj = "N"; asc = "O";
            itr = "P"; func = "Q"; pn = "R"; xsd = "S"; xpath = "T";
            concat = "U"; nums = "V"; soapenv = "W"; faultstring = "X";
            reconfig = "Y"; sizeof = "Z"; upfront = "AA";
            bigmachines = "BigMachines"; oraclecpqo = "oraclecpqo";
            anyTypeDict = dict("anytype");
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Flags a genuine typo even when it appears inside a camelCase run in a comment', () => {
        // The docHeader camelCase-splitting fix must not become a loophole
        // that hides real typos buried inside a compound identifier mention.
        const diagnostics = lintText(`
            // Description : Computes the calclateTotal for the order
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.some(e => e.message.includes('calclate')), 'Should flag the misspelled "calclate" piece');
    });
});
