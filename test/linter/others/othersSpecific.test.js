const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - General and other specific tests", () => {
  const vscode = require("vscode");

  suite("New Linter Fixes Tests", () => {
    test("line.someattributes is not flagged as unknown function", () => {
      const diagnostics = lintText('x = line.someattributes;\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unknown-function");
      assert.strictEqual(err, undefined, "line.someattributes should NOT be flagged as function");
    });

    test("line.someName_t is not flagged as unknown function", () => {
      const diagnostics = lintText('x = line.someName_t;\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unknown-function");
      assert.strictEqual(err, undefined, "line.someName_t should NOT be flagged as function");
    });

    test("unclosed double quote is flagged as error", () => {
      const diagnostics = lintText('x = "unclosed;\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unclosed-string");
      assert.ok(err, "Should flag unclosed double quote");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("unclosed single quote is flagged as error", () => {
      const diagnostics = lintText("x = 'unclosed;\nreturn '';");
      const err = diagnostics.find((d) => d.code === "bml-unclosed-string");
      assert.ok(err, "Should flag unclosed single quote");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("binary type mismatch 1 + \"1\" is flagged as error", () => {
      const diagnostics = lintText('test = 1 + "1";\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-binary-type-mismatch");
      assert.ok(err, "Should flag 1 + \"1\"");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("binary type mismatch \"1\" + 1 is flagged as error", () => {
      const diagnostics = lintText('test = "1" + 1;\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-binary-type-mismatch");
      assert.ok(err, "Should flag \"1\" + 1");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("binary subtraction with string is flagged as error", () => {
      const diagnostics = lintText('test = 1 - "1";\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-binary-type-mismatch");
      assert.ok(err, "Should flag 1 - \"1\"");
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
    });

    test("unreachable code inside nested terminating blocks is flagged as error", () => {
      const diagnostics = lintText(`
        if (x) {
          if (y) {
            return 1;
          } else {
            return 2;
          }
          x = 5; // dead code!
        }
        return 0;
      `);
      const err = diagnostics.find((d) => d.code === "bml-unreachable-code");
      assert.ok(err, "Should flag unreachable code inside nested blocks");
    });

    test("unused variable is reported with Hint severity", () => {
      const diagnostics = lintText('test = 1;\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unused-variable");
      assert.ok(err);
      assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Hint);
    });
  });

  suite("sbappend() - requires at least 2 arguments (stringbuilder, chunk[, chunk2, ...])", () => {
    test("sbappend() - zero args → no bml-function-arg-count (sbappend signature is permissive)", () => {
      const diagnostics = lintText('sbappend();\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb) - 1 arg → no bml-function-arg-count (sbappend signature is permissive)", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, str) - correct 2 args → no error", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, "hello");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, str, extra) - 3 args → no error", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, "hello", "world");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, ) - trailing comma → bml-trailing-comma-error", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, );\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-trailing-comma-error");
      assert.ok(err);
    });

    test("sbappend(sb, str, val) - multiple arguments → no error", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, "hello", 1);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, str, val1, val2) - multiple → no error", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, "hello", 1, true);\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, str, val1, val2, val3) - multiple → no error", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, "hello", 1, true, getdate());\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, str) with expressions - valid", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbappend(sb, "hello" + "world");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
      assert.strictEqual(err, undefined);
    });

    test("sbappend(sb, str) with case insensitivity - valid", () => {
      const diagnostics = lintText('sb = stringbuilder();\nsbAppend(sb, "hello");\nreturn "";');
      const err = diagnostics.find((d) => d.code === "bml-unknown-function");
      assert.strictEqual(err, undefined);
    });
  });

  suite("User Session and Global Dictionary State Functions", () => {
    test("usersessionset(key, val) - Valid", () => {
      const diagnostics = lintText('usersessionset("myKey", "myVal"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("usersessionset() - Missing args → Error", () => {
      const diagnostics = lintText('usersessionset(); return "";');
      assert.ok(diagnostics.find(d => d.code === 'bml-function-arg-count'));
    });

    test("usersessionget(key) - Valid", () => {
      const diagnostics = lintText('x = usersessionget("myKey"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("usersessionremove(key) - Valid", () => {
      const diagnostics = lintText('usersessionremove("myKey"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("globaldictset(key, val, ttl) - Valid", () => {
      const diagnostics = lintText('globaldictset("k", "v", 30); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("globaldictset() - ttl <= 0 flags time-to-live range warning", () => {
      const diagnostics = lintText('globaldictset("k", "v", 0); return "";');
      assert.ok(diagnostics.find(d => d.code === 'bml-globaldict-ttl-out-of-range'));
    });

    test("globaldictset() - ttl > 525600 flags time-to-live range warning", () => {
      const diagnostics = lintText('globaldictset("k", "v", 525601); return "";');
      assert.ok(diagnostics.find(d => d.code === 'bml-globaldict-ttl-out-of-range'));
    });

    test("globaldictget(key) - Valid", () => {
      const diagnostics = lintText('x = globaldictget("myKey"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("globaldictremove(key) - Valid", () => {
      const diagnostics = lintText('globaldictremove("myKey"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("String Builder Instantiation & Conversion", () => {
    test("stringbuilder() - Valid", () => {
      const diagnostics = lintText('sb = stringbuilder(); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("stringbuilder(invalid) - too many arguments or type mismatch", () => {
      const dCount = lintText('sb = stringbuilder("a", "b", "c", "d"); return "";');
      const dType1 = lintText('sb = stringbuilder(123); return "";');
      const dType2 = lintText('sb = stringbuilder("a", 123); return "";');
      const dType3 = lintText('sb = stringbuilder("a", "b", 123); return "";');

      assert.ok(dCount.find((d) => d.code === "bml-function-arg-count"));
      assert.ok(dType1.find((d) => d.code === "bml-function-arg-type"));
      assert.ok(dType2.find((d) => d.code === "bml-function-arg-type"));
      assert.ok(dType3.find((d) => d.code === "bml-function-arg-type"));
    });

    test("sbtostring(sb) - Valid", () => {
      const diagnostics = lintText('sb = stringbuilder(); s = sbtostring(sb); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("System Data & Attribute Value Retrieval Functions", () => {
    test("getsystemdata() - Valid", () => {
      const diagnostics = lintText('x = getsystemdata(); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getsystemattrvalues(attr) - Valid", () => {
      const diagnostics = lintText('x = getsystemattrvalues("attr"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getsystemmultipleattrvalues(attrs) - Valid", () => {
      const diagnostics = lintText('arr = string[1]; x = getsystemmultipleattrvalues(arr); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("Transaction Mutations and Part Actions", () => {
    test("addtotransaction(id) - Valid", () => {
      const diagnostics = lintText('addtotransaction(12345); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("addpartstotransaction(id, parts) - Valid", () => {
      const diagnostics = lintText('parts = string[1]; addpartstotransaction(123, parts); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("General Logic Helpers and Boundary Constraints", () => {
    test("throwerror(msg) - Valid", () => {
      const diagnostics = lintText('throwerror("some error message"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("isnull(x) - Valid", () => {
      const diagnostics = lintText('b = isnull(val); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("logtime(tag, msg) - Valid", () => {
      const diagnostics = lintText('logtime("tag", "message"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("logtime(tag, msg) - Tag > 128 characters flags warning", () => {
      const diagnostics = lintText('logtime("very_long_tag_that_exceeds_the_128_characters_limit_very_long_tag_that_exceeds_the_128_characters_limit_very_long_tag_that_exceeds_the_128", "msg"); return "";');
      assert.ok(diagnostics.find(d => d.code === 'bml-logtime-tag-too-long'));
    });

    test("getuuid() - Valid", () => {
      const diagnostics = lintText('u = getuuid(); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("generatehmacmessage(key, msg) - Valid", () => {
      const diagnostics = lintText('h = generatehmacmessage("key", "message"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("generatehmacmessage() algorithm whitelist (bml-hmac-invalid-algorithm)", () => {
    for (const algo of ["SHA256", "SHA384", "SHA512", "SHA1", "MD5"]) {
      test(`generatehmacmessage(msg, key, "${algo}") - valid algorithm does not flag`, () => {
        const diagnostics = lintText(`h = generatehmacmessage("message", "key", "${algo}"); return "";`);
        assert.strictEqual(diagnostics.find(d => d.code === 'bml-hmac-invalid-algorithm'), undefined);
      });
    }

    test('generatehmacmessage(msg, key, "sha256") - lowercase is flagged, values are case sensitive per Others.md', () => {
      const diagnostics = lintText('h = generatehmacmessage("message", "key", "sha256"); return "";');
      const diag = diagnostics.find(d => d.code === 'bml-hmac-invalid-algorithm');
      assert.ok(diag);
    });

    test('generatehmacmessage(msg, key, "SHA-256") - hyphenated form is flagged, only unhyphenated names are valid', () => {
      const diagnostics = lintText('h = generatehmacmessage("message", "key", "SHA-256"); return "";');
      const diag = diagnostics.find(d => d.code === 'bml-hmac-invalid-algorithm');
      assert.ok(diag);
    });

    test('generatehmacmessage(msg, key, "DES") - unsupported algorithm is flagged', () => {
      const diagnostics = lintText('h = generatehmacmessage("message", "key", "DES"); return "";');
      const diag = diagnostics.find(d => d.code === 'bml-hmac-invalid-algorithm');
      assert.ok(diag);
    });

    test("generatehmacmessage(msg, key, algoVar) - a variable algorithm is not statically checkable, no false positive", () => {
      const diagnostics = lintText('h = generatehmacmessage("message", "key", algoVar); return "";');
      const diag = diagnostics.find(d => d.code === 'bml-hmac-invalid-algorithm');
      assert.strictEqual(diag, undefined);
    });
  });

  suite("BOM and Configuration API Actions", () => {
    test("applybom(bom) - Valid", () => {
      const diagnostics = lintText('bom = dict("anytype"); applybom(bom, "parent"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getbom(key) - Valid", () => {
      const diagnostics = lintText('x = getbom("key", "parent"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("savebom(id, bom) - Valid", () => {
      const diagnostics = lintText('bom = dict("anytype"); savebom(123, bom); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getconfigattrvalue(attr) - Valid", () => {
      const diagnostics = lintText('x = getconfigattrvalue("attr", "parent"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getconfigbom(key) - Valid", () => {
      const diagnostics = lintText('x = getconfigbom("key", "parent"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("saveconfigbom(key, bom) - Valid", () => {
      const diagnostics = lintText('bom = dict("anytype"); saveconfigbom("key", bom); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("calculatedeltabom(bom1, bom2) - Valid", () => {
      const diagnostics = lintText('bom1 = dict("anytype"); bom2 = dict("anytype"); x = calculatedeltabom(bom1, bom2, "parent"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("convertbomtoflat(bom) - Valid", () => {
      const diagnostics = lintText('bom = dict("anytype"); x = convertbomtoflat(bom); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("convertbomtohier(bom) - Valid", () => {
      const diagnostics = lintText('bom = dict("anytype"); x = convertbomtohier(bom); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("calculateconfiguration() - Valid", () => {
      const diagnostics = lintText('x = calculateconfiguration("a", "b"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("configureabo(bom) - Valid", () => {
      const diagnostics = lintText('bom = dict("anytype"); x = configureabo(bom); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("Additional Other Category Functions", () => {
    test("getarrayattrstring(attr) - Valid", () => {
      const diagnostics = lintText('x = getarrayattrstring("attr"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getattachmentdata(key) - Valid", () => {
      const diagnostics = lintText('x = getattachmentdata("key"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getcoveragesupportdict(key) - Valid", () => {
      const diagnostics = lintText('x = getcoveragesupportdict(); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getoldvalue(key) - Valid", () => {
      const diagnostics = lintText('x = getoldvalue("key"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("getreasonstatus(key) - Valid", () => {
      const diagnostics = lintText('x = getreasonstatus("key"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("setattributevalue(attr, val) - Valid", () => {
      const diagnostics = lintText('setattributevalue("attr", "val"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("importtransactiondata(id, xml) - Valid", () => {
      const diagnostics = lintText('importtransactiondata(123); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("validatequoteforagreement(id) - Valid", () => {
      const diagnostics = lintText('x = validatequoteforagreement(); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });

  suite("Others Category Constants and StringBuilder Overloads", () => {
    test("System recognized constants should not flag unknown warnings", () => {
      const diagnostics1 = lintText('x = BM_UNCHANGED_NUM; return "";');
      const diagnostics2 = lintText('y = BM_REASON_STATUS_APPROVED; return "";');
      const diagnostics3 = lintText('z = BM_SALES_ROOT_BOM_ITEM; return "";');
      assert.strictEqual(diagnostics1.find(d => d.code === 'bml-unknown-function' || d.code === 'bml-use-before-define'), undefined);
      assert.strictEqual(diagnostics2.find(d => d.code === 'bml-unknown-function' || d.code === 'bml-use-before-define'), undefined);
      assert.strictEqual(diagnostics3.find(d => d.code === 'bml-unknown-function' || d.code === 'bml-use-before-define'), undefined);
    });

    test("stringbuilder(str) and stringbuilder(arr) - valid overloads → no error", () => {
      const diagnostics1 = lintText('sb = stringbuilder("hello"); return "";');
      const diagnostics2 = lintText('arr = string[]{"a"}; sb = stringbuilder(arr); return "";');
      assert.strictEqual(diagnostics1.find(d => d.code === 'bml-function-arg-count'), undefined);
      assert.strictEqual(diagnostics2.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("usersessionget(key, type) - valid 2 arguments → no error", () => {
      const diagnostics = lintText('x = usersessionget("myKey", "string"); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });

    test("globaldictset(key, val, ttl, isolate) - valid 4 arguments → no error", () => {
      const diagnostics = lintText('x = globaldictset("myKey", "myVal", 60, true); return "";');
      assert.strictEqual(diagnostics.find(d => d.code === 'bml-function-arg-count'), undefined);
    });
  });
});
