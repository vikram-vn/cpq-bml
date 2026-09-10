const vscode = require('vscode');

/**
 * Domain-specific member access Quick Fixes for Enterprise CPQ constructs:
 * - Session (usersessionget, usersessionset, usersessionremove)
 * - Global dictionary (globaldictget, globaldictset, globaldictremove)
 * - Config Context (getconfigattrvalue, setattributevalue)
 * - BOM operations (getbom, applybom, savebom, calculatedeltabom)
 * - Commerce transaction (gettransaction, addtotransaction, addpartstotransaction, getoldvalue)
 * - XML transformation & manipulation (transformxml, removexmlnode, appendxmlnode)
 */
function getDomainMemberFixes(document, range, targetVar, memberName, argsText, diag) {
    const fixes = [];
    const memberLower = memberName.toLowerCase();
    const targetLower = targetVar.toLowerCase();

    function addFix(title, replacement, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, range, replacement);
        if (diag) action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    // 1. User Session: session.get(k), session.set(k, v), session.remove(k)
    if (targetLower === 'session' || targetLower === 'usersession') {
        if (memberLower === 'get') {
            addFix(`Convert to 'usersessionget(${argsText || ''})'`, `usersessionget(${argsText || ''})`, true);
            return fixes;
        }
        if (memberLower === 'set' || memberLower === 'put') {
            addFix(`Convert to 'usersessionset(${argsText || ''})'`, `usersessionset(${argsText || ''})`, true);
            return fixes;
        }
        if (memberLower === 'remove' || memberLower === 'delete') {
            addFix(`Convert to 'usersessionremove(${argsText || ''})'`, `usersessionremove(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 2. Global Dict: global.get(k), global.set(k, v), global.remove(k)
    if (targetLower === 'global' || targetLower === 'globaldict') {
        if (memberLower === 'get') {
            addFix(`Convert to 'globaldictget(${argsText || ''})'`, `globaldictget(${argsText || ''})`, true);
            return fixes;
        }
        if (memberLower === 'set' || memberLower === 'put') {
            addFix(`Convert to 'globaldictset(${argsText || ''})'`, `globaldictset(${argsText || ''})`, true);
            return fixes;
        }
        if (memberLower === 'remove' || memberLower === 'delete') {
            addFix(`Convert to 'globaldictremove(${argsText || ''})'`, `globaldictremove(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 3. Configuration & Attributes: context.getAttribute(a), context.setAttribute(a, v)
    if (targetLower === 'context' || targetLower === 'config') {
        if (memberLower === 'getattr' || memberLower === 'getattribute' || memberLower === 'getvalue') {
            addFix(`Convert to 'getconfigattrvalue(${argsText || ''})'`, `getconfigattrvalue(${argsText || ''})`, true);
            return fixes;
        }
        if (memberLower === 'setattr' || memberLower === 'setattribute' || memberLower === 'setvalue') {
            addFix(`Convert to 'setattributevalue(${argsText || ''})'`, `setattributevalue(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 4. BOM Operations: bom.get(), bom.apply(), bom.save(), bom.calculateDelta()
    if (targetLower === 'bom') {
        if (memberLower === 'get') {
            addFix(`Convert to 'getbom()'`, `getbom()`, true);
            return fixes;
        }
        if (memberLower === 'apply') {
            addFix(`Convert to 'applybom()'`, `applybom()`, true);
            return fixes;
        }
        if (memberLower === 'save') {
            addFix(`Convert to 'savebom()'`, `savebom()`, true);
            return fixes;
        }
        if (memberLower === 'calculatedelta' || memberLower === 'deltabom') {
            addFix(`Convert to 'calculatedeltabom(${argsText || ''})'`, `calculatedeltabom(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 5. Commerce & Transaction: transaction.get(), transaction.add(items)
    if (targetLower === 'transaction') {
        if (memberLower === 'get') {
            addFix(`Convert to 'gettransaction()'`, `gettransaction()`, true);
            return fixes;
        }
        if (memberLower === 'add') {
            addFix(`Convert to 'addtotransaction(${argsText || ''})'`, `addtotransaction(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 6. Commerce transaction helpers
    if (memberLower === 'addtotransaction') {
        addFix(`Convert to 'addtotransaction(${targetVar})'`, `addtotransaction(${targetVar})`, true);
        addFix(`Convert to 'addpartstotransaction(${targetVar})' (for parts array)`, `addpartstotransaction(${targetVar})`);
        return fixes;
    }
    if (memberLower === 'getoldvalue') {
        addFix(`Convert to 'getoldvalue("${targetVar}")'`, `getoldvalue("${targetVar}")`, true);
        return fixes;
    }

    // 7. XML Transform & Node Edits: xml.transform(xsl), xml.removeNode(xpath), xml.appendNode(xpath, node)
    if (memberLower === 'transform' || memberLower === 'transformxml') {
        addFix(`Convert to 'transformxml(${targetVar}, ${argsText || ''})'`, `transformxml(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }
    if (memberLower === 'removenode' || memberLower === 'removexmlnode') {
        addFix(`Convert to 'removexmlnode(${targetVar}, ${argsText || ''})'`, `removexmlnode(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }
    if (memberLower === 'appendnode' || memberLower === 'appendxmlnode') {
        addFix(`Convert to 'appendxmlnode(${targetVar}, ${argsText || ''})'`, `appendxmlnode(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    return fixes;
}

module.exports = { getDomainMemberFixes };
