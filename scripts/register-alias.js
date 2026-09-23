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
  if (!vs || !vs.WorkspaceEdit || vs.WorkspaceEdit.__cpq_patched) return;
  vs.WorkspaceEdit.__cpq_patched = true;

  const origReplace = vs.WorkspaceEdit.prototype.replace;
  const origInsert = vs.WorkspaceEdit.prototype.insert;
  const origDelete = vs.WorkspaceEdit.prototype.delete;

  if (origReplace) {
    vs.WorkspaceEdit.prototype.replace = function (uri, range, newText) {
      origReplace.apply(this, arguments);
      if (Array.isArray(this._edits) && this._edits.length > 0) {
        const last = this._edits[this._edits.length - 1];
        if (last && typeof last === 'object' && !('newText' in last)) {
          last.newText = newText;
          last.range = range;
          last.uri = uri;
          last.type = 'replace';
        }
      }
    };
  }

  if (origInsert) {
    vs.WorkspaceEdit.prototype.insert = function (uri, position, newText) {
      origInsert.apply(this, arguments);
      if (Array.isArray(this._edits) && this._edits.length > 0) {
        const last = this._edits[this._edits.length - 1];
        if (last && typeof last === 'object' && !('newText' in last)) {
          last.newText = newText;
          last.position = position;
          last.uri = uri;
          last.type = 'insert';
        }
      }
    };
  }

  if (origDelete) {
    vs.WorkspaceEdit.prototype.delete = function (uri, range) {
      origDelete.apply(this, arguments);
      if (Array.isArray(this._edits) && this._edits.length > 0) {
        const last = this._edits[this._edits.length - 1];
        if (last && typeof last === 'object' && !('newText' in last)) {
          last.newText = '';
          last.range = range;
          last.uri = uri;
          last.type = 'delete';
        }
      }
    };
  }
}

try {
  patchVscode(require('vscode'));
} catch (_) {}



