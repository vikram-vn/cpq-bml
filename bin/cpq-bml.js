#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { auditBmlCode } = require('../app/lang/mcp/tools/audit');
const { validateBmqlQuery } = require('../app/lang/mcp/tools/bmqlValidator');
const packageJson = require('../package.json');

const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.vscode', '.vscode-test', 'dist', 'out', 'build',
    '.gemini', 'scratch', 'logs', 'coverage', '.github', 'test', 'tests'
]);

function showHelp() {
    console.log(`
CPQ-BML Command Line Interface (v${packageJson.version})

Usage:
  cpq-bml <command> [options]

Commands:
  audit [path]       Scan BML file(s) for security issues, injection risks, and anti-patterns.
                     Path defaults to current directory.
                     Options:
                       --format=pretty|json   Output format (default: pretty)
                       --min-score=<0-100>    Minimum passing audit score (default: 70)
                       --fail-on=error|warn   Fail on warnings or only critical/error (default: error)

  profile [path]     Scan BML file(s) for execution bottlenecks, while loops, and timeout risks.
                     Path defaults to current directory.

  validate <query>   Validate a BMQL query offline against CPQ syntax standards.
                     Example: cpq-bml validate "SELECT sku, price FROM Parts WHERE active = $isActive"

  help, --help, -h   Show this help message.
  --version, -v      Show CLI version.

Exit Codes:
  0  Success, no critical violations found.
  1  Audit failures or invalid BMQL query detected.
`);
}

