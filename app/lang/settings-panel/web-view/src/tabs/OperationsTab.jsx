import { IconOperations } from '../components/Icons';

const PRESETS = [
    { label: 'Standard (oraclecpqo / transaction)', process: 'oraclecpqo', document: 'transaction' },
    { label: 'Quotes (quotes_process / quote_document)', process: 'quotes_process', document: 'quote_document' },
    { label: 'Legacy BM (bm_process / bm_document)', process: 'bm_process', document: 'bm_document' },
];

export default function OperationsTab({ active, rest = {}, drafts, changeDraft }) {
    if (!active) return null;

    const applyPreset = (process, document) => {
        changeDraft('rest.commerceProcess', process);
        changeDraft('rest.commerceDocument', document);
    };

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
        </div>
    );
}
