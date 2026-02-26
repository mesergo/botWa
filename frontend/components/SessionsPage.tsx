import React, { useState, useEffect, useRef } from 'react';
import { Clock, MessageSquare, Search, Bot, LogOut, ChevronDown, ChevronUp, User, Phone, List, Users, ExternalLink, X } from 'lucide-react';

interface Session {
  id: string;
  phone: string;
  widget_id: string;
  bot_name: string;
  user_name?: string;
  created_at: string | null;
  parameters: Record<string, any>;
  process_history: any[];
}

interface PaginatedResponse {
  sessions: Session[];
  total: number;
  page: number;
  totalPages: number;
}

interface SessionsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenContacts?: () => void;
  ownOnly?: boolean;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const SessionsPage: React.FC<SessionsPageProps> = ({ token, currentUser, onBack, onLogout, onOpenContacts, ownOnly }) => {
  const isAdmin = currentUser?.role === 'admin';
  const showAll = isAdmin && !ownOnly;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const activeSession = sessions.find(s => s.id === historyOpenId) ?? null;

  // Scroll history to bottom whenever it opens/changes
  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [historyOpenId, activeSession]);

  const fetchSessions = async (p = 1, q = '') => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), search: q });
      const endpoint = showAll ? 'all-sessions' : 'my-sessions';
      const res = await fetch(`${API_BASE}/sessions/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: PaginatedResponse = await res.json();
        // Ensure newest-first client-side as well
        const sorted = [...data.sessions].sort((a, b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        });
        setSessions(sorted);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(1, search);
  }, [token]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchSessions(1, search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'לא ידוע';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'לא ידוע';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const isSimulator = (phone: string) =>
    phone === 'Simulated' || phone === 'simulator' || phone.toLowerCase() === 'simulated';

  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?';

  /* ─────────────────────────────────────────────────────────────
     History side-panel (simulator-style chat viewer)
  ───────────────────────────────────────────────────────────── */
  const HistoryPanel = ({ session }: { session: Session }) => (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Panel header – like simulator */}
      <div className="flex-shrink-0 px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center shadow">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">{session.bot_name}</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {isSimulator(session.phone) ? 'סימולטור' : session.phone}
            </p>
          </div>
        </div>
        <button
          onClick={() => setHistoryOpenId(null)}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          title="סגור"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={historyScrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#fcfcfc]"
        dir="rtl"
      >
        {session.process_history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <MessageSquare size={40} strokeWidth={1} />
            <p className="text-sm font-bold">אין הודעות</p>
          </div>
        ) : (() => {
          // Group consecutive SendItems into carousel entries
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
          const msgDate = item.created ? formatMessageDate(item.created) : '';

          return (
            <div
              key={idx}
              className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-1`}
            >
              <div className={`flex gap-2 max-w-[88%] ${isBot ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm
                  ${isBot ? 'bg-white border border-slate-100 text-slate-700' : 'bg-sky-500 text-white'}`}
                >
                  {isBot ? <Bot size={15} /> : <User size={15} />}
                </div>

                {/* Bubble + timestamp */}
                <div className={`flex flex-col gap-1 ${isBot ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-3xl text-sm font-semibold shadow-sm text-right
                    ${isBot
                      ? 'bg-white border border-slate-100 text-slate-900 rounded-tr-none'
                      : 'bg-sky-500 text-white rounded-tl-none'}`}
                  >
                    {/* Text / UserInput */}
                    {(item.type === 'Text' || item.type === 'UserInput' || !item.type || item.type.startsWith('input_')) && text && (
                      <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                    )}
                    {/* Image */}
                    {item.type === 'Image' && item.url && (
                      <img src={item.url} alt="תמונה" className="rounded-xl max-w-[200px] h-auto mt-1" />
                    )}
                    {/* Video */}
                    {item.type === 'Video' && item.url && (
                      <video src={item.url} controls className="rounded-xl max-w-[200px] mt-1" />
                    )}
                    {/* Document */}
                    {item.type === 'Document' && item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-sky-600 text-xs font-bold">
                        <ExternalLink size={13} /> פתח מסמך
                      </a>
                    )}
                    {/* URL / link */}
                    {item.type === 'URL' && (
                      <div>
                        {text && <p className="mb-1">{text}</p>}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs underline opacity-80 flex items-center gap-1 break-all">
                            {item.url} <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    )}
                    {/* Options menu */}
                    {item.type === 'Options' && (
                      <div>
                        {text && <p className="mb-2 text-slate-400 text-[10px] uppercase tracking-widest font-black">{text}</p>}
                        {Array.isArray(item.options) && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {item.options.filter((o: string) => o !== 'default').map((opt: string, i: number) => (
                              <div key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">{opt}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Carousel (SendItem) */}
                    {item.type === '_carousel' && Array.isArray(item.carouselItems) && (
                      <div className="flex gap-2 overflow-x-auto pb-1 max-w-[320px]">
                        {item.carouselItems.map((card: any, ci: number) => (
                          <div key={ci} className="flex-shrink-0 w-40 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {card.image && <img src={card.image} alt={card.title || ''} className="w-full h-24 object-cover" />}
                            <div className="p-2.5">
                              {card.title && <p className="text-xs font-black text-slate-800 leading-tight">{card.title}</p>}
                              {card.subtitle && <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{card.subtitle}</p>}
                              {card.url && (
                                <a href={card.url} target="_blank" rel="noopener noreferrer"
                                  className="mt-1.5 flex items-center gap-1 text-[10px] text-sky-600 font-bold hover:underline">
                                  <ExternalLink size={9} /> פתח
                                </a>
                              )}
                              {Array.isArray(card.options) && card.options.length > 0 && (
                                <div className="mt-1.5 flex flex-col gap-1">
                                  {card.options.map((opt: any, oi: number) => (
                                    <div key={oi} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-700 text-center">
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
                  {/* Timestamp */}
                  {msgDate && (
                    <span className="text-[10px] text-slate-400 font-semibold px-1">{msgDate}</span>
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

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      {/* Navbar */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer" onClick={onBack} />
        </div>
        <div className="flex items-center gap-4">
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name || currentUser.email}</span>
          )}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(v => !v)}
              title="תפריט פרופיל"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm hover:scale-110 transition-transform shadow-md select-none"
            >
              {firstName}
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-12 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 min-w-[180px] overflow-hidden" dir="rtl">
                {onOpenContacts && (
                  <button
                    onClick={() => { setProfileMenuOpen(false); onOpenContacts(); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Users size={16} className="text-blue-500 flex-shrink-0" />
                    אנשי קשר
                  </button>
                )}
                <button
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors"
                >
                  <List size={16} className="text-sky-500 flex-shrink-0" />
                  שיחות שלי
                </button>
              </div>
            )}
          </div>
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
        </div>
      </nav>

      {/* Main area – flex row: sessions list + optional history panel */}
      <div className="flex-1 flex flex-row overflow-hidden">

        {/* ── Sessions list (right, 3/4 when history is open, full otherwise) ── */}
        <div className={`transition-all duration-300 overflow-y-auto p-10 ${historyOpenId ? 'w-3/4' : 'w-full'}`}>
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                  <List size={26} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900">שיחות</h1>
                  <p className="text-slate-400 text-sm font-semibold mt-0.5">
                    {total} שיחות{showAll ? ' (כלל המשתמשים)' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-8">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                className="w-full pr-14 pl-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all text-right font-medium"
                placeholder={showAll ? 'חיפוש לפי טלפון, שם בוט או משתמש...' : 'חיפוש לפי טלפון או שם בוט...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Sessions list */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-slate-300">
                <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                <MessageSquare size={64} strokeWidth={1} />
                <p className="text-xl font-bold">עדיין אין שיחות.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.map(session => {
                  const sim = isSimulator(session.phone);
                  const isExpanded = expandedId === session.id;
                  const isHistoryOpen = historyOpenId === session.id;
                  const hasParams = Object.keys(session.parameters || {}).length > 0;
                  const hasHistory = (session.process_history || []).length > 0;

                  return (
                    <div
                      key={session.id}
                      className={`bg-white border rounded-[2rem] shadow-sm hover:shadow-md transition-all overflow-hidden
                        ${isHistoryOpen ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-100 hover:border-sky-100'}`}
                    >
                      {/* Main row */}
                      <div className="p-6 flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0
                          ${sim ? 'bg-blue-50 text-blue-400' : 'bg-sky-50 text-sky-500'}`}>
                          {sim ? <MessageSquare size={20} /> : <Phone size={20} />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-black text-slate-900 truncate">
                              {sim ? 'סימולטור' : session.phone}
                            </p>
                            {sim && (
                              <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-bold">
                                בדיקות
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 font-semibold flex-wrap">
                            <span className="flex items-center gap-1">
                              <Bot size={12} className="text-sky-400" />
                              {session.bot_name}
                            </span>
                            {showAll && session.user_name && (
                              <span className="flex items-center gap-1">
                                <User size={12} className="text-slate-400" />
                                {session.user_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              {formatDate(session.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasHistory && (
                            <button
                              onClick={() => setHistoryOpenId(isHistoryOpen ? null : session.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors
                                ${isHistoryOpen
                                  ? 'text-sky-600 bg-sky-100'
                                  : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'}`}
                            >
                              <MessageSquare size={14} />
                              היסטוריה
                              {hasHistory && (
                                <span className="bg-sky-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none">
                                  {session.process_history.length}
                                </span>
                              )}
                            </button>
                          )}
                          {hasParams && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : session.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              פרמטרים
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded parameters */}
                      {isExpanded && hasParams && (
                        <div className="border-t border-slate-100 px-6 pb-5 pt-4 bg-slate-50">
                          <p className="text-xs font-black text-slate-500 mb-3 uppercase tracking-widest">פרמטרי שיחה</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(session.parameters).map(([key, val]) => (
                              <div key={key} className="bg-white border border-slate-200 rounded-xl p-3">
                                <p className="text-xs text-slate-400 font-bold mb-1">{key}</p>
                                <p className="text-sm font-black text-slate-800 break-all">{String(val)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchSessions(page - 1, search)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  הקודם
                </button>
                <span className="text-sm font-bold text-slate-500">
                  עמוד {page} מתוך {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchSessions(page + 1, search)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  הבא
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── History side panel (left, 1/4 width) ── */}
        {historyOpenId && activeSession && (
          <div className="w-1/4 flex-shrink-0 border-r border-slate-200 overflow-hidden">
            <HistoryPanel session={activeSession} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionsPage;
