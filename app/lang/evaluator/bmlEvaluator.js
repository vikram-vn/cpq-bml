const vm = require('vm');

/**
 * Local BML Pure Logic Evaluator
 * Safely executes pure BML algorithms in an isolated Node.js VM context with standard CPQ built-ins.
 */

function createBmlSandbox(stdout = []) {
    const sandbox = {
        // Output capturing
        print: (...args) => {
            const formatted = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            stdout.push(formatted);
        },

        // String functions
        len: (val) => (val && val.length !== undefined ? val.length : 0),
        substring: (str, start, end) => {
            if (typeof str !== 'string') return '';
            return end !== undefined ? str.substring(start, end) : str.substring(start);
        },
        startswith: (str, prefix) => (typeof str === 'string' && typeof prefix === 'string' ? str.startsWith(prefix) : false),
        endswith: (str, suffix) => (typeof str === 'string' && typeof suffix === 'string' ? str.endsWith(suffix) : false),
        lower: (str) => (typeof str === 'string' ? str.toLowerCase() : ''),
        upper: (str) => (typeof str === 'string' ? str.toUpperCase() : ''),
        replace: (str, target, replacement) => (typeof str === 'string' ? str.split(target).join(replacement) : ''),
        split: (str, delim) => (typeof str === 'string' ? str.split(delim) : []),
        find: (str, sub, start) => (typeof str === 'string' ? str.indexOf(sub, start || 0) : -1),
        atoi: (str) => parseInt(str, 10) || 0,
        atof: (str) => parseFloat(str) || 0.0,
        string: (val) => (val !== undefined && val !== null ? String(val) : ''),

        // Array functions
        sizeofarray: (arr) => (Array.isArray(arr) ? arr.length : 0),
        findinarray: (arr, val) => (Array.isArray(arr) ? arr.indexOf(val) : -1),
        range: (count) => (typeof count === 'number' ? Array.from({ length: count }, (_, i) => i) : []),

        // Math functions
        abs: (n) => Math.abs(n),
        round: (n, decimals = 0) => {
            const factor = Math.pow(10, decimals);
            return Math.round(n * factor) / factor;
        },
        min: (a, b) => Math.min(a, b),
        max: (a, b) => Math.max(a, b),
        sqrt: (n) => Math.sqrt(n),
        pow: (a, b) => Math.pow(a, b),

        // Date functions
        getdate: () => new Date(),
        datetostr: (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d)),
        minusdays: (d, days) => new Date(d.getTime() - days * 86400000),
        adddays: (d, days) => new Date(d.getTime() + days * 86400000),

        // Dictionary
        dict: (_type) => new Map(),
        put: (d, key, val) => {
            if (d instanceof Map) d.set(key, val);
            else if (typeof d === 'object' && d !== null) d[key] = val;
            return d;
        },
        get: (d, key) => {
            if (d instanceof Map) return d.get(key);
            if (typeof d === 'object' && d !== null) return d[key];
            return undefined;
        },
        containskey: (d, key) => {
            if (d instanceof Map) return d.has(key);
            if (typeof d === 'object' && d !== null) return Object.prototype.hasOwnProperty.call(d, key);
            return false;
        },
        remove: (d, key) => {
            if (d instanceof Map) d.delete(key);
            else if (typeof d === 'object' && d !== null) delete d[key];
            return d;
        },

        // JSON
        json: (str) => {
            try { return str ? JSON.parse(str) : {}; } catch { return {}; }
        },
        jsonarray: (str) => {
            try { return str ? JSON.parse(str) : []; } catch { return []; }
        },
        jsonget: (obj, key) => (obj && typeof obj === 'object' ? obj[key] : undefined),
        jsonput: (obj, key, val) => {
            if (obj && typeof obj === 'object') obj[key] = val;
            return obj;
        },
        jsonarrayappend: (arr, val) => {
            if (Array.isArray(arr)) arr.push(val);
            return arr;
        },

        // StringBuilder
        stringbuilder: () => ({
            _buf: [],
            append: function (str) { this._buf.push(String(str)); return this; },
            toString: function () { return this._buf.join(''); }
        }),
        sbappend: (sb, str) => {
            if (sb && typeof sb.append === 'function') sb.append(str);
            return sb;
        }
    };

    return vm.createContext(sandbox);
}

function preprocessBmlForJs(code) {
    let js = code;

    // Replace BML elif with else if
    js = js.replace(/\belif\b/g, 'else if');

    // Convert BML foreach: for x in arr { -> for (const x of arr) {
    js = js.replace(/\bfor\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*)\s*\{/g, 'for (const $1 of $2) {');

    // Convert type annotations on declarations: String x = "abc"; -> let x = "abc";
    js = js.replace(/\b(?:String|Integer|Float|Boolean|Date|Dict|JsonArray|JsonObject|StringBuilder|recordset)\s+([a-zA-Z_]\w*)\s*=/g, 'let $1 =');

    // If code has top-level return, wrap in an IIFE
    const hasReturn = /\breturn\b/.test(js);
    if (hasReturn) {
        js = `(function() {\n${js}\n})()`;
    }

    return js;
}

function evaluateBmlLogic(args) {
    const code = (args && args.code ? args.code : '').trim();
    if (!code) {
        return {
            success: false,
            error: 'No BML code provided to evaluate.',
            output: [],
            returnValue: null,
            durationMs: 0
        };
    }

    const stdout = [];
    const context = createBmlSandbox(stdout);
    const timeoutMs = (args && args.timeoutMs) || 3000;

    const startTime = Date.now();
    try {
        const transformedCode = preprocessBmlForJs(code);
        const script = new vm.Script(transformedCode, { filename: 'scratchpad.bml' });
        const result = script.runInContext(context, { timeout: timeoutMs });
        const durationMs = Date.now() - startTime;

        return {
            success: true,
            output: stdout,
            returnValue: result !== undefined ? result : null,
            durationMs
        };
    } catch (err) {
        const durationMs = Date.now() - startTime;
        return {
            success: false,
            error: err.message,
            output: stdout,
            returnValue: null,
            durationMs
        };
    }
}

module.exports = { evaluateBmlLogic, preprocessBmlForJs, createBmlSandbox };
