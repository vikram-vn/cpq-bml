import { useState } from 'react';
import { Pill, Switch, IconConnection, IconEnvironments, IconOperations, IconMcp, IconAdvanced } from './Components';
import Environments from './Environments';

const AUTH_METHODS = ['basic', 'bearer'];

export function ConnectionTab({
    active,
    connection,
    drafts,
    changeDraft,
    updateField,
    state,
    password,
    setPassword,
    savePassword,
    showPassword,
    setShowPassword,
    token,
    setToken,
    saveToken,
    showToken,
    setShowToken,
    testing,
    testConnection,
    testResult
}) {
    if (!active) return null;

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
                        value={drafts['connection.siteUrl'] !== undefined ? drafts['connection.siteUrl'] : connection.siteUrl}
                        placeholder="yourcompany or yourcompany.bigmachines.com"
                        onChange={(e) => changeDraft('connection.siteUrl', e.target.value)}
                    />
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
                            <label htmlFor="password">
                                Password <Pill tone={state.hasPassword ? 'success' : 'muted'}>{state.hasPassword ? 'set' : 'not set'}</Pill>
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
                        <label htmlFor="token">
                            Auth Token <Pill tone={state.hasToken ? 'success' : 'muted'}>{state.hasToken ? 'set' : 'not set'}</Pill>
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

export function EnvironmentsTab({ active, state, connection, vscodeApi }) {
    if (!active) return null;

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconEnvironments />
                    Environment Profiles
                </h2>
                <p className="card-desc">Save site profiles to quickly activate and switch between credentials.</p>
                <Environments environments={state.environments} connection={connection} vscodeApi={vscodeApi} />
            </section>
        </div>
    );
}

export function OperationsTab({ active, rest, drafts, connection, changeDraft }) {
    if (!active) return null;

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconOperations />
                    Operations &amp; API Configuration
                </h2>
                <p className="card-desc">Configure REST details, library folders, and process paths for operations.</p>

                <div className="field">
                    <label htmlFor="restVersion">REST API Version</label>
                    <input
                        id="restVersion"
                        type="text"
                        value={drafts['connection.restVersion'] !== undefined ? drafts['connection.restVersion'] : connection.restVersion}
                        onChange={(e) => changeDraft('connection.restVersion', e.target.value)}
                    />
                    <p className="field-hint">e.g. v18 {"->"} /rest/v18/bml/library/functions</p>
                </div>
                <div className="field">
                    <label htmlFor="commerceProcess">Commerce Process</label>
                    <input
                        id="commerceProcess"
                        type="text"
                        value={drafts['connection.commerceProcess'] !== undefined ? drafts['connection.commerceProcess'] : connection.commerceProcess}
                        onChange={(e) => changeDraft('connection.commerceProcess', e.target.value)}
                    />
                    <p className="field-hint">Oracle CPQ process variable name</p>
                </div>
                <div className="field">
                    <label htmlFor="commerceDocument">Commerce Document</label>
                    <input
                        id="commerceDocument"
                        type="text"
                        value={drafts['connection.commerceDocument'] !== undefined ? drafts['connection.commerceDocument'] : connection.commerceDocument}
                        onChange={(e) => changeDraft('connection.commerceDocument', e.target.value)}
                    />
                    <p className="field-hint">Process document variable name (e.g. transaction)</p>
                </div>
                <div className="field">
                    <label htmlFor="pullFolder">Local Pull Folder</label>
                    <input
                        id="pullFolder"
                        type="text"
                        value={drafts['rest.pullFolder'] !== undefined ? drafts['rest.pullFolder'] : rest.pullFolder}
                        onChange={(e) => changeDraft('rest.pullFolder', e.target.value)}
                    />
                    <p className="field-hint">Workspace relative path where pulled functions are saved</p>
                </div>
            </section>
        </div>
    );
}

export function McpTab({ active, mcp, drafts, changeDraft, updateField }) {
    if (!active) return null;

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconMcp />
                    MCP (Model Context Protocol) Server
                </h2>
                <p className="card-desc">Exposes a local interface allowing AI agents like Claude Code to directly interact with your Oracle CPQ operations.</p>

                <Switch
                    id="mcpEnable"
                    label="Enable MCP Server"
                    description="Starts a local Model Context Protocol server on this machine"
                    checked={mcp.enable}
                    onChange={(v) => updateField('mcp.enable', v)}
                />
                
                <div className="field field-spaced" style={{ marginTop: '16px' }}>
                    <label htmlFor="mcpPort">MCP Server Port</label>
                    <input
                        id="mcpPort"
                        type="number"
                        value={drafts['mcp.port'] !== undefined ? drafts['mcp.port'] : mcp.port}
                        onChange={(e) => changeDraft('mcp.port', e.target.value)}
                    />
                </div>
                
                <Switch
                    id="mcpLog"
                    label="Log MCP Operations to Terminal"
                    description="Stream AI-driven tool operations directly into VS Code integrated terminals"
                    checked={mcp.logToTerminal}
                    onChange={(v) => updateField('mcp.logToTerminal', v)}
                />
            </section>
        </div>
    );
}

export function AdvancedTab({ active, lint, comments, connection, debug, updateField }) {
    if (!active) return null;

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconAdvanced />
                    Diagnostics &amp; Logs
                </h2>
                <p className="card-desc">Configure code validation linting options and logging outputs.</p>

                <Switch
                    id="lintEnable"
                    label="Enable BML Linting"
                    description="Runs diagnostics and quick-fix suggestions for BigMachines Language syntax"
                    checked={lint.enable}
                    onChange={(v) => updateField('lint.enable', v)}
                />

                <Switch
                    id="commentsEnable"
                    label="Enable BML Better Comments"
                    description="Colorizes tagged comments (TODO/FIXME/!/?/* etc), highlights bml-lint-disable and beautify ignore directives, and styles doc-header comment blocks"
                    checked={comments.enable}
                    onChange={(v) => updateField('comments.enable', v)}
                />

                <Switch
                    id="debugLog"
                    label="Log REST Details to File"
                    description="Save detailed API request/response structures inside 'bml_rest_api.log' in the workspace root"
                    checked={connection.debugLog}
                    onChange={(v) => updateField('connection.debugLog', v)}
                />
                
                <Switch
                    id="logOutputToFile"
                    label="Log Print Statements to File"
                    description="Output BML print logs to 'bml_debug_print.log' and return values to 'bml_debug_output.log' on debugging"
                    checked={debug.logOutputToFile}
                    onChange={(v) => updateField('debug.logOutputToFile', v)}
                />
            </section>
        </div>
    );
}
