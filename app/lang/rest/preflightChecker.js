let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    languages: { getDiagnostics: () => [] },
    window: { showInformationMessage: () => {}, showWarningMessage: () => {}, showErrorMessage: () => {} },
    workspace: { workspaceFolders: [], openTextDocument: () => {} }
  };
}

const fs = require('fs');
const path = require('path');
const api = require('./api');
const metadataLib = require('./metadata');

async function checkServerValidation(filePath, code, metadata, vscodeInstance = vscode, context) {
  const startedAt = Date.now();
  try {
    const payload = {
      ...(metadata || {}),
      scriptText: code,
      variableName: metadata?.variableName || metadataLib.variableNameFromBmlPath(filePath)
    };

    const res = await api.validateLibraryFunction(context, vscodeInstance, payload);
    const elapsedMs = Date.now() - startedAt;

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        passed: true,
        message: `Validation passed on CPQ Cloud (${elapsedMs}ms).`,
        elapsedMs
      };
    } else {
      const err = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
      return {
        passed: false,
        message: `Server returned HTTP ${res.statusCode}: ${err || 'Syntax or validation error.'}`,
        elapsedMs
      };
    }
  } catch (err) {
    return {
      passed: false,
      message: `Could not reach CPQ validation endpoint: ${err.message}`,
      elapsedMs: Date.now() - startedAt
    };
  }
}

function calculateMetrics(code = '') {
  const lines = code.split(/\r?\n/);
  const loc = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('//')).length;

  let cyclomaticComplexity = 1;
  const branchPatterns = [/\bif\b/g, /\belif\b/g, /\bfor\b/g, /\bAND\b/g, /\bOR\b/g, /\?(?!=)/g];
  for (const pattern of branchPatterns) {
    const matches = code.match(pattern);
    if (matches) cyclomaticComplexity += matches.length;
  }

  let maxNesting = 0;
  let currentNesting = 0;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') {
      currentNesting++;
      if (currentNesting > maxNesting) maxNesting = currentNesting;
    } else if (ch === '}') {
      if (currentNesting > 0) currentNesting--;
    }
  }

  const tokens = code.match(/[a-zA-Z0-9_]+|[+\-*/%=<>!&|]+/g) || [];
  const uniqueTokens = new Set(tokens);
  const volume = Math.max(1, tokens.length * Math.log2(Math.max(2, uniqueTokens.size)));
  const rawMi = 171 - 5.2 * Math.log(volume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(Math.max(1, loc));
  const maintainabilityIndex = Math.max(0, Math.min(100, Math.round((rawMi * 100) / 171)));

  const hasLoopBmql = /\bfor\b[\s\S]*?\b(?:SELECT|MODIFY)\b[\s\S]*?\bFROM\b/i.test(code);
  const timeoutThreat = hasLoopBmql || (maxNesting >= 3 && cyclomaticComplexity >= 12);

  return {
    loc,
    cyclomaticComplexity,
    nestingDepth: maxNesting,
    maintainabilityIndex,
    timeoutThreat
  };
}

function checkComplexityAndThreats(code) {
  const metrics = calculateMetrics(code);
  const warnings = [];

  if (metrics.cyclomaticComplexity > 25) {
    warnings.push(`High Cyclomatic Complexity (${metrics.cyclomaticComplexity} > 25) - consider refactoring.`);
  }

  if (metrics.nestingDepth > 5) {
    warnings.push(`Deep control-flow nesting depth (${metrics.nestingDepth} levels) - risks cognitive complexity.`);
  }

  if (metrics.timeoutThreat) {
    warnings.push('CRITICAL: Detected BMQL query executed inside a loop - high CPQ server timeout threat!');
  }

  if (metrics.maintainabilityIndex < 60) {
    warnings.push(`Low Maintainability Index (${metrics.maintainabilityIndex.toFixed(1)}/100).`);
  }

  return {
    passed: !metrics.timeoutThreat,
    metrics,
    warnings
  };
}

