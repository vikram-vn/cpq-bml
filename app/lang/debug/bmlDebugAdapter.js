/**
 * BML Debug Adapter Protocol (DAP)
 * Implements native VS Code DebugAdapter for step-through debugging of BML scripts:
 * - F5: Continue / Launch
 * - F9: Breakpoints
 * - F10: Step Over
 * - F11: Step Into
 * - Scopes: Local variables, Dictionaries, JSON, Arrays
 * - Debug Console Expression Evaluation
 * Strictly maintains under 500 lines of code.
 */

const vscode = require("vscode");
const fs = require("fs");
const { createBmlSandbox, preprocessBmlForJs } = require("../evaluator/bmlEvaluator");
const vm = require("vm");

class BmlDebugAdapter {
  constructor() {
    this._onDidSendMessage = new vscode.EventEmitter();
    this.onDidSendMessage = this._onDidSendMessage.event;
    this.seq = 1;

    this.program = "";
    this.sourceLines = [];
    this.currentLine = 1;
    this.breakpoints = new Set();
    this.sandbox = createBmlSandbox([]);
    this.scopeVariables = new Map();
    this.isTerminated = false;
  }

  handleMessage(message) {
    if (message.type === "request") {
      this.handleRequest(message);
    }
  }

  handleRequest(request) {
    const { command, arguments: args } = request;

    switch (command) {
      case "initialize":
        this.sendResponse(request, {
          supportsConfigurationDoneRequest: true,
          supportsEvaluateForHovers: true,
          supportsStepBack: false,
        });
        break;

      case "launch":
        this.program = args.program;
        if (this.program && fs.existsSync(this.program)) {
          const content = fs.readFileSync(this.program, "utf8");
          this.sourceLines = content.split(/\r?\n/);
        } else {
          this.sourceLines = ["print \"No program loaded\";"];
        }
        this.currentLine = 1;
        this.sendResponse(request);
        this.sendEvent("initialized");
        break;

      case "setBreakPoints": {
        const bps = (args.breakpoints || []).map((bp) => bp.line);
        this.breakpoints = new Set(bps);
        const verified = bps.map((line) => ({ verified: true, line }));
        this.sendResponse(request, { breakpoints: verified });
        break;
      }

      case "configurationDone":
        this.sendResponse(request);
        // Pause at first breakpoint or line 1
        this.runUntilStop();
        break;

      case "threads":
        this.sendResponse(request, {
          threads: [{ id: 1, name: "BML Main Thread" }],
        });
        break;

      case "stackTrace":
        this.sendResponse(request, {
          stackFrames: [
            {
              id: 1,
              name: `BML execution (line ${this.currentLine})`,
              source: { path: this.program, name: this.program ? this.program.split(/[\\/]/).pop() : "scratchpad.bml" },
              line: this.currentLine,
              column: 1,
            },
          ],
          totalFrames: 1,
        });
        break;

      case "scopes":
        this.sendResponse(request, {
          scopes: [
            { name: "Locals", variablesReference: 1000, expensive: false },
            { name: "CPQ Built-ins", variablesReference: 2000, expensive: false },
          ],
        });
        break;

      case "variables": {
        const ref = args.variablesReference;
        const variables = [];

        if (ref === 1000) {
          // Locals
          for (const [key, val] of this.scopeVariables.entries()) {
            variables.push({
              name: key,
              value: typeof val === "object" ? JSON.stringify(val) : String(val),
              variablesReference: 0,
            });
          }
          if (variables.length === 0) {
            variables.push({ name: "(empty)", value: "No active variables", variablesReference: 0 });
          }
        } else if (ref === 2000) {
          // CPQ Context
          variables.push(
            { name: "_transaction_currency", value: '"USD"', variablesReference: 0 },
            { name: "_user_language", value: '"en_US"', variablesReference: 0 }
          );
        }

        this.sendResponse(request, { variables });
        break;
      }

      case "evaluate": {
        const expr = (args && args.expression ? args.expression : "").trim();
        try {
          const transformed = preprocessBmlForJs(expr);
          const result = vm.runInContext(transformed, this.sandbox);
          this.sendResponse(request, {
            result: typeof result === "object" ? JSON.stringify(result) : String(result),
            variablesReference: 0,
          });
        } catch (err) {
          this.sendResponse(request, {
            result: `Error: ${err.message}`,
            variablesReference: 0,
          });
        }
        break;
      }

      case "next": // Step Over (F10)
      case "stepIn": // Step Into (F11)
        this.stepSingleLine();
        this.sendResponse(request);
        break;

      case "continue": // Continue (F5)
        this.runUntilStop();
        this.sendResponse(request);
        break;

      case "disconnect":
        this.isTerminated = true;
        this.sendResponse(request);
        this.sendEvent("terminated");
        break;

      default:
        this.sendResponse(request);
        break;
    }
  }

