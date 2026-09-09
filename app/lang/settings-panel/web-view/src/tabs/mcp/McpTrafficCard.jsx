import { useState } from 'react';
import { IconMcp, IconSync } from '../../components/Icons';
import Pill from '../../components/Pill';

export default function McpTrafficCard({
    traffic = [],
    handleRefreshTraffic,
    handleClearTraffic,
}) {
    const [expandedTrafficId, setExpandedTrafficId] = useState(null);

    return (
        <section className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ margin: 0 }}>
                    <IconMcp />
                    Live MCP Traffic Inspector
                </h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        type="button"
                        className="secondary"
                        onClick={handleRefreshTraffic}
                        style={{ padding: '4px 10px', fontSize: '0.85em' }}
                    >
                        <IconSync /> Refresh
                    </button>
                    <button
                        type="button"
                        className="secondary"
                        onClick={handleClearTraffic}
                        disabled={!traffic || traffic.length === 0}
                        style={{ padding: '4px 10px', fontSize: '0.85em' }}
                    >
                        Clear
                    </button>
                </div>
            </div>
            <p className="card-desc" style={{ marginTop: '6px' }}>
                Real-time streaming log of tool invocations received by the CPQ MCP Server from Cursor, Copilot, Antigravity, Claude, or ChatGPT.
            </p>

            {(!traffic || traffic.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)', background: 'var(--vscode-sideBar-background, rgba(255,255,255,0.02))', borderRadius: '6px', marginTop: '12px', fontSize: '0.85em' }}>
                    No MCP tool requests logged yet. Trigger any CPQ tool in your AI assistant (e.g. &quot;@bml /audit&quot; or ask Cursor/Claude about CPQ) to see live traffic.
                </div>
            ) : (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                    {traffic.map((req) => (
                        <div
                            key={req.id}
                            onClick={() => setExpandedTrafficId(expandedTrafficId === req.id ? null : req.id)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '5px',
                                border: '1px solid var(--vscode-widget-border, rgba(128,128,128,0.2))',
                                background: 'var(--vscode-sideBar-background, rgba(255,255,255,0.03))',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                fontSize: '0.82em'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Pill tone={req.success ? 'success' : 'error'}>
                                        {req.success ? 'OK' : 'ERR'}
                                    </Pill>
                                    <code style={{ fontWeight: 600, color: 'var(--vscode-symbolIcon-functionForeground, #dcdcaa)' }}>
                                        {req.tool}
                                    </code>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--vscode-descriptionForeground)' }}>
                                    <span>{req.durationMs}ms</span>
                                    <span>{new Date(req.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                            {expandedTrafficId === req.id && (
                                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--vscode-widget-border, rgba(128,128,128,0.2))' }}>
                                    {req.argsSummary && (
                                        <div style={{ color: 'var(--vscode-descriptionForeground)', fontFamily: 'monospace' }}>
                                            <strong>Args:</strong> {req.argsSummary}
                                        </div>
                                    )}
                                    {req.error && (
                                        <div style={{ color: 'var(--vscode-errorForeground, #f48771)', marginTop: '3px' }}>
                                            <strong>Error:</strong> {req.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
