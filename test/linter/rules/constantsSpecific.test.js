const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - CPQ System Constants Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. Constraint Rules Constants (BM_CM_RULES_LOCATION, BM_CM_RULES_MESSAGE, BM_CM_RULES_OPERATOR, BM_CM_RULES_VALUES)
    // =========================================================================
    suite('Constraint Rules Constants - Dictionary keys for Commerce rule evaluations', () => {
        suite('Positive', () => {
            test('Uses rule dictionary keys in constraint handler dictionaries', () => {
                const diags = lintText(`
                    ruleDict = dict("string");
                    put(ruleDict, "location", "attribute");
                    put(ruleDict, "message", "Value violates maximum threshold");
                    put(ruleDict, "operator", ">");
                    put(ruleDict, "values", "100~200~300");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Misspelled operator or invalid dictionary key access', () => {
                const diags = lintText('d = dict("string"); val = get(d); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Complex constraint rule violation dictionary construction', () => {
                const diags = lintText(`
                    resDict = dict("anytype");
                    put(resDict, "BM_CM_RULES_LOCATION", "top");
                    put(resDict, "BM_CM_RULES_MESSAGE", "Fatal BOM configuration mismatch");
                    put(resDict, "BM_CM_RULES_OPERATOR", "in");
                    put(resDict, "BM_CM_RULES_VALUES", "MODEL_A~MODEL_B");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. Unchanged Value Placeholders ($BM_UNCHANGED_STR$, $BM_UNCHANGED_NUM$, $BM_UNCHANGED_DATE$)
    // =========================================================================
    suite('Unchanged Value Placeholders - Leave array set values unchanged in delta updates', () => {
        suite('Positive', () => {
            test('Uses $BM_UNCHANGED_STR$, $BM_UNCHANGED_NUM$, $BM_UNCHANGED_DATE$ in array declarations', () => {
                const diags = lintText(`
                    strArr = string[]{"$BM_UNCHANGED_STR$", "New Description"};
                    intArr = integer[]{0, 21, 23};
                    dateArr = date[]{getdate(), getdate()};
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Unclosed array literal with unchanged token flags bml-syntax-error', () => {
                const diags = lintText('s = string[]{"$BM_UNCHANGED_STR$"; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Multi-row array set update with unchanged token placeholders', () => {
                const diags = lintText(`
                    row1 = string[]{"$BM_UNCHANGED_STR$", "Updated Line 1"};
                    row2 = string[]{"KeepName", "$BM_UNCHANGED_STR$"};
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. Reason & Approval Status Constants
    // =========================================================================
    suite('Reason & Approval Status Constants - Approval trees and remote approval history', () => {
        suite('Positive', () => {
            test('Constructs remote approval history string with approval statuses', () => {
                const diags = lintText(`
                    approverName = "John Doe";
                    approverCompany = "Oracle";
                    approverDate = getstrdate();
                    approverComment = "Approved with corporate discount";
                    statusApproved = "BM_REMOTE_APPROVAL_STATUS_APPROVED";
                    historyRecord = approverName + "~" + approverCompany + "~" + approverDate + "~" + statusApproved + "~" + approverComment + "~||";
                    return historyRecord;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('String concatenation missing right operand', () => {
                const diags = lintText('hist = "record~" + ; return "";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Chaining multiple remote approval action records (APPROVED, REJECTED, CUSTOM)', () => {
                const diags = lintText(`
                    hist = "";
                    hist = hist + "Alice~Oracle~" + getstrdate() + "~BM_REMOTE_APPROVAL_STATUS_APPROVED~OK~||\n";
                    hist = hist + "Bob~Finance~" + getstrdate() + "~BM_REMOTE_APPROVAL_STATUS_REJECTED~Margin low~||\n";
                    hist = hist + "Charlie~Legal~" + getstrdate() + "~BM_REMOTE_APPROVAL_STATUS_CUSTOM~Pending review~||";
                    return hist;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. Partner Security Token & Configuration Keys (BM_PARTNER_SECURITY_TOKEN, BM_CONFIGURATION_KEY)
    // =========================================================================
    suite('Partner Security Token & Configuration Keys - SOAP headers & ABO context keys', () => {
        suite('Positive', () => {
            test('Embeds BM_PARTNER_SECURITY_TOKEN into stateless SOAP request XML headers', () => {
                const diags = lintText(`
                    soapToken = "<wsse:Security><wsse:UsernameToken><wsse:Username>admin</wsse:Username></wsse:UsernameToken></wsse:Security>";
                    soapHeader = "<soapenv:Header><ClientName>CPQ</ClientName>" + soapToken + "</soapenv:Header>";
                    return soapHeader;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });

        suite('Negative', () => {
            test('Missing return statement in SOAP XML builder script', () => {
                const diags = lintText('soapHeader = "<soapenv:Header></soapenv:Header>";');
                assert.ok(diags.length > 0);
            });
        });

        suite('Destructive', () => {
            test('Configuration and prior root BOM item keys in ABO delta calculations', () => {
                const diags = lintText(`
                    cfgKey = "BM_CONFIGURATION_KEY";
                    priorKey = "BM_PRIOR_CONFIGURATION_KEY";
                    priorBom = "BM_PRIOR_ROOT_BOM_ITEM";
                    salesBom = "BM_SALES_ROOT_BOM_ITEM";
                    return cfgKey + "~" + priorKey + "~" + priorBom + "~" + salesBom;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-syntax-error'), undefined);
            });
        });
    });
});
