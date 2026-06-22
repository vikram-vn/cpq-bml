// Read-only Pseudoterminal — unlike Terminal#sendText(), it never executes its output as shell input.
function createResultsTerminal(vscode, name) {
    const writeEmitter = new vscode.EventEmitter();
    const pty = {
        onDidWrite: writeEmitter.event,
        open() {},
        close() {},
        handleInput() {} // read-only: ignore anything the user types into it
    };
    const terminal = vscode.window.createTerminal({ name, pty });

    return {
        writeLine(text) {
            writeEmitter.fire(`${text}\r\n`);
        },
        show() {
            terminal.show(true);
        },
        // xterm.js escape sequences — Pseudoterminal API has no dedicated clear call.
        clear() {
            writeEmitter.fire('\x1b[2J\x1b[3J\x1b[H');
        },
        dispose() {
            terminal.dispose();
        }
    };
}

let sharedResultsTerminal = null;

function getResultsTerminal(vscode) {
    if (!sharedResultsTerminal) {
        sharedResultsTerminal = createResultsTerminal(vscode, 'CPQ-BML');
    }
    return sharedResultsTerminal;
}

module.exports = { createResultsTerminal, getResultsTerminal };
