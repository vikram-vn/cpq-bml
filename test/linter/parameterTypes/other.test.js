const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - Other, Advanced, BOM, System Config & User Session Functions', () => {
    test('addpartstotransaction() expects String (p1) and Dictionary (p2), flags Integer (p1)', () => {
        const diags = lintText('res = addpartstotransaction(12345, dict("string")); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to addpartstotransaction() arg 1');
    });

    test('addtotransaction() expects String (p1) and Dictionary (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = addtotransaction(dt, dict("string")); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to addtotransaction() arg 1');
    });

    test('generatehmacmessage() expects String (p1, p2, p3), flags Float (p1)', () => {
        const diags = lintText('res = generatehmacmessage(12.3, "msg", "SHA-256"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to generatehmacmessage() arg 1');
    });

    test('getarraystr() expects Array (p1) and String (p2), flags non-array String (p1)', () => {
        const diags = lintText('res = getarraystr("not_array", ","); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type' || d.code === 'bml-function-arg-count');
        assert.ok(err, 'Should flag passing non-array String to getarraystr() arg 1');
    });

    test('getattachmentdata() expects String (p1 & p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = getattachmentdata(dt, "att"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to getattachmentdata() arg 1');
    });

    test('getconfigattrvalue() expects String (p1 & p2), flags Integer (p1)', () => {
        const diags = lintText('res = getconfigattrvalue(123, "attr"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to getconfigattrvalue() arg 1');
    });

    test('getoldvalue() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = getoldvalue(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to getoldvalue() arg 1');
    });

    test('getreasonstatus() expects String (p1 & p2), flags Float (p1)', () => {
        const diags = lintText('res = getreasonstatus(9.9, "reason"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to getreasonstatus() arg 1');
    });

    test('getuuid() expects Integer count (p1), flags String (p1)', () => {
        const diags = lintText('res = getuuid("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to getuuid() count');
    });

    test('importtransactiondata() expects String (p1 & p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = importtransactiondata(dt, "<xml/>"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to importtransactiondata() arg 1');
    });

    test('invoke() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = invoke(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to invoke() arg 1');
    });

    test('logtime() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); logtime(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to logtime() arg 1');
    });

    test('sbappend() expects StringBuilder (p1) and String (p2), flags String (p1)', () => {
        const diags = lintText('sbappend("not_sb", "text"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to sbappend() arg 1 expecting StringBuilder');
    });

    test('sbtostring() expects StringBuilder (p1), flags String (p1)', () => {
        const diags = lintText('res = sbtostring("not_sb"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to sbtostring() arg 1 expecting StringBuilder');
    });

    test('throwerror() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); throwerror(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to throwerror() arg 1');
    });

    test('validatequoteforagreement() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = validatequoteforagreement(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type' || d.code === 'bml-function-arg-count');
        assert.ok(err, 'Should flag passing Date to validatequoteforagreement() arg 1');
    });

    // BOM Mapping Function Tests
    test('applybom() expects String (p1) and Dictionary (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = applybom(dt, dict("string")); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to applybom() arg 1');
    });

    test('calculateconfiguration() expects Dictionary (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = calculateconfiguration(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to calculateconfiguration() arg 1');
    });

    test('calculatedeltabom() expects Dictionary (p1 & p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = calculatedeltabom(dt, dict("string")); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to calculatedeltabom() arg 1');
    });

    test('convertbomtoflat() expects Dictionary (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = convertbomtoflat(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to convertbomtoflat() arg 1');
    });

    test('convertbomtohier() expects Dictionary (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = convertbomtohier(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to convertbomtohier() arg 1');
    });

    test('getbom() expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = getbom(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to getbom() arg 1');
    });

    test('getconfigurationbom() expects String or Integer (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = getconfigurationbom(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to getconfigurationbom() arg 1');
    });

    test('savebom() expects String or Integer (p1) and Dictionary (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = savebom(dt, dict("string")); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to savebom() arg 1');
    });

    test('saveconfigbom() expects String (p1) and Dictionary (p2), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = saveconfigbom(dt, dict("string")); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to saveconfigbom() arg 1');
    });

    // System Configuration Function Tests
    test('getsystemdata() takes no arguments, flags unexpected argument count', () => {
        const diags = lintText('res = getsystemdata("invalid"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-count');
        assert.ok(err, 'Should flag passing argument to getsystemdata()');
    });

    test('getsystemattrvalues() expects String (p1), flags Integer (p1)', () => {
        const diags = lintText('res = getsystemattrvalues(12345); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to getsystemattrvalues() arg 1 expecting String jsonPath');
    });

    test('getsystemmultipleattrvalues() expects Dictionary (p1), flags String (p1)', () => {
        const diags = lintText('res = getsystemmultipleattrvalues("not_dict"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing String to getsystemmultipleattrvalues() arg 1 expecting Dictionary');
    });

    // User Session Function Tests
    test('usersessionget() expects String key (p1), flags Integer (p1)', () => {
        const diags = lintText('res = usersessionget(12345); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to usersessionget() arg 1 expecting String key');
    });

    test('usersessionremove() expects String key (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = usersessionremove(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to usersessionremove() arg 1 expecting String key');
    });

    test('usersessionset() expects String key (p1), flags Float (p1)', () => {
        const diags = lintText('res = usersessionset(12.3, "val"); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to usersessionset() arg 1 expecting String key');
    });

    test('Valid Other, BOM, System Config & User Session operations raise no false positives', () => {
        const diags = lintText(`
            u = getuuid();
            d = dict("string");
            ja = jsonarray();
            res1 = addpartstotransaction(ja);
            res2 = addtotransaction(ja, "123");
            hmac = generatehmacmessage("key", "msg", "SHA-256");
            old = getoldvalue("attr");
            inv = invoke("util.testFunc");
            b = isnull("test");
            logtime("start");
            sb = stringbuilder();
            sbappend(sb, "hello");
            str = sbtostring(sb);
            setattributevalue("attr", "val");
            b1 = applybom("123", d);
            b2 = calculateconfiguration(d);
            b3 = calculatedeltabom(d, d);
            b4 = convertbomtoflat(d);
            b5 = convertbomtohier(d);
            b6 = getbom("123");
            b7 = getconfigurationbom("123");
            b8 = savebom("123", d);
            b9 = saveconfigbom("123", d);
            sys1 = getsystemdata();
            sys2 = getsystemattrvalues("$.configAttributes.attr");
            sys3 = getsystemmultipleattrvalues(d);
            usersessionset("key1", "val1");
            usVal = usersessionget("key1");
            usRem = usersessionremove("key1");
            return "";
        `);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
        assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
});
