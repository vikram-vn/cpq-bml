import React, { useState, useRef, useMemo } from 'react';

export default function GraphCanvas({
    model,
    showCallers,
    showCallees,
    showTables,
    searchQuery,
    selectedNode,
    onSelectNode
}) {
    const [scale, setScale] = useState(1.0);
    const [pan, setPan] = useState({ x: 60, y: 60 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.closest('.node-group') || e.target.closest('.zoom-controls')) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        setScale(s => Math.min(Math.max(0.3, s * zoomFactor), 3.0));
    };

    const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 3.0));
    const handleZoomOut = () => setScale(s => Math.max(s * 0.8, 0.3));
    const handleZoomReset = () => { setScale(1.0); setPan({ x: 60, y: 60 }); };

    // Layout computation
    const { positions, visibleNodes, visibleEdges } = useMemo(() => {
        if (!model) return { positions: new Map(), visibleNodes: [], visibleEdges: [] };

        const query = (searchQuery || '').trim().toLowerCase();
        const colWidth = 280;
        const nodeWidth = 220;
        const nodeHeight = 56;
        const nodeGap = 20;

        const callers = (model.blastRadius?.callers || []).filter(c =>
            !query || c.name.toLowerCase().includes(query) || c.qualifiedName.toLowerCase().includes(query)
        );
        const callees = (model.outgoing?.functions || []).filter(c =>
            !query || c.name.toLowerCase().includes(query) || c.qualifiedName.toLowerCase().includes(query)
        );
        const tables = (model.outgoing?.dataTables || []).filter(t =>
            !query || t.name.toLowerCase().includes(query)
        );
        const apis = (model.outgoing?.externalApis || []).filter(a =>
            !query || a.target.toLowerCase().includes(query)
        );

        const rightSideNodes = [
            ...(showCallees ? callees.map(c => ({ ...c, type: 'callee' })) : []),
            ...(showTables ? tables.map(t => ({ ...t, type: 'table' })) : []),
            ...apis.map(a => ({ ...a, type: 'api' }))
        ];

        const maxRows = Math.max(1, callers.length, rightSideNodes.length);
        const totalHeight = maxRows * (nodeHeight + nodeGap);
        const focalY = Math.max(0, (totalHeight - nodeHeight) / 2);

        const posMap = new Map();

        // 1. Focal node position
        const focalId = `target_${model.target.qualifiedName}`;
        posMap.set(focalId, { x: colWidth, y: focalY });

        // 2. Callers positions (Column 0)
        if (showCallers) {
            callers.forEach((c, idx) => {
                const y = idx * (nodeHeight + nodeGap);
                posMap.set(`caller_${c.qualifiedName}`, { x: 0, y });
            });
        }

        // 3. Right side positions (Column 2)
        rightSideNodes.forEach((n, idx) => {
            const y = idx * (nodeHeight + nodeGap);
            const id = n.type === 'callee'
                ? `callee_${n.qualifiedName}`
                : n.type === 'table'
                    ? `table_${n.name.toLowerCase()}`
                    : `api_${n.target.replace(/[^a-zA-Z0-9]/g, '_')}`;
            posMap.set(id, { x: colWidth * 2, y });
        });

        // Filter visible nodes and edges
        const vNodes = model.graph.nodes.filter(n => posMap.has(n.id));
        const vEdges = model.graph.edges.filter(e => posMap.has(e.source) && posMap.has(e.target));

        return { positions: posMap, visibleNodes: vNodes, visibleEdges: vEdges };
    }, [model, showCallers, showCallees, showTables, searchQuery]);

    if (!model) {
        return (
            <div className="canvas-container">
                <div className="empty-state">
                    <p>Open a BML file to view its Architecture Dependency & Blast Radius graph.</p>
                </div>
            </div>
        );
    }

    const nodeWidth = 220;
    const nodeHeight = 56;

    return (
        <div
            className="canvas-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
        >
            <svg id="graphCanvas">
                <defs>
                    <marker id="arrow-blast" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#ef4444" />
                    </marker>
                    <marker id="arrow-callee" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#06b6d4" />
                    </marker>
                    <marker id="arrow-table" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#8b5cf6" />
                    </marker>
                    <marker id="arrow-api" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#f59e0b" />
                    </marker>
                </defs>
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                    {/* Edges Layer */}
                    <g>
                        {visibleEdges.map((edge, idx) => {
                            const srcPos = positions.get(edge.source);
                            const tgtPos = positions.get(edge.target);
                            if (!srcPos || !tgtPos) return null;

                            const startX = srcPos.x + nodeWidth;
                            const startY = srcPos.y + nodeHeight / 2;
                            const endX = tgtPos.x;
                            const endY = tgtPos.y + nodeHeight / 2;
                            const deltaX = (endX - startX) * 0.5;

                            let marker = 'arrow-callee';
                            let edgeClass = 'edge-path';
                            if (edge.type === 'blast_radius') {
                                marker = 'arrow-blast';
                                edgeClass += ' edge-blast';
                            } else if (edge.type === 'data_access') {
                                marker = 'arrow-table';
                                edgeClass += ' edge-table';
                            } else if (edge.type === 'external_call') {
                                marker = 'arrow-api';
                                edgeClass += ' edge-api';
                            } else {
                                edgeClass += ' edge-callee';
                            }

                            const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;
                            return (
                                <path
                                    key={`edge-${idx}`}
                                    d={d}
                                    className={edgeClass}
                                    markerEnd={`url(#${marker})`}
                                />
                            );
                        })}
                    </g>

                    {/* Nodes Layer */}
                    <g>
                        {visibleNodes.map((node) => {
                            const pos = positions.get(node.id);
                            if (!pos) return null;

                            const isSelected = selectedNode && selectedNode.id === node.id;
                            const label = node.label.length > 22 ? node.label.slice(0, 20) + '...' : node.label;
                            const subtitle = node.subtitle.length > 28 ? node.subtitle.slice(0, 26) + '...' : node.subtitle;

                            return (
                                <g
                                    key={node.id}
                                    className={`node-group node-${node.type}`}
                                    transform={`translate(${pos.x}, ${pos.y})`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectNode(node);
                                    }}
                                >
                                    <rect
                                        width={nodeWidth}
                                        height={nodeHeight}
                                        rx={8}
                                        ry={8}
                                        style={isSelected ? { stroke: '#ffffff', strokeWidth: '3px' } : undefined}
                                    />
                                    <text x={14} y={24} className="node-title">
                                        {label}
                                    </text>
                                    <text x={14} y={42} className="node-sub">
                                        {subtitle}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </g>
            </svg>

            <div className="zoom-controls">
                <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">+</button>
                <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out">-</button>
                <button className="zoom-btn" onClick={handleZoomReset} title="Reset View">⊙</button>
            </div>
        </div>
    );
}
