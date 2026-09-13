import React, { useState, useEffect, useMemo } from 'react';

const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : {
  postMessage: (msg) => console.log('VSCode message:', msg)
};

export default function App() {
  const [data, setData] = useState(() => {
    return window.__INITIAL_INSPECTOR_DATA__ || {};
  });
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('properties');
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (message && message.command === 'setData' && message.payload) {
        setData(message.payload);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const {
    category = 'Item',
    title = 'CPQ Metadata',
    variableName = '',
    type = '',
    description = '',
    data: rawData = {},
    hasBml = false
  } = data;

  const propertyList = useMemo(() => {
    const list = [];
    const add = (k, v) => {
      if (v !== undefined && v !== null && v !== '') {
        list.push({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
      }
    };

    add('Category', category);
    if (variableName) add('Variable Name', variableName);
    if (type) add('Type', type);
    if (rawData.commerceProcess) add('Commerce Process', rawData.commerceProcess);
    if (rawData.commerceDocument) add('Commerce Document', rawData.commerceDocument);
    if (rawData.returnType) add('Return Type', rawData.returnType);
    if (rawData.endpointUrl) add('Endpoint URL', rawData.endpointUrl);
    if (rawData.status) add('Status', rawData.status);
    if (rawData.price !== undefined) add('Price', `${rawData.currency ? rawData.currency + ' ' : ''}${rawData.price}`);
    if (rawData.units) add('Units', rawData.units);
    if (rawData.dateModified || rawData._date_modified) add('Last Modified', rawData.dateModified || rawData._date_modified);
    if (rawData.lastUpdatedBy) add('Modified By', rawData.lastUpdatedBy);

    const skipKeys = new Set([
      'category', 'title', 'variableName', 'type', 'commerceProcess', 'commerceDocument',
      'returnType', 'endpointUrl', 'status', 'price', 'units', 'currency', 'dateModified',
      '_date_modified', 'lastUpdatedBy', 'description', 'label', 'name', 'scriptText', 'bmlScript',
      'conditionScript', 'actionScript', 'script', 'menuOptions', 'menuItems', 'values', 'columns'
    ]);

    for (const [k, v] of Object.entries(rawData || {})) {
      if (!skipKeys.has(k) && typeof v !== 'object') {
        add(k, v);
      }
    }
    return list;
  }, [category, variableName, type, rawData]);

  const filteredProperties = useMemo(() => {
    if (!filter.trim()) return propertyList;
    const q = filter.toLowerCase();
    return propertyList.filter(p => p.key.toLowerCase().includes(q) || p.value.toLowerCase().includes(q));
  }, [propertyList, filter]);

  const menuOptions = rawData.menuOptions || rawData.menuItems || rawData.values || [];
  const hasMenu = Array.isArray(menuOptions) && menuOptions.length > 0;

  const copyToClipboard = (text, label) => {
    vscode.postMessage({ command: 'copyText', text, label });
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const insertAtCursor = (text) => {
    vscode.postMessage({ command: 'insertAtCursor', text });
  };

  const openRawJson = () => {
    vscode.postMessage({ command: 'openRawJson' });
  };

  const openBmlScript = () => {
    vscode.postMessage({ command: 'openBmlScript' });
  };

  return (
    <div className="inspector-container">
      <div className="header">
        <div className="header-top">
          <div className="title-group">
            <span className="badge">{category}</span>
            <h1>{title}</h1>
            {variableName && <span className="subtitle">{variableName}</span>}
          </div>
          <div className="actions-bar">
            {variableName && (
              <button onClick={() => copyToClipboard(variableName, 'Variable Name')} title="Copy variable name to clipboard">
                📋 {copiedKey === 'Variable Name' ? 'Copied!' : 'Copy Name'}
              </button>
            )}
            {variableName && (
              <button onClick={() => insertAtCursor(variableName)} title="Insert variable name into active editor at cursor">
                ✏️ Insert at Cursor
              </button>
            )}
            {hasBml && (
              <button className="primary" onClick={openBmlScript} title="Open embedded BML script in editor">
                📜 Open BML Script
              </button>
            )}
            <button onClick={openRawJson} title="Open as clean read-only JSON document (cpq-cloud://...)">
              📄 View Raw JSON
            </button>
            <button onClick={() => copyToClipboard(JSON.stringify(rawData, null, 2), 'JSON')} title="Copy full JSON payload to clipboard">
              📦 {copiedKey === 'JSON' ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
        </div>
        {description && <div className="description-text">{description}</div>}
      </div>

      <div className="card">
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties ({propertyList.length})
          </button>
          {hasMenu && (
            <button
              className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
              onClick={() => setActiveTab('menu')}
            >
              Menu Items ({menuOptions.length})
            </button>
          )}
          <button
            className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            Raw JSON
          </button>
        </div>

        {activeTab === 'properties' && (
          <div>
            <div className="card-header">
              <span className="card-title">Configuration & Schema Attributes</span>
              <input
                type="text"
                className="search-input"
                placeholder="Filter properties..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <table>
              <thead>
                <tr>
                  <th className="prop-name">Property</th>
                  <th className="prop-val">Value</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
                      No matching properties found
                    </td>
                  </tr>
                ) : (
                  filteredProperties.map((p) => (
                    <tr key={p.key}>
                      <td className="prop-name">{p.key}</td>
                      <td className="prop-val">{p.value}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                          onClick={() => copyToClipboard(p.value, p.key)}
                          title={`Copy ${p.key}`}
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'menu' && hasMenu && (
          <div>
            <div className="card-header">
              <span className="card-title">Allowed Values & Options</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Label</th>
                  <th>Variable Name / Value</th>
                </tr>
              </thead>
              <tbody>
                {menuOptions.map((opt, idx) => (
                  <tr key={idx}>
                    <td style={{ width: '40px', color: 'var(--vscode-descriptionForeground)' }}>{idx + 1}</td>
                    <td>{opt.label || opt.displayValue || opt.name || opt}</td>
                    <td className="prop-val">{opt.variableName || opt.value || opt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="raw-json-box">
            {JSON.stringify(rawData, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}
