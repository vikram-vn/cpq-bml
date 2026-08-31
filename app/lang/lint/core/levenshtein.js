// Shared did-you-mean logic for systemVariables.js, functions.js, and useBeforeDefine.js.
function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    if (Math.abs(m - n) > 3) return Math.abs(m - n);

    let prev = new Int32Array(n + 1);
    let curr = new Int32Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
            curr[j] = ca === b.charCodeAt(j - 1)
                ? prev[j - 1]
                : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
        }
        const temp = prev; prev = curr; curr = temp;
    }
    return prev[n];
}

module.exports = { levenshtein };
