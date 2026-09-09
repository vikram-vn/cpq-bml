import { useState, useRef } from 'react';
import Switch from '../components/Switch';
import { IconMcp, IconDelete } from '../components/Icons';
import McpHealthBadge from '../components/McpHealthBadge';

export default function McpTab({ active, mcp = {}, drafts, changeDraft, updateField, vscodeApi }) {
    if (!active) return null;

    const rawPort = drafts['mcp.port'] !== undefined ? drafts['mcp.port'] : (mcp.port || 47821);
    const numPort = Number(rawPort);
    const isDefaultPort = numPort === 47821;
    const isPrivileged = numPort > 0 && numPort < 1024;
    const isOutOfRange = numPort < 1 || numPort > 65535;

    const [confirmingClean, setConfirmingClean] = useState(false);
    const cleanTimerRef = useRef(null);

    const handleCleanAiWorkspace = () => {
        if (!confirmingClean) {
            setConfirmingClean(true);
            if (cleanTimerRef.current) clearTimeout(cleanTimerRef.current);
            cleanTimerRef.current = setTimeout(() => setConfirmingClean(false), 4000);
            return;
        }
        if (cleanTimerRef.current) {
            clearTimeout(cleanTimerRef.current);
            cleanTimerRef.current = null;
        }
        setConfirmingClean(false);
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'cleanAiWorkspaceFiles' });
        }
    };

    const handleCancelClean = () => {
        if (cleanTimerRef.current) {
            clearTimeout(cleanTimerRef.current);
            cleanTimerRef.current = null;
        }
        setConfirmingClean(false);
    };

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconMcp />
                    MCP (Model Context Protocol) Server
                </h2>
                <p className="card-desc">Exposes a local Model Context Protocol server on this machine.</p>
                <McpHealthBadge healthy={mcp.enable} />

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
            </section>

            <section className="card" style={{ marginTop: '20px' }}>
                <h2>
                    <IconMcp />
                    Universal AI Assistant Support
                </h2>
                <p className="card-desc">
                    All AI coding assistants (Claude Code, Cursor, GitHub Copilot, Codex CLI, Antigravity) connect dynamically to this MCP server.
                    BML syntax definitions, BMQL rules, pitfalls, and CPQ domain knowledge are delivered directly in memory over the MCP protocol without creating any files or folders in your workspace.
                </p>

                <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="secondary"
                        onClick={handleCleanAiWorkspace}
                        title={confirmingClean ? "Click again to confirm removing AI folders" : "Remove any legacy AI skill folders (.agents, .claude, .cursor, etc.) from project root"}
                    >
                        <IconDelete />
                        {confirmingClean ? 'Click to Confirm Clean' : 'Clean Legacy AI Workspace Files'}
                    </button>
                    {confirmingClean && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={handleCancelClean}
                            style={{ padding: '4px 8px', fontSize: '0.85em' }}
                        >
                            Cancel
                        </button>
                    )}
                    <span style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                        Safely cleans any legacy .agents, .claude, .cursor, CLAUDE.md, or .cursorrules from your workspace.
                    </span>
                </div>
            </section>
        </div>
    );
}

