/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin panel — "יומן SMS חיצוני" tab.
 * 
 * Read-only viewer for SmsExternalLog documents (collection `sms` in our own
 * MongoDB), populated by the external "maskyoo" project via
 * POST /api/sms-in/external-log. Kept entirely separate from the sms-in module
 * (SmsInApp / "הודעות SMS" tab), which reads the external ilbot SMS MongoDB —
 * that tab is untouched by this file.
 *
 * Visual language intentionally mirrors the messages table in SmsInApp's
 * "sms_in" tab (filter bar + responsive table/cards + pagination) so the two
 * inbox-style tabs feel consistent in the admin panel.
 */

import React, { useEffect, useState } from 'react';
import { Search, Filter, MessageSquare, AlertCircle, ChevronRight, ChevronLeft, X } from 'lucide-react';

const PAGE_SIZE = 50;

interface ExternalLogEntry {
  _id: string;
  appName?: string;
  dest: string;
  phone: string;
  message: string;
  date?: string;
  createdAt: string;
}

interface SmsExternalLogTabProps {
  token: string;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/sms-in'
  : `${window.location.origin}/api/sms-in`;

export default function SmsExternalLogTab({ token }: SmsExternalLogTabProps) {
  const [logs, setLogs] = useState<ExternalLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [filterDest, setFilterDest] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Debounce free-text/dest search so we don't fire a request on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedDest, setDebouncedDest] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
      setDebouncedDest(filterDest.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchText, filterDest]);

  useEffect(() => {
    let cancelled = false;
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (debouncedSearch) params.set('q', debouncedSearch);
        if (debouncedDest) params.set('dest', debouncedDest);
        if (dateStart) params.set('dateStart', dateStart);
        if (dateEnd) params.set('dateEnd', dateEnd);

        const res = await fetch(`${API_BASE}/admin/external-log?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || 'שגיאה בטעינת ההודעות');
          setLogs([]);
          setTotal(0);
          return;
        }
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading external SMS log:', e);
          setError('שגיאה בטעינת ההודעות');
          setLogs([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => { cancelled = true; };
  }, [token, page, debouncedSearch, debouncedDest, dateStart, dateEnd]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);
  const hasActiveFilters = !!(searchText || filterDest || dateStart || dateEnd);

  const clearFilters = () => {
    setSearchText('');
    setFilterDest('');
    setDateStart('');
    setDateEnd('');
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* FILTER BAR */}
      <div className="bg-white shadow-sm rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Filter size={16} className="text-sky-600" />
          <h3 className="font-black text-slate-900 text-sm">מסננים וחיפוש</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2 relative min-w-0">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">חפש לפי מספר שולח / תוכן הודעה / אפליקציה</label>
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="סינון חופשי לפי מספר או טקסט..."
                className="w-full text-sm pr-9 pl-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">נמען (dest)</label>
            <input
              type="text"
              value={filterDest}
              onChange={(e) => setFilterDest(e.target.value)}
              placeholder="כל הנמענים"
              dir="ltr"
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium text-left"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="min-w-0">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">מתאריך</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full min-w-0 text-sm border border-slate-200 rounded-2xl px-3 py-2.5 bg-white text-left font-medium focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">עד תאריך</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full min-w-0 text-sm border border-slate-200 rounded-2xl px-3 py-2.5 bg-white text-left font-medium focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button onClick={clearFilters} className="text-sm text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1">
              <X size={14} />
              נקה מסננים פעילים
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
          <p className="text-sm font-bold text-rose-900">{error}</p>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
          <span className="text-sm text-slate-500 font-bold">
            {loading ? (
              <>טוען...</>
            ) : total > 0 ? (
              <>
                מציג <span className="text-sky-600 font-black">{pageStart}-{pageEnd}</span> מתוך{' '}
                <span className="font-black text-slate-800">{total}</span> הודעות
              </>
            ) : (
              <>אין הודעות תואמות</>
            )}
          </span>
        </div>

        {!loading && logs.length === 0 ? (
          <div className="py-16 sm:py-20 flex flex-col items-center justify-center gap-3 text-slate-300 px-4">
            <AlertCircle size={48} strokeWidth={1} />
            <p className="text-lg font-bold text-center text-slate-700">לא נמצאו הודעות תואמות</p>
            <p className="text-sm text-slate-400 font-semibold text-center">נסה לשנות את פרמטרי החיפוש או לבטל מסננים קיימים.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden p-3 space-y-3 bg-slate-50/40">
              {logs.map((log) => (
                <div key={`mobile-${log._id}`} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{log.phone}</p>
                      <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">אל {log.dest}{log.appName ? ` · ${log.appName}` : ''}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{log.date || new Date(log.createdAt).toLocaleString('he-IL')}</span>
                  </div>
                  <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <p className="text-xs text-slate-400 font-bold mb-1">תוכן ההודעה</p>
                    <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <div className="min-w-[700px]">
                <div
                  className="grid gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide"
                  style={{ gridTemplateColumns: '1.1fr 1.2fr 1fr 2.5fr' }}
                >
                  <span>נמען</span>
                  <span>מי שלח</span>
                  <span>תאריך</span>
                  <span>תוכן ההודעה</span>
                </div>

                {logs.map((log, idx) => (
                  <div
                    key={log._id}
                    className={`grid gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors ${
                      idx !== logs.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                    style={{ gridTemplateColumns: '1.1fr 1.2fr 1fr 2.5fr' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                        <MessageSquare size={15} />
                      </div>
                      <span className="text-sm font-bold text-slate-900 truncate">{log.dest}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 truncate">{log.phone}</div>
                    <div className="text-sm text-slate-400 font-medium whitespace-nowrap">{log.date || new Date(log.createdAt).toLocaleString('he-IL')}</div>
                    <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{log.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight size={14} />
              <span>הקודם</span>
            </button>

            <span className="text-sm text-slate-500 font-bold">
              עמוד <span className="text-sky-600">{page}</span> מתוך {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>הבא</span>
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
