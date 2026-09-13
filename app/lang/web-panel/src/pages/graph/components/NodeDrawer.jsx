import React from 'react';

export default function NodeDrawer({ selectedNode, onOpenNodeFile }) {
    if (!selectedNode) return null;

    let desc = '';
    if (selectedNode.type === 'focal') {
        desc = `Current File: ${selectedNode.filePath || ''} · Risk: ${selectedNode.risk || 'Normal'}`;
    } else if (selectedNode.type === 'caller') {
        const linesStr = selectedNode.lines ? selectedNode.lines.map(l => l + 1).join(', ') : '1';
        desc = `Upstream Impact: Calls target on line(s) [${linesStr}] · File: ${selectedNode.filePath || ''}`;
    } else if (selectedNode.type === 'callee') {
        desc = `Sub-function invoked · File: ${selectedNode.filePath || 'External'}`;
    } else if (selectedNode.type === 'table') {
        desc = `Oracle CPQ Data Table queried via BMQL`;
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
            {selectedNode.filePath && (
                <button
                    className="btn btn-primary"
                    onClick={() => onOpenNodeFile(selectedNode)}
                >
                    Open in Editor
                </button>
            )}
        </div>
    );
}
