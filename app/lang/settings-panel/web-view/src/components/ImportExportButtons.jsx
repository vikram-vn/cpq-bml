import React from 'react';

/**
 * Simple UI component with Import and Export buttons for the Settings Panel.
 */
export default function ImportExportButtons({ onImport, onExport, onReset }) {
    return (
        <div className="import-export-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', marginBottom: '8px' }}>
            <button type="button" onClick={onImport}>
                Import Settings
            </button>
            <button type="button" className="secondary" onClick={onExport}>
                Export Settings
            </button>
            {onReset && (
                <button type="button" className="secondary" onClick={onReset} style={{ marginLeft: 'auto', color: 'var(--vscode-errorForeground, #f48771)' }}>
                    Reset to Factory Defaults
                </button>
            )}
        </div>
    );
}
