// A read-only "terminal" backed by VS Code's Pseudoterminal API, used to show
// debug results in the integrated terminal panel without ever executing them
// as shell input - unlike vscode.Terminal#sendText(), which types text into
// the real shell process (and would try to "run" whatever a debug result
// happens to contain).
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
        // Clears the screen and scrollback (xterm.js escape sequences), since
        // there is no dedicated "clear" call in the Pseudoterminal API itself.
        clear() {
            writeEmitter.fire('\x1b[2J\x1b[3J\x1b[H');
        },
        dispose() {
            terminal.dispose();
        }
    };
}

module.exports = { createResultsTerminal };
