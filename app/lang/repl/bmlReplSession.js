const vm = require('vm');
const { createBmlSandbox, preprocessBmlForJs } = require('../evaluator/bmlEvaluator');

/**
 * Stateful BML REPL execution engine.
 * Maintains variables across command evaluations.
 */
function formatReplValue(val) {
  if (val === undefined) return null;
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}" (String)`;
  if (typeof val === 'number') {
    return Number.isInteger(val) ? `${val} (Integer)` : `${val} (Float)`;
  }
  if (typeof val === 'boolean') return `${val} (Boolean)`;
  if (Array.isArray(val)) return `${JSON.stringify(val)} (Array[${val.length}])`;
  if (typeof val === 'object') return `${JSON.stringify(val, null, 2)}`;
  return String(val);
}

function createBmlReplSession() {
  let stdout = [];
  let sandbox = createBmlSandbox(stdout);
  let history = [];
  let userVarNames = new Set();

  function reset() {
    stdout = [];
    sandbox = createBmlSandbox(stdout);
    history = [];
    userVarNames = new Set();
  }

  function getVariables() {
    const vars = {};
    for (const name of userVarNames) {
      if (sandbox[name] !== undefined) {
        const val = sandbox[name];
        let type = typeof val;
        if (val === null) type = 'null';
        else if (Array.isArray(val)) type = 'Array';
        else if (type === 'number') type = Number.isInteger(val) ? 'Integer' : 'Float';
        else if (type === 'string') type = 'String';
        else if (type === 'boolean') type = 'Boolean';
        else if (type === 'object') type = val.__isDict ? 'dict' : 'json';
        vars[name] = { value: val, type };
      }
    }
    return vars;
  }

  function execute(rawLine) {
    const line = rawLine.trim();
    if (!line) return { type: 'empty' };

    // Meta Commands
    if (line.startsWith('.')) {
      const cmd = line.toLowerCase();
      if (cmd === '.help') {
        return {
          type: 'help',
          text: [
            'BML REPL Meta Commands:',
            '  .vars     List all active variables and types',
            '  .clear    Reset the REPL session and clear memory',
            '  .help     Show this help message',
            '  .exit     Close the REPL terminal'
          ].join('\r\n')
        };
      }
      if (cmd === '.clear') {
        reset();
        return { type: 'system', text: 'Session cleared. Memory reset.' };
      }
      if (cmd === '.vars') {
        const v = getVariables();
        const entries = Object.entries(v);
        if (entries.length === 0) {
          return { type: 'system', text: 'No active variables defined.' };
        }
        const lines = entries.map(([k, info]) => `  ${k}: ${JSON.stringify(info.value)} [${info.type}]`);
        return { type: 'system', text: ['Active Variables:', ...lines].join('\r\n') };
      }
      if (cmd === '.exit') {
        return { type: 'exit' };
      }
      return { type: 'error', error: `Unknown meta-command: ${cmd}. Type .help for assistance.` };
    }

    history.push(line);
    stdout.length = 0; // Clear print capture buffer

    const assignMatch = line.match(/^([a-zA-Z0-9_]+)\s*=(?!=)/);
    if (assignMatch) {
      userVarNames.add(assignMatch[1]);
    }

    try {
      if (!line.endsWith(';') && !line.includes('return ') && !line.startsWith('if') && !line.startsWith('for')) {
        try {
          const transformedExpr = preprocessBmlForJs(`return (${line});`);
          const testScript = new vm.Script(transformedExpr);
          const evalResult = testScript.runInContext(sandbox, { timeout: 3000 });
          return {
            type: 'result',
            value: evalResult,
            formatted: formatReplValue(evalResult),
            prints: [...stdout]
          };
        } catch {
          // Fall through to statement evaluation
        }
      }

      const jsCode = preprocessBmlForJs(line);
      const script = new vm.Script(jsCode);
      const res = script.runInContext(sandbox, { timeout: 3000 });

      return {
        type: 'result',
        value: res,
        formatted: res !== undefined ? formatReplValue(res) : null,
        prints: [...stdout]
      };
    } catch (err) {
      return {
        type: 'error',
        error: err.message,
        prints: [...stdout]
      };
    }
  }

  return {
    get stdout() { return stdout; },
    get sandbox() { return sandbox; },
    get history() { return history; },
    get userVarNames() { return userVarNames; },
    reset,
    getVariables,
    formatValue: formatReplValue,
    execute
  };
}

function BmlReplSession() {
  return createBmlReplSession();
}

module.exports = {
  createBmlReplSession,
  formatReplValue,
  BmlReplSession
};
