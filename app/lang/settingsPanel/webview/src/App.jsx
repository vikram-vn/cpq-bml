import { useEffect, useState, useRef } from 'react';
import { Pill, Switch, IconConnection, IconEnvironments, IconOperations, IconMcp, IconAdvanced, IconFeatures } from './Components';
import { ConnectionTab, EnvironmentsTab, OperationsTab, McpTab, AdvancedTab, FeaturesTab } from './Tabs';

const EMPTY_STATE = {
    connection: {
        siteUrl: '',
        authMethod: 'basic',
        username: '',
        enabled: true
    },
    rest: {
        pullFolder: 'library',
        restVersion: 'v18',
        commerceProcess: 'oraclecpqo',
        commerceDocument: 'transaction'
    },
    features: {
        lint: true,
        comments: true,
        spelling: true
    },
    mcp: { enable: false, port: 47821, logToTerminal: false },
    debug: { logOutputToFile: false, logRestDetails: false },
    environments: [],
    hasPassword: false,
    hasToken: false
};

export default function App({ vscodeApi }) {
    const [state, setState] = useState(EMPTY_STATE);
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState(null);

    // UX details states
    const [activeTab, setActiveTab] = useState('connection');
    const [showPassword, setShowPassword] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState('');

    // Debounced drafts & timeout tracking
    const [drafts, setDrafts] = useState({});
    const saveTimeouts = useRef({});

    useEffect(() => {
        const onMessage = (event) => {
            const message = event.data;
            if (!message) return;
            if (message.type === 'state') {
                const { type, ...rest } = message;
                setState(prev => ({ ...prev, ...rest }));
                setIsSaving(false);
                if (rest.activeTab) {
                    setActiveTab(rest.activeTab);
                }
                // Flush drafts that are no longer pending saving timeouts
                setDrafts(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach((key) => {
                        if (!saveTimeouts.current[key]) {
                            delete next[key];
                        }
                    });
                    return next;
                });
            } else if (message.type === 'switchTab') {
                if (message.tab) {
                    setActiveTab(message.tab);
                }
            } else if (message.type === 'testConnectionResult') {
                setTesting(false);
                setTestResult(message);
            } else if (message.type === 'error') {
                setTesting(false);
                setError(message.message);
                setIsSaving(false);
            }
        };
        window.addEventListener('message', onMessage);
        vscodeApi.postMessage({ type: 'ready' });
        
        return () => {
            window.removeEventListener('message', onMessage);
            // Cleanup any active timers on component unmount
            Object.values(saveTimeouts.current).forEach(clearTimeout);
        };
    }, [vscodeApi]);

    // Fast settings update (e.g. checkbox click, select option) - updates instantly
    const updateField = (key, value) => {
        setError(null);
        setIsSaving(true);
        vscodeApi.postMessage({ type: 'updateField', key, value });
    };

    // Debounced text settings update (e.g. Site URL, Username, Pull Folder)
    const changeDraft = (key, value) => {
        setError(null);
        setIsSaving(true);
        setDrafts(prev => ({ ...prev, [key]: value }));
        
        if (saveTimeouts.current[key]) {
            clearTimeout(saveTimeouts.current[key]);
        }
        
        saveTimeouts.current[key] = setTimeout(() => {
            let parsedVal = value;
            if (key === 'mcp.port') {
                parsedVal = Number(value) || 0;
            }
            vscodeApi.postMessage({ type: 'updateField', key, value: parsedVal });
            delete saveTimeouts.current[key];
        }, 600);
    };

    const savePassword = () => {
        if (!password) return;
        setIsSaving(true);
        vscodeApi.postMessage({ type: 'setPassword', value: password });
        setPassword('');
        triggerToast('Password updated successfully');
    };

    const saveToken = () => {
        if (!token) return;
        setIsSaving(true);
        vscodeApi.postMessage({ type: 'setAuthToken', value: token });
        setToken('');
        triggerToast('Auth token updated successfully');
    };

    const triggerToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const testConnection = () => {
        setTesting(true);
        setTestResult(null);
        vscodeApi.postMessage({ type: 'testConnection' });
    };

    const {
        connection = {},
        rest = {},
        features = {},
        mcp = {},
        debug = {}
    } = state || {};

    return (
        <div className="layout-container">
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>CPQ-BML</h1>
                    <p>Connection Settings Dashboard</p>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`sidebar-item ${activeTab === 'connection' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('connection'); setError(null); }}
                    >
                        <IconConnection />
                        Connection
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'environments' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('environments'); setError(null); }}
                    >
                        <IconEnvironments />
                        Environments
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'operations' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('operations'); setError(null); }}
                    >
                        <IconOperations />
                        REST Configuration
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'features' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('features'); setError(null); }}
                    >
                        <IconFeatures />
                        Features
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'mcp' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('mcp'); setError(null); }}
                    >
                        <IconMcp />
                        MCP Server (AI)
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'advanced' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('advanced'); setError(null); }}
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
                    <button className="link" style={{ fontSize: '0.8em', width: '100%', textAlign: 'left', display: 'block', paddingTop: '8px', borderTop: '1px solid var(--vscode-widget-border, var(--vscode-panel-border))' }} onClick={() => vscodeApi.postMessage({ type: 'openNativeSettings' })}>
                        Open settings.json
                    </button>
                </div>
            </aside>

            <main className="content-area">
                {error && (
                    <div style={{ marginBottom: '20px' }}>
                        <Pill tone="error">{error}</Pill>
                    </div>
                )}

                <ConnectionTab
                    active={activeTab === 'connection'}
                    connection={connection}
                    drafts={drafts}
                    changeDraft={changeDraft}
                    updateField={updateField}
                    state={state}
                    password={password}
                    setPassword={setPassword}
                    savePassword={savePassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    token={token}
                    setToken={setToken}
                    saveToken={saveToken}
                    showToken={showToken}
                    setShowToken={setShowToken}
                    testing={testing}
                    testConnection={testConnection}
                    testResult={testResult}
                />

                <EnvironmentsTab
                    active={activeTab === 'environments'}
                    state={state}
                    connection={connection}
                    vscodeApi={vscodeApi}
                />

                <OperationsTab
                    active={activeTab === 'operations'}
                    rest={rest}
                    drafts={drafts}
                    connection={connection}
                    changeDraft={changeDraft}
                />

                <FeaturesTab
                    active={activeTab === 'features'}
                    features={features}
                    updateField={updateField}
                />

                <McpTab
                    active={activeTab === 'mcp'}
                    mcp={mcp}
                    drafts={drafts}
                    changeDraft={changeDraft}
                    updateField={updateField}
                />

                <AdvancedTab
                    active={activeTab === 'advanced'}
                    debug={debug}
                    updateField={updateField}
                />
            </main>

            {/* Toast notifications */}
            {toast && (
                <div className="toast-notification">
                    <svg className="toast-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>{toast}</span>
                </div>
            )}
        </div>
    );
}
