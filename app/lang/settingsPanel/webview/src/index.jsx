import { createRoot } from 'react-dom/client';
import App from './App';

// If anything here throws - a CSP block, a bundling issue, a React error -
// surface it as visible text in the panel itself instead of leaving a silent
// blank page, since this runs inside a sandboxed webview where opening
// devtools is an extra step most users won't know to take.
function showFatalError(error) {
    const root = document.getElementById('root');
    if (!root) return;
    const message = (error && (error.stack || error.message)) || String(error);
    // No inline styles here (even via the JS .style API) - this fallback must
    // render under the same strict CSP as everything else, so it relies only
    // on default text rendering plus the .fatal-error class from main.css.
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
