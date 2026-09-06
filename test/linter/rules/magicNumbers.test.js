const assert = require('assert');
const { lintText } = require('../fixtures');

suite('BML Linter - Magic Numbers Test Suite', () => {

    test('Flags raw un-named business numbers and factors passed as inputs or parameters', () => {
        const diagnostics = lintText(`
            mRate_03 = 47.25;
            discountFactor = 0.85;
            thresholdLimit = 5500;
            taxRate = 0.0825;
            val = x * 18.5 + 4.2;
            customFee = calculateFee(basePrice, 15000);
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        const flaggedValues = magicDiags.map(d => {
            const m = d.message.match(/Magic number '([^']+)'/);
            return m ? m[1] : null;
        }).filter(Boolean);

        assert.ok(flaggedValues.includes('47.25'), 'Should flag 47.25');
        assert.ok(flaggedValues.includes('0.85'), 'Should flag 0.85');
        assert.ok(flaggedValues.includes('5500'), 'Should flag 5500');
        assert.ok(flaggedValues.includes('0.0825'), 'Should flag 0.0825');
        assert.ok(flaggedValues.includes('18.5'), 'Should flag 18.5');
        assert.ok(flaggedValues.includes('4.2'), 'Should flag 4.2');
        assert.ok(flaggedValues.includes('15000'), 'Should flag 15000');
    });

    test('Exempts standard numbers (0, 1, 2, 10, 100, 0.0, 1.0, 2.0, -1, -1.0)', () => {
        const diagnostics = lintText(`
            zeroVal = 0;
            oneVal = 1;
            twoVal = 2;
            tenVal = 10;
            hundredVal = 100;
            zeroFloat = 0.0;
            oneFloat = 1.0;
            twoFloat = 2.0;
            negOne = -1;
            negFloat = -1.0;
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Standard numbers should never trigger magic number warnings');
    });

    test('Exempts constant candidate declarations (CONST_*, UPPER_CASE)', () => {
        const diagnostics = lintText(`
            CONST_HOURLY_RATE = 47.25;
            CONST_DISCOUNT = 0.85;
            MAX_RETRY_COUNT = 5;
            DEFAULT_TIMEOUT_MS = 3000;
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Constant definitions should not be flagged');
    });

    test('Exempts string and array built-in function argument offsets', () => {
        const diagnostics = lintText(`
            subStr = substring(myStr, 0, 5);
            leftStr = left(myStr, 12);
            rightStr = right(myStr, 8);
            pos = find(myStr, "target", 3);
            arrRange = range(0, 50);
            subArr = subarray(myArr, 3, 10);
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'String and array slice offsets should not be flagged');
    });

    test('Exempts date manipulation function offsets', () => {
        const diagnostics = lintText(`
            d1 = adddays(orderDate, 7);
            d2 = addmonths(orderDate, 6);
            d3 = addyears(orderDate, 5);
            d4 = minusdays(orderDate, 14);
            d5 = addhours(orderDate, 12);
            d6 = addminutes(orderDate, 30);
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Date function offsets should not be flagged');
    });

    test('Exempts array indexing and index arithmetic', () => {
        const diagnostics = lintText(`
            first = items[0];
            second = items[1];
            fifth = items[5];
            nextItem = items[i + 1];
            prevItem = items[i - 1];
            offsetItem = items[idx + 2];
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Array indices and arithmetic should not be flagged');
    });

    test('Exempts common HTTP status codes in status check comparisons', () => {
        const diagnostics = lintText(`
            if (statusCode == 200) {
                print("Success");
            }
            if (responseCode == 201) {
                print("Created");
            }
            if (httpStatus != 404) {
                print("Found");
            }
            if (status == 500) {
                print("Server Error");
            }
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'HTTP status code comparisons should not be flagged');
    });

    test('Exempts time unit multipliers (ms/sec/min/hr/days/years)', () => {
        const diagnostics = lintText(`
            msTotal = secVal * 1000;
            secTotal = minVal * 60;
            secInHour = hrVal * 3600;
            daySeconds = daysVal * 86400;
            hrsTotal = daysVal * 24;
            daysTotal = yrsVal * 365;
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Time unit multipliers should not be flagged');
    });

    test('Does not flag numbers embedded inside strings, identifiers, or comments', () => {
        const diagnostics = lintText(`
            // Check timeout of 3000ms and port 8080
            item_03 = "Discount code 4725 with 99.9% uptime";
            tier4_limit = 10;
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Numbers inside strings, comments, and identifiers must be ignored');
    });

    test('Exempts comparison threshold expressions (e.g. mId_18 > 40, mRate_18 > 600.0)', () => {
        const diagnostics = lintText(`
            if (mId_18 > 40 AND mRate_18 > 600.0) {
                mEval_18 = "PLATINUM";
            } elif (mId_18 > 20 OR mRate_18 > 300.0) {
                mEval_18 = "GOLD";
            } else {
                mEval_18 = "SILVER";
            }
            if (qty >= 50 AND price <= 199.99) {
                print("discount");
            }
            if (40 < mId_18) {
                print("alt comparison");
            }
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Comparison thresholds must be exempt from magic number warnings');
    });

    test('Exempts web service timeouts and round precision arguments', () => {
        const diagnostics = lintText(`
            res1 = urldata("https://example.com", "GET", headers, "", 5000);
            res2 = urldatabypost("https://example.com", payload, "", headers, true, 3000);
            rounded = round(amount, 4);
            return "";
        `);

        const magicDiags = diagnostics.filter(d => d.code === 'bml-magic-number');
        assert.strictEqual(magicDiags.length, 0, 'Web service timeouts and rounding precision should not be flagged');
    });
});
