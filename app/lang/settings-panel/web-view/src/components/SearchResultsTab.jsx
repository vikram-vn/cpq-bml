import Switch from './Switch';
import { IconSearch } from './Icons';

export const ALL_SETTINGS_REGISTRY = [
    // Connection
    { id: 'connectionEnabled', tab: 'connection', tabName: 'Connection', label: 'Enable Oracle CPQ REST Features', desc: 'When disabled, connection onboarding will be suppressed and REST toolbar icons will be hidden.', type: 'switch', key: 'connection.enabled' },
    { id: 'siteUrl', tab: 'connection', tabName: 'Connection', label: 'Site URL', desc: 'Supports sitename, sitename.bigmachines.com, or full https URLs.', type: 'input', key: 'connection.siteUrl' },
    { id: 'authMethod', tab: 'connection', tabName: 'Connection', label: 'Auth Method', desc: 'Authentication method: basic or bearer.', type: 'select', key: 'connection.authMethod' },
    { id: 'username', tab: 'connection', tabName: 'Connection', label: 'Username', desc: 'Oracle CPQ login username for basic authentication.', type: 'input', key: 'connection.username' },
    
    // Environments
    { id: 'environments', tab: 'environments', tabName: 'Environments', label: 'Environment Profiles', desc: 'Manage and switch between multiple saved Oracle CPQ environments.', type: 'link', actionText: 'Open Environments' },

    // Operations & REST
    { id: 'restVersion', tab: 'operations', tabName: 'Operations & REST', label: 'REST API Version', desc: 'e.g. v18 -> /rest/v18/bml/library/functions', type: 'input', key: 'rest.restVersion' },
    { id: 'commerceProcess', tab: 'operations', tabName: 'Operations & REST', label: 'Commerce Process', desc: 'Oracle CPQ process variable name', type: 'input', key: 'rest.commerceProcess' },
    { id: 'commerceDocument', tab: 'operations', tabName: 'Operations & REST', label: 'Commerce Document', desc: 'Process document variable name (e.g. transaction)', type: 'input', key: 'rest.commerceDocument' },
    { id: 'pullFolder', tab: 'operations', tabName: 'Operations & REST', label: 'Local Pull Folder', desc: 'Workspace relative path where pulled functions are saved', type: 'input', key: 'rest.pullFolder' },

    // Features
    { id: 'lint', tab: 'features', tabName: 'Features', label: 'BML Linter', desc: 'Real-time syntax and semantic validation with inline diagnostic squiggles', type: 'switch', key: 'features.lint' },
    { id: 'beautifier', tab: 'features', tabName: 'Features', label: 'Code Beautifier & Formatter', desc: 'Format and indent BML source code via command palette or document format shortcut', type: 'switch', key: 'features.beautifier' },
    { id: 'comments', tab: 'features', tabName: 'Features', label: 'Toggle Comments', desc: 'Line and block commenting support (Ctrl+/)', type: 'switch', key: 'features.comments' },
    { id: 'spelling', tab: 'features', tabName: 'Features', label: 'Spell Checker', desc: 'Spell checking in strings, comments, and identifiers', type: 'switch', key: 'features.spelling' },
    { id: 'intellisense', tab: 'features', tabName: 'Features', label: 'IntelliSense & Autocomplete', desc: 'Function signatures, built-in keyword completions, and documentation tooltips', type: 'switch', key: 'features.intellisense' },
    { id: 'docHeader', tab: 'features', tabName: 'Features', label: 'Documentation Headers', desc: 'Automatic doc header insertion when creating new BML files', type: 'switch', key: 'features.docHeader' },
    { id: 'xslt', tab: 'features', tabName: 'Features', label: 'XSLT View & Transform', desc: 'XSL stylesheet formatting, transformation preview, and validation', type: 'switch', key: 'features.xslt' },
    { id: 'metrics', tab: 'features', tabName: 'Features', label: 'Code Metrics', desc: 'Calculates cyclomatic complexity and maintainability index in status bar', type: 'switch', key: 'features.metrics' },
    { id: 'testing', tab: 'features', tabName: 'Features', label: 'Unit Test Runner', desc: 'Discovers and executes BML test suites locally with test explorer integration', type: 'switch', key: 'features.testing' },
    { id: 'inlayHints', tab: 'features', tabName: 'Features', label: 'Parameter Inlay Hints', desc: 'Displays inline parameter names in function calls', type: 'switch', key: 'inlayHints.enabled' },
    { id: 'suppressWhenArgumentMatchesName', tab: 'features', tabName: 'Features', label: 'Hide Hints on Exact Name Match', desc: 'Suppresses parameter name hints when argument variable name matches parameter', type: 'switch', key: 'inlayHints.suppressWhenArgumentMatchesName' },
    { id: 'variableTypes', tab: 'features', tabName: 'Features', label: 'Variable Type Inlay Hints', desc: 'Shows declared return type next to variable declarations', type: 'switch', key: 'inlayHints.variableTypes' },

    // AI & MCP
    { id: 'mcpEnable', tab: 'mcp', tabName: 'AI & MCP', label: 'Enable MCP Server', desc: 'Starts a local Model Context Protocol server on this machine', type: 'switch', key: 'mcp.enable' },
    { id: 'mcpPort', tab: 'mcp', tabName: 'AI & MCP', label: 'MCP Server Port', desc: 'Local TCP port where the MCP server listens for AI connections (default 47821)', type: 'number', key: 'mcp.port' },
    { id: 'mcpLog', tab: 'mcp', tabName: 'AI & MCP', label: 'Log MCP Operations to Terminal', desc: 'Stream AI-driven tool operations directly into VS Code integrated terminals', type: 'switch', key: 'mcp.logToTerminal' },
    { id: 'aiSkillsClaude', tab: 'mcp', tabName: 'AI & MCP', label: 'Claude Code AI Skill', desc: 'Native project skills (.claude/skills/) plus a CLAUDE.md summary', type: 'switch', key: 'mcp.aiSkills.claude' },
    { id: 'aiSkillsCursor', tab: 'mcp', tabName: 'AI & MCP', label: 'Cursor AI Skill', desc: 'Native project rules (.cursor/rules/*.mdc) plus a legacy .cursorrules file', type: 'switch', key: 'mcp.aiSkills.cursor' },
    { id: 'aiSkillsCopilot', tab: 'mcp', tabName: 'AI & MCP', label: 'GitHub Copilot AI Skill', desc: 'Native path-scoped instructions (.github/instructions/*.instructions.md)', type: 'switch', key: 'mcp.aiSkills.copilot' },

    // Advanced
    { id: 'debugLog', tab: 'advanced', tabName: 'Advanced', label: 'Log REST Details to File', desc: 'Save detailed API request/response structures inside bml_rest_api.log', type: 'switch', key: 'debug.logRestDetails' },
    { id: 'logOutputToFile', tab: 'advanced', tabName: 'Advanced', label: 'Log Print Statements to File', desc: 'Output BML print logs to bml_debug_print.log and return values to bml_debug_output.log', type: 'switch', key: 'debug.logOutputToFile' },
    { id: 'showResultsAsTable', tab: 'advanced', tabName: 'Advanced', label: 'Show Debug Results as Table', desc: 'Format JSON or dictionary return values in BML debug output as a key-value table', type: 'switch', key: 'debug.showResultsAsTable' },
    { id: 'backupRestore', tab: 'advanced', tabName: 'Advanced', label: 'Backup & Restore (Import / Export / Reset)', desc: 'Export or import CPQ-BML configuration JSON or reset to factory defaults', type: 'link', actionText: 'Open Backup & Restore' },
];

function getValueByPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
        if (cur === undefined || cur === null) return undefined;
        cur = cur[part];
    }
    return cur;
}

export default function SearchResultsTab({
    searchQuery,
    setSearchQuery,
    settings,
    drafts,
    changeDraft,
    updateField,
    onNavigateTab,
}) {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return null;

    const matches = ALL_SETTINGS_REGISTRY.filter((item) => {
        return (
            item.label.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.tabName.toLowerCase().includes(q) ||
            (item.key && item.key.toLowerCase().includes(q))
        );
    });

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconSearch />
                    Search Results ({matches.length})
                </h2>
                <p className="card-desc">
                    Matching settings for &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </p>

                {matches.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
                        <p>No settings matching &ldquo;{searchQuery}&rdquo;</p>
                        <button type="button" className="secondary" onClick={() => setSearchQuery('')} style={{ marginTop: '8px' }}>
                            Clear Search
                        </button>
                    </div>
                ) : (
                    <div className="search-matches" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {matches.map((item) => {
                            const val = item.key ? getValueByPath(settings, item.key) : undefined;
                            const draftVal = item.key && drafts[item.key] !== undefined ? drafts[item.key] : val;

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        border: '1px solid var(--vscode-widget-border, var(--vscode-panel-border))',
                                        borderRadius: 'var(--cpq-radius-md, 6px)',
                                        padding: '14px 16px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.01)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span
                                            onClick={() => {
                                                setSearchQuery('');
                                                onNavigateTab(item.tab);
                                            }}
                                            style={{
                                                fontSize: '0.75em',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                backgroundColor: 'var(--vscode-badge-background)',
                                                color: 'var(--vscode-badge-foreground)',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                            }}
                                            title={`Go to ${item.tabName} tab`}
                                        >
                                            {item.tabName} &rarr;
                                        </span>
                                    </div>

                                    {item.type === 'switch' && (
                                        <Switch
                                            id={`search-${item.id}`}
                                            label={item.label}
                                            description={item.desc}
                                            checked={!!val}
                                            onChange={(checked) => updateField(item.key, checked)}
                                        />
                                    )}

                                    {(item.type === 'input' || item.type === 'number') && (
                                        <div className="field" style={{ margin: 0 }}>
                                            <label htmlFor={`search-${item.id}`}>{item.label}</label>
                                            <input
                                                id={`search-${item.id}`}
                                                type={item.type === 'number' ? 'number' : 'text'}
                                                value={draftVal !== undefined ? draftVal : ''}
                                                onChange={(e) => changeDraft(item.key, e.target.value)}
                                            />
                                            <p className="field-hint">{item.desc}</p>
                                        </div>
                                    )}

                                    {item.type === 'select' && (
                                        <div className="field" style={{ margin: 0 }}>
                                            <label htmlFor={`search-${item.id}`}>{item.label}</label>
                                            <select
                                                id={`search-${item.id}`}
                                                value={val || 'basic'}
                                                onChange={(e) => updateField(item.key, e.target.value)}
                                            >
                                                <option value="basic">basic</option>
                                                <option value="bearer">bearer</option>
                                            </select>
                                            <p className="field-hint">{item.desc}</p>
                                        </div>
                                    )}

                                    {item.type === 'link' && (
                                        <div>
                                            <strong style={{ fontSize: '0.95em', display: 'block', marginBottom: '4px' }}>{item.label}</strong>
                                            <p className="field-hint" style={{ marginBottom: '10px' }}>{item.desc}</p>
                                            <button
                                                type="button"
                                                className="secondary"
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    onNavigateTab(item.tab);
                                                }}
                                            >
                                                {item.actionText || 'Open Tab'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
