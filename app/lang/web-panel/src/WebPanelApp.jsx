import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NavigationBar from './components/NavigationBar';
import SettingsPage from './pages/settings/App';
import GraphPage from './pages/graph/App';
import InteractivePage from './pages/interactive/App';
import { getVsCodeApi } from './vscodeApi';

export default function WebPanelApp({ vscodeApi: propVscodeApi }) {
  const vscodeApi = propVscodeApi || getVsCodeApi();

  const [activePage, setActivePage] = useState(() => {
    if (typeof window !== 'undefined' && window.__INITIAL_PAGE__) {
      return window.__INITIAL_PAGE__;
    }
    return 'settings';
  });

  const [graphModel, setGraphModel] = useState(() => {
    return (typeof window !== 'undefined' && window.__INITIAL_GRAPH_MODEL__) || null;
  });

  const [inspectorData, setInspectorData] = useState(() => {
    return (typeof window !== 'undefined' && window.__INITIAL_INSPECTOR_DATA__) || null;
  });

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (!message) return;

      if (message.type === 'navigate') {
        if (message.page) {
          setActivePage(message.page);
        }
        if (message.payload) {
          if (message.page === 'graph') {
            setGraphModel(message.payload);
          } else if (message.page === 'interactive') {
            setInspectorData(message.payload);
          }
        }
      } else if (message.type === 'updateGraph' && message.model) {
        setGraphModel(message.model);
        if (message.autoFocus) {
          setActivePage('graph');
        }
      } else if (message.command === 'setData' && message.payload) {
        setInspectorData(message.payload);
        if (message.autoFocus !== false) {
          setActivePage('interactive');
        }
      } else if (message.type === 'switchTab') {
        setActivePage('settings');
      }
    };

    window.addEventListener('message', handleMessage);
    vscodeApi.postMessage({ command: 'panelReady', activePage });

    return () => window.removeEventListener('message', handleMessage);
  }, [vscodeApi, activePage]);

  const handleSelectPage = useCallback((page) => {
    setActivePage(page);
    vscodeApi.postMessage({ command: 'pageChanged', page });
  }, [vscodeApi]);

  const handlePopOut = useCallback(() => {
    let payload = null;
    if (activePage === 'graph') payload = graphModel;
    else if (activePage === 'interactive') payload = inspectorData;

    vscodeApi.postMessage({
      command: 'openInNewTab',
      page: activePage,
      payload
    });
  }, [vscodeApi, activePage, graphModel, inspectorData]);

  const pageContextTitle = useMemo(() => {
    if (activePage === 'graph') {
      return graphModel?.targetName ? `Graph: ${graphModel.targetName}` : 'Graph';
    }
    if (activePage === 'interactive') {
      return inspectorData?.title ? `Inspect: ${inspectorData.title}` : 'Inspector';
    }
    return 'Settings';
  }, [activePage, graphModel, inspectorData]);

  return (
    <div className="web-panel-shell">
      <NavigationBar
        activePage={activePage}
        onSelectPage={handleSelectPage}
        onPopOut={handlePopOut}
        pageTitle={pageContextTitle}
      />
      <main className="web-panel-content">
        <div className={`web-panel-page-wrapper ${activePage === 'settings' ? 'active' : ''}`}>
          <SettingsPage vscodeApi={vscodeApi} />
        </div>
        <div className={`web-panel-page-wrapper ${activePage === 'graph' ? 'active' : ''}`}>
          <GraphPage vscodeApi={vscodeApi} initialModel={graphModel} />
        </div>
        <div className={`web-panel-page-wrapper ${activePage === 'interactive' ? 'active' : ''}`}>
          <InteractivePage vscodeApi={vscodeApi} initialData={inspectorData} />
        </div>
      </main>
    </div>
  );
}