function analyzeWorkspaceImpact(varName, workspaceRoot) {
  if (!workspaceRoot || !varName) {
    return { callersCount: 0, callers: [] };
  }

  const callers = [];
  const searchPattern = new RegExp(`\\b(util\\.)?${varName}\\b`, 'i');

  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.bml') || entry.name.endsWith('.bmlt'))) {
          // Avoid matching self
          if (path.basename(fullPath).toLowerCase().startsWith(varName.toLowerCase())) continue;

          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (searchPattern.test(lines[i])) {
                callers.push({
                  file: path.relative(workspaceRoot, fullPath).replace(/\\/g, '/'),
                  line: i + 1,
                  snippet: lines[i].trim()
                });
                break; // One reference per file is enough for summary
              }
            }
          } catch {
            // Ignore file read error
          }
        }
      }
    } catch {
      // Ignore directory read error
    }
  }

  scanDir(workspaceRoot);
  return {
    callersCount: callers.length,
    callers
  };
}

/**
 * Stage 4: Checks active file diagnostic errors from language server / linter.
 */
function checkDiagnostics(filePath, vscodeInstance = vscode) {
  if (!vscodeInstance.languages || !vscodeInstance.languages.getDiagnostics) {
    return { errorCount: 0, warningCount: 0, issues: [] };
  }

  const uri = vscodeInstance.Uri ? vscodeInstance.Uri.file(filePath) : null;
  if (!uri) return { errorCount: 0, warningCount: 0, issues: [] };

  const diags = vscodeInstance.languages.getDiagnostics(uri) || [];
  const errors = diags.filter(d => d.severity === 0 || d.severity === 'Error');
  const warnings = diags.filter(d => d.severity === 1 || d.severity === 'Warning');

  return {
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: diags.map(d => `L${(d.range?.start?.line || 0) + 1}: ${d.message}`)
  };
}

async function runPreflightSafetyCheck(filePath, vscodeInstance = vscode, context) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const code = fs.readFileSync(filePath, 'utf8');
  const varName = metadataLib.variableNameFromBmlPath(filePath);

  const folders = vscodeInstance.workspace?.workspaceFolders;
  const wsRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : path.dirname(filePath);

  let metadata = null;
  const metaPath = metadataLib.bmlPathToMetaPath(filePath);
  if (fs.existsSync(metaPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {}
  }

  // 1. Server validation
  const server = await checkServerValidation(filePath, code, metadata, vscodeInstance, context);

  // 2. Complexity & timeout threats
  const complexity = checkComplexityAndThreats(code);

  // 3. Workspace impact analysis
  const impact = analyzeWorkspaceImpact(varName, wsRoot);

  // 4. Linter diagnostics
  const diagnostics = checkDiagnostics(filePath, vscodeInstance);

  const canDeploy = server.passed && complexity.passed && diagnostics.errorCount === 0;

  const warnings = [...complexity.warnings];
  if (diagnostics.warningCount > 0) {
    warnings.push(`${diagnostics.warningCount} local linter warning(s) present.`);
  }

  return {
    canDeploy,
    functionName: varName,
    server,
    complexity,
    impact,
    diagnostics,
    warnings
  };
}

function formatPreflightSummary(report) {
  const lines = [];
  lines.push(`=== Pre-Flight Safety Report: ${report.functionName} ===`);
  lines.push(`Server Validation: ${report.server.passed ? 'PASSED [OK]' : 'FAILED [ERROR]'}`);
  lines.push(`  * ${report.server.message}`);
  lines.push(`Complexity & Maintainability: ${report.complexity.passed ? 'HEALTHY' : 'WARNING'}`);
  lines.push(`  * Cyclomatic Complexity: ${report.complexity.metrics.cyclomaticComplexity}`);
  lines.push(`  * Maintainability Index: ${report.complexity.metrics.maintainabilityIndex.toFixed(1)}/100`);
  lines.push(`Workspace Impact: Referenced in ${report.impact.callersCount} other file(s)`);
  for (const c of report.impact.callers.slice(0, 5)) {
    lines.push(`    - ${c.file} (Line ${c.line})`);
  }
  if (report.impact.callersCount > 5) {
    lines.push(`    ... and ${report.impact.callersCount - 5} more file(s)`);
  }

  if (report.warnings.length > 0) {
    lines.push(`Warnings (${report.warnings.length}):`);
    for (const w of report.warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  checkServerValidation,
  checkComplexityAndThreats,
  analyzeWorkspaceImpact,
  checkDiagnostics,
  runPreflightSafetyCheck,
  formatPreflightSummary
};
