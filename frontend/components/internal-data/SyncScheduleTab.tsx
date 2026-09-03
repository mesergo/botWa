import React, { useState, useEffect } from 'react';
import {
  Clock, RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle, Play, Save, Loader2, History, ShieldCheck, Settings2,
} from 'lucide-react';
import { InternalDataTable, InternalDataSyncLog, InternalDataSyncMode } from '../../types';
import { updateSyncSettings, triggerManualSync, fetchSyncLogs } from './internalDataApi';

interface SyncScheduleTabProps {
  token: string | null;
  table: InternalDataTable;
  onRefreshTable: () => void;
}

export const SyncScheduleTab: React.FC<SyncScheduleTabProps> = ({ token, table, onRefreshTable }) => {
  const [sourceUrl, setSourceUrl] = useState(table.sync.source_url || '');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(table.sync.enabled);
  const [intervalMinutes, setIntervalMinutes] = useState(table.sync.interval_minutes || 15);
  const [syncMode, setSyncMode] = useState<InternalDataSyncMode>(table.sync.mode || 'replace');
  const [uniqueKeyField, setUniqueKeyField] = useState(table.sync.unique_key_field || table.fields[0]?.key || '');

  const [logs, setLogs] = useState<InternalDataSyncLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      setLogs(await fetchSyncLogs(token, table._id));
    } catch (err) {
      console.error('Failed to load sync logs', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => { loadLogs(); }, [table._id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccess(false);
    try {
      await updateSyncSettings(token, table._id, {
        enabled: autoSyncEnabled,
        source_type: 'google_sheet',
        source_url: sourceUrl.trim(),
        interval_minutes: autoSyncEnabled ? intervalMinutes : 0,
        mode: syncMode,
        unique_key_field: syncMode === 'upsert' ? uniqueKeyField : '',
      });
      setSaveSuccess(true);
      onRefreshTable();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert('שגיאה בשמירת הגדרות: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleManualSyncNow = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      const res = await triggerManualSync(token, table._id);
      setSyncFeedback({ success: res.success, message: res.success ? (res.message || 'הסנכרון הושלם בהצלחה') : (res.error || 'הסנכרון נכשל') });
      onRefreshTable();
      loadLogs();
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'שגיאה בביצוע הסנכרון' });
    } finally {
      setIsSyncingNow(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/50 p-5 rounded-3xl border border-indigo-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-white text-indigo-600 border border-indigo-100 shadow-2xs">
              <RefreshCw className={`w-6 h-6 ${isSyncingNow ? 'animate-spin text-indigo-600' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">סנכרון נתונים ידני ואוטומטי</h3>
                {table.sync.enabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    סנכרון מתוזמן פעיל (כל {table.sync.interval_minutes} דק')
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">סנכרון ידני בלבד</span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                סנכרון אחרון:{' '}
                <span className="font-mono text-slate-900 font-semibold">
                  {table.sync.last_synced_at ? new Date(table.sync.last_synced_at).toLocaleString('he-IL') : 'טרם בוצע'}
                </span>
                {table.sync.last_sync_error && (
                  <span className="text-rose-500 mr-2">({table.sync.last_sync_error})</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSyncNow}
            disabled={isSyncingNow || !table.sync.source_url}
            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-2.5 active:scale-95 disabled:opacity-50 shrink-0"
          >
            {isSyncingNow ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>שואב ומעדכן נתונים מ-Google Sheets...</span></>) : (<><Play className="w-4 h-4 fill-current" /><span>סנכרן עכשיו (עדכון ידני)</span></>)}
          </button>
        </div>

        {syncFeedback && (
          <div className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${syncFeedback.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {syncFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{syncFeedback.message}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <form onSubmit={handleSaveSettings} className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900">הגדרת מועדי עדכון וחיבור מקור</h4>
            </div>
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />נשמר בהצלחה</span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />קישור מקור ל-Google Sheets</span>
              <span className="text-[11px] text-slate-500">חובה שהגיליון יהיה פתוח לצפייה לכל מי שיש לו קישור</span>
            </label>
            <input
              type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              dir="ltr"
            />
          </div>

          <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="text-xs font-bold text-slate-900">הפעל סנכרון רקע מתוזמן (Auto-Sync)</span>
                  <p className="text-[11px] text-slate-500">שרת המערכת יבצע פנייה ושאיבת נתונים אוטומטית במרווח הקבוע</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={autoSyncEnabled} onChange={(e) => setAutoSyncEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {autoSyncEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">תדירות עדכון</label>
                  <select value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))} className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500">
                    <option value={1}>כל דקה אחת (1 Minute)</option>
                    <option value={5}>כל 5 דקות (5 Minutes)</option>
                    <option value={15}>כל 15 דקות (15 Minutes) - מומלץ</option>
                    <option value={30}>כל 30 דקות (30 Minutes)</option>
                    <option value={60}>כל שעה (1 Hour)</option>
                    <option value={360}>כל 6 שעות (6 Hours)</option>
                    <option value={1440}>כל 24 שעות (Daily)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">שיטת עדכון ב-DB (Sync Strategy)</label>
                  <select value={syncMode} onChange={(e) => setSyncMode(e.target.value as InternalDataSyncMode)} className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500">
                    <option value="replace">החלפה מלאה (מחיקת ישן וכתיבת חדש)</option>
                    <option value="upsert">עדכון חכם לפי מפתח ייחודי (Upsert / Merge)</option>
                    <option value="append">הוספה בלבד ללא מחיקה (Append Only)</option>
                  </select>
                </div>
                {syncMode === 'upsert' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">שדה מפתח ייחודי למיזוג (למשל: phone, email)</label>
                    <input type="text" value={uniqueKeyField} onChange={(e) => setUniqueKeyField(e.target.value)} placeholder="phone, email, id..." className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono" />
                    <p className="text-[11px] text-slate-500 mt-1">רשומות עם אותו מפתח יעודכנו, ורשומות חדשות יתווספו למסד.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={isSavingSettings} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50">
              {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>שמור הגדרות סנכרון</span>
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /><span>סטטוס מנוע הסנכרון</span>
          </h4>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-600">סוג מקור:</span>
              <span className="font-semibold text-slate-900">{table.source_type === 'google_sheet' ? 'Google Sheets חי' : table.source_type === 'excel_url' ? 'קובץ CSV / Excel' : 'מסד נתונים פנימי'}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-600">רשומות פעילות ב-DB:</span>
              <span className="font-semibold text-emerald-700 font-mono text-sm">{table.recordCount}</span>
            </div>
            {table.sync.next_sync_at && (
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600">סנכרון הבא:</span>
                <span className="font-mono text-indigo-700 font-semibold">{new Date(table.sync.next_sync_at).toLocaleTimeString('he-IL')}</span>
              </div>
            )}
          </div>
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 space-y-1">
            <div className="font-bold">איך עובד הסנכרון?</div>
            <p className="text-slate-600">המערכת מתחברת אוטומטית לקובץ Google Sheets, קוראת את השורות ומבצעת עדכון ישיר במסד הפנימי. כל קריאות ה-API החיצוניות יקבלו מיד את הנתונים העדכניים.</p>
          </div>
        </div>

      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600" />
            <h4 className="text-sm font-bold text-slate-900">יומן היסטוריית סנכרון (Sync Logs)</h4>
          </div>
          <button onClick={loadLogs} disabled={isLoadingLogs} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">טרם נרשמו פעולות סנכרון. לחץ על "סנכרן עכשיו" לביצוע סנכרון ראשון.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2.5">זמן</th><th className="px-3 py-2.5">טריגר</th><th className="px-3 py-2.5">סטטוס</th>
                  <th className="px-3 py-2.5">עובדו</th><th className="px-3 py-2.5">נוספו / עודכנו / הוחלפו</th>
                  <th className="px-3 py-2.5">משך</th><th className="px-3 py-2.5">הודעה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-mono text-slate-600">{new Date(log.timestamp).toLocaleString('he-IL')}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                        {log.trigger === 'manual' ? 'ידני' : log.trigger === 'scheduled' ? 'מתוזמן' : 'ראשוני'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {log.status === 'success' ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />הצליח</span>
                      ) : (
                        <span className="text-rose-700 font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-rose-600" />נכשל</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-900 font-semibold">{log.recordsProcessed}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">
                      <span className="text-emerald-700 font-medium">+{log.recordsAdded}</span> /{' '}
                      <span className="text-sky-700 font-medium">~{log.recordsUpdated}</span> /{' '}
                      <span className="text-slate-500">-{log.recordsDeleted}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">{log.durationMs}ms</td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-xs truncate">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
