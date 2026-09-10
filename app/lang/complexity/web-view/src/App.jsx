import React, { useState, useEffect } from 'react';

export default function App({ vscodeApi }) {
  const [data, setData] = useState({
    totalFiles: 0,
    totalLoc: 0,
    avgComplexity: 0,
    avgMaintainability: 100,
    riskDistribution: { high: 0, medium: 0, low: 0 },
    files: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('hotspotScore');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'complexityData') {
        setData(msg.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    vscodeApi.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [vscodeApi]);

  const handleOpenFile = (filePath) => {
    if (!filePath) return;
    vscodeApi.postMessage({ type: 'openFile', filePath });
  };

  const handleRefresh = () => {
    vscodeApi.postMessage({ type: 'refresh' });
  };

  const filteredFiles = data.files.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.relPath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  const totalRisks = (data.riskDistribution.high + data.riskDistribution.medium + data.riskDistribution.low) || 1;
  const highPct = Math.round((data.riskDistribution.high / totalRisks) * 100);
  const medPct = Math.round((data.riskDistribution.medium / totalRisks) * 100);
  const lowPct = 100 - highPct - medPct;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-title">⚡ BML Code Complexity & Technical Debt Radar</div>
        <button className="btn-refresh" onClick={handleRefresh}>
          ↻ Re-scan Workspace
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Files & LOC</span>
          <span className="kpi-value">{data.totalFiles} <span style={{ fontSize: '13px', opacity: 0.6 }}>({data.totalLoc} lines)</span></span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Avg Cyclomatic Complexity</span>
          <span className={`kpi-value ${data.avgComplexity >= 10 ? 'alert' : 'good'}`}>{data.avgComplexity}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">High-Risk / Timeout Threats</span>
          <span className={`kpi-value ${data.riskDistribution.high > 0 ? 'alert' : 'good'}`}>{data.riskDistribution.high}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Maintainability Index</span>
          <span className="kpi-value good">{data.avgMaintainability} / 100</span>
        </div>
      </div>

      {/* Risk Distribution Bar */}
      <div className="distribution-container">
        <div className="dist-bar">
          <div className="dist-segment high" style={{ width: `${highPct}%` }} title={`High Risk: ${highPct}%`}></div>
          <div className="dist-segment medium" style={{ width: `${medPct}%` }} title={`Medium Risk: ${medPct}%`}></div>
          <div className="dist-segment low" style={{ width: `${lowPct}%` }} title={`Low Risk: ${lowPct}%`}></div>
        </div>
        <div className="dist-legend">
          <div className="legend-item"><span className="legend-dot high"></span> High Risk ({data.riskDistribution.high})</div>
          <div className="legend-item"><span className="legend-dot medium"></span> Medium ({data.riskDistribution.medium})</div>
          <div className="legend-item"><span className="legend-dot low"></span> Low Risk ({data.riskDistribution.low})</div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="table-controls">
        <input
          className="search-box"
          placeholder="Filter by script name or path..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span style={{ fontSize: '12px', opacity: 0.7 }}>
          Showing {sortedFiles.length} of {data.totalFiles} files
        </span>
      </div>

      {/* Metrics Table */}
      <div className="table-wrapper">
        <table className="metrics-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Script Name</th>
              <th onClick={() => handleSort('loc')} style={{ cursor: 'pointer' }}>LOC</th>
              <th onClick={() => handleSort('complexity')} style={{ cursor: 'pointer' }}>Complexity</th>
              <th onClick={() => handleSort('nestingDepth')} style={{ cursor: 'pointer' }}>Max Nesting</th>
              <th onClick={() => handleSort('maintainabilityIndex')} style={{ cursor: 'pointer' }}>Maintainability</th>
              <th onClick={() => handleSort('risk')} style={{ cursor: 'pointer' }}>Risk Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file, idx) => (
              <tr key={idx}>
                <td>
                  <button className="btn-link" onClick={() => handleOpenFile(file.filePath)}>
                    {file.relPath || file.name}
                  </button>
                </td>
                <td>{file.loc}</td>
                <td><strong>{file.complexity}</strong></td>
                <td>{file.nestingDepth}</td>
                <td>{file.maintainabilityIndex} / 100</td>
                <td>
                  <span className={`risk-pill ${file.risk.toLowerCase()}`}>{file.risk}</span>
                </td>
                <td>
                  {file.timeoutThreat ? (
                    <span style={{ color: 'var(--high-risk)', fontWeight: 600, fontSize: '11px' }}>⚠️ Timeout Risk</span>
                  ) : (
                    <span style={{ color: 'var(--low-risk)', fontSize: '11px' }}>✓ Healthy</span>
                  )}
                </td>
              </tr>
            ))}
            {sortedFiles.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                  No BML files found matching the search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
