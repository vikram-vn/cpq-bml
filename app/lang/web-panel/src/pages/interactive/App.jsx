import React, { useState, useEffect, useMemo } from 'react';
import { getVsCodeApi } from '@/lang/web-panel/src/vscodeApi';

function getCategoryIcon(cat = '') {
  const lower = String(cat).toLowerCase();
  if (lower.includes('array set')) return '🗃️';
  if (lower.includes('attribute')) return '🏷️';
  if (lower.includes('action')) return '⚡';
  if (lower.includes('function') || lower.includes('library')) return '📚';
  if (lower.includes('integration')) return '🔌';
  if (lower.includes('table')) return '📊';
  if (lower.includes('rule')) return '🎯';
  return '📦';
}

function getDataTypeBadge(dt = '') {
  const lower = String(dt).toLowerCase();
  if (lower.includes('string') || lower.includes('text')) return 'badge-type-string';
  if (lower.includes('integer') || lower.includes('float') || lower.includes('currency') || lower.includes('number')) return 'badge-type-number';
  if (lower.includes('date')) return 'badge-type-date';
  if (lower.includes('boolean')) return 'badge-type-boolean';
  if (lower.includes('menu') || lower.includes('select')) return 'badge-type-menu';
  return 'badge-type-default';
}

export default function App({ vscodeApi: propVscodeApi, initialData = null }) {
  const vscode = propVscodeApi || getVsCodeApi();
  const [data, setData] = useState(() => {
    return initialData || (typeof window !== 'undefined' && window.__INITIAL_INSPECTOR_DATA__) || {};
  });

  const {
    category = 'Item',
    title = 'CPQ Metadata',
    variableName = '',
    type = '',
    description = '',
    data: rawData = {},
    hasBml = false
  } = data;

  const memberAttributes = useMemo(() => {
    return Array.isArray(rawData.attributes) ? rawData.attributes : [];
  }, [rawData.attributes]);

  const menuOptions = useMemo(() => {
    return rawData.menuOptions || rawData.menuItems || rawData.values || [];
  }, [rawData.menuOptions, rawData.menuItems, rawData.values]);

  const hasAttributes = memberAttributes.length > 0;
  const hasMenu = Array.isArray(menuOptions) && menuOptions.length > 0;
  const isArraySet = category === 'Array Set' || rawData.type === 'arraySet' || hasAttributes;
  const isAction = category === 'Action' || rawData.actionType || rawData.type === 'action';
  const isLibrary = category === 'Library' || category === 'Function' || (typeof category === 'string' && category.includes('Library')) || rawData.type === 'library' || rawData.type === 'function';

  const [activeTab, setActiveTab] = useState(() => {
    if (isArraySet) return 'attributes';
    return 'properties';
  });

  const [filter, setFilter] = useState('');
  const [attrFilter, setAttrFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [selectedSnippetFields, setSelectedSnippetFields] = useState(() => new Set());
  const [cloudReferences, setCloudReferences] = useState([]);
  const [isLoadingCloudRefs, setIsLoadingCloudRefs] = useState(false);
  const [cloudRefsError, setCloudRefsError] = useState(null);

  // Automatically update active tab if new data arrives
  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (message && message.command === 'setData' && message.payload) {
        const payload = message.payload;
        setData(payload);
        setCloudReferences([]);
        setCloudRefsError(null);
        const nextAttrs = Array.isArray(payload?.data?.attributes) ? payload.data.attributes : [];
        if (payload?.category === 'Array Set' || nextAttrs.length > 0) {
          setActiveTab('attributes');
        } else {
          setActiveTab('properties');
        }
      }
      if (message && message.command === 'cloudReferencesLoaded') {
        setIsLoadingCloudRefs(false);
        if (message.error) {
          setCloudRefsError(message.error);
        } else {
          setCloudReferences(message.references || []);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initialize snippet selection when attributes change
  useEffect(() => {
    if (memberAttributes.length > 0) {
      const initialSet = new Set(memberAttributes.slice(0, 6).map(a => a.variableName || a.name).filter(Boolean));
      setSelectedSnippetFields(initialSet);
    }
  }, [memberAttributes]);

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
    if (memberAttributes.length > 0) add('Member Attributes Count', memberAttributes.length);
    if (menuOptions.length > 0) add('Menu Options Count', menuOptions.length);

    const skipKeys = new Set([
      'category', 'title', 'variableName', 'type', 'commerceProcess', 'commerceDocument',
      'returnType', 'endpointUrl', 'status', 'price', 'units', 'currency', 'dateModified',
      '_date_modified', 'lastUpdatedBy', 'description', 'label', 'name', 'scriptText', 'bmlScript',
      'conditionScript', 'actionScript', 'script', 'menuOptions', 'menuItems', 'values', 'columns', 'attributes'
    ]);

    for (const [k, v] of Object.entries(rawData || {})) {
      if (!skipKeys.has(k) && typeof v !== 'object') {
        add(k, v);
      }
    }
    return list;
  }, [category, variableName, type, rawData, memberAttributes.length, menuOptions.length]);

  const filteredProperties = useMemo(() => {
    if (!filter.trim()) return propertyList;
    const q = filter.toLowerCase();
    return propertyList.filter(p => p.key.toLowerCase().includes(q) || p.value.toLowerCase().includes(q));
  }, [propertyList, filter]);

  const filteredAttributes = useMemo(() => {
    if (!attrFilter.trim()) return memberAttributes;
    const q = attrFilter.toLowerCase();
    return memberAttributes.filter(a => {
      const vn = (a.variableName || a.name || '').toLowerCase();
      const lbl = (a.label || a.name || '').toLowerCase();
      const dt = (a.dataType || a.type || '').toLowerCase();
      const d = (a.description || '').toLowerCase();
      return vn.includes(q) || lbl.includes(q) || dt.includes(q) || d.includes(q);
    });
  }, [memberAttributes, attrFilter]);

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

  const fetchReferences = () => {
    if (!variableName) return;
    setIsLoadingCloudRefs(true);
    setCloudRefsError(null);
    vscode.postMessage({
      command: 'fetchCloudReferences',
      variableName,
      category,
      entityType: isAction ? 'action' : (isLibrary ? 'library' : (isArraySet ? 'arraySet' : 'attribute')),
      process: rawData.commerceProcess,
      document: rawData.commerceDocument
    });
  };

  const openReferencesGraph = () => {
    vscode.postMessage({
      command: 'showEntityReferences',
      entityType: isAction ? 'action' : (isLibrary ? 'library' : (isArraySet ? 'arraySet' : 'attribute')),
      entityName: variableName,
      category,
      process: rawData.commerceProcess,
      document: rawData.commerceDocument
    });
  };

  const toggleSnippetField = (fVarName) => {
    setSelectedSnippetFields(prev => {
      const next = new Set(prev);
      if (next.has(fVarName)) next.delete(fVarName);
      else next.add(fVarName);
      return next;
    });
  };

  const generatedSnippet = useMemo(() => {
    if (isArraySet) {
      const chosen = memberAttributes.filter(a => selectedSnippetFields.has(a.variableName || a.name));
      const activeList = chosen.length > 0 ? chosen : memberAttributes.slice(0, 5);
      const lines = activeList.map(a => {
        const vn = a.variableName || a.name;
        return `    ${vn} = row.${vn}; // ${a.dataType || 'String'}`;
      });
      return `// ================================================\n// Iterate over Array Set: ${variableName || 'arraySet'}\n// Document: ${rawData.commerceDocument || 'transaction'}\n// ================================================\nfor row in ${variableName || 'myArraySet'} {\n${lines.join('\n')}\n    \n    // TODO: Add custom business logic here\n}`;
    }

    if (hasMenu) {
      const opts = menuOptions.slice(0, 5);
      const branches = opts.map((opt, idx) => {
        const val = opt.variableName || opt.value || opt;
        const kw = idx === 0 ? 'if' : 'elif';
        return `${kw} (${variableName} == "${val}") {\n    // Handle: ${opt.label || val}\n}`;
      }).join(' ');
      return `// ================================================\n// Menu Attribute Check: ${variableName}\n// ================================================\n${branches}\nelse {\n    // Default fallback\n}`;
    }

    return `// ================================================\n// Access Attribute: ${variableName}\n// ================================================\nval = ${variableName};\n\nif (isnull(val) OR string(val) == "") {\n    // Handle null or empty value\n}`;
  }, [isArraySet, memberAttributes, selectedSnippetFields, variableName, rawData.commerceDocument, hasMenu, menuOptions]);

  const catIcon = getCategoryIcon(category);
  const docScope = rawData.commerceDocument ? (rawData.commerceDocument === 'transaction' ? 'Transaction Header' : 'Transaction Line') : (category === 'Array Set' ? 'Array Set' : '');

  return (
    <div className="inspector-container">
      {/* Modern Glassmorphic Hero Header */}
      <div className="hero-header">
        <div className="hero-top">
          <div className="title-section">
            <div className="badge-row">
              <span className="category-badge">
                <span className="cat-icon">{catIcon}</span>
                {category}
              </span>
              {docScope && <span className="meta-pill scope-pill">📍 {docScope}</span>}
              {rawData.commerceProcess && <span className="meta-pill process-pill">⚙️ {rawData.commerceProcess}</span>}
              {type && type !== category && <span className="meta-pill type-pill">{type}</span>}
              {hasAttributes && <span className="meta-pill count-pill">🗃️ {memberAttributes.length} Fields</span>}
              {hasMenu && <span className="meta-pill count-pill">📑 {menuOptions.length} Options</span>}
            </div>

            <div className="title-name-row">
              <h1 className="item-title">{title}</h1>
              {variableName && (
                <button
                  className="varname-chip"
                  onClick={() => copyToClipboard(variableName, 'Variable Name')}
                  title="Click to copy variable name"
                >
                  <code>{variableName}</code>
                  <span className="chip-copy-icon">
                    {copiedKey === 'Variable Name' ? '✓ Copied' : '📋'}
                  </span>
                </button>
              )}
            </div>

            {description && <div className="hero-description">{description}</div>}
          </div>

          <div className="action-buttons-group">
            {variableName && (
              <button
                className="action-btn blast-action"
                onClick={openReferencesGraph}
                title="View interactive Dependency & References Graph in architecture panel"
              >
                🔗 References
              </button>
            )}
            {variableName && (
              <button
                className="action-btn primary-action"
                onClick={() => insertAtCursor(variableName)}
                title="Insert variable name directly into active BML editor at cursor"
              >
                ✏️ Insert at Cursor
              </button>
            )}
            {hasBml && (
              <button
                className="action-btn bml-action"
                onClick={openBmlScript}
                title="Open embedded BML script directly in VS Code editor"
              >
                📜 Open BML Script
              </button>
            )}
            <button
              className="action-btn secondary-action"
              onClick={openRawJson}
              title="Open clean read-only JSON document (cpq-cloud://...)"
            >
              📄 View Clean JSON
            </button>
            <button
              className="action-btn secondary-action"
              onClick={() => copyToClipboard(JSON.stringify(rawData, null, 2), 'JSON')}
              title="Copy complete JSON payload to clipboard"
            >
              📦 {copiedKey === 'JSON' ? '✓ Copied!' : 'Copy JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabbed Container */}
      <div className="inspector-card">
        <div className="tabs-header">
          {hasAttributes && (
            <button
              className={`tab-item ${activeTab === 'attributes' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('attributes')}
            >
              <span className="tab-icon">🗃️</span> Member Fields ({memberAttributes.length})
            </button>
          )}

          <button
            className={`tab-item ${activeTab === 'properties' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            <span className="tab-icon">⚙️</span> Schema & Properties ({propertyList.length})
          </button>

          {(category === 'Attribute' || category === 'Array Set' || isAction || isLibrary || rawData.type === 'attribute' || hasAttributes) && (
            <button
              className={`tab-item ${activeTab === 'references' ? 'tab-active' : ''}`}
              onClick={() => {
                setActiveTab('references');
                if (cloudReferences.length === 0 && !isLoadingCloudRefs) {
                  fetchReferences();
                }
              }}
            >
              <span className="tab-icon">🔗</span> References {cloudReferences.length > 0 ? `(${cloudReferences.length})` : ''}
            </button>
          )}

          {hasMenu && (
            <button
              className={`tab-item ${activeTab === 'menu' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('menu')}
            >
              <span className="tab-icon">📑</span> Menu Options ({menuOptions.length})
            </button>
          )}

          <button
            className={`tab-item ${activeTab === 'snippets' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('snippets')}
          >
            <span className="tab-icon">⚡</span> BML Code Snippets
          </button>

          <button
            className={`tab-item ${activeTab === 'raw' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            <span className="tab-icon">🔍</span> Raw JSON
          </button>
        </div>

        {/* Tab 1: Member Fields (for Array Sets) */}
        {activeTab === 'attributes' && hasAttributes && (
          <div className="tab-content">
            <div className="toolbar-row">
              <div className="toolbar-info">
                <span className="section-heading">Array Set Member Fields</span>
                <span className="section-subheading">
                  Showing {filteredAttributes.length} of {memberAttributes.length} fields
                </span>
              </div>
              <input
                type="text"
                className="filter-field-input"
                placeholder="🔍 Search fields by name, label, type..."
                value={attrFilter}
                onChange={(e) => setAttrFilter(e.target.value)}
              />
            </div>

            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Field Label</th>
                    <th>Variable Name</th>
                    <th>Data Type</th>
                    <th style={{ textAlign: 'right', minWidth: '150px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttributes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        No fields match filter "{attrFilter}"
                      </td>
                    </tr>
                  ) : (
                    filteredAttributes.map((attr, idx) => {
                      const varName = attr.variableName || attr.name || '';
                      const lbl = attr.label || attr.name || varName;
                      const dt = attr.dataType || attr.type || 'String';
                      const badgeClass = getDataTypeBadge(dt);

                      return (
                        <tr key={varName || idx} className="field-row">
                          <td className="index-cell">{idx + 1}</td>
                          <td className="field-label-cell">
                            <span className="field-label-title">{lbl}</span>
                            {attr.description && (
                              <span className="field-desc-text">{attr.description}</span>
                            )}
                          </td>
                          <td className="field-varname-cell">
                            <code>{varName}</code>
                          </td>
                          <td>
                            <span className={`type-badge ${badgeClass}`}>{dt}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="cell-actions">
                              <button
                                className="icon-btn"
                                onClick={() => copyToClipboard(varName, `Field ${varName}`)}
                                title={`Copy field variable name '${varName}'`}
                              >
                                {copiedKey === `Field ${varName}` ? '✓' : '📋'} Name
                              </button>
                              <button
                                className="icon-btn highlight-btn"
                                onClick={() => insertAtCursor(`row.${varName}`)}
                                title={`Insert 'row.${varName}' at cursor in active BML editor`}
                              >
                                ✏️ row.{varName}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Schema & Properties */}
        {activeTab === 'properties' && (
          <div className="tab-content">
            <div className="toolbar-row">
              <div className="toolbar-info">
                <span className="section-heading">Configuration & Schema Attributes</span>
                <span className="section-subheading">{filteredProperties.length} properties displayed</span>
              </div>
              <input
                type="text"
                className="filter-field-input"
                placeholder="🔍 Filter properties..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Property</th>
                    <th>Value</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-row">
                        No matching properties found
                      </td>
                    </tr>
                  ) : (
                    filteredProperties.map((p) => (
                      <tr key={p.key}>
                        <td className="prop-name-cell">{p.key}</td>
                        <td className="prop-value-cell">{p.value}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="icon-btn"
                            onClick={() => copyToClipboard(p.value, p.key)}
                            title={`Copy ${p.key}`}
                          >
                            {copiedKey === p.key ? '✓' : '📋'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: References & Cloud Dependencies */}
        {activeTab === 'references' && (
          <div className="tab-content">
            <div className="toolbar-row">
              <div className="toolbar-info">
                <span className="section-heading">🔗 Server-Side References & Dependencies</span>
                <span className="section-subheading">
                  {isAction
                    ? <>Live action dependencies queried from CPQ REST API: <code>.../actionDefs/{variableName}</code></>
                    : isLibrary
                    ? <>Live callers queried from CPQ BML Search: <code>.../bml/scripts?q='{variableName}'</code> & workspace graph</>
                    : <>Live usages queried from CPQ REST API: <code>.../attributes/{variableName}/references</code></>}
                </span>
              </div>
              <div className="cell-actions">
                <button
                  className="action-btn blast-action"
                  onClick={openReferencesGraph}
                  title="Launch full visual interactive dependency & references graph"
                >
                  🚀 Open in Architecture Graph
                </button>
                <button
                  className="icon-btn"
                  onClick={fetchReferences}
                  disabled={isLoadingCloudRefs}
                  title="Re-query CPQ Cloud server references"
                >
                  {isLoadingCloudRefs ? '⏳ Querying...' : '🔄 Refresh References'}
                </button>
              </div>
            </div>

            {isLoadingCloudRefs ? (
              <div className="empty-row" style={{ padding: '36px' }}>
                ⏳ Querying Oracle CPQ Cloud references for <code>{variableName}</code>...
              </div>
            ) : cloudRefsError ? (
              <div className="empty-row" style={{ color: '#f87171' }}>
                ⚠️ Unable to load cloud references: {cloudRefsError}
              </div>
            ) : cloudReferences.length === 0 ? (
              <div className="empty-row" style={{ padding: '36px' }}>
                <p>No active dependencies or references for <code>{variableName}</code> were returned by CPQ server.</p>
                <button
                  className="action-btn secondary-action"
                  onClick={fetchReferences}
                  style={{ marginTop: '10px' }}
                >
                  🔄 Query Server References Now
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Referenced / Dependent Component</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Context / Scope</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cloudReferences.map((ref, idx) => {
                      const refName = ref.name || ref.label || ref.variableName || ref.id || 'Component';
                      const refType = ref.type || ref.ruleType || ref.actionType || 'Usage';
                      const refDesc = ref.description || '-';
                      const doc = ref.document || ref.commerceDocument || rawData.commerceDocument || 'transaction';
                      return (
                        <tr key={idx}>
                          <td className="index-cell">{idx + 1}</td>
                          <td><strong>{refName}</strong></td>
                          <td>
                            <span className="type-badge badge-type-menu">{refType}</span>
                          </td>
                          <td className="field-desc-text">{refDesc}</td>
                          <td className="index-cell">{doc}</td>
                          <td style={{ textAlign: 'right' }}>
                            {ref.filePath ? (
                              <button
                                className="icon-btn highlight-btn"
                                onClick={() => vscode.postMessage({ command: 'openFile', filePath: ref.filePath, line: ref.line })}
                                title="Open caller file in editor"
                              >
                                📝 Open
                              </button>
                            ) : (
                              <button
                                className="icon-btn highlight-btn"
                                onClick={openReferencesGraph}
                                title="Trace in visual graph"
                              >
                                🔍 Trace
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Menu Options */}
        {activeTab === 'menu' && hasMenu && (
          <div className="tab-content">
            <div className="toolbar-row">
              <div className="toolbar-info">
                <span className="section-heading">Allowed Values & Menu Options</span>
                <span className="section-subheading">{menuOptions.length} options defined in CPQ</span>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Display Label</th>
                    <th>Stored Value / Variable Name</th>
                    <th style={{ width: '150px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {menuOptions.map((opt, idx) => {
                    const val = opt.variableName || opt.value || opt;
                    const lbl = opt.label || opt.displayValue || opt.name || val;
                    return (
                      <tr key={idx}>
                        <td className="index-cell">{idx + 1}</td>
                        <td><strong>{lbl}</strong></td>
                        <td className="field-varname-cell"><code>{val}</code></td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="cell-actions">
                            <button
                              className="icon-btn"
                              onClick={() => copyToClipboard(val, `Option ${val}`)}
                              title="Copy option value"
                            >
                              {copiedKey === `Option ${val}` ? '✓' : '📋'} Copy
                            </button>
                            <button
                              className="icon-btn highlight-btn"
                              onClick={() => insertAtCursor(`"${val}"`)}
                              title="Insert option string at cursor"
                            >
                              ✏️ Insert
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: BML Code Snippets */}
        {activeTab === 'snippets' && (
          <div className="tab-content">
            <div className="snippet-panel">
              <div className="snippet-header">
                <div>
                  <span className="section-heading">⚡ Ready-to-Use BML Snippet</span>
                  <p className="snippet-desc">
                    Generated idiomatic BML code for <strong>{variableName}</strong>. Copy or directly insert into your active editor.
                  </p>
                </div>
                <div className="snippet-actions">
                  <button
                    className="action-btn secondary-action"
                    onClick={() => copyToClipboard(generatedSnippet, 'BML Snippet')}
                  >
                    {copiedKey === 'BML Snippet' ? '✓ Copied!' : '📋 Copy Snippet'}
                  </button>
                  <button
                    className="action-btn primary-action"
                    onClick={() => insertAtCursor(generatedSnippet)}
                  >
                    ✏️ Insert at Cursor
                  </button>
                </div>
              </div>

              {/* Checkbox selector for Array Set fields */}
              {isArraySet && memberAttributes.length > 0 && (
                <div className="snippet-field-picker">
                  <span className="picker-title">Select fields to include in loop:</span>
                  <div className="field-chips-container">
                    {memberAttributes.map(attr => {
                      const vn = attr.variableName || attr.name;
                      const isChecked = selectedSnippetFields.has(vn);
                      return (
                        <label
                          key={vn}
                          className={`field-chip-checkbox ${isChecked ? 'chip-checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSnippetField(vn)}
                          />
                          <span>{attr.label || vn}</span>
                          <span className="chip-code">({vn})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <pre className="code-block-container">
                <code>{generatedSnippet}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 5: Raw JSON */}
        {activeTab === 'raw' && (
          <div className="tab-content">
            <div className="raw-json-toolbar">
              <span className="section-heading">Full CPQ Server Payload</span>
              <button
                className="icon-btn"
                onClick={() => copyToClipboard(JSON.stringify(rawData, null, 2), 'JSON Data')}
              >
                {copiedKey === 'JSON Data' ? '✓ Copied!' : '📋 Copy JSON'}
              </button>
            </div>
            <pre className="raw-json-box">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
