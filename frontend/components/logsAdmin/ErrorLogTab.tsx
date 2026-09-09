/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin panel — "תיעוד שגיאות" tab.
 *
 * Read-only, filterable/paginated viewer over the ErrorLog collection
 * (backend/logsAdmin/ErrorLog.model.js), which is populated automatically for
 * every error a platform client hits — a tenant in the admin/UI interface, or
 * an end WhatsApp customer during a bot conversation. See
 * backend/logsAdmin/responseErrorInterceptor.js and
 * frontend/components/logsAdmin/reportClientError.ts for how entries get here.
 *
 * Structurally mirrors frontend/components/sms-in/SmsExternalLogTab.tsx
 * (filter bar + responsive table/cards + pagination), kept in its own
 * `logsAdmin` folder rather than touching that file.
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Filter, ChevronRight, ChevronLeft, X } from 'lucide-react';

const PAGE_SIZE = 50;

const CATEGORY_LABELS: Record<string, string> = {
  auth: 'אימות/הרשאות',
  whatsapp_send: 'שליחת וואטסאפ',
  webhook: 'Webhook נכנס',
  api: 'API כללי',
  client_ui: 'ממשק לקוח',
  network: 'רשת',
  internal: 'פנימי',
};

interface ErrorLogEntry {
  _id: string;
  seq: number;
  category: string;
  source?: string;
  message_he?: string;
  message_en?: string;
  client_name?: string | null;
  end_customer_phone?: string | null;
  status_code?: number | null;
  createdAt: string;
}

interface ErrorLogTabProps {
  token: string;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/admin/error-logs'
  : `${window.location.origin}/api/admin/error-logs`;

export default function ErrorLogTab({ token }: ErrorLogTabProps) {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [debouncedClient, setDebouncedClient] = useState('');

  const [categories, setCategories] = useState<string[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedClient(clientFilter.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [clientFilter]);

  useEffect(() => {
    fetch(`${API_BASE}/meta`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setClients(Array.isArray(data.clients) ? data.clients : []);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (categoryFilter) params.set('category', categoryFilter);
        if (debouncedClient) params.set('clientName', debouncedClient);

        const res = await fetch(`${API_BASE}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || 'שגיאה בטעינת תיעוד השגיאות');
          setLogs([]);
          setTotal(0);
          return;
        }
        setLogs(Array.isArray(data.entries) ? data.entries : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading error log:', e);
          setError('שגיאה בטעינת תיעוד השגיאות');
          setLogs([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => { cancelled = true; };
  }, [token, page, categoryFilter, debouncedClient]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);
  const hasActiveFilters = !!(categoryFilter || clientFilter);

  const clearFilters = () => {
    setCategoryFilter('');
    setClientFilter('');
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleString('he-IL');

  return (
    <div className="space-y-4">
      {/* FILTER BAR */}
      <div className="bg-white shadow-sm rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Filter size={16} className="text-sky-600" />
          <h3 className="font-black text-slate-900 text-sm">סינון</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">סוג שגיאה</label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium"
            >
              <option value="">כל הסוגים</option>
              {categories.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">לקוח</label>
            <input
              type="text"
              list="error-log-clients"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder="חיפוש לפי שם/אימייל לקוח"
              className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium"
            />
            <datalist id="error-log-clients">
              {clients.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button onClick={clearFilters} className="text-sm text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1">
              <X size={14} />
              נקה סינון
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
              <>טוען…</>
            ) : total > 0 ? (
              <>
                מציג <span className="text-sky-600 font-black">{pageStart}-{pageEnd}</span> מתוך{' '}
                <span className="font-black text-slate-800">{total}</span> שגיאות
              </>
            ) : (
              <>אין שגיאות תואמות</>
            )}
          </span>
        </div>

        {!loading && logs.length === 0 ? (
          <div className="py-16 sm:py-20 flex flex-col items-center justify-center gap-3 text-slate-300 px-4">
            <AlertTriangle size={48} strokeWidth={1} />
            <p className="text-lg font-bold text-center text-slate-700">אין תיעוד שגיאות</p>
            <p className="text-sm text-slate-400 font-semibold text-center">כל השגיאות שלקוחות נתקלים בהן יופיעו כאן</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden p-3 space-y-3 bg-slate-50/40">
              {logs.map((log) => (
                <div key={`mobile-${log._id}`} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        #{log.seq} · {CATEGORY_LABELS[log.category] || log.category}
                        {log.status_code != null && <span className="text-rose-600"> · {log.status_code}</span>}
                      </p>
                      <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">{log.client_name || 'לא משויך ללקוח'}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{formatTime(log.createdAt)}</span>
                  </div>
                  <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 space-y-1.5">
                    <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{log.message_he}</p>
                    <p className="text-xs text-slate-400 whitespace-pre-wrap break-words" dir="ltr">{log.message_en}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <div className="min-w-[900px]">
                <div
                  className="grid gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide"
                  style={{ gridTemplateColumns: '1fr 0.6fr 0.6fr 0.9fr 2fr 2fr 1.2fr' }}
                >
                  <span>שעה</span>
                  <span>מס' שגיאה</span>
                  <span>קוד HTTP</span>
                  <span>סוג</span>
                  <span>פירוט (עברית)</span>
                  <span>פירוט (English)</span>
                  <span>לקוח</span>
                </div>

                {logs.map((log, idx) => (
                  <div
                    key={log._id}
                    className={`grid gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors ${
                      idx !== logs.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                    style={{ gridTemplateColumns: '1fr 0.6fr 0.6fr 0.9fr 2fr 2fr 1.2fr' }}
                  >
                    <div className="text-sm text-slate-400 font-medium whitespace-nowrap">{formatTime(log.createdAt)}</div>
                    <div className="text-sm font-black text-slate-900">#{log.seq}</div>
                    <div className="text-sm font-bold text-rose-600">{log.status_code ?? '—'}</div>
                    <div className="text-sm font-semibold text-slate-700">{CATEGORY_LABELS[log.category] || log.category}</div>
                    <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{log.message_he}</div>
                    <div className="text-sm text-slate-500 whitespace-pre-wrap break-words" dir="ltr">{log.message_en}</div>
                    <div className="text-sm font-semibold text-slate-700 truncate">{log.client_name || '—'}</div>
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
