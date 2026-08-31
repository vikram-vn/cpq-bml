const fs = require('fs');
const api = require('../../rest/api');
const { findOrCreateAiCopy } = require('../locate');

/**
 * Naive line-by-line diff (LCS-based).
 * Returns lines prefixed with '+', '-', or ' '.
 */
function computeLineDiff(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;

    // Fast trim common prefix
    let prefixCount = 0;
    while (prefixCount < m && prefixCount < n && oldLines[prefixCount] === newLines[prefixCount]) {
        prefixCount++;
    }

    // Fast trim common suffix
    let suffixCount = 0;
    while (
        suffixCount < m - prefixCount &&
        suffixCount < n - prefixCount &&
        oldLines[m - 1 - suffixCount] === newLines[n - 1 - suffixCount]
    ) {
        suffixCount++;
    }

    const trimmedOld = oldLines.slice(prefixCount, m - suffixCount);
    const trimmedNew = newLines.slice(prefixCount, n - suffixCount);
    const tm = trimmedOld.length;
    const tn = trimmedNew.length;

    const diffMiddle = [];
    if (tm > 0 && tn > 0) {
        const stringToId = new Map();
        let nextId = 1;
        const oldIds = new Int32Array(tm);
        for (let i = 0; i < tm; i++) {
            const line = trimmedOld[i];
            let id = stringToId.get(line);
            if (!id) {
                id = nextId++;
                stringToId.set(line, id);
            }
            oldIds[i] = id;
        }
        const newIds = new Int32Array(tn);
        for (let j = 0; j < tn; j++) {
            const line = trimmedNew[j];
            let id = stringToId.get(line);
            if (!id) {
                id = nextId++;
                stringToId.set(line, id);
            }
            newIds[j] = id;
        }

        const stride = tn + 1;
        const dp = new Int32Array((tm + 1) * stride);
        for (let i = 1; i <= tm; i++) {
            const rowOffset = i * stride;
            const prevRowOffset = (i - 1) * stride;
            const oldId = oldIds[i - 1];
            for (let j = 1; j <= tn; j++) {
                if (oldId === newIds[j - 1]) {
                    dp[rowOffset + j] = dp[prevRowOffset + j - 1] + 1;
                } else {
                    const top = dp[prevRowOffset + j];
                    const left = dp[rowOffset + j - 1];
                    dp[rowOffset + j] = top > left ? top : left;
                }
            }
        }

        let i = tm, j = tn;
        while (i > 0 || j > 0) {
            const rowOffset = i * stride;
            if (i > 0 && j > 0 && oldIds[i - 1] === newIds[j - 1]) {
                diffMiddle.push(' ' + trimmedOld[i - 1]);
                i--;
                j--;
            } else if (j > 0 && (i === 0 || dp[rowOffset + j - 1] >= dp[(i - 1) * stride + j])) {
                diffMiddle.push('+' + trimmedNew[j - 1]);
                j--;
            } else {
                diffMiddle.push('-' + trimmedOld[i - 1]);
                i--;
            }
        }
        diffMiddle.reverse();
    } else {
        for (let i = 0; i < tm; i++) diffMiddle.push('-' + trimmedOld[i]);
        for (let j = 0; j < tn; j++) diffMiddle.push('+' + trimmedNew[j]);
    }

    const result = [];
    for (let i = 0; i < prefixCount; i++) {
        result.push(' ' + oldLines[i]);
    }
    for (let i = 0; i < diffMiddle.length; i++) {
        result.push(diffMiddle[i]);
    }
    for (let i = m - suffixCount; i < m; i++) {
        result.push(' ' + oldLines[i]);
    }
    return result;
}

/**
 * diff_function
 *
 * Compares the local AI copy of a function against its remote CPQ version.
 * Pulls the remote content into memory (does NOT overwrite local files),
 * then returns a line-by-line unified diff.
 */
async function diffFunction(context, vscode, args) {
    const { variableName, type = 'util' } = args || {};
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const bmlPath = findOrCreateAiCopy(vscode, variableName, { createIfMissing: false });
    if (!bmlPath) {
        return { success: false, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    let localText;
    try { localText = fs.readFileSync(bmlPath, 'utf8'); } catch (e) {
        return { success: false, error: `Cannot read local file: ${e.message}` };
    }

    let remoteText;
    try {
        const cfg = vscode.workspace.getConfiguration('cpqBml');
        const baseUrl = cfg.get('connection.siteUrl', '');
        if (!baseUrl) return { success: false, error: 'No CPQ site URL configured.' };

        if (type === 'util') {
            const resp = await api.getUtilFunction(context, vscode, variableName);
            remoteText = resp && resp.scriptText ? resp.scriptText : '';
        } else {
            return { success: false, error: 'diff_function currently supports util functions only.' };
        }
    } catch (e) {
        return { success: false, error: `Failed to fetch remote: ${e.message}` };
    }

    const localLines = localText.split(/\r?\n/);
    const remoteLines = remoteText.split(/\r?\n/);
    const diffLines = computeLineDiff(remoteLines, localLines);

    const added = diffLines.filter(l => l.startsWith('+')).length;
    const removed = diffLines.filter(l => l.startsWith('-')).length;
    const unchanged = diffLines.filter(l => l.startsWith(' ')).length;

    return {
        success: true,
        variableName,
        added,
        removed,
        unchanged,
        diffText: diffLines.join('\n'),
    };
}

module.exports = {
    diffFunction,
    computeLineDiff
};
