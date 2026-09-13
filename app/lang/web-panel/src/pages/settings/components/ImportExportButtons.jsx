import React from 'react';

/**
 * Simple UI component with Import and Export buttons for the Settings Panel.
 */
export default function ImportExportButtons({ onImport, onExport, onReset, confirmingReset, onCancelReset }) {
    return (
        <div className="import-export-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', marginBottom: '8px' }}>
            <button type="button" onClick={onImport}>
                Import Settings
            </button>
            <button type="button" className="secondary" onClick={onExport}>
                Export Settings
            </button>
            {onReset && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" className="secondary" onClick={onReset} style={{ color: 'var(--vscode-errorForeground, #f48771)' }}>
                        {confirmingReset ? 'Click to Confirm Reset' : 'Reset to Factory Defaults'}
                    </button>
                    {confirmingReset && onCancelReset && (
                        <button type="button" className="secondary" onClick={onCancelReset} style={{ padding: '4px 8px', fontSize: '0.85em' }}>
                            Cancel
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
