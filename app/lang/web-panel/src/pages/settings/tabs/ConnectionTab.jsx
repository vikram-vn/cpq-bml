import Pill from '../components/Pill';
import Switch from '../components/Switch';
import { IconConnection } from '../components/Icons';

const AUTH_METHODS = ['basic', 'bearer'];

function getNormalizedUrlPreview(input) {
    if (!input || !input.trim()) return null;
    let url = input.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (!url.includes('.')) {
            url = `https://${url}.bigmachines.com`;
        } else {
            url = `https://${url}`;
        }
    }
    return url.replace(/\/+$/, '');
}

export default function ConnectionTab({
    active,
    connection = {},
    drafts,
    changeDraft,
    updateField,
    state = {},
    password,
    setPassword,
    savePassword,
    clearPassword,
    showPassword,
    setShowPassword,
    token,
    setToken,
    saveToken,
    clearToken,
    showToken,
    setShowToken,
    testing,
    testConnection,
    testResult
}) {
    if (!active) return null;

    const rawUrl = drafts['connection.siteUrl'] !== undefined ? drafts['connection.siteUrl'] : (connection.siteUrl || '');
    const normalizedPreview = getNormalizedUrlPreview(rawUrl);

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconConnection />
                    Connection Settings
                </h2>
                <p className="card-desc">Set up your main connection credentials to communicate with the Oracle CPQ instance.</p>

                <Switch
                    id="connectionEnabled"
                    label="Enable Oracle CPQ REST Features"
                    description="When disabled, connection settings onboarding will be suppressed and all REST toolbar icons will be hidden from the editor title bar."
                    checked={connection.enabled !== false}
                    onChange={(v) => updateField('connection.enabled', v)}
                />

                <div className="field" style={{ marginTop: '16px' }}>
                    <label htmlFor="siteUrl">Site URL</label>
                    <input
                        id="siteUrl"
                        type="text"
                        value={rawUrl}
                        placeholder="yourcompany or yourcompany.bigmachines.com"
                        onChange={(e) => changeDraft('connection.siteUrl', e.target.value)}
                    />
                    {normalizedPreview && (
                        <div style={{ marginTop: '6px', fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                            <span>Endpoint: </span>
                            <code style={{ color: 'var(--vscode-textLink-foreground)', backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px' }}>
                                {normalizedPreview}
                            </code>
                        </div>
                    )}
                    <p className="field-hint">Supports sitename, sitename.bigmachines.com, or full https URLs.</p>
                </div>

                <div className="field">
                    <label htmlFor="authMethod">Auth Method</label>
                    <select id="authMethod" value={connection.authMethod} onChange={(e) => updateField('connection.authMethod', e.target.value)}>
                        {AUTH_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {connection.authMethod === 'basic' ? (
                    <>
                        <div className="field">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                value={drafts['connection.username'] !== undefined ? drafts['connection.username'] : connection.username}
                                onChange={(e) => changeDraft('connection.username', e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="password" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Password <Pill tone={state.hasPassword ? 'success' : 'muted'}>{state.hasPassword ? 'set' : 'not set'}</Pill></span>
                                {state.hasPassword && clearPassword && (
                                    <button
                                        type="button"
                                        className="link"
                                        onClick={clearPassword}
                                        style={{ fontSize: '0.8em', color: 'var(--vscode-errorForeground, #f48771)', textDecoration: 'underline' }}
                                    >
                                        Clear Stored Password
                                    </button>
                                )}
                            </label>
                            <div className="inline-field">
                                <div className="password-container">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        placeholder="Enter new password to update"
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        )}
                                    </button>
                                </div>
                                <button onClick={savePassword} disabled={!password}>Save</button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="field">
                        <label htmlFor="token" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Auth Token <Pill tone={state.hasToken ? 'success' : 'muted'}>{state.hasToken ? 'set' : 'not set'}</Pill></span>
                            {state.hasToken && clearToken && (
                                <button
                                    type="button"
                                    className="link"
                                    onClick={clearToken}
                                    style={{ fontSize: '0.8em', color: 'var(--vscode-errorForeground, #f48771)', textDecoration: 'underline' }}
                                >
                                    Clear Stored Token
                                </button>
                            )}
                        </label>
                        <div className="inline-field">
                            <div className="password-container">
                                <input
                                    id="token"
                                    type={showToken ? 'text' : 'password'}
                                    value={token}
                                    placeholder="Enter token to update"
                                    onChange={(e) => setToken(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowToken(!showToken)}
                                    title={showToken ? 'Hide token' : 'Show token'}
                                >
                                    {showToken ? (
                                        <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    )}
                                </button>
                            </div>
                            <button onClick={saveToken} disabled={!token}>Save</button>
                        </div>
                    </div>
                )}

                <div className="row test-connection-row">
                    <button className="secondary" onClick={testConnection} disabled={testing}>
                        {testing ? (
                            <>
                                <svg className="spinner" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" strokeDasharray="42" />
                                </svg>
                                Testing Connection…
                            </>
                        ) : 'Test Connection'}
                    </button>
                </div>

                {testResult && (
                    <div className={`test-feedback ${testResult.ok ? 'success' : 'error'}`}>
                        {testResult.ok ? (
                            <svg className="test-feedback-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                            <svg className="test-feedback-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        )}
                        <div>
                            <strong style={{ display: 'block', marginBottom: '2px' }}>{testResult.ok ? 'Connection Verified' : 'Connection Failed'}</strong>
                            {testResult.message}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
