const fs = require('fs');
const path = require('path');

/**
 * Computes cyclomatic complexity, maintainability index, nesting depth,
 * and CPQ timeout risks across workspace BML scripts.
 */
function calculateMetrics(code = '', filePath = '') {
  const lines = code.split(/\r?\n/);
  const loc = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('//')).length;

  // 1. Cyclomatic Complexity
  let complexity = 1;
  const branchPatterns = [
    /\bif\b/g,
    /\belif\b/g,
    /\bfor\b/g,
    /\bAND\b/g,
    /\bOR\b/g,
    /\?(?!=)/g
  ];

  for (const pattern of branchPatterns) {
    const matches = code.match(pattern);
    if (matches) complexity += matches.length;
  }

  // 2. Maximal Nesting Depth
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

  // 3. Halstead Volume Approximation & Maintainability Index (0 - 100)
  const tokens = code.match(/[a-zA-Z0-9_]+|[+\-*/%=<>!&|]+/g) || [];
  const uniqueTokens = new Set(tokens);
  const volume = Math.max(1, tokens.length * Math.log2(Math.max(2, uniqueTokens.size)));

  // Maintainability Index (MI): standard SEI formula normalized to 0-100
  const rawMi = 171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(Math.max(1, loc));
  const maintainabilityIndex = Math.max(0, Math.min(100, Math.round((rawMi * 100) / 171)));

  // 4. Timeout Threat: Loop nesting >= 2 or BMQL query within loops
  const hasLoopBmql = /\bfor\b[\s\S]*?\bSELECT\b[\s\S]*?\bFROM\b/i.test(code);
  const timeoutThreat = hasLoopBmql || (maxNesting >= 3 && complexity >= 12);

  // 5. Risk Categorization
  let risk = 'LOW';
  if (complexity >= 15 || maxNesting > 3 || timeoutThreat) {
    risk = 'HIGH';
  } else if (complexity >= 8 || maxNesting === 3) {
    risk = 'MEDIUM';
  }

  const hotspotScore = Math.round(complexity * Math.log(Math.max(2, loc)));

  return {
    filePath,
    name: path.basename(filePath || 'script.bml'),
    loc,
    complexity,
    nestingDepth: maxNesting,
    maintainabilityIndex,
    risk,
    timeoutThreat,
    hotspotScore
  };
}

function findBmlFiles(target) {
  const results = [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      results.push(...findBmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.bml') && !entry.name.endsWith('.test.bml')) {
      results.push(full);
    }
  }
  return results;
}

function scanWorkspaceFiles(workspaceRoot, dir = workspaceRoot) {
  if (!dir || !fs.existsSync(dir)) return [];
  const results = [];
  const files = findBmlFiles(dir);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(workspaceRoot, file).replace(/\\/g, '/');
      const metric = calculateMetrics(content, file);
      metric.relPath = relPath;
      results.push(metric);
    } catch {
      // Skip unreadable files
    }
  }
  return results;
}

function calculateDashboardData(results = []) {
  const totalFiles = results.length;
  const totalLoc = results.reduce((sum, r) => sum + r.loc, 0);
  const avgComplexity = totalFiles > 0
    ? Math.round((results.reduce((sum, r) => sum + r.complexity, 0) / totalFiles) * 10) / 10
    : 0;
  const avgMaintainability = totalFiles > 0
    ? Math.round(results.reduce((sum, r) => sum + r.maintainabilityIndex, 0) / totalFiles)
    : 100;

  const riskDistribution = {
    high: results.filter(r => r.risk === 'HIGH').length,
    medium: results.filter(r => r.risk === 'MEDIUM').length,
    low: results.filter(r => r.risk === 'LOW').length
  };

  const sortedFiles = [...results].sort((a, b) => b.hotspotScore - a.hotspotScore);

  return {
    totalFiles,
    totalLoc,
    avgComplexity,
    avgMaintainability,
    riskDistribution,
    files: sortedFiles
  };
}

function createComplexityAnalyzer(workspaceRoot) {
  let results = [];

  function scanWorkspace(dir = workspaceRoot) {
    results = scanWorkspaceFiles(workspaceRoot, dir);
  }

  function getDashboardData() {
    return calculateDashboardData(results);
  }

  return {
    workspaceRoot,
    get results() { return results; },
    scanWorkspace,
    getDashboardData
  };
}

function ComplexityAnalyzer(workspaceRoot) {
  return createComplexityAnalyzer(workspaceRoot);
}
ComplexityAnalyzer.calculateMetrics = calculateMetrics;

module.exports = {
  calculateMetrics,
  scanWorkspaceFiles,
  calculateDashboardData,
  createComplexityAnalyzer,
  ComplexityAnalyzer
};
