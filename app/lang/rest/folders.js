'use strict';

const pathLib = require('path');

function getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn) {
    let siteUrl = '';
    if (typeof vscodeOrSiteUrl === 'string') {
        siteUrl = vscodeOrSiteUrl;
    } else if (vscodeOrSiteUrl) {
        siteUrl = (typeof getBaseUrlFn === 'function' ? getBaseUrlFn(vscodeOrSiteUrl) : '') || '';
    }
    let host = '';
    try {
        if (siteUrl) {
            const raw = siteUrl.replace(/^https?:\/\//i, '');
            host = raw.split('/')[0].split(':')[0].split('.')[0];
        }
    } catch {
        host = '';
    }
    host = (host || '').trim();
    if (!host) {
        return 'default';
    }
    if (/^cpq[-_]/i.test(host)) {
        return host.replace(/_/g, '-');
    }
    return host;
}

function getCpqInstanceFolder(vscodeOrSiteUrl, getBaseUrlFn) {
    const host = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    if (host === 'default') {
        return 'cpq-default';
    }
    if (/^cpq[-_]/i.test(host)) {
        return host.replace(/_/g, '-');
    }
    return `cpq-${host}`;
}

function getUtilLibrariesFolder(vscodeOrSiteUrl, getBaseUrlFn) {
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    return pathLib.join('cpq', site, 'util-libraries');
}

function getCommerceLibrariesFolder(vscodeOrSiteUrl, processName, getBaseUrlFn, getCommerceProcessFn) {
    if (!vscodeOrSiteUrl && !processName) {
        return pathLib.join('cpq', 'commerce-libraries');
    }
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    const proc = processName || (vscodeOrSiteUrl && typeof vscodeOrSiteUrl === 'object' && typeof getCommerceProcessFn === 'function' && getCommerceProcessFn(vscodeOrSiteUrl)) || '';
    if (proc) {
        return pathLib.join('cpq', site, proc, 'commerce-libraries');
    }
    return pathLib.join('cpq', site, 'commerce-libraries');
}

function getDataTableFolder(workspaceRoot, vscodeOrSiteUrl, getBaseUrlFn) {
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    const rel = pathLib.join('cpq', site, 'data-tables');
    return workspaceRoot ? pathLib.join(workspaceRoot, rel) : rel;
}

function getBackupFolder(vscodeOrSiteUrl, type = 'util', processName = '', getBaseUrlFn) {
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    if (type === 'util') {
        return pathLib.join('cpq', site, 'backup', 'util');
    }
    const proc = processName || 'oraclecpqo';
    if (type === 'commerce' || type === 'process') {
        return pathLib.join('cpq', site, 'backup', proc);
    }
    return pathLib.join('cpq', site, 'backup', proc, type);
}

function getCommerceAttributesFolder(vscodeOrSiteUrl, processName = 'oraclecpqo', subType = 'modify', getBaseUrlFn) {
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    const validSubType = (subType === 'default' || subType === 'modify') ? subType : 'modify';
    return pathLib.join('cpq', site, 'commerce', processName, 'attributes', validSubType);
}

function getCommerceActionsFolder(vscodeOrSiteUrl, processName = 'oraclecpqo', subType = 'modify', getBaseUrlFn) {
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    let validSubType = 'modify';
    if (subType === 'before-formulas' || subType === 'before' || subType === 'beforeFormulas') {
        validSubType = 'before-formulas';
    } else if (subType === 'after-formulas' || subType === 'after' || subType === 'afterFormulas') {
        validSubType = 'after-formulas';
    }
    return pathLib.join('cpq', site, 'commerce', processName, 'actions', validSubType);
}

function getConfigRulesFolder(vscodeOrSiteUrl, productFamily = 'general', subType = 'action', getBaseUrlFn) {
    const site = getCpqSiteName(vscodeOrSiteUrl, getBaseUrlFn);
    const validSubType = (subType === 'condition' || subType === 'action') ? subType : 'action';
    return pathLib.join('cpq', site, 'config', productFamily, 'rules', validSubType);
}

module.exports = {
    getCpqSiteName,
    getCpqInstanceFolder,
    getUtilLibrariesFolder,
    getCommerceLibrariesFolder,
    getDataTableFolder,
    getBackupFolder,
    getCommerceAttributesFolder,
    getCommerceActionsFolder,
    getConfigRulesFolder,
};
