import React from 'react';
import { Database, Plus, FileSpreadsheet, ChevronLeft } from 'lucide-react';
import { InternalDataTable } from '../../types';

interface DatasetSidebarProps {
  tables: InternalDataTable[];
  selectedTableId: string | null;
  onSelectTable: (id: string) => void;
  onOpenCreateModal: () => void;
}

export const DatasetSidebar: React.FC<DatasetSidebarProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
  onOpenCreateModal,
}) => {
  return (
    <aside className="w-full lg:w-72 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-4 shrink-0">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">טבלאות ומאגרי דאטה</h3>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs"
          title="הוסף טבלה חדשה"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {tables.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 space-y-3">
          <p>אין עדיין טבלאות במסד הנתונים</p>
          <button
            onClick={onOpenCreateModal}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
          >
            חבר Google Sheets ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto">
          {tables.map((table) => {
            const isSelected = table._id === selectedTableId;
            return (
              <button
                key={table._id}
                onClick={() => onSelectTable(table._id)}
                className={`w-full text-right p-3 rounded-2xl transition flex items-center justify-between group ${
                  isSelected
                    ? 'bg-gradient-to-l from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 hover:bg-slate-100/90 text-slate-700 border border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-indigo-600 border border-slate-200/60 shadow-2xs'
                    }`}
                  >
                    {table.source_type === 'google_sheet' ? (
                      <FileSpreadsheet className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                    ) : (
                      <Database className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold truncate">{table.name}</div>
                    <div className={`text-[11px] ${isSelected ? 'text-indigo-100' : 'text-slate-500'} flex items-center gap-1.5`}>
                      <span>{table.recordCount} רשומות</span>
                      {table.sync.enabled && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'} animate-pulse`}></span>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronLeft
                  className={`w-4 h-4 shrink-0 transition ${
                    isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center justify-between">
          <span>סנכרון פעיל:</span>
          <span className="font-bold text-emerald-600">
            {tables.filter((t) => t.sync.enabled).length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>סה"כ רשומות ב-DB:</span>
          <span className="font-mono font-semibold text-slate-900">
            {tables.reduce((acc, t) => acc + t.recordCount, 0).toLocaleString()}
          </span>
        </div>
      </div>
    </aside>
  );
};
