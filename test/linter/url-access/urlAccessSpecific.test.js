const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - URL Access Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. urldata(url, method [, headers [, data [, timeout [, formData [, enableLoopback]]]]])
    // =========================================================================
    suite('urldata() - Universal HTTP REST & SOAP Access', () => {
        suite('Positive', () => {
            test('GET request without headers (2 arguments)', () => {
                const diags = lintText('response = urldata("http://example.com/api/v1/products", "GET"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('GET request with headers and timeout (5 arguments)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    put(headers, "content-type", "application/json");
                    response = urldata("http://example.com/api/v1/products", "GET", headers, "", 5000);
                    statusCode = get(response, "Status-Code");
                    body = get(response, "Message-Body");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('PUT request with JSON body (4 arguments)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    put(headers, "content-type", "application/json");
                    jsonBody = "{\\"status\\":\\"Approved\\"}";
                    response = urldata("http://example.com/api/v1/quotes/1001", "PUT", headers, jsonBody);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('DELETE request with Basic authentication via encodebase64 (3 arguments)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    encodecredential = encodebase64("admin:secretPassword");
                    authstring = "Basic " + encodecredential;
                    put(headers, "Authorization", authstring);
                    response = urldata("http://example.com/api/v1/quotes/1001", "DELETE", headers);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('GET request with Bearer OAuth token authentication (3 arguments)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    put(headers, "Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
                    response = urldata("https://api.dynamics365.com/data/v9.0/accounts", "GET", headers);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('PATCH request with Basic authentication and JSON payload (4 arguments)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    encodecredential = encodebase64("user:pass");
                    put(headers, "Authorization", "Basic " + encodecredential);
                    put(headers, "content-type", "application/json");
                    jsonBody = "{\\"discountPercentage\\":15.5}";
                    response = urldata("http://example.com/api/v1/orders/500", "PATCH", headers, jsonBody);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('All overloads (5 to 7 arguments with enableLoopback)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    r5 = urldata("http://example.com", "GET", headers, "", 3000);
                    r6 = urldata("http://example.com", "GET", headers, "", 3000, true);
                    r7 = urldata("http://example.com", "GET", headers, "", 3000, true, false);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Multi-line formatting with block comments', () => {
                const diags = lintText(`
                    response = urldata(
                        /* target url */ "https://endpoint.customer.com",
                        /* http method */ "POST",
                        /* request headers */ dict("string"),
                        /* request payload */ "{\\"key\\":\\"value\\"}",
                        /* timeout ms */ 10000
                    );
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('response = urldata(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing method) → flags bml-function-arg-count Error', () => {
                const diags = lintText('response = urldata("https://example.com"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('8 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText(`
                    h = dict("string");
                    response = urldata("https://example.com", "GET", h, "", 5000, true, false, "excess");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('response = urldata("https://example.com", "GET", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty URL and payload strings', () => {
                const diags = lintText('response = urldata("", "GET"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Keyword identifier collision recovery', () => {
                const diags = lintText('response = urldata(return, break); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 2. urldatabyget(url, parameters, defaultValue [, timeout [, headers [, enableLoopback]]])
    // =========================================================================
    suite('urldatabyget() - Synchronous HTTP GET Access', () => {
        suite('Positive', () => {
            test('3 arguments: basic url, query parameters, and defaultValue', () => {
                const diags = lintText('res = urldatabyget("https://example.com/search", "q=oracle+cpq&limit=10", "No results"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('4 to 6 arguments: with timeout, custom headers, and enableLoopback', () => {
                const diags = lintText(`
                    headers = dict("string");
                    put(headers, "Accept", "application/json");
                    res4 = urldatabyget("https://example.com/api", "id=100", "error", 5000);
                    res5 = urldatabyget("https://example.com/api", "id=100", "error", 5000, headers);
                    res6 = urldatabyget("https://example.com/api", "id=100", "error", 5000, headers, true);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Integration criteria: URL query string composed via makeurlparam', () => {
                const diags = lintText(`
                    p = dict("string");
                    put(p, "partNumber", "CPQ-SKU-9900");
                    put(p, "region", "NA");
                    queryString = makeurlparam(p);
                    res = urldatabyget("https://pricing.oracle.com/calculate", queryString, "PRICING_UNAVAILABLE");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabyget(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (missing defaultValue) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabyget("https://example.com", "q=test"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('7 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabyget("https://example.com", "q=1", "def", 1000, dict("string"), true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('res = urldatabyget("https://example.com", "q=1", "def", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty parameter string and defaultValue', () => {
                const diags = lintText('res = urldatabyget("", "", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. urldatabypost(url, parameters, defaultValue [, headers [, returnErrorResponse [, timeout [, enableLoopback]]]])
    // =========================================================================
    suite('urldatabypost() - Synchronous HTTP POST Access & SOAP Web Services', () => {
        suite('Positive', () => {
            test('3 arguments: basic url, parameters payload, and defaultValue', () => {
                const diags = lintText('res = urldatabypost("https://example.com/soap", "<soap:Envelope/>", "FAIL"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('4 arguments: SOAP Web Service with SOAPAction header from UseSOAPwithBML.md', () => {
                const diags = lintText(`
                    headerDict = dict("string");
                    put(headerDict, "SOAPAction", "getTransaction");
                    soapEnvelope = "<?xml version='1.0'?><soapenv:Envelope xmlns:soapenv='http://schemas.xmlsoap.org/soap/envelope/'><soapenv:Body/></soapenv:Envelope>";
                    soapResponseXML = urldatabypost("https://cpluto.oracle.com/httpreceiver", soapEnvelope, "FAIL", headerDict);
                    return soapResponseXML;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('5 to 7 arguments: with returnErrorResponse, timeout, enableLoopback', () => {
                const diags = lintText(`
                    headers = dict("string");
                    put(headers, "Content-Type", "application/json");
                    r5 = urldatabypost("https://example.com/api", "payload", "FAIL", headers, true);
                    r6 = urldatabypost("https://example.com/api", "payload", "FAIL", headers, true, 5000);
                    r7 = urldatabypost("https://example.com/api", "payload", "FAIL", headers, true, 5000, false);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Same Server Authentication (internal call without auth headers)', () => {
                const diags = lintText(`
                    headers = dict("string");
                    put(headers, "Content-Type", "application/json");
                    response = urldatabypost("http://mycpqsite.oracle.com/v2_0/receiver", "{\\"action\\":\\"sync\\"}", "", headers);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabypost(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing parameters, default) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabypost("https://example.com"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('8 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabypost("https://example.com", "p", "d", dict("string"), true, 5000, false, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Illegal assignment target to urldatabypost() invocation', () => {
                const diags = lintText('urldatabypost("https://example.com", "p", "d") = "invalid"; return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 4. urldatabypostasync(url, parameters, defaultValue, callbackAction [, headers [, returnErrorResponse [, timeout [, enableLoopback]]]]])
    // =========================================================================
    suite('urldatabypostasync() - Asynchronous HTTP POST Access & Callback Addressing', () => {
        suite('Positive', () => {
            test('4 arguments: basic url, parameters, defaultValue, and callbackAction', () => {
                const diags = lintText('id = urldatabypostasync("http://www.example.com", "a1=v1&a2=v2", "error message", "AsyncResponseAction"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('5 to 8 arguments: SOAP addressing header $_BM_ASYNC_ADDRESSING_TOKEN$', () => {
                const diags = lintText(`
                    endPoint = "https://endpoint.customer.com";
                    headerValues = dict("string");
                    put(headerValues, "Content-Type", "text/xml; charset=utf-8");
                    put(headerValues, "replyinfo", "$_BM_ASYNC_ADDRESSING_TOKEN$");
                    errorString = "Error in async invocation";
                    callback = "AsyncResponseAction";
                    soapbody = "<soap:Body><data>test</data></soap:Body>";
                    callasync = urldatabypostasync(endPoint, soapbody, errorString, callback, headerValues, true, 10000, false);
                    return "done";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('id = urldatabypostasync(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (missing callbackAction) → flags bml-function-arg-count Error', () => {
                const diags = lintText('id = urldatabypostasync("https://example.com", "payload", "def"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('9 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('id = urldatabypostasync("https://example.com", "p", "d", "cb", dict("string"), true, 10000, false, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string callbackAction parameter', () => {
                const diags = lintText('id = urldatabypostasync("", "", "", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. urlmultipartbypost(url, payload [, headers [, attachments [, timeout [, enableLoopback]]]]])
    // =========================================================================
    suite('urlmultipartbypost() - Multipart MIME Remote Approvals & Attachments', () => {
        suite('Positive', () => {
            test('2 arguments: url and approval payload string', () => {
                const diags = lintText(`
                    approvalPayload = "{\\"processDefId\\":\\"QuoteApprovalProcess\\",\\"serviceName\\":\\"QuoteApprovalProcess.service\\",\\"operation\\":\\"start\\"}";
                    res = urlmultipartbypost("https://bpm.oraclecloud.com/process", approvalPayload);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 to 6 arguments: with headers, attachments dictionary, timeout, enableLoopback', () => {
                const diags = lintText(`
                    headers = dict("string");
                    attachments = dict("string");
                    put(attachments, "quote_summary.pdf", "JVBERi0xLjQKJ...");
                    put(attachments, "bill_of_materials.csv", "SKU,Qty,Price\\n1001,2,500");
                    res3 = urlmultipartbypost("https://example.com/approval", "payload", headers);
                    res4 = urlmultipartbypost("https://example.com/approval", "payload", headers, attachments);
                    res5 = urlmultipartbypost("https://example.com/approval", "payload", headers, attachments, 5000);
                    res6 = urlmultipartbypost("https://example.com/approval", "payload", headers, attachments, 5000, true);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urlmultipartbypost(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing payload) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urlmultipartbypost("https://example.com"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('7 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urlmultipartbypost("https://example.com", "data", dict("string"), dict("string"), 5000, true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Keyword collision in multipart parameters', () => {
                const diags = lintText('urlmultipartbypost(return, break, continue); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 6. makeurlparam(Dictionary dict) OR makeurlparam(String name, String value)
    // =========================================================================
    suite('makeurlparam() - Encode URL query parameters', () => {
        suite('Positive', () => {
            test('1 argument: makeurlparam(dict)', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "account", "Oracle Inc");
                    put(d, "status", "Active");
                    q = makeurlparam(d);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: makeurlparam(name, value)', () => {
                const diags = lintText('q = makeurlparam("filter", "category=Electronics&type=A"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('q = makeurlparam(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('q = makeurlparam("name", "val", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string name and value parameters', () => {
                const diags = lintText('q = makeurlparam("", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
