import React from 'react';

/**
 * Simple UI component with Import and Export buttons for the Settings Panel.
 */
export default function ImportExportButtons({ onImport, onExport }) {
  return (
    <div className="import-export-buttons" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      <button type="button" className="button-primary" onClick={onImport}>
        Import Settings
      </button>
      <button type="button" className="button-secondary" onClick={onExport}>
        Export Settings
      </button>
    </div>
  );
}