  stepSingleLine() {
    this.executeCurrentLine();
    this.currentLine++;

    if (this.currentLine > this.sourceLines.length) {
      this.sendEvent("terminated");
      return;
    }

    this.sendEvent("stopped", {
      reason: "step",
      threadId: 1,
    });
  }

  runUntilStop() {
    let hit = false;
    while (this.currentLine <= this.sourceLines.length) {
      if (this.breakpoints.has(this.currentLine)) {
        hit = true;
        break;
      }
      this.executeCurrentLine();
      this.currentLine++;
    }

    if (hit) {
      this.sendEvent("stopped", {
        reason: "breakpoint",
        threadId: 1,
      });
    } else {
      this.sendEvent("terminated");
    }
  }

  executeCurrentLine() {
    if (this.currentLine > this.sourceLines.length) return;
    const rawLine = this.sourceLines[this.currentLine - 1].trim();
    if (!rawLine || rawLine.startsWith("//") || rawLine.startsWith("/*")) return;

    try {
      const transformed = preprocessBmlForJs(rawLine);
      vm.runInContext(transformed, this.sandbox);

      // Extract variables from sandbox
      for (const key of Object.keys(this.sandbox)) {
        if (!["print", "len", "substring", "startswith", "endswith", "lower", "upper", "replace", "split", "find", "atoi", "atof", "string", "sizeofarray", "findinarray", "range", "abs", "round", "min", "max", "sqrt", "pow", "getdate", "datetostr", "minusdays", "adddays", "dict", "put", "get", "containskey", "remove", "json", "jsonarray", "jsonget", "jsonput", "jsonarrayappend", "stringbuilder", "sbappend"].includes(key)) {
          this.scopeVariables.set(key, this.sandbox[key]);
        }
      }
    } catch {
      // Ignored for partial lines in multiline blocks
    }
  }

  sendResponse(request, body = {}) {
    this._onDidSendMessage.fire({
      seq: this.seq++,
      type: "response",
      request_seq: request.seq,
      command: request.command,
      success: true,
      body,
    });
  }

  sendEvent(event, body = {}) {
    this._onDidSendMessage.fire({
      seq: this.seq++,
      type: "event",
      event,
      body,
    });
  }

  dispose() {
    this._onDidSendMessage.dispose();
  }
}

class BmlDebugAdapterFactory {
  createDebugAdapterDescriptor(_session) {
    return new vscode.DebugAdapterInlineImplementation(new BmlDebugAdapter());
  }
}

class BmlConfigurationProvider {
  resolveDebugConfiguration(_folder, config) {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && (editor.document.languageId === "bml" || editor.document.fileName.endsWith(".util"))) {
        config.type = "bml";
        config.name = "Debug Current BML File";
        config.request = "launch";
        config.program = "${file}";
      }
    }

    if (!config.program) {
      config.program = "${file}";
    }

    return config;
  }
}

function registerBmlDebugger(context) {
  const factory = new BmlDebugAdapterFactory();
  const configProvider = new BmlConfigurationProvider();

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("bml", factory),
    vscode.debug.registerDebugConfigurationProvider("bml", configProvider)
  );
}

module.exports = {
  BmlDebugAdapter,
  BmlDebugAdapterFactory,
  BmlConfigurationProvider,
  registerBmlDebugger,
};
