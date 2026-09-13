import React from 'react';

export default function Toolbar({
    showCallers,
    setShowCallers,
    showCallees,
    setShowCallees,
    showTables,
    setShowTables,
    searchQuery,
    setSearchQuery
}) {
    return (
        <div className="toolbar">
            <div className="filter-group">
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showCallers}
                        onChange={(e) => setShowCallers(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-red)' }}>●</span> Upstream Callers (Blast Radius)
                </label>
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showCallees}
                        onChange={(e) => setShowCallees(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-cyan)' }}>●</span> Outgoing Libraries
                </label>
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showTables}
                        onChange={(e) => setShowTables(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-purple)' }}>●</span> Data Tables (BMQL)
                </label>
            </div>
            <input
                type="text"
                className="search-input"
                placeholder="Filter nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
    );
}
