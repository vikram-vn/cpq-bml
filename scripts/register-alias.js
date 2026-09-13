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

function patchVscode(vs) {
  if (vs && vs.WorkspaceEdit && !vs.WorkspaceEdit.__cpq_patched) {
    vs.WorkspaceEdit.__cpq_patched = true;

    const editsMap = new WeakMap();
    const origReplace = vs.WorkspaceEdit.prototype.replace;
    const origInsert = vs.WorkspaceEdit.prototype.insert;
    const origDelete = vs.WorkspaceEdit.prototype.delete;

    if (origReplace) {
      vs.WorkspaceEdit.prototype.replace = function (uri, range, newText) {
        let list = editsMap.get(this);
        if (!list) {
          list = [];
          editsMap.set(this, list);
        }
        list.push({ type: 'replace', uri, range, newText });
        return origReplace.apply(this, arguments);
      };
    }

    if (origInsert) {
      vs.WorkspaceEdit.prototype.insert = function (uri, position, newText) {
        let list = editsMap.get(this);
        if (!list) {
          list = [];
          editsMap.set(this, list);
        }
        const range = vs.Range ? new vs.Range(position, position) : { start: position, end: position };
        list.push({ type: 'insert', uri, position, range, newText });
        return origInsert.apply(this, arguments);
      };
    }

    if (origDelete) {
      vs.WorkspaceEdit.prototype.delete = function (uri, range) {
        let list = editsMap.get(this);
        if (!list) {
          list = [];
          editsMap.set(this, list);
        }
        list.push({ type: 'delete', uri, range, newText: '' });
        return origDelete.apply(this, arguments);
      };
    }

    Object.defineProperty(vs.WorkspaceEdit.prototype, '_edits', {
      get() {
        const custom = editsMap.get(this);
        if (custom && custom.length > 0) return custom;
        if (Array.isArray(this.__internal_edits)) return this.__internal_edits;
        return [];
      },
      set(val) {
        this.__internal_edits = val;
      },
      configurable: true,
      enumerable: true,
    });
  }
}

try {
  patchVscode(require('vscode'));
} catch (_) {}



