import React, { useState, useRef, useMemo, useEffect } from 'react';

export default function GraphCanvas({
    model,
    showCallers,
    showActions,
    showCallees,
    showTables,
    showAttributes,
    searchQuery,
    selectedNode,
    onSelectNode,
    activeMatchNodeId
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

    const query = (searchQuery || '').trim().toLowerCase();

    // Layout computation
    const { positions, visibleNodes, visibleEdges } = useMemo(() => {
        if (!model) return { positions: new Map(), visibleNodes: [], visibleEdges: [] };

        const colWidth = 280;
        const nodeWidth = 220;
        const nodeHeight = 56;
        const nodeGap = 20;

        const callers = (model.blastRadius?.callers || []);
        const actions = (model.outgoing?.actions || []);
        const callees = (model.outgoing?.functions || []);
        const tables = (model.outgoing?.dataTables || []);
        const attributes = (model.outgoing?.attributes || []);
        const apis = (model.outgoing?.externalApis || []);

        const focalNode = model.graph.nodes.find(n => n.type === 'focal');
        const focalId = focalNode ? focalNode.id : `target_${model.target.qualifiedName}`;
        const posMap = new Map();

        const isBottomUp = Boolean(model.target?.entityType);
        if (isBottomUp) {
            // Bottom-Up Layout:
            // Column 0: Root Entity (Attribute / Data Table / Action)
            // Column 1: Direct Touching BML Scripts
            // Column 2: Triggering Actions & Upstream Callers
            const scriptNodes = model.graph.nodes.filter(n => n.id.startsWith('script_'));
            const actionNodes = showActions ? model.graph.nodes.filter(n => n.type === 'action') : [];
            const callerNodes = showCallers ? model.graph.nodes.filter(n => n.type === 'caller') : [];
            const rightSideNodes = [...actionNodes, ...callerNodes];

            const maxRows = Math.max(1, scriptNodes.length, rightSideNodes.length);
            const totalHeight = maxRows * (nodeHeight + nodeGap);
            const focalY = Math.max(0, (totalHeight - nodeHeight) / 2);

            posMap.set(focalId, { x: 0, y: focalY });

            scriptNodes.forEach((n, idx) => {
                const y = idx * (nodeHeight + nodeGap);
                posMap.set(n.id, { x: colWidth, y });
            });

            rightSideNodes.forEach((n, idx) => {
                const y = idx * (nodeHeight + nodeGap);
                posMap.set(n.id, { x: colWidth * 2, y });
            });

            const vNodes = model.graph.nodes.filter(n => posMap.has(n.id));
            const vEdges = model.graph.edges.filter(e => posMap.has(e.source) && posMap.has(e.target));
            return { positions: posMap, visibleNodes: vNodes, visibleEdges: vEdges };
        }

        // Forward File Mode (3-Column Topology)
        const leftSideNodes = [
            ...(showCallers ? callers.map(c => ({ ...c, type: 'caller', id: `caller_${c.qualifiedName}` })) : []),
            ...(showActions ? actions.map(a => ({ ...a, type: 'action', id: `action_${a.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}` })) : [])
        ];

        const rightSideNodes = [
            ...(showCallees ? callees.map(c => ({ ...c, type: 'callee', id: `callee_${c.qualifiedName}` })) : []),
            ...(showTables ? tables.map(t => ({ ...t, type: 'table', id: `table_${t.name.toLowerCase()}` })) : []),
            ...(showAttributes ? attributes.map(a => ({ ...a, type: 'attribute', id: `attr_${a.name.toLowerCase()}` })) : []),
            ...apis.map(a => ({ ...a, type: 'api', id: `api_${a.target.replace(/[^a-zA-Z0-9]/g, '_')}` }))
        ];

        const maxRows = Math.max(1, leftSideNodes.length, rightSideNodes.length);
        const totalHeight = maxRows * (nodeHeight + nodeGap);
        const focalY = Math.max(0, (totalHeight - nodeHeight) / 2);

        // 1. Focal node position (Column 1)
        posMap.set(focalId, { x: colWidth, y: focalY });

        // 2. Left side positions (Column 0 - Inbound Triggers & Callers)
        leftSideNodes.forEach((n, idx) => {
            const y = idx * (nodeHeight + nodeGap);
            posMap.set(n.id, { x: 0, y });
        });

        // 3. Right side positions (Column 2 - Dependencies)
        rightSideNodes.forEach((n, idx) => {
            const y = idx * (nodeHeight + nodeGap);
            posMap.set(n.id, { x: colWidth * 2, y });
        });

        // Filter visible nodes and edges
        const vNodes = model.graph.nodes.filter(n => posMap.has(n.id));
        const vEdges = model.graph.edges.filter(e => posMap.has(e.source) && posMap.has(e.target));

        return { positions: posMap, visibleNodes: vNodes, visibleEdges: vEdges };
    }, [model, showCallers, showActions, showCallees, showTables, showAttributes]);

    // Auto-pan / Zoom-to-fit to active search match or selected node
    useEffect(() => {
        const targetId = activeMatchNodeId || selectedNode?.id;
        if (!targetId || !positions.has(targetId)) return;
        const pos = positions.get(targetId);
        const targetX = 240 - pos.x * scale;
        const targetY = 180 - pos.y * scale;
        setPan({ x: targetX, y: targetY });
    }, [activeMatchNodeId, selectedNode, positions, scale]);

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
                    <marker id="arrow-action" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#f97316" />
                    </marker>
                    <marker id="arrow-callee" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#06b6d4" />
                    </marker>
                    <marker id="arrow-table" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#8b5cf6" />
                    </marker>
                    <marker id="arrow-attribute" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <polygon points="0 0, 8 4, 0 8" fill="#10b981" />
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
                            } else if (edge.type === 'action_trigger') {
                                marker = 'arrow-action';
                                edgeClass += ' edge-action';
                            } else if (edge.type === 'data_access') {
                                marker = 'arrow-table';
                                edgeClass += ' edge-table';
                            } else if (edge.type === 'attribute_access') {
                                marker = 'arrow-attribute';
                                edgeClass += ' edge-attribute';
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
                            const isMatch = query && (
                                node.label.toLowerCase().includes(query) ||
                                (node.subtitle && node.subtitle.toLowerCase().includes(query))
                            );
                            const isActiveMatch = node.id === activeMatchNodeId;

                            let icon = '';
                            if (node.type === 'action') icon = '⚡ ';
                            else if (node.type === 'attribute') icon = '🏷 ';
                            else if (node.type === 'table') icon = '🗄 ';
                            else if (node.type === 'callee') icon = '📦 ';
                            else if (node.type === 'caller') icon = '💥 ';
                            else if (node.type === 'focal') icon = '🎯 ';
                            else if (node.type === 'api') icon = '🌐 ';

                            const label = `${icon}${node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label}`;
                            const subtitle = node.subtitle && node.subtitle.length > 28 ? node.subtitle.slice(0, 26) + '...' : (node.subtitle || '');

                            let extraClass = '';
                            if (isSelected) extraClass += ' node-selected';
                            if (isMatch) extraClass += ' node-search-match';
                            if (isActiveMatch) extraClass += ' node-active-match';

                            return (
                                <g
                                    key={node.id}
                                    className={`node-group node-${node.type}${extraClass}`}
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
