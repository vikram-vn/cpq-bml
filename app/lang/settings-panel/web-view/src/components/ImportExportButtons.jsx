import React from 'react';

/**
 * Simple UI component with Import and Export buttons for the Settings Panel.
 */
export default function ImportExportButtons({ onImport, onExport }) {
    return (
        <div className="import-export-actions" style={{ display: 'flex', gap: '10px', marginTop: '12px', marginBottom: '8px' }}>
            <button type="button" onClick={onImport}>
                Import Settings
            </button>
            <button type="button" className="secondary" onClick={onExport}>
                Export Settings
            </button>
        </div>
    );
}
