import React, { useState } from 'react';
import {
  Table as TableIcon, Clock, Code2, Database, RefreshCw, FileSpreadsheet,
  Layers, Trash2, Loader2,
} from 'lucide-react';
import { DataTableTab } from './DataTableTab';
import { SchemaTab } from './SchemaTab';
import { SyncScheduleTab } from './SyncScheduleTab';
import { ApiGeneratorTab } from './ApiGeneratorTab';
import { MongoConsoleTab } from './MongoConsoleTab';
import { triggerManualSync } from './internalDataApi';
import { InternalDataTable, InternalDataRow } from '../../types';

interface DatasetViewProps {
  token: string | null;
  table: InternalDataTable;
  onRefreshTable: () => void;
  onDeleteTable: (id: string) => void;
  onOpenRecordModal: (row?: InternalDataRow) => void;
  onOpenJsonView: (row: InternalDataRow) => void;
}

type TabKey = 'table' | 'schema' | 'sync' | 'api' | 'mql';

export const DatasetView: React.FC<DatasetViewProps> = ({
  token, table, onRefreshTable, onDeleteTable, onOpenRecordModal, onOpenJsonView,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('table');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleQuickSync = async () => {
    setIsSyncing(true);
    try {
      await triggerManualSync(token, table._id);
      onRefreshTable();
    } catch (err: any) {
      alert('שגיאה בסנכרון: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את הטבלה "${table.name}" וכל הנתונים שלה?`)) {
      onDeleteTable(table._id);
    }
  };

  const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: `טבלה ורשומות (${table.recordCount})`, icon: <TableIcon className="w-4 h-4" /> },
    { id: 'schema', label: 'מבנה טבלה', icon: <Layers className="w-4 h-4" /> },
    { id: 'sync', label: 'מועדי עדכון וסנכרון', icon: <Clock className="w-4 h-4" /> },
    { id: 'api', label: 'מחולל API (חיצוני)', icon: <Code2 className="w-4 h-4" /> },
    { id: 'mql', label: 'מסוף שאילתות', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
                {table.source_type === 'google_sheet' ? <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> : <Database className="w-6 h-6 text-indigo-600" />}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{table.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">{table.recordCount} רשומות</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{table.description || 'מאגר נתונים פנימי עם נקודות קצה API'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                מקור:{' '}
                <strong className="text-slate-900">{table.source_type === 'google_sheet' ? 'Google Sheets (סנכרון חי)' : table.source_type === 'excel_url' ? 'קובץ CSV / Excel' : 'מסד נתונים פנימי'}</strong>
              </span>
              {table.sync.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  <Clock className="w-3.5 h-3.5" />סנכרון מתוזמן כל {table.sync.interval_minutes} דקות
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-600 border border-slate-200"><Clock className="w-3.5 h-3.5" />סנכרון ידני בלבד</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {table.sync.source_url && (
              <button onClick={handleQuickSync} disabled={isSyncing} className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50">
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>סנכרן נתונים עכשיו</span>
              </button>
            )}
            <button onClick={() => setActiveTab('api')} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm shadow-indigo-600/20 transition flex items-center gap-2 active:scale-95">
              <Code2 className="w-4 h-4" /><span>מחולל API</span>
            </button>
            <button onClick={handleDelete} title="מחק טבלה זו" className="p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 transition shadow-2xs">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-6 pt-4 border-t border-slate-100 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'table' && (
        <DataTableTab token={token} table={table} onRefreshTable={onRefreshTable} onOpenRecordModal={onOpenRecordModal} onOpenJsonView={onOpenJsonView} />
      )}
      {activeTab === 'schema' && (
        <SchemaTab token={token} table={table} onRefreshTable={onRefreshTable} />
      )}
      {activeTab === 'sync' && (
        <SyncScheduleTab token={token} table={table} onRefreshTable={onRefreshTable} />
      )}
      {activeTab === 'api' && (
        <ApiGeneratorTab token={token} table={table} onRefreshTable={onRefreshTable} />
      )}
      {activeTab === 'mql' && (
        <MongoConsoleTab token={token} table={table} />
      )}

    </div>
  );
};
