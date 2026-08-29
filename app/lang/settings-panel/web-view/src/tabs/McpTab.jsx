import Switch from '../components/Switch';
import { IconMcp } from '../components/Icons';
import AiSkillSwitch from '../components/AiSkillSwitch';
import McpHealthBadge from '../components/McpHealthBadge';

export default function McpTab({ active, mcp = {}, drafts, changeDraft, updateField }) {
    if (!active) return null;

    const aiSkills = mcp.aiSkills || {};
    const isMcpEnabled = mcp.enable;

    const rawPort = drafts['mcp.port'] !== undefined ? drafts['mcp.port'] : (mcp.port || 47821);
    const numPort = Number(rawPort);
    const isDefaultPort = numPort === 47821;
    const isPrivileged = numPort > 0 && numPort < 1024;
    const isOutOfRange = numPort < 1 || numPort > 65535;

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

            <section className="card">
                <h2>
                    <IconMcp />
                    AI Skills
                </h2>
                <p className="card-desc">
                    While the MCP server is enabled, scaffolds BML/CPQ knowledge as native skills or rules for the AI tools you use.
                    Claude Code is on by default; enable the others only if you use them.
                </p>

                <AiSkillSwitch
                    id="aiSkillsClaude"
                    label="Claude Code"
                    description="Native project skills (.claude/skills/) plus a CLAUDE.md summary"
                    checked={aiSkills.claude}
                    disabled={!isMcpEnabled}
                    onChange={(v) => updateField('mcp.aiSkills.claude', v)}
                />

                <AiSkillSwitch
                    id="aiSkillsCursor"
                    label="Cursor"
                    description="Native project rules (.cursor/rules/*.mdc) plus a legacy .cursorrules file"
                    checked={aiSkills.cursor}
                    disabled={!isMcpEnabled}
                    onChange={(v) => updateField('mcp.aiSkills.cursor', v)}
                />

                <AiSkillSwitch
                    id="aiSkillsCopilot"
                    label="GitHub Copilot"
                    description="Native path-scoped instructions (.github/instructions/*.instructions.md) plus a repo-wide copilot-instructions.md"
                    checked={aiSkills.copilot}
                    disabled={!isMcpEnabled}
                    onChange={(v) => updateField('mcp.aiSkills.copilot', v)}
                />

                <Switch
                    id="aiSkillsCodexAntigravity"
                    label="Codex CLI (OpenAI) & Antigravity IDE (Google)"
                    description="Native project skills (.agents/skills/) - always enabled, both tools share this convention"
                    checked={true}
                    disabled={true}
                    onChange={() => {}}
                />
            </section>
        </div>
    );
}
