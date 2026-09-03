import React, { useState, useEffect } from 'react';
import {
  Search, ArrowUpDown, Plus, Trash2, Edit2, Eye, Download, RefreshCw,
  Table as TableIcon, LayoutGrid, FileCode, Check, ChevronLeft, ChevronRight,
  SlidersHorizontal, Upload,
} from 'lucide-react';
import { InternalDataTable, InternalDataRow } from '../../types';
import { fetchRows, deleteRow as apiDeleteRow } from './internalDataApi';
import ImportDataModal, { ImportDataResult } from './ImportDataModal';

interface DataTableTabProps {
  token: string | null;
  table: InternalDataTable;
  onRefreshTable: () => void;
  onOpenRecordModal: (row?: InternalDataRow) => void;
  onOpenJsonView: (row: InternalDataRow) => void;
}

export const DataTableTab: React.FC<DataTableTabProps> = ({
  token,
  table,
  onRefreshTable,
  onOpenRecordModal,
  onOpenJsonView,
}) => {
  const [rows, setRows] = useState<InternalDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'json'>('table');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const sortedFields = [...table.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const allFieldKeys = sortedFields.map((f) => f.key);

  useEffect(() => {
    if (visibleColumns.length === 0 && allFieldKeys.length > 0) {
      setVisibleColumns(allFieldKeys.slice(0, 7));
    }
  }, [table.fields]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchRows(token, table._id, { page, limit, search: search.trim() || undefined, sortField: sortField || undefined, sortOrder });
      setRows(res.rows);
      setTotalCount(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load rows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [table._id, page, limit, sortField, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(fieldKey); setSortOrder('asc'); }
  };

  const handleDelete = async (rowId: string) => {
    if (!window.confirm('למחוק רשומה זו?')) return;
    try {
      await apiDeleteRow(token, rowId);
      loadData();
      onRefreshTable();
    } catch (err: any) {
      alert('שגיאה במחיקת רשומה: ' + err.message);
    }
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const headers = allFieldKeys;
    const dataRows = rows.map((r) => headers.map((h) => `"${String(r.values[h] ?? '').replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers.join(','), ...dataRows].join('\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${table.name || 'data'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const cleanRows = rows.map((r) => r.values);
    const blob = new Blob([JSON.stringify(cleanRows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${table.name || 'data'}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleColumn = (key: string) => {
    if (visibleColumns.includes(key)) {
      if (visibleColumns.length > 1) setVisibleColumns(visibleColumns.filter((c) => c !== key));
    } else {
      setVisibleColumns([...visibleColumns, key]);
    }
  };

  return (
    <div className="space-y-4">

      {/* Top Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">

        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש חופשי בכל השדות (מספר טלפון, שם, מייל, עיר...)"
              className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 flex items-center gap-1.5 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>עמודות ({visibleColumns.length})</span>
            </button>

            {showColumnPicker && (
              <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 p-2 space-y-1 max-h-60 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-700 px-2 py-1 border-b border-slate-100">בחר עמודות להצגה:</div>
                {sortedFields.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => toggleColumn(f.key)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 text-slate-700"
                  >
                    <span className="truncate">{f.label}</span>
                    {visibleColumns.includes(f.key) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setViewMode('table')} title="תצוגת טבלה"
              className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'}`}>
              <TableIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('cards')} title="תצוגת כרטיסיות"
              className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('json')} title="תצוגת JSON גולמי"
              className={`p-1.5 rounded-lg text-xs transition ${viewMode === 'json' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'}`}>
              <FileCode className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => setShowImportModal(true)} className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 flex items-center gap-1 transition shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>ייבוא</span>
          </button>

          <div className="flex gap-1">
            <button onClick={handleExportCsv} title="ייצא כ-CSV" className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 flex items-center gap-1 transition shadow-2xs">
              <Download className="w-3.5 h-3.5 text-slate-500" /><span>CSV</span>
            </button>
            <button onClick={handleExportJson} title="ייצא כ-JSON" className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 flex items-center gap-1 transition shadow-2xs">
              <Download className="w-3.5 h-3.5 text-slate-500" /><span>JSON</span>
            </button>
          </div>

          <button onClick={() => onOpenRecordModal()} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95">
            <Plus className="w-3.5 h-3.5" /><span>הוסף רשומה</span>
          </button>

          <button onClick={loadData} title="רענן רשומות" className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition shadow-2xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

      </div>

      {sortedFields.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          לטבלה זו אין שדות עדיין. ייבאו נתונים או הוסיפו רשומה ראשונה כדי שהשדות יזוהו אוטומטית.
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3.5 text-center w-12 text-slate-400">#</th>
                  {visibleColumns.map((colKey) => {
                    const fieldDef = table.fields.find((f) => f.key === colKey);
                    return (
                      <th key={colKey} onClick={() => handleSort(colKey)} className="px-4 py-3.5 cursor-pointer hover:text-slate-900 select-none transition">
                        <div className="flex items-center gap-1.5">
                          <span>{fieldDef?.label || colKey}</span>
                          <ArrowUpDown className={`w-3 h-3 ${sortField === colKey ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3.5 text-left w-24">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-800">
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={visibleColumns.length + 2} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>טוען רשומות...</span>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={visibleColumns.length + 2} className="px-4 py-12 text-center text-slate-500">
                    לא נמצאו רשומות בטבלה זו. לחץ על "הוסף רשומה" או "ייבוא".
                  </td></tr>
                ) : rows.map((row, idx) => (
                  <tr key={row._id} className="hover:bg-indigo-50/40 transition group">
                    <td className="px-4 py-3 text-center text-slate-400 font-mono text-[11px]">{(page - 1) * limit + idx + 1}</td>
                    {visibleColumns.map((colKey) => {
                      const val = row.values[colKey];
                      const fieldDef = table.fields.find((f) => f.key === colKey);
                      const isPhone = fieldDef?.type === 'phone';
                      const isEmail = fieldDef?.type === 'email';
                      return (
                        <td key={colKey} className="px-4 py-3 text-slate-800 max-w-xs truncate">
                          {isPhone ? (
                            <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{val ?? '—'}</span>
                          ) : isEmail ? (
                            <span className="text-sky-700 underline underline-offset-2 decoration-sky-300">{val ?? '—'}</span>
                          ) : (
                            <span>{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button onClick={() => onOpenJsonView(row)} title="הצג JSON מלא" className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-sky-600 rounded-lg transition"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onOpenRecordModal(row)} title="ערוך רשומה" className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-amber-600 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(row._id)} title="מחק רשומה" className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/90 border-t border-slate-200 text-xs text-slate-600">
            <div>
              מציג <span className="font-semibold text-slate-900">{rows.length}</span> מתוך{' '}
              <span className="font-semibold text-slate-900">{totalCount}</span> רשומות
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>שורות לעמוד:</span>
                <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-1 text-xs">
                  <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition shadow-2xs"><ChevronRight className="w-4 h-4" /></button>
                <span className="px-2 font-mono text-slate-900 font-semibold">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition shadow-2xs"><ChevronLeft className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <div key={row._id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 space-y-3 shadow-sm transition">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-mono text-indigo-600 font-semibold">{row.values[allFieldKeys[0]] ?? row._id}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => onOpenRecordModal(row)} className="p-1 text-slate-400 hover:text-amber-600"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(row._id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {visibleColumns.slice(0, 5).map((k) => (
                  <div key={k} className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">{table.fields.find((f) => f.key === k)?.label || k}:</span>
                    <span className="font-medium text-slate-900 truncate max-w-[160px]">{String(row.values[k] ?? '')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[500px]">
          <pre>{JSON.stringify(rows.map((r) => r.values), null, 2)}</pre>
        </div>
      )}

      {showImportModal && (
        <ImportDataModal
          token={token}
          tableId={table._id}
          fields={table.fields}
          onClose={() => setShowImportModal(false)}
          onImported={(_result: ImportDataResult) => { loadData(); onRefreshTable(); }}
        />
      )}
    </div>
  );
};
