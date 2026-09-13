'use strict';

let api = null;

/**
 * Returns a singleton instance of the VS Code Webview API.
 * Ensures acquireVsCodeApi() is called exactly once.
 */
export function getVsCodeApi() {
  if (!api) {
    if (typeof acquireVsCodeApi === 'function') {
      api = acquireVsCodeApi();
    } else {
      api = {
        postMessage: (msg) => {
          if (typeof window !== 'undefined' && window.parent) {
            window.parent.postMessage(msg, '*');
          }
        },
        getState: () => ({}),
        setState: () => {}
      };
    }
  }
  return api;
}

export default getVsCodeApi;
