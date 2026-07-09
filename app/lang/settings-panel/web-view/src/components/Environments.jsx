import { useState } from 'react';
import { IconPlus, IconEdit, IconDelete, IconCheck } from './Icons';

const EMPTY_ENV = { name: '', siteUrl: '', username: '', authMethod: 'basic' };

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
