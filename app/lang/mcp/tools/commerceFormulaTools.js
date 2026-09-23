'use strict';

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { getSettings, isConfigured, getWorkspaceRoot } = require('@/lang/rest/config');
const {
    isSuccess,
    describeError,
    writeRunHeader,
    writeTerminalMessage,
    formatElapsed,
} = require('@/lang/rest/commands/shared');
const { getAiTerminal } = require('@/lang/mcp/aiTerminal');
const { createCapturingTerminal, createToolVscodeContext } = require('@/lang/mcp/proxy');
const { runDebugCurrentFile } = require('@/lang/rest/commands/debug');
const { getCommerceAttributesFolder } = require('@/lang/rest/folders');

function safeParse(val) {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch {
        return {};
    }
}

async function getCommerceDocumentModifyTab(context, vscode, args, transport) {
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    const settings = getSettings(vscode);
    const process = (args && args.commerceProcess) || settings.commerceProcess || 'oraclecpqo';
    const document = (args && args.commerceDocument) || settings.commerceDocument || 'transaction';

    writeRunHeader(terminal, 'Get Document Modify Tab', `${process}/${document}`);
    terminal.show();

    try {
        if (isConfigured(vscode)) {
            const res = await api.getCommerceDocumentModifyTab(context, vscode, { process, document }, transport);
            if (res && isSuccess(res.statusCode)) {
                const body = safeParse(res.body);
                const items = Array.isArray(body) ? body : (body.items || []);
                writeTerminalMessage(terminal, 'Modify Tab: ', `Retrieved ${items.length} attribute options (${formatElapsed(startedAt)})`, '\x1b[32m');
                return {
                    success: true,
                    commerceProcess: process,
                    commerceDocument: document,
                    count: items.length,
                    items,
                    log: getLines(),
                };
            }
        }

        // Workspace fallback
        const wsRoot = getWorkspaceRoot(vscode);
        if (wsRoot) {
            const candidates = [
                path.join(wsRoot, 'cpq', 'commerce', process, document, 'modifyTab.json'),
                path.join(wsRoot, 'cpq', 'commerce', process, 'modifyTab.json'),
            ];
            for (const cand of candidates) {
                if (fs.existsSync(cand)) {
                    try {
                        const parsed = JSON.parse(fs.readFileSync(cand, 'utf8'));
                        const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
                        return {
                            success: true,
                            commerceProcess: process,
                            commerceDocument: document,
                            count: items.length,
                            items,
                            source: 'workspace_cache',
                            log: getLines(),
                        };
                    } catch {}
                }
            }
        }

        return {
            success: false,
            error: `Failed to retrieve Modify Tab options for "${process}/${document}".`,
            log: getLines(),
        };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function updateCommerceDocumentModifyTab(context, vscode, args, transport) {
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    const settings = getSettings(vscode);
    const process = (args && args.commerceProcess) || settings.commerceProcess || 'oraclecpqo';
    const document = (args && args.commerceDocument) || settings.commerceDocument || 'transaction';
    const items = args && args.items;

    if (!Array.isArray(items) || items.length === 0) {
        return { success: false, error: 'items array is required with attribute modify tab configurations.' };
    }

    writeRunHeader(terminal, 'Update Document Modify Tab', `${process}/${document}`);
    terminal.show();

    try {
        const res = await api.updateCommerceDocumentModifyTab(context, vscode, items, { process, document }, transport);
        if (!res || !isSuccess(res.statusCode)) {
            const code = res ? res.statusCode : 500;
            return {
                success: false,
                error: `Update Modify Tab failed (HTTP ${code}). ${res ? describeError(res.body) : ''}`,
                log: getLines(),
            };
        }

        const body = safeParse(res.body);
        writeTerminalMessage(terminal, 'Modify Tab Updated: ', `Successfully updated ${items.length} options (${formatElapsed(startedAt)})`, '\x1b[32m');

        // Cache locally in workspace if available
        const wsRoot = getWorkspaceRoot(vscode);
        if (wsRoot) {
            try {
                const targetDir = path.join(wsRoot, 'cpq', 'commerce', process, document);
                fs.mkdirSync(targetDir, { recursive: true });
                fs.writeFileSync(path.join(targetDir, 'modifyTab.json'), JSON.stringify({ items }, null, 2), 'utf8');
            } catch {}
        }

        return {
            success: true,
            commerceProcess: process,
            commerceDocument: document,
            updatedCount: items.length,
            result: body,
            log: getLines(),
        };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function pullCommerceActionScripts(context, vscode, args, transport) {
    const actionVar = args && (args.actionVariableName || args.variableName);
    if (!actionVar) {
        return { success: false, error: 'actionVariableName is required.' };
    }

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    const settings = getSettings(vscode);
    const process = (args && args.commerceProcess) || settings.commerceProcess || 'oraclecpqo';
    const document = (args && args.commerceDocument) || settings.commerceDocument || 'transaction';

    writeRunHeader(terminal, 'Pull Commerce Action Scripts', actionVar);
    terminal.show();

    try {
        const res = await api.getCommerceAction(context, vscode, actionVar, { process, document }, transport);
        if (!res || !isSuccess(res.statusCode)) {
            const code = res ? res.statusCode : 500;
            return {
                success: false,
                error: `Failed to load action "${actionVar}" (HTTP ${code}). ${res ? describeError(res.body) : ''}`,
                log: getLines(),
            };
        }

        const data = safeParse(res.body);
        const scripts = [];

        const beforeScript = data.beforeFormulas || data.modifyBeforeScript || data.beforeScript || data.beforeFormula;
        if (beforeScript) scripts.push({ type: 'before-formulas', label: 'Advanced Modify - Before Formulas', code: beforeScript });

        const afterScript = data.afterFormulas || data.modifyAfterScript || data.afterScript || data.afterFormula;
        if (afterScript) scripts.push({ type: 'after-formulas', label: 'Advanced Modify - After Formulas', code: afterScript });

        const modifyScript = data.modifyScript || data.bmlScript || data.scriptText || data.script;
        if (modifyScript) scripts.push({ type: 'modify', label: 'Advanced Modify Script', code: modifyScript });

        if (scripts.length === 0) {
            return {
                success: true,
                actionVariableName: actionVar,
                message: `Action "${actionVar}" does not contain embedded BML formulas.`,
                scriptsCount: 0,
                scripts: [],
                log: getLines(),
            };
        }

        const wsRoot = getWorkspaceRoot(vscode);
        const savedFiles = [];

        if (wsRoot) {
            const actionDir = path.join(wsRoot, 'cpq', 'commerce', process, 'actions', document, actionVar);
            fs.mkdirSync(actionDir, { recursive: true });

            for (const s of scripts) {
                const bmlPath = path.join(actionDir, `${actionVar}_${s.type}.bml`);
                fs.writeFileSync(bmlPath, s.code, 'utf8');

                const metaPath = path.join(actionDir, `${actionVar}_${s.type}-meta.json`);
                const meta = {
                    name: `${actionVar} (${s.label})`,
                    variableName: `${actionVar}_${s.type}`,
                    actionVariableName: actionVar,
                    commerceProcess: process,
                    commerceDocument: document,
                    scriptType: s.type,
                    description: s.label,
                };
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
                savedFiles.push({ type: s.type, label: s.label, path: bmlPath });
            }
        }

        writeTerminalMessage(terminal, 'Action Scripts: ', `Extracted ${scripts.length} script(s) for "${actionVar}" (${formatElapsed(startedAt)})`, '\x1b[32m');
        return {
            success: true,
            actionVariableName: actionVar,
            commerceProcess: process,
            commerceDocument: document,
            scriptsCount: scripts.length,
            scripts: scripts.map(s => ({ type: s.type, label: s.label, codePreview: s.code.slice(0, 100) })),
            savedFiles,
            log: getLines(),
        };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function debugCommerceActionScript(context, vscode, args, transport) {
    const actionVar = args && (args.actionVariableName || args.variableName);
    const transactionId = args && (args.transactionId || args.id);
    const scriptType = (args && args.scriptType) || 'before-formulas';

    if (!actionVar) return { success: false, error: 'actionVariableName is required.' };
    if (!transactionId) return { success: false, error: 'transactionId is required to debug commerce action formulas.' };

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    writeRunHeader(terminal, `Debug Action ${scriptType}`, `${actionVar} on Txn ${transactionId}`);
    terminal.show();

    try {
        const pullRes = await pullCommerceActionScripts(context, vscode, args, transport);
        if (!pullRes.success) return pullRes;

        const targetScript = (pullRes.savedFiles || []).find(f => f.type === scriptType)
            || (pullRes.savedFiles && pullRes.savedFiles[0]);

        if (!targetScript) {
            return {
                success: false,
                error: `No script found with type "${scriptType}" for action "${actionVar}". Available: ${(pullRes.scripts || []).map(s => s.type).join(', ')}`,
                log: getLines(),
            };
        }

        const { vscodeProxy } = createToolVscodeContext(vscode, {
            bmlPath: targetScript.path,
            quickPickSelector: (items) => items.find((i) => i.id === 'last'),
        });

        if (context.workspaceState) {
            await context.workspaceState.update(`debugCache:${path.basename(targetScript.path, '.bml')}`, {
                transactionId: String(transactionId),
                parameterValues: {},
            });
        }

        const result = await runDebugCurrentFile(context, vscodeProxy, terminal, { transport, resultsOnly: false });
        writeTerminalMessage(terminal, 'Debug Action: ', `Executed ${scriptType} debug on "${actionVar}" (${formatElapsed(startedAt)})`, '\x1b[32m');

        return {
            success: true,
            actionVariableName: actionVar,
            scriptType,
            transactionId: String(transactionId),
            debugResult: result,
            log: getLines(),
        };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function pullCommerceAttributeFormula(context, vscode, args, transport) {
    const attrVar = args && (args.attributeVariableName || args.variableName);
    if (!attrVar) return { success: false, error: 'attributeVariableName is required.' };

    const formulaType = (args && (args.formulaType || args.type)) || 'default';
    const settings = getSettings(vscode);
    const process = (args && args.commerceProcess) || settings.commerceProcess || 'oraclecpqo';
    const document = (args && args.commerceDocument) || settings.commerceDocument || 'transaction';

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    writeRunHeader(terminal, 'Pull Attribute Formula', `${attrVar} (${formulaType})`);
    terminal.show();

    try {
        const res = await api.getCommerceAttribute(context, vscode, { process, document, attributeVarName: attrVar, fields: null }, transport);
        if (!res || !isSuccess(res.statusCode)) {
            const code = res ? res.statusCode : 500;
            return {
                success: false,
                error: `Failed to load attribute "${attrVar}" (HTTP ${code}). ${res ? describeError(res.body) : ''}`,
                log: getLines(),
            };
        }

        const data = safeParse(res.body);
        const formulaCode = formulaType === 'default'
            ? (data.defaultScript || data.defaultFormula || data.advancedDefault || data.formula)
            : (data.modifyScript || data.modifyFormula || data.advancedModify);

        if (!formulaCode) {
            return {
                success: true,
                attributeVariableName: attrVar,
                formulaType,
                message: `Attribute "${attrVar}" does not contain an embedded BML ${formulaType} formula.`,
                code: '',
                log: getLines(),
            };
        }

        const wsRoot = getWorkspaceRoot(vscode);
        let savedPath = '';

        if (wsRoot) {
            const relDir = getCommerceAttributesFolder(vscode, process, formulaType);
            const attrDir = path.join(wsRoot, relDir);
            fs.mkdirSync(attrDir, { recursive: true });
            savedPath = path.join(attrDir, `${attrVar}.bml`);
            fs.writeFileSync(savedPath, formulaCode, 'utf8');

            const metaPath = path.join(attrDir, `${attrVar}-meta.json`);
            const meta = {
                name: data.name || attrVar,
                variableName: attrVar,
                commerceProcess: process,
                commerceDocument: document,
                attributeType: formulaType,
                returnType: { type: data.dataType || 'String' },
            };
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
        }

        writeTerminalMessage(terminal, 'Attribute Formula: ', `Extracted ${formulaType} formula for "${attrVar}" (${formatElapsed(startedAt)})`, '\x1b[32m');
        return {
            success: true,
            attributeVariableName: attrVar,
            formulaType,
            savedPath,
            code: formulaCode,
            log: getLines(),
        };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function debugCommerceAttributeFormula(context, vscode, args, transport) {
    const attrVar = args && (args.attributeVariableName || args.variableName);
    const transactionId = args && (args.transactionId || args.id);
    const formulaType = (args && (args.formulaType || args.type)) || 'default';

    if (!attrVar) return { success: false, error: 'attributeVariableName is required.' };
    if (!transactionId) return { success: false, error: 'transactionId is required to debug attribute formulas.' };

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    writeRunHeader(terminal, `Debug Attribute ${formulaType}`, `${attrVar} on Txn ${transactionId}`);
    terminal.show();

    try {
        const pullRes = await pullCommerceAttributeFormula(context, vscode, args, transport);
        if (!pullRes.success) return pullRes;
        if (!pullRes.savedPath) {
            return {
                success: false,
                error: `Could not save local formula file for attribute "${attrVar}". Check workspace configuration.`,
                log: getLines(),
            };
        }

        const { vscodeProxy } = createToolVscodeContext(vscode, {
            bmlPath: pullRes.savedPath,
            quickPickSelector: (items) => items.find((i) => i.id === 'last'),
        });

        if (context.workspaceState) {
            await context.workspaceState.update(`debugCache:${attrVar}`, {
                transactionId: String(transactionId),
                parameterValues: {},
            });
        }

        const result = await runDebugCurrentFile(context, vscodeProxy, terminal, { transport, resultsOnly: false });
        writeTerminalMessage(terminal, 'Debug Formula: ', `Finished ${formulaType} formula debug on "${attrVar}" (${formatElapsed(startedAt)})`, '\x1b[32m');

        return {
            success: true,
            attributeVariableName: attrVar,
            formulaType,
            transactionId: String(transactionId),
            debugResult: result,
            log: getLines(),
        };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

module.exports = {
    getCommerceDocumentModifyTab,
    updateCommerceDocumentModifyTab,
    pullCommerceActionScripts,
    debugCommerceActionScript,
    pullCommerceAttributeFormula,
    debugCommerceAttributeFormula,
};
