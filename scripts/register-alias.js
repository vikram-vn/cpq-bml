const path = require('path');
const Module = require('module');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const origResolve = Module._resolveFilename;

if (!global.__cpq_alias_registered) {
  global.__cpq_alias_registered = true;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'vscode') {
      try {
        return origResolve.call(this, request, parent, isMain, options);
      } catch (e) {
        return path.join(ROOT, 'test', 'mockVscode.js');
      }
    }
    if (request.startsWith('@/')) {
      const sub = request.slice(2);
      const appTarget = path.join(ROOT, 'app', sub);
      if (fs.existsSync(appTarget) || fs.existsSync(appTarget + '.js') || fs.existsSync(appTarget + '.json') || fs.existsSync(path.join(appTarget, 'index.js'))) {
        request = appTarget;
      } else {
        request = path.join(ROOT, sub);
      }
    }
    return origResolve.call(this, request, parent, isMain, options);
  };
}
