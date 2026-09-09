import { useState, useEffect } from 'react';
import Switch from '../components/Switch';
import { IconMcp, IconFeatures, IconSync, IconCheck, IconDelete } from '../components/Icons';
import McpHealthBadge from '../components/McpHealthBadge';
import Pill from '../components/Pill';

const BML_SKILLS = [
    { name: 'bml-language', title: 'Language', desc: 'Core syntax, types & built-ins' },
    { name: 'bml-pitfalls', title: 'Pitfalls', desc: 'Anti-patterns & traps' },
    { name: 'cpq-domain', title: 'Domain', desc: 'Commerce, Config & BOM' },
    { name: 'bml-db-access', title: 'BMQL & DB', desc: 'Queries & Data Tables' },
    { name: 'bml-json-dict', title: 'JSON & Dict', desc: 'Data structures manipulation' },
    { name: 'bml-web-services', title: 'Web Services', desc: 'REST, SOAP & XML calls' },
    { name: 'bml-editor-workflow', title: 'Editor Flow', desc: 'Libraries & editor calls' },
    { name: 'cpq-rest-api', title: 'REST API', desc: 'Queries, sorting & paging' },
];

export default function McpTab({ active, mcp = {}, drafts, changeDraft, updateField, vscodeApi }) {
    if (!active) return null;

    const isEnabled = !!mcp.enable;
    const rawPort = drafts['mcp.port'] !== undefined ? drafts['mcp.port'] : (mcp.port || 47821);
    const numPort = Number(rawPort);
    const isDefaultPort = numPort === 47821;
    const isPrivileged = numPort > 0 && numPort < 1024;
    const isOutOfRange = numPort < 1 || numPort > 65535;

    const [isRegistering, setIsRegistering] = useState(false);
    const [isDeregistering, setIsDeregistering] = useState(false);
    const [isSyncingSkills, setIsSyncingSkills] = useState(false);
    const [actionFeedback, setActionFeedback] = useState(null);

    useEffect(() => {
        const handler = (event) => {
            const data = event.data;
            if (!data) return;
            if (data.type === 'mcpActionResult') {
                setIsRegistering(false);
                setIsDeregistering(false);
                if (data.action === 'register') {
                    setActionFeedback({
                        tone: data.registered && data.registered.length > 0 ? 'success' : 'info',
                        text: data.registered && data.registered.length > 0
                            ? `Registered with ${data.registered.join(', ')}${data.skipped && data.skipped.length > 0 ? ` (${data.skipped.length} uninstalled skipped)` : ''}`
                            : `No native AI configs detected on machine (${data.skipped ? data.skipped.length : 0} skipped)`
                    });
                } else if (data.action === 'deregister') {
                    setActionFeedback({
                        tone: 'info',
                        text: data.deregistered && data.deregistered.length > 0
                            ? `Deregistered from ${data.deregistered.join(', ')}`
                            : 'No active MCP registrations were found to remove'
                    });
                }
            } else if (data.type === 'bmlSkillsSyncResult') {
                setIsSyncingSkills(false);
                setActionFeedback({
                    tone: data.success ? 'success' : 'warning',
                    text: `Synced ${data.synced || 0} BML skills to IDE assistant`
                });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleRegisterMcp = () => {
        if (!vscodeApi || isRegistering) return;
        setIsRegistering(true);
        vscodeApi.postMessage({ type: 'registerMcp' });
    };

    const handleDeregisterMcp = () => {
        if (!vscodeApi || isDeregistering) return;
        setIsDeregistering(true);
        vscodeApi.postMessage({ type: 'deregisterMcp' });
    };

    const handleSyncSkills = () => {
        if (!vscodeApi || isSyncingSkills) return;
        setIsSyncingSkills(true);
        vscodeApi.postMessage({ type: 'syncBmlSkills' });
    };

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconMcp />
                    MCP (Model Context Protocol) Server
                </h2>
                <p className="card-desc">Exposes a local Model Context Protocol server on this machine.</p>
                <McpHealthBadge healthy={isEnabled} />

                <Switch
                    id="mcpEnable"
                    label="Enable MCP Server"
                    description="Starts a local Model Context Protocol server on this machine"
                    checked={isEnabled}
                    onChange={(v) => updateField('mcp.enable', v)}
                />

                {!isEnabled && (
                    <p className="field-hint" style={{ marginTop: '16px' }}>
                        Enable MCP Server above to configure server port, sync BML skills, and manage AI integrations.
                    </p>
                )}

                {isEnabled && (
                    <>
                        <div className="field field-spaced" style={{ marginTop: '16px' }}>
                            <label htmlFor="mcpPort">MCP Server Port</label>
                            <input
                                id="mcpPort"
                                type="number"
                                min="1024"
                                max="65535"
                                value={rawPort}
                                onChange={(e) => changeDraft('mcp.port', e.target.value)}
                            />
                            {isPrivileged && (
                                <p className="field-hint" style={{ color: 'var(--vscode-errorForeground, #f48771)', marginTop: '4px' }}>
                                    Warning: Ports below 1024 are privileged and may require administrator rights to bind.
                                </p>
                            )}
                            {isOutOfRange && (
                                <p className="field-hint" style={{ color: 'var(--vscode-errorForeground, #f48771)', marginTop: '4px' }}>
                                    Port must be between 1024 and 65535.
                                </p>
                            )}
                            {isDefaultPort && (
                                <p className="field-hint" style={{ color: 'var(--vscode-terminal-ansiGreen, #6dd17a)', marginTop: '4px' }}>
                                    Standard CPQ-BML port (47821)
                                </p>
                            )}
                        </div>

                        <Switch
                            id="mcpLog"
                            label="Log MCP Operations to Terminal"
                            description="Stream AI-driven tool operations directly into VS Code integrated terminals"
                            checked={mcp.logToTerminal}
                            onChange={(v) => updateField('mcp.logToTerminal', v)}
                        />
                    </>
                )}
            </section>

            {isEnabled && (
                <>
                    <section className="card" style={{ marginTop: '20px' }}>
                        <h2>
                            <IconFeatures />
                            BML Skills
                        </h2>
                        <p className="card-desc">
                            Synchronizes CPQ BML language rules, BMQL syntax, and domain guidance into your AI IDE assistant skills.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', margin: '14px 0' }}>
                            {BML_SKILLS.map((s) => (
                                <div
                                    key={s.name}
                                    style={{
                                        border: '1px solid var(--vscode-widget-border, #333)',
                                        borderRadius: '4px',
                                        padding: '8px 10px',
                                        background: 'var(--vscode-editor-background, rgba(0,0,0,0.1))'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '0.85em', color: 'var(--vscode-foreground)' }}>
                                        {s.name}
                                    </div>
                                    <div style={{ fontSize: '0.75em', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                                        {s.desc}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
                            <button
                                type="button"
                                onClick={handleSyncSkills}
                                disabled={isSyncingSkills}
                            >
                                <span className={isSyncingSkills ? 'spinner' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <IconSync />
                                </span>
                                {isSyncingSkills ? 'Syncing BML Skills...' : 'Sync BML Skills to IDE'}
                            </button>
                        </div>
                    </section>

                    <section className="card" style={{ marginTop: '20px' }}>
                        <h2>
                            <IconMcp />
                            MCP Registration in Native AIs
                        </h2>
                        <p className="card-desc">
                            Register or deregister this local MCP server across detected AI desktop applications and IDEs (Google Gemini / Antigravity, Claude Desktop &amp; Code, ChatGPT, Cursor, Windsurf, Codex CLI, VS Code / Copilot). Tools not found on this machine are safely skipped.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
                            <button
                                type="button"
                                onClick={handleRegisterMcp}
                                disabled={isRegistering}
                            >
                                <span className={isRegistering ? 'spinner' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <IconCheck />
                                </span>
                                {isRegistering ? 'Registering...' : 'Register MCP in Native AIs'}
                            </button>

                            <button
                                type="button"
                                className="secondary"
                                onClick={handleDeregisterMcp}
                                disabled={isDeregistering}
                            >
                                <span className={isDeregistering ? 'spinner' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <IconDelete />
                                </span>
                                {isDeregistering ? 'Deregistering...' : 'Deregister MCP'}
                            </button>
                        </div>

                        <div style={{ marginTop: '12px', fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                            Server Endpoint: <code style={{ color: 'var(--vscode-textLink-foreground, #3794ff)' }}>http://127.0.0.1:{rawPort}/mcp</code>
                        </div>

                        {actionFeedback && (
                            <div style={{ marginTop: '10px' }}>
                                <Pill tone={actionFeedback.tone}>{actionFeedback.text}</Pill>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
