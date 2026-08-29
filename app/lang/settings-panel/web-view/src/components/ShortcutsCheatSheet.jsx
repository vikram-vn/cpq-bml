import { useState, Fragment } from 'react';

const SHORTCUT_GROUPS = [
    {
        category: 'Editor & Authoring',
        shortcuts: [
            { action: 'Format / Beautify BML File', shortcut: 'Shift + Alt + F', context: 'When editing .bml source' },
            { action: 'BML IntelliSense Autocomplete', shortcut: 'Ctrl + Space', context: 'Inside functions & methods' },
            { action: 'Toggle Line Comment', shortcut: 'Ctrl + /', context: 'Supports // and comment tagging' },
            { action: 'Generate Function Doc-Header', shortcut: '/// (at line start)', context: 'Inserts structured params & return doc' },
            { action: 'Trigger Inlay Parameter Hints', shortcut: 'Automatic (toggle in Features)', context: 'Inline argument label names' },
        ]
    },
    {
        category: 'CPQ Remote Operations',
        shortcuts: [
            { action: 'Pull Util Library Functions', shortcut: 'Editor Title Bar / Palette', context: 'Pulls library from active CPQ tenant' },
            { action: 'Pull Commerce Functions', shortcut: 'Editor Title Bar / Palette', context: 'Pulls commerce process functions' },
            { action: 'Validate Function against CPQ', shortcut: 'Editor Title Bar (Check)', context: 'Runs remote syntax validation' },
            { action: 'Debug Function on CPQ', shortcut: 'Editor Title Bar (Bug)', context: 'Executes function with live test values' },
            { action: 'Deploy Function to CPQ', shortcut: 'Editor Title Bar (Rocket)', context: 'Compiles & pushes code to CPQ instance' },
            { action: 'Mass Deploy Library Functions', shortcut: 'Command Palette', context: 'Deploys all modified library files' },
            { action: 'Switch Active Environment', shortcut: 'Status Bar / Palette', context: 'Quick switch between Dev / Stage / Prod' },
        ]
    },
    {
        category: 'Testing & AI Assist',
        shortcuts: [
            { action: 'Run BML Test Sidecars', shortcut: 'Editor Title Bar (Play)', context: 'Executes *.bmltest.json suites' },
            { action: 'Update BML Snapshot Baseline', shortcut: 'Command Palette', context: 'Captures remote output baseline snapshot' },
            { action: 'Compare against Snapshot', shortcut: 'Command Palette', context: 'Detects regression differences against snapshot' },
            { action: 'Scaffold AI Skills for Workspace', shortcut: 'Command Palette / MCP Tab', context: 'Generates CPQ skills for Cursor, Copilot, etc.' },
            { action: 'Open Code Metrics Report', shortcut: 'Command Palette', context: 'Shows complexity & line count breakdown' },
        ]
    }
];

export default function ShortcutsCheatSheet() {
    const [filter, setFilter] = useState('');

    const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter((s) => {
            if (!filter.trim()) return true;
            const q = filter.trim().toLowerCase();
            return (
                s.action.toLowerCase().includes(q) ||
                s.shortcut.toLowerCase().includes(q) ||
                s.context.toLowerCase().includes(q) ||
                group.category.toLowerCase().includes(q)
            );
        })
    })).filter((group) => group.shortcuts.length > 0);

    return (
        <div className="shortcuts-cheatsheet">
            <div style={{ marginBottom: '12px' }}>
                <input
                    type="text"
                    placeholder="Filter shortcuts (e.g. format, deploy, test)..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '0.85em',
                        borderRadius: '4px',
                        border: '1px solid var(--vscode-input-border, transparent)',
                        backgroundColor: 'var(--vscode-input-background)',
                        color: 'var(--vscode-input-foreground)',
                    }}
                />
            </div>

            {filteredGroups.length === 0 ? (
                <p className="empty-state">No shortcuts matching &ldquo;{filter}&rdquo;.</p>
            ) : (
                <table className="shortcuts-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Action</th>
                            <th style={{ width: '30%' }}>Shortcut / Trigger</th>
                            <th style={{ width: '30%' }}>Context</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredGroups.map((group) => (
                            <Fragment key={group.category}>
                                <tr className="shortcuts-category-header">
                                    <td colSpan="3">{group.category}</td>
                                </tr>
                                {group.shortcuts.map((s) => (
                                    <tr key={s.action}>
                                        <td style={{ fontWeight: '500' }}>{s.action}</td>
                                        <td>
                                            <span className="shortcut-chip" style={{ marginLeft: 0 }}>
                                                {s.shortcut}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '0.92em' }}>
                                            {s.context}
                                        </td>
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
