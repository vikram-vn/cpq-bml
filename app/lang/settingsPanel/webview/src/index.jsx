import { createRoot } from 'react-dom/client';
import App from './App';

// Surfaces fatal errors as visible text instead of a silent blank webview.
function showFatalError(error) {
    const root = document.getElementById('root');
    if (!root) return;
    const message = (error && (error.stack || error.message)) || String(error);
    // No inline styles - must stay valid under the page's strict CSP.
    root.textContent = '';
    const pre = document.createElement('pre');
    pre.className = 'fatal-error';
    pre.textContent = 'CPQ-BML Connection Settings failed to start:\n\n' + message;
    root.appendChild(pre);
}

window.addEventListener('error', (event) => showFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
    const vscodeApi = acquireVsCodeApi();
    const root = createRoot(document.getElementById('root'));
    root.render(<App vscodeApi={vscodeApi} />);
} catch (err) {
    showFatalError(err);
}
