import Switch from '../components/Switch';
import { IconMcp } from '../components/Icons';

export default function McpTab({ active, mcp = {}, drafts, changeDraft, updateField }) {
    if (!active) return null;

    const aiSkills = mcp.aiSkills || {};
    const isMcpEnabled = mcp.enable;

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

            <section className="card">
                <h2>
                    <IconMcp />
                    AI Skills
                </h2>
                <p className="card-desc">
                    While the MCP server is enabled, scaffolds BML/CPQ knowledge as native skills or rules for the AI tools you use.
                    Claude Code is on by default; enable the others only if you use them.
                </p>

                <Switch
                    id="aiSkillsClaude"
                    label="Claude Code"
                    description="Native project skills (.claude/skills/) plus a CLAUDE.md summary"
                    checked={aiSkills.claude}
                    disabled={!isMcpEnabled}
                    onChange={(v) => updateField('mcp.aiSkills.claude', v)}
                />

                <Switch
                    id="aiSkillsCursor"
                    label="Cursor"
                    description="Native project rules (.cursor/rules/*.mdc) plus a legacy .cursorrules file"
                    checked={aiSkills.cursor}
                    disabled={!isMcpEnabled}
                    onChange={(v) => updateField('mcp.aiSkills.cursor', v)}
                />

                <Switch
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
