import { useState, useRef } from 'react';
import { IconOperations, IconDatabase, IconSync, IconDelete } from '../components/Icons';
import Pill from '../components/Pill';

const PRESETS = [
    { label: 'Standard (oraclecpqo / transaction)', process: 'oraclecpqo', document: 'transaction' },
    { label: 'Quotes (quotes_process / quote_document)', process: 'quotes_process', document: 'quote_document' },
    { label: 'Legacy BM (bm_process / bm_document)', process: 'bm_process', document: 'bm_document' },
];

export default function OperationsTab({ active, rest = {}, drafts, changeDraft, metadata = {}, vscodeApi, syncProgress = {} }) {
    if (!active) return null;

    const isSyncing = !!syncProgress.isSyncing;

    const applyPreset = (process, document) => {
        changeDraft('rest.commerceProcess', process);
        changeDraft('rest.commerceDocument', document);
    };

    const handleSync = () => {
        if (!metadata.canSync || isSyncing) return;
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'syncMetadata' });
        }
    };

    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const removeTimerRef = useRef(null);

    const handleRemove = () => {
        if (!metadata.isSynced || isSyncing) return;
        if (!confirmingRemove) {
            setConfirmingRemove(true);
            if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
            removeTimerRef.current = setTimeout(() => {
                setConfirmingRemove(false);
            }, 4000);
            return;
        }
        if (removeTimerRef.current) {
            clearTimeout(removeTimerRef.current);
            removeTimerRef.current = null;
        }
        setConfirmingRemove(false);
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'removeMetadata' });
        }
    };

    const handleCancelRemove = () => {
        if (removeTimerRef.current) {
            clearTimeout(removeTimerRef.current);
            removeTimerRef.current = null;
        }
        setConfirmingRemove(false);
    };

    const commerceCount = metadata.commerceCount || 0;
    const configCount = metadata.configCount || 0;
    const systemCount = metadata.systemCount || 0;
    const totalCount = commerceCount + configCount + systemCount;

    const formattedLastModified = metadata.updatedAt
        ? new Date(metadata.updatedAt).toLocaleString()
        : 'Never';

    return (
        <div className="tab-content active">
            <section className="card">
                <h2>
                    <IconOperations />
                    Operations &amp; REST
                </h2>
                <p className="card-desc">Configure REST details, library folders, and process paths for operations.</p>

                <div className="field">
                    <label htmlFor="restVersion">REST API Version</label>
                    <input
                        id="restVersion"
                        type="text"
                        value={drafts['rest.restVersion'] !== undefined ? drafts['rest.restVersion'] : rest.restVersion}
                        onChange={(e) => changeDraft('rest.restVersion', e.target.value)}
                    />
                    <p className="field-hint">e.g. v18 {"->"} /rest/v18/bml/library/functions</p>
                </div>

                <div style={{ margin: '14px 0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)' }}>Quick Presets:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {PRESETS.map((p) => (
                            <button
                                key={p.process}
                                type="button"
                                className="secondary"
                                style={{ fontSize: '0.78em', padding: '4px 8px' }}
                                onClick={() => applyPreset(p.process, p.document)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="commerceProcess">Commerce Process</label>
                    <input
                        id="commerceProcess"
                        type="text"
                        value={drafts['rest.commerceProcess'] !== undefined ? drafts['rest.commerceProcess'] : rest.commerceProcess}
                        onChange={(e) => changeDraft('rest.commerceProcess', e.target.value)}
                    />
                    <p className="field-hint">Oracle CPQ process variable name</p>
                </div>
                <div className="field">
                    <label htmlFor="commerceDocument">Commerce Document</label>
                    <input
                        id="commerceDocument"
                        type="text"
                        value={drafts['rest.commerceDocument'] !== undefined ? drafts['rest.commerceDocument'] : rest.commerceDocument}
                        onChange={(e) => changeDraft('rest.commerceDocument', e.target.value)}
                    />
                    <p className="field-hint">Process document variable name (e.g. transaction)</p>
                </div>
            </section>

            <section className="card" style={{ marginTop: '20px' }}>
                <h2>
                    <IconDatabase />
                    Offline Metadata Cache
                </h2>
                <p className="card-desc">
                    Synchronize commerce, configuration, and system attributes into the extension's backend cache for intelligent offline autocomplete and hover documentation without polluting your workspace.
                </p>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'var(--vscode-editorWidget-background, rgba(255,255,255,0.03))',
                    border: '1px solid var(--vscode-widget-border, var(--vscode-panel-border))',
                    borderRadius: 'var(--cpq-radius-md, 6px)',
                    margin: '12px 0 16px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Cache Status</span>
                        <Pill tone={metadata.isSynced ? 'success' : 'muted'}>
                            {metadata.isSynced ? 'Synced' : 'Not Synced'}
                        </Pill>
                    </div>

                    {metadata.isSynced ? (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                                gap: '8px',
                                marginTop: '4px',
                            }}>
                                <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                                    Commerce: <strong style={{ color: 'var(--vscode-foreground)' }}>{commerceCount}</strong>
                                </div>
                                <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                                    Config: <strong style={{ color: 'var(--vscode-foreground)' }}>{configCount}</strong>
                                </div>
                                <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                                    System: <strong style={{ color: 'var(--vscode-foreground)' }}>{systemCount}</strong>
                                </div>
                                <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                                    Total: <strong style={{ color: 'var(--vscode-foreground)' }}>{totalCount}</strong>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.78em', color: 'var(--vscode-descriptionForeground)', borderTop: '1px solid var(--vscode-widget-border, var(--vscode-panel-border))', paddingTop: '8px' }}>
                                Last Synced: <strong>{formattedLastModified}</strong>
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                            No attribute metadata currently cached. Autocomplete is using built-in CPQ standards.
                        </div>
                    )}
                </div>

                {isSyncing && (
                    <div style={{
                        margin: '12px 0 16px',
                        padding: '12px 14px',
                        background: 'var(--vscode-editorWidget-background, rgba(255,255,255,0.03))',
                        border: '1px solid var(--vscode-focusBorder, #007acc)',
                        borderRadius: 'var(--cpq-radius-md, 6px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.83em', fontWeight: 600, color: 'var(--vscode-foreground)' }}>
                                {syncProgress.message || 'Syncing attributes...'}
                            </span>
                            {syncProgress.percent !== null && syncProgress.percent !== undefined && (
                                <span style={{ fontSize: '0.83em', fontWeight: 700, color: 'var(--vscode-charts-blue, #3794ff)' }}>
                                    {syncProgress.percent}%
                                </span>
                            )}
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: 'var(--vscode-editor-background, rgba(0,0,0,0.3))',
                            borderRadius: '3px',
                            overflow: 'hidden',
                        }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: syncProgress.percent !== null && syncProgress.percent !== undefined
                                        ? `${Math.max(4, Math.min(100, syncProgress.percent))}%`
                                        : '100%',
                                    backgroundColor: 'var(--vscode-progressBar-background, #007acc)',
                                    borderRadius: '3px',
                                    transition: 'width 0.3s ease-out',
                                    animation: syncProgress.percent === null || syncProgress.percent === undefined
                                        ? 'syncProgressIndeterminate 1.5s infinite linear'
                                        : 'none',
                                }}
                            />
                        </div>
                        {syncProgress.total && syncProgress.current !== null && (
                            <div style={{ fontSize: '0.75em', color: 'var(--vscode-descriptionForeground)' }}>
                                Processed {syncProgress.current.toLocaleString()} of {syncProgress.total.toLocaleString()} attributes
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={!metadata.canSync || isSyncing}
                        title={!metadata.canSync ? 'Active connection credentials required to sync metadata' : 'Sync metadata now'}
                    >
                        <span className={isSyncing ? "spinner" : ""} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <IconSync />
                        </span>
                        {isSyncing ? 'Syncing...' : 'Sync Metadata'}
                    </button>

                    <button
                        type="button"
                        className="danger"
                        onClick={handleRemove}
                        disabled={!metadata.isSynced || isSyncing}
                        title={!metadata.isSynced ? 'No metadata to remove' : (confirmingRemove ? 'Click again to confirm deletion' : 'Delete cached metadata')}
                    >
                        <IconDelete />
                        {confirmingRemove ? 'Click to Confirm Remove' : 'Remove Metadata'}
                    </button>

                    {confirmingRemove && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={handleCancelRemove}
                            style={{ padding: '4px 10px', fontSize: '0.85em' }}
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {!metadata.canSync ? (
                    <p className="field-hint" style={{ color: 'var(--vscode-inputValidation-warningForeground, #cca700)', marginTop: '10px' }}>
                        Active connection credentials (Site URL and password/token) required to sync metadata.
                    </p>
                ) : (
                    <p className="field-hint" style={{ marginTop: '10px' }}>
                        Cached attributes are isolated in backend extension storage and will never create folders in your workspace.
                    </p>
                )}
            </section>
        </div>
    );
}

