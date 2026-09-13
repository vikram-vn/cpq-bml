const vscodeModule = require('vscode');

class BmlCodeLensProvider {
  constructor(vscodeInstance = vscodeModule) {
    this.vscode = vscodeInstance;
    this._onDidChangeCodeLenses = new this.vscode.EventEmitter();
    this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  }

  refresh() {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document, token) {
    if (token && token.isCancellationRequested) return [];
    if (!document) return [];

    const isEnabled = this.vscode.workspace?.getConfiguration
      ? this.vscode.workspace.getConfiguration('cpqBml').get('features.codeLens', true)
      : true;

    if (!isEnabled) return [];

    const codeLenses = [];
    const text = document.getText();
    if (!text || !text.trim()) return [];

    const CodeLensClass = this.vscode.CodeLens || class CodeLens {
      constructor(range, command) {
        this.range = range;
        this.command = command;
      }
    };
    const RangeClass = this.vscode.Range || class Range {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    };
    const PositionClass = this.vscode.Position || class Position {
      constructor(line, character) {
        this.line = line;
        this.character = character;
      }
    };

    // 1. Top of file CodeLens (Server Debug, Quote Debug, Diff, Safety Check)
    const topRange = new RangeClass(
      new PositionClass(0, 0),
      new PositionClass(0, 0)
    );

    codeLenses.push(
      new CodeLensClass(topRange, {
        title: '$(debug-alt) Debug on Cloud',
        command: 'cpqBml.rest.debugCurrentFile',
        tooltip: 'Debug this BML script directly on the active CPQ server'
      }),
      new CodeLensClass(topRange, {
        title: '$(history) Debug with Quote...',
        command: 'cpqBml.cloud.debugWithQuote',
        tooltip: 'Select a recent transaction/quote to debug this script against'
      }),
      new CodeLensClass(topRange, {
        title: '$(diff) Diff with Server',
        command: 'cpqBml.cloud.diffFunction',
        tooltip: 'Compare local file with the server copy deployed on CPQ'
      }),
      new CodeLensClass(topRange, {
        title: '$(shield) Safety Check',
        command: 'cpqBml.rest.preflightCheck',
        tooltip: 'Run pre-flight impact check on callers and dependencies'
      })
    );

    // 2. BMQL Inline CodeLens (above each bmql query)
    const bmqlRegex = /\bbmql\s*\(\s*(["'])([\s\S]*?)\1\s*\)/g;
    let match;
    while ((match = bmqlRegex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      const queryRange = new RangeClass(pos, pos);
      const queryContent = match[2].trim();

      codeLenses.push(
        new CodeLensClass(queryRange, {
          title: '$(play) Run BMQL Live',
          command: 'cpqBml.bmql.runAtCursor',
          arguments: [{ query: queryContent }],
          tooltip: `Execute "${queryContent.slice(0, 50)}..." live against CPQ Data Tables`
        })
      );
    }

    return codeLenses;
  }
}

function registerBmlCodeLensProvider(context, vscodeInstance = vscodeModule) {
  const provider = new BmlCodeLensProvider(vscodeInstance);

  const bmlReg = vscodeInstance.languages.registerCodeLensProvider({ language: 'bml' }, provider);
  const bmltReg = vscodeInstance.languages.registerCodeLensProvider({ language: 'bmlt' }, provider);

  if (context && context.subscriptions) {
    context.subscriptions.push(bmlReg, bmltReg);
  }

  return { provider, bmlReg, bmltReg };
}

module.exports = {
  BmlCodeLensProvider,
  registerBmlCodeLensProvider
};
