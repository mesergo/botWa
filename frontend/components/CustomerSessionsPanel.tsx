import React, { useState, useEffect, useRef } from 'react';
import ChatImage from './shared/ChatImage';
import {
  Search, List, Phone, Bot, Clock, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  MessageSquare, X, User as UserIcon, ExternalLink
} from 'lucide-react';

/**
 * Self-contained "Sessions" view scoped to a single customer.
 * Mirrors AdminPanel.tsx's global "SESSIONS TAB" (search, table, pagination,
 * per-row parameter/history expansion, history side panel with full message
 * rendering) but only shows sessions belonging to bots owned by `userId`.
 */
interface CustomerSessionsPanelProps {
  token: string;
  apiBase: string;
  userId: string;
} 
 
const CustomerSessionsPanel: React.FC<CustomerSessionsPanelProps> = ({ token, apiBase, userId }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsSearch, setSessionsSearch] = useState('');
  const [sessionsSearchInput, setSessionsSearchInput] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.id === historyOpenId) ?? null;

  // Advanced search: bot picker (customer's own bots — helps when the admin
  // doesn't remember the exact bot name)
  const [botsList, setBotsList] = useState<{ id: string; name: string }[]>([]);
  const [showBotDropdown, setShowBotDropdown] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const filteredBots = botsList.filter(b =>
    !sessionsSearchInput.trim() || (b.name || '').toLowerCase().includes(sessionsSearchInput.trim().toLowerCase())
  );

  const fetchSessions = async (page = 1, search = '') => {
    try {
      setSessionsLoading(true);
      const params = new URLSearchParams({ page: String(page), search, userId, pageSize: '10' });
      const response = await fetch(`${apiBase}/sessions/all-sessions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
        setSessionsTotalPages(data.totalPages);
        setSessionsTotal(data.total);
        setSessionsPage(data.page);
      }
    } catch (err) {
      console.error('Failed to fetch customer sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Initial load + reload whenever the selected customer changes
  useEffect(() => {
    setSessionsSearch('');
    setSessionsSearchInput('');
    setExpandedSessionId(null);
    setHistoryOpenId(null);
    fetchSessions(1, '');

    (async () => {
      try {
        const response = await fetch(`${apiBase}/admin/users/${userId}/bots`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setBotsList(data.bots || []);
        }
      } catch (err) {
        console.error('Failed to fetch customer bots', err);
      }
    })();
  }, [userId]);

  // Close the bot-picker dropdown when clicking outside the search box
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowBotDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchSessions(sessionsPage, sessionsSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsPage]);

  // Debounced search: fire API call 400ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSessionsSearch(sessionsSearchInput);
      setSessionsPage(1);
      fetchSessions(1, sessionsSearchInput);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsSearchInput]);

  // Scroll history panel to bottom when it opens/changes
  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [historyOpenId]);

  const toggleSessionActive = async (sessionId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`${apiBase}/sessions/${sessionId}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, is_active: data.is_active } : s
        ));
      }
    } catch (err) {
      console.error('Failed to toggle session active state', err);
    }
  };

  const fmtMsgDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col xl:flex-row h-full overflow-hidden">

      {/* LEFT: Sessions list (flex-1, scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="space-y-4 animate-fade-in-up">
          {/* Counter + Search bar side by side */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            {!sessionsLoading && sessions.length > 0 ? (
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                {sessionsTotal} סשנים · עמוד {sessionsPage} מתוך {sessionsTotalPages}
              </p>
            ) : <span />}
            <div className="relative max-w-md w-full sm:w-auto sm:flex-1" ref={searchBoxRef}>
              <Search size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                value={sessionsSearchInput}
                onChange={e => setSessionsSearchInput(e.target.value)}
                onFocus={() => setShowBotDropdown(true)}
                placeholder="חיפוש לפי טלפון או בוט..."
                className="w-full ps-10 pe-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
              />
              {sessionsSearchInput && (
                <button
                  type="button"
                  onClick={() => { setSessionsSearchInput(''); setShowBotDropdown(false); }}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  title="נקה חיפוש"
                >
                  <X size={14} />
                </button>
              )}

              {/* Advanced search: bot picker dropdown — only render when at least
                  one bot NAME matches the typed text (e.g. searching by phone
                  number naturally won't match any bot name, so we hide the box
                  entirely instead of showing a confusing "no match" message). */}
              {showBotDropdown && filteredBots.length > 0 && (
                <div
                  className="absolute z-20 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"
                >
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    בחר בוט מהרשימה
                  </p>
                  {filteredBots.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSessionsSearchInput(b.name);
                        setSessionsSearch(b.name);
                        setSessionsPage(1);
                        fetchSessions(1, b.name);
                        setShowBotDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors text-start"
                    >
                      <Bot size={14} className="text-blue-400 flex-shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 font-bold">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent me-3" />
              טוען סשנים...
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-4">
              <List size={64} strokeWidth={1} />
              <p className="text-xl font-bold">לא נמצאו סשנים ללקוח זה</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-start px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">טלפון</th>
                      <th className="text-start px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">בוט</th>
                      <th className="text-start px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">תאריך</th>
                      <th className="text-start px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">סטטוס</th>
                      <th className="text-start px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map(session => {
                      const isExpanded = expandedSessionId === session.id;
                      const isHistoryOpen = historyOpenId === session.id;
                      const paramEntries = Object.entries(session.parameters || {}).filter(([, v]) => v !== null && v !== '' && v !== undefined);
                      const hasHistory = (session.process_history || []).length > 0;
                      const formatD = (d: string | null) => {
                        if (!d) return 'לא ידוע';
                        const dt = new Date(d);
                        if (isNaN(dt.getTime())) return 'לא ידוע';
                        return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      };
                      return (
                        <React.Fragment key={session.id}>
                          <tr className={`transition-colors ${isHistoryOpen ? 'bg-sky-50/60' : session.is_active ? 'hover:bg-slate-50/60' : 'bg-slate-50/40 hover:bg-slate-50'}`}>
                            {/* Phone */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Phone size={13} className="text-slate-300 flex-shrink-0" />
                                <span className="font-bold text-slate-700 text-sm" dir="ltr">{session.phone}</span>
                              </div>
                            </td>
                            {/* Bot */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Bot size={13} className="text-blue-400 flex-shrink-0" />
                                <span className="text-sm font-bold text-slate-600">{session.bot_name}</span>
                              </div>
                            </td>
                            {/* Date */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Clock size={12} className="flex-shrink-0" />
                                <span className="text-xs font-bold">{formatD(session.created_at)}</span>
                              </div>
                            </td>
                            {/* Status */}
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleSessionActive(session.id, session.is_active)}
                                title={session.is_active ? 'לחץ להשבית' : 'לחץ להפעיל'}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                                  session.is_active
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                                }`}
                              >
                                {session.is_active
                                  ? <><ToggleRight size={14} /><span>פעיל</span></>
                                  : <><ToggleLeft size={14} /><span>כבוי</span></>}
                              </button>
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {paramEntries.length > 0 && (
                                  <button
                                    onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                                      isExpanded
                                        ? 'bg-slate-200 text-slate-700'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                    }`}
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    פרמטרים
                                  </button>
                                )}
                                {hasHistory && (
                                  <button
                                    onClick={() => setHistoryOpenId(isHistoryOpen ? null : session.id)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                                      isHistoryOpen
                                        ? 'bg-sky-100 text-sky-600'
                                        : 'bg-sky-50 text-sky-500 hover:bg-sky-100 hover:text-sky-600'
                                    }`}
                                  >
                                    <MessageSquare size={13} />
                                    היסטוריה
                                    <span className="bg-sky-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none">
                                      {session.process_history.length}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Expanded parameters row */}
                          {isExpanded && paramEntries.length > 0 && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={5} className="px-6 py-4 border-t border-slate-100">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">פרמטרים שנאספו</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {paramEntries.map(([key, value]) => (
                                    <div key={key} className="bg-white border border-slate-100 rounded-xl p-3">
                                      <p className="text-xs font-black text-slate-400 mb-1">{key}</p>
                                      <p className="text-sm font-bold text-slate-700 truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {sessionsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-4">
                  <button
                    onClick={() => { setSessionsPage(p => Math.max(1, p - 1)); }}
                    disabled={sessionsPage <= 1 || sessionsLoading}
                    className="px-2.5 py-1 text-slate-400 rounded-lg text-xs font-bold hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ‹ הקודם
                  </button>

                  {Array.from({ length: sessionsTotalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === sessionsTotalPages || Math.abs(p - sessionsPage) <= 2)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`dot-${idx}`} className="px-1 text-slate-300 text-xs">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => { setSessionsPage(item as number); }}
                          disabled={sessionsLoading}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            sessionsPage === item
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => { setSessionsPage(p => Math.min(sessionsTotalPages, p + 1)); }}
                    disabled={sessionsPage >= sessionsTotalPages || sessionsLoading}
                    className="px-2.5 py-1 text-slate-400 rounded-lg text-xs font-bold hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    הבא ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT: History side panel (larger — wider & taller) */}
      {historyOpenId && activeSession && (() => {
        const session = activeSession;
        return (
          <div className="w-full xl:w-[55%] 2xl:w-1/2 flex-shrink-0 border-t xl:border-t-0 xl:border-e border-slate-200 flex flex-col overflow-hidden bg-white shadow-lg h-[80vh] xl:h-full">
            {/* Panel header */}
            <div className="flex-shrink-0 px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center shadow">
                  <Bot size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[130px]">{session.bot_name}</p>
                  <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[130px]">{session.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryOpenId(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0"
                title="סגור"
              >
                <X size={16} />
              </button>
            </div>
            {/* Messages */}
            <div
              ref={historyScrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#fcfcfc]"
            >
              {session.process_history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                  <MessageSquare size={36} strokeWidth={1} />
                  <p className="text-xs font-bold">אין הודעות</p>
                </div>
              ) : (() => {
                const grouped: any[] = [];
                let hi = 0;
                while (hi < session.process_history.length) {
                  const cur = session.process_history[hi];
                  if (cur.type === 'waitingwebservice') { hi++; continue; }
                  if (cur.type === 'SendItem') {
                    const cards: any[] = [];
                    const created = cur.created;
                    while (hi < session.process_history.length && session.process_history[hi].type === 'SendItem') {
                      cards.push(session.process_history[hi]); hi++;
                    }
                    grouped.push({ type: '_carousel', carouselItems: cards, created });
                  } else {
                    grouped.push(cur); hi++;
                  }
                }
                return grouped.map((item: any, idx: number) => {
                const sender: 'bot' | 'user' = item.sender
                  ? item.sender
                  : item.type === 'UserInput' ? 'user' : 'bot';
                const isBot = sender === 'bot';
                const text = item.text ?? item.content ?? '';
                const msgDate = item.created ? fmtMsgDate(item.created) : '';
                const isAudioUrl = /^https?:\/\/.+\.(oga|ogg|mp3|wav|m4a|aac|opus)(\?.*)?$/i.test((item.url || text));
                return (
                  <div key={idx} className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}>
                    <div className={`flex gap-1.5 max-w-[90%] ${isBot ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm ${
                        isBot ? 'bg-white border border-slate-100 text-slate-700' : 'bg-sky-500 text-white'
                      }`}>
                        {isBot ? <Bot size={13} /> : <UserIcon size={13} />}
                      </div>
                      <div className={`flex flex-col gap-0.5 ${isBot ? 'items-end' : 'items-start'}`}>
                        <div className={`px-3 py-2 rounded-2xl text-xs font-semibold shadow-sm text-start ${
                          isBot
                            ? 'bg-white border border-slate-100 text-slate-900 rounded-ss-none'
                            : 'bg-sky-500 text-white rounded-se-none'
                        }`}>
                          {(item.type === 'Text' || item.type === 'UserInput' || !item.type || item.type.startsWith('input_')) && text && !isAudioUrl && (
                            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                          )}
                          {item.type === 'Image' && item.url && (
                            <>
                              <img
                                src={item.url}
                                alt="תמונה"
                                className="rounded-xl max-w-[160px] h-auto mb-2"
                                onLoad={() => console.log('[CustomerSessionsPanel][Image] ✅ loaded:', item.url)}
                                onError={() => console.error('[CustomerSessionsPanel][Image] ❌ FAILED to load image. url=', item.url, '| full item=', item)}
                              />
                              {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                            </>
                          )}
                          {item.type === 'Video' && item.url && (
                            <>
                              <video src={item.url} controls className="rounded-xl max-w-[160px] mb-2" />
                              {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                            </>
                          )}
                          {item.type === 'Document' && item.url && (
                            <>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-600 underline text-[11px] mb-2">
                                <ExternalLink size={10} /> פתח מסמך
                              </a>
                              {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                            </>
                          )}
                          {(item.type === 'Audio' || isAudioUrl) && (item.url || text) && (
                            <>
                              <p className="text-[10px] font-semibold mb-1 opacity-70">🎙️ הקלטה</p>
                              <audio src={item.url || text} controls className="max-w-[200px] mb-1" />
                            </>
                          )}
                          {item.type === 'URL' && (
                            <div>
                              {text && <p>{text}</p>}
                              {item.url && (
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline opacity-80 break-all flex items-center gap-1">
                                  {item.url} <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          )}
                          {item.type === 'Options' && (
                            <div>
                              {text && <p className="mb-1 text-[10px] text-slate-400 font-black uppercase tracking-widest">{text}</p>}
                              {Array.isArray(item.options) && (
                                <div className="flex flex-col gap-1">
                                  {item.options.filter((o: string) => o !== 'default').map((opt: string, i: number) => (
                                    <div key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700">{opt}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Carousel (SendItem) */}
                          {item.type === '_carousel' && Array.isArray(item.carouselItems) && (
                            <div className="flex gap-2 overflow-x-auto pb-1 max-w-[220px]">
                              {item.carouselItems.map((card: any, ci: number) => (
                                <div key={ci} className="flex-shrink-0 w-36 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                  {card.image && <img src={card.image} alt={card.title || ''} className="w-full h-20 object-cover" />}
                                  <div className="p-2">
                                    {card.title && <p className="text-[11px] font-black text-slate-800 leading-tight">{card.title}</p>}
                                    {card.subtitle && <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{card.subtitle}</p>}
                                    {card.url && (
                                      <a href={card.url} target="_blank" rel="noopener noreferrer"
                                        className="mt-1 flex items-center gap-1 text-[9px] text-sky-600 font-bold hover:underline">
                                        <ExternalLink size={8} /> פתח
                                      </a>
                                    )}
                                    {Array.isArray(card.options) && card.options.length > 0 && (
                                      <div className="mt-1 flex flex-col gap-0.5">
                                        {card.options.map((opt: any, oi: number) => (
                                          <div key={oi} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-700 text-center">
                                            {typeof opt === 'object' ? opt.text : opt}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {msgDate && (
                          <span className="text-[9px] text-slate-400 font-semibold px-0.5">{msgDate}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CustomerSessionsPanel;
