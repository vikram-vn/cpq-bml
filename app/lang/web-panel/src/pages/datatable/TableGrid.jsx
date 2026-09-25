import React, { useState, useRef, useEffect } from 'react';

export default function TableGrid({
  columns,
  rows,
  sortConfig,
  onSort,
  onCellChange,
  onDeleteRow,
  dirtyCells
}) {
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colName }
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellDoubleClick = (rowIndex, colName, currentValue) => {
    setEditingCell({ rowIndex, colName });
    setEditValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : '');
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { rowIndex, colName } = editingCell;
    onCellChange(rowIndex, colName, editValue);
    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div className="dt-table-wrapper">
      <table className="dt-table">
        <thead>
          <tr>
            <th className="dt-row-num">#</th>
            {columns.map((col) => {
              const colName = typeof col === 'string' ? col : col.name || '';
              const colType = typeof col === 'string' ? 'string' : col.type || 'string';
              const isSorted = sortConfig && sortConfig.key === colName;
              const sortDirection = isSorted ? sortConfig.direction : null;

              return (
                <th
                  key={colName}
                  onClick={() => onSort(colName)}
                  title={`Click to sort by ${colName}`}
                >
                  <div className="dt-th-content">
                    <span>
                      {colName} <span className="dt-col-type">({colType})</span>
                    </span>
                    <span className={`dt-sort-indicator ${isSorted ? 'active' : ''}`}>
                      {sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '⇅'}
                    </span>
                  </div>
                </th>
              );
            })}
            <th className="dt-row-actions"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2}>
                <div className="dt-empty-state">
                  <span className="dt-empty-icon">🔍</span>
                  <span>No records match the current filter</span>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, rIdx) => {
              const actualRowIndex = row._originalIndex !== undefined ? row._originalIndex : rIdx;

              return (
                <tr key={row._rowId || actualRowIndex}>
                  <td className="dt-row-num">{actualRowIndex + 1}</td>
                  {columns.map((col) => {
                    const colName = typeof col === 'string' ? col : col.name || '';
                    const cellKey = `${actualRowIndex}_${colName}`;
                    const isDirty = dirtyCells && dirtyCells.has(cellKey);
                    const isEditing = editingCell && editingCell.rowIndex === actualRowIndex && editingCell.colName === colName;
                    const cellVal = row[colName] !== undefined && row[colName] !== null ? String(row[colName]) : '';

                    if (isEditing) {
                      return (
                        <td key={colName} className="dt-cell-editing">
                          <input
                            ref={inputRef}
                            className="dt-cell-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={colName}
                        className={`dt-cell-editable ${isDirty ? 'dt-cell-dirty' : ''}`}
                        onDoubleClick={() => handleCellDoubleClick(actualRowIndex, colName, cellVal)}
                        title="Double-click to edit cell"
                      >
                        {cellVal}
                      </td>
                    );
                  })}
                  <td className="dt-row-actions">
                    <button
                      className="dt-btn-delete-row"
                      onClick={() => onDeleteRow(actualRowIndex)}
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