function collectBmlFiles(targetPath, fileList = []) {
    if (!fs.existsSync(targetPath)) return fileList;
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
        if (targetPath.endsWith('.bml') || targetPath.endsWith('.util')) {
            fileList.push(targetPath);
        }
        return fileList;
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(targetPath, entry.name);
        if (entry.isDirectory()) {
            if (!IGNORED_DIRS.has(entry.name)) {
                collectBmlFiles(fullPath, fileList);
            }
        } else if (entry.isFile() && (entry.name.endsWith('.bml') || entry.name.endsWith('.util'))) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function runAudit(args) {
    let targetPath = '.';
    let format = 'pretty';
    let minScore = 70;
    let failOn = 'error';

    for (const arg of args) {
        if (arg.startsWith('--format=')) {
            format = arg.split('=')[1].toLowerCase();
        } else if (arg.startsWith('--min-score=')) {
            minScore = parseInt(arg.split('=')[1], 10) || 70;
        } else if (arg.startsWith('--fail-on=')) {
            failOn = arg.split('=')[1].toLowerCase();
        } else if (!arg.startsWith('--')) {
            targetPath = arg;
        }
    }

    const files = collectBmlFiles(path.resolve(process.cwd(), targetPath));
    if (files.length === 0) {
        console.log(`No .bml or .util files found in: ${targetPath}`);
        process.exit(0);
    }

    const results = [];
    let hasFailures = false;

    for (const filePath of files) {
        let code = '';
        try {
            code = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            continue;
        }

        const audit = auditBmlCode({ code });
        const relPath = path.relative(process.cwd(), filePath);
        const fileResult = {
            file: relPath,
            score: audit.score,
            status: audit.status,
            issues: audit.issues || []
        };
        results.push(fileResult);

        if (audit.score < minScore) {
            hasFailures = true;
        }
        for (const issue of fileResult.issues) {
            if (issue.severity === 'critical' || issue.severity === 'high') {
                hasFailures = true;
            } else if (failOn === 'warn' && issue.severity === 'medium') {
                hasFailures = true;
            }
        }
    }

    if (format === 'json') {
        console.log(JSON.stringify({
            summary: {
                totalFiles: files.length,
                minScore,
                passed: !hasFailures
            },
            results
        }, null, 2));
    } else {
        console.log(`\nCPQ-BML Security & Quality Audit Report`);
        console.log(`Scanned ${files.length} file(s) across: ${targetPath}\n`);

        for (const res of results) {
            const scoreTag = res.score >= 85 ? `[PASS: ${res.score}/100]` : `[FAIL: ${res.score}/100]`;
            console.log(`${scoreTag} ${res.file}`);
            if (res.issues.length === 0) {
                console.log(`  ✓ No issues found.\n`);
            } else {
                for (const issue of res.issues) {
                    const sev = issue.severity.toUpperCase().padEnd(8);
                    console.log(`  [${sev}] Line ${issue.line}: ${issue.message}`);
                    if (issue.suggestion) {
                        console.log(`            Suggestion: ${issue.suggestion}`);
                    }
                }
                console.log('');
            }
        }

        if (hasFailures) {
            console.error(`Audit FAILED: One or more files violated security standards or fell below score ${minScore}.`);
        } else {
            console.log(`Audit PASSED: All ${files.length} files conform to CPQ security and quality standards.`);
        }
    }

    process.exit(hasFailures ? 1 : 0);
}

function runValidate(args) {
    const query = args.filter(a => !a.startsWith('--')).join(' ');
    if (!query) {
        console.error('Error: Please provide a BMQL query string to validate.');
        console.error('Example: cpq-bml validate "SELECT partNumber FROM Parts WHERE active = $isActive"');
        process.exit(1);
    }

    const result = validateBmqlQuery({ query });

    console.log(`\nBMQL Query Validation Report:`);
    console.log(`Status:      ${result.isValid ? 'VALID ✓' : 'INVALID ✗'}`);
    console.log(`Table:       ${result.tableName || 'N/A'}`);
    console.log(`Columns:     ${result.columns.join(', ') || 'None'}`);
    console.log(`Parameters:  ${result.parameters.map(p => '$' + p).join(', ') || 'None'}`);
    console.log(`Explanation: ${result.explanation}\n`);

    if (result.issues.length > 0) {
        console.log('Issues:');
        for (const issue of result.issues) {
            console.log(`  [${issue.severity.toUpperCase()}] ${issue.message}`);
            if (issue.explanation) {
                console.log(`    Note: ${issue.explanation}`);
            }
        }
        console.log('');
    }

    process.exit(result.isValid ? 0 : 1);
}

function runProfile(args) {
    const targetPath = args.length > 0 && !args[0].startsWith('--') ? args[0] : '.';
    const files = collectBmlFiles(path.resolve(process.cwd(), targetPath));
    if (files.length === 0) {
        console.log(`No .bml or .util files found to profile in: ${targetPath}`);
        process.exit(0);
    }

    console.log(`Profiling ${files.length} file(s) for performance & timeout bottlenecks...\n`);
    let hasCriticalIssues = false;

    for (const filePath of files) {
        try {
            const code = fs.readFileSync(filePath, 'utf8');
            const issues = BmlProfiler.profile(code);
            const rel = path.relative(process.cwd(), filePath);

            if (issues.length > 0) {
                console.log(`[PROFILE] ${rel} (${issues.length} issue(s)):`);
                for (const issue of issues) {
                    const tag = issue.severity.toUpperCase();
                    console.log(`  - [${tag}] Line ${issue.line}: ${issue.message}`);
                    if (issue.severity === 'error') hasCriticalIssues = true;
                }
                console.log('');
            }
        } catch {
            // Ignored
        }
    }

    if (!hasCriticalIssues) {
        console.log('Profile passed: No critical BML timeout antipatterns found.');
        process.exit(0);
    } else {
        console.error('Profile failed: Critical performance/timeout antipatterns detected.');
        process.exit(1);
    }
}

function main() {
    const rawArgs = process.argv.slice(2);
    if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h') || rawArgs[0] === 'help') {
        showHelp();
        process.exit(0);
    }

    if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
        console.log(`cpq-bml v${packageJson.version}`);
        process.exit(0);
    }

    const command = rawArgs[0];
    const subArgs = rawArgs.slice(1);

    switch (command) {
        case 'audit':
            runAudit(subArgs);
            break;
        case 'profile':
            runProfile(subArgs);
            break;
        case 'validate':
            runValidate(subArgs);
            break;
        default:
            console.error(`Unknown command: "${command}". Run "cpq-bml --help" for usage.`);
            process.exit(1);
    }
}

main();
