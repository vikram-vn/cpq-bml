const vm = require('vm');
const { createBmlSandbox, preprocessBmlForJs } = require('../evaluator/bmlEvaluator');

/**
 * Stateful BML REPL execution engine.
 * Maintains variables across command evaluations.
 */
class BmlReplSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.stdout = [];
    this.sandbox = createBmlSandbox(this.stdout);
    this.history = [];
    this.userVarNames = new Set();
  }

  getVariables() {
    const vars = {};
    for (const name of this.userVarNames) {
      if (this.sandbox[name] !== undefined) {
        const val = this.sandbox[name];
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

  formatValue(val) {
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

  execute(rawLine) {
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
        this.reset();
        return { type: 'system', text: 'Session cleared. Memory reset.' };
      }
      if (cmd === '.vars') {
        const v = this.getVariables();
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

    this.history.push(line);
    this.stdout.length = 0; // Clear print capture buffer

    // Track variable assignments: e.g. x = 10, total_t = 50.0
    const assignMatch = line.match(/^([a-zA-Z0-9_]+)\s*=(?!=)/);
    if (assignMatch) {
      this.userVarNames.add(assignMatch[1]);
    }

    try {
      // First try evaluating as an expression to return a value
      let isExpr = false;
      let jsCode;

      if (!line.endsWith(';') && !line.includes('return ') && !line.startsWith('if') && !line.startsWith('for')) {
        try {
          const transformedExpr = preprocessBmlForJs(`return (${line});`);
          const testScript = new vm.Script(transformedExpr);
          const evalResult = testScript.runInContext(this.sandbox, { timeout: 3000 });
          return {
            type: 'result',
            value: evalResult,
            formatted: this.formatValue(evalResult),
            prints: [...this.stdout]
          };
        } catch {
          // Not a simple expression, fall through to statement evaluation
        }
      }

      if (!isExpr) {
        jsCode = preprocessBmlForJs(line);
        const script = new vm.Script(jsCode);
        const res = script.runInContext(this.sandbox, { timeout: 3000 });

        return {
          type: 'result',
          value: res,
          formatted: res !== undefined ? this.formatValue(res) : null,
          prints: [...this.stdout]
        };
      }
    } catch (err) {
      return {
        type: 'error',
        error: err.message,
        prints: [...this.stdout]
      };
    }
  }
}

module.exports = { BmlReplSession };
