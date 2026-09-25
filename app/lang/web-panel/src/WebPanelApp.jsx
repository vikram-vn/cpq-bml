import React, { useState, useEffect } from 'react';
import SettingsPage from './pages/settings/App';
import GraphPage from './pages/graph/App';
import InteractivePage from './pages/interactive/App';
import DataTablePage from './pages/datatable/App';
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

  const [dataTableData, setDataTableData] = useState(() => {
    return (typeof window !== 'undefined' && window.__INITIAL_DATA_TABLE__) || null;
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
          } else if (message.page === 'datatable') {
            setDataTableData(message.payload);
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
      } else if (message.type === 'updateDataTable' || message.command === 'setDataTable') {
        const payload = message.payload || message.data || message;
        setDataTableData({
          tableName: payload.tableName || '',
          columns: payload.columns || [],
          rows: payload.rows || []
        });
        if (message.autoFocus !== false) {
          setActivePage('datatable');
        }
      } else if (message.type === 'switchTab') {
        setActivePage('settings');
      }
    };

    window.addEventListener('message', handleMessage);
    vscodeApi.postMessage({ command: 'panelReady', activePage });

    return () => window.removeEventListener('message', handleMessage);
  }, [vscodeApi, activePage]);

  return (
    <div className="web-panel-shell">
      {activePage === 'settings' && (
        <SettingsPage vscodeApi={vscodeApi} />
      )}
      {activePage === 'graph' && (
        <GraphPage vscodeApi={vscodeApi} initialModel={graphModel} />
      )}
      {activePage === 'interactive' && (
        <InteractivePage vscodeApi={vscodeApi} initialData={inspectorData} />
      )}
      {activePage === 'datatable' && (
        <DataTablePage vscodeApi={vscodeApi} initialData={dataTableData} />
      )}
    </div>
  );
}
