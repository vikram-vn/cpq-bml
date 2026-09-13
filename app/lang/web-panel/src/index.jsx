import React from 'react';
import { createRoot } from 'react-dom/client';
import WebPanelApp from './WebPanelApp';
import { getVsCodeApi } from './vscodeApi';

function showFatalError(error) {
  const root = document.getElementById('root');
  if (!root) return;
  const message = (error && (error.stack || error.message)) || String(error);
  root.textContent = '';
  const pre = document.createElement('pre');
  pre.style.color = '#f44336';
  pre.style.padding = '16px';
  pre.style.fontFamily = 'monospace';
  pre.textContent = 'CPQ-BML Web-Panel failed to load:\n\n' + message;
  root.appendChild(pre);
}

window.addEventListener('error', (event) => showFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  const vscodeApi = getVsCodeApi();
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<WebPanelApp vscodeApi={vscodeApi} />);
  }
} catch (err) {
  showFatalError(err);
}
