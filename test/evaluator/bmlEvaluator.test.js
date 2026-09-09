const assert = require('assert');
const { evaluateBmlLogic } = require('../../app/lang/evaluator/bmlEvaluator');

describe('Local BML Evaluator', () => {
    it('executes string and math operations', () => {
        const code = `
            String greeting = "hello world";
            print(upper(greeting));
            Float val = round(3.14159, 2);
            return val;
        `;
        const res = evaluateBmlLogic({ code });
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.output, ['HELLO WORLD']);
        assert.strictEqual(res.returnValue, 3.14);
    });

    it('handles BML dictionaries and print statements', () => {
        const code = `
            d = dict("string");
            put(d, "status", "active");
            put(d, "count", 42);
            print("Status is:", get(d, "status"));
            return get(d, "count");
        `;
        const res = evaluateBmlLogic({ code });
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.output, ['Status is: active']);
        assert.strictEqual(res.returnValue, 42);
    });

    it('handles foreach loops and array functions', () => {
        const code = `
            items = split("apple,banana,cherry", ",");
            total = 0;
            for item in items {
                total = total + len(item);
            }
            return total;
        `;
        const res = evaluateBmlLogic({ code });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.returnValue, 17);
    });

    it('catches runtime errors gracefully', () => {
        const code = `
            x = undefinedVar.someProp;
        `;
        const res = evaluateBmlLogic({ code });
        assert.strictEqual(res.success, false);
        assert.ok(res.error);
    });
});
