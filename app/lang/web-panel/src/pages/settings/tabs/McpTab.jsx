import { useState, useEffect } from 'react';
import Switch from '../components/Switch';
import { IconMcp, IconSync } from '../components/Icons';
import McpHealthBadge from '../components/McpHealthBadge';
import Pill from '../components/Pill';
import McpClientsCard from './mcp/McpClientsCard';
import McpSkillsCard from './mcp/McpSkillsCard';
import McpDiagnosticsCard from './mcp/McpDiagnosticsCard';
import McpTrafficCard from './mcp/McpTrafficCard';

export default function McpTab({ active, mcp = {}, drafts, changeDraft, updateField, vscodeApi }) {
    if (!active) return null;

    const isEnabled = !!mcp.enable;
    const rawPort = drafts['mcp.port'] !== undefined ? drafts['mcp.port'] : (mcp.port || 47821);
    const numPort = Number(rawPort) || 47821;
    const isDefaultPort = numPort === 47821;
    const isPrivileged = numPort > 0 && numPort < 1024;
    const isOutOfRange = numPort < 1 || numPort > 65535;

    const [isRegistering, setIsRegistering] = useState(false);
    const [isDeregistering, setIsDeregistering] = useState(false);
    const [isSyncingSkills, setIsSyncingSkills] = useState(false);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [copiedSnippet, setCopiedSnippet] = useState(null);
    const [pingStatus, setPingStatus] = useState(null);
    const [isPinging, setIsPinging] = useState(false);
    const [traffic, setTraffic] = useState([]);
    const [diagnostics, setDiagnostics] = useState(null);
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

    const aiTools = mcp.tools || [];

    useEffect(() => {
        if (vscodeApi && isEnabled) {
            vscodeApi.postMessage({ type: 'getMcpTraffic' });
        }
    }, [isEnabled, vscodeApi]);

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
            } else if (data.type === 'mcpHealth') {
                setIsPinging(false);
                setPingStatus({
                    healthy: data.healthy,
                    message: data.healthy ? `Healthy - active on port ${data.port}` : 'Server stopped',
                });
            } else if (data.type === 'mcpTraffic') {
                setTraffic(data.traffic || []);
            } else if (data.type === 'aiDiagnosticsResult') {
                setIsRunningDiagnostics(false);
                setDiagnostics(data);
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

    const handleRefreshTraffic = () => {
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'getMcpTraffic' });
        }
    };

    const handleClearTraffic = () => {
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'clearMcpTraffic' });
        }
    };

    const handleRunDiagnostics = () => {
        if (!vscodeApi || isRunningDiagnostics) return;
        setIsRunningDiagnostics(true);
        vscodeApi.postMessage({ type: 'runAiDiagnostics' });
    };

    const handleTestHealth = async () => {
        setIsPinging(true);
        try {
            const res = await fetch(`http://127.0.0.1:${numPort}/health`);
            if (res.ok) {
                const json = await res.json();
                setPingStatus({
                    healthy: true,
                    message: `200 OK — ${json.service} (v${json.version || '1.87.0'}) running on port ${numPort}`,
                });
            } else {
                setPingStatus({
                    healthy: false,
                    message: `HTTP ${res.status}: ${res.statusText}`,
                });
            }
        } catch (err) {
            setPingStatus({
                healthy: false,
                message: `Connection failed: ${err.message || 'Server not reachable'}`,
            });
        } finally {
            setIsPinging(false);
        }
    };

    const copyToClipboard = (text, key) => {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
            setCopiedSnippet(key);
            setTimeout(() => setCopiedSnippet(null), 2500);
        }
    };

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconMcp />
                    MCP (Model Context Protocol) Server
                </h2>
                <p className="card-desc">Exposes a local Model Context Protocol server on this machine.</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <McpHealthBadge healthy={isEnabled} />

                    {isEnabled && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={handleTestHealth}
                            disabled={isPinging}
                            style={{ padding: '3px 10px', fontSize: '0.85em' }}
                        >
                            <span className={isPinging ? 'spinner' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <IconSync />
                            </span>
                            {isPinging ? 'Testing...' : 'Test Local Connection'}
                        </button>
                    )}

                    {pingStatus && (
                        <Pill tone={pingStatus.healthy ? 'success' : 'error'}>
                            {pingStatus.message}
                        </Pill>
                    )}
                </div>

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
                    <McpClientsCard
                        aiTools={aiTools}
                        isRegistering={isRegistering}
                        isDeregistering={isDeregistering}
                        actionFeedback={actionFeedback}
                        handleRegisterMcp={handleRegisterMcp}
                        handleDeregisterMcp={handleDeregisterMcp}
                        numPort={numPort}
                        copiedSnippet={copiedSnippet}
                        copyToClipboard={copyToClipboard}
                    />

                    <McpSkillsCard
                        isSyncingSkills={isSyncingSkills}
                        handleSyncSkills={handleSyncSkills}
                    />

                    <McpDiagnosticsCard
                        diagnostics={diagnostics}
                        isRunningDiagnostics={isRunningDiagnostics}
                        handleRunDiagnostics={handleRunDiagnostics}
                    />

                    <McpTrafficCard
                        traffic={traffic}
                        handleRefreshTraffic={handleRefreshTraffic}
                        handleClearTraffic={handleClearTraffic}
                    />
                </>
            )}
        </div>
    );
}
