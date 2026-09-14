import React from 'react';

export default function HeaderBar({ model, onRefresh, onExportMermaid }) {
    if (!model) {
        return (
            <div className="header-bar">
                <div className="header-left">
                    <div className="title-wrapper">
                        <div className="main-title">Loading Architecture Graph...</div>
                    </div>
                </div>
            </div>
        );
    }

    const { target, blastRadius, outgoing } = model;
    const impact = (blastRadius && blastRadius.impactLevel) || 'Isolated';

    return (
        <div className="header-bar">
            <div className="header-left">
                <div className="title-wrapper">
                    <div className="main-title">
                        <span>{target.name}</span>
                        {target.entityType ? (
                            <span className="risk-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                {target.entityType.toUpperCase()} BOTTOM-UP
                            </span>
                        ) : (
                            <span className={`risk-badge risk-${impact.toLowerCase()}`}>
                                {impact} Risk
                            </span>
                        )}
                    </div>
                    <div className="sub-title">{target.hierarchyLabel || target.qualifiedName}</div>
                </div>
            </div>

            <div className="metrics-pill-group">
                <div className="metric-pill" title="Upstream libraries and CPQ cloud rules/actions referencing this entity (References)">
                    <span style={{ color: 'var(--accent-red)' }}>🔗 References:</span>
                    <span className="metric-value">
                        {blastRadius ? (
                            blastRadius.cloudReferences?.length > 0
                                ? `${blastRadius.transitiveCount} total (${blastRadius.cloudReferences.length} cloud)`
                                : `${blastRadius.transitiveCount} caller${blastRadius.transitiveCount === 1 ? '' : 's'}`
                        ) : '0'}
                    </span>
                </div>
                <div className="metric-pill" title="Commerce Actions triggering this script">
                    <span style={{ color: 'var(--accent-amber)' }}>⚡ Actions:</span>
                    <span className="metric-value">{outgoing?.actions?.length || 0}</span>
                </div>
                <div className="metric-pill" title="Outgoing library functions invoked">
                    <span style={{ color: 'var(--accent-cyan)' }}>📦 Libraries:</span>
                    <span className="metric-value">{outgoing?.functions?.length || 0}</span>
                </div>
                <div className="metric-pill" title="CPQ Data Tables queried via BMQL">
                    <span style={{ color: 'var(--accent-purple)' }}>🗄 Data Tables:</span>
                    <span className="metric-value">{outgoing?.dataTables?.length || 0}</span>
                </div>
                <div className="metric-pill" title="CPQ Transaction and Line Attributes referenced">
                    <span style={{ color: 'var(--accent-green)' }}>🏷 Attributes:</span>
                    <span className="metric-value">{outgoing?.attributes?.length || 0}</span>
                </div>
            </div>

            <div className="header-actions">
                <button
                    className="btn"
                    onClick={onExportMermaid}
                    title="Copy Mermaid Diagram markdown to clipboard"
                >
                    📋 Export Mermaid
                </button>
                <button
                    className="btn btn-primary"
                    onClick={onRefresh}
                    title="Re-analyze Workspace Graph"
                >
                    🔄 Refresh
                </button>
            </div>
        </div>
    );
}
