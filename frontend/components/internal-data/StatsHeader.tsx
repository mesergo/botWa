import React from 'react';
import { Database, RefreshCw, Zap, Plus, Server } from 'lucide-react';
import { InternalDataStats } from '../../types';

interface StatsHeaderProps {
  stats: InternalDataStats;
  onOpenCreateModal: () => void;
  onRefreshAll: () => void;
  isRefreshing?: boolean;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({
  stats,
  onOpenCreateModal,
  onRefreshAll,
  isRefreshing = false,
}) => {
  return (
    <div className="bg-white/95 border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-500">טבלאות:</span>
              <span className="font-bold text-slate-900">{stats.totalCollections}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <Server className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-slate-500">רשומות ב-DB:</span>
              <span className="font-bold text-slate-900">{stats.totalRecords.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-slate-500">נקודות API:</span>
              <span className="font-bold text-slate-900">{stats.totalEndpoints}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-slate-500">סנכרון אוטומטי:</span>
              <span className="font-bold text-slate-900">{stats.activeSchedules} פעילים</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              title="רענן נתוני מערכת"
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>חבר Google Sheets / טבלה חדשה</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
