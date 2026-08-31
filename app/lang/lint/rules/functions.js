const {
  parseParameterSignature,
  splitArgumentsList,
} = require("./functionSignature");
const { getWorkspaceFunctionsCached } = require("./workspaceFunctions");
const { loadJson } = require('../../intellisense/apiDataLoader');
const { getFunctionReturnTypes } = require("./typeCheckOperands");
const {
  inferArgumentType,
  controlKeywords,
  keywords,
  storageTypeNames,
  deprecated,
  parseSyntax,
  loadBuiltInFunctions,
  getArgumentsTextAndEnd,
  countArguments,
  findClosestBuiltInFunction,
  findClosestWorkspaceFunction,
  normalizeType,
  argumentTypeCompatible
} = require("./functionsBuiltIns");

function checkFunctionCalls(
  cleanText,
  noStringsText,
  doc,
  vscode,
  extensionPath,
  firstTypeByVar = new Map(),
) {
  const diagnostics = [];
  const builtIns = loadBuiltInFunctions(extensionPath);
  const wsFunctions = getWorkspaceFunctionsCached(vscode);
  const returnTypes = getFunctionReturnTypes(extensionPath);

  let cpqJsData = null;

  // Matches namespaced or bare function calls: [util/commerce/CPQJS.[folder.]]name(
  // The middle "folder" segment covers Oracle CPQ's util library folders/
  // platform namespaces, e.g. util._ORCL_ABO.abo_initializeContext(...).
  const funcCallRegex =
    /\b(?:(util|commerce|CPQJS)\.(?:([a-zA-Z_]\w*)\.)?)?([a-zA-Z_]\w*)\s*\(/g;
  let match;

  while ((match = funcCallRegex.exec(noStringsText)) !== null) {
    const namespace = match[1];
    const midSegment = match[2];
    const funcName = match[3];
    const funcNameLower = funcName.toLowerCase();

    if (!namespace) {
      let idx = match.index - 1;
      while (idx >= 0 && /\s/.test(noStringsText[idx])) {
        idx--;
      }
      if (idx >= 0 && noStringsText[idx] === ".") {
        continue; // Skip member method calls that aren't util or commerce
      }
    }

    if (!namespace && (controlKeywords.has(funcNameLower) || storageTypeNames.has(funcNameLower))) {
      continue; // Skip keywords and storage constructors
    }

    const matchStart = match.index;
    const prefix = namespace
      ? `${namespace}.${midSegment ? `${midSegment}.` : ""}`
      : "";
    const displayNamespace = midSegment
      ? `${namespace}.${midSegment}`
      : namespace;
    const callLength = prefix.length + funcName.length;
    const callStartOffset = matchStart;
    const getCallRange = () => new vscode.Range(doc.positionAt(callStartOffset), doc.positionAt(callStartOffset + callLength));

    // Find matching closing parenthesis and extract arguments
    const argsStartOffset = matchStart + match[0].length;
    const argsResult = getArgumentsTextAndEnd(noStringsText, argsStartOffset);
    if (!argsResult) continue; // Unbalanced call, syntax error

    // Extract clean arguments text
    const argsCleanText = cleanText.substring(
      argsStartOffset,
      argsResult.endIndex,
    );
    const argCount = countArguments(argsCleanText);

    if (namespace && namespace.toUpperCase() === 'CPQJS') {
      if (cpqJsData === null) {
        try {
          cpqJsData = loadJson('bml-cpq-js-api-usage', extensionPath) || {};
        } catch (e) {
          cpqJsData = {};
        }
      }
      const FALLBACK_CPQJS = {
        'CPQJS.getTableInfo': { syntax: 'CPQJS.getTableInfo(String tableName)' },
        'CPQJS.performAction': { syntax: 'CPQJS.performAction(String actionName)' },
        'CPQJS.actionExists': { syntax: 'CPQJS.actionExists(String actionName)' },
        'CPQJS.attributeExists': { syntax: 'CPQJS.attributeExists(String attrName)' },
        'CPQJS.getAttributeVal': { syntax: 'CPQJS.getAttributeVal(String attrName)' },
      };
      const cpqKey = `CPQJS.${funcName}`;
      const target = cpqJsData[cpqKey] || cpqJsData[funcName] || FALLBACK_CPQJS[cpqKey];
      if (target && target.syntax) {
        const parsed = parseParameterSignature(target.syntax);
        const countMatches = argCount >= parsed.min && argCount <= parsed.max;
        if (!countMatches) {
          const diag = new vscode.Diagnostic(
            getCallRange(),
            `Function '${cpqKey}' expects ${parsed.min} argument(s), but got ${argCount}.`,
            vscode.DiagnosticSeverity.Error,
          );
          diag.code = "bml-function-arg-count";
          diagnostics.push(diag);
        }
        if (parsed.params) {
          const args = splitArgumentsList(argsCleanText);
          for (
            let i = 0;
            i < Math.min(args.length, parsed.params.length);
            i++
          ) {
            const param = parsed.params[i];
            if (param && param.type) {
              const actual = inferArgumentType(
                args[i],
                firstTypeByVar,
                returnTypes,
              );
              if (actual && !argumentTypeCompatible(param.type, actual)) {
                const diag = new vscode.Diagnostic(
                  getCallRange(),
                  `Argument ${i + 1} to '${cpqKey}' should be ${Array.isArray(param.type) ? param.type.join(" or ") : param.type}, but got a ${actual} value.`,
                  vscode.DiagnosticSeverity.Error,
                );
                diag.code = "bml-function-arg-type";
                diagnostics.push(diag);
              }
            }
          }
        }
      }
      continue;
    }

    if (namespace) {
      // Namespaced call (util.foo, commerce.foo, or util.folder.foo)
      const cacheKey = midSegment
        ? `${namespace.toLowerCase()}.${midSegment.toLowerCase()}.${funcNameLower}`
        : `${namespace.toLowerCase()}.${funcNameLower}`;
      const targetFunc = wsFunctions.get(cacheKey);

      if (!targetFunc) {
        // Oracle-provided platform utilities (ABO, web services, OSC, etc.)
        // are called this way but never appear in a pulled workspace -
        // recognized by name prefix regardless of which namespace/folder
        // segment precedes them.
        const isPlatformFunc =
          namespace.toLowerCase() === "util" &&
          (funcNameLower.startsWith("abo_") ||
            funcNameLower.startsWith("ws") ||
            funcNameLower.startsWith("osc_") ||
            funcNameLower.startsWith("orcl_") ||
            funcNameLower === "getbasicauthcredentials");

        if (isPlatformFunc) {
          continue;
        }

        // Warning/Info: function not found in workspace
        const suggestion = findClosestWorkspaceFunction(
          `${displayNamespace}.${funcName}`,
          wsFunctions,
        );
        const diag = new vscode.Diagnostic(
          getCallRange(),
          suggestion
            ? `Function '${displayNamespace}.${funcName}' not found in the workspace library. Did you mean '${suggestion}'?`
            : `Function '${displayNamespace}.${funcName}' not found in the workspace library.`,
          vscode.DiagnosticSeverity.Information,
        );
        diag.code = "bml-function-not-found-workspace";
        diagnostics.push(diag);
      } else {
        if (argCount !== targetFunc.parameterCount) {
          const diag = new vscode.Diagnostic(
            getCallRange(),
            `Function '${displayNamespace}.${targetFunc.name}' expects ${targetFunc.parameterCount} argument(s), but got ${argCount}.`,
            vscode.DiagnosticSeverity.Error,
          );
          diag.code = "bml-function-arg-count";
          diagnostics.push(diag);
        }

        if (targetFunc.params) {
          const args = splitArgumentsList(argsCleanText);
          for (
            let i = 0;
            i < args.length && i < targetFunc.params.length;
            i++
          ) {
            const expectedType = targetFunc.params[i].type;
            if (!expectedType) continue;
            const actualType = inferArgumentType(
              args[i],
              firstTypeByVar,
              returnTypes,
            );
            if (!actualType) continue;
            if (!argumentTypeCompatible(expectedType, actualType)) {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `Argument ${i + 1} to '${displayNamespace}.${targetFunc.name}' should be ${expectedType}, but got a ${actualType} value.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-type";
              diagnostics.push(diag);
            }
          }
        }
      }
    } else {
      // Bare call
      const fullKey = namespace
        ? `${namespace.toLowerCase()}.${funcNameLower}`
        : funcNameLower;
      const builtIn = builtIns.get(fullKey) || builtIns.get(funcNameLower);
      if (builtIn) {
        const overloads = builtIn.overloads || [
          { min: builtIn.min, max: builtIn.max, params: builtIn.params },
        ];
        const countMatches = overloads.filter(
          (ov) => argCount >= ov.min && argCount <= ov.max,
        );

        if (countMatches.length === 0) {
          const expectedRanges = overloads.map((ov) =>
            ov.min === ov.max ? `${ov.min}` : `${ov.min} to ${ov.max}`,
          );
          const expectedMsg = Array.from(new Set(expectedRanges)).join(" or ");
          const diag = new vscode.Diagnostic(
            getCallRange(),
            `Built-in function '${builtIn.name}' expects ${expectedMsg} argument(s), but got ${argCount}.`,
            vscode.DiagnosticSeverity.Error,
          );
          diag.code = "bml-function-arg-count";
          diagnostics.push(diag);
        }

        const targetOverloads =
          countMatches.length > 0 ? countMatches : overloads;
        const typeMatches = [];
        const typeErrors = [];
        const args = splitArgumentsList(argsCleanText);

        for (const ov of targetOverloads) {
          if (!ov.params || ov.params.length === 0) {
            if (ov.min === 0) {
              typeMatches.push(ov);
            }
            continue;
          }

          let match = true;
          const errors = [];
          for (let i = 0; i < args.length && i < ov.params.length; i++) {
            const expectedType = ov.params[i].type;
            if (!expectedType) continue;
            const actualType = inferArgumentType(
              args[i],
              firstTypeByVar,
              returnTypes,
            );
            if (!actualType) continue;
            if (!argumentTypeCompatible(expectedType, actualType)) {
              match = false;
              errors.push({
                index: i,
                expected: expectedType,
                actual: actualType,
              });
            }
          }
          if (match) {
            typeMatches.push(ov);
          } else {
            typeErrors.push({ overload: ov, errors });
          }
        }

        if (typeMatches.length === 0 && typeErrors.length > 0) {
          const bestError = typeErrors[0];
          for (const err of bestError.errors) {
            const expectedStr = Array.isArray(err.expected)
              ? err.expected.join(" or ")
              : err.expected;
            const diag = new vscode.Diagnostic(
              getCallRange(),
              `Argument ${err.index + 1} to '${builtIn.name}' should be ${expectedStr}, but got a ${err.actual} value.`,
              vscode.DiagnosticSeverity.Error,
            );
            diag.code = "bml-function-arg-type";
            diagnostics.push(diag);
          }
        } else if (funcNameLower === "put" && args.length >= 3) {
          const dictVarName = args[0].trim();
          const dictEntry = firstTypeByVar
            ? firstTypeByVar.get(dictVarName.toLowerCase()) || firstTypeByVar.get(dictVarName)
            : null;
          if (dictEntry && dictEntry.elementType) {
            const expectedElemType = dictEntry.elementType.trim();
            const expectedElemLower = expectedElemType.toLowerCase();
            if (expectedElemLower !== "anytype" && expectedElemLower !== "any") {
              const actualValType = inferArgumentType(
                args[2],
                firstTypeByVar,
                returnTypes,
              );
              if (actualValType && !argumentTypeCompatible(expectedElemType, actualValType)) {
                const diag = new vscode.Diagnostic(
                  getCallRange(),
                  `Argument 3 to 'put' should be ${expectedElemType}, but got a ${actualValType} value.`,
                  vscode.DiagnosticSeverity.Error,
                );
                diag.code = "bml-function-arg-type";
                diagnostics.push(diag);
              }
            }
          }
        } else if (funcNameLower === "get" && args.length >= 1) {
          const dictVarName = args[0].trim();
          const dictEntry = firstTypeByVar
            ? firstTypeByVar.get(dictVarName.toLowerCase()) || firstTypeByVar.get(dictVarName)
            : null;
          if (dictEntry && dictEntry.elementType) {
            const expectedElemLower = dictEntry.elementType.trim().toLowerCase();
            if ((expectedElemLower === "anytype" || expectedElemLower === "any") && args.length < 3) {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `For 'dict("anytype")', 'get()' requires 3 arguments including the valueType parameter, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-count";
              diagnostics.push(diag);
            }
          }
        } else if (funcNameLower === "values" && args.length >= 1) {
          const dictVarName = args[0].trim();
          const dictEntry = firstTypeByVar
            ? firstTypeByVar.get(dictVarName.toLowerCase()) || firstTypeByVar.get(dictVarName)
            : null;
          if (dictEntry && dictEntry.elementType) {
            const elemType = dictEntry.elementType.trim();
            const elemLower = elemType.toLowerCase();
            if (elemLower === "anytype" || elemLower === "any" || elemLower === "boolean" || elemLower.endsWith("[][]")) {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `Function 'values()' does not support '${elemType}' dictionaries.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-type";
              diagnostics.push(diag);
            }
          }
        } else if (funcNameLower === "append" && args.length >= 2) {
          const arrVarName = args[0].trim();
          const arrEntry = firstTypeByVar
            ? firstTypeByVar.get(arrVarName.toLowerCase()) || firstTypeByVar.get(arrVarName)
            : null;
          const arrType = arrEntry ? arrEntry.type : inferArgumentType(arrVarName, firstTypeByVar, returnTypes);
          if (arrType && arrType.endsWith("[]")) {
            const expectedElemType = arrType.slice(0, -2);
            const actualValType = inferArgumentType(args[1], firstTypeByVar, returnTypes);
            if (actualValType && !argumentTypeCompatible(expectedElemType, actualValType)) {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `Argument 2 to 'append' should be ${expectedElemType}, but got a ${actualValType} value.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-type";
              diagnostics.push(diag);
            }
          }
        } else if (funcNameLower === "findinarray" && args.length >= 2) {
          const arrVarName = args[0].trim();
          const arrEntry = firstTypeByVar
            ? firstTypeByVar.get(arrVarName.toLowerCase()) || firstTypeByVar.get(arrVarName)
            : null;
          const arrType = arrEntry ? arrEntry.type : inferArgumentType(arrVarName, firstTypeByVar, returnTypes);
          if (arrType && arrType.endsWith("[]")) {
            const expectedElemType = arrType.slice(0, -2);
            const actualTargetType = inferArgumentType(args[1], firstTypeByVar, returnTypes);
            if (actualTargetType && !argumentTypeCompatible(expectedElemType, actualTargetType)) {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `Argument 2 to 'findinarray' should be ${expectedElemType}, but got a ${actualTargetType} value.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-type";
              diagnostics.push(diag);
            }
          }
        } else if (funcNameLower === "remove" && args.length >= 2) {
          const containerName = args[0].trim();
          const containerEntry = firstTypeByVar
            ? firstTypeByVar.get(containerName.toLowerCase()) || firstTypeByVar.get(containerName)
            : null;
          const containerType = containerEntry ? containerEntry.type : inferArgumentType(containerName, firstTypeByVar, returnTypes);
          if (containerType && containerType.endsWith("[]")) {
            const actualIdxType = inferArgumentType(args[1], firstTypeByVar, returnTypes);
            if (actualIdxType && !argumentTypeCompatible("integer", actualIdxType)) {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `Argument 2 to 'remove' on an array should be Integer, but got a ${actualIdxType} value.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-type";
              diagnostics.push(diag);
            }
          }
        } else if ((funcNameLower === "min" || funcNameLower === "max") && args.length === 1) {
          const arrVarName = args[0].trim();
          const arrEntry = firstTypeByVar
            ? firstTypeByVar.get(arrVarName.toLowerCase()) || firstTypeByVar.get(arrVarName)
            : null;
          const arrType = arrEntry ? arrEntry.type : inferArgumentType(arrVarName, firstTypeByVar, returnTypes);
          if (arrType && arrType.endsWith("[]")) {
            const elemType = arrType.slice(0, -2).toLowerCase();
            if (elemType !== "integer" && elemType !== "float" && elemType !== "long" && elemType !== "double" && elemType !== "date") {
              const diag = new vscode.Diagnostic(
                getCallRange(),
                `Argument 1 to '${builtIn.name}' should be Integer[] or Float[] or Date[], but got a ${arrType} value.`,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-function-arg-type";
              diagnostics.push(diag);
            }
          }
        }
      } else {
        // Unknown bare function call
        const suggestion = findClosestBuiltInFunction(funcName, builtIns);
        const diag = new vscode.Diagnostic(
          getCallRange(),
          suggestion
            ? `Unknown built-in function or variable '${funcName}' - did you mean '${suggestion}'?`
            : `Unknown built-in function or variable '${funcName}'.`,
          vscode.DiagnosticSeverity.Warning,
        );
        diag.code = "bml-unknown-function";
        diagnostics.push(diag);
      }
    }
  }

  return diagnostics;
}

module.exports = {
  checkFunctionCalls,
  parseSyntax,
  countArguments,
  getWorkspaceFunctionsCached,
  keywords,
  loadBuiltInFunctions,
  findClosestBuiltInFunction,
};
