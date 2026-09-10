import React, { useState, useEffect } from 'react';

const LANES = [
  { key: 'VALIDATION', label: '1. Validation Rules' },
  { key: 'HIDING', label: '2. Hiding Rules' },
  { key: 'CONSTRAINT', label: '3. Constraints' },
  { key: 'PRICING', label: '4. Formulas / Pricing' },
  { key: 'SUBMITTAL', label: '5. Actions / Submittal' }
];

export default function App({ vscodeApi }) {
  const [graphData, setGraphData] = useState({
    nodes: [],
    edges: [],
    phases: { VALIDATION: [], HIDING: [], CONSTRAINT: [], PRICING: [], SUBMITTAL: [] },
    cycles: [],
    stats: { totalNodes: 0, rulesCount: 0, attributesCount: 0, totalEdges: 0, cyclesCount: 0 }
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'graphData') {
        setGraphData(msg.payload);
        if (msg.payload.nodes && msg.payload.nodes.length > 0) {
          const firstRule = msg.payload.nodes.find(n => n.type === 'rule');
          if (firstRule) setSelectedNode(firstRule);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    vscodeApi.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [vscodeApi]);

  const filteredRules = (rulesInPhase) => {
    if (!Array.isArray(rulesInPhase)) return [];
    return rulesInPhase
      .map(id => graphData.nodes.find(n => n.id === id))
      .filter(Boolean)
      .filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const getReadsForNode = (nodeId) => {
    return graphData.edges
      .filter(e => e.from === nodeId && e.type === 'READS')
      .map(e => e.to);
  };

  const getWritesForNode = (nodeId) => {
    return graphData.edges
      .filter(e => e.from === nodeId && e.type === 'WRITES')
      .map(e => e.to);
  };

  const handleOpenFile = (filePath) => {
    if (!filePath) return;
    vscodeApi.postMessage({ type: 'openFile', filePath });
  };

  const handleRefresh = () => {
    vscodeApi.postMessage({ type: 'refresh' });
  };

  return (
    <div className="graph-container">
      {/* Header */}
      <div className="graph-header">
        <div className="title-group">
          <span className="graph-title">📊 Commerce Execution Pipeline & Dependency Graph</span>
        </div>
        <div className="metrics-bar">
          <span className="metric-badge">Rules: <strong>{graphData.stats.rulesCount}</strong></span>
          <span className="metric-badge">Attributes: <strong>{graphData.stats.attributesCount}</strong></span>
          <span className="metric-badge">Dependencies: <strong>{graphData.stats.totalEdges}</strong></span>
          {graphData.cycles.length > 0 && (
            <span className="metric-badge alert">⚠️ {graphData.cycles.length} Circular Loops</span>
          )}
          <button className="tab-btn" onClick={handleRefresh} style={{ marginLeft: '8px' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <input
          className="search-input"
          placeholder="Filter rules and attributes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main View: Pipeline Swimlanes & Details Drawer */}
      <div className="main-view">
        <div className="pipeline-board">
          {LANES.map(lane => {
            const rules = filteredRules(graphData.phases[lane.key]);
            return (
              <div key={lane.key} className="pipeline-lane">
                <div className="lane-header">
                  <span>{lane.label}</span>
                  <span>({rules.length})</span>
                </div>
                <div className="lane-content">
                  {rules.map(rule => {
                    const reads = getReadsForNode(rule.id);
                    const writes = getWritesForNode(rule.id);
                    const isSelected = selectedNode && selectedNode.id === rule.id;
                    return (
                      <div
                        key={rule.id}
                        className={`rule-node-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedNode(rule)}
                      >
                        <div className="card-name">{rule.label}</div>
                        <div className="card-tags">
                          {reads.length > 0 && <span className="tag reads">In: {reads.length}</span>}
                          {writes.length > 0 && <span className="tag writes">Out: {writes.length}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {rules.length === 0 && (
                    <div style={{ opacity: 0.4, fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
                      No rules
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Details Drawer */}
        <div className="details-drawer">
          {selectedNode ? (
            <>
              <div className="details-title">{selectedNode.label}</div>
              {selectedNode.filePath && (
                <button
                  className="tab-btn active"
                  style={{ width: '100%' }}
                  onClick={() => handleOpenFile(selectedNode.filePath)}
                >
                  Open Script in Editor
                </button>
              )}

              {/* Cycle Warning */}
              {graphData.cycles.some(c => c.includes(selectedNode.id)) && (
                <div className="cycle-box">
                  ⚠️ This rule is involved in a circular dependency loop! Check attribute writes.
                </div>
              )}

              <div>
                <div className="section-label">Attributes Read (Inputs)</div>
                <div className="attr-list">
                  {getReadsForNode(selectedNode.id).map((attr, i) => (
                    <div key={i} className="attr-item">
                      <span>{attr}</span>
                      <span className="tag reads">read</span>
                    </div>
                  ))}
                  {getReadsForNode(selectedNode.id).length === 0 && (
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>None detected</span>
                  )}
                </div>
              </div>

              <div>
                <div className="section-label">Attributes Written (Outputs)</div>
                <div className="attr-list">
                  {getWritesForNode(selectedNode.id).map((attr, i) => (
                    <div key={i} className="attr-item">
                      <span>{attr}</span>
                      <span className="tag writes">write</span>
                    </div>
                  ))}
                  {getWritesForNode(selectedNode.id).length === 0 && (
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>None detected</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>
              Select a rule from the pipeline to inspect its attribute dependencies.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
