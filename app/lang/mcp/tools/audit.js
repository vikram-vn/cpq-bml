/**
 * BML Code Auditor for Security, Performance, and Oracle CPQ Best Practices.
 * Inspects BML scripts for critical anti-patterns, injection vulnerabilities, and performance traps.
 */

function auditBmlCode(args) {
    const code = (args && typeof args.code === 'string') ? args.code : '';
    if (!code.trim()) {
        return {
            success: false,
            error: 'Code snippet cannot be empty'
        };
    }

    const lines = code.split(/\r?\n/);
    const issues = [];

    // Helper to find approximate line number
    function findLineNumber(index) {
        return code.slice(0, index).split(/\r?\n/).length;
    }

    // 1. BMQL Injection Vulnerability: string concatenation inside bmql()
    // Pattern: bmql("... " + var ...)
    const bmqlRegex = /bmql\s*\(\s*([^)]+)\)/gi;
    let match;
    while ((match = bmqlRegex.exec(code)) !== null) {
        const queryArg = match[1];
        if (queryArg.includes('+') && !queryArg.includes('$\'')) {
            const lineNum = findLineNumber(match.index);
            issues.push({
                id: 'BMQL_INJECTION_RISK',
                type: 'BMQL_INJECTION_RISK',
                severity: 'critical',
                line: lineNum,
                message: 'Dynamic BMQL string concatenation detected. This exposes your CPQ database to BMQL injection.',
                suggestion: 'Replace string concatenation with parameterized variables prefixed with $ (e.g., WHERE column = $variable).',
                codeSnippet: lines[lineNum - 1] ? lines[lineNum - 1].trim() : match[0]
            });
        }
    }

    // 2. BMQL or DB queries inside loops
    // Detect loop blocks: for(...) { ... } or while(...) { ... }
    const loopRegex = /(?:for|while)\s*\(?[^){]*\)?\s*\{([^}]*)\}/gis;
    while ((match = loopRegex.exec(code)) !== null) {
        const loopBody = match[1];
        if (/bmql\s*\(/i.test(loopBody)) {
            const lineNum = findLineNumber(match.index);
            issues.push({
                id: 'BMQL_IN_LOOP',
                type: 'BMQL_IN_LOOP',
                severity: 'high',
                line: lineNum,
                message: 'BMQL database query executed inside a loop. This degrades CPQ transaction performance and risks timeout.',
                suggestion: 'Fetch all required records in a single batch BMQL query before the loop and index them in a Dictionary or JSON object.',
                codeSnippet: lines[lineNum - 1] ? lines[lineNum - 1].trim() : ''
            });
        }

        // 3. String concatenation in loops
        const concatMatches = loopBody.match(/[a-zA-Z0-9_]+\s*\+=\s*[^;]+/g);
        if (concatMatches && concatMatches.length > 2) {
            const lineNum = findLineNumber(match.index);
            issues.push({
                id: 'STRING_CONCAT_IN_LOOP',
                type: 'STRING_CONCAT_IN_LOOP',
                severity: 'medium',
                line: lineNum,
                message: 'Repeated string concatenation inside a loop. In BML, string concatenation re-allocates memory on every iteration.',
                suggestion: 'Use a string[] array or stringbuilder pattern, then combine using join() or a single concatenation after the loop.',
                codeSnippet: lines[lineNum - 1] ? lines[lineNum - 1].trim() : ''
            });
        }
    }

    // 4. Unbounded while loops: while (true)
    const unboundedRegex = /while\s*\(\s*(?:true|1\s*==\s*1)\s*\)/gi;
    while ((match = unboundedRegex.exec(code)) !== null) {
        const lineNum = findLineNumber(match.index);
        issues.push({
            id: 'UNBOUNDED_LOOP',
            type: 'UNBOUNDED_LOOP',
            severity: 'high',
            line: lineNum,
            message: 'Unbounded loop (while true) detected. If the break condition is skipped, this causes an infinite loop and server worker freeze.',
            suggestion: 'Implement an explicit iteration safety limit counter (e.g., if (counter > 1000) break;).',
            codeSnippet: lines[lineNum - 1] ? lines[lineNum - 1].trim() : match[0]
        });
    }

    // Calculate score (0-100)
    let deductions = 0;
    for (const issue of issues) {
        if (issue.severity === 'critical') deductions += 30;
        else if (issue.severity === 'high') deductions += 20;
        else if (issue.severity === 'medium') deductions += 10;
        else deductions += 5;
    }
    const score = Math.max(0, 100 - deductions);

    const summary = issues.length === 0
        ? 'No security vulnerabilities or anti-patterns detected. Code adheres to CPQ BML guidelines.'
        : `Found ${issues.length} potential issue(s): ${issues.filter(i => i.severity === 'critical').length} Critical, ${issues.filter(i => i.severity === 'high').length} High, ${issues.filter(i => i.severity === 'medium').length} Medium.`;

    return {
        success: true,
        score,
        passed: issues.length === 0,
        issueCount: issues.length,
        issuesCount: issues.length,
        issues,
        summary
    };
}

module.exports = { auditBmlCode };
