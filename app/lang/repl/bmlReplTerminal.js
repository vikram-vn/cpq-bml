let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { createTerminal: () => ({ show: () => {} }) },
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    EventEmitter: class { event = () => {}; fire() {} }
  };
}

const { BmlReplSession } = require('./bmlReplSession');

/**
 * Interactive VS Code Pseudoterminal for the BML REPL.
 */
class BmlReplTerminal {
  constructor() {
    this.session = new BmlReplSession();
    this.writeEmitter = new vscode.EventEmitter();
    this.onDidWrite = this.writeEmitter.event;
    this.closeEmitter = new vscode.EventEmitter();
    this.onDidClose = this.closeEmitter.event;

    this.currentLine = '';
    this.historyIndex = -1;
    this.history = [];
  }

  open() {
    this.write('\r\n\x1b[1;36m=== Oracle CPQ BML Interactive REPL ===\x1b[0m\r\n');
    this.write('Type BML statements/expressions or \x1b[33m.help\x1b[0m for options.\r\n\r\n');
    this.prompt();
  }

  close() {
    this.closeEmitter.fire();
  }

  write(text) {
    this.writeEmitter.fire(text);
  }

  prompt() {
    this.write('\x1b[1;32m>>> \x1b[0m');
  }

  handleInput(data) {
    // Handle Enter
    if (data === '\r' || data === '\n') {
      this.write('\r\n');
      const line = this.currentLine.trim();

      if (line) {
        this.history.push(line);
        this.historyIndex = this.history.length;

        const res = this.session.execute(line);

        if (res.type === 'exit') {
          this.write('Exiting REPL.\r\n');
          this.close();
          return;
        }

        // Print stdout if any prints occurred
        if (res.prints && res.prints.length > 0) {
          for (const p of res.prints) {
            this.write(`\x1b[90m[print]\x1b[0m ${p}\r\n`);
          }
        }

        if (res.type === 'result' && res.formatted) {
          this.write(`\x1b[36m=> ${res.formatted}\x1b[0m\r\n`);
        } else if (res.type === 'help' || res.type === 'system') {
          this.write(`\x1b[33m${res.text}\x1b[0m\r\n`);
        } else if (res.type === 'error') {
          this.write(`\x1b[31mError: ${res.error}\x1b[0m\r\n`);
        }
      }

      this.currentLine = '';
      this.prompt();
      return;
    }

    // Handle Backspace
    if (data === '\x7f' || data === '\b') {
      if (this.currentLine.length > 0) {
        this.currentLine = this.currentLine.slice(0, -1);
        this.write('\b \b');
      }
      return;
    }

    // Handle Ctrl+C
    if (data === '\x03') {
      this.write('^C\r\n');
      this.currentLine = '';
      this.prompt();
      return;
    }

    // Handle Arrow Keys (History recall)
    if (data === '\x1b[A') { // Up Arrow
      if (this.history.length > 0 && this.historyIndex > 0) {
        this.historyIndex--;
        this.replaceLine(this.history[this.historyIndex]);
      }
      return;
    }

    if (data === '\x1b[B') { // Down Arrow
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.replaceLine(this.history[this.historyIndex]);
      } else {
        this.historyIndex = this.history.length;
        this.replaceLine('');
      }
      return;
    }

    // Normal typing
    this.currentLine += data;
    this.write(data);
  }

  replaceLine(newLine) {
    while (this.currentLine.length > 0) {
      this.write('\b \b');
      this.currentLine = this.currentLine.slice(0, -1);
    }
    this.currentLine = newLine;
    this.write(newLine);
  }
}

let activeTerminal = null;

function registerReplCommand(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.openRepl', () => {
    const pty = new BmlReplTerminal();
    activeTerminal = vscode.window.createTerminal({
      name: 'BML REPL',
      pty
    });
    activeTerminal.show();
  });

  context.subscriptions.push(disposable);
}

module.exports = { BmlReplTerminal, registerReplCommand };
