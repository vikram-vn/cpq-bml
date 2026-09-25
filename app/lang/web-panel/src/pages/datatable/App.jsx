import React, { useState, useEffect, useMemo } from 'react';
import TableGrid from './TableGrid';
import { getVsCodeApi } from '@/lang/web-panel/src/vscodeApi';

export default function DataTableApp({ vscodeApi: propVscodeApi, initialData = null }) {
  const vscode = propVscodeApi || getVsCodeApi();

  const [tableData, setTableData] = useState(() => {
    return initialData || (typeof window !== 'undefined' && window.__INITIAL_DATA_TABLE__) || {
      tableName: '',
      columns: [],
      rows: []
    };
  });

  const { tableName = 'Data Table', columns = [] } = tableData;
  const [rows, setRows] = useState(() => tableData.rows || []);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState(null); // { key, direction: 'asc' | 'desc' }
  const [dirtyCells, setDirtyCells] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (tableData.rows) {
      setRows(tableData.rows.map((r, i) => ({ ...r, _rowId: `row_${i}_${Date.now()}` })));
      setDirtyCells(new Set());
    }
  }, [tableData]);

  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'updateDataTable' || msg.command === 'setDataTable') {
        const payload = msg.payload || msg.data || msg;
        setTableData({
          tableName: payload.tableName || tableName,
          columns: payload.columns || columns,
          rows: payload.rows || []
        });
        setIsRefreshing(false);
      } else if (msg.type === 'saveSuccess') {
        setDirtyCells(new Set());
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tableName, columns]);

  const handleCellChange = (rowIndex, colName, newValue) => {
    setRows((prev) => {
      const next = [...prev];
      if (next[rowIndex]) {
        next[rowIndex] = { ...next[rowIndex], [colName]: newValue };
      }
      return next;
    });

    setDirtyCells((prev) => {
      const next = new Set(prev);
      next.add(`${rowIndex}_${colName}`);
      return next;
    });
  };

  const handleAddRow = () => {
    const newRow = { _rowId: `new_${Date.now()}` };
    for (const c of columns) {
      const colName = typeof c === 'string' ? c : c.name;
      newRow[colName] = '';
    }
    setRows((prev) => [newRow, ...prev]);
  };

  const handleDeleteRow = (rowIndex) => {
    setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
    setDirtyCells((prev) => {
      const next = new Set();
      for (const k of prev) {
        const [r] = k.split('_');
        if (Number(r) !== rowIndex) {
          next.add(k);
        }
      }
      return next;
    });
  };

  const handleSort = (columnKey) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === columnKey && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === columnKey && sortConfig.direction === 'desc') {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key: columnKey, direction });
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = rows.map((r, i) => ({ ...r, _originalIndex: i }));

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = result.filter((row) => {
        return Object.entries(row).some(([key, val]) => {
          if (key.startsWith('_')) return false;
          return String(val || '').toLowerCase().includes(q);
        });
      });
    }

    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        const va = a[key] !== undefined && a[key] !== null ? String(a[key]) : '';
        const vb = b[key] !== undefined && b[key] !== null ? String(b[key]) : '';
        const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, filterText, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedRows;
    const start = (page - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, page, pageSize]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    vscode.postMessage({ command: 'refresh', tableName });
  };

  const handleExportCsv = () => {
    vscode.postMessage({ command: 'exportCsv', tableName });
  };

  const handleSave = () => {
    // Strip internal _rowId and _originalIndex
    const cleanedRows = rows.map((r) => {
      const cleaned = { ...r };
      delete cleaned._rowId;
      delete cleaned._originalIndex;
      return cleaned;
    });
    vscode.postMessage({ command: 'saveRows', tableName, rows: cleanedRows });
  };

  return (
    <div className="dt-container">
      <header className="dt-header">
        <div className="dt-title-row">
          <h2 className="dt-title">
            <span className="dt-title-prefix">Data Table:</span> {tableName}
          </h2>
          <span className="dt-records-badge">
            {filteredAndSortedRows.length !== rows.length
              ? `${filteredAndSortedRows.length} of ${rows.length} records`
              : `${rows.length} records`}
          </span>
        </div>

        <div className="dt-toolbar">
          <div className="dt-search-wrapper">
            <input
              type="text"
              className="dt-search-input"
              placeholder="Filter rows..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setPage(1);
              }}
            />
            {filterText && (
              <button
                className="dt-search-clear"
                onClick={() => setFilterText('')}
                title="Clear filter"
              >
                ×
              </button>
            )}
          </div>

          <button className="dt-btn dt-btn-secondary" onClick={handleAddRow} title="Add a new row">
            + Add Row
          </button>

          <button className="dt-btn dt-btn-success" onClick={handleExportCsv} title="Export to CSV">
            Export CSV
          </button>

          <button
            className="dt-btn dt-btn-success"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh from CPQ instance"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh from CPQ'}
          </button>

          {dirtyCells.size > 0 && (
            <button className="dt-btn dt-btn-primary" onClick={handleSave} title="Save changes">
              Save ({dirtyCells.size})
            </button>
          )}
        </div>
      </header>

      <TableGrid
        columns={columns}
        rows={paginatedRows}
        sortConfig={sortConfig}
        onSort={handleSort}
        onCellChange={handleCellChange}
        onDeleteRow={handleDeleteRow}
        dirtyCells={dirtyCells}
      />

      <footer className="dt-footer">
        <div>
          {dirtyCells.size > 0 ? (
            <span className="dt-dirty-indicator">
              <span className="dt-dirty-dot" /> {dirtyCells.size} unsaved change{dirtyCells.size > 1 ? 's' : ''}
            </span>
          ) : (
            <span>Double-click any cell to edit. Changes can be saved or exported.</span>
          )}
        </div>

        <div className="dt-pagination">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="dt-page-btn"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={-1}>All</option>
          </select>

          <button
            className="dt-page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ◀ Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="dt-page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next ▶
          </button>
        </div>
      </footer>
    </div>
  );
}
