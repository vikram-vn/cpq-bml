import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

function showFatalError(error) {
    const root = document.getElementById('root');
    if (!root) return;
    const message = (error && (error.stack || error.message)) || String(error);
    root.textContent = '';
    const pre = document.createElement('pre');
    pre.className = 'fatal-error';
    pre.textContent = 'CPQ-BML Architecture Graph failed to start:\n\n' + message;
    root.appendChild(pre);
}

window.addEventListener('error', (event) => showFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
    const vscodeApi = acquireVsCodeApi();
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(<App vscodeApi={vscodeApi} />);
} catch (err) {
    showFatalError(err);
}
