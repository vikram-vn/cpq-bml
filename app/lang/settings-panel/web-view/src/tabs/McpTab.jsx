import Switch from '../components/Switch';
import { IconMcp } from '../components/Icons';

export default function McpTab({ active, mcp = {}, drafts, changeDraft, updateField }) {
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
