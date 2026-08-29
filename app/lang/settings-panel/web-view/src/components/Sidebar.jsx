import { useRef } from 'react';
import {
    IconConnection,
    IconEnvironments,
    IconOperations,
    IconMcp,
    IconAdvanced,
    IconFeatures,
    IconSearch,
} from './Icons';

const TABS = [
    { id: 'connection', label: 'Connection', icon: IconConnection },
    { id: 'environments', label: 'Environments', icon: IconEnvironments },
    { id: 'operations', label: 'Operations & REST', icon: IconOperations },
    { id: 'features', label: 'Features', icon: IconFeatures },
    { id: 'mcp', label: 'AI & MCP', icon: IconMcp },
    { id: 'advanced', label: 'Advanced', icon: IconAdvanced },
];

export default function Sidebar({
    activeTab,
    setActiveTab,
    setError,
    isSaving,
    vscodeApi,
    searchQuery = '',
    setSearchQuery,
}) {
    const searchInputRef = useRef(null);

    const handleTabClick = (tab) => {
        if (setSearchQuery) setSearchQuery('');
        setActiveTab(tab);
        setError(null);
        vscodeApi.postMessage({ type: 'tabChanged', tab });
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (index + 1) % TABS.length;
            handleTabClick(TABS[nextIndex].id);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (index - 1 + TABS.length) % TABS.length;
            handleTabClick(TABS[prevIndex].id);
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>CPQ-BML</h1>
                <p>Connection Settings Dashboard</p>
            </div>

            {setSearchQuery && (
                <div className="sidebar-search" style={{ padding: '0 16px 12px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '8px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: 'var(--vscode-input-placeholderForeground)' }}>
                            <IconSearch />
                        </span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search settings..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                paddingLeft: '28px',
                                paddingRight: searchQuery ? '24px' : '8px',
                                height: '28px',
                                fontSize: '0.85em',
                                borderRadius: '4px',
                                border: '1px solid var(--vscode-input-border, transparent)',
                                backgroundColor: 'var(--vscode-input-background)',
                                color: 'var(--vscode-input-foreground)',
                                outline: 'none',
                            }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '6px',
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    color: 'var(--vscode-input-placeholderForeground)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                }}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            )}

            <nav className="sidebar-nav" role="tablist">
                {TABS.map((tab, idx) => {
                    const Icon = tab.icon;
                    const isActive = !searchQuery && activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            className={`sidebar-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab.id)}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                        >
                            <Icon />
                            {tab.label}
                        </button>
                    );
                })}
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
