import React, { useState, useEffect, useCallback } from 'react';

const DEFAULT_QUERY = `SELECT part_number, price, description \nFROM Pricing_Table \nWHERE currency = $currency AND active = $active`;

const DEFAULT_PARAMS = [
  { id: '1', name: 'currency', type: 'String', value: 'USD' },
  { id: '2', name: 'active', type: 'Boolean', value: 'true' }
];

export default function App({ vscodeApi }) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({ connected: false, siteUrl: 'Offline (Mock Mode)' });
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg) return;
      switch (msg.type) {
        case 'queryResult':
          setLoading(false);
          setError(null);
          setResults(msg.payload);
          break;
        case 'queryError':
          setLoading(false);
          setError(msg.message);
          setResults(null);
          break;
        case 'connectionStatus':
          setConnection(msg.payload);
          break;
        case 'history':
          if (Array.isArray(msg.payload)) setHistory(msg.payload);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscodeApi.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [vscodeApi]);

  const handleRunQuery = useCallback(() => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    vscodeApi.postMessage({
      type: 'runQuery',
      query: query.trim(),
      params: params.filter(p => p.name.trim().length > 0)
    });
  }, [query, params, loading, vscodeApi]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunQuery();
    }
  };

  const addParam = () => {
    setParams(prev => [...prev, { id: String(Date.now()), name: '', type: 'String', value: '' }]);
  };

  const removeParam = (id) => {
    setParams(prev => prev.filter(p => p.id !== id));
  };

  const updateParam = (id, field, val) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const handleExportCsv = () => {
    if (!results || !results.rows || results.rows.length === 0) return;
    vscodeApi.postMessage({ type: 'exportCsv', data: results });
  };

  const handleExportJson = () => {
    if (!results || !results.rows || results.rows.length === 0) return;
    vscodeApi.postMessage({ type: 'exportJson', data: results });
  };

  const handleCopyClipboard = () => {
    if (!results || !results.rows) return;
    vscodeApi.postMessage({ type: 'copyClipboard', text: JSON.stringify(results.rows, null, 2) });
  };

  return (
    <div className="console-container" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="console-header">
        <div className="title-group">
          <span className="console-title">⚡ Live BMQL Query Console</span>
          <div className={`status-badge ${connection.connected ? 'connected' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{connection.connected ? `Connected: ${connection.siteUrl}` : connection.siteUrl}</span>
          </div>
        </div>
        {history.length > 0 && (
          <select
            className="param-select"
            onChange={(e) => e.target.value && setQuery(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Recent Queries ({history.length})</option>
            {history.map((h, i) => (
              <option key={i} value={h}>{h.slice(0, 45)}...</option>
            ))}
          </select>
        )}
      </div>

      {/* Top Split: Query Editor & Parameters */}
      <div className="top-section">
        <div className="query-card">
          <div className="card-header">
            <span className="card-title">BMQL Query (Ctrl+Enter to Run)</span>
            <button className="btn-secondary" onClick={() => setQuery('')} style={{ padding: '2px 6px', fontSize: '11px' }}>
              Clear
            </button>
          </div>
          <textarea
            className="query-editor"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT ... FROM ... WHERE ..."
            spellCheck={false}
          />
        </div>

        <div className="param-card">
          <div className="card-header">
            <span className="card-title">Parameter Bindings</span>
            <button className="btn-secondary" onClick={addParam} style={{ padding: '2px 8px', fontSize: '11px' }}>
              + Add Param
            </button>
          </div>
          <div className="param-table-container">
            <table className="param-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Name</th>
                  <th style={{ width: '25%' }}>Type</th>
                  <th style={{ width: '35%' }}>Value</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        className="param-input"
                        placeholder="param_name"
                        value={p.name}
                        onChange={(e) => updateParam(p.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="param-select"
                        value={p.type}
                        onChange={(e) => updateParam(p.id, 'type', e.target.value)}
                      >
                        <option value="String">String</option>
                        <option value="Integer">Integer</option>
                        <option value="Float">Float</option>
                        <option value="Boolean">Boolean</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="param-input"
                        placeholder="value"
                        value={p.value}
                        onChange={(e) => updateParam(p.id, 'value', e.target.value)}
                      />
                    </td>
                    <td>
                      <button className="btn-icon danger" onClick={() => removeParam(p.id)} title="Delete parameter">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="action-bar">
        <div className="action-group">
          <button className="btn-primary" onClick={handleRunQuery} disabled={loading}>
            {loading ? 'Executing Query...' : '▶ Execute BMQL'}
          </button>
        </div>

        {results && results.rows && results.rows.length > 0 && (
          <div className="action-group">
            <button className="btn-secondary" onClick={handleExportCsv}>Export CSV</button>
            <button className="btn-secondary" onClick={handleExportJson}>Export JSON</button>
            <button className="btn-secondary" onClick={handleCopyClipboard}>Copy</button>
          </div>
        )}
      </div>

      {/* Results View */}
      <div className="results-section">
        {error ? (
          <div className="error-banner">❌ {error}</div>
        ) : results ? (
          <>
            <div className="results-header">
              <div className="results-meta">
                <span className="meta-item">Rows: <span className="meta-value">{results.rowCount}</span></span>
                <span className="meta-item">Duration: <span className="meta-value">{results.durationMs}ms</span></span>
                <span className="meta-item">Status: <span className="meta-value">200 OK</span></span>
              </div>
            </div>
            <div className="results-grid-container">
              <table className="results-table">
                <thead>
                  <tr>
                    {results.columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {results.columns.map((col, cIdx) => (
                        <td key={cIdx}>{String(row[col] !== undefined ? row[col] : '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span>Enter a BMQL statement and click Execute (or press Ctrl+Enter).</span>
          </div>
        )}
      </div>
    </div>
  );
}
