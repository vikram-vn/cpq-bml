let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      createTextEditorDecorationType: () => ({ dispose: () => {} }),
      createStatusBarItem: () => ({ show: () => {}, dispose: () => {} })
    },
    StatusBarAlignment: { Right: 2 },
    OverviewRulerLane: { Left: 1 }
  };
}

/**
 * Manages test coverage gutter heatmap and line highlights in the active editor.
 */
function createCoverageDecorator() {
  let enabled = true;
  const coverageMap = new Map();

  const coveredType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(78, 201, 176, 0.12)',
    overviewRulerColor: 'rgba(78, 201, 176, 0.6)',
    overviewRulerLane: vscode.OverviewRulerLane.Left
  });

  const uncoveredType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(241, 76, 76, 0.12)',
    overviewRulerColor: 'rgba(241, 76, 76, 0.6)',
    overviewRulerLane: vscode.OverviewRulerLane.Left
  });

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
  statusBarItem.command = 'cpqBml.toggleCoverage';

  function updateStatusBar() {
    if (!enabled) {
      statusBarItem.text = '$(circle-slash) BML Coverage: Off';
      statusBarItem.tooltip = 'Click to enable test coverage heatmap';
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document) {
      const currentPath = editor.document.uri.fsPath.replace(/\\/g, '/');
      const data = coverageMap.get(currentPath);
      if (data) {
        const total = data.covered.size + data.uncovered.size;
        const pct = total > 0 ? Math.round((data.covered.size / total) * 100) : 100;
        statusBarItem.text = `$(check) BML Coverage: ${pct}%`;
        statusBarItem.tooltip = `${data.covered.size} covered lines, ${data.uncovered.size} uncovered lines`;
        return;
      }
    }

    statusBarItem.text = '$(check) BML Coverage: Ready';
    statusBarItem.tooltip = 'Run BML unit tests to view coverage heatmap';
  }

  function updateActiveEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) return;

    if (!enabled) {
      editor.setDecorations(coveredType, []);
      editor.setDecorations(uncoveredType, []);
      return;
    }

    const currentPath = editor.document.uri.fsPath.replace(/\\/g, '/');
    const data = coverageMap.get(currentPath);

    if (!data) {
      editor.setDecorations(coveredType, []);
      editor.setDecorations(uncoveredType, []);
      return;
    }

    const coveredRanges = Array.from(data.covered).map(lineNum => {
      const lineIndex = Math.max(0, lineNum - 1);
      return new vscode.Range(lineIndex, 0, lineIndex, 0);
    });

    const uncoveredRanges = Array.from(data.uncovered).map(lineNum => {
      const lineIndex = Math.max(0, lineNum - 1);
      return new vscode.Range(lineIndex, 0, lineIndex, 0);
    });

    editor.setDecorations(coveredType, coveredRanges);
    editor.setDecorations(uncoveredType, uncoveredRanges);
  }

  function setCoverage(filePath, coveredLines = [], uncoveredLines = []) {
    const normalized = filePath.replace(/\\/g, '/');
    coverageMap.set(normalized, {
      covered: new Set(coveredLines),
      uncovered: new Set(uncoveredLines)
    });

    updateActiveEditor();
    updateStatusBar();
  }

  function toggle() {
    enabled = !enabled;
    updateActiveEditor();
    updateStatusBar();
    vscode.window.showInformationMessage(`BML Test Coverage Heatmap: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  function dispose() {
    coveredType.dispose();
    uncoveredType.dispose();
    statusBarItem.dispose();
  }

  updateStatusBar();
  statusBarItem.show();

  return {
    get enabled() { return enabled; },
    set enabled(val) { enabled = val; },
    coverageMap,
    coveredType,
    uncoveredType,
    statusBarItem,
    setCoverage,
    toggle,
    updateActiveEditor,
    updateStatusBar,
    dispose
  };
}

function CoverageDecorator() {
  return createCoverageDecorator();
}

let instance = null;

function getCoverageDecorator() {
  if (!instance) {
    instance = createCoverageDecorator();
  }
  return instance;
}

module.exports = {
  createCoverageDecorator,
  getCoverageDecorator,
  CoverageDecorator
};
