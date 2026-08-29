import { useState } from 'react';
import { IconPlus, IconEdit, IconDelete, IconCheck, IconCopy } from './Icons';

const EMPTY_ENV = { name: '', siteUrl: '', username: '', authMethod: 'basic' };

export default function Environments({ environments = [], connection, vscodeApi }) {
    const [editingIndex, setEditingIndex] = useState(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState(EMPTY_ENV);
    const [filterQuery, setFilterQuery] = useState('');

    const activeConnection = connection || {};

    const startAdd = () => {
        setDraft(EMPTY_ENV);
        setAdding(true);
        setEditingIndex(null);
    };

    const startEdit = (index) => {
        setDraft({ ...EMPTY_ENV, ...environments[index] });
        setEditingIndex(index);
        setAdding(false);
    };

    const copySnippet = (env) => {
        const snippet = JSON.stringify({
            name: env.name,
            siteUrl: env.siteUrl,
            authMethod: env.authMethod || 'basic',
            username: env.username || ''
        }, null, 2);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(snippet);
        }
        vscodeApi.postMessage({ type: 'toast', message: `Copied "${env.name}" JSON snippet to clipboard` });
    };

    const duplicate = (index) => {
        const source = environments[index];
        if (!source) return;
        const cloned = {
            ...source,
            name: `${source.name} (Copy)`
        };
        vscodeApi.postMessage({ type: 'addEnvironment', env: cloned });
    };

    const cancel = () => {
        setAdding(false);
        setEditingIndex(null);
    };

    const save = () => {
        if (!draft.name.trim() || !draft.siteUrl.trim()) return;
        if (adding) {
            vscodeApi.postMessage({ type: 'addEnvironment', env: draft });
        } else {
            vscodeApi.postMessage({ type: 'updateEnvironment', index: editingIndex, env: draft });
        }
        cancel();
    };

    const remove = (index) => vscodeApi.postMessage({ type: 'deleteEnvironment', index });
    const activate = (index) => vscodeApi.postMessage({ type: 'activateEnvironment', index });

    const editing = adding || editingIndex !== null;

    const isEnvActive = (env) => {
        if (!activeConnection.siteUrl) return false;
        const urlMatches = env.siteUrl.trim().toLowerCase() === activeConnection.siteUrl.trim().toLowerCase();
        const userMatches = (env.username || '').trim().toLowerCase() === (activeConnection.username || '').trim().toLowerCase();
        const authMatches = (env.authMethod || 'basic') === (activeConnection.authMethod || 'basic');
        return urlMatches && userMatches && authMatches;
    };

    const filteredEnvs = environments.filter((env) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.trim().toLowerCase();
        return (
            (env.name || '').toLowerCase().includes(q) ||
            (env.siteUrl || '').toLowerCase().includes(q) ||
            (env.username || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="environments">
            {environments.length > 2 && (
                <div style={{ marginBottom: '14px' }}>
                    <input
                        type="text"
                        placeholder="Filter environments by name or URL..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '0.85em',
                            borderRadius: '4px',
                            border: '1px solid var(--vscode-input-border, transparent)',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                        }}
                    />
                </div>
            )}

            {environments.length === 0 ? (
                <p className="empty-state">No saved environments found.</p>
            ) : filteredEnvs.length === 0 ? (
                <p className="empty-state">No environments matching &ldquo;{filterQuery}&rdquo;.</p>
            ) : (
                <ul className="environments-list">
                    {filteredEnvs.map((env, index) => {
                        const originalIndex = environments.indexOf(env);
                        const active = isEnvActive(env);
                        return (
                            <li key={`${env.name}-${index}`} className={`environment-card ${active ? 'active' : ''}`}>
                                <div className="env-info">
                                    <span className="env-name">{env.name}</span>
                                    <span className="env-detail">
                                        {env.siteUrl}
                                    </span>
                                    <div className="env-meta-tags">
                                        <span className="tag-chip">{env.authMethod || 'basic'}</span>
                                        {env.username && <span className="tag-chip">{env.username}</span>}
                                        {active && <span className="tag-chip active"><IconCheck /> Active</span>}
                                    </div>
                                </div>
                                <div className="env-row-actions">
                                    {!active && (
                                        <button className="secondary" onClick={() => activate(originalIndex)}>
                                            Activate
                                        </button>
                                    )}
                                    <button className="secondary" onClick={() => copySnippet(env)} title="Copy profile JSON">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                                    </button>
                                    <button className="secondary" onClick={() => startEdit(originalIndex)} title="Edit profile">
                                        <IconEdit />
                                    </button>
                                    <button className="secondary" onClick={() => duplicate(originalIndex)} title="Duplicate profile">
                                        <IconCopy />
                                    </button>
                                    <button className="danger" onClick={() => remove(originalIndex)} title="Delete profile">
                                        <IconDelete />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {editing ? (
                <div className="environment-editor">
                    <h3 style={{ fontSize: '0.9em', margin: '0 0 14px', fontWeight: '600' }}>
                        {adding ? 'Add Environment Profile' : 'Edit Environment Profile'}
                    </h3>
                    <div className="field">
                        <label htmlFor="envName">Profile Name</label>
                        <input id="envName" type="text" placeholder="e.g. Development, Production" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="envSiteUrl">Site URL</label>
                        <input id="envSiteUrl" type="text" placeholder="yourcompany or company.bigmachines.com" value={draft.siteUrl} onChange={(e) => setDraft({ ...draft, siteUrl: e.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="envUsername">Username</label>
                        <input id="envUsername" type="text" placeholder="Admin username (optional)" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="envAuthMethod">Auth Method</label>
                        <select id="envAuthMethod" value={draft.authMethod} onChange={(e) => setDraft({ ...draft, authMethod: e.target.value })}>
                            <option value="basic">basic (username/password)</option>
                            <option value="bearer">bearer (OAuth token)</option>
                        </select>
                    </div>
                    <div className="row" style={{ marginTop: '16px' }}>
                        <button onClick={save} disabled={!draft.name.trim() || !draft.siteUrl.trim()}>Save Profile</button>
                        <button className="secondary" onClick={cancel}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="secondary" style={{ width: '100%' }} onClick={startAdd}>
                    <IconPlus /> Add Environment Profile
                </button>
            )}
        </div>
    );
}
