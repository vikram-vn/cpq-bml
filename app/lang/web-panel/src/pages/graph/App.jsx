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
    const [showActions, setShowActions] = useState(true);
    const [showCallees, setShowCallees] = useState(true);
    const [showTables, setShowTables] = useState(true);
    const [showAttributes, setShowAttributes] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);
    const [activeMatchNodeId, setActiveMatchNodeId] = useState(null);
    const [entitySearchResults, setEntitySearchResults] = useState([]);

    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            if (!message) return;
            if (message.type === 'updateGraph') {
                setModel(message.model);
            } else if (message.type === 'entitySearchResults') {
                setEntitySearchResults(message.results || []);
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

    const handleSwitchTarget = useCallback((filePath) => {
        vscodeApi.postMessage({
            command: 'switchTarget',
            filePath
        });
    }, [vscodeApi]);

    const handleGraphEntity = useCallback((entityType, entityName) => {
        vscodeApi.postMessage({
            command: 'graphEntity',
            entityType,
            entityName
        });
    }, [vscodeApi]);

    const handleSearchQueryChange = useCallback((query) => {
        if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
            vscodeApi.postMessage({
                command: 'searchEntities',
                query
            });
        }
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
                model={model}
                showCallers={showCallers}
                setShowCallers={setShowCallers}
                showActions={showActions}
                setShowActions={setShowActions}
                showCallees={showCallees}
                setShowCallees={setShowCallees}
                showTables={showTables}
                setShowTables={setShowTables}
                showAttributes={showAttributes}
                setShowAttributes={setShowAttributes}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectNode={setSelectedNode}
                onSwitchTarget={handleSwitchTarget}
                activeMatchNodeId={activeMatchNodeId}
                setActiveMatchNodeId={setActiveMatchNodeId}
                entitySearchResults={entitySearchResults}
                onSearchQueryChange={handleSearchQueryChange}
                onGraphEntity={handleGraphEntity}
            />
            <GraphCanvas
                model={model}
                showCallers={showCallers}
                showActions={showActions}
                showCallees={showCallees}
                showTables={showTables}
                showAttributes={showAttributes}
                searchQuery={searchQuery}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                activeMatchNodeId={activeMatchNodeId}
            />
            <NodeDrawer
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onOpenFile={handleOpenNodeFile}
            />
        </div>
    );
}
