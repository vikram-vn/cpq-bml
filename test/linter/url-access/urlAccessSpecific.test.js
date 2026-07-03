const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - URL Access specific tests", () => {
    const vscode = require("vscode");

    suite("HTTP Method validation for urldata()", () => {
        test("1. urldata(url, 'GET') - Valid GET method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "GET"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(diag, undefined);
        });

        test("2. urldata(url, 'POST') - Valid POST method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "POST"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(diag, undefined);
        });

        test("3. urldata(url, 'PUT') - Valid PUT method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "PUT"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(diag, undefined);
        });

        test("4. urldata(url, 'DELETE') - Valid DELETE method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "DELETE"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(diag, undefined);
        });

        test("5. urldata(url, 'PATCH') - Valid PATCH method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "PATCH"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(diag, undefined);
        });

        test("6. urldata(url, 'get') - Lowercase 'get' method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "get"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
            assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Error);
        });

        test("7. urldata(url, 'post') - Lowercase 'post' method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "post"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("8. urldata(url, 'put') - Lowercase 'put' method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "put"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("9. urldata(url, 'delete') - Lowercase 'delete' method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "delete"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("10. urldata(url, 'OPTIONS') - Unsupported OPTIONS method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "OPTIONS"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("11. urldata(url, 'HEAD') - Unsupported HEAD method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "HEAD"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("12. urldata(url, 'CONNECT') - Unsupported CONNECT method flags invalid", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "CONNECT"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("13. urldata(url, 'TRACE') - Unsupported TRACE method flags invalid", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", "TRACE"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("14. urldata(url, '') - Empty string method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", ""); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("15. urldata(url, ' ') - Blank space method flags invalid method", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", " "); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.ok(diag);
        });

        test("16. urldata(url, myMethod) - Variable method is not flagged statically", () => {
            const diagnostics = lintText(`r = urldata("http://example.com", myMethod); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-urldata-invalid-method');
            assert.strictEqual(diag, undefined);
        });
    });

    suite("Argument count negative validation for urldata()", () => {
        test("17. urldata() - missing all arguments → Error", () => {
            const diagnostics = lintText(`r = urldata(); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("18. urldata(url) - missing second argument → Error", () => {
            const diagnostics = lintText(`r = urldata("http://example.com"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("19. urldata(url, method, headers, body, timeout, formData, loopback, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                headers = dict("string");
                formData = dict("anytype");
                r = urldata("url", "GET", headers, "body", 5000, formData, true, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("20. urldata(url, method, headers) - valid 3 arguments → no error", () => {
            const diagnostics = lintText(`
                headers = dict("string");
                r = urldata("url", "GET", headers);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("21. urldata(url, method, headers, body) - valid 4 arguments → no error", () => {
            const diagnostics = lintText(`
                headers = dict("string");
                r = urldata("url", "GET", headers, "body");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });
    });

    suite("Argument count validation for urldatabyget()", () => {
        test("22. urldatabyget() - missing all arguments → Error", () => {
            const diagnostics = lintText(`r = urldatabyget(); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("23. urldatabyget(url) - missing parameters → Error", () => {
            const diagnostics = lintText(`r = urldatabyget("url"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("24. urldatabyget(url, params) - missing defaultValue → Error", () => {
            const diagnostics = lintText(`r = urldatabyget("url", "params"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("25. urldatabyget(url, params, default) - valid 3 arguments → no error", () => {
            const diagnostics = lintText(`
                r = urldatabyget("url", "params", "default");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("26. urldatabyget(url, params, default, timeout) - valid 4 arguments → no error", () => {
            const diagnostics = lintText(`
                r = urldatabyget("url", "params", "default", 30);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("27. urldatabyget(url, params, default, timeout, headers, loopback, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                r = urldatabyget("url", "params", "default", 30, h, true, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("Argument count validation for urldatabypost()", () => {
        test("28. urldatabypost() - missing all arguments → Error", () => {
            const diagnostics = lintText(`r = urldatabypost(); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("29. urldatabypost(url) - missing post data → Error", () => {
            const diagnostics = lintText(`r = urldatabypost("url"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("30. urldatabypost(url, post) - missing defaultValue → Error", () => {
            const diagnostics = lintText(`r = urldatabypost("url", "post"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("31. urldatabypost(url, post, default) - valid 3 arguments → no error", () => {
            const diagnostics = lintText(`
                r = urldatabypost("url", "post", "default");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("32. urldatabypost(url, post, default, headers) - valid 4 arguments → no error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                r = urldatabypost("url", "post", "default", h);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("33. urldatabypost(url, post, default, headers, returnErr, timeout, loopback, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                r = urldatabypost("url", "post", "default", h, true, 30, true, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("Argument count validation for urldatabypostasync()", () => {
        test("34. urldatabypostasync() - missing all arguments → Error", () => {
            const diagnostics = lintText(`r = urldatabypostasync(); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("35. urldatabypostasync(url) - missing parameters → Error", () => {
            const diagnostics = lintText(`r = urldatabypostasync("url"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("36. urldatabypostasync(url, post) - missing parameters → Error", () => {
            const diagnostics = lintText(`r = urldatabypostasync("url", "post"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("37. urldatabypostasync(url, post, default) - missing callback → Error", () => {
            const diagnostics = lintText(`
                r = urldatabypostasync("url", "post", "default");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("38. urldatabypostasync(url, post, default, callback) - valid 4 arguments → no error", () => {
            const diagnostics = lintText(`
                r = urldatabypostasync("url", "post", "default", "callback");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("39. urldatabypostasync(url, post, default, callback, headers) - valid 5 arguments → no error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                r = urldatabypostasync("url", "post", "default", "callback", h);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("40. urldatabypostasync(url, post, default, callback, headers, returnErr, timeout, loopback, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                r = urldatabypostasync("url", "post", "default", "callback", h, true, 30, true, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("Argument count validation for urlmultipartbypost()", () => {
        test("41. urlmultipartbypost() - missing all arguments → Error", () => {
            const diagnostics = lintText(`r = urlmultipartbypost(); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("42. urlmultipartbypost(url) - missing payload → Error", () => {
            const diagnostics = lintText(`r = urlmultipartbypost("url"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("43. urlmultipartbypost(url, payload) - valid 2 arguments → no error", () => {
            const diagnostics = lintText(`r = urlmultipartbypost("url", "payload"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("44. urlmultipartbypost(url, payload, headers) - valid 3 arguments → no error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                r = urlmultipartbypost("url", "payload", h);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("45. urlmultipartbypost(url, payload, headers, attachments) - valid 4 arguments → no error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                a = dict("anytype");
                r = urlmultipartbypost("url", "payload", h, a);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("46. urlmultipartbypost(url, payload, headers, attachments, timeout, loopback, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                h = dict("string");
                a = dict("anytype");
                r = urlmultipartbypost("url", "payload", h, a, 30, true, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("makeurlparam() parameter validation", () => {
        test("47. makeurlparam() - missing all arguments → Error", () => {
            const diagnostics = lintText(`p = makeurlparam(); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });

        test("48. makeurlparam(dict) - valid 1 argument → no error", () => {
            const diagnostics = lintText(`
                params = dict("string");
                p = makeurlparam(params);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(diag, undefined);
        });

        test("49. makeurlparam(dict, extra) - too many arguments → Error", () => {
            const diagnostics = lintText(`
                params = dict("string");
                p = makeurlparam(params, "extra");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(diag);
        });
    });

    suite("Parameter type validations for URL functions", () => {
        test("50. urldata(url, method) - invalid first argument (expected String) → Warning", () => {
            const diagnostics = lintText(`r = urldata(123, "GET"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("51. urldata(url, method) - invalid second argument (expected String) → Warning", () => {
            const diagnostics = lintText(`r = urldata("url", 123); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("52. urldata(url, method, headers) - invalid third argument (expected Dictionary) → Warning", () => {
            const diagnostics = lintText(`r = urldata("url", "GET", "not_a_dictionary"); return "";`);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("53. urldatabyget(url, params, default) - invalid first argument (expected String) → Warning", () => {
            const diagnostics = lintText(`
                r = urldatabyget(123, "params", "default");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("54. urldatabyget(url, params, default) - invalid second argument (expected String) → Warning", () => {
            const diagnosticsType = lintText(`
                r = urldatabyget("url", 1.5, "default");
                return "";
            `);
            const diag = diagnosticsType.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("55. urldatabyget(url, params, default, timeout, headers) - invalid fifth argument (expected Dictionary) → Warning", () => {
            const diagnostics = lintText(`
                r = urldatabyget("url", "params", "default", 5000, "not_a_dictionary");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("56. urldatabyget(url, params, default, timeout) - invalid fourth argument (expected Integer) → Warning", () => {
            const diagnostics = lintText(`
                r = urldatabyget("url", "params", "default", "not_an_integer");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("57. urldata(url, method, headers, parameters, timeout) - parameter type validation → Warning on invalid param/timeout types", () => {
            const diagnostics1 = lintText(`
                headers = dict("string");
                r = urldata("url", "GET", headers, 123, 5000);
                return "";
            `);
            const diagnostics2 = lintText(`
                headers = dict("string");
                r = urldata("url", "GET", headers, "param=1", "not_int");
                return "";
            `);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-type'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-type'));
        });

        test("58. urldatabypost(url, parameters, default, headers, returnErrorResponse, timeout, enableLoopback) - type validations → Warning", () => {
            const diagnostics1 = lintText(`
                headers = dict("string");
                r = urldatabypost("url", "params", "def", headers, "not_bool", 5000, true);
                return "";
            `);
            const diagnostics2 = lintText(`
                headers = dict("string");
                r = urldatabypost("url", "params", "def", headers, true, 5000, "not_bool");
                return "";
            `);
            assert.ok(diagnostics1.find(d => d.code === 'bml-function-arg-type'));
            assert.ok(diagnostics2.find(d => d.code === 'bml-function-arg-type'));
        });

        test("59. urldatabypostasync() - callbackActionVarName type check → Warning on non-String callback name", () => {
            const diagnostics = lintText(`
                headers = dict("string");
                r = urldatabypostasync("url", "params", "def", 123, headers);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });

        test("60. urlmultipartbypost() - attachments type check → Warning on non-Dictionary attachments", () => {
            const diagnostics = lintText(`
                r = urlmultipartbypost("url", "payload", dict("string"), "not_dictionary");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
            assert.ok(diag);
        });
    });
});
