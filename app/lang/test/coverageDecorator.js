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
class CoverageDecorator {
  constructor() {
    this.enabled = true;
    this.coverageMap = new Map(); // filePath -> { covered: Set<number>, uncovered: Set<number> }

    this.coveredType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(78, 201, 176, 0.12)',
      overviewRulerColor: 'rgba(78, 201, 176, 0.6)',
      overviewRulerLane: vscode.OverviewRulerLane.Left
    });

    this.uncoveredType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(241, 76, 76, 0.12)',
      overviewRulerColor: 'rgba(241, 76, 76, 0.6)',
      overviewRulerLane: vscode.OverviewRulerLane.Left
    });

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
    this.statusBarItem.command = 'cpqBml.toggleCoverage';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  setCoverage(filePath, coveredLines = [], uncoveredLines = []) {
    const normalized = filePath.replace(/\\/g, '/');
    this.coverageMap.set(normalized, {
      covered: new Set(coveredLines),
      uncovered: new Set(uncoveredLines)
    });

    this.updateActiveEditor();
    this.updateStatusBar();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.updateActiveEditor();
    this.updateStatusBar();
    vscode.window.showInformationMessage(`BML Test Coverage Heatmap: ${this.enabled ? 'Enabled' : 'Disabled'}`);
  }

  updateActiveEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) return;

    if (!this.enabled) {
      editor.setDecorations(this.coveredType, []);
      editor.setDecorations(this.uncoveredType, []);
      return;
    }

    const currentPath = editor.document.uri.fsPath.replace(/\\/g, '/');
    const data = this.coverageMap.get(currentPath);

    if (!data) {
      editor.setDecorations(this.coveredType, []);
      editor.setDecorations(this.uncoveredType, []);
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

    editor.setDecorations(this.coveredType, coveredRanges);
    editor.setDecorations(this.uncoveredType, uncoveredRanges);
  }

  updateStatusBar() {
    if (!this.enabled) {
      this.statusBarItem.text = '$(circle-slash) BML Coverage: Off';
      this.statusBarItem.tooltip = 'Click to enable test coverage heatmap';
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document) {
      const currentPath = editor.document.uri.fsPath.replace(/\\/g, '/');
      const data = this.coverageMap.get(currentPath);
      if (data) {
        const total = data.covered.size + data.uncovered.size;
        const pct = total > 0 ? Math.round((data.covered.size / total) * 100) : 100;
        this.statusBarItem.text = `$(check) BML Coverage: ${pct}%`;
        this.statusBarItem.tooltip = `${data.covered.size} covered lines, ${data.uncovered.size} uncovered lines`;
        return;
      }
    }

    this.statusBarItem.text = '$(check) BML Coverage: Ready';
    this.statusBarItem.tooltip = 'Run BML unit tests to view coverage heatmap';
  }

  dispose() {
    this.coveredType.dispose();
    this.uncoveredType.dispose();
    this.statusBarItem.dispose();
  }
}

let instance = null;

function getCoverageDecorator() {
  if (!instance) {
    instance = new CoverageDecorator();
  }
  return instance;
}

module.exports = { CoverageDecorator, getCoverageDecorator };
