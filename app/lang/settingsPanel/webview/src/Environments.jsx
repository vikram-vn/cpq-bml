import { useState } from 'react';

const EMPTY_ENV = { name: '', siteUrl: '', username: '', authMethod: 'basic' };

// SVG Icons
const IconPlus = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

const IconEdit = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

const IconDelete = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
);

const IconCheck = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
);

export default function Environments({ environments, connection, vscodeApi }) {
    const [editingIndex, setEditingIndex] = useState(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState(EMPTY_ENV);

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

    return (
        <div className="environments">
            {environments.length === 0 ? (
                <p className="empty-state">No saved environments found.</p>
            ) : (
                <ul className="environments-list">
                    {environments.map((env, index) => {
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
                                        <button className="secondary" onClick={() => activate(index)}>
                                            Activate
                                        </button>
                                    )}
                                    <button className="secondary" onClick={() => startEdit(index)} title="Edit profile">
                                        <IconEdit />
                                    </button>
                                    <button className="danger" onClick={() => remove(index)} title="Delete profile">
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
