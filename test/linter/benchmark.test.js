const assert = require("assert");
const { lintText } = require("./fixtures");
const { performance } = require("perf_hooks");

suite("BML Linter Performance & Speed Benchmark Suite", () => {
    test("Benchmark: Linter execution speed on 1,000 line BML script", () => {
        // Construct a realistic 1,000 line BML script
        const lineBlock = `
            res = urldata("https://api.oracle.com/v1/data", "GET");
            if (containskey(res, "Status-Code") and get(res, "Status-Code") == "200 OK") {
                body = get(res, "Message-Body");
            }
            items = string[]{"item1", "item2", "item3"};
            total = 0.0;
            for item in items {
                price = 19.99;
                total = total + price;
            }
            rs = bmql("SELECT part_number, price FROM c_parts WHERE status = 'ACTIVE'");
            for rec in rs {
                pn = get(rec, "part_number");
            }
            resultStr = "Processed: " + string(total);
        `;

        // Repeat to build ~1,000 lines
        const largeBMLText = lineBlock.repeat(60) + '\nreturn "";\n';
        const totalLines = largeBMLText.split(/\r?\n/).length;

        // Warm up pass
        lintText(largeBMLText);

        // Run benchmark iterations
        const iterations = 50;
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
            lintText(largeBMLText);
        }

        const endTime = performance.now();
        const totalDurationMs = endTime - startTime;
        const avgDurationMs = totalDurationMs / iterations;

        console.log(`\n======================================================`);
        console.log(` BML Linter Speed Benchmark Results`);
        console.log(`======================================================`);
        console.log(` Document Size:    ${totalLines} lines`);
        console.log(` Iterations:       ${iterations} passes`);
        console.log(` Total Time:       ${totalDurationMs.toFixed(2)} ms`);
        console.log(` Avg Time per Run: ${avgDurationMs.toFixed(2)} ms / 1,000 lines`);
        console.log(` Execution Speed:  ${Math.round(1000 / avgDurationMs)} passes / second`);
        console.log(`======================================================\n`);

        assert.ok(
            avgDurationMs < 30,
            `Linter speed check failed: average time ${avgDurationMs.toFixed(2)}ms exceeds 30ms limit`
        );
    });
});
