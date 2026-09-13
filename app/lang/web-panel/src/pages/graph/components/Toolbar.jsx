import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function Toolbar({
    model,
    showCallers,
    setShowCallers,
    showActions,
    setShowActions,
    showCallees,
    setShowCallees,
    showTables,
    setShowTables,
    showAttributes,
    setShowAttributes,
    searchQuery,
    setSearchQuery,
    onSelectNode,
    onSwitchTarget,
    activeMatchNodeId,
    setActiveMatchNodeId
}) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const containerRef = useRef(null);

    const q = (searchQuery || '').trim().toLowerCase();

    // 1. Matches in the current graph
    const graphMatches = useMemo(() => {
        if (!q || !model?.graph?.nodes) return [];
        return model.graph.nodes.filter(n =>
            n.label.toLowerCase().includes(q) ||
            (n.subtitle && n.subtitle.toLowerCase().includes(q))
        );
    }, [q, model]);

    // 2. Matches across workspace BML functions
    const workspaceMatches = useMemo(() => {
        if (!q || !model?.workspaceSymbols) return [];
        const currentTarget = model.target?.qualifiedName?.toLowerCase();
        return model.workspaceSymbols
            .filter(s =>
                s.qualifiedName.toLowerCase() !== currentTarget &&
                (s.name.toLowerCase().includes(q) || s.qualifiedName.toLowerCase().includes(q))
            )
            .slice(0, 8);
    }, [q, model]);

    const hasResults = graphMatches.length > 0 || workspaceMatches.length > 0;

    // Cycle through matches
    const currentMatchIdx = useMemo(() => {
        if (!activeMatchNodeId || graphMatches.length === 0) return 0;
        const idx = graphMatches.findIndex(n => n.id === activeMatchNodeId);
        return idx >= 0 ? idx : 0;
    }, [activeMatchNodeId, graphMatches]);

    const handleNextMatch = () => {
        if (graphMatches.length === 0) return;
        const nextIdx = (currentMatchIdx + 1) % graphMatches.length;
        const node = graphMatches[nextIdx];
        setActiveMatchNodeId(node.id);
        onSelectNode(node);
    };

    const handlePrevMatch = () => {
        if (graphMatches.length === 0) return;
        const prevIdx = (currentMatchIdx - 1 + graphMatches.length) % graphMatches.length;
        const node = graphMatches[prevIdx];
        setActiveMatchNodeId(node.id);
        onSelectNode(node);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsDropdownOpen(false);
        } else if (e.key === 'Enter') {
            if (graphMatches.length > 0) {
                const node = graphMatches[currentMatchIdx];
                setActiveMatchNodeId(node.id);
                onSelectNode(node);
                setIsDropdownOpen(false);
            } else if (workspaceMatches.length > 0) {
                onSwitchTarget(workspaceMatches[0].filePath);
                setIsDropdownOpen(false);
            }
        }
    };

    const getNodeIcon = (type) => {
        switch (type) {
            case 'action': return '⚡';
            case 'attribute': return '🏷';
            case 'table': return '🗄';
            case 'callee': return '📦';
            case 'caller': return '💥';
            case 'api': return '🌐';
            default: return '🎯';
        }
    };

    return (
        <div className="toolbar">
            <div className="filter-group">
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showCallers}
                        onChange={(e) => setShowCallers(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-red)' }}>●</span> Upstream Callers
                </label>
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showActions}
                        onChange={(e) => setShowActions(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-amber)' }}>●</span> Actions
                </label>
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showCallees}
                        onChange={(e) => setShowCallees(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-cyan)' }}>●</span> Libraries
                </label>
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showTables}
                        onChange={(e) => setShowTables(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-purple)' }}>●</span> Data Tables
                </label>
                <label className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={showAttributes}
                        onChange={(e) => setShowAttributes(e.target.checked)}
                    />
                    <span style={{ color: 'var(--accent-green)' }}>●</span> Attributes
                </label>
            </div>

            {/* Global Search Interface */}
            <div className="search-container" ref={containerRef}>
                <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search graph & workspace BML..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onKeyDown={handleKeyDown}
                    />
                    {searchQuery && (
                        <button
                            className="search-clear-btn"
                            onClick={() => {
                                setSearchQuery('');
                                setIsDropdownOpen(false);
                            }}
                            title="Clear Search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {graphMatches.length > 0 && (
                    <div className="search-nav-controls">
                        <span className="search-match-badge">
                            {currentMatchIdx + 1}/{graphMatches.length}
                        </span>
                        <button className="search-nav-btn" onClick={handlePrevMatch} title="Previous Match">▲</button>
                        <button className="search-nav-btn" onClick={handleNextMatch} title="Next Match">▼</button>
                    </div>
                )}

                {/* Autocomplete / Quick Switch Dropdown */}
                {isDropdownOpen && q && hasResults && (
                    <div className="search-dropdown">
                        {graphMatches.length > 0 && (
                            <div className="search-dropdown-group">
                                <div className="search-dropdown-section">
                                    Current Graph Nodes ({graphMatches.length})
                                </div>
                                {graphMatches.map(node => (
                                    <div
                                        key={node.id}
                                        className={`search-dropdown-item ${node.id === activeMatchNodeId ? 'focused' : ''}`}
                                        onClick={() => {
                                            setActiveMatchNodeId(node.id);
                                            onSelectNode(node);
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <span className="search-item-icon">{getNodeIcon(node.type)}</span>
                                        <div className="search-item-info">
                                            <span className="search-item-title">{node.label}</span>
                                            <span className="search-item-sub">{node.subtitle}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {workspaceMatches.length > 0 && (
                            <div className="search-dropdown-group">
                                <div className="search-dropdown-section">
                                    Switch Graph to Workspace Function ({workspaceMatches.length})
                                </div>
                                {workspaceMatches.map(sym => (
                                    <div
                                        key={sym.qualifiedName}
                                        className="search-dropdown-item"
                                        onClick={() => {
                                            onSwitchTarget(sym.filePath);
                                            setIsDropdownOpen(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <span className="search-item-icon">🌐</span>
                                        <div className="search-item-info">
                                            <span className="search-item-title">{sym.qualifiedName}</span>
                                            <span className="search-item-sub">{sym.filePath}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
