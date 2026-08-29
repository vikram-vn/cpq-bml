import { useEffect, useReducer, useRef } from 'react';
import Pill from './components/Pill';
import Sidebar from './components/Sidebar';
import ConnectionTab from './tabs/ConnectionTab';
import EnvironmentsTab from './tabs/EnvironmentsTab';
import OperationsTab from './tabs/OperationsTab';
import FeaturesTab from './tabs/FeaturesTab';
import McpTab from './tabs/McpTab';
import AdvancedTab from './tabs/AdvancedTab';
import { EMPTY_STATE } from './constants';

const initialState = {
    settings: EMPTY_STATE,
    password: '',
    token: '',
    testResult: null,
    testing: false,
    error: null,
    activeTab: 'connection',
    showPassword: false,
    showToken: false,
    isSaving: false,
    toast: '',
    drafts: {},
};

function appReducer(state, action) {
    switch (action.type) {
        case 'RECEIVE_STATE': {
            const { activeTab, ...rest } = action.payload;
            return {
                ...state,
                settings: { ...state.settings, ...rest },
                isSaving: false,
                activeTab: activeTab || state.activeTab,
            };
        }
        case 'SWITCH_TAB':
            return { ...state, activeTab: action.tab };
        case 'SET_ACTIVE_TAB':
            return { ...state, activeTab: action.tab, error: null };
        case 'SET_SAVING':
            return { ...state, isSaving: action.isSaving };
        case 'SET_ERROR':
            return { ...state, error: action.error, testing: false, isSaving: false };
        case 'SET_PASSWORD':
            return { ...state, password: action.password };
        case 'SET_TOKEN':
            return { ...state, token: action.token };
        case 'SET_SHOW_PASSWORD':
            return { ...state, showPassword: typeof action.value === 'function' ? action.value(state.showPassword) : !!action.value };
        case 'SET_SHOW_TOKEN':
            return { ...state, showToken: typeof action.value === 'function' ? action.value(state.showToken) : !!action.value };
        case 'START_TEST_CONNECTION':
            return { ...state, testing: true, testResult: null };
        case 'SET_TEST_RESULT':
            return { ...state, testing: false, testResult: action.result };
        case 'SET_DRAFT':
            return {
                ...state,
                error: null,
                isSaving: true,
                drafts: { ...state.drafts, [action.key]: action.value },
            };
        case 'FLUSH_DRAFTS': {
            const nextDrafts = { ...state.drafts };
            Object.keys(nextDrafts).forEach((key) => {
                if (!action.keepKeys.includes(key)) {
                    delete nextDrafts[key];
                }
            });
            return { ...state, drafts: nextDrafts };
        }
        case 'SET_TOAST':
            return { ...state, toast: action.toast };
        default:
            return state;
    }
}

export default function App({ vscodeApi }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const saveTimeouts = useRef({});
    const toastTimeout = useRef(null);

    const triggerToast = (msg) => {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        dispatch({ type: 'SET_TOAST', toast: msg });
        toastTimeout.current = setTimeout(() => {
            dispatch({ type: 'SET_TOAST', toast: '' });
        }, 3000);
    };

    useEffect(() => {
        const onMessage = (event) => {
            const message = event.data;
            if (!message) return;
            if (message.type === 'state') {
                const { type, ...rest } = message;
                dispatch({ type: 'RECEIVE_STATE', payload: rest });
                dispatch({
                    type: 'FLUSH_DRAFTS',
                    keepKeys: Object.keys(saveTimeouts.current),
                });
            } else if (message.type === 'switchTab') {
                if (message.tab) {
                    dispatch({ type: 'SWITCH_TAB', tab: message.tab });
                }
            } else if (message.type === 'testConnectionResult') {
                dispatch({ type: 'SET_TEST_RESULT', result: message });
            } else if (message.type === 'error') {
                dispatch({ type: 'SET_ERROR', error: message.message });
            } else if (message.type === 'toast') {
                triggerToast(message.message);
            }
        };
        window.addEventListener('message', onMessage);
        vscodeApi.postMessage({ type: 'ready' });

        return () => {
            window.removeEventListener('message', onMessage);
            Object.values(saveTimeouts.current).forEach(clearTimeout);
            if (toastTimeout.current) clearTimeout(toastTimeout.current);
        };
    }, [vscodeApi]);

    // Fast settings update (e.g. checkbox click, select option) - updates instantly
    const updateField = (key, value) => {
        dispatch({ type: 'SET_ERROR', error: null });
        dispatch({ type: 'SET_SAVING', isSaving: true });
        vscodeApi.postMessage({ type: 'updateField', key, value });
    };

    // Debounced text settings update (e.g. Site URL, Username, Pull Folder)
    const changeDraft = (key, value) => {
        dispatch({ type: 'SET_DRAFT', key, value });

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
        if (!state.password) return;
        dispatch({ type: 'SET_SAVING', isSaving: true });
        vscodeApi.postMessage({ type: 'setPassword', value: state.password });
        dispatch({ type: 'SET_PASSWORD', password: '' });
        triggerToast('Password updated successfully');
    };

    const saveToken = () => {
        if (!state.token) return;
        dispatch({ type: 'SET_SAVING', isSaving: true });
        vscodeApi.postMessage({ type: 'setAuthToken', value: state.token });
        dispatch({ type: 'SET_TOKEN', token: '' });
        triggerToast('Auth token updated successfully');
    };

    const testConnection = () => {
        dispatch({ type: 'START_TEST_CONNECTION' });
        vscodeApi.postMessage({ type: 'testConnection' });
    };

    const {
        settings,
        password,
        token,
        testResult,
        testing,
        error,
        activeTab,
        showPassword,
        showToken,
        isSaving,
        toast,
        drafts,
    } = state;

    const {
        connection = {},
        rest = {},
        features = {},
        inlayHints = {},
        mcp = {},
        debug = {},
    } = settings || {};

    const setActiveTab = (tab) => dispatch({ type: 'SET_ACTIVE_TAB', tab });
    const setError = (err) => dispatch({ type: 'SET_ERROR', error: err });
    const setPassword = (p) => dispatch({ type: 'SET_PASSWORD', password: p });
    const setToken = (t) => dispatch({ type: 'SET_TOKEN', token: t });
    const setShowPassword = (v) => dispatch({ type: 'SET_SHOW_PASSWORD', value: v });
    const setShowToken = (v) => dispatch({ type: 'SET_SHOW_TOKEN', value: v });

    return (
        <div className="layout-container">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                setError={setError} 
                isSaving={isSaving} 
                vscodeApi={vscodeApi} 
            />

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
                    state={settings}
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
                    state={settings}
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
                    inlayHints={inlayHints}
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
                    vscodeApi={vscodeApi}
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
