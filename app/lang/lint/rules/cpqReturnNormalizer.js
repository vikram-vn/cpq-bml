const vscode = require('vscode');
const { splitArgumentsList } = require('@/lang/lint/rules/functionSignature');

function isPipe(str) {
    if (!str) return false;
    const t = str.trim();
    return t === '"|"' || t === "'|'";
}

function isTilde(str) {
    if (!str) return false;
    const t = str.trim();
    return t === '"~"' || t === "'~'";
}

function isStringLiteral(str) {
    if (!str) return false;
    const t = str.trim();
    return (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
           (t.startsWith("'") && t.endsWith("'") && t.length >= 2);
}

function unquote(str) {
    if (!str) return '';
    const t = str.trim();
    if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
        (t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
        return t.slice(1, -1);
    }
    return t;
}

function isStaticValue(expr) {
    if (!expr) return false;
    const t = expr.trim();
    if (isStringLiteral(t)) return true;
    if (/^-?\d+(\.\d+)?$/.test(t)) return true;
    if (t === 'true' || t === 'false') return true;
    return false;
}

function extractSbappendCall(text) {
    const regex = /\bsbappend\s*\(/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const openParenIdx = match.index + match[0].length - 1;
        let depth = 1, inSingle = false, inDouble = false, closeParenIdx = -1;
        for (let i = openParenIdx + 1; i < text.length; i++) {
            const ch = text[i];
            if (ch === '\\') { i++; continue; }
            if (ch === "'" && !inDouble) inSingle = !inSingle;
            else if (ch === '"' && !inSingle) inDouble = !inDouble;
            else if (!inSingle && !inDouble) {
                if (ch === '(') depth++;
                else if (ch === ')') {
                    depth--;
                    if (depth === 0) { closeParenIdx = i; break; }
                }
            }
        }
        if (closeParenIdx !== -1) {
            let fullEndIdx = closeParenIdx + 1;
            while (fullEndIdx < text.length && (text[fullEndIdx] === ' ' || text[fullEndIdx] === '\t')) fullEndIdx++;
            if (fullEndIdx < text.length && text[fullEndIdx] === ';') fullEndIdx++;
            return {
                start: match.index,
                end: fullEndIdx,
                argsText: text.substring(openParenIdx + 1, closeParenIdx),
                fullMatch: text.substring(match.index, fullEndIdx)
            };
        }
    }
    return null;
}

function parseCpqReturnTokens(args) {
    if (!args || args.length < 2) return null;
    const sb = args[0].trim();
    const rest = args.slice(1).map(a => a.trim()).filter(Boolean);
    if (rest.length === 0) return null;

    const hasTilde = rest.some(a => a.includes('~'));
    if (!hasTilde) return null;

    // Expand string concatenation with '+'
    let expanded = [];
    for (const item of rest) {
        if (item.includes('+') && (item.includes('~') || item.includes('"|"') || item.includes("'|'"))) {
            const parts = [];
            let cur = '', inS = false, inD = false;
            for (let i = 0; i < item.length; i++) {
                const c = item[i];
                if (c === '\\') { cur += c + (item[++i] || ''); continue; }
                if (c === "'" && !inD) inS = !inS;
                else if (c === '"' && !inS) inD = !inD;
                else if (c === '+' && !inS && !inD) {
                    parts.push(cur.trim()); cur = ''; continue;
                }
                cur += c;
            }
            if (cur.trim()) parts.push(cur.trim());
            expanded.push(...parts);
        } else {
            expanded.push(item);
        }
    }

    let docNum = null, varName = null, isVarStatic = true, val = null, isValStatic = false;

    // Check trailing pipe
    const lastItem = expanded[expanded.length - 1];
    if (isPipe(lastItem)) {
        expanded.pop();
    } else if (isStringLiteral(lastItem) && unquote(lastItem).endsWith('|')) {
        const unq = unquote(lastItem);
        expanded[expanded.length - 1] = `"${unq.slice(0, -1)}"`;
    }

    // Check all-in-one string e.g. "1~var~val"
    if (expanded.length === 1 && isStringLiteral(expanded[0])) {
        const str = unquote(expanded[0]);
        const tildeParts = str.split('~');
        if (tildeParts.length >= 3) {
            return { sb, docNum: tildeParts[0] || '1', varName: tildeParts[1], isVarStatic: true, val: tildeParts.slice(2).join('~'), isValStatic: true, hasPipe: true };
        } else if (tildeParts.length === 2 && tildeParts[0] === '1') {
            return { sb, docNum: '1', varName: tildeParts[1], isVarStatic: true, val: '', isValStatic: true, hasPipe: true };
        }
    }

    let idx = 0;
    const first = expanded[0];

    // Determine docNum
    if (isStringLiteral(first)) {
        const u = unquote(first);
        if (u === '1' || u === '1~' || u === '') {
            docNum = '1'; idx++;
        } else if (u.startsWith('1~')) {
            docNum = '1';
            const remainder = u.slice(2);
            if (remainder.endsWith('~')) {
                varName = remainder.slice(0, -1); idx++;
            } else if (remainder.includes('~')) {
                const parts = remainder.split('~');
                varName = parts[0]; val = parts.slice(1).join('~'); isValStatic = true; idx++;
            } else {
                varName = remainder; idx++;
            }
        } else if (u.startsWith('~')) {
            docNum = '1';
            const rem = u.slice(1);
            if (rem.endsWith('~')) {
                varName = rem.slice(0, -1); idx++;
            } else if (rem.includes('~')) {
                const parts = rem.split('~');
                varName = parts[0]; val = parts.slice(1).join('~'); isValStatic = true; idx++;
            }
        }
    } else if (first === '1') {
        docNum = '1'; idx++;
    } else if (!isTilde(first) && !first.includes('~')) {
        docNum = first; idx++;
    }

    if (docNum === null) docNum = '1';

    // Determine varName
    if (!varName && idx < expanded.length) {
        const token = expanded[idx];
        if (isTilde(token)) {
            idx++;
            if (idx < expanded.length) {
                varName = unquote(expanded[idx]);
                isVarStatic = isStringLiteral(expanded[idx]);
                idx++;
                if (idx < expanded.length && isTilde(expanded[idx])) idx++;
            }
        } else if (isStringLiteral(token)) {
            const u = unquote(token);
            if (u.startsWith('~') && u.endsWith('~') && u.length >= 2) {
                varName = u.slice(1, -1); idx++;
            } else if (u.startsWith('~') && u.includes('~', 1)) {
                const parts = u.slice(1).split('~');
                varName = parts[0]; val = parts.slice(1).join('~'); isValStatic = true; idx++;
            } else if (u.startsWith('~')) {
                varName = u.slice(1); idx++;
            } else {
                varName = u; idx++;
            }
        } else {
            varName = token; isVarStatic = false; idx++;
        }
    }

    // Determine value
    if (val === null && idx < expanded.length) {
        const remainingTokens = expanded.slice(idx);
        if (remainingTokens.length === 1) {
            const tok = remainingTokens[0];
            if (isStringLiteral(tok)) {
                val = unquote(tok); isValStatic = true;
            } else if (/^-?\d+(\.\d+)?$/.test(tok) || tok === 'true' || tok === 'false') {
                val = tok; isValStatic = true;
            } else {
                val = tok; isValStatic = false;
            }
        } else {
            if (remainingTokens.every(isStringLiteral)) {
                val = remainingTokens.map(unquote).join(''); isValStatic = true;
            } else {
                val = remainingTokens.join(', '); isValStatic = false;
            }
        }
    }

    if (!varName) return null;

    return {
        sb,
        docNum: docNum || '1',
        varName: varName || '',
        isVarStatic: isVarStatic !== false,
        val: val !== null ? val : '',
        isValStatic,
        hasPipe: true
    };
}

function formatCanonicalCpqReturn(parsed, indent = '') {
    if (!parsed || !parsed.sb || !parsed.varName) return null;
    const { sb, docNum, varName, isVarStatic, val, isValStatic } = parsed;
    const isDocStaticOne = (docNum === '1' || docNum === '"1"' || docNum === "'1'");

    // Format 1: Static Doc 1 + Static Value
    if (isDocStaticOne && isVarStatic && isValStatic) {
        return `${indent}sbappend(${sb}, "1~${varName}~${val}", "|");`;
    }

    // Format 2: Static Doc 1 + Dynamic Value
    if (isDocStaticOne && isVarStatic && !isValStatic) {
        return `${indent}sbappend(${sb}, "1~${varName}~", ${val}, "|");`;
    }

    // Dynamic docNum or dynamic varName
    if (!isDocStaticOne) {
        if (isVarStatic && isValStatic) {
            return `${indent}sbappend(${sb}, ${docNum}, "~${varName}~${val}", "|");`;
        } else if (isVarStatic && !isValStatic) {
            return `${indent}sbappend(${sb}, ${docNum}, "~${varName}~", ${val}, "|");`;
        } else {
            return `${indent}sbappend(${sb}, ${docNum}, "~", ${varName}, "~", ${val}, "|");`;
        }
    }

    return `${indent}sbappend(${sb}, "1~", ${varName}, "~", ${val}, "|");`;
}

function isAlreadyCanonical(argsText) {
    const args = splitArgumentsList(argsText);
    if (!args || args.length < 3 || args.length > 5) return false;
    const last = args[args.length - 1].trim();
    if (!isPipe(last)) return false;

    // Format 1: sbappend(sb, "1~var~val", "|")
    if (args.length === 3) {
        const item = args[1].trim();
        if (isStringLiteral(item)) {
            const u = unquote(item);
            if (u.startsWith('1~') && u.includes('~', 2)) return true;
        }
        return false;
    }

    // Format 2: sbappend(sb, "1~var~", dynamicVal, "|")
    // Format 3 (static value): sbappend(sb, docNum, "~var~staticVal", "|")
    if (args.length === 4) {
        const arg1 = args[1].trim();
        const arg2 = args[2].trim();
        if (isStringLiteral(arg1)) {
            const u = unquote(arg1);
            if (u.startsWith('1~') && u.endsWith('~') && u.length >= 3) {
                return !isStringLiteral(arg2);
            }
        }
        if (isStringLiteral(arg2)) {
            const u = unquote(arg2);
            if (u.startsWith('~') && u.includes('~', 1)) return true;
        }
        return false;
    }

    // Format 3: sbappend(sb, docNum, "~var~", dynamicVal, "|")
    if (args.length === 5) {
        const arg1 = args[1].trim();
        const arg2 = args[2].trim();
        const arg3 = args[3].trim();
        const isDocOne = (arg1 === '"1"' || arg1 === "'1'" || arg1 === '1');
        if (!isDocOne && isStringLiteral(arg2)) {
            const u = unquote(arg2);
            if (u.startsWith('~') && u.endsWith('~') && u.length >= 3) {
                return !isStringLiteral(arg3) && !isPipe(arg1);
            }
        }
        return false;
    }
    return false;
}

function analyzeCpqReturnAtLines(document, lineIndex) {
    if (!document || lineIndex < 0 || lineIndex >= document.lineCount) return null;
    const line = document.lineAt(lineIndex);
    const lineText = line.text;
    const call = extractSbappendCall(lineText);
    if (!call) return null;

    const indentMatch = lineText.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    // Check next line pair
    if (lineIndex + 1 < document.lineCount) {
        const nextLine = document.lineAt(lineIndex + 1);
        const nextCall = extractSbappendCall(nextLine.text);
        if (nextCall) {
            const args1 = splitArgumentsList(call.argsText);
            const args2 = splitArgumentsList(nextCall.argsText);
            if (args1[0] && args2[0] && args1[0].trim() === args2[0].trim()) {
                const combinedTokens = [args1[0].trim(), ...args1.slice(1), ...args2.slice(1)];
                const parsedMulti = parseCpqReturnTokens(combinedTokens);
                if (parsedMulti && parsedMulti.varName) {
                    return {
                        range: new vscode.Range(line.range.start, nextLine.range.end),
                        replacement: formatCanonicalCpqReturn(parsedMulti, indent),
                        parsed: parsedMulti
                    };
                }
            }
        }
    }

    // Check prev line pair
    if (lineIndex > 0) {
        const prevLine = document.lineAt(lineIndex - 1);
        const prevCall = extractSbappendCall(prevLine.text);
        if (prevCall) {
            const argsPrev = splitArgumentsList(prevCall.argsText);
            const argsCurr = splitArgumentsList(call.argsText);
            if (argsPrev[0] && argsCurr[0] && argsPrev[0].trim() === argsCurr[0].trim()) {
                const combinedTokens = [argsPrev[0].trim(), ...argsPrev.slice(1), ...argsCurr.slice(1)];
                const parsedMulti = parseCpqReturnTokens(combinedTokens);
                if (parsedMulti && parsedMulti.varName) {
                    const prevIndent = (prevLine.text.match(/^(\s*)/) || [''])[0];
                    return {
                        range: new vscode.Range(prevLine.range.start, line.range.end),
                        replacement: formatCanonicalCpqReturn(parsedMulti, prevIndent),
                        parsed: parsedMulti
                    };
                }
            }
        }
    }

    // Single-line
    if (isAlreadyCanonical(call.argsText)) return null;

    const args = splitArgumentsList(call.argsText);
    const parsedSingle = parseCpqReturnTokens(args);
    if (parsedSingle && parsedSingle.varName) {
        let targetRange = line.range;
        if (lineText.trim() !== call.fullMatch.trim()) {
            targetRange = new vscode.Range(new vscode.Position(lineIndex, call.start), new vscode.Position(lineIndex, call.end));
        }
        return {
            range: targetRange,
            replacement: formatCanonicalCpqReturn(parsedSingle, indent),
            parsed: parsedSingle
        };
    }
    return null;
}

module.exports = {
    isPipe,
    isTilde,
    isStringLiteral,
    isStaticValue,
    unquote,
    extractSbappendCall,
    parseCpqReturnTokens,
    formatCanonicalCpqReturn,
    isAlreadyCanonical,
    analyzeCpqReturnAtLines
};
