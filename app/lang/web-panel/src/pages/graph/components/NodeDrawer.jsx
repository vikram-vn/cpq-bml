import React from 'react';

export default function NodeDrawer({ node, selectedNode: propNode, onOpenNodeFile, onClose }) {
    const selectedNode = node || propNode;
    if (!selectedNode) return null;

    let desc = '';
    if (selectedNode.type === 'focal') {
        desc = selectedNode.hierarchyLabel
            ? `Canonical Hierarchy: ${selectedNode.hierarchyLabel} · Entity: ${selectedNode.entityType || 'Focal'}`
            : `Current File: ${selectedNode.filePath || ''} · Risk: ${selectedNode.risk || 'Normal'}`;
    } else if (selectedNode.type === 'caller') {
        const linesStr = selectedNode.lines ? selectedNode.lines.map(l => l + 1).join(', ') : '1';
        desc = `Upstream Impact: Calls target on line(s) [${linesStr}] · File: ${selectedNode.filePath || ''}`;
    } else if (selectedNode.type === 'callee') {
        const linesStr = selectedNode.lines && selectedNode.lines.length > 0 ? ` · Line(s): ${selectedNode.lines.map(l => l + 1).join(', ')}` : '';
        desc = `Direct Touching Script / Library${linesStr} · File: ${selectedNode.filePath || 'External'}`;
    } else if (selectedNode.type === 'table') {
        desc = `Oracle CPQ Data Table queried via BMQL / gettabledata`;
    } else if (selectedNode.type === 'attribute') {
        desc = `CPQ ${selectedNode.scope === 'line' ? 'Line Item' : 'Transaction'} Attribute (${selectedNode.operation || 'Read'}) · Scope: ${selectedNode.scope || 'Doc'}`;
    } else if (selectedNode.type === 'action') {
        desc = `Commerce Action · Triggers BML script execution · ${selectedNode.subtitle || 'Action'}`;
    } else {
        desc = `urldata() Web Service: ${selectedNode.label}`;
    }

    return (
        <div className="drawer">
            <div className="drawer-info">
                <div className="drawer-title">
                    {selectedNode.label} ({selectedNode.subtitle})
                </div>
                <div className="drawer-desc">{desc}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedNode.filePath && (
                    <button
                        className="btn btn-primary"
                        onClick={() => onOpenNodeFile(selectedNode)}
                    >
                        Open in Editor
                    </button>
                )}
                {onClose && (
                    <button
                        className="btn"
                        onClick={onClose}
                        title="Close Inspector"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}
