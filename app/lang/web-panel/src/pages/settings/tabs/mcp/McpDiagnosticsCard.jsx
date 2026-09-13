import { IconMcp, IconSync } from '../../components/Icons';
import Pill from '../../components/Pill';

export default function McpDiagnosticsCard({
    diagnostics,
    isRunningDiagnostics,
    handleRunDiagnostics,
}) {
    return (
        <section className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ margin: 0 }}>
                    <IconMcp />
                    AI Setup Diagnostic Scorecard
                </h2>
                <button
                    type="button"
                    className="secondary"
                    onClick={handleRunDiagnostics}
                    disabled={isRunningDiagnostics}
                    style={{ padding: '4px 12px', fontSize: '0.85em' }}
                >
                    <span className={isRunningDiagnostics ? 'spinner' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <IconSync />
                    </span>
                    {isRunningDiagnostics ? 'Evaluating Setup...' : 'Run Full Diagnostics'}
                </button>
            </div>
            <p className="card-desc" style={{ marginTop: '6px' }}>
                Perform an automated diagnostic assessment across your local MCP server, CPQ site credentials, attribute cache, and native AI client registrations.
            </p>

            {!diagnostics && (
                <p className="field-hint" style={{ marginTop: '12px', fontStyle: 'italic' }}>
                    Click &quot;Run Full Diagnostics&quot; above to inspect the readiness of your AI setup.
                </p>
            )}

            {diagnostics && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.9em', fontWeight: 600, color: 'var(--vscode-foreground)' }}>Overall Readiness:</span>
                        <Pill tone={diagnostics.overall === 'healthy' ? 'success' : 'warning'}>
                            {diagnostics.overall === 'healthy' ? 'All Systems Operational' : 'Attention Recommended'}
                        </Pill>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                        {(diagnostics.checks || []).map((c, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '6px',
                                    border: `1px solid ${c.status === 'pass' ? 'var(--vscode-terminal-ansiGreen, #4ec9b0)' : 'var(--vscode-editorWarning-foreground, #cca700)'}`,
                                    background: 'var(--vscode-sideBar-background, rgba(255,255,255,0.03))',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '0.9em', color: 'var(--vscode-foreground)' }}>{c.name}</strong>
                                    <Pill tone={c.status === 'pass' ? 'success' : 'warning'}>
                                        {c.status === 'pass' ? 'PASS' : 'WARN'}
                                    </Pill>
                                </div>
                                <span style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>{c.detail}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
