let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { createTerminal: () => ({ show: () => {} }) },
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    EventEmitter: function() {
      this.event = () => {};
      this.fire = () => {};
    }
  };
}

const { createBmlReplSession } = require('./bmlReplSession');

function createBmlReplTerminal() {
  const session = createBmlReplSession();
  const writeEmitter = new vscode.EventEmitter();
  const onDidWrite = writeEmitter.event;
  const closeEmitter = new vscode.EventEmitter();
  const onDidClose = closeEmitter.event;

  let currentLine = '';
  let historyIndex = -1;
  const history = [];

  function write(text) {
    writeEmitter.fire(text);
  }

  function prompt() {
    write('\x1b[1;32m>>> \x1b[0m');
  }

  function open() {
    write('\r\n\x1b[1;36m=== Oracle CPQ BML Interactive REPL ===\x1b[0m\r\n');
    write('Type BML statements/expressions or \x1b[33m.help\x1b[0m for options.\r\n\r\n');
    prompt();
  }

  function close() {
    closeEmitter.fire();
  }

  function replaceLine(newLine) {
    while (currentLine.length > 0) {
      write('\b \b');
      currentLine = currentLine.slice(0, -1);
    }
    currentLine = newLine;
    write(newLine);
  }

  function handleInput(data) {
    if (data === '\r' || data === '\n') {
      write('\r\n');
      const line = currentLine.trim();

      if (line) {
        history.push(line);
        historyIndex = history.length;

        const res = session.execute(line);

        if (res.type === 'exit') {
          write('Exiting REPL.\r\n');
          close();
          return;
        }

        if (res.prints && res.prints.length > 0) {
          for (const p of res.prints) {
            write(`\x1b[90m[print]\x1b[0m ${p}\r\n`);
          }
        }

        if (res.type === 'result' && res.formatted) {
          write(`\x1b[36m=> ${res.formatted}\x1b[0m\r\n`);
        } else if (res.type === 'help' || res.type === 'system') {
          write(`\x1b[33m${res.text}\x1b[0m\r\n`);
        } else if (res.type === 'error') {
          write(`\x1b[31mError: ${res.error}\x1b[0m\r\n`);
        }
      }

      currentLine = '';
      prompt();
      return;
    }

    if (data === '\x7f' || data === '\b') {
      if (currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1);
        write('\b \b');
      }
      return;
    }

    if (data === '\x03') {
      write('^C\r\n');
      currentLine = '';
      prompt();
      return;
    }

    if (data === '\x1b[A') {
      if (history.length > 0 && historyIndex > 0) {
        historyIndex--;
        replaceLine(history[historyIndex]);
      }
      return;
    }

    if (data === '\x1b[B') {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        replaceLine(history[historyIndex]);
      } else {
        historyIndex = history.length;
        replaceLine('');
      }
      return;
    }

    currentLine += data;
    write(data);
  }

  return {
    session,
    writeEmitter,
    onDidWrite,
    closeEmitter,
    onDidClose,
    get currentLine() { return currentLine; },
    get history() { return history; },
    open,
    close,
    write,
    prompt,
    handleInput,
    replaceLine
  };
}

function BmlReplTerminal() {
  return createBmlReplTerminal();
}

let activeTerminal = null;

function registerReplCommand(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.openRepl', () => {
    const pty = createBmlReplTerminal();
    activeTerminal = vscode.window.createTerminal({
      name: 'BML REPL',
      pty
    });
    activeTerminal.show();
  });

  context.subscriptions.push(disposable);
}

module.exports = {
  createBmlReplTerminal,
  BmlReplTerminal,
  registerReplCommand
};
