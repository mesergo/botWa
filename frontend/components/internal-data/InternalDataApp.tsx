import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { InternalDataTable, InternalDataRow, InternalDataStats } from '../../types';
import { StatsHeader } from './StatsHeader';
import { DatasetSidebar } from './DatasetSidebar';
import { DatasetView } from './DatasetView';
import { CreateDatasetModal } from './CreateDatasetModal';
import { RecordModal } from './RecordModal';
import { JsonViewerModal } from './JsonViewerModal';
import { fetchTables, fetchStats, deleteTable as apiDeleteTable } from './internalDataApi';

interface InternalDataAppProps {
  token: string | null;
}

const EMPTY_STATS: InternalDataStats = { totalCollections: 0, totalRecords: 0, totalEndpoints: 0, totalApiCalls: 0, activeSchedules: 0 };

const InternalDataApp: React.FC<InternalDataAppProps> = ({ token }) => {
  const [tables, setTables] = useState<InternalDataTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [stats, setStats] = useState<InternalDataStats>(EMPTY_STATS);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [recordModalConfig, setRecordModalConfig] = useState<{ isOpen: boolean; row?: InternalDataRow | null }>({ isOpen: false, row: null });
  const [jsonViewerConfig, setJsonViewerConfig] = useState<{ isOpen: boolean; row: InternalDataRow | null }>({ isOpen: false, row: null });

  const loadInitialData = useCallback(async () => {
    if (!token) return;
    try {
      const [tableList, statsData] = await Promise.all([fetchTables(token), fetchStats(token)]);
      setTables(tableList);
      setStats(statsData);
      if (tableList.length > 0 && !selectedTableId) setSelectedTableId(tableList[0]._id);
    } catch (err) {
      console.error('Error loading internal data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedTableId]);

  useEffect(() => { loadInitialData(); }, [token]);

  const handleRefreshAll = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      const [tableList, statsData] = await Promise.all([fetchTables(token), fetchStats(token)]);
      setTables(tableList);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to refresh internal data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [token]);

  const handleTableCreated = (newTable: InternalDataTable) => {
    setTables((prev) => [newTable, ...prev]);
    setSelectedTableId(newTable._id);
    handleRefreshAll();
  };

  const handleDeleteTable = async (id: string) => {
    try {
      await apiDeleteTable(token, id);
      const remaining = tables.filter((t) => t._id !== id);
      setTables(remaining);
      if (selectedTableId === id) setSelectedTableId(remaining.length > 0 ? remaining[0]._id : null);
      handleRefreshAll();
    } catch (err: any) {
      alert('שגיאה במחיקת הטבלה: ' + err.message);
    }
  };

  const currentTable = tables.find((t) => t._id === selectedTableId) || null;

  return (
    <div className="h-full overflow-y-auto flex flex-col" dir="rtl">
      <StatsHeader stats={stats} onOpenCreateModal={() => setIsCreateModalOpen(true)} onRefreshAll={handleRefreshAll} isRefreshing={isRefreshing} />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">טוען נתונים...</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-5 my-12 shadow-xl shadow-slate-200/60">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-sm">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">ברוכים הבאים לניהול דטה פנימי</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                חברו גיליון Google Sheets או העלו קובץ, המערכת תשאב את הנתונים למסד פנימי ותייצר עבורכם נקודות קצה API לשליפה וסינון מהיר.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              + חבר Google Sheets / טבלה ראשונה
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-start gap-6">
            <DatasetSidebar
              tables={tables}
              selectedTableId={selectedTableId}
              onSelectTable={setSelectedTableId}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
            />

            <div className="flex-1 w-full min-w-0">
              {currentTable ? (
                <DatasetView
                  token={token}
                  table={currentTable}
                  onRefreshTable={handleRefreshAll}
                  onDeleteTable={handleDeleteTable}
                  onOpenRecordModal={(row) => setRecordModalConfig({ isOpen: true, row })}
                  onOpenJsonView={(row) => setJsonViewerConfig({ isOpen: true, row })}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 shadow-sm">
                  בחר טבלה מהתפריט הצדדי כדי להציג את הנתונים ומחולל ה-API.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateDatasetModal
        token={token}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleTableCreated}
      />

      {currentTable && recordModalConfig.isOpen && (
        <RecordModal
          token={token}
          isOpen={recordModalConfig.isOpen}
          onClose={() => setRecordModalConfig({ isOpen: false, row: null })}
          table={currentTable}
          initialRow={recordModalConfig.row}
          onSaved={handleRefreshAll}
        />
      )}

      <JsonViewerModal
        isOpen={jsonViewerConfig.isOpen}
        onClose={() => setJsonViewerConfig({ isOpen: false, row: null })}
        row={jsonViewerConfig.row}
      />
    </div>
  );
};

export default InternalDataApp;
