import React from 'react';
import {
  History, RotateCcw, Calendar, FileText,
  CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface GroupSummary {
  _id: string;
  name: string;
  is_blocklist: boolean;
  contact_count: number;
}

interface BroadcastsViewProps {
  allBroadcastsLoading: boolean;
  allBroadcasts: any[];
  allBroadcastsGroupFilter: string;
  setAllBroadcastsGroupFilter: (v: string) => void;
  groups: GroupSummary[];
  selectedBroadcast: any;
  setSelectedBroadcast: (b: any) => void;
  loadAllBroadcasts: () => void;
  authHeader: Record<string, string>;
}

const BroadcastsView: React.FC<BroadcastsViewProps> = ({
  allBroadcastsLoading, allBroadcasts,
  allBroadcastsGroupFilter, setAllBroadcastsGroupFilter,
  groups, selectedBroadcast, setSelectedBroadcast,
  loadAllBroadcasts, authHeader,
}) => {
  const filtered = allBroadcastsGroupFilter
    ? allBroadcasts.filter(b => String(b.group_id) === allBroadcastsGroupFilter)
    : allBroadcasts;

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <History size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">שליחות מרוכזות</h1>
            <p className="text-slate-400 text-sm font-semibold mt-0.5">
              רשימת כל השליחות מכל הקבוצות ומשלוחים מותאמים אישית.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={allBroadcastsGroupFilter}
            onChange={e => setAllBroadcastsGroupFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            <option value="">כל הרשימות</option>
            {groups.map(g => (
              <option key={g._id} value={g._id}>{g.name}</option>
            ))}
          </select>
          <button
            onClick={() => loadAllBroadcasts()}
            disabled={allBroadcastsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm transition-colors disabled:opacity-50"
          >
            <RotateCcw size={15} className={allBroadcastsLoading ? 'animate-spin' : ''} /> רענן
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {allBroadcastsLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-300">
          <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
          <History size={64} strokeWidth={1} />
          <p className="text-xl font-bold">לא נמצאו שליחות</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[9rem_1fr_5rem_4rem_4rem_4rem_4rem_5rem_5rem] gap-2 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
            <span>תאריך</span>
            <span>תוכן</span>
            <span>רשימה</span>
            <span>סה"כ</span>
            <span>נשלחו</span>
            <span>נכשלו</span>
            <span>דולגו</span>
            <span>תזמון</span>
            <span>סטטוס</span>
          </div>
          {filtered.map((b, idx) => {
            const isPartial = b.processed > 0 && b.processed < b.total;
            const isStopped = (b.status === 'failed' || b.status === 'running' || (b.status === 'queued' && b.processed > 0)) && isPartial;
            return (
              <div
                key={b._id}
                onClick={() => {
                  setSelectedBroadcast(null);
                  fetch(`${API_BASE}/groups/broadcasts/${b._id}`, { headers: authHeader })
                    .then(r => r.ok ? r.json() : Promise.reject(r))
                    .then(data => setSelectedBroadcast(data))
                    .catch(err => console.error('Failed to fetch broadcast detail', err));
                }}
                className={`grid grid-cols-[9rem_1fr_5rem_4rem_4rem_4rem_4rem_5rem_5rem] gap-2 px-6 py-3.5 items-start hover:bg-slate-50/70 transition-colors cursor-pointer ${
                  idx !== filtered.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <Calendar size={13} className="text-slate-400" />
                  {new Date(b.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div className="min-w-0">
                  {b.is_template ? (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-black flex-shrink-0">תבנית</span>
                      <span className="text-sm font-bold text-slate-800 break-words">{b.template_name}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 break-words whitespace-pre-wrap line-clamp-2">{b.message}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md truncate max-w-[4.5rem]"
                    title={b.group_name || '—'}
                  >
                    {b.group_name || '—'}
                  </span>
                </div>
                <span className="text-sm font-black text-slate-700">{b.total}</span>
                <span className="text-sm font-black text-green-600">{b.sent}</span>
                <span className="text-sm font-black text-red-500">{b.failed}</span>
                <span className="text-sm font-black text-amber-500">{b.skipped}</span>
                <span>
                  {b.scheduled_at ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-black w-fit">מתוזמן</span>
                      <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                        {new Date(b.scheduled_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-xs font-semibold">מיידי</span>
                  )}
                </span>
                <span>
                  {b.status === 'cancelled' && <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-md text-xs font-black">בוטל</span>}
                  {b.status === 'completed' && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-xs font-black">הושלם</span>}
                  {isStopped && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-black">הופסק ({b.processed}/{b.total})</span>}
                  {!isStopped && b.status === 'running' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-black animate-pulse">רץ</span>}
                  {!isStopped && b.status === 'queued' && b.processed === 0 && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-xs font-black">בתור</span>}
                  {!isStopped && b.status === 'failed' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-black">נכשל</span>}
                  {b.status === 'scheduled' && <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded-md text-xs font-semibold">ממתין</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Broadcast detail panel ── */}
      {selectedBroadcast && (
        <div className="mt-6 bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900">פרטי שליחה</h2>
              <p className="text-xs text-slate-400 mt-1">
                {selectedBroadcast.group_name || 'שליחה מותאמת אישית'} ·{' '}
                {selectedBroadcast.createdAt
                  ? new Date(selectedBroadcast.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
                  : ''}
              </p>
            </div>
            <button
              onClick={() => setSelectedBroadcast(null)}
              className="px-4 py-2 bg-slate-100 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-200"
            >
              סגור
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-6">
            <div className="p-4 bg-slate-50 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-400 mb-1">סה"כ</p>
              <p className="text-3xl font-black text-slate-900">{selectedBroadcast.total}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-2xl text-center">
              <p className="text-xs font-bold text-green-500 mb-1">נשלחו</p>
              <p className="text-3xl font-black text-green-700">{selectedBroadcast.sent}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-2xl text-center">
              <p className="text-xs font-bold text-red-500 mb-1">נכשלו</p>
              <p className="text-3xl font-black text-red-700">{selectedBroadcast.failed}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl text-center">
              <p className="text-xs font-bold text-amber-500 mb-1">דולגו</p>
              <p className="text-3xl font-black text-amber-700">{selectedBroadcast.skipped}</p>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 text-sm text-slate-600">
            <p className="font-bold mb-2">תוכן ההודעה</p>
            {selectedBroadcast.is_template ? (
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-purple-600" />
                  <span className="font-black text-purple-900">{selectedBroadcast.template_name}</span>
                </div>
                {selectedBroadcast.template_data?.params?.body?.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <p className="font-bold mb-1">פרמטרים:</p>
                    <ul className="list-disc pr-4 space-y-1">
                      {selectedBroadcast.template_data.params.body.map((p: string, i: number) => (
                        <li key={i}>{`{{${i + 1}}}: ${p || '—'}`}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedBroadcast.template_data?.params?.header?.url && (
                  <p className="mt-3 text-xs text-slate-600 break-all">
                    <span className="font-bold">מדיה:</span> {selectedBroadcast.template_data.params.header.url}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                {selectedBroadcast.message}
              </div>
            )}
          </div>

          {selectedBroadcast.recipients?.length > 0 && (
            <div className="p-6 border-t border-slate-100">
              <p className="text-xs font-black text-slate-500 mb-3">נמענים ({selectedBroadcast.recipients.length})</p>
              <div className="grid gap-2 max-h-72 overflow-y-auto">
                {selectedBroadcast.recipients.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 rounded-2xl text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {r.status === 'sent' && <CheckCircle2 size={16} className="text-green-500" />}
                      {r.status === 'failed' && <AlertTriangle size={16} className="text-red-500" />}
                      {r.status === 'skipped' && <Clock size={16} className="text-amber-500" />}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate">{r.name || r.phone}</p>
                        <p className="text-xs text-slate-400 truncate" dir="ltr">{r.phone}</p>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {r.reason === 'blocklist' && 'ברשימת הסרה'}
                      {r.reason === 'invalid_phone' && 'טלפון לא תקין'}
                      {r.error && `שגיאה: ${r.error}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default BroadcastsView;
