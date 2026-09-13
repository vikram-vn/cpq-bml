import { IconMcp, IconCheck, IconDelete, IconCopy } from '../../components/Icons';
import Pill from '../../components/Pill';

export default function McpClientsCard({
    aiTools = [],
    isRegistering,
    isDeregistering,
    actionFeedback,
    handleRegisterMcp,
    handleDeregisterMcp,
    numPort,
    copiedSnippet,
    copyToClipboard,
}) {
    const jsonSnippet = JSON.stringify(
        {
            mcpServers: {
                'cpq-bml': {
                    url: `http://127.0.0.1:${numPort}/mcp`,
                },
            },
        },
        null,
        2
    );

    const cliSnippet = `claude mcp add --transport http cpq-bml http://127.0.0.1:${numPort}/mcp`;

    return (
        <>
            <section className="card" style={{ marginTop: '20px' }}>
                <h2>
                    <IconMcp />
                    Native AI Integrations &amp; Detected Clients
                </h2>
                <p className="card-desc">
                    Real-time status of supported AI desktop assistants and IDEs on your machine. Uninstalled tools are safely skipped to avoid polluting your directories.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 16px' }}>
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

                {actionFeedback && (
                    <div style={{ marginBottom: '14px' }}>
                        <Pill tone={actionFeedback.tone}>{actionFeedback.text}</Pill>
                    </div>
                )}

                {aiTools.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                        {aiTools.map((tool) => (
                            <div
                                key={tool.key}
                                style={{
                                    border: '1px solid var(--vscode-widget-border, #333)',
                                    borderRadius: '5px',
                                    padding: '10px 12px',
                                    background: 'var(--vscode-editor-background, rgba(0,0,0,0.15))',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '8px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9em', color: 'var(--vscode-foreground)' }}>
                                        {tool.name}
                                    </span>
                                    {tool.registered ? (
                                        <Pill tone="success">Configured</Pill>
                                    ) : tool.installed ? (
                                        <Pill tone="info">Detected</Pill>
                                    ) : (
                                        <span style={{ fontSize: '0.75em', opacity: 0.55, color: 'var(--vscode-descriptionForeground)' }}>
                                            Not Installed
                                        </span>
                                    )}
                                </div>

                                <div
                                    style={{
                                        fontSize: '0.75em',
                                        color: 'var(--vscode-descriptionForeground)',
                                        fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                    title={tool.configPath}
                                >
                                    {tool.configPath}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="card" style={{ marginTop: '20px' }}>
                <h2>
                    <IconCopy />
                    Manual Connection &amp; Custom MCP Clients
                </h2>
                <p className="card-desc">
                    Connecting from custom clients, Ollama, LibreChat, or the Claude Code CLI? Copy the configuration snippets below:
                </p>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <button
                        type="button"
                        className="secondary"
                        onClick={() => copyToClipboard(jsonSnippet, 'json')}
                    >
                        <IconCopy />
                        {copiedSnippet === 'json' ? 'JSON Copied!' : 'Copy MCP JSON Config'}
                    </button>

                    <button
                        type="button"
                        className="secondary"
                        onClick={() => copyToClipboard(cliSnippet, 'cli')}
                    >
                        <IconCopy />
                        {copiedSnippet === 'cli' ? 'Command Copied!' : 'Copy Claude CLI Command'}
                    </button>
                </div>
            </section>
        </>
    );
}
