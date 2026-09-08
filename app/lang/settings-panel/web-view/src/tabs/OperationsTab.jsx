import { useState } from 'react';
import { IconOperations, IconDatabase, IconSync, IconDelete } from '../components/Icons';
import Pill from '../components/Pill';

const PRESETS = [
    { label: 'Standard (oraclecpqo / transaction)', process: 'oraclecpqo', document: 'transaction' },
    { label: 'Quotes (quotes_process / quote_document)', process: 'quotes_process', document: 'quote_document' },
    { label: 'Legacy BM (bm_process / bm_document)', process: 'bm_process', document: 'bm_document' },
];

export default function OperationsTab({ active, rest = {}, drafts, changeDraft, metadata = {}, vscodeApi }) {
    const [isSyncing, setIsSyncing] = useState(false);

    if (!active) return null;

    const applyPreset = (process, document) => {
        changeDraft('rest.commerceProcess', process);
        changeDraft('rest.commerceDocument', document);
    };

    const handleSync = () => {
        if (!metadata.canSync || isSyncing) return;
        setIsSyncing(true);
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'syncMetadata' });
        }
        setTimeout(() => setIsSyncing(false), 2500);
    };

    const handleRemove = () => {
        if (!metadata.isSynced || isSyncing) return;
        if (window.confirm('Delete offline cached metadata? Autocomplete will fall back to standard built-in attributes.')) {
            if (vscodeApi) {
                vscodeApi.postMessage({ type: 'removeMetadata' });
            }
        }
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
                <div className="field">
                    <label htmlFor="pullFolder">Local Pull Folder</label>
                    <input
                        id="pullFolder"
                        type="text"
                        value={drafts['rest.pullFolder'] !== undefined ? drafts['rest.pullFolder'] : rest.pullFolder}
                        onChange={(e) => changeDraft('rest.pullFolder', e.target.value)}
                    />
                    <p className="field-hint">Workspace relative path where pulled functions are saved</p>
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

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={!metadata.canSync || isSyncing}
                        title={!metadata.canSync ? 'Active connection credentials required to sync metadata' : 'Sync metadata now'}
                    >
                        <IconSync />
                        {isSyncing ? 'Syncing...' : 'Sync Metadata'}
                    </button>

                    <button
                        type="button"
                        className="danger"
                        onClick={handleRemove}
                        disabled={!metadata.isSynced || isSyncing}
                        title={!metadata.isSynced ? 'No metadata to remove' : 'Delete cached metadata'}
                    >
                        <IconDelete />
                        Remove Metadata
                    </button>
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

