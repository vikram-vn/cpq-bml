import {
    IconConnection,
    IconEnvironments,
    IconOperations,
    IconMcp,
    IconAdvanced,
    IconFeatures
} from './Icons';

export default function Sidebar({ activeTab, setActiveTab, setError, isSaving, vscodeApi }) {
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setError(null);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>CPQ-BML</h1>
                <p>Connection Settings Dashboard</p>
            </div>

            <nav className="sidebar-nav">
                <button
                    className={`sidebar-item ${activeTab === 'connection' ? 'active' : ''}`}
                    onClick={() => handleTabClick('connection')}
                >
                    <IconConnection />
                    Connection
                </button>
                <button
                    className={`sidebar-item ${activeTab === 'environments' ? 'active' : ''}`}
                    onClick={() => handleTabClick('environments')}
                >
                    <IconEnvironments />
                    Environments
                </button>
                <button
                    className={`sidebar-item ${activeTab === 'operations' ? 'active' : ''}`}
                    onClick={() => handleTabClick('operations')}
                >
                    <IconOperations />
                    REST Configuration
                </button>
                <button
                    className={`sidebar-item ${activeTab === 'features' ? 'active' : ''}`}
                    onClick={() => handleTabClick('features')}
                >
                    <IconFeatures />
                    Features
                </button>
                <button
                    className={`sidebar-item ${activeTab === 'mcp' ? 'active' : ''}`}
                    onClick={() => handleTabClick('mcp')}
                >
                    <IconMcp />
                    MCP Server (AI)
                </button>
                <button
                    className={`sidebar-item ${activeTab === 'advanced' ? 'active' : ''}`}
                    onClick={() => handleTabClick('advanced')}
                >
                    <IconAdvanced />
                    Diagnostics &amp; Logs
                </button>
            </nav>

            <div className="sidebar-footer">
                <div className="row between" style={{ fontSize: '0.78em', color: 'var(--vscode-descriptionForeground)', paddingBottom: '10px' }}>
                    <span>Status</span>
                    <div className="row" style={{ gap: '6px' }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isSaving ? 'var(--vscode-textLink-foreground)' : 'var(--vscode-terminal-ansiGreen, #6dd17a)',
                            boxShadow: isSaving ? 'none' : '0 0 6px var(--vscode-terminal-ansiGreen, #6dd17a)',
                            display: 'inline-block'
                        }} />
                        <span>{isSaving ? 'Syncing...' : 'Saved'}</span>
                    </div>
                </div>
                <button 
                    className="link" 
                    style={{ fontSize: '0.8em', width: '100%', textAlign: 'left', display: 'block', paddingTop: '8px', borderTop: '1px solid var(--vscode-widget-border, var(--vscode-panel-border))' }} 
                    onClick={() => vscodeApi.postMessage({ type: 'openNativeSettings' })}
                >
                    Open settings.json
                </button>
            </div>
        </aside>
    );
}
