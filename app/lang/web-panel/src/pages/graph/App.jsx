import React, { useState, useEffect, useCallback } from 'react';
import HeaderBar from './components/HeaderBar';
import Toolbar from './components/Toolbar';
import GraphCanvas from './components/GraphCanvas';
import NodeDrawer from './components/NodeDrawer';
import { getVsCodeApi } from '@/lang/web-panel/src/vscodeApi';

export default function App({ vscodeApi: propVscodeApi, initialModel = null }) {
    const vscodeApi = propVscodeApi || getVsCodeApi();
    const [model, setModel] = useState(() => {
        return initialModel || (typeof window !== 'undefined' && window.__INITIAL_GRAPH_MODEL__) || null;
    });
    const [showCallers, setShowCallers] = useState(true);
    const [showCallees, setShowCallees] = useState(true);
    const [showTables, setShowTables] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            if (message && message.type === 'updateGraph') {
                setModel(message.model);
            }
        };

        window.addEventListener('message', handleMessage);
        if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
            vscodeApi.postMessage({ command: 'ready' });
        }

        return () => window.removeEventListener('message', handleMessage);
    }, [vscodeApi]);

    const handleRefresh = useCallback(() => {
        vscodeApi.postMessage({ command: 'refresh' });
    }, [vscodeApi]);

    const handleExportMermaid = useCallback(() => {
        vscodeApi.postMessage({ command: 'exportMermaid' });
    }, [vscodeApi]);

    const handleOpenNodeFile = useCallback((node) => {
        if (node && node.filePath) {
            vscodeApi.postMessage({
                command: 'openFile',
                filePath: node.filePath,
                line: node.line || (node.lines && node.lines[0]) || 0
            });
        }
    }, [vscodeApi]);

    return (
        <div className="app-container">
            <HeaderBar
                model={model}
                onRefresh={handleRefresh}
                onExportMermaid={handleExportMermaid}
            />
            <Toolbar
                showCallers={showCallers}
                setShowCallers={setShowCallers}
                showCallees={showCallees}
                setShowCallees={setShowCallees}
                showTables={showTables}
                setShowTables={setShowTables}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />
            <GraphCanvas
                model={model}
                showCallers={showCallers}
                showCallees={showCallees}
                showTables={showTables}
                searchQuery={searchQuery}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
            />
            <NodeDrawer
                selectedNode={selectedNode}
                onOpenNodeFile={handleOpenNodeFile}
            />
        </div>
    );
}
